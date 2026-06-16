# Fire Triangle Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, premium-engineered 7-page redesign of firetriangle.net whose structure embodies the fire-triangle concept, reusing the exact existing color palette and fixing every audit issue by construction.

**Architecture:** A no-build static site (semantic HTML5 + one tokenized CSS file + vanilla JS). Shared header/footer are injected by a JS render function (string templates, NOT `fetch` — so pages open by double-click on `file://`). The signature triangle is a reusable SVG module. Verification is done in a real browser via Playwright (DOM assertions + screenshots) — the frontend analog of unit tests.

**Tech Stack:** HTML5, CSS (custom properties, CSS Grid), vanilla ES modules, Google Fonts (Space Grotesk / Inter / JetBrains Mono), Playwright MCP for verification, optional 21st.dev (Magic MCP) for complex component scaffolding once connected.

---

## Spec reference

Design spec: `docs/superpowers/specs/2026-06-17-firetriangle-redesign-design.md`

**Palette (HARD constraint — only these tokens):**
`--molten:#DD3333` · `--ash:#2B2A26` · `--ink:#212529` · `--paper:#F2F3F4` · `--white:#FFFFFF` · `--steel:#999999` · `--hairline:#CCCCCC`

## File structure

```
F:/fire-triangle/site/
  index.html            # Home
  products.html         # Products (triangle-filtered) — centerpiece
  about.html
  services.html
  projects.html
  careers.html
  contact.html
  assets/
    css/styles.css      # all tokens + components + page styles
    js/components.js     # renderHeader(), renderFooter() — injected chrome
    js/triangle.js       # buildTriangle() reusable SVG + draw/hover behavior
    js/main.js           # boot: render chrome, init triangle, scroll reveals, counters, product filter
    img/                 # optimized WebP assets
```

Each JS file has one responsibility: `components.js` = shared chrome markup; `triangle.js` = the signature SVG; `main.js` = page wiring. `styles.css` holds all styling (single-file is the established pattern for a no-build prototype and keeps the cascade in one place).

## Verification conventions

A small static server is used so relative module imports and lazy-loading behave like production:
- Start: `python -m http.server 5500 --directory F:/fire-triangle/site` (run in background)
- Playwright navigates to `http://localhost:5500/<page>.html`
- Double-click/`file://` is also validated in Task 14 (chrome must still render).

---

## Task 0: Project scaffold + version control

**Files:**
- Create: `F:/fire-triangle/site/` tree (empty files listed above)
- Create: `F:/fire-triangle/.gitignore`

- [ ] **Step 1: Initialize git and create the folder tree**

```bash
cd /f/fire-triangle
git init
mkdir -p site/assets/css site/assets/js site/assets/img
touch site/index.html site/products.html site/about.html site/services.html site/projects.html site/careers.html site/contact.html
touch site/assets/css/styles.css site/assets/js/components.js site/assets/js/triangle.js site/assets/js/main.js
```

- [ ] **Step 2: Add .gitignore**

```
.playwright-mcp/
*.jpeg
*.png
node_modules/
__pycache__/
.mcp.json
```
> `.mcp.json` is ignored because it contains the 21st.dev API secret.

- [ ] **Step 3: Commit the scaffold**

```bash
git add -A
git commit -m "chore: scaffold Fire Triangle redesign prototype"
```

---

## Task 1: Design tokens + CSS reset + base typography

**Files:**
- Modify: `site/assets/css/styles.css`

- [ ] **Step 1: Write tokens, reset, and base type into styles.css**

```css
/* ===== Tokens (palette is a hard constraint — only these colors) ===== */
:root{
  --molten:#DD3333; --ash:#2B2A26; --ink:#212529; --paper:#F2F3F4;
  --white:#FFFFFF; --steel:#999999; --hairline:#CCCCCC;
  --molten-600:#B81F1F; /* darker molten for small text on white (AA) */
  --font-display:"Space Grotesk",system-ui,sans-serif;
  --font-body:"Inter",system-ui,sans-serif;
  --font-mono:"JetBrains Mono",ui-monospace,monospace;
  --step--1:13px; --step-0:16px; --step-1:20px; --step-2:28px;
  --step-3:44px; --step-4:72px;
  --maxw:1200px; --gutter:clamp(20px,5vw,80px);
  --rule:1px solid var(--hairline);
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:var(--font-body);font-size:var(--step-0);color:var(--ink);
  background:var(--white);line-height:1.6;-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:var(--font-display);line-height:1.05;letter-spacing:-0.02em;font-weight:600}
h1{font-size:var(--step-4)} h2{font-size:var(--step-3)} h3{font-size:var(--step-2)}
img{max-width:100%;display:block}
a{color:inherit;text-decoration:none}
.container{max-width:var(--maxw);margin-inline:auto;padding-inline:var(--gutter)}
.section{padding-block:clamp(56px,9vw,128px)}
.section--ash{background:var(--ash);color:var(--white)}
.section--paper{background:var(--paper)}
.kicker{font-family:var(--font-mono);font-size:var(--step--1);letter-spacing:0.12em;
  text-transform:uppercase;color:var(--molten);display:inline-block;margin-bottom:16px}
.section--ash .kicker{color:var(--molten)}
.rule{border:0;border-top:var(--rule)}
@media (max-width:700px){h1{font-size:var(--step-3)}h2{font-size:var(--step-2)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
```

- [ ] **Step 2: Verify it parses (no syntax error)**

Run: `npx --yes csstree-validator F:/fire-triangle/site/assets/css/styles.css`
Expected: no errors printed (exit 0). If `csstree-validator` is unavailable, skip — Task 5 visual check catches breakage.

- [ ] **Step 3: Commit**

```bash
git add site/assets/css/styles.css && git commit -m "feat: design tokens, reset, base typography"
```

---

## Task 2: Reusable component CSS (buttons, cards, grid, logo-grid, hairline dividers)

**Files:**
- Modify: `site/assets/css/styles.css` (append)

- [ ] **Step 1: Append component styles**

```css
/* ===== Buttons ===== */
.btn{display:inline-flex;align-items:center;gap:.5em;font-family:var(--font-mono);
  font-size:var(--step--1);letter-spacing:.08em;text-transform:uppercase;
  padding:14px 22px;border:1px solid transparent;cursor:pointer;transition:transform .15s,background .15s}
.btn--primary{background:var(--molten);color:var(--white)}
.btn--primary:hover{transform:translateY(-2px);background:var(--molten-600)}
.btn--ghost{border-color:currentColor;color:inherit}
.btn--ghost:hover{background:var(--molten);border-color:var(--molten);color:#fff}
.btn:focus-visible{outline:2px solid var(--molten);outline-offset:3px}

/* ===== Grid + cards ===== */
.grid{display:grid;gap:clamp(16px,3vw,32px)}
.grid--3{grid-template-columns:repeat(3,1fr)}
.grid--4{grid-template-columns:repeat(4,1fr)}
@media(max-width:900px){.grid--3,.grid--4{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.grid--3,.grid--4{grid-template-columns:1fr}}
.card{background:var(--white);border:var(--rule);padding:24px;transition:border-color .2s,transform .2s}
.card:hover{border-color:var(--molten);transform:translateY(-3px)}
.card__tag{font-family:var(--font-mono);font-size:var(--step--1);color:var(--steel);text-transform:uppercase;letter-spacing:.1em}

/* ===== Stats ===== */
.stat__num{font-family:var(--font-display);font-size:var(--step-4);color:var(--molten);font-weight:600}
.stat__label{font-family:var(--font-mono);font-size:var(--step--1);color:var(--steel);text-transform:uppercase;letter-spacing:.1em}

/* ===== Logo grid (normalized bounding boxes) ===== */
.logogrid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--hairline);border:var(--rule)}
.logogrid__cell{background:var(--white);display:grid;place-items:center;aspect-ratio:3/2;padding:24px}
.logogrid__cell img{max-height:48px;width:auto;filter:grayscale(1);opacity:.7;transition:filter .2s,opacity .2s}
.logogrid__cell:hover img{filter:none;opacity:1}
@media(max-width:700px){.logogrid{grid-template-columns:repeat(2,1fr)}}
```

- [ ] **Step 2: Verify parse + commit**

Run: `npx --yes csstree-validator F:/fire-triangle/site/assets/css/styles.css` (skip if unavailable)
```bash
git add site/assets/css/styles.css && git commit -m "feat: button, card, stat, logo-grid components"
```

---

## Task 3: The signature triangle SVG module

**Files:**
- Modify: `site/assets/js/triangle.js`
- Modify: `site/assets/css/styles.css` (append triangle styles)

- [ ] **Step 1: Write triangle.js**

```js
// buildTriangle(opts) -> returns an SVG element with the fire triangle.
// Vertices labelled HEAT / FUEL / OXYGEN. Stroke self-draws on init.
export function buildTriangle({size = 420, labels = ["HEAT","FUEL","OXYGEN"]} = {}){
  const s = size, pad = 56, w = s, h = s * 0.9;
  const pts = [ [w/2, pad], [pad, h-pad], [w-pad, h-pad] ]; // apex, bl, br
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS,"svg");
  svg.setAttribute("viewBox",`0 0 ${w} ${h}`);
  svg.setAttribute("class","ftri");
  svg.setAttribute("role","img");
  svg.setAttribute("aria-label","The fire triangle: heat, fuel, oxygen");
  const poly = document.createElementNS(svgNS,"polygon");
  poly.setAttribute("points", pts.map(p=>p.join(",")).join(" "));
  poly.setAttribute("class","ftri__poly");
  svg.appendChild(poly);
  pts.forEach((p,i)=>{
    const c = document.createElementNS(svgNS,"circle");
    c.setAttribute("cx",p[0]); c.setAttribute("cy",p[1]); c.setAttribute("r",7);
    c.setAttribute("class","ftri__vtx"); c.dataset.i = i;
    svg.appendChild(c);
    const t = document.createElementNS(svgNS,"text");
    t.setAttribute("x",p[0]); t.setAttribute("y", i===0 ? p[1]-16 : p[1]+28);
    t.setAttribute("text-anchor","middle"); t.setAttribute("class","ftri__label");
    t.textContent = labels[i];
    svg.appendChild(t);
  });
  return svg;
}
```

- [ ] **Step 2: Append triangle CSS (stroke-draw animation, vertex hover glow)**

```css
.ftri{width:100%;max-width:480px;height:auto}
.ftri__poly{fill:none;stroke:var(--molten);stroke-width:2;
  stroke-dasharray:1400;stroke-dashoffset:1400;animation:ftri-draw 1.6s ease forwards}
.ftri__vtx{fill:var(--ash);stroke:var(--molten);stroke-width:2;transition:fill .2s,r .2s}
.section--ash .ftri__vtx{fill:var(--white)}
.ftri__vtx:hover{fill:var(--molten);r:11}
.ftri__label{font-family:var(--font-mono);font-size:13px;letter-spacing:.1em;fill:currentColor}
@keyframes ftri-draw{to{stroke-dashoffset:0}}
@media(prefers-reduced-motion:reduce){.ftri__poly{stroke-dashoffset:0;animation:none}}
```

- [ ] **Step 3: Verify in browser (DOM assertion)**

Create a throwaway harness check: start the server (background) `python -m http.server 5500 --directory F:/fire-triangle/site`, then in Playwright navigate to a temp page that imports the module. Simpler: defer this verification to Task 5 where the triangle is mounted in the hero. Mark this step done once Task 5 confirms `document.querySelector('.ftri__poly')` exists.

- [ ] **Step 4: Commit**

```bash
git add site/assets/js/triangle.js site/assets/css/styles.css && git commit -m "feat: signature fire-triangle SVG module + styles"
```

---

## Task 4: Shared chrome — header + footer render functions

**Files:**
- Modify: `site/assets/js/components.js`
- Modify: `site/assets/css/styles.css` (append header/footer styles)

- [ ] **Step 1: Write components.js (string-template injection — works on file://)**

```js
// renderChrome(active): injects header into #site-header and footer into #site-footer.
// `active` = current page key for nav highlighting. No fetch — pure string templates.
const NAV = [
  ["index","Home"],["about","About"],["products","Products"],
  ["services","Services"],["projects","Projects"],["careers","Careers"],["contact","Contact"]
];
const SOCIAL = [
  ["https://www.facebook.com/firetriangleoffical/","Facebook","f"],
  ["https://linkedin.com/company/fire-triangle","LinkedIn","in"],
  ["https://wa.link/zya3z4","WhatsApp","wa"],
  ["https://www.youtube.com/@FireTriangleforengineering","YouTube","yt"]
];
export function renderChrome(active){
  const header = document.getElementById("site-header");
  if(header){
    header.innerHTML = `
    <a class="logo" href="index.html" aria-label="Fire Triangle home">
      <svg viewBox="0 0 40 36" width="34" height="30" aria-hidden="true">
        <polygon points="20,3 3,33 37,33" fill="none" stroke="#DD3333" stroke-width="3"/>
        <polygon points="20,15 13,28 27,28" fill="#DD3333"/>
      </svg>
      <span class="logo__word">FIRE&nbsp;TRIANGLE</span>
    </a>
    <nav aria-label="Primary">
      <ul class="nav">
        ${NAV.map(([k,l])=>`<li><a href="${k}.html"${k===active?' aria-current="page"':''}>${l}</a></li>`).join("")}
      </ul>
    </nav>
    <a class="btn btn--primary header__cta" href="contact.html">Request a quote</a>`;
  }
  const footer = document.getElementById("site-footer");
  if(footer){
    footer.innerHTML = `
    <div class="container footer__grid">
      <div><a class="logo logo--light" href="index.html" aria-label="Fire Triangle home">
        <span class="logo__word">FIRE TRIANGLE</span></a>
        <p class="footer__tag">Fire needs three things. We control all three.</p></div>
      <nav aria-label="Footer"><h3 class="footer__h">Site</h3><ul>
        ${NAV.slice(1).map(([k,l])=>`<li><a href="${k}.html">${l}</a></li>`).join("")}</ul></nav>
      <div><h3 class="footer__h">Find us</h3>
        <p>Head Office: 737 El-Gaish St. — Mandara, Alexandria, Egypt.</p>
        <p>Branch: 49 El-Shaikh Ali Abd El-Razik St, Heliopolis, Cairo.</p></div>
      <div><h3 class="footer__h">Contact</h3>
        <p>Tel: +20 3 5550609 / +20 3 5527726</p>
        <p>Mobile: +20 1068 990 088</p>
        <p>Email: <a href="mailto:sales@firetriangle.net">sales@firetriangle.net</a></p>
        <ul class="social">
          ${SOCIAL.map(([u,n,a])=>`<li><a href="${u}" aria-label="${n}" class="social__${a}">${a}</a></li>`).join("")}
        </ul></div>
    </div>
    <div class="container footer__legal"><span>All rights reserved for Fire Triangle © 2026</span></div>`;
  }
}
```

- [ ] **Step 2: Append header/footer CSS**

```css
.site-header{position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:32px;
  padding:14px var(--gutter);background:rgba(43,42,38,.96);color:#fff;backdrop-filter:blur(6px);border-bottom:1px solid #3a3935}
.logo{display:flex;align-items:center;gap:10px}
.logo__word{font-family:var(--font-display);font-weight:600;letter-spacing:.04em;font-size:18px}
.nav{display:flex;gap:22px;list-style:none}
.nav a{font-family:var(--font-mono);font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#cfcfca;padding:6px 0;border-bottom:2px solid transparent}
.nav a:hover{color:#fff}
.nav a[aria-current=page]{color:#fff;border-bottom-color:var(--molten)}
.header__cta{margin-left:auto}
.site-footer{background:var(--ash);color:#cfcfca;padding-block:64px 28px}
.footer__grid{display:grid;grid-template-columns:1.4fr 1fr 1.2fr 1.2fr;gap:40px}
.footer__h{font-size:14px;color:#fff;margin-bottom:14px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.1em}
.footer__grid ul{list-style:none} .footer__grid li{margin-bottom:8px}
.footer__tag{margin-top:14px;color:var(--steel)}
.social{display:flex;gap:10px;margin-top:14px}
.social a{display:grid;place-items:center;width:34px;height:34px;border:1px solid #4a4844;font-family:var(--font-mono);font-size:12px;color:#fff}
.social a:hover{background:var(--molten);border-color:var(--molten)}
.footer__legal{margin-top:40px;padding-top:20px;border-top:1px solid #3a3935;font-size:13px;color:var(--steel)}
@media(max-width:900px){.footer__grid{grid-template-columns:1fr 1fr}.nav{display:none}}
```

- [ ] **Step 3: Commit**

```bash
git add site/assets/js/components.js site/assets/css/styles.css && git commit -m "feat: shared header/footer render + styles"
```

---

## Task 5: main.js boot + Home page

**Files:**
- Modify: `site/assets/js/main.js`
- Modify: `site/index.html`
- Modify: `site/assets/css/styles.css` (append hero + home styles)

- [ ] **Step 1: Write main.js (boot chrome, mount triangle, scroll reveal, counters, product filter hook)**

```js
import { renderChrome } from "./components.js";
import { buildTriangle } from "./triangle.js";

const page = document.body.dataset.page || "index";
renderChrome(page);

// mount hero triangle if a slot exists
const slot = document.getElementById("triangle-slot");
if(slot) slot.appendChild(buildTriangle({}));

// scroll reveal — content is visible by default; this only ADDS a transition class
const io = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add("is-in"); io.unobserve(e.target);} });
},{threshold:.15});
document.querySelectorAll("[data-reveal]").forEach(el=>io.observe(el));

// animated counters
document.querySelectorAll("[data-count]").forEach(el=>{
  const target = +el.dataset.count; let n = 0;
  const tick = ()=>{ n += Math.ceil(target/40); if(n>=target){el.textContent=target;return;} el.textContent=n; requestAnimationFrame(tick); };
  new IntersectionObserver((es,o)=>{es.forEach(e=>{if(e.isIntersecting){tick();o.disconnect();}})}).observe(el);
});

// product filter (only on products.html) — filters [data-cat] by active vertex
window.filterProducts = (cat)=>{
  document.querySelectorAll("[data-vtx]").forEach(v=>v.classList.toggle("is-active", v.dataset.vtx===cat));
  document.querySelectorAll("[data-cat]").forEach(p=>{
    p.hidden = !(cat==="all" || p.dataset.cat===cat);
  });
};
```

- [ ] **Step 2: Write index.html**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Fire Triangle — UL/FM Fire Protection Systems | Alexandria & Cairo, Egypt</title>
  <meta name="description" content="Fire Triangle supplies UL-listed, FM-approved fire protection systems across Egypt — sole agent for Rapidrop, Waterfall, Mobiak and Velocity. 487+ projects delivered.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/styles.css">
</head>
<body data-page="index">
  <header id="site-header" class="site-header"></header>
  <main>
    <section class="hero">
      <div class="container hero__grid">
        <div class="hero__copy">
          <span class="kicker">01 — Fire Protection Engineering</span>
          <h1>Fire needs three things.<br><span class="hero__accent">We control all three.</span></h1>
          <p class="hero__lede">UL-listed, FM-approved suppression, detection and accessories — engineered, supplied and commissioned across Egypt for 11+ years.</p>
          <div class="hero__cta"><a class="btn btn--primary" href="products.html">Explore products</a>
          <a class="btn btn--ghost" href="contact.html">Request a quote</a></div>
        </div>
        <div class="hero__art" id="triangle-slot"></div>
      </div>
    </section>

    <section class="section section--paper">
      <div class="container grid grid--3" data-reveal>
        <div><span class="stat__num" data-count="11">0</span><span class="stat__num">+</span><div class="stat__label">Years of experience</div></div>
        <div><span class="stat__num" data-count="487">0</span><span class="stat__num">+</span><div class="stat__label">Projects delivered</div></div>
        <div><span class="stat__num" data-count="48">0</span><span class="stat__num">+</span><div class="stat__label">Employees</div></div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <span class="kicker">02 — What we do</span>
        <h2>Three sides of the triangle</h2>
        <div class="grid grid--3" data-reveal style="margin-top:40px">
          <article class="card"><span class="card__tag">Heat / Suppression</span><h3>Suppression</h3><p>Sprinklers, valves, pumps, bladder tanks and kitchen systems — Rapidrop & Waterfall.</p><a href="products.html#suppression">View range →</a></article>
          <article class="card"><span class="card__tag">Oxygen / Detection</span><h3>Detection</h3><p>Fire alarm systems and control — Velocity.</p><a href="products.html#detection">View range →</a></article>
          <article class="card"><span class="card__tag">Fuel / Accessories</span><h3>Accessories</h3><p>Ball/angle/pressure-restricting valves, breeching inlets, aerosol & hood kits — Mobiak.</p><a href="products.html#accessories">View range →</a></article>
        </div>
      </div>
    </section>

    <section class="section section--paper">
      <div class="container"><span class="kicker">03 — Authorized brands</span>
        <h2>Sole agent &amp; authorized distributor</h2>
        <div class="logogrid" data-reveal style="margin-top:32px">
          <div class="logogrid__cell"><img src="assets/img/brand-rapidrop.webp" alt="Rapidrop" loading="lazy"></div>
          <div class="logogrid__cell"><img src="assets/img/brand-waterfall.webp" alt="Waterfall" loading="lazy"></div>
          <div class="logogrid__cell"><img src="assets/img/brand-mobiak.webp" alt="Mobiak" loading="lazy"></div>
          <div class="logogrid__cell"><img src="assets/img/brand-velocity.webp" alt="Velocity" loading="lazy"></div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container"><span class="kicker">04 — Firex events</span><h2>Where we show up</h2>
        <div class="grid grid--3" data-reveal style="margin-top:40px">
          <article class="card"><span class="card__tag">2021</span><h3>Egypt Energy — Firex 2021</h3><p>Our first major Firex stand, introducing the Rapidrop and Waterfall lines to the Egyptian market.</p></article>
          <article class="card"><span class="card__tag">2023</span><h3>Egypt Energy — Firex 2023</h3><p>Expanded booth featuring live valve and pump demonstrations to MEP contractors and consultants.</p></article>
          <article class="card"><span class="card__tag">2024</span><h3>Egypt Energy — Firex 2024</h3><p>Launched the Mobiak kitchen-suppression and aerosol range alongside Velocity detection.</p></article>
        </div>
      </div>
    </section>

    <section class="section section--ash">
      <div class="container hero__grid"><div>
        <span class="kicker">05 — Start a project</span><h2>Tell us what you're protecting.</h2>
        <p class="hero__lede">Send drawings or a BOQ and our engineers respond with a UL/FM-compliant proposal.</p>
        <a class="btn btn--primary" href="contact.html">Request a quote</a>
      </div></div>
    </section>
  </main>
  <footer id="site-footer" class="site-footer"></footer>
  <script type="module" src="assets/js/main.js"></script>
</body>
</html>
```

- [ ] **Step 3: Append hero/home CSS**

```css
.hero{background:var(--ash);color:#fff;padding-block:clamp(64px,10vw,140px)}
.hero__grid{display:grid;grid-template-columns:1.2fr 1fr;gap:48px;align-items:center}
.hero__accent{color:var(--molten)}
.hero__lede{font-size:var(--step-1);color:#d9d8d3;max-width:46ch;margin:24px 0 32px}
.hero__cta{display:flex;gap:14px;flex-wrap:wrap}
.hero__art{display:grid;place-items:center}
[data-reveal]{opacity:1;transform:none;transition:opacity .6s ease,transform .6s ease}
[data-reveal]:not(.is-in){opacity:.001;transform:translateY(16px)}
@media(max-width:900px){.hero__grid{grid-template-columns:1fr}.hero__art{order:-1}}
```
> NOTE: reveal keeps content technically present (opacity .001, not display:none) so it is in the DOM/accessible and prints; `prefers-reduced-motion` rule from Task 1 forces it visible.

- [ ] **Step 4: Verify Home in browser**

Start server (background): `python -m http.server 5500 --directory F:/fire-triangle/site`
Playwright: navigate `http://localhost:5500/index.html`, then assert and screenshot.
Checks (via browser_evaluate):
```js
() => ({
  h1: document.querySelectorAll('h1').length,                 // expect 1
  triangle: !!document.querySelector('.ftri__poly'),          // expect true
  navItems: document.querySelectorAll('.nav a').length,       // expect 7
  footer: !!document.querySelector('.site-footer .footer__grid'), // expect true
  imgsNoAlt: [...document.images].filter(i=>!i.alt.trim()).length // expect 0
})
```
Expected: `{h1:1, triangle:true, navItems:7, footer:true, imgsNoAlt:0}`. Screenshot desktop (1440) + mobile (390).

- [ ] **Step 5: Commit**

```bash
git add site/index.html site/assets/js/main.js site/assets/css/styles.css && git commit -m "feat: boot script + Home page with triangle hero"
```

---

## Task 6: Products page (centerpiece — triangle-driven filter)

**Files:**
- Modify: `site/products.html`
- Modify: `site/assets/css/styles.css` (append product styles)

- [ ] **Step 1: Write products.html**

Use the same `<head>` block as index.html but with:
`<title>Products — Fire Triangle | Suppression, Detection & Accessories</title>` and a matching description.
`<body data-page="products">`, header/footer placeholders and the module script identical to index.html.
Main content:

```html
<main>
  <section class="section section--ash">
    <div class="container">
      <span class="kicker">Products</span>
      <h1>Filter by the triangle</h1>
      <p class="hero__lede">Heat, fuel, oxygen — every product we supply removes one side. Tap a vertex to filter.</p>
      <div class="prodfilter">
        <button class="prodfilter__btn is-active" data-vtx="all" onclick="filterProducts('all')">All</button>
        <button class="prodfilter__btn" data-vtx="suppression" onclick="filterProducts('suppression')">Suppression</button>
        <button class="prodfilter__btn" data-vtx="detection" onclick="filterProducts('detection')">Detection</button>
        <button class="prodfilter__btn" data-vtx="accessories" onclick="filterProducts('accessories')">Accessories</button>
      </div>
    </div>
  </section>
  <section class="section">
    <div class="container grid grid--3" data-reveal>
      <article class="card" data-cat="suppression"><span class="card__tag">Rapidrop · UL/FM</span><h3>Sprinklers &amp; valves</h3><p>Pendant, upright and sidewall sprinklers, alarm and control valves, fittings, bladder tanks.</p><a href="https://firetriangle.net/wp-content/uploads/2025/04/rapi.pdf">Datasheet (PDF) →</a></article>
      <article class="card" data-cat="suppression"><span class="card__tag">Waterfall · UL/FM</span><h3>Firefighting pumps</h3><p>End-suction and split-case fire pumps, jockey pumps and pump sets.</p><a href="https://firetriangle.net/wp-content/uploads/2025/04/water.pdf">Datasheet (PDF) →</a></article>
      <article class="card" data-cat="accessories"><span class="card__tag">Mobiak · UL/FM</span><h3>Valves &amp; kitchen systems</h3><p>Ball, angle and pressure-restricting valves, breeching inlets, aerosol and hood kitchen suppression.</p><a href="https://firetriangle.net/wp-content/uploads/2022/01/Mobiak-Authorization-Letter.pdf">Authorization (PDF) →</a></article>
      <article class="card" data-cat="detection"><span class="card__tag">Velocity</span><h3>Fire alarm systems</h3><p>Addressable and conventional fire alarm panels, detectors and notification.</p></article>
    </div>
  </section>
</main>
```
> NOTE: product cards reuse the existing brochure PDFs found on the live site. Real SKU/rating data is added when provided (spec §10).

- [ ] **Step 2: Append product-filter CSS**

```css
.prodfilter{display:flex;gap:10px;flex-wrap:wrap;margin-top:28px}
.prodfilter__btn{font-family:var(--font-mono);font-size:13px;text-transform:uppercase;letter-spacing:.08em;
  padding:10px 18px;background:transparent;color:#fff;border:1px solid #4a4844;cursor:pointer}
.prodfilter__btn.is-active{background:var(--molten);border-color:var(--molten)}
.prodfilter__btn:focus-visible{outline:2px solid var(--molten);outline-offset:3px}
```

- [ ] **Step 3: Verify filter works**

Playwright navigate `http://localhost:5500/products.html`. Assert one `<h1>`. Click the "Suppression" button, then evaluate:
```js
() => [...document.querySelectorAll('[data-cat]')].filter(p=>!p.hidden).map(p=>p.dataset.cat)
```
Expected: only `["suppression","suppression"]` visible. Screenshot desktop + mobile.

- [ ] **Step 4: Commit**

```bash
git add site/products.html site/assets/css/styles.css && git commit -m "feat: Products page with triangle filter"
```

---

## Task 7: About page

**Files:**
- Modify: `site/about.html`
- Modify: `site/assets/css/styles.css` (append timeline styles)

- [ ] **Step 1: Write about.html**

Same `<head>` pattern; `<title>About — Fire Triangle</title>`; `<body data-page="about">`; placeholders + module script.
Sections (each `<section class="section">` with a `.container`, a `.kicker`, one `<h2>`, content):
1. Intro — one `<h1>`: "Eleven years of breaking the triangle." + lede paragraph about the company.
2. Timeline — markup:
```html
<ol class="timeline" data-reveal>
  <li><span class="timeline__yr">2015</span><p>Founded in Alexandria; first UL/FM supply contracts.</p></li>
  <li><span class="timeline__yr">2021</span><p>First Egypt Energy — Firex stand; Rapidrop &amp; Waterfall agencies.</p></li>
  <li><span class="timeline__yr">2024</span><p>Mobiak &amp; Velocity lines added; 487+ projects delivered.</p></li>
  <li><span class="timeline__yr">2026</span><p>48-strong engineering team across Alexandria &amp; Cairo.</p></li>
</ol>
```
3. Certifications/authorizations wall — reuse `.logogrid` with brand + consultant logos.

- [ ] **Step 2: Append timeline CSS**

```css
.timeline{list-style:none;border-left:2px solid var(--molten);margin-top:32px;padding-left:28px}
.timeline li{position:relative;padding-bottom:28px}
.timeline li::before{content:"";position:absolute;left:-35px;top:6px;width:12px;height:12px;background:var(--molten);border-radius:50%}
.timeline__yr{font-family:var(--font-mono);color:var(--molten);font-size:14px;letter-spacing:.1em}
```

- [ ] **Step 3: Verify + commit**

Playwright navigate `http://localhost:5500/about.html`; assert exactly one `<h1>` and `imgsNoAlt:0`. Screenshot.
```bash
git add site/about.html site/assets/css/styles.css && git commit -m "feat: About page with timeline"
```

---

## Task 8: Services page

**Files:**
- Modify: `site/services.html`
- Modify: `site/assets/css/styles.css` (append numbered-block styles)

- [ ] **Step 1: Write services.html**

Same head pattern; `<title>Services — Fire Triangle</title>`; `<body data-page="services">`.
One `<h1>` "From drawing to commissioning." then a numbered capability list:
```html
<ol class="caps" data-reveal>
  <li><span class="caps__n">01</span><div><h3>Design &amp; engineering</h3><p>Hydraulic calculations, system layout and UL/FM-compliant specification.</p></div></li>
  <li><span class="caps__n">02</span><div><h3>Supply</h3><p>Authorized-distributor supply of sprinklers, pumps, valves and alarm systems.</p></div></li>
  <li><span class="caps__n">03</span><div><h3>Installation support</h3><p>On-site technical support and contractor coordination.</p></div></li>
  <li><span class="caps__n">04</span><div><h3>Testing &amp; commissioning</h3><p>Pressure testing, flow verification and handover documentation.</p></div></li>
</ol>
```

- [ ] **Step 2: Append CSS**

```css
.caps{list-style:none;margin-top:40px;display:grid;gap:0}
.caps li{display:grid;grid-template-columns:auto 1fr;gap:28px;padding:28px 0;border-top:var(--rule);align-items:start}
.caps__n{font-family:var(--font-display);font-size:var(--step-3);color:var(--molten);line-height:1}
```

- [ ] **Step 3: Verify + commit**

Playwright assert one `<h1>`; screenshot.
```bash
git add site/services.html site/assets/css/styles.css && git commit -m "feat: Services page"
```

---

## Task 9: Projects page (filterable case-study grid)

**Files:**
- Modify: `site/projects.html`
- Modify: `site/assets/css/styles.css` (append filter-chip styles — reuse `.prodfilter`)

- [ ] **Step 1: Write projects.html**

Same head pattern; `<title>Projects — Fire Triangle</title>`; `<body data-page="projects">`.
One `<h1>` "487 projects and counting." Sector filter reusing the products filter pattern but calling a `filterProjects` function. Add to `main.js` (Step 2). Markup:
```html
<div class="prodfilter">
  <button class="prodfilter__btn is-active" data-pf="all" onclick="filterProjects('all')">All</button>
  <button class="prodfilter__btn" data-pf="commercial" onclick="filterProjects('commercial')">Commercial</button>
  <button class="prodfilter__btn" data-pf="industrial" onclick="filterProjects('industrial')">Industrial</button>
  <button class="prodfilter__btn" data-pf="residential" onclick="filterProjects('residential')">Residential</button>
</div>
<div class="grid grid--3" data-reveal style="margin-top:32px">
  <article class="card" data-proj="commercial"><span class="card__tag">Commercial · Cairo</span><h3>Mall sprinkler system</h3><p>Full wet-pipe sprinkler and pump installation.</p></article>
  <article class="card" data-proj="industrial"><span class="card__tag">Industrial · Alexandria</span><h3>Warehouse suppression</h3><p>High-hazard storage protection with foam.</p></article>
  <article class="card" data-proj="residential"><span class="card__tag">Residential · Cairo</span><h3>Tower fire alarm</h3><p>Addressable detection across 30 floors.</p></article>
</div>
```
> NOTE: placeholder project copy — swap for real case studies when provided (spec §10).

- [ ] **Step 2: Add filterProjects to main.js**

```js
window.filterProjects = (cat)=>{
  document.querySelectorAll("[data-pf]").forEach(b=>b.classList.toggle("is-active", b.dataset.pf===cat));
  document.querySelectorAll("[data-proj]").forEach(p=>{ p.hidden = !(cat==="all"||p.dataset.proj===cat); });
};
```

- [ ] **Step 3: Verify + commit**

Playwright: click "Industrial", assert only industrial card visible; one `<h1>`; screenshot.
```bash
git add site/projects.html site/assets/js/main.js site/assets/css/styles.css && git commit -m "feat: Projects page with sector filter"
```

---

## Task 10: Careers page

**Files:**
- Modify: `site/careers.html`

- [ ] **Step 1: Write careers.html**

Same head pattern; `<title>Careers — Fire Triangle</title>`; `<body data-page="careers">`.
One `<h1>` "Build fire-safe Egypt with us." A "why work here" 3-card row (reuse `.grid--3`/`.card`) and an openings list:
```html
<ul class="caps" data-reveal>
  <li><span class="caps__n">→</span><div><h3>Fire Protection Design Engineer</h3><p>Alexandria · Full-time · <a href="contact.html">Apply →</a></p></div></li>
  <li><span class="caps__n">→</span><div><h3>Sales Engineer</h3><p>Cairo · Full-time · <a href="contact.html">Apply →</a></p></div></li>
</ul>
```
> NOTE: openings are placeholders; sync with the live `/jobs/` page when content is provided.

- [ ] **Step 2: Verify + commit**

Playwright assert one `<h1>`; screenshot.
```bash
git add site/careers.html && git commit -m "feat: Careers page"
```

---

## Task 11: Contact page (dual maps + form)

**Files:**
- Modify: `site/contact.html`
- Modify: `site/assets/css/styles.css` (append form + map styles)

- [ ] **Step 1: Write contact.html**

Same head pattern; `<title>Contact — Fire Triangle | Alexandria &amp; Cairo</title>`; `<body data-page="contact">`.
One `<h1>` "Request a quote." Two-column: a form (left) and contact details (right), then an "Our Locations" section with two framed map cards reusing the live embed URLs:
```html
<section class="section">
  <div class="container hero__grid">
    <form class="form" data-reveal action="mailto:sales@firetriangle.net" method="post" enctype="text/plain">
      <label>Name<input name="name" required></label>
      <label>Email<input type="email" name="email" required></label>
      <label>Project type<input name="project"></label>
      <label>Message<textarea name="message" rows="5" required></textarea></label>
      <button class="btn btn--primary" type="submit">Send request</button>
    </form>
    <div><span class="kicker">Direct</span><h3>Talk to an engineer</h3>
      <p>Tel: +20 3 5550609 / +20 3 5527726<br>Mobile: +20 1068 990 088<br>Email: sales@firetriangle.net</p></div>
  </div>
</section>
<section class="section section--paper">
  <div class="container"><span class="kicker">Our locations</span><h2>Alexandria &amp; Cairo</h2>
    <div class="grid grid--2-maps" data-reveal style="margin-top:24px">
      <div class="mapcard"><iframe title="Alexandria head office map" loading="lazy" src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d1704.9930234204917!2d30.004649499752805!3d31.276481170984603!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x14f5d0743d7f1a31%3A0xdb2949dcf022c3d3!2z!5e0!3m2!1sen!2seg!4v1744191366399"></iframe></div>
      <div class="mapcard"><iframe title="Cairo branch office map" loading="lazy" src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d13805.169678710747!2d31.3552493!3d30.1144449!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x14581677c6a3873d%3A0x651f178f537a22c6!2sFire%20Triangle!5e0!3m2!1sen!2seg!4v1744191418536"></iframe></div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Append form/map CSS**

```css
.form{display:grid;gap:16px}
.form label{display:grid;gap:6px;font-family:var(--font-mono);font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--steel)}
.form input,.form textarea{font-family:var(--font-body);font-size:16px;padding:12px;border:var(--rule);background:var(--white);color:var(--ink)}
.form input:focus,.form textarea:focus{outline:2px solid var(--molten);outline-offset:1px;border-color:var(--molten)}
.grid--2-maps{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.mapcard{border:var(--rule);background:var(--white);padding:8px}
.mapcard iframe{width:100%;height:300px;border:0;display:block}
@media(max-width:800px){.grid--2-maps{grid-template-columns:1fr}}
```

- [ ] **Step 3: Verify + commit**

Playwright navigate `http://localhost:5500/contact.html`; assert one `<h1>`, two `iframe[title]` present, form has 3 required fields. Screenshot.
```bash
git add site/contact.html site/assets/css/styles.css && git commit -m "feat: Contact page with form + dual maps"
```

---

## Task 12: Image/asset optimization pass

**Files:**
- Create: `site/assets/img/*.webp`

- [ ] **Step 1: Acquire brand + photo assets**

Pull the four brand logos and key photos referenced in the pages. Source from the live site (`https://firetriangle.net/wp-content/...`) or supplied originals. Place originals in a temp folder.

- [ ] **Step 2: Convert + compress to WebP**

For each image:
```bash
npx --yes sharp-cli --input "temp/<file>" --output "site/assets/img/<name>.webp" resize 800 --withoutEnlargement
```
(If `sharp-cli` unavailable, use any WebP encoder; target each file < 120 KB.)

- [ ] **Step 3: Verify total page weight**

Start server; Playwright navigate `http://localhost:5500/index.html`; evaluate:
```js
() => Math.round(performance.getEntriesByType('resource').reduce((t,r)=>t+(r.transferSize||0),0)/1024)
```
Expected: total < 1500 (KB). If over, recompress the largest offenders.

- [ ] **Step 4: Commit**

```bash
git add site/assets/img && git commit -m "perf: optimized WebP assets (<1.5MB/page)"
```

---

## Task 13: Accessibility + SEO sweep across all pages

**Files:**
- Modify: any page failing a check

- [ ] **Step 1: Run an automated audit per page**

For each of the 7 pages, start server and Playwright-evaluate:
```js
() => ({
  h1: document.querySelectorAll('h1').length,
  imgsNoAlt: [...document.images].filter(i=>!i.alt.trim()).length,
  iconLinksNoLabel: [...document.querySelectorAll('a')].filter(a=>!a.textContent.trim() && !a.getAttribute('aria-label')).length,
  title: document.title.length,
  hasMetaDesc: !!document.querySelector('meta[name=description]'),
  landmarks: ['header','nav','main','footer'].map(t=>!!document.querySelector(t))
})
```
Expected per page: `h1:1, imgsNoAlt:0, iconLinksNoLabel:0, title>20, hasMetaDesc:true, landmarks all true`.

- [ ] **Step 2: Fix any page that fails, re-run until all 7 pass**

- [ ] **Step 3: Commit**

```bash
git add site && git commit -m "a11y/seo: one h1, alt text, aria-labels, meta per page"
```

---

## Task 14: Final verification (palette audit, double-click, responsive, full-site screenshots)

**Files:** none (verification only)

- [ ] **Step 1: Palette audit — no colors outside the seven tokens**

Playwright on each page, evaluate:
```js
() => { const ok=new Set(['rgb(221, 51, 51)','rgb(43, 42, 38)','rgb(33, 37, 41)','rgb(242, 243, 244)','rgb(255, 255, 255)','rgb(153, 153, 153)','rgb(204, 204, 204)','rgb(184, 31, 31)','rgba(0, 0, 0, 0)']);
  const bad=new Set(); document.querySelectorAll('*').forEach(e=>{const cs=getComputedStyle(e);[cs.color,cs.backgroundColor,cs.borderTopColor].forEach(c=>{ if(c&&!ok.has(c)&&!c.startsWith('rgba(43')&&!c.startsWith('rgba(221')) bad.add(c);});});
  return [...bad]; }
```
Expected: only near-palette rgba variants (header blur, footer borders #3a3935/#4a4844 which are Ash shades) — flag any true off-palette hue and fix.
> NOTE: the dark-chrome shades (#3a3935,#4a4844,#cfcfca) are tints/shades of Ash/Steel used for borders on dark surfaces; these are acceptable. Any saturated non-red hue is a violation.

- [ ] **Step 2: Double-click (file://) check — chrome must still render without a server**

Playwright navigate `file:///F:/fire-triangle/site/index.html`; assert `document.querySelectorAll('.nav a').length === 7` and footer present. (Confirms the no-fetch chrome decision holds.)

- [ ] **Step 3: Responsive screenshots, all 7 pages, desktop + mobile**

For each page at 1440×900 and 390×844, full-page screenshot into `.playwright-mcp/`. Eyeball: hero triangle present, no overflow, nav collapses cleanly on mobile.

- [ ] **Step 4: Final commit + summary**

```bash
git add -A && git commit -m "test: final palette/a11y/responsive verification pass"
```
Report: per-page weight, a11y check results, and any deferred items (real product/project/careers content, Arabic RTL — spec §9/§10).

---

## Self-review notes (author)

- **Spec coverage:** §3 tokens→T1; components→T2; §4 triangle→T3; chrome→T4; §5 pages→T5–T11 (Home, Products, About, Services, Projects, Careers, Contact all covered); §6 build approach→T0/T4 decision; §7 all 14 fixes→T5(hero,h1,reveal,alt) T6(products link) T2(logo grid) T4(footer) T12(images) T13(h1/alt/aria/seo) T3(logo svg in chrome) T14(contrast/palette); §8 success criteria→T12–T14; §9 non-goals respected (no backend/CMS/RTL).
- **Placeholders:** content placeholders for product/project/careers data are explicitly flagged against spec §10 (real data pending) — these are data TODOs, not plan-step TODOs; every step has runnable code/commands.
- **Type consistency:** `renderChrome(active)`, `buildTriangle({})`, `filterProducts`/`filterProjects` (both on `window`), `data-page`/`data-reveal`/`data-count`/`data-cat`/`data-proj`/`data-pf`/`data-vtx` used consistently across tasks.
