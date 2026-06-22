# Admin Dashboard Overhaul + Poster Maker — Design

Date: 2026-06-23
Status: Approved (design); pending implementation plan
Branch: feat/redesign

## Goal

Turn the existing single-purpose product admin into a real **admin dashboard**
that manages the catalogue and a central **media library**, and adds a
secondary **Poster Maker** that turns a product photo + details into a branded
marketing card (like the "Fire Hose 2.5\"" social post).

Primary focus, per the requester: the **admin dashboard overhaul** (Products +
Media). The Poster Maker is a secondary feature, built last.

## Non-goals (YAGNI)

- Managing projects or page text from the admin (projects/copy stay hardcoded in HTML).
- Automatic background removal on uploaded product photos (user supplies a clean cutout).
- Server-side image compositing or AI image generation for posters.
- Any build step / framework. The site stays vanilla JS, served by `server.js`.

## Current state (baseline)

- `server.js` — Express static server + `/api/chat` proxy + admin API.
  - Products: `GET /api/products`, `POST/PUT/DELETE /api/admin/products[/:id]`
    against a Postgres `products` table (`id, name, brand, category,
    certifications, specs, image`). Falls back to `db/products.json` when no DB.
  - Images: `POST /api/admin/upload` stores bytes in an `images` table
    (`id, mime, bytes, created_at`); `GET /img/:id` serves them.
  - Auth: Bearer `ADMIN_PASSWORD`, constant-time compare (`adminOk`).
- `site/admin.html` + `site/assets/js/admin.js` — one-page password-gated CRUD.
- Brand assets present: `site/assets/img/logo.png` (Fire Triangle),
  `site/assets/img/brand-rapidrop.webp`. No FM-Approved asset (drawn in CSS).
- Palette tokens (`styles.css`): `--molten:#DD3333`, `--molten-600:#B81F1F`,
  `--ash:#2B2A26`, `--ink:#212529`, `--paper:#F2F3F4`, `--white:#FFFFFF`.

## Architecture

Single `admin.html` reworked into a dashboard SPA with a left sidebar. Three
sections swap in place; no page reloads; existing password gate unchanged
(Bearer `ADMIN_PASSWORD` in `sessionStorage`).

`admin.js` is split into focused modules (loaded with `defer`):

- `admin-core.js` — auth/login gate, sidebar nav + section routing, shared
  helpers (`esc`, `authHeaders`, fetch wrappers, toast/message helpers).
- `admin-products.js` — product list/search/filter + add/edit/delete form.
- `admin-media.js` — media library grid + upload/rename/delete + pickers.
- `admin-poster.js` — poster template selection, field form, live preview, export.

Each module exposes a small init function called by `admin-core.js` when its
section first activates. Shared state (the cached product list, the cached
image list) lives in `admin-core.js` and is passed in / re-fetched as needed.

### Section A — Products (polish; no backend change)

Same table and endpoints. UI only:
- Live search box (filters name / brand / specs).
- Category filter chips derived from the product list.
- Card/list with thumbnail + inline Edit / Delete (existing).
- Add/Edit form keeps current fields; the image control gains a **"Pick from
  Media library"** button beside the existing file-upload + URL inputs.
- Keep the db/file source + count indicator.

### Section B — Media library (new)

Add a nullable `label TEXT` column to `images`. New admin-only endpoints in
`server.js`:

| Method | Route | Behaviour |
|---|---|---|
| GET | `/api/admin/images` | returns `[{id, label, mime, size, created_at}]`, newest first, **no bytes**. `size` via `octet_length(bytes)`. |
| PATCH | `/api/admin/images/:id` | body `{label}`; updates label (cleaned, max ~120 chars). |
| DELETE | `/api/admin/images/:id` | deletes one row; id validated `[a-f0-9]{1,32}`. |

All guarded by `adminOk`. The `images` table is created on demand today inside
the upload handler; add a `label` column via `ALTER TABLE ... ADD COLUMN IF NOT
EXISTS` so existing rows survive.

UI:
- Thumbnail grid (uses `/img/:id`), each tile shows label + size + created date.
- Upload (click or drag-drop) via the existing `POST /api/admin/upload`, then
  the new row gets an optional label.
- Rename (PATCH), Copy URL (`/img/:id`), Delete.
- **Delete guard (client-side):** before DELETE, check the cached product list
  for any product whose `image === "/img/<id>"`; if found, warn
  "Used by N product(s) — delete anyway?" so catalogue images aren't orphaned.
- "Use in product" / "Use in poster" buttons hand the `/img/:id` URL to the
  Products form or Poster Maker.

### Section C — Poster Maker (secondary; built last)

Flow: pick template → fill fields → live preview → export PNG (download and/or
save to Media).

- **Template gallery** — ship **one** template reproducing the Fire Hose 2.5"
  card: maroon gradient background (`--molten-600` → dark maroon) with white
  diagonal slashes, Fire Triangle `logo.png` top-left, a badge row top-right
  (CSS-drawn "FM APPROVED" oval + `brand-rapidrop.webp`), large title + size,
  red-triangle ("▶") spec bullets, and a footer with office labels +
  "Contact Us" phones. Structured so a 2nd/3rd template is just another
  HTML/CSS block + field schema object.
- **Fields:** product photo (upload or pick from Media), Title, Subtitle/Size,
  up to ~6 spec bullets, toggleable badges (FM Approved / Rapidrop), and an
  editable contact footer pre-filled with real office + phone details
  (Head office: Alexandria / Branch office: Cairo; phones from the site).
- **Rendering:** the live preview is a real styled HTML node sized to a fixed
  **1080×1080** design box (scaled down to fit on screen via CSS transform).
  Export rasterizes that node to PNG using a vendored `html2canvas`
  (`site/assets/js/vendor/html2canvas.min.js`, same pattern as gsap/three).
- **Export:** "Download PNG" saves locally; "Save to Media" base64-encodes the
  canvas and POSTs to the existing `/api/admin/upload`, so generated posters
  land in the library.

## Data flow

- All admin reads/writes go through `fetch` with `Authorization: Bearer <pw>`.
- Product list and image list are fetched on section activation and cached in
  `admin-core.js`; mutations re-fetch the affected list.
- Poster export is fully client-side except the optional "Save to Media" upload.

## Error handling

- 401 from any admin call → clear `sessionStorage` pw and show the login gate.
- Upload type/size already enforced server-side (jpeg/png/webp/gif, 1 B–5 MB).
- Image DELETE: id format validated server-side; client delete-guard warns on
  referenced images.
- Poster export failure (html2canvas throw / font not loaded) → surface an
  inline error; wait for `document.fonts.ready` before rasterizing.

## Risks / decisions

- **Export fidelity (primary risk):** html2canvas can mis-render gradients,
  transforms, and custom fonts. Mitigation: build the template, export the real
  Fire Hose card, and eyeball fidelity **before** building out the field
  controls. Adjust the template's CSS toward what rasterizes cleanly (e.g.,
  flat layered shapes over complex filters) if needed.
- **Background removal out of scope:** user supplies a clean cutout; the photo
  is placed as-is on the template panel.
- **FM Approved badge:** drawn in CSS (no asset). Rapidrop + Fire Triangle use
  existing assets.

## Build order (each independently shippable)

1. Products polish (search, filters, Media picker in the image field).
2. Media library (DB `label` column + 3 endpoints + grid UI + delete guard).
3. Poster Maker (vendored html2canvas, one template, fields, preview, export).

## Testing / verification

- Manual + Playwright walkthrough of: login, product add/edit/delete + search,
  media upload/rename/delete + delete-guard warning, poster fill → preview →
  download + save-to-media.
- Verify `/api/admin/images` returns no `bytes`, and that `ALTER TABLE` is
  idempotent on an existing DB.
