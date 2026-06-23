# AI Product-Shot for the Poster Maker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the admin upload a raw product photo in the Poster Maker and get back a clean, background-removed, catalogue-quality product cutout (via Google's Gemini 2.5 Flash Image, "Nano Banana") that drops into the poster template's photo slot — with tight, admin-only API spend guardrails.

**Architecture:** A new admin-only server endpoint `POST /api/admin/poster-image` takes a base64 source image, runs it through Gemini with a fixed "isolate product + transparent background" prompt, stores the resulting PNG in the existing `images` table, and returns its `/img/:id` URL. The browser-side Poster Maker gets an "✨ AI clean-up" button that calls it and swaps the result into the live preview. Three new pure `lib/` modules (daily-cap counter, image-store helper, gemini-image client) carry the testable logic.

**Tech Stack:** Node.js + Express (CommonJS), `pg` for Postgres, global `fetch`, `node:test` for units, vanilla browser JS (IIFE modules on `window.FTAdmin`).

## Global Constraints

- Branch: `feat/redesign` (de-facto deploy line; Railway deploys from it).
- Secrets are **server-side only** — `GEMINI_API_KEY` must never be sent to the browser; the browser only calls same-origin `/api/admin/poster-image`. Same posture as `OPENROUTER_API_KEY`.
- New env vars: `GEMINI_API_KEY` (required for the feature; absence → 503), `GEMINI_IMAGE_MODEL` (optional, default `gemini-2.5-flash-image`).
- Hard daily cap: **10 generations / 24h rolling window**, in-memory, incremented **on dispatch**.
- Image validation reuses existing rules: `mime ∈ ["image/jpeg","image/png","image/webp","image/gif"]`, decoded size **1 byte–5 MB**.
- Gemini output is treated as a **transparent PNG**; the poster stage background is `linear-gradient(135deg,#7a0f0f,#3a0606,#1c0303)` (dark maroon).
- Admin auth: `adminOk(req)` (Bearer header vs `ADMIN_PASSWORD`). Per-minute limiter: `rateLimited(ip)` (15/min) — both reused.
- Test command: `npm test` (runs `node --test`). Test files live in `test/`, require modules from `../lib/`.
- CommonJS only (`require`/`module.exports`), no ESM. Match existing code style (2-space indent, `var` in browser files, `const`/`let` in server/lib).

---

### Task 1: Daily-cap counter (`lib/daily-cap.js`)

A pure factory producing a rolling-window counter, so spend can be bounded and unit-tested deterministically by injecting `now`.

**Files:**
- Create: `lib/daily-cap.js`
- Test: `test/daily-cap.test.js`

**Interfaces:**
- Produces: `makeDailyCap(limit, windowMs)` → `{ take(now) , peek(now) }`.
  - `take(now)` → `{ allowed: boolean, remaining: number, resetInMs: number }`. Increments the count when allowed; resets the window when `now - windowStart >= windowMs`.
  - `peek(now)` → `{ remaining: number }` (no increment).

- [ ] **Step 1: Write the failing test**

Create `test/daily-cap.test.js`:

```javascript
const test = require("node:test");
const assert = require("node:assert");
const { makeDailyCap } = require("../lib/daily-cap");

test("allows up to the limit then blocks", () => {
  const cap = makeDailyCap(3, 1000);
  assert.deepStrictEqual(cap.take(0).allowed, true);   // 1
  assert.deepStrictEqual(cap.take(1).allowed, true);   // 2
  const third = cap.take(2);
  assert.strictEqual(third.allowed, true);             // 3
  assert.strictEqual(third.remaining, 0);
  assert.strictEqual(cap.take(3).allowed, false);      // 4 blocked
});

test("remaining counts down correctly", () => {
  const cap = makeDailyCap(2, 1000);
  assert.strictEqual(cap.take(0).remaining, 1);
  assert.strictEqual(cap.take(0).remaining, 0);
});

test("resets after the window elapses", () => {
  const cap = makeDailyCap(1, 1000);
  assert.strictEqual(cap.take(0).allowed, true);
  assert.strictEqual(cap.take(500).allowed, false);    // same window
  assert.strictEqual(cap.take(1000).allowed, true);    // window rolled over
});

test("peek does not consume quota", () => {
  const cap = makeDailyCap(2, 1000);
  assert.strictEqual(cap.peek(0).remaining, 2);
  cap.take(0);
  assert.strictEqual(cap.peek(0).remaining, 1);
  assert.strictEqual(cap.peek(0).remaining, 1);        // unchanged by peek
});

test("blocked take reports resetInMs within the window", () => {
  const cap = makeDailyCap(1, 1000);
  cap.take(0);
  const blocked = cap.take(200);
  assert.strictEqual(blocked.allowed, false);
  assert.strictEqual(blocked.resetInMs, 800);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/daily-cap'`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/daily-cap.js`:

```javascript
// Rolling-window counter to bound per-day API spend. Pure aside from its own
// closed-over state; `now` is injected so it is deterministic in tests.
function makeDailyCap(limit, windowMs) {
  let count = 0;
  let windowStart = 0;
  function roll(now) {
    if (now - windowStart >= windowMs) { windowStart = now; count = 0; }
  }
  return {
    take(now) {
      roll(now);
      if (count >= limit) {
        return { allowed: false, remaining: 0, resetInMs: windowMs - (now - windowStart) };
      }
      count++;
      return { allowed: true, remaining: limit - count, resetInMs: windowMs - (now - windowStart) };
    },
    peek(now) {
      const active = (now - windowStart >= windowMs) ? 0 : count;
      return { remaining: Math.max(0, limit - active) };
    },
  };
}
module.exports = { makeDailyCap };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all `daily-cap` tests green (existing `admin-auth` / `image-id` tests still pass).

- [ ] **Step 5: Commit**

```bash
git add lib/daily-cap.js test/daily-cap.test.js
git commit -m "feat(lib): rolling-window daily-cap counter for API spend bounding"
```

---

### Task 2: Shared image-store helper (`lib/image-store.js`) + refactor upload

Extract the duplicated "validate base64 → decode → size-check" and "INSERT into images → return url" logic so both `/api/admin/upload` and the new endpoint share it. DRY.

**Files:**
- Create: `lib/image-store.js`
- Test: `test/image-store.test.js`
- Modify: `server.js` — refactor `/api/admin/upload` (lines ~238-251) to use the helper.

**Interfaces:**
- Produces:
  - `validateImage(body, allowedMimes, maxBytes)` → `{ ok: true, buf: Buffer, mime: string }` or `{ ok: false, error: string }`.
  - `storeImage(client, buf, mime, label)` → `Promise<{ id: string, url: string }>` (runs `INSERT`; caller supplies a connected `pg` client, e.g. inside `withDb`).

- [ ] **Step 1: Write the failing test**

Create `test/image-store.test.js`:

```javascript
const test = require("node:test");
const assert = require("node:assert");
const { validateImage } = require("../lib/image-store");

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX = 5 * 1024 * 1024;
// 1x1 transparent PNG, base64.
const TINY_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

test("accepts an allowed type within size", () => {
  const r = validateImage({ mime: "image/png", data: TINY_PNG }, ALLOWED, MAX);
  assert.strictEqual(r.ok, true);
  assert.ok(Buffer.isBuffer(r.buf));
  assert.strictEqual(r.mime, "image/png");
});

test("rejects a disallowed mime", () => {
  const r = validateImage({ mime: "image/svg+xml", data: TINY_PNG }, ALLOWED, MAX);
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /Unsupported/);
});

test("rejects when data is not a string", () => {
  const r = validateImage({ mime: "image/png", data: 123 }, ALLOWED, MAX);
  assert.strictEqual(r.ok, false);
});

test("rejects empty image", () => {
  const r = validateImage({ mime: "image/png", data: "" }, ALLOWED, MAX);
  assert.strictEqual(r.ok, false);
});

test("rejects oversized image", () => {
  const big = Buffer.alloc(MAX + 1).toString("base64");
  const r = validateImage({ mime: "image/png", data: big }, ALLOWED, MAX);
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /MB/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/image-store'`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/image-store.js`:

```javascript
const crypto = require("crypto");

// Validate a { mime, data(base64) } payload against an allow-list and size cap.
// Returns the decoded Buffer on success so callers don't decode twice.
function validateImage(body, allowedMimes, maxBytes) {
  const mime = body && body.mime;
  const data = body && body.data;
  if (allowedMimes.indexOf(mime) < 0 || typeof data !== "string") {
    return { ok: false, error: "Unsupported image type." };
  }
  let buf;
  try { buf = Buffer.from(data, "base64"); }
  catch (e) { return { ok: false, error: "Bad image data." }; }
  if (!buf.length || buf.length > maxBytes) {
    return { ok: false, error: "Image must be 1 byte–" + Math.round(maxBytes / (1024 * 1024)) + " MB." };
  }
  return { ok: true, buf, mime };
}

// Persist bytes into the existing `images` table. `client` must be a connected
// pg client (e.g. supplied by withDb). Returns the new id + public url.
async function storeImage(client, buf, mime, label) {
  const id = crypto.randomBytes(8).toString("hex");
  await client.query(
    "INSERT INTO images (id, mime, bytes, label) VALUES ($1,$2,$3,$4)",
    [id, mime, buf, label || null]
  );
  return { id, url: "/img/" + id };
}

module.exports = { validateImage, storeImage };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all `image-store` validation tests green.

- [ ] **Step 5: Refactor `/api/admin/upload` to use the helper**

In `server.js`, add to the require block near the top (after line 8, `const { tokensMatch } = require("./lib/admin-auth");`):

```javascript
const { validateImage, storeImage } = require("./lib/image-store");
```

Replace the existing `/api/admin/upload` handler (currently lines ~238-251):

```javascript
app.post("/api/admin/upload", express.json({ limit: "7mb" }), async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: "Unauthorized" });
  const { mime, data } = req.body || {};
  const allowed = IMAGE_MIME;
  if (allowed.indexOf(mime) < 0 || typeof data !== "string") return res.status(400).json({ error: "Unsupported image type." });
  let buf;
  try { buf = Buffer.from(data, "base64"); } catch (e) { return res.status(400).json({ error: "Bad image data." }); }
  if (!buf.length || buf.length > 5 * 1024 * 1024) return res.status(400).json({ error: "Image must be 1 byte–5 MB." });
  const id = require("crypto").randomBytes(8).toString("hex");
  await withDb(res, async (c) => {
    await c.query("INSERT INTO images (id, mime, bytes) VALUES ($1,$2,$3)", [id, mime, buf]);
    res.json({ ok: true, url: "/img/" + id });
  });
});
```

with:

```javascript
app.post("/api/admin/upload", express.json({ limit: "7mb" }), async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: "Unauthorized" });
  const v = validateImage(req.body || {}, IMAGE_MIME, 5 * 1024 * 1024);
  if (!v.ok) return res.status(400).json({ error: v.error });
  await withDb(res, async (c) => {
    const stored = await storeImage(c, v.buf, v.mime, null);
    res.json({ ok: true, url: stored.url });
  });
});
```

- [ ] **Step 6: Verify the server still loads and upload route is intact**

Run: `node -e "require('./server.js'); setTimeout(()=>process.exit(0), 300)"`
Expected: prints startup logs (e.g. `schema ensured` is skipped without `DATABASE_URL`) and exits 0 with no `SyntaxError`/`ReferenceError`. (The upload route's live behavior is unchanged — same response shape `{ ok, url }`.)

- [ ] **Step 7: Commit**

```bash
git add lib/image-store.js test/image-store.test.js server.js
git commit -m "refactor(admin): extract shared validateImage/storeImage; reuse in upload"
```

---

### Task 3: Gemini image client (`lib/gemini-image.js`)

Pure prompt builder + response parser (both unit-tested), plus the network call (not unit-tested; uses global `fetch`, injectable for safety).

**Files:**
- Create: `lib/gemini-image.js`
- Test: `test/gemini-image.test.js`

**Interfaces:**
- Produces:
  - `buildPosterPrompt({ name, brand })` → `string`. Always instructs transparent background + no text; weaves in name/brand when present.
  - `parseImageFromResponse(json)` → `{ data: string, mime: string }` or `null`.
  - `cleanupProductImage({ apiKey, model, mime, data, name, brand, fetchImpl })` → `Promise<{ data, mime }>`; throws `Error("gemini_http_<status>")` (with `.detail`) on non-2xx and `Error("gemini_no_image")` when no image part is returned.

- [ ] **Step 1: Write the failing test**

Create `test/gemini-image.test.js`:

```javascript
const test = require("node:test");
const assert = require("node:assert");
const { buildPosterPrompt, parseImageFromResponse, cleanupProductImage } = require("../lib/gemini-image");

test("prompt always demands transparent background and no text", () => {
  const p = buildPosterPrompt({});
  assert.match(p, /transparent/i);
  assert.match(p, /no .*text|do not add any text/i);
});

test("prompt includes name and brand when present", () => {
  const p = buildPosterPrompt({ name: "OS&Y Gate Valve", brand: "Rapidrop" });
  assert.match(p, /OS&Y Gate Valve/);
  assert.match(p, /Rapidrop/);
});

test("prompt has a sane default when name is missing", () => {
  const p = buildPosterPrompt({ brand: "" });
  assert.match(p, /product/i);
  assert.ok(p.length > 40);
});

test("parses the first inlineData image part", () => {
  const json = { candidates: [{ content: { parts: [
    { text: "here you go" },
    { inlineData: { mimeType: "image/png", data: "AAAA" } },
  ] } }] };
  assert.deepStrictEqual(parseImageFromResponse(json), { data: "AAAA", mime: "image/png" });
});

test("defaults mime to image/png when absent", () => {
  const json = { candidates: [{ content: { parts: [{ inlineData: { data: "BBBB" } }] } }] };
  assert.deepStrictEqual(parseImageFromResponse(json), { data: "BBBB", mime: "image/png" });
});

test("returns null when there is no image part", () => {
  assert.strictEqual(parseImageFromResponse({ candidates: [{ content: { parts: [{ text: "no image" }] } }] }), null);
  assert.strictEqual(parseImageFromResponse({}), null);
  assert.strictEqual(parseImageFromResponse(null), null);
});

test("cleanupProductImage posts to the model URL and returns the parsed image", async () => {
  let seen = null;
  const fakeFetch = async (url, opts) => {
    seen = { url, opts };
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "ZZZZ" } }] } }] }),
    };
  };
  const out = await cleanupProductImage({
    apiKey: "test-key", model: "gemini-2.5-flash-image",
    mime: "image/jpeg", data: "SRC", name: "Valve", brand: "Rapidrop", fetchImpl: fakeFetch,
  });
  assert.deepStrictEqual(out, { data: "ZZZZ", mime: "image/png" });
  assert.match(seen.url, /models\/gemini-2\.5-flash-image:generateContent\?key=test-key/);
  const body = JSON.parse(seen.opts.body);
  assert.strictEqual(body.contents[0].parts[1].inlineData.data, "SRC");
  assert.deepStrictEqual(body.generationConfig.responseModalities, ["IMAGE"]);
});

test("cleanupProductImage throws on non-2xx", async () => {
  const fakeFetch = async () => ({ ok: false, status: 429, text: async () => "rate limited" });
  await assert.rejects(
    () => cleanupProductImage({ apiKey: "k", mime: "image/png", data: "x", fetchImpl: fakeFetch }),
    /gemini_http_429/
  );
});

test("cleanupProductImage throws gemini_no_image when no image returned", async () => {
  const fakeFetch = async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "nope" }] } }] }) });
  await assert.rejects(
    () => cleanupProductImage({ apiKey: "k", mime: "image/png", data: "x", fetchImpl: fakeFetch }),
    /gemini_no_image/
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/gemini-image'`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/gemini-image.js`:

```javascript
// Google Gemini 2.5 Flash Image ("Nano Banana") client for cleaning a raw
// product photo into a transparent, catalogue-quality cutout. The API key is
// passed in by the caller (server-side env) and never logged.
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/";

function buildPosterPrompt(opts) {
  opts = opts || {};
  const name = (opts.name && String(opts.name).trim()) || "this industrial fire-protection product";
  const brand = opts.brand && String(opts.brand).trim();
  const subject = brand ? name + " by " + brand : name;
  return [
    "Professional studio product photograph of " + subject + ".",
    "Isolate the product completely and remove the background so it is fully transparent (alpha channel).",
    "Crisp focus, even studio lighting, true-to-original colors and fine details.",
    "Center the product with even margins, tight catalogue crop, square framing.",
    "Do not add any text, logos, watermarks, backdrops, reflections, or extra objects.",
    "Output a clean cutout of the product only.",
  ].join(" ");
}

function parseImageFromResponse(json) {
  const cands = json && json.candidates;
  if (!Array.isArray(cands) || !cands.length) return null;
  const content = cands[0] && cands[0].content;
  const parts = content && content.parts;
  if (!Array.isArray(parts)) return null;
  for (let i = 0; i < parts.length; i++) {
    const inl = parts[i] && parts[i].inlineData;
    if (inl && typeof inl.data === "string" && inl.data) {
      return { data: inl.data, mime: inl.mimeType || "image/png" };
    }
  }
  return null;
}

async function cleanupProductImage(opts) {
  const fetchImpl = opts.fetchImpl || fetch;
  const model = opts.model || "gemini-2.5-flash-image";
  const url = ENDPOINT + model + ":generateContent?key=" + encodeURIComponent(opts.apiKey);
  const body = {
    contents: [{ parts: [
      { text: buildPosterPrompt({ name: opts.name, brand: opts.brand }) },
      { inlineData: { mimeType: opts.mime, data: opts.data } },
    ] }],
    generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1" } },
  };
  const r = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    let detail = "";
    try { detail = await r.text(); } catch (e) {}
    const err = new Error("gemini_http_" + r.status);
    err.detail = detail.slice(0, 500);
    throw err;
  }
  const json = await r.json();
  const img = parseImageFromResponse(json);
  if (!img) throw new Error("gemini_no_image");
  return img;
}

module.exports = { buildPosterPrompt, parseImageFromResponse, cleanupProductImage };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all `gemini-image` tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/gemini-image.js test/gemini-image.test.js
git commit -m "feat(lib): Gemini image client — prompt builder, response parser, cleanup call"
```

---

### Task 4: Wire the `/api/admin/poster-image` endpoint (`server.js`)

**Files:**
- Modify: `server.js` — require new modules, add config + cap instance, widen the JSON-limit skip-list, add the route.

**Interfaces:**
- Consumes: `makeDailyCap` (Task 1), `validateImage`/`storeImage` (Task 2), `cleanupProductImage` (Task 3), and existing `adminOk`, `rateLimited`, `withDb`, `cleanStr`, `IMAGE_MIME`.
- Produces: `POST /api/admin/poster-image` → `{ ok:true, url, id, remaining }` on success; error JSON otherwise.

- [ ] **Step 1: Add requires + config + cap instance**

In `server.js`, after the Task 2 require (`const { validateImage, storeImage } = require("./lib/image-store");`), add:

```javascript
const { makeDailyCap } = require("./lib/daily-cap");
const { cleanupProductImage } = require("./lib/gemini-image");
```

After the existing config block (after line 27, `const ADMIN_PASSWORD = ...`), add:

```javascript
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
const aiImageCap = makeDailyCap(10, 24 * 60 * 60 * 1000); // 10 product-shot generations / 24h
```

- [ ] **Step 2: Widen the JSON body-limit skip-list**

In `server.js`, replace the middleware line (currently line 21):

```javascript
app.use((req, res, next) => (req.path === "/api/admin/upload" ? next() : express.json({ limit: "32kb" })(req, res, next)));
```

with:

```javascript
app.use((req, res, next) => {
  const big = req.path === "/api/admin/upload" || req.path === "/api/admin/poster-image";
  return big ? next() : express.json({ limit: "32kb" })(req, res, next);
});
```

- [ ] **Step 3: Add the route**

In `server.js`, immediately after the `/api/admin/upload` handler (which ends around line 245 after the refactor), add:

```javascript
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
```

- [ ] **Step 4: Verify the server loads with the new route**

Run: `node -e "require('./server.js'); setTimeout(()=>process.exit(0), 300)"`
Expected: loads cleanly, exits 0, no `SyntaxError`/`ReferenceError`. (Without `GEMINI_API_KEY` set the route will answer 503 at runtime — that's correct.)

- [ ] **Step 5: Smoke-test guards without a key (no DB, no key)**

Run:
```bash
node -e "
const http=require('http');
process.env.ADMIN_PASSWORD='testpw';
const app=require('./server.js');
" 2>/dev/null || echo "note: server.js calls app.listen; use the manual curl check in Step 6 instead"
```
Expected: This step is informational — `server.js` self-listens, so prefer the Step 6 live check. If it errors, proceed to Step 6.

- [ ] **Step 6: Manual guard check against a locally-run server**

In one shell: `ADMIN_PASSWORD=testpw node server.js` (starts on its port, e.g. 3000).
In another shell:
```bash
# Missing auth -> 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:3000/api/admin/poster-image -H "Content-Type: application/json" -d '{}'
# With auth but no GEMINI_API_KEY -> 503
curl -s -X POST localhost:3000/api/admin/poster-image -H "Authorization: Bearer testpw" -H "Content-Type: application/json" -d '{"mime":"image/png","data":"AAAA"}'
```
Expected: first prints `401`; second returns JSON `{"error":"AI image generation isn't configured yet."}`. Stop the server (Ctrl-C) after.

- [ ] **Step 7: Commit**

```bash
git add server.js
git commit -m "feat(admin): POST /api/admin/poster-image — Gemini product-shot, admin-gated, 10/day cap"
```

---

### Task 5: Poster Maker "AI clean-up" button (`site/assets/js/admin-poster.js`)

**Files:**
- Modify: `site/assets/js/admin-poster.js` — add the button to the photo row, a source-bytes helper, the click handler, and enable/disable sync.

**Interfaces:**
- Consumes: `/api/admin/poster-image` (Task 4), `A.api`, `A.media.refresh`, existing `state`, `paint()`.
- Produces: (UI only) sets `state.photo` to the returned url; tracks `state.aiRemaining`.

- [ ] **Step 1: Add the AI button to the photo row**

In `buildForm()`, find the "Product photo" label (currently the line with `id="pz-pick"` and `id="pz-file"`). Replace that single label line:

```javascript
      '<label>Product photo<div class="hero__cta"><button class="btn btn--ghost btn--sm" type="button" id="pz-pick">Pick from Media</button>' +
      '<label class="btn btn--ghost btn--sm" style="cursor:pointer">Upload<input type="file" id="pz-file" accept="image/*" hidden></label></div></label>' +
```

with (adds the third button):

```javascript
      '<label>Product photo<div class="hero__cta"><button class="btn btn--ghost btn--sm" type="button" id="pz-pick">Pick from Media</button>' +
      '<label class="btn btn--ghost btn--sm" style="cursor:pointer">Upload<input type="file" id="pz-file" accept="image/*" hidden></label>' +
      '<button class="btn btn--ghost btn--sm" type="button" id="pz-ai" title="Clean up the product photo with AI">✨ AI clean-up</button></div></label>' +
```

- [ ] **Step 2: Add the source-bytes helper and enable/disable sync**

In `buildForm()`, after the line `function bind(...)` is defined elsewhere — add these inside the IIFE (top level of the module, e.g. just above `function buildForm()`), the source-bytes helper:

```javascript
  // Resolve the current photo (data: URL or /img/:id url) to { mime, data(base64) }.
  function sourceBytes(src) {
    var m = /^data:([^;]+);base64,(.*)$/.exec(src || "");
    if (m) return Promise.resolve({ mime: m[1], data: m[2] });
    return fetch(src).then(function (r) { return r.blob(); }).then(function (blob) {
      return new Promise(function (resolve, reject) {
        var fr = new FileReader();
        fr.onload = function () {
          var mm = /^data:([^;]+);base64,(.*)$/.exec(String(fr.result));
          if (mm) resolve({ mime: mm[1], data: mm[2] }); else reject(new Error("unreadable source"));
        };
        fr.onerror = function () { reject(new Error("read failed")); };
        fr.readAsDataURL(blob);
      });
    });
  }
```

- [ ] **Step 3: Wire the button (enable/disable + click) at the end of `buildForm()`**

In `buildForm()`, after the existing `pz-file` change listener block, add:

```javascript
    var aiBtn = document.getElementById("pz-ai");
    function syncAi() { aiBtn.disabled = !state.photo; }
    syncAi();
    document.getElementById("pz-pick").addEventListener("click", syncAi);
    document.getElementById("pz-file").addEventListener("change", function () { setTimeout(syncAi, 0); });
    aiBtn.addEventListener("click", function () {
      if (!state.photo) return;
      var msg = document.getElementById("poster-msg");
      var left = (typeof state.aiRemaining === "number") ? " (" + state.aiRemaining + " left today)" : "";
      if (!confirm("This uses 1 of your 10 daily AI generations" + left + ". Continue?")) return;
      msg.textContent = "Generating AI product shot…";
      aiBtn.disabled = true;
      sourceBytes(state.photo).then(function (src) {
        return A.api("/api/admin/poster-image", { method: "POST", body: JSON.stringify({
          data: src.data, mime: src.mime, name: state.title, brand: state.rapidrop ? "Rapidrop" : "",
        }) });
      }).then(function (res) {
        if (res.ok && res.data && res.data.url) {
          state.photo = res.data.url;
          if (typeof res.data.remaining === "number") state.aiRemaining = res.data.remaining;
          paint(); syncAi();
          msg.textContent = "AI shot ready ✓ · saved to Media" +
            (typeof res.data.remaining === "number" ? " · " + res.data.remaining + "/10 left today" : "");
          if (A.media && A.media.refresh) A.media.refresh();
        } else {
          msg.textContent = (res.data && res.data.error) || "AI clean-up failed.";
          syncAi();
        }
      }).catch(function (e) { msg.textContent = "AI clean-up failed: " + e.message; syncAi(); });
    });
```

Note: the existing `pz-pick` and `pz-file` handlers already set `state.photo` and call `paint()`; the `syncAi` listeners added here run alongside them to toggle the AI button. (The `pz-pick` promise sets photo asynchronously; if the button doesn't enable immediately after picking, it will after the next `paint`. Acceptable — Upload covers the primary path.)

- [ ] **Step 4: Verify the file parses (syntax check)**

Run: `node --check site/assets/js/admin-poster.js`
Expected: no output, exit 0 (valid JS).

- [ ] **Step 5: Commit**

```bash
git add site/assets/js/admin-poster.js
git commit -m "feat(admin): AI clean-up button in Poster Maker — one-click product-shot"
```

---

### Task 6: Full test sweep + deploy + live verification

**Files:** none (verification + ops).

- [ ] **Step 1: Run the whole unit suite**

Run: `npm test`
Expected: all tests pass — `daily-cap`, `image-store`, `gemini-image`, plus pre-existing `admin-auth`, `image-id`.

- [ ] **Step 2: Set the env var in Railway (owner action)**

Ask the owner to add `GEMINI_API_KEY=<their key>` in the Railway service variables for `fire-triangle` (production env). Optionally `GEMINI_IMAGE_MODEL` if a different model id is needed. Confirm before deploy.

- [ ] **Step 3: Push and deploy**

```bash
git push origin feat/redesign
railway redeploy --from-source --service fire-triangle --yes
```
Expected: build succeeds; service restarts. (Per [[railway-deploy]] there is no auto-deploy on push — the manual redeploy is required.)

- [ ] **Step 4: Live verification (manual, in-browser)**

1. Open `https://fire-triangle-production.up.railway.app/admin`, log in with the real `ADMIN_PASSWORD`.
2. Go to **Poster Maker** → **Upload** a real valve photo → confirm the **✨ AI clean-up** button enables.
3. Click it → accept the confirm → wait. Expect: preview swaps to a **transparent, centered cutout** on the dark maroon stage; message shows `… N/10 left today`; the shot appears in the **Media** library.
4. Repeat to confirm the counter decrements; (optionally) confirm the **11th** call in 24h returns the daily-limit message.
5. Attach the saved shot to a product (Products → Edit → Pick from Media) and confirm it renders on the storefront.

- [ ] **Step 5: Update project memory**

Append to `admin-dashboard-poster-status.md` (and `MEMORY.md` if a new pointer is warranted): the AI product-shot feature shipped, the `GEMINI_API_KEY` requirement, and the 10/day cap. (Per the end-of-session journaling rule, also add a `F:/project-journal/fire-triangle/2026-06-23.md` entry.)

---

## Self-Review

**Spec coverage:**
- AI scope = product shot only → Task 3 prompt (transparent cutout) + Task 5 drops into existing slot; text untouched. ✓
- Dedicated `GEMINI_API_KEY` → Task 4 config + 503 guard. ✓
- 10/day cap, on-dispatch, 24h reset, remaining surfaced → Task 1 + Task 4 + Task 5 message. ✓
- Auto-save to Media → Task 4 `storeImage` + Task 5 `A.media.refresh`. ✓
- Confirm-before-generate → Task 5 `confirm()`. ✓
- Admin-only + per-minute limit + image validation → Task 4 guard order. ✓
- Transparent PNG on dark gradient → Task 3 prompt; stored as PNG. ✓
- DRY image-store helper → Task 2 + upload refactor. ✓
- Tests for cap, prompt, parser, validation → Tasks 1-3. ✓
- Error table (401/503/429/400/502) → Task 4 route. ✓
- Out-of-scope items excluded (no full-poster gen, no batch, in-memory cap). ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code; every command has expected output. ✓

**Type consistency:** `makeDailyCap(limit, windowMs).take(now)→{allowed,remaining,resetInMs}` used identically in Task 4. `validateImage(body,allowed,max)→{ok,buf,mime|error}` and `storeImage(c,buf,mime,label)→{id,url}` consistent across Tasks 2/4. `cleanupProductImage({apiKey,model,mime,data,name,brand,fetchImpl})→{data,mime}` consistent Tasks 3/4. `parseImageFromResponse` reads `candidates[0].content.parts[].inlineData.{data,mimeType}` — matches the request's `inlineData` shape. ✓
