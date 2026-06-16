# Fire Triangle — Website Redesign Design Spec

- **Date:** 2026-06-17
- **Concept:** A — "The Triangle is the System"
- **Scope:** Full site (7 pages)
- **Output:** Standalone prototype (semantic HTML + one CSS file + vanilla JS, no build step, no WordPress)
- **Direction:** Premium & engineered
- **Palette constraint:** Reuse the EXACT existing site palette (no new hues)

---

## 1. Goal

Replace the current generic Elementor build for firetriangle.net with a distinctive,
memorable, premium-engineered website whose structure embodies the brand idea — the fire
triangle (heat · fuel · oxygen). The redesign must fix every issue found in the audit
*by construction*, keep the company's real trust assets, and reuse the existing color
palette exactly.

**One-line positioning:** *Fire needs three things. We control all three.*

## 2. Audience

B2B — fire-protection buyers in Egypt and the region: MEP contractors, consulting
engineers, facility owners, procurement. They value demonstrable competence (UL/FM
listings, authorized-distributor status, real projects) over decoration. The design must
read as credible and technical first, beautiful second.

## 3. Design system

### 3.1 Color — EXACT existing palette (hard constraint)

| Token   | Value      | Role |
|---------|------------|------|
| Molten  | `#DD3333`  | Single accent: CTAs, the triangle, active states, hairline highlights. Reserved — never floods a full band of body text. |
| Ash     | `#2B2A26`  | Dark section backgrounds, footer. |
| Ink     | `#212529`  | Body text on light surfaces. |
| Paper   | `#F2F3F4`  | Light section backgrounds. |
| White   | `#FFFFFF`  | Cards, elevated surfaces. |
| Steel   | `#999999`  | Captions, mono technical labels, secondary text. |
| Hairline| `#CCCCCC`  | 1px rules, borders, dividers. |

Discipline rules:
- Molten red is an *accent*, not a background field. The old full-width red stats band is
  replaced by Ash/Paper with molten used only on numbers, the triangle, and CTAs.
- Maintain WCAG AA: white text only on Ash/Ink/Molten at >=18px or bold; Ink on Paper/White
  for body. Molten-on-white only for >=18px bold or icons (it fails AA for small text).

### 3.2 Typography

- **Display (headings):** Space Grotesk — geometric, engineered, confident. Tight tracking, oversized.
- **Body:** Inter — neutral, legible.
- **Technical labels:** JetBrains Mono — section kickers (`01 — WHO WE ARE`), spec tags,
  UL/FM badges, triangle vertex labels, figure numbers.
- **Type scale:** 13 / 16 / 20 / 28 / 44 / 72 px (mobile scales down one to two steps).
- Exactly one `<h1>` per page (fixes the audit's 0-h1 problem).

### 3.3 Layout language

- Strict 12-column grid, generous whitespace.
- 1px Steel/Hairline rules separating sections (no heavy color bands).
- Left-aligned oversized headings, each preceded by a small mono kicker.
- Triangular clip-path notches at select section edges instead of flat bands.

### 3.4 Motion (disciplined, enhancement-only)

- Content is visible by default. Motion enhances; it never gates rendering (fixes the
  audit's opacity-gated reveal problem).
- Hero triangle draws in via SVG stroke animation; vertices glow molten on hover.
- Scroll reveals are short fades/draws. `prefers-reduced-motion` disables all motion.
- Visible hover/focus states on every interactive element.

## 4. Signature mechanic — "The Triangle is the System"

The fire triangle (HEAT · FUEL · OXYGEN) is a precise SVG that recurs as the spine of the site:

- **Hero:** the triangle self-draws, vertices labeled; the positioning line anchors to it.
- **Section dividers:** thin triangular clip-path notches.
- **Products taxonomy:** the three vertices map to the three catalog pillars
  (**Suppression / Detection / Accessories**). Activating a vertex filters the product grid.
  The brand metaphor literally becomes the navigation — the memorable idea.
- **Micro-interactions:** vertex hover glow; molten used as the active/selected signal site-wide.

## 5. Pages (full site) & section breakdown

1. **Home**
   - Animated triangle hero + positioning line + primary CTA (Request a quote).
   - Counter stats (11+ yrs / 487 projects / 48 employees) — molten numerals on Paper.
   - "What we do" = the three vertices (Suppression / Detection / Accessories).
   - Authorized brands — normalized logo grid (equal bounding boxes, greyscale→color on hover).
   - Featured projects (3–4 cards).
   - Firex events — UNIQUE copy per event (fixes duplicate-copy issue).
   - Locations + footer (rebalanced 4-column).
2. **Products** *(fixes the dead `#` link — the centerpiece)*
   - Triangle-driven category filter; each product = typeset spec card with UL/FM badge,
     ratings, and datasheet PDF link.
3. **About** — origin story, 11+ yrs / 487 projects on a timeline, team, certifications/authorizations wall.
4. **Services** — engineering / supply / commissioning as numbered capability blocks.
5. **Projects** — filterable case-study grid (sector / client / scope) with optimized real photography.
6. **Careers** — current openings + "why work here" + clean application CTA.
7. **Contact** — both offices, dual maps in framed cards under an "Our Locations" heading, form, WhatsApp.

Global: sticky header with crisp SVG logo + real nav (Products is a real link), inset social
rail that does not overlap content, persistent "Download Brochure" + "Request a quote" CTAs.

## 6. Build approach

- **Stack:** semantic HTML5, one CSS file using custom properties for the tokens above,
  vanilla JS for the triangle SVG + scroll motion. No framework, no build step — opens by
  double-click. Easy to hand to a dev or convert to a WordPress theme later.
- **File structure (proposed):**
  ```
  /index.html  products.html  about.html  services.html  projects.html  careers.html  contact.html
  /assets/css/styles.css
  /assets/js/triangle.js  /assets/js/main.js
  /assets/img/ (optimized WebP)
  /assets/fonts/ (or Google Fonts link)
  ```
- **Tooling:** `frontend-design` skill drives the look; 21st.dev (Magic MCP) supplies complex
  components (nav, spec cards, forms) once connected; Playwright verifies each page visually
  at desktop + mobile; context7 for any library docs.

## 7. Audit issues fixed by construction

| # | Audit issue | Fix in this design |
|---|---|---|
| 1 | Empty hero, no message | Triangle hero with positioning line + CTA |
| 2 | Fragile opacity-gated reveals | Content visible by default; motion enhancement-only |
| 3 | Dead `Products` `#` link | Real Products page = the centerpiece |
| 4 | Duplicate event copy | Unique copy per Firex event |
| 5 | Ragged logo rows | Normalized logo grid |
| 6 | Unbalanced footer | Rebalanced 4-column footer |
| 7 | 12 MB raw images, ~7.4s load | WebP + lazy-load, target < 1.5 MB total |
| 8 | 0 `<h1>` | One `<h1>` per page |
| 9 | 79/84 missing alt text | Alt text on every meaningful image |
| 10 | Empty icon-link names | aria-labels on all icon links |
| 11 | Low-res busy logo | Crisp SVG logo |
| 12 | No mobile art direction | Mobile hero crop + centered overlay; social rail repositioned |
| 13 | Weak SEO (title, semantics) | Descriptive titles/meta, semantic landmarks |
| 14 | Borderline contrast on red bands | Molten used as accent only; AA verified |

## 8. Success criteria

- All 7 pages render with content visible even with JS disabled.
- Lighthouse: Performance >= 85 mobile, Accessibility >= 95, total page weight < 1.5 MB.
- Exactly one `<h1>` per page; every image has alt text; every icon link has an accessible name.
- Palette uses ONLY the seven tokens in §3.1 — no new hues.
- The triangle mechanic is present in hero, dividers, and Products navigation.
- Verified visually via Playwright at 1440px and 390px.

## 9. Non-goals (YAGNI)

- No CMS / WordPress integration in this phase (prototype only).
- No backend for the contact form (front-end markup + mailto/placeholder action; wiring later).
- No multilingual/Arabic RTL in this phase (note: likely a future need given Egypt market — flagged, not built).
- No e-commerce / online ordering.
- No new brand colors, fonts beyond the three specified, or logo redesign beyond producing a clean SVG of the existing mark.

## 10b. Enhancement layer — advanced libraries (added 2026-06-17)

Per user direction, the site uses advanced JS as a **progressive-enhancement layer on top of
the working baseline**. The baseline (semantic HTML + SVG triangle + IntersectionObserver
reveals + count-up) always works with libraries off. When the enhancement layer loads, it
upgrades the experience:

- **Three.js** — a real 3D fire-triangle hero (rotating wireframe + molten ember particle
  system + subtle heat shimmer) rendered into `#triangle-slot`. The 2D SVG triangle is the
  fallback and is hidden only once WebGL initialises successfully.
- **GSAP + ScrollTrigger** — scroll-driven reveals and the stat counters (replaces the raw
  IntersectionObserver path when present).
- **Lenis** — smooth inertial scrolling site-wide.

**Delivery:** CDN + ES module **import maps** (no build step). Each page carries a
`<script type="importmap">` mapping `three`, `gsap`, `gsap/ScrollTrigger`, and `lenis` to
pinned CDN ESM URLs; a single `enhance.js` module imports them and boots the upgrades.

**Discipline rules (still apply):** 3D uses ONLY palette colors (molten wireframe/embers on
ash); motion respects `prefers-reduced-motion` (enhancement is skipped entirely); the page is
fully usable and styled before any library loads, and if a CDN fails the baseline remains.

**Budget impact:** §8's `< 1.5 MB` image budget is unchanged (it governs images). The CDN
libraries (~Three.js 150KB + GSAP 40KB + Lenis 5KB gzipped) load from cache/CDN separately;
hero WebGL must still hit 60fps on a mid-range laptop and degrade to the SVG fallback on
low-power/mobile or when `prefers-reduced-motion` is set.

## 10. Open questions / assumptions

- Product catalog content (SKUs, ratings, datasheets) — assume we reuse existing brochure
  PDFs and the four brand lines (Rapidrop, Waterfall, Mobiak, Velocity) until real data provided.
- The three Products pillars (Suppression / Detection / Accessories) are an assumption; confirm
  against their actual catalog structure during the Products-page build.
