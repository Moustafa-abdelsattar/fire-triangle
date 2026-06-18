// Fire Triangle — static site + secure AI assistant proxy.
// The OpenRouter key NEVER reaches the browser: it lives in process.env and is
// only used server-side here. The browser talks to /api/chat on this origin.
const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

const SITE = path.join(__dirname, "site");
const MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
const KEY = process.env.OPENROUTER_API_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

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

// Constant-time-ish compare for the admin bearer token.
function adminOk(req) {
  if (!ADMIN_PASSWORD) return false;
  const t = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (t.length !== ADMIN_PASSWORD.length) return false;
  let diff = 0;
  for (let i = 0; i < t.length; i++) diff |= t.charCodeAt(i) ^ ADMIN_PASSWORD.charCodeAt(i);
  return diff === 0;
}
function cleanStr(v, max) { var s = v == null ? null : String(v).trim(); if (s === "") s = null; return s == null ? null : s.slice(0, max || 400); }

// ---- Assistant persona + knowledge base (kept current with the site) ----
const SYSTEM_PROMPT = `You are the Fire Triangle Assistant, a friendly AI guide for Fire Triangle — a fire-protection company in Egypt. You live on firetriangle.net and help visitors understand the company, its products and services, and how to get in touch.

PERSONA & STYLE
- Warm, confident, concise. Default to 2–4 short sentences; use a tight bullet list only when listing products/options.
- You may answer in the visitor's language (English or Arabic).
- You represent Fire Triangle ("we"/"our"). Be helpful and sales-aware: when someone has a real need, guide them to request a quote or contact an engineer.
- NEVER invent prices, exact specs, model numbers, datasheet figures, certifications, or project names that aren't in your knowledge below. If asked for specifics you don't have, say so and point them to sales@firetriangle.net or the Request-a-Quote page.
- Only discuss Fire Triangle and fire protection. Politely decline unrelated topics and steer back.

COMPANY
- Fire Triangle, established early 2013; one of the largest specialized companies in the fire fighting & fire alarm field in Egypt. Authorized distributor for several international manufacturers since 2016.
- Works to NFPA standards and the Egyptian Codes. 13+ years' experience, 487+ projects delivered, 50+ staff (51–200 on LinkedIn).
- Mission: provide safety & protection for persons & properties by providing the highest quality fire alarm & fire fighting systems.
- Vision: fulfil our commitment to clients with the highest quality at the most cost efficiency, per NFPA standards & the Egyptian Codes.

SERVICES (three)
- Trading: supply a wide range of fire alarm, water, gas and foam systems as agent for reputed global brands.
- Contracting: implement all types of fire fighting & fire alarm systems (pumps, sprinklers, fire hose cabinets, gas, foam, conventional & addressable alarm) with NFPA-trained engineers and technicians.
- Maintenance: maintain all systems and supply spare parts under maintenance contracts, for all brands & systems.

PRODUCTS
- Fire alarm (addressable & conventional): sole agent for Velocity and for Advanced (newly introduced to Egypt — Axis AX control panels & LCD annunciators); Apollo (XP95A smoke/heat/multicriteria detectors), Simplex, Notifier; dual-action pull stations, sounder beacons, alarm bells (GB24-6). Partner of FFE UK for special detection — Fireray beam detector, Talentum flame detector, Proreact linear heat detection.
- Water systems: Rapidrop UK (UL/FM) — concealed/pendent/upright/sidewall sprinklers; zone control valves & trim (water flow switch, tamper switch, swing check valve, OS&Y gate valve, test & drain); grooved fittings (rigid couplings, mechanical & equal tees, 45°/90° elbows, concentric reducers, adaptor flanges); wet/dry/underground hydrants & foam-monitor hydrants; bladder tanks; fire hose reels, cabinets, hoses & nozzles. Waterfall (UL/FM) pumps — end-suction, horizontal split-case, turbine, jockey (300–5000 GPM) & pump sets, plus GVI/Clebasvision flow meters. CLA-VAL automatic control valves — pressure-reducing, relief, air-release, deluge, casing-relief, modulating-float.
- Gas systems: FM-200 & CO₂ clean-agent (Tyco, Ceodeux, Ansul); Aerosol (FirePro, Mobiak); Fire extinguishers (Bavaria, Mobiak).
- Foam systems for flammable-liquid / high-hazard risks.
- Mobiak: gas and wet-chemical suppression — ball/angle/pressure-restricting valves, breeching inlets, aerosol, hood kitchen suppression. UL listed, FM approved, and LPCB & VDS certified.
- Jianzhi: threaded malleable-iron pipe fittings for fire fighting pipework.

PROJECTS
- 487+ delivered across commercial, industrial and residential sectors. Named projects include: Cairo Airport Aircraft Hangar (24" Rapidrop OS&Y valve, via Triple A for Trading); DP World UAE (Waterfall horizontal split-case pump, via EDECS); GLC Paints (Waterfall pump system, delivered & inspected on-site); GÜLSAN Egypt Nonwoven Industries (Rapidrop 396-gallon bladder tank, UL listed); Dakahlia Agricultural Development (Waterfall split-case, 1500 GPM @ 9 bar); Souq El Habashi, Minya (Waterfall split-case, 1000 GPM @ 10 bar). A latest-projects PDF is available, and visitors can request references for their sector via Contact.
- Fire Triangle is a Diamond Sponsor of Egypt Energy – Firex 2026, and has exhibited at Firex since 2021.

CAREERS
- No open positions right now. Candidates can send a CV via the Careers page; tagline "Are you passionate? Do you enjoy the work?".

CONTACT
- Head Office: 737 El-Gaish St., Mandara, Alexandria, Egypt. Branch: 49 El-Shaikh Ali Abd El-Razik St, Heliopolis, Cairo.
- Tel: +20 3 5550609 / +20 3 5527726. Mobile: +20 1068 990 088. Email: sales@firetriangle.net. WhatsApp available from the site.
- Site pages: Home, About, Products, Services, Projects, Careers, Contact.

When a visitor wants a quote, a site survey, a BOQ priced, or product availability: encourage them to use the Request-a-Quote form on the Contact page or email sales@firetriangle.net, and mention an engineer typically replies within one business day.`;

// ---- Simple in-memory rate limiter (protects the OpenRouter credits) ----
const HITS = new Map(); // ip -> [timestamps]
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 15;
function rateLimited(ip) {
  const now = Date.now();
  const arr = (HITS.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  HITS.set(ip, arr);
  if (HITS.size > 5000) HITS.clear(); // crude memory guard
  return arr.length > MAX_PER_WINDOW;
}

app.post("/api/chat", async (req, res) => {
  if (!KEY) return res.status(503).json({ error: "The assistant isn't configured yet." });

  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "?").toString().split(",")[0].trim();
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
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
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
app.listen(PORT, () => console.log(`Fire Triangle on :${PORT} (model ${MODEL}, key ${KEY ? "set" : "MISSING"})`));
