# Admin Global Settings — Single Source of Truth (Design Spec)

**Date:** 2026-06-24
**Branch:** `feat/redesign` (de-facto deploy line)
**Status:** Approved design — ready for implementation plan

## Summary

Make the site's **global/shared content** — contact details, office addresses, footer, social links, nav labels, header wordmark/CTA — editable from the admin panel and have edits reflect **live** on every page, the footer, and the AI chat bot, with **no redeploy**. Today this content is hardcoded and duplicated in **5 places** (`contact.html`, `careers.html`, `thankyou.html`, the footer/header templates in `main.js`, and the chat `SYSTEM_PROMPT` in `server.js`), so a single phone-number change currently requires 5 edits plus a deploy.

This is **Slice 1** of a larger admin-redesign effort ("make everything editable, live"). It deliberately also lays the **content-store foundation** (a generic `content` table + content API + admin editor pattern + public-page hydration pattern) that later slices (page copy, projects, careers) will reuse.

## Goals

- One editable record drives contact info, offices, social, footer, nav labels, and header across the whole site + the chat bot.
- Edits go live immediately (no redeploy), matching the existing Products → `/api/products` live-reflection pattern.
- A new **Site Settings** admin section with grouped structured forms + a **live preview** pane.
- Zero visual change on first deploy (defaults seeded from current hardcoded values).
- Graceful fallback: if the DB/API is unavailable, pages render today's hardcoded values; pages still open offline via `file://`.

## Non-Goals (this slice)

- Page marketing copy (hero/headlines/stats/services/about) — later slice.
- Projects / careers collections — later slices.
- Editing nav **routes/URLs** or adding/removing pages — only labels + show/hide of the existing 7 pages.
- AI poster background — separate slice.
- User accounts/roles, per-user auth — out of scope (single shared `ADMIN_PASSWORD` retained).
- A page-builder / arbitrary blocks — structured fixed fields only (YAGNI).

## Constraints honored (from existing design docs)

- **No build step, no framework.** Vanilla ES/IIFE; admin modules on `window.FTAdmin`; server adds **no new runtime deps** beyond `express` + `pg`; tests use `node:test`; front-end verified via Playwright.
- **Brand discipline.** Only the 7 palette tokens (`--molten #DD3333` accent + `--molten-600 #B81F1F` for AA small text, `--ash/--ink/--paper/--white/--steel/--hairline`) and 3 fonts (Space Grotesk / Inter / JetBrains Mono). WCAG AA.
- **Auth.** Every write stays behind `adminOk` (Bearer `ADMIN_PASSWORD`, constant-time compare). Reads are public.
- **Deploy.** Public repo, secret-free; ship via `railway redeploy --from-source` (no push auto-deploy; `railway up` is unusable on this uplink).
- **`file://` rule.** Pages must still render by double-click with no server — so hardcoded chrome text stays as the in-JS default and is only *overridden* by fetched content when served.

## Architecture

### 1. Storage — generic `content` table

```sql
CREATE TABLE IF NOT EXISTS content (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- Created in the existing one-time `ensureSchema()` at startup (alongside `images`).
- This slice uses a single row, `key = 'site'`. Later slices add rows (`home`, `about`, `projects`…). Keys are validated against an allowlist (`/^[a-z][a-z0-9_]{0,40}$/`).

### 2. The `site` JSON document (shape)

```jsonc
{
  "contact": {
    "tel1": "+20 3 5550609",
    "tel2": "+20 3 5527726",
    "mobile": "+20 1068 990 088",
    "email": "sales@firetriangle.net",
    "whatsapp": "https://wa.link/zya3z4"
  },
  "offices": {
    "head":   { "label": "Head Office", "address": "737 El-Gaish St. — Mandara, Alexandria, Egypt.", "maps": "https://www.google.com/maps/embed?...alexandria" },
    "branch": { "label": "Branch",      "address": "49 El-Shaikh Ali Abd El-Razik St, Heliopolis, Cairo.", "maps": "https://www.google.com/maps/embed?...cairo" }
  },
  "social": {
    "facebook": "https://facebook.com/firetriangleoffical/",
    "linkedin": "https://linkedin.com/company/fire-triangle",
    "whatsapp": "https://wa.link/zya3z4",
    "youtube":  "https://youtube.com/@FireTriangleforengineering"
  },
  "footer": {
    "tagline": "Fire needs three things. We control all three.",
    "copyright": "All rights reserved for Fire Triangle © 2026"
  },
  "header": {
    "wordmark": "FIRE TRIANGLE",
    "cta_label": "Request a quote",
    "cta_href": "contact.html"
  },
  "nav": [
    { "label": "Home",     "href": "index.html",    "show": true },
    { "label": "About",    "href": "about.html",    "show": true },
    { "label": "Products", "href": "products.html", "show": true },
    { "label": "Services", "href": "services.html", "show": true },
    { "label": "Projects", "href": "projects.html", "show": true },
    { "label": "Careers",  "href": "careers.html",  "show": true },
    { "label": "Contact",  "href": "contact.html",  "show": true }
  ]
}
```

Defaults are seeded verbatim from today's hardcoded values, so the first deploy is visually identical.

### 3. New module: `lib/content.js` (pure, unit-tested)

- `SITE_DEFAULTS` — the canonical default `site` document above (single source for both server fallback and seeding).
- `validateSite(input)` → `{ ok, value } | { ok:false, error }`:
  - Deep-merges `input` over `SITE_DEFAULTS` (unknown keys dropped; missing keys filled from defaults — partial saves are safe).
  - Trims + length-caps every string (e.g. labels ≤ 60, addresses ≤ 200, tagline ≤ 160, urls ≤ 300).
  - Light format checks: `email` matches a basic email shape; social/whatsapp/cta_href/maps must be `http(s)://…` or a same-site `*.html` path (nav `href` is **not** taken from input — it's pinned to the fixed route by index; only `label` + `show` are editable).
  - `nav` is normalized to exactly the 7 known routes in fixed order; only `label` and `show` are applied from input.
- `mergeDefaults(stored)` — used on read to fill any gaps if the stored doc predates a new field.

Keeping all validation/merge/default logic here (not in `server.js`) makes it testable with `node:test` and keeps the route thin.

### 4. Server (`server.js`)

- **In-process cache** `let siteCache = null;` Read-through: `GET` serves `siteCache` if set; else loads from DB (or `SITE_DEFAULTS`), caches, returns. `PUT` writes the DB row then sets `siteCache` to the new value. **Net: public page views hit memory, not Postgres** — avoids adding per-view DB load to the existing client-per-request model.
- **`GET /api/content/:key`** (public): allowlisted key; for `site` returns `mergeDefaults(stored ?? SITE_DEFAULTS)`. Always `200` (never blank). `Cache-Control: no-cache` (content must be fresh after edits) — cheap because it's served from memory.
- **`PUT /api/admin/content/:key`** (gated): `adminOk` → `503` if no `DATABASE_URL` → `validateSite` (`400` on invalid) → `INSERT … ON CONFLICT (key) DO UPDATE SET value=…, updated_at=now()` → refresh cache → return `{ ok:true, value }`. JSON body limit stays at the default 32 kb (the `site` doc is small) — no need to widen the body-limit skip-list.
- **Chat prompt** built from settings: extract the hardcoded contact/office/company facts out of `SYSTEM_PROMPT` and compose them from the cached `site` doc at request time (e.g. `buildSystemPrompt(site)`), so the bot's contact details track edits. Static product/brand knowledge unaffected this slice.

### 5. Public site delivery (override-defaults pattern)

- New tiny helper `site/assets/js/site-content.js` (or a function inside `main.js`): `loadSite()` → `fetch('/api/content/site')`, resolves to the doc, or **rejects/returns null offline** (so defaults stand). One fetch per page load; served from server memory, so cheap.
- `main.js` keeps its current `NAV`, `SOCIAL`, and header/footer string templates as **defaults**, renders chrome immediately (no flash, offline-safe), then on `loadSite()` success re-renders header + footer with the fetched values (labels/visibility, wordmark, CTA, tagline, copyright, social, footer contact).
- `contact.html`, `careers.html`, `thankyou.html`: the existing contact text stays in the HTML as default content; add stable hooks (`data-site="contact.email"`, `data-site="offices.head.address"`, etc.) that `site-content.js` fills from the fetched doc when present. Google Maps `<iframe>` `src` updated from `offices.*.maps` when present.
- All injected values are escaped on render (reuse `esc()` pattern; never `innerHTML` raw user content for text).

### 6. Admin UI (`site/assets/js/admin-settings.js` + shell wiring)

- New sidebar nav button `data-section="settings"` ("Site Settings") + an empty `<section id="panel-settings">` in `admin.html`; registered via `FTAdmin.onSection("settings", render)`.
- Two-column layout (reusing `.poster__wrap` style): left = grouped forms (**Contact · Offices · Social · Footer · Header · Nav**); right = **live preview** that renders the real footer + a contact card + the nav, re-painting on every input.
- Loads current values via `A.api('/api/content/site')`; **Save** → `A.api('/api/content/site', { method:'PUT', body: … })` → toast + cache the returned value. Logo/wordmark area can use the existing `A.media.pick()` if an image is involved (wordmark is text this slice; logo image swap deferred).
- Styling: reuse `.dash*`, `.form`, `.btn`, brand tokens; responsive collapse consistent with other panels.

## Data flow

```
Admin edits form → PUT /api/admin/content/site (validateSite) → content row upserted
                                                              → siteCache refreshed
Public page load → main.js renders defaults → fetch /api/content/site (from cache)
                 → re-render header/footer + fill data-site hooks
Chat request    → buildSystemPrompt(siteCache) → bot answers with current contact facts
```

## Error handling

| Condition | Behavior |
|---|---|
| No `DATABASE_URL` (GET) | Return `SITE_DEFAULTS` (200) |
| No `DATABASE_URL` (PUT) | `503 {error:"Database not connected."}` |
| Not authed (PUT) | `401 {error:"Unauthorized"}` |
| Invalid/oversized fields (PUT) | `400 {error:<field message>}` (validateSite) |
| Unknown `:key` | `400 {error:"Unknown content key"}` |
| Fetch fails on public page | Keep in-JS defaults (no visible failure) |
| DB read error (GET) | Log, return `SITE_DEFAULTS` (200) |

## Testing

**Unit (`test/content.test.js`, `node:test`):**
- `validateSite`: caps lengths; trims; rejects bad email/url; drops unknown keys; partial input merges over defaults; nav normalized to 7 fixed routes with only label/show applied (href cannot be overridden).
- `mergeDefaults`: stored doc missing a new field gets it filled.
- `buildSystemPrompt(site)`: includes the edited contact/office values.

**Browser (Playwright, against a local server with DB or a stubbed store):**
- Admin → Site Settings → change email + tagline → Save → load `contact.html` and a second page → both show new values; footer shows new tagline/email.
- Nav: hide a page → it disappears from the header nav.
- Fallback: with the API blocked, public pages still render the default chrome (no blank footer).

**Manual/live:** after deploy, edit a field in the live admin, confirm it reflects on the public site and in the chat bot's answer; confirm offline `file://` open still renders.

## Files

- **Create:** `lib/content.js`, `test/content.test.js`, `site/assets/js/admin-settings.js`, `site/assets/js/site-content.js`
- **Modify:** `server.js` (schema `content` table, cache, two routes, `buildSystemPrompt`), `site/assets/js/main.js` (override defaults from fetched doc), `site/admin.html` (nav button + panel), `site/assets/css/styles.css` (settings panel styles), `site/contact.html` / `site/careers.html` / `site/thankyou.html` (add `data-site` hooks, keep text as defaults)

## Risks & mitigations

- **Added DB load per page view** → mitigated by the in-process `siteCache` (read from memory; DB touched only on save). `pg.Pool` remains a separate, now-less-urgent backlog item.
- **SEO of contact text becoming JS-filled** → text remains in the static HTML as the default, so it's still in the initial markup; JS only overrides. No regression.
- **`file://` offline open** → preserved by keeping defaults in JS and treating fetch as override-only.
- **Stale cache across instances** → single Railway instance today; cache-bust on PUT is sufficient. If multi-instance later, add a short TTL.
- **Scope creep into page copy** → explicitly deferred; this slice ships the foundation + global settings only.

## Foundation reused by later slices

`content` table + `GET /api/content/:key` + `PUT /api/admin/content/:key` + `lib/content.js` validation pattern + the admin "structured form + live preview" section pattern + the "render defaults then override from fetch" public-page pattern. Page-copy and projects slices add new keys/tables and new admin sections on top of exactly this.
