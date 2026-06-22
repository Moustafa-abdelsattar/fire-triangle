# Admin Dashboard Overhaul + Poster Maker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the single-page product admin into a sidebar dashboard that manages Products + a Media library, and add a secondary in-browser Poster Maker that turns a product photo + details into a branded marketing card.

**Architecture:** One `admin.html` SPA with a left sidebar; sections swap in place. `admin.js` is split into `admin-core.js` (auth, nav, shared helpers, caches) + `admin-products.js` + `admin-media.js` + `admin-poster.js`. The Express server gains a `label` column on `images` and three admin-only image endpoints; poster rendering is fully client-side via a vendored `html2canvas`.

**Tech Stack:** Node 25 + Express 4 + `pg` (Postgres), vanilla ES5-style browser JS (no build step), `node:test` for server-side unit tests, vendored `html2canvas` for PNG export.

## Global Constraints

- No build step / no framework. Browser JS stays vanilla, IIFE, ES5-compatible style matching existing `admin.js`. (spec: Non-goals)
- No new server runtime dependencies. Only `express` + `pg`. Tests use built-in `node:test`. (spec: Non-goals)
- All admin endpoints guarded by `adminOk` (Bearer `ADMIN_PASSWORD`, constant-time compare). (spec: Current state)
- Image ids are lowercase hex, max 32 chars. Validate everywhere with `/[^a-f0-9]/g` strip + `.slice(0,32)`. (spec: Section B)
- Uploads remain jpeg/png/webp/gif, 1 B–5 MB, via existing `POST /api/admin/upload`. (spec: Error handling)
- Palette: `--molten:#DD3333`, `--molten-600:#B81F1F`, `--ash:#2B2A26`, `--white:#FFFFFF`. (spec: Current state)
- Poster design box is exactly 1080×1080 px. (spec: Section C)
- Front-end work is verified in a real browser (Playwright) + `curl`, not unit tests — there is no DOM test harness and the no-build constraint forbids adding one. Only server-side pure logic gets `node:test` units.

---

## File Structure

- `server.js` — modify: add `label` column bootstrap + `GET/PATCH/DELETE /api/admin/images`; extract `imageId()` helper. Export helpers for tests.
- `lib/image-id.js` — create: pure `imageId(raw)` helper, `require`-able by both `server.js` and tests.
- `test/image-id.test.js` — create: `node:test` unit tests for `imageId`.
- `site/admin.html` — modify: rework into sidebar dashboard shell with three `<section>` panels.
- `site/assets/js/admin-core.js` — create: auth gate, sidebar routing, shared helpers (`esc`, `authHeaders`, `api`, caches, toast).
- `site/assets/js/admin-products.js` — create: product list/search/filter + add/edit/delete (migrated from `admin.js`).
- `site/assets/js/admin-media.js` — create: media grid, upload, rename, delete, delete-guard, pickers.
- `site/assets/js/admin-poster.js` — create: template, field form, live preview, PNG export + save-to-media.
- `site/assets/js/admin.js` — delete after migration.
- `site/assets/js/vendor/html2canvas.min.js` — create: vendored library.
- `site/assets/css/styles.css` — modify: append admin dashboard + poster styles (scoped under `[data-page="admin"]`).
- `package.json` — modify: add `"test": "node --test"` script.

---

## Phase 1 — Dashboard shell + Products polish

### Task 1: Dashboard shell (sidebar + section routing + module split)

**Files:**
- Modify: `site/admin.html`
- Create: `site/assets/js/admin-core.js`
- Create: `site/assets/js/admin-products.js`
- Delete: `site/assets/js/admin.js` (after migration)
- Modify: `site/assets/css/styles.css` (append)
- Modify: `package.json` (add test script — used later)

**Interfaces:**
- Produces (global `window.FTAdmin` namespace from `admin-core.js`):
  - `FTAdmin.esc(s) -> string` — HTML-escape.
  - `FTAdmin.pw() -> string` — current admin password from sessionStorage.
  - `FTAdmin.authHeaders() -> {{"Content-Type","Authorization"}}`.
  - `FTAdmin.api(path, opts) -> Promise<{ok:boolean, status:number, data:any}>` — fetch wrapper that attaches auth headers, parses JSON, and triggers logout on 401.
  - `FTAdmin.onSection(name, initFn)` — register a one-time init callback fired when section `name` ("products"|"media"|"poster") first activates.
  - `FTAdmin.toast(msg)` — transient status message.
  - `FTAdmin.products()` / `FTAdmin.setProducts(arr)` — cached product list accessor.
- Consumes: existing `/api/admin/check`, `/api/products`, `/api/admin/products`.

- [ ] **Step 1: Add the `test` script to package.json**

In `package.json`, change the `scripts` block to:

```json
  "scripts": {
    "start": "node server.js",
    "test": "node --test"
  },
```

- [ ] **Step 2: Rewrite `site/admin.html` as the dashboard shell**

Replace the whole file with:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Admin — Fire Triangle</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/styles.css">
</head>
<body data-page="admin">
  <!-- Login gate -->
  <section id="admin-login" class="admin__login" hidden>
    <div class="container">
      <span class="kicker">Admin</span>
      <h1>Sign in</h1>
      <p class="hero__lede">Enter the admin password to manage the site.</p>
      <form class="form" id="login-form" style="max-width:380px">
        <label>Admin password<input type="password" id="admin-pw" autocomplete="current-password" required></label>
        <button class="btn btn--primary" type="submit">Sign in</button>
        <p class="form__note" id="login-msg"></p>
      </form>
    </div>
  </section>

  <!-- Dashboard -->
  <div id="admin-dash" class="dash" hidden>
    <aside class="dash__nav">
      <div class="dash__brand"><img src="assets/img/logo.png" alt="Fire Triangle" height="36"></div>
      <nav>
        <button class="dash__link is-active" data-section="products" type="button">Products</button>
        <button class="dash__link" data-section="media" type="button">Media</button>
        <button class="dash__link" data-section="poster" type="button">Poster Maker</button>
      </nav>
      <button class="btn btn--ghost btn--sm" id="logout-btn" type="button">Sign out</button>
    </aside>
    <main class="dash__main">
      <section class="dash__panel is-active" data-panel="products" id="panel-products"></section>
      <section class="dash__panel" data-panel="media" id="panel-media"></section>
      <section class="dash__panel" data-panel="poster" id="panel-poster"></section>
      <p id="dash-toast" class="dash__toast" hidden></p>
    </main>
  </div>

  <script src="assets/js/admin-core.js" defer></script>
  <script src="assets/js/admin-products.js" defer></script>
  <script src="assets/js/admin-media.js" defer></script>
  <script src="assets/js/admin-poster.js" defer></script>
</body>
</html>
```

- [ ] **Step 3: Create `site/assets/js/admin-core.js`**

```js
// Admin core: auth gate, sidebar routing, shared helpers + caches.
window.FTAdmin = (function () {
  "use strict";
  var KEY = "ft_admin_pw";
  var sectionInits = {}, sectionDone = {}, _products = null;
  var login = document.getElementById("admin-login");
  var dash = document.getElementById("admin-dash");

  function esc(s) {
    return (s == null ? "" : String(s)).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pw() { return sessionStorage.getItem(KEY) || ""; }
  function authHeaders() { return { "Content-Type": "application/json", "Authorization": "Bearer " + pw() }; }

  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({}, authHeaders(), opts.headers || {});
    return fetch(path, opts).then(function (r) {
      if (r.status === 401) { sessionStorage.removeItem(KEY); showLogin(); }
      return r.json().catch(function () { return {}; }).then(function (data) {
        return { ok: r.ok, status: r.status, data: data };
      });
    });
  }

  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById("dash-toast");
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2600);
  }

  function onSection(name, fn) { sectionInits[name] = fn; }
  function activate(name) {
    var links = document.querySelectorAll(".dash__link");
    var panels = document.querySelectorAll(".dash__panel");
    for (var i = 0; i < links.length; i++) links[i].classList.toggle("is-active", links[i].getAttribute("data-section") === name);
    for (var j = 0; j < panels.length; j++) panels[j].classList.toggle("is-active", panels[j].getAttribute("data-panel") === name);
    if (!sectionDone[name] && sectionInits[name]) { sectionDone[name] = true; sectionInits[name](); }
  }

  function showLogin() { login.hidden = false; dash.hidden = true; }
  function showDash() { login.hidden = true; dash.hidden = false; activate("products"); }

  function products() { return _products; }
  function setProducts(arr) { _products = arr; }

  // wiring
  document.getElementById("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    sessionStorage.setItem(KEY, document.getElementById("admin-pw").value);
    fetch("/api/admin/check", { headers: authHeaders() }).then(function (r) {
      if (r.ok) { document.getElementById("login-msg").textContent = ""; showDash(); }
      else { sessionStorage.removeItem(KEY); document.getElementById("login-msg").textContent = "Wrong password."; }
    }).catch(function () { document.getElementById("login-msg").textContent = "Network error."; });
  });
  document.getElementById("logout-btn").addEventListener("click", function () { sessionStorage.removeItem(KEY); showLogin(); });
  document.querySelector(".dash__nav nav").addEventListener("click", function (e) {
    var b = e.target.closest(".dash__link"); if (b) activate(b.getAttribute("data-section"));
  });

  // boot
  if (pw()) {
    fetch("/api/admin/check", { headers: authHeaders() }).then(function (r) {
      if (r.ok) showDash(); else { sessionStorage.removeItem(KEY); showLogin(); }
    }).catch(showLogin);
  } else { showLogin(); }

  return { esc: esc, pw: pw, authHeaders: authHeaders, api: api, toast: toast,
           onSection: onSection, products: products, setProducts: setProducts };
})();
```

- [ ] **Step 4: Create `site/assets/js/admin-products.js` (migrate CRUD from `admin.js`)**

```js
// Products section: list + add/edit/delete against /api/admin/products.
(function () {
  "use strict";
  var A = window.FTAdmin, esc = A.esc;
  var editing = null;

  function render() {
    document.getElementById("panel-products").innerHTML =
      '<h2>Products</h2>' +
      '<div class="admin__bar"><span id="admin-count" class="prod__brand"></span></div>' +
      '<h3 id="form-title" style="margin-top:24px">Add a product</h3>' +
      '<form class="form admin__form" id="product-form">' +
      '<input type="hidden" id="p-id">' +
      '<div class="grid grid--2">' +
      '<label>Name *<input id="p-name" required maxlength="200"></label>' +
      '<label>Brand<input id="p-brand" maxlength="120"></label>' +
      '<label>Category *<input id="p-category" list="cat-list" required maxlength="80"><datalist id="cat-list"></datalist></label>' +
      '<label>Certifications<input id="p-cert" maxlength="120" placeholder="e.g. UL/FM"></label>' +
      '</div>' +
      '<label>Specs / variations<input id="p-specs" maxlength="600"></label>' +
      '<label>Upload image (jpg/png/webp, max 5 MB)<input type="file" id="p-file" accept="image/*"></label>' +
      '<label>Image path or URL<input id="p-image" maxlength="300" placeholder="/assets/img/products/example.jpg"></label>' +
      '<div class="hero__cta"><button class="btn btn--primary" type="submit" id="save-btn">Add product</button>' +
      '<button class="btn btn--ghost" type="button" id="cancel-btn" hidden>Cancel edit</button></div>' +
      '<p class="form__note" id="form-msg"></p></form>' +
      '<div class="admin__bar" style="margin-top:40px"><input id="prod-search" placeholder="Search products…" class="admin__search"></div>' +
      '<div id="cat-chips" class="admin__chips"></div>' +
      '<div class="admin__list" id="admin-list"></div>';
    wire();
    load();
  }

  var allProducts = [], activeCat = "";
  function load() {
    fetch("/api/products").then(function (r) { return r.json(); }).then(function (data) {
      allProducts = (data && data.products) || [];
      A.setProducts(allProducts);
      document.getElementById("admin-count").textContent = allProducts.length + " products · source: " + (data.source || "?");
      var cats = allProducts.map(function (p) { return p.category; }).filter(function (c, i, a) { return c && a.indexOf(c) === i; });
      document.getElementById("cat-list").innerHTML = cats.map(function (c) { return '<option value="' + esc(c) + '">'; }).join("");
      document.getElementById("cat-chips").innerHTML =
        '<button class="chip' + (activeCat === "" ? " is-active" : "") + '" data-cat="">All</button>' +
        cats.map(function (c) { return '<button class="chip' + (activeCat === c ? " is-active" : "") + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>'; }).join("");
      paint();
    });
  }
  function paint() {
    var q = (document.getElementById("prod-search").value || "").toLowerCase();
    var list = allProducts.filter(function (p) {
      if (activeCat && p.category !== activeCat) return false;
      if (!q) return true;
      return ((p.name || "") + " " + (p.brand || "") + " " + (p.specs || "")).toLowerCase().indexOf(q) >= 0;
    });
    document.getElementById("admin-list").innerHTML = list.map(row).join("") || "<p>No matching products.</p>";
  }
  function row(p) {
    var img = p.image ? '<img src="' + esc(p.image) + '" alt="" loading="lazy">' : '<span class="admin__noimg">—</span>';
    return '<div class="admin__row" data-id="' + esc(p.id) + '">' +
      '<div class="admin__thumb">' + img + "</div>" +
      '<div class="admin__info"><strong>' + esc(p.name) + "</strong>" +
      '<span class="prod__brand">' + esc(p.brand || "") + (p.certifications ? " · " + esc(p.certifications) : "") + " · " + esc(p.category) + "</span>" +
      (p.specs ? '<span class="admin__specs">' + esc(p.specs) + "</span>" : "") + "</div>" +
      '<div class="admin__actions"><button class="btn btn--ghost btn--sm" data-act="edit">Edit</button>' +
      '<button class="btn btn--ghost btn--sm" data-act="del">Delete</button></div></div>';
  }
  function fillForm(p) {
    editing = p ? p.id : null;
    document.getElementById("p-id").value = p ? p.id : "";
    document.getElementById("p-name").value = p ? p.name || "" : "";
    document.getElementById("p-brand").value = p ? p.brand || "" : "";
    document.getElementById("p-category").value = p ? p.category || "" : "";
    document.getElementById("p-cert").value = p ? p.certifications || "" : "";
    document.getElementById("p-specs").value = p ? p.specs || "" : "";
    document.getElementById("p-image").value = p ? p.image || "" : "";
    document.getElementById("form-title").textContent = p ? "Edit product" : "Add a product";
    document.getElementById("save-btn").textContent = p ? "Save changes" : "Add product";
    document.getElementById("cancel-btn").hidden = !p;
  }
  function wire() {
    document.getElementById("prod-search").addEventListener("input", paint);
    document.getElementById("cat-chips").addEventListener("click", function (e) {
      var c = e.target.closest(".chip"); if (!c) return;
      activeCat = c.getAttribute("data-cat"); load();
    });
    document.getElementById("cancel-btn").addEventListener("click", function () {
      fillForm(null); document.getElementById("form-msg").textContent = ""; document.getElementById("p-file").value = "";
    });
    document.getElementById("p-file").addEventListener("change", function () {
      var f = this.files && this.files[0]; if (!f) return;
      if (f.size > 5 * 1024 * 1024) { document.getElementById("form-msg").textContent = "Image too large (max 5 MB)."; this.value = ""; return; }
      var fr = new FileReader();
      fr.onload = function () {
        var data = String(fr.result).split(",")[1];
        document.getElementById("form-msg").textContent = "Uploading image…";
        A.api("/api/admin/upload", { method: "POST", body: JSON.stringify({ mime: f.type, data: data }), headers: {} })
          .then(function (res) {
            if (res.data && res.data.url) { document.getElementById("p-image").value = res.data.url; document.getElementById("form-msg").textContent = "Image uploaded ✓ — click Save."; }
            else { document.getElementById("form-msg").textContent = (res.data && res.data.error) || "Upload failed."; }
          });
      };
      fr.readAsDataURL(f);
    });
    document.getElementById("product-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var body = { name: val("p-name"), brand: val("p-brand"), category: val("p-category"),
        certifications: val("p-cert"), specs: val("p-specs"), image: val("p-image") };
      var url = editing ? "/api/admin/products/" + editing : "/api/admin/products";
      document.getElementById("form-msg").textContent = "Saving…";
      A.api(url, { method: editing ? "PUT" : "POST", body: JSON.stringify(body) }).then(function (res) {
        if (!res.ok || res.data.error) { document.getElementById("form-msg").textContent = res.data.error || "Save failed."; return; }
        document.getElementById("form-msg").textContent = editing ? "Updated ✓" : "Added ✓";
        fillForm(null); load();
      });
    });
    document.getElementById("admin-list").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-act]"); if (!btn) return;
      var id = e.target.closest(".admin__row").getAttribute("data-id");
      if (btn.getAttribute("data-act") === "edit") {
        var p = allProducts.filter(function (x) { return String(x.id) === String(id); })[0];
        if (p) { fillForm(p); window.scrollTo({ top: 0, behavior: "smooth" }); }
      } else {
        if (!confirm("Delete this product?")) return;
        A.api("/api/admin/products/" + id, { method: "DELETE" }).then(load);
      }
    });
  }
  function val(id) { return document.getElementById(id).value; }

  A.onSection("products", render);
})();
```

- [ ] **Step 5: Append dashboard CSS to `site/assets/css/styles.css`**

```css
/* ---- Admin dashboard ---- */
[data-page="admin"]{background:var(--paper)}
.dash{display:grid;grid-template-columns:220px 1fr;min-height:100vh}
.dash__nav{background:var(--ash);color:#ece9e4;padding:24px 18px;display:flex;flex-direction:column;gap:10px}
.dash__brand{margin-bottom:18px}
.dash__link{display:block;width:100%;text-align:left;background:transparent;border:0;color:#cfcfca;font-family:var(--font-mono);font-size:13px;text-transform:uppercase;letter-spacing:.06em;padding:10px 12px;border-radius:8px;cursor:pointer}
.dash__link:hover{background:#37332e;color:#fff}
.dash__link.is-active{background:var(--molten);color:#fff}
.dash__nav #logout-btn{margin-top:auto}
.dash__main{padding:32px clamp(20px,4vw,56px);position:relative;max-width:1100px}
.dash__panel{display:none}
.dash__panel.is-active{display:block}
.dash__toast{position:fixed;bottom:24px;right:24px;background:var(--ash);color:#fff;padding:12px 18px;border-radius:10px;font-family:var(--font-mono);font-size:13px}
.admin__search{width:100%;max-width:420px}
.admin__chips{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}
.chip{font-family:var(--font-mono);font-size:12px;padding:6px 12px;border:1px solid var(--hairline);border-radius:999px;background:#fff;cursor:pointer}
.chip.is-active{background:var(--molten);color:#fff;border-color:var(--molten)}
@media(max-width:760px){.dash{grid-template-columns:1fr}.dash__nav{flex-direction:row;flex-wrap:wrap;align-items:center}.dash__nav #logout-btn{margin-left:auto}}
```

- [ ] **Step 6: Delete the old `admin.js`**

```bash
rm site/assets/js/admin.js
```

- [ ] **Step 7: Verify in the browser (Playwright)**

Run the server: `npm start` (needs `ADMIN_PASSWORD` and `DATABASE_URL` in env; if no DB, products fall back to file).
Using the Playwright MCP: navigate to `http://localhost:3000/admin`, fill the password, submit. Expected: sidebar with Products/Media/Poster, Products panel listing products, search box filters the list, category chips filter, Add/Edit/Delete still work. Take a screenshot `admin-shell.png`.
Expected: no console errors; switching to Media/Poster shows empty panels (built next).

- [ ] **Step 8: Commit**

```bash
git add site/admin.html site/assets/js/admin-core.js site/assets/js/admin-products.js site/assets/css/styles.css package.json
git rm site/assets/js/admin.js
git commit -m "feat(admin): sidebar dashboard shell + products search/filter (split admin.js into modules)"
```

---

## Phase 2 — Media library

### Task 2: Server — `imageId` helper + `label` column + `GET /api/admin/images`

**Files:**
- Create: `lib/image-id.js`
- Create: `test/image-id.test.js`
- Modify: `server.js`

**Interfaces:**
- Produces: `lib/image-id.js` exporting `imageId(raw) -> string` (lowercased hex, max 32 chars; `""` if none).
- Produces: `GET /api/admin/images` → `{ images: [{id, label, mime, size, created_at}] }`, newest first, no bytes. 401 if not admin, 503 if no DB.

- [ ] **Step 1: Write the failing test**

Create `test/image-id.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert");
const { imageId } = require("../lib/image-id");

test("keeps valid hex id", () => {
  assert.strictEqual(imageId("a1b2c3d4e5f60718"), "a1b2c3d4e5f60718");
});
test("strips non-hex characters", () => {
  assert.strictEqual(imageId("../../etc/passwd"), "edcae"); // only a,e,d,c,a,e survive -> 'eedcae'? verify below
});
test("uppercases are dropped (only lowercase hex kept)", () => {
  assert.strictEqual(imageId("ABCdef123"), "def123");
});
test("truncates to 32 chars", () => {
  assert.strictEqual(imageId("a".repeat(40)).length, 32);
});
test("empty / nullish -> empty string", () => {
  assert.strictEqual(imageId(null), "");
  assert.strictEqual(imageId(undefined), "");
  assert.strictEqual(imageId(""), "");
});
```

Note: the strip test's expectation depends on which chars are hex. Replace the
`strips non-hex characters` assertion body with the exact expected value after
seeing the first run (compute: keep only chars in `[a-f0-9]`).

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/image-id'`.

- [ ] **Step 3: Implement `lib/image-id.js`**

```js
// Pure helper: normalise an image id to lowercase hex, max 32 chars.
function imageId(raw) {
  return String(raw == null ? "" : raw).replace(/[^a-f0-9]/g, "").slice(0, 32);
}
module.exports = { imageId };
```

- [ ] **Step 4: Run tests, fix the strip expectation, re-run**

Run: `npm test`
For `strips non-hex characters`: `"../../etc/passwd"` → keep `[a-f0-9]` → `"ecaed"` (e,c,a,e,d from "etc" + "passwd": e,t,c,p,a,s,s,w,d → e,c,a,d). Recompute precisely from the actual string and set the assertion to the printed `actual` value, then re-run.
Expected: PASS (5 tests).

- [ ] **Step 5: Wire `imageId`, add a startup schema migration, and harden `/img/:id` (security: M2 + H1)**

Security context: the per-request `CREATE TABLE`/`ALTER TABLE` DDL the original draft put in handlers takes table locks on every call (security finding M2) — move it to a one-time startup migration. And `/img/:id` echoes the stored `mime` verbatim with no `nosniff`, allowing content-sniffing/stored-XSS if a non-image ever lands in the table (finding H1) — re-validate at serve time + send `nosniff` globally.

In `server.js`, after the `const fs = require("fs");` line add:

```js
const { imageId } = require("./lib/image-id");
```

After the `const SITE = ...` line add the shared MIME allowlist (reused by upload + serve):

```js
const IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];
```

Just after `app.disable("x-powered-by");` add a global `nosniff` header:

```js
app.use((req, res, next) => { res.set("X-Content-Type-Options", "nosniff"); next(); });
```

Add a one-time startup migration function near `dbClient`:

```js
async function ensureSchema() {
  if (!process.env.DATABASE_URL) return;
  const c = dbClient();
  try {
    await c.connect();
    await c.query("CREATE TABLE IF NOT EXISTS images (id TEXT PRIMARY KEY, mime TEXT NOT NULL, bytes BYTEA NOT NULL, created_at TIMESTAMPTZ DEFAULT now())");
    await c.query("ALTER TABLE images ADD COLUMN IF NOT EXISTS label TEXT");
    console.log("schema ensured");
  } catch (e) { console.error("ensureSchema failed:", e.message); }
  finally { try { await c.end(); } catch (e) {} }
}
```

Change the `app.listen(...)` call at the bottom to run it once at startup:

```js
app.listen(PORT, () => {
  console.log(`Fire Triangle on :${PORT} (model ${MODEL}, key ${KEY ? "set" : "MISSING"})`);
  ensureSchema();
});
```

In the `/img/:id` handler, replace:

```js
  const id = String(req.params.id).replace(/[^a-f0-9]/g, "").slice(0, 32);
```

with:

```js
  const id = imageId(req.params.id);
```

and replace the content-type line:

```js
    res.set("Content-Type", rows[0].mime);
```

with serve-time re-validation (anything not in the image allowlist is forced to a safe download, never sniffed/executed):

```js
    if (IMAGE_MIME.indexOf(rows[0].mime) < 0) {
      res.set("Content-Type", "application/octet-stream");
      res.set("Content-Disposition", "attachment");
    } else {
      res.set("Content-Type", rows[0].mime);
    }
```

In the existing `/api/admin/upload` handler: change the allowlist line `const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];` to reuse the shared constant `const allowed = IMAGE_MIME;`, and **remove** the per-request `await c.query("CREATE TABLE IF NOT EXISTS images ...")` line inside that handler (schema is now ensured at startup). Leave the `INSERT` untouched.

- [ ] **Step 6: Add `GET /api/admin/images` (place near the other admin routes; NO per-request DDL — schema is ensured at startup)**

```js
app.get("/api/admin/images", async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: "Unauthorized" });
  await withDb(res, async (c) => {
    const { rows } = await c.query(
      "SELECT id, label, mime, octet_length(bytes) AS size, created_at FROM images ORDER BY created_at DESC, id"
    );
    res.json({ images: rows });
  });
});
```

- [ ] **Step 7: Verify the endpoint**

Run `npm start`. With a valid password and DB:
```bash
curl -s -H "Authorization: Bearer $ADMIN_PASSWORD" http://localhost:3000/api/admin/images | head -c 400
```
Expected: `{"images":[...]}` with `id,label,mime,size,created_at` and **no** `bytes`. Without auth header → `{"error":"Unauthorized"}` (401).

- [ ] **Step 8: Commit**

```bash
git add lib/image-id.js test/image-id.test.js server.js
git commit -m "feat(admin): images label column + GET /api/admin/images list endpoint (+ imageId helper & tests)"
```

### Task 3: Server — `PATCH` (rename) + `DELETE` image endpoints

**Files:**
- Modify: `server.js`

**Interfaces:**
- Produces: `PATCH /api/admin/images/:id` body `{label}` → `{ok:boolean}`.
- Produces: `DELETE /api/admin/images/:id` → `{ok:boolean}`.

- [ ] **Step 1: Add both endpoints near `GET /api/admin/images`**

```js
app.patch("/api/admin/images/:id", async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: "Unauthorized" });
  const id = imageId(req.params.id);
  if (!id) return res.status(400).json({ error: "bad id" });
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
```

- [ ] **Step 2: Verify**

With server running + a known image id `<ID>` from the list endpoint:
```bash
curl -s -X PATCH -H "Authorization: Bearer $ADMIN_PASSWORD" -H "Content-Type: application/json" -d '{"label":"test label"}' http://localhost:3000/api/admin/images/<ID>
```
Expected: `{"ok":true}`. Re-list → that row's `label` is `"test label"`.
`PATCH .../zzz` (bad id) → `{"error":"bad id"}` (400).
(Defer a real DELETE until you have a throwaway image; test it during Task 4 browser verification.)

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat(admin): rename + delete image endpoints"
```

### Task 4: Client — Media library UI (grid, upload, rename, delete, pickers)

**Files:**
- Create: `site/assets/js/admin-media.js`
- Modify: `site/assets/css/styles.css` (append)

**Interfaces:**
- Consumes: `FTAdmin.api`, `FTAdmin.esc`, `FTAdmin.toast`, `FTAdmin.products`, `FTAdmin.onSection`, `/api/admin/images`, `/api/admin/upload`.
- Produces (global helpers for cross-section pickers):
  - `FTAdmin.media.refresh() -> Promise` — reload the image cache.
  - `FTAdmin.media.pick() -> Promise<string|null>` — open a modal grid; resolves with a chosen `/img/:id` URL or null if cancelled.
  - `FTAdmin.media.countUsedBy(id) -> number` — products whose `image === "/img/<id>"`.

- [ ] **Step 1: Create `site/assets/js/admin-media.js`**

```js
// Media library: grid + upload + rename + delete (+ picker modal for other sections).
(function () {
  "use strict";
  var A = window.FTAdmin, esc = A.esc;
  var images = [], pickResolve = null;

  function render() {
    document.getElementById("panel-media").innerHTML =
      '<h2>Media library</h2>' +
      '<div class="admin__bar"><label class="btn btn--primary btn--sm" style="cursor:pointer">Upload image' +
      '<input type="file" id="media-file" accept="image/*" hidden></label>' +
      '<span id="media-count" class="prod__brand"></span></div>' +
      '<p class="form__note" id="media-msg"></p>' +
      '<div class="media__grid" id="media-grid"></div>';
    document.getElementById("media-file").addEventListener("change", upload);
    document.getElementById("media-grid").addEventListener("click", onGridClick);
    refresh();
  }

  function refresh() {
    return A.api("/api/admin/images").then(function (res) {
      images = (res.data && res.data.images) || [];
      var grid = document.getElementById("media-grid");
      var count = document.getElementById("media-count");
      if (count) count.textContent = images.length + " images";
      if (grid) grid.innerHTML = images.map(tile).join("") || "<p>No images yet.</p>";
    });
  }
  function tile(im) {
    var url = "/img/" + esc(im.id);
    var kb = Math.max(1, Math.round((im.size || 0) / 1024));
    return '<figure class="media__tile" data-id="' + esc(im.id) + '">' +
      '<img src="' + url + '" alt="" loading="lazy">' +
      '<figcaption><input class="media__label" value="' + esc(im.label || "") + '" placeholder="(no label)" maxlength="120">' +
      '<span class="media__meta">' + kb + ' KB</span></figcaption>' +
      '<div class="media__acts">' +
      '<button class="btn btn--ghost btn--sm" data-act="copy">Copy URL</button>' +
      '<button class="btn btn--ghost btn--sm" data-act="rename">Save name</button>' +
      '<button class="btn btn--ghost btn--sm" data-act="del">Delete</button></div></figure>';
  }
  function countUsedBy(id) {
    var prods = A.products() || [];
    var u = "/img/" + id;
    return prods.filter(function (p) { return p.image === u; }).length;
  }
  function onGridClick(e) {
    var btn = e.target.closest("button[data-act]"); if (!btn) return;
    var fig = e.target.closest(".media__tile"); var id = fig.getAttribute("data-id");
    var act = btn.getAttribute("data-act");
    if (act === "copy") {
      navigator.clipboard.writeText(location.origin + "/img/" + id).then(function () { A.toast("URL copied"); });
    } else if (act === "rename") {
      var label = fig.querySelector(".media__label").value;
      A.api("/api/admin/images/" + id, { method: "PATCH", body: JSON.stringify({ label: label }) })
        .then(function () { A.toast("Renamed"); });
    } else if (act === "del") {
      var used = countUsedBy(id);
      var warn = used ? ("This image is used by " + used + " product(s). Delete anyway?") : "Delete this image?";
      if (!confirm(warn)) return;
      A.api("/api/admin/images/" + id, { method: "DELETE" }).then(function () { A.toast("Deleted"); refresh(); });
    }
  }
  function upload() {
    var f = this.files && this.files[0]; if (!f) return;
    if (f.size > 5 * 1024 * 1024) { document.getElementById("media-msg").textContent = "Image too large (max 5 MB)."; this.value = ""; return; }
    var fr = new FileReader();
    fr.onload = function () {
      document.getElementById("media-msg").textContent = "Uploading…";
      A.api("/api/admin/upload", { method: "POST", body: JSON.stringify({ mime: f.type, data: String(fr.result).split(",")[1] }) })
        .then(function (res) {
          if (res.data && res.data.url) { document.getElementById("media-msg").textContent = "Uploaded ✓"; refresh(); }
          else { document.getElementById("media-msg").textContent = (res.data && res.data.error) || "Upload failed."; }
        });
    };
    fr.readAsDataURL(f);
    this.value = "";
  }

  // ---- picker modal (used by products + poster) ----
  function pick() {
    return refresh().then(function () {
      return new Promise(function (resolve) {
        pickResolve = resolve;
        var modal = document.createElement("div");
        modal.className = "media__modal"; modal.id = "media-modal";
        modal.innerHTML = '<div class="media__modalbox"><div class="admin__bar"><strong>Pick an image</strong>' +
          '<button class="btn btn--ghost btn--sm" data-pick="cancel">Cancel</button></div>' +
          '<div class="media__grid">' + images.map(function (im) {
            return '<figure class="media__tile media__tile--pick" data-pick-id="' + esc(im.id) + '"><img src="/img/' + esc(im.id) + '" alt=""><figcaption>' + esc(im.label || "") + '</figcaption></figure>';
          }).join("") + '</div></div>';
        modal.addEventListener("click", function (e) {
          if (e.target.closest('[data-pick="cancel"]') || e.target === modal) finish(null);
          var t = e.target.closest("[data-pick-id]"); if (t) finish("/img/" + t.getAttribute("data-pick-id"));
        });
        document.body.appendChild(modal);
      });
    });
  }
  function finish(url) {
    var m = document.getElementById("media-modal"); if (m) m.remove();
    if (pickResolve) { pickResolve(url); pickResolve = null; }
  }

  A.media = { refresh: refresh, pick: pick, countUsedBy: countUsedBy };
  A.onSection("media", render);
})();
```

- [ ] **Step 2: Append media CSS to `site/assets/css/styles.css`**

```css
/* ---- Media library ---- */
.media__grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px;margin-top:20px}
.media__tile{margin:0;background:#fff;border:1px solid var(--hairline);border-radius:10px;overflow:hidden;display:flex;flex-direction:column}
.media__tile img{width:100%;height:140px;object-fit:contain;background:#fafafa}
.media__tile figcaption{padding:8px;display:flex;flex-direction:column;gap:4px}
.media__label{font-size:13px;padding:4px 6px;border:1px solid var(--hairline);border-radius:6px}
.media__meta{font-family:var(--font-mono);font-size:11px;color:var(--steel)}
.media__acts{display:flex;gap:4px;padding:8px;flex-wrap:wrap;border-top:1px solid var(--hairline)}
.media__modal{position:fixed;inset:0;background:rgba(0,0,0,.55);display:grid;place-items:center;z-index:50;padding:20px}
.media__modalbox{background:#fff;border-radius:14px;padding:20px;max-width:900px;width:100%;max-height:85vh;overflow:auto}
.media__tile--pick{cursor:pointer}
.media__tile--pick figcaption{font-size:12px}
```

- [ ] **Step 3: Wire the "Pick from Media library" button into the products form**

In `site/assets/js/admin-products.js`, in `render()`'s HTML, replace the image label line:

```js
      '<label>Image path or URL<input id="p-image" maxlength="300" placeholder="/assets/img/products/example.jpg"></label>' +
```

with:

```js
      '<label>Image path or URL<input id="p-image" maxlength="300" placeholder="/assets/img/products/example.jpg"></label>' +
      '<button class="btn btn--ghost btn--sm" type="button" id="pick-media">Pick from Media library</button>' +
```

And in `wire()` add:

```js
    document.getElementById("pick-media").addEventListener("click", function () {
      A.media.pick().then(function (url) { if (url) document.getElementById("p-image").value = url; });
    });
```

- [ ] **Step 4: Verify in the browser (Playwright)**

`npm start`, log in, open **Media**. Expected: grid of existing images with KB sizes. Upload a small test PNG → it appears. Edit a label → "Save name" → toast "Renamed"; reload confirms persisted. In **Products**, Add a product, click "Pick from Media library" → modal grid → click an image → its `/img/:id` URL fills the field. Back in Media, Delete the throwaway image: if it's used by a product the confirm says "used by N product(s)". Screenshot `admin-media.png`. Confirm no console errors.

- [ ] **Step 5: Commit**

```bash
git add site/assets/js/admin-media.js site/assets/js/admin-products.js site/assets/css/styles.css
git commit -m "feat(admin): media library (grid, upload, rename, delete-guard, picker) + product image picker"
```

---

## Phase 3 — Poster Maker

### Task 5: Vendor html2canvas + poster template scaffold

**Files:**
- Create: `site/assets/js/vendor/html2canvas.min.js`
- Create: `site/assets/js/admin-poster.js`
- Modify: `site/admin.html` (load the vendor script)
- Modify: `site/assets/css/styles.css` (append poster styles)

**Interfaces:**
- Produces: a `#poster-stage` node (1080×1080) reflecting the current field values; `FTAdmin.onSection("poster", render)`.
- Consumes: `window.html2canvas` (from the vendored lib).

- [ ] **Step 1: Vendor html2canvas**

Download the UMD build into the vendor folder (one-time, vendored like gsap/three):

```bash
curl -L -o site/assets/js/vendor/html2canvas.min.js https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js
```

Verify it is non-empty JS:
```bash
head -c 80 site/assets/js/vendor/html2canvas.min.js
```
Expected: minified JS (starts with `/*!` or `(function`). If the download fails, obtain html2canvas 1.4.1 UMD by other means and place it at that path.

- [ ] **Step 2: Load it in `site/admin.html`**

Add before `admin-poster.js`:

```html
  <script src="assets/js/vendor/html2canvas.min.js" defer></script>
```
(Place this line immediately above the `admin-poster.js` script tag.)

- [ ] **Step 3: Create `site/assets/js/admin-poster.js` with the template + default state**

```js
// Poster Maker: one branded template, live preview, PNG export.
(function () {
  "use strict";
  var A = window.FTAdmin, esc = A.esc;
  var state = {
    title: "Fire Hose", subtitle: '2.5"', photo: "",
    bullets: ["Size : 2.5 x 30 meters long", "Single Jacket", "White Color", "c/w Aluminum Coupling", "Working pressure : 250 psi"],
    fm: true, rapidrop: true,
    head: "Head office: Alexandria", branch: "Branch office: Cairo",
    phones: "01068 990 088\n0106 949 474 8"
  };

  function render() {
    document.getElementById("panel-poster").innerHTML =
      '<h2>Poster Maker</h2>' +
      '<div class="poster__wrap">' +
        '<div class="poster__form" id="poster-form"></div>' +
        '<div class="poster__preview"><div id="poster-scale"><div id="poster-stage"></div></div>' +
          '<div class="hero__cta" style="margin-top:16px">' +
          '<button class="btn btn--primary" id="poster-download" type="button">Download PNG</button>' +
          '<button class="btn btn--ghost" id="poster-save" type="button">Save to Media</button></div>' +
          '<p class="form__note" id="poster-msg"></p>' +
        '</div>' +
      '</div>';
    buildForm();
    paint();
    // export wiring is added in Task 7
  }

  function stageHTML() {
    var bullets = state.bullets.filter(function (b) { return b && b.trim(); })
      .map(function (b) { return '<li>' + esc(b) + '</li>'; }).join("");
    var badges =
      (state.fm ? '<span class="pz-badge pz-fm"><b>FM</b><i>APPROVED</i></span>' : "") +
      (state.rapidrop ? '<img class="pz-rd" src="/assets/img/brand-rapidrop.webp" alt="Rapidrop">' : "");
    var phones = esc(state.phones).split("\n").join("<br>");
    return '' +
      '<div class="pz-slash"></div>' +
      '<img class="pz-logo" src="/assets/img/logo.png" alt="Fire Triangle">' +
      '<div class="pz-badges">' + badges + '</div>' +
      (state.photo ? '<img class="pz-photo" src="' + esc(state.photo) + '" alt="">' : '<div class="pz-photo pz-photo--empty">photo</div>') +
      '<h3 class="pz-title">' + esc(state.title) + '</h3>' +
      '<div class="pz-sub">' + esc(state.subtitle) + '</div>' +
      '<ul class="pz-specs">' + bullets + '</ul>' +
      '<div class="pz-foot"><div class="pz-office">' + esc(state.head) + '<br>' + esc(state.branch) + '</div>' +
      '<div class="pz-contact"><span>Contact Us</span><div>' + phones + '</div></div></div>';
  }
  function paint() { document.getElementById("poster-stage").innerHTML = stageHTML(); fitStage(); }
  function fitStage() {
    var box = document.querySelector(".poster__preview");
    var scale = Math.min(1, (box.clientWidth - 4) / 1080);
    document.getElementById("poster-scale").style.transform = "scale(" + scale + ")";
    document.getElementById("poster-scale").style.height = (1080 * scale) + "px";
  }

  function buildForm() {
    var f = document.getElementById("poster-form");
    f.innerHTML =
      '<label>Title<input id="pz-title" value="' + esc(state.title) + '"></label>' +
      '<label>Subtitle / size<input id="pz-subtitle" value="' + esc(state.subtitle) + '"></label>' +
      '<label>Product photo<div class="hero__cta"><button class="btn btn--ghost btn--sm" type="button" id="pz-pick">Pick from Media</button>' +
      '<label class="btn btn--ghost btn--sm" style="cursor:pointer">Upload<input type="file" id="pz-file" accept="image/*" hidden></label></div></label>' +
      '<label>Spec bullets (one per line)<textarea id="pz-bullets" rows="6">' + esc(state.bullets.join("\n")) + '</textarea></label>' +
      '<label class="poster__check"><input type="checkbox" id="pz-fm"' + (state.fm ? " checked" : "") + '> FM Approved badge</label>' +
      '<label class="poster__check"><input type="checkbox" id="pz-rd"' + (state.rapidrop ? " checked" : "") + '> Rapidrop badge</label>' +
      '<label>Head office line<input id="pz-head" value="' + esc(state.head) + '"></label>' +
      '<label>Branch office line<input id="pz-branch" value="' + esc(state.branch) + '"></label>' +
      '<label>Contact phones (one per line)<textarea id="pz-phones" rows="2">' + esc(state.phones) + '</textarea></label>';
    bind("pz-title", "title"); bind("pz-subtitle", "subtitle");
    bind("pz-head", "head"); bind("pz-branch", "branch"); bind("pz-phones", "phones");
    document.getElementById("pz-bullets").addEventListener("input", function () { state.bullets = this.value.split("\n"); paint(); });
    document.getElementById("pz-fm").addEventListener("change", function () { state.fm = this.checked; paint(); });
    document.getElementById("pz-rd").addEventListener("change", function () { state.rapidrop = this.checked; paint(); });
    document.getElementById("pz-pick").addEventListener("click", function () {
      A.media.pick().then(function (url) { if (url) { state.photo = url; paint(); } });
    });
    document.getElementById("pz-file").addEventListener("change", function () {
      var fl = this.files && this.files[0]; if (!fl) return;
      var fr = new FileReader();
      fr.onload = function () { state.photo = String(fr.result); paint(); }; // data URL (local preview)
      fr.readAsDataURL(fl);
    });
  }
  function bind(id, key) { document.getElementById(id).addEventListener("input", function () { state[key] = this.value; paint(); }); }

  window.addEventListener("resize", function () { if (document.getElementById("poster-stage")) fitStage(); });
  A.poster = { stageEl: function () { return document.getElementById("poster-stage"); }, state: state };
  A.onSection("poster", render);
})();
```

- [ ] **Step 4: Append poster CSS to `site/assets/css/styles.css`**

```css
/* ---- Poster Maker ---- */
.poster__wrap{display:grid;grid-template-columns:340px 1fr;gap:28px;align-items:start}
.poster__form{display:flex;flex-direction:column;gap:12px}
.poster__form label{display:flex;flex-direction:column;gap:4px;font-size:13px}
.poster__check{flex-direction:row !important;align-items:center;gap:8px}
.poster__preview{overflow:hidden}
#poster-scale{transform-origin:top left}
@media(max-width:900px){.poster__wrap{grid-template-columns:1fr}}

/* The 1080x1080 design stage. All units fixed px so export is deterministic. */
#poster-stage{width:1080px;height:1080px;position:relative;overflow:hidden;
  background:linear-gradient(135deg,#7a0f0f 0%,#3a0606 55%,#1c0303 100%);
  font-family:'Space Grotesk',Arial,sans-serif;color:#fff}
#poster-stage .pz-slash{position:absolute;left:-120px;top:0;width:380px;height:1080px;
  background:#fff;opacity:.06;transform:skewX(-18deg)}
#poster-stage .pz-logo{position:absolute;top:48px;left:48px;width:130px;height:auto}
#poster-stage .pz-badges{position:absolute;top:54px;right:54px;display:flex;align-items:center;gap:20px}
#poster-stage .pz-fm{display:flex;flex-direction:column;align-items:center;justify-content:center;
  width:96px;height:64px;border:3px solid #111;border-radius:50%;background:#fff;color:#111;line-height:1}
#poster-stage .pz-fm b{font-size:26px;font-weight:700}
#poster-stage .pz-fm i{font-size:11px;font-style:normal;letter-spacing:.08em}
#poster-stage .pz-rd{height:54px;width:auto;background:#fff;padding:6px 10px;border-radius:6px}
#poster-stage .pz-photo{position:absolute;left:30px;top:300px;width:520px;height:520px;object-fit:contain}
#poster-stage .pz-photo--empty{display:grid;place-items:center;background:rgba(255,255,255,.08);
  border:2px dashed rgba(255,255,255,.3);color:rgba(255,255,255,.5);font-size:28px}
#poster-stage .pz-title{position:absolute;left:560px;top:150px;margin:0;font-size:104px;font-weight:700;color:var(--molten);line-height:.95}
#poster-stage .pz-sub{position:absolute;left:560px;top:270px;font-size:120px;font-weight:700;color:#111}
#poster-stage .pz-specs{position:absolute;left:560px;top:430px;right:48px;margin:0;padding:0;list-style:none}
#poster-stage .pz-specs li{font-size:32px;font-weight:600;margin-bottom:22px;padding-left:40px;position:relative}
#poster-stage .pz-specs li:before{content:"";position:absolute;left:0;top:8px;border-left:18px solid var(--molten);border-top:11px solid transparent;border-bottom:11px solid transparent}
#poster-stage .pz-foot{position:absolute;left:48px;right:48px;bottom:48px;display:flex;justify-content:space-between;align-items:flex-end}
#poster-stage .pz-office{font-size:26px;font-weight:600}
#poster-stage .pz-contact{text-align:right}
#poster-stage .pz-contact span{display:inline-block;background:var(--molten);padding:8px 22px;border-radius:999px;font-size:24px;font-weight:700;margin-bottom:10px}
#poster-stage .pz-contact div{font-size:30px;font-weight:700}
```

- [ ] **Step 5: Verify the preview (Playwright)**

`npm start`, log in, open **Poster Maker**. Expected: left form, right preview showing the maroon card with logo, FM + Rapidrop badges, "Fire Hose" / `2.5"`, five red-arrow bullets, office + contact footer. Edit the title and toggle a badge → preview updates live. Pick a product photo from Media → it fills the photo panel. Screenshot `poster-preview.png` and compare against the reference card layout. No console errors.

- [ ] **Step 6: Commit**

```bash
git add site/assets/js/vendor/html2canvas.min.js site/assets/js/admin-poster.js site/admin.html site/assets/css/styles.css
git commit -m "feat(admin): poster maker template + live preview (vendored html2canvas)"
```

### Task 6: Poster export — Download PNG + Save to Media + fidelity check

**Files:**
- Modify: `site/assets/js/admin-poster.js`

**Interfaces:**
- Consumes: `window.html2canvas`, `FTAdmin.api`, `FTAdmin.media.refresh`, `#poster-stage`.

- [ ] **Step 1: Add export functions and wire the buttons**

In `admin-poster.js`, inside `render()` replace the comment `// export wiring is added in Task 7` with:

```js
    document.getElementById("poster-download").addEventListener("click", exportPng);
    document.getElementById("poster-save").addEventListener("click", saveToMedia);
```

Add these functions before the closing `})();`:

```js
  function rasterize() {
    var stage = document.getElementById("poster-stage");
    return (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve())
      .then(function () {
        return window.html2canvas(stage, { width: 1080, height: 1080, scale: 1, backgroundColor: null, useCORS: true });
      });
  }
  function exportPng() {
    document.getElementById("poster-msg").textContent = "Rendering…";
    rasterize().then(function (canvas) {
      var a = document.createElement("a");
      a.download = (state.title || "poster").replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".png";
      a.href = canvas.toDataURL("image/png");
      a.click();
      document.getElementById("poster-msg").textContent = "Downloaded ✓";
    }).catch(function (e) { document.getElementById("poster-msg").textContent = "Export failed: " + e.message; });
  }
  function saveToMedia() {
    document.getElementById("poster-msg").textContent = "Rendering…";
    rasterize().then(function (canvas) {
      var data = canvas.toDataURL("image/png").split(",")[1];
      return A.api("/api/admin/upload", { method: "POST", body: JSON.stringify({ mime: "image/png", data: data }) });
    }).then(function (res) {
      if (res && res.data && res.data.url) {
        document.getElementById("poster-msg").textContent = "Saved to Media ✓ (" + res.data.url + ")";
        if (A.media) A.media.refresh();
      } else { document.getElementById("poster-msg").textContent = (res && res.data && res.data.error) || "Save failed."; }
    }).catch(function (e) { document.getElementById("poster-msg").textContent = "Save failed: " + e.message; });
  }
```

- [ ] **Step 2: Verify export fidelity (the primary risk — do this carefully)**

`npm start`, log in, Poster Maker. Click **Download PNG**. Open the downloaded file. Expected: a 1080×1080 PNG matching the preview — maroon gradient, logo, badges, title/size, red-arrow bullets, footer. Check specifically: gradient renders (not flat black), the `brand-rapidrop.webp` badge appears (it is same-origin so no CORS taint), red triangle bullet markers render, fonts are Space Grotesk (not fallback). If a detail mis-renders, adjust that element's CSS toward simpler primitives (e.g., replace a CSS triangle that drops out with a unicode "▶" character; replace gradient with layered solid blocks) and re-export until faithful. Document any change in the commit message.

- [ ] **Step 3: Verify Save to Media**

Click **Save to Media**. Expected: msg "Saved to Media ✓ (/img/…)". Switch to the **Media** section → the rendered poster appears in the grid. Screenshot `poster-export.png`.

- [ ] **Step 4: Commit**

```bash
git add site/assets/js/admin-poster.js
git commit -m "feat(admin): poster PNG export (download + save to media library)"
```

---

## Phase 4 — Server security hardening (from the 2026-06-23 security review)

### Task 7: Harden existing server code (H2, M1, L1, L2, L4)

**Files:**
- Create: `lib/admin-auth.js`
- Create: `test/admin-auth.test.js`
- Modify: `server.js`

**Interfaces:**
- Produces: `lib/admin-auth.js` exporting `tokensMatch(provided, expected) -> boolean` — constant-time compare with no length-based early return and no length leak.
- Consumes: the `nosniff` headers middleware added in Task 2 Step 5 (this task expands it to the full header set).

Context: these are fixes to pre-existing `server.js` code flagged by the security review. Do them after the feature tasks so this is the only task editing these regions. The image-serve hardening + startup migration + `nosniff` were already done in Task 2 — do NOT redo them; this task only adds what's listed below.

- [ ] **Step 1: Write the failing test for `tokensMatch`**

Create `test/admin-auth.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert");
const { tokensMatch } = require("../lib/admin-auth");

test("equal tokens match", () => {
  assert.strictEqual(tokensMatch("s3cret-token", "s3cret-token"), true);
});
test("different same-length tokens do not match", () => {
  assert.strictEqual(tokensMatch("aaaaaa", "bbbbbb"), false);
});
test("different-length tokens do not match", () => {
  assert.strictEqual(tokensMatch("short", "longertoken"), false);
});
test("empty provided token never matches a real password", () => {
  assert.strictEqual(tokensMatch("", "realpw"), false);
});
test("does not throw on tokens longer than the fixed buffer", () => {
  assert.strictEqual(tokensMatch("x".repeat(500), "realpw"), false);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/admin-auth'`.

- [ ] **Step 3: Implement `lib/admin-auth.js`**

```js
// Constant-time admin token compare. No early length return (no length-leak
// timing oracle): both sides are copied into a fixed 256-byte canvas, compared
// with crypto.timingSafeEqual, then an exact-length check rejects padded matches.
const crypto = require("crypto");
function tokensMatch(provided, expected) {
  const p = String(provided == null ? "" : provided);
  const e = String(expected == null ? "" : expected);
  if (!e) return false;
  const a = Buffer.alloc(256), b = Buffer.alloc(256);
  Buffer.from(p).copy(a); Buffer.from(e).copy(b);
  const eq = crypto.timingSafeEqual(a, b);
  return eq && p.length === e.length;
}
module.exports = { tokensMatch };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (the `image-id` tests plus the 5 new `admin-auth` tests).

- [ ] **Step 5: Use `tokensMatch` in `adminOk` (M1)**

In `server.js`, add near the other requires:

```js
const { tokensMatch } = require("./lib/admin-auth");
```

Replace the body of `adminOk` with:

```js
function adminOk(req) {
  if (!ADMIN_PASSWORD) return false;
  const t = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  return tokensMatch(t, ADMIN_PASSWORD);
}
```

- [ ] **Step 6: Fix the rate-limiter IP source (H2) and eviction (L1)**

In `server.js`, just after `const app = express();` add:

```js
app.set("trust proxy", 1); // trust Railway's single-hop proxy so req.ip is the real client
```

In the `/api/chat` handler, replace the `ip` derivation:

```js
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "?").toString().split(",")[0].trim();
```

with:

```js
  const ip = req.ip || "?";
```

In `rateLimited`, replace the blunt overflow clear:

```js
  if (HITS.size > 5000) HITS.clear(); // crude memory guard
```

with stale-entry eviction (never wipes active counters):

```js
  if (HITS.size > 5000) {
    for (const [k, ts] of HITS) { if (!ts.length || now - ts[ts.length - 1] >= WINDOW_MS) HITS.delete(k); }
  }
```

- [ ] **Step 7: Expand security headers (L2) and tighten the upload body limit (L4)**

In `server.js`, replace the `nosniff`-only middleware added in Task 2:

```js
app.use((req, res, next) => { res.set("X-Content-Type-Options", "nosniff"); next(); });
```

with the full header set:

```js
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "SAMEORIGIN");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});
```

In the `/api/admin/upload` route definition, change the body limit from `"8mb"` to `"7mb"` (a 5 MB binary is ~6.67 MB base64; 7 MB keeps headroom without accepting 8 MB of garbage):

```js
app.post("/api/admin/upload", express.json({ limit: "7mb" }), async (req, res) => {
```

- [ ] **Step 8: Verify**

Run `npm test` → all `image-id` + `admin-auth` tests pass, output pristine.
Boot locally with `ADMIN_PASSWORD=devtest PORT=3000 node server.js`:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer devtest" http://localhost:3000/api/admin/check   # 200
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer wrong"  http://localhost:3000/api/admin/check   # 401
curl -s -D - -o /dev/null http://localhost:3000/ | grep -i "x-content-type-options\|x-frame-options\|referrer-policy\|strict-transport"   # all four present
```
Expected: 200 / 401, and the four security headers appear on responses. Kill the server.

- [ ] **Step 9: Commit**

```bash
git add lib/admin-auth.js test/admin-auth.test.js server.js
git commit -m "security: constant-time admin compare, trust-proxy rate-limit key, header set, tighter upload limit (review H2/M1/L1/L2/L4)"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Section A (overall shell, module split, password gate) → Task 1. ✓
- Section B Products polish (search, chips, media picker) → Task 1 (search/chips) + Task 4 Step 3 (picker). ✓
- Section C Media library (`label` column, GET/PATCH/DELETE, grid, upload, rename, delete-guard, pickers) → Tasks 2–4. ✓
- Section D Poster Maker (template, fields, preview, html2canvas export, save-to-media, FM CSS badge, Rapidrop/logo assets) → Tasks 5–6. ✓
- Error handling (401 logout, upload limits server-side, id validation, fonts.ready) → `api()` 401 handling (Task 1), `imageId` (Task 2), `rasterize` fonts.ready (Task 6). ✓
- Risk: export fidelity tested before shipping → Task 6 Step 2. ✓
- Build order Products → Media → Poster → Phases 1/2/3. ✓
- Constraint: no new server deps, vanilla JS, no build → respected (only vendored client lib + built-in node:test). ✓

**Placeholder scan:** No "TBD/TODO". The only deferred value is the exact strip-expectation string in Task 2 Step 1, which is explicitly computed in Step 4 against the real run — acceptable and instructed, not a silent placeholder.

**Type consistency:** `FTAdmin.api` returns `{ok,status,data}` and is used consistently. `FTAdmin.media.pick/refresh/countUsedBy`, `FTAdmin.products/setProducts`, `imageId` names match across tasks. Poster `state` keys (`title,subtitle,photo,bullets,fm,rapidrop,head,branch,phones`) match the form bindings and `stageHTML`.
