// Fire Triangle — static site + secure AI assistant proxy.
// The OpenRouter key NEVER reaches the browser: it lives in process.env and is
// only used server-side here. The browser talks to /api/chat on this origin.
const express = require("express");
const path = require("path");
const fs = require("fs");
const { imageId } = require("./lib/image-id");
const { tokensMatch } = require("./lib/admin-auth");
const { validateImage, storeImage } = require("./lib/image-store");
const { makeDailyCap } = require("./lib/daily-cap");
const { cleanupProductImage } = require("./lib/gemini-image");
const { validateSite, mergeDefaults, buildSystemPrompt } = require("./lib/content");

const app = express();
app.set("trust proxy", 1); // trust Railway's single-hop proxy so req.ip is the real client
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "SAMEORIGIN");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});
// Normal routes use a tight JSON limit; the image-upload route needs more headroom.
app.use((req, res, next) => {
  const big = req.path === "/api/admin/upload" || req.path === "/api/admin/poster-image";
  return big ? next() : express.json({ limit: "32kb" })(req, res, next);
});

const SITE = path.join(__dirname, "site");
const IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
const KEY = process.env.OPENROUTER_API_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
const aiImageCap = makeDailyCap(10, 24 * 60 * 60 * 1000); // 10 product-shot generations / 24h

// TLS posture decided from the parsed hostname (not a substring match on the
// whole URL). The private Railway network needs no TLS; any other host carries
// the password over the internet and must verify the cert by default. Accepting
// Railway's self-signed proxy cert is an explicit, opt-in operator choice.
function pgSslFor(url) {
  let host = "";
  try { host = new URL(url).hostname; } catch (e) { host = ""; }
  if (host.endsWith(".railway.internal")) return false;
  if (process.env.PGSSL_NO_VERIFY === "1") return { rejectUnauthorized: false };
  return { rejectUnauthorized: true };
}
function dbClient() {
  const { Client } = require("pg");
  const url = process.env.DATABASE_URL;
  return new Client({ connectionString: url, ssl: pgSslFor(url) });
}

async function ensureSchema() {
  if (!process.env.DATABASE_URL) return;
  const c = dbClient();
  try {
    await c.connect();
    await c.query("CREATE TABLE IF NOT EXISTS images (id TEXT PRIMARY KEY, mime TEXT NOT NULL, bytes BYTEA NOT NULL, created_at TIMESTAMPTZ DEFAULT now())");
    await c.query("ALTER TABLE images ADD COLUMN IF NOT EXISTS label TEXT");
    await c.query("CREATE TABLE IF NOT EXISTS content (key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())");
    console.log("schema ensured");
  } catch (e) { console.error("ensureSchema failed:", e.message); }
  finally { try { await c.end(); } catch (e) {} }
}

function adminOk(req) {
  if (!ADMIN_PASSWORD) return false;
  const t = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  return tokensMatch(t, ADMIN_PASSWORD);
}
function cleanStr(v, max) { var s = v == null ? null : String(v).trim(); if (s === "") s = null; return s == null ? null : s.slice(0, max || 400); }

// ---- Global site settings (single source of truth), cached in-process ----
// Read-through cache: the DB is only touched on first read and refreshed on
// save (PUT /api/admin/content/site), so public page views + chat requests hit
// memory rather than adding a per-request Postgres hit. Falls back to the
// canonical defaults when there is no DB.
let siteCache = null;
async function loadSite() {
  if (siteCache) return siteCache;
  if (!process.env.DATABASE_URL) { siteCache = mergeDefaults(null); return siteCache; }
  const c = dbClient();
  try {
    await c.connect();
    const { rows } = await c.query("SELECT value FROM content WHERE key=$1", ["site"]);
    siteCache = mergeDefaults(rows.length ? rows[0].value : null);
  } catch (e) {
    console.error("loadSite failed, using defaults:", e.message);
    siteCache = mergeDefaults(null);
  } finally { try { await c.end(); } catch (e) {} }
  return siteCache;
}

// ---- Simple in-memory rate limiter (protects the OpenRouter credits) ----
const HITS = new Map(); // ip -> [timestamps]
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 15;
function rateLimited(ip) {
  const now = Date.now();
  const arr = (HITS.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  HITS.set(ip, arr);
  if (HITS.size > 5000) {
    for (const [k, ts] of HITS) { if (!ts.length || now - ts[ts.length - 1] >= WINDOW_MS) HITS.delete(k); }
  }
  return arr.length > MAX_PER_WINDOW;
}

app.post("/api/chat", async (req, res) => {
  if (!KEY) return res.status(503).json({ error: "The assistant isn't configured yet." });

  const ip = req.ip || "?";
  if (rateLimited(ip)) return res.status(429).json({ error: "You're sending messages too quickly — give me a moment." });

  const incoming = Array.isArray(req.body && req.body.messages) ? req.body.messages : [];
  const messages = incoming
    .slice(-10)
    .map((m) => ({
      role: m && m.role === "assistant" ? "assistant" : "user",
      content: String((m && m.content) || "").slice(0, 1500),
    }))
    .filter((m) => m.content.trim().length > 0);

  if (messages.length === 0) return res.status(400).json({ error: "Empty message." });

  const systemPrompt = buildSystemPrompt(await loadSite());
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://fire-triangle-production.up.railway.app",
        "X-Title": "Fire Triangle Assistant",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        max_tokens: 500,
        temperature: 0.4,
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error("OpenRouter error", r.status, detail.slice(0, 500));
      return res.status(502).json({ error: "The assistant is busy right now — please try again in a moment." });
    }
    const data = await r.json();
    const reply = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    res.json({ reply: reply || "Sorry, I couldn't generate a reply — please try rephrasing." });
  } catch (e) {
    console.error("Chat handler failed:", e);
    res.status(500).json({ error: "Something went wrong reaching the assistant." });
  }
});

// ---- Product catalogue: DB when available, else the bundled JSON file ----
let PRODUCTS_FILE = null;
function fileProducts() {
  if (!PRODUCTS_FILE) {
    try { PRODUCTS_FILE = JSON.parse(fs.readFileSync(path.join(__dirname, "db", "products.json"), "utf8")); }
    catch (e) { console.error("products.json read failed:", e.message); PRODUCTS_FILE = []; }
  }
  return PRODUCTS_FILE;
}
app.get("/api/products", async (req, res) => {
  if (process.env.DATABASE_URL) {
    try {
      const c = dbClient();
      await c.connect();
      const { rows } = await c.query(
        "SELECT id, name, brand, category, certifications, specs, image FROM products ORDER BY (image IS NULL), category, id"
      );
      await c.end();
      if (rows.length) return res.json({ source: "db", count: rows.length, products: rows });
    } catch (e) {
      console.error("DB products read failed, serving file:", e.message);
    }
  }
  const products = fileProducts();
  res.json({ source: "file", count: products.length, products });
});

// ---- Editable site content (public read; admin-gated write) ----
// `site` is the global settings doc (contact/footer/nav/social) served from the
// in-process cache. The shape generalizes to future keys (home, about, …).
app.get("/api/content/site", async (req, res) => {
  res.set("Cache-Control", "no-cache");
  res.json(await loadSite());
});
app.put("/api/admin/content/site", async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: "Unauthorized" });
  const v = validateSite(req.body || {});
  if (!v.ok) return res.status(400).json({ error: v.error });
  await withDb(res, async (c) => {
    await c.query(
      "INSERT INTO content (key,value,updated_at) VALUES ($1,$2,now()) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=now()",
      ["site", JSON.stringify(v.value)]
    );
    siteCache = v.value; // refresh the cache so the change is live immediately
    res.json({ ok: true, value: v.value });
  });
});

// ---- Admin product management (Bearer ADMIN_PASSWORD; writes go to the DB) ----
async function withDb(res, fn) {
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: "Database not connected." });
  const c = dbClient();
  try { await c.connect(); return await fn(c); }
  catch (e) { console.error("admin db error:", e.message); res.status(500).json({ error: "Database error." }); }
  finally { try { await c.end(); } catch (e) {} }
}
app.get("/api/admin/check", (req, res) => {
  if (!ADMIN_PASSWORD) return res.status(503).json({ error: "Admin not configured." });
  return adminOk(req) ? res.json({ ok: true }) : res.status(401).json({ error: "Unauthorized" });
});
app.post("/api/admin/products", async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: "Unauthorized" });
  const p = req.body || {};
  const name = cleanStr(p.name, 200), category = cleanStr(p.category, 80);
  if (!name || !category) return res.status(400).json({ error: "name and category are required" });
  await withDb(res, async (c) => {
    const { rows } = await c.query(
      "INSERT INTO products (name,brand,category,certifications,specs,image) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
      [name, cleanStr(p.brand, 120), category, cleanStr(p.certifications, 120), cleanStr(p.specs, 600), cleanStr(p.image, 300)]
    );
    res.json({ ok: true, id: rows[0].id });
  });
});
app.put("/api/admin/products/:id", async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: "Unauthorized" });
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "bad id" });
  const p = req.body || {};
  const name = cleanStr(p.name, 200), category = cleanStr(p.category, 80);
  if (!name || !category) return res.status(400).json({ error: "name and category are required" });
  await withDb(res, async (c) => {
    const { rowCount } = await c.query(
      "UPDATE products SET name=$1,brand=$2,category=$3,certifications=$4,specs=$5,image=$6 WHERE id=$7",
      [name, cleanStr(p.brand, 120), category, cleanStr(p.certifications, 120), cleanStr(p.specs, 600), cleanStr(p.image, 300), id]
    );
    res.json({ ok: rowCount > 0 });
  });
});
app.post("/api/admin/upload", express.json({ limit: "7mb" }), async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: "Unauthorized" });
  const v = validateImage(req.body || {}, IMAGE_MIME, 5 * 1024 * 1024);
  if (!v.ok) return res.status(400).json({ error: v.error });
  await withDb(res, async (c) => {
    const stored = await storeImage(c, v.buf, v.mime, null);
    res.json({ ok: true, url: stored.url });
  });
});
app.post("/api/admin/poster-image", express.json({ limit: "7mb" }), async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: "Unauthorized" });
  if (!GEMINI_KEY) return res.status(503).json({ error: "AI image generation isn't configured yet." });
  if (rateLimited(req.ip || "?")) return res.status(429).json({ error: "You're doing that too quickly — give it a moment." });

  const cap = aiImageCap.take(Date.now());
  if (!cap.allowed) {
    const hrs = Math.ceil(cap.resetInMs / 3600000);
    return res.status(429).json({ error: "Daily AI image limit reached (10/day). Resets in " + hrs + "h." });
  }

  const v = validateImage(req.body || {}, IMAGE_MIME, 5 * 1024 * 1024);
  if (!v.ok) return res.status(400).json({ error: v.error });

  const name = cleanStr((req.body || {}).name, 120);
  const brand = cleanStr((req.body || {}).brand, 120);

  let img;
  try {
    img = await cleanupProductImage({
      apiKey: GEMINI_KEY, model: GEMINI_MODEL,
      mime: v.mime, data: req.body.data, name, brand,
    });
  } catch (e) {
    console.error("Gemini image error:", e.message, e.detail || "");
    if (e.message === "gemini_no_image") {
      return res.status(502).json({ error: "The AI couldn't produce an image — try a clearer photo." });
    }
    return res.status(502).json({ error: "The image service is busy — please try again." });
  }

  let buf;
  try { buf = Buffer.from(img.data, "base64"); }
  catch (e) { return res.status(502).json({ error: "The AI returned an unreadable image." }); }

  await withDb(res, async (c) => {
    const stored = await storeImage(c, buf, img.mime || "image/png", "AI: " + (name || "product"));
    res.json({ ok: true, url: stored.url, id: stored.id, remaining: cap.remaining });
  });
});
app.get("/img/:id", async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(404).end();
  const id = imageId(req.params.id);
  const c = dbClient();
  try {
    await c.connect();
    const { rows } = await c.query("SELECT mime, bytes FROM images WHERE id=$1", [id]);
    if (!rows.length) return res.status(404).end();
    if (IMAGE_MIME.indexOf(rows[0].mime) < 0) {
      res.set("Content-Type", "application/octet-stream");
      res.set("Content-Disposition", "attachment");
    } else {
      res.set("Content-Type", rows[0].mime);
    }
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.send(rows[0].bytes);
  } catch (e) { console.error("img serve:", e.message); res.status(500).end(); }
  finally { try { await c.end(); } catch (e) {} }
});
app.get("/api/admin/images", async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: "Unauthorized" });
  await withDb(res, async (c) => {
    const { rows } = await c.query(
      "SELECT id, label, mime, octet_length(bytes) AS size, created_at FROM images ORDER BY created_at DESC, id"
    );
    res.json({ images: rows });
  });
});
app.patch("/api/admin/images/:id", async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: "Unauthorized" });
  const id = imageId(req.params.id);
  if (!id) return res.status(400).json({ error: "bad id" });
  // NOTE (security M3): cleanStr only trims/truncates — `label` is stored as RAW text.
  // Every consumer MUST HTML-escape it before DOM insertion (the admin grid uses esc()).
  const label = cleanStr((req.body || {}).label, 120);
  await withDb(res, async (c) => {
    const { rowCount } = await c.query("UPDATE images SET label=$1 WHERE id=$2", [label, id]);
    res.json({ ok: rowCount > 0 });
  });
});
app.delete("/api/admin/images/:id", async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: "Unauthorized" });
  const id = imageId(req.params.id);
  if (!id) return res.status(400).json({ error: "bad id" });
  await withDb(res, async (c) => {
    const { rowCount } = await c.query("DELETE FROM images WHERE id=$1", [id]);
    res.json({ ok: rowCount > 0 });
  });
});
app.delete("/api/admin/products/:id", async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: "Unauthorized" });
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "bad id" });
  await withDb(res, async (c) => {
    const { rowCount } = await c.query("DELETE FROM products WHERE id=$1", [id]);
    res.json({ ok: rowCount > 0 });
  });
});

// ---- Static site (serves index.html at /, clean .html URLs, no dir listing) ----
app.use(express.static(SITE, { extensions: ["html"] }));
app.use((req, res) => res.status(404).sendFile(path.join(SITE, "index.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Fire Triangle on :${PORT} (model ${MODEL}, key ${KEY ? "set" : "MISSING"})`);
  ensureSchema();
});
