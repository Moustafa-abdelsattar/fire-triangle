# AI Product-Shot for the Poster Maker — Design

**Date:** 2026-06-23
**Branch:** `feat/redesign`
**Status:** Approved (brainstorming) → ready for implementation plan

## Problem

The Poster Maker template (`admin-poster.js` + `.pz-*` CSS) renders a branded 1080×1080
marketing card. Everything except the product image is real HTML text from the form
(logo, FM/Rapidrop badges, title, spec bullets, contact footer). The one image slot —
`.pz-photo`, `520×520`, `object-fit:contain` — currently takes a raw uploaded valve
photo **as-is**: original background, off-center crop, inconsistent lighting. Against the
poster's dark maroon gradient stage (`linear-gradient(135deg,#7a0f0f,#3a0606,#1c0303)`),
a raw photo with its own white/cluttered background looks unprofessional and off-brand.

The admin wants to upload a raw product photo and get a clean, catalogue-quality product
render that sits correctly inside the existing template — generated with Google's
Gemini 2.5 Flash Image model ("Nano Banana") — while keeping API spend tightly bounded.

## Decision summary (from brainstorming)

1. **AI scope:** Nano Banana cleans **only the product shot** (background removal, studio
   lighting, centered catalogue crop). It does NOT generate the whole poster. Title,
   specs, badges, and contacts remain real HTML text from the form — always accurate,
   always on-brand. The cleaned shot drops into the existing `.pz-photo` slot.
2. **API route:** A **dedicated `GEMINI_API_KEY`** calling Google's Gemini API directly
   (not via OpenRouter). Model `gemini-2.5-flash-image` (override via `GEMINI_IMAGE_MODEL`).
3. **Cost guardrails:** Admin-only; **hard 10/day cap** (24h rolling reset); auto-save the
   result to the Media library for reuse; confirm-before-generate; reuse the existing
   per-minute rate limiter.
4. **Background:** AI returns a **transparent PNG** so the product floats on the poster's
   dark gradient (a white background would clash).

## Architecture

Three touch points, mirroring the existing admin/poster structure:

```
admin-poster.js  ──POST /api/admin/poster-image──►  server.js endpoint
   (UI button +        { data, mime, name, brand }      │
    confirm + state)                                    ├─ adminOk() auth
        ▲                                               ├─ rateLimited(ip)  (reused)
        │   { url, id }                                 ├─ dailyCap.take()  (new)
        └───────────────────────────────────────────   ├─ validate image   (shared helper)
                                                        ├─ Gemini generateContent (transparent PNG)
                                                        └─ storeImage() → images table → /img/:id
```

### Component 1 — UI (`site/assets/js/admin-poster.js`)

In the "Product photo" form row, add a third button after *Pick from Media* / *Upload*:
**`✨ AI clean-up`**.

- Disabled until a source image exists (`state.photo` is set via pick or upload).
- On click: `confirm()` showing remaining quota — e.g. *"This uses 1 of 10 daily AI
  generations (N left today). Continue?"* The remaining count comes from the last
  server response (or is fetched lazily); if unknown, the dialog omits the number.
- POSTs `{ data, mime, name, brand }` to `/api/admin/poster-image`. The `data` is the
  base64 of the current source image. When `state.photo` is a data URL (just uploaded),
  split off the base64 directly; when it is an `/img/:id` URL (picked from Media), the UI
  fetches the bytes and re-encodes, OR (simpler) the AI button is only enabled for freshly
  uploaded/data-URL sources. **Decision:** enable for data-URL sources; for Media-picked
  images, fetch `/img/:id` → blob → base64 before POST. Both paths produce `{ data, mime }`.
- On success: set `state.photo` to the returned `/img/:id` url, `paint()`, and show
  *"AI shot ready ✓ · saved to Media · N/10 left today."* On error: show the server's
  message verbatim (quota, rate, key-missing, or Gemini failure).
- `name`/`brand` hints come from `state.title` (used as the product name) — there is no
  brand field in poster state, so brand is omitted or derived from the Rapidrop toggle.

### Component 2 — Server endpoint (`server.js`)

`POST /api/admin/poster-image` with `express.json({ limit: "7mb" })` (same as upload).

Guard order (fail fast, cheap-to-expensive):
1. `adminOk(req)` → 401 if not authenticated.
2. `KEY`-style check: if no `GEMINI_API_KEY` → 503 `"AI image generation isn't configured yet."`
3. `rateLimited(req.ip)` → 429 (reuses existing per-minute limiter).
4. `dailyCap.take()` → if over 10/24h → 429 `"Daily AI image limit reached (10/day). Resets in Xh."`
5. Validate `{ mime, data }`: `mime ∈ IMAGE_MIME`, `data` is a string, decodes to a
   1 byte–5 MB buffer. Reuses the shared validation helper (see Component 4). 400 on failure.

Then:
6. Build the prompt (see Prompt below) using sanitized `name`/`brand`.
7. Call Gemini REST `generateContent` with the source image inline + prompt.
8. Extract the first `inlineData` image part (base64 + mime) from `candidates[0].content.parts`.
   If none → 502 `"The AI couldn't produce an image — try a clearer photo."`
9. `storeImage(buf, "image/png", label="AI: <name>")` → returns `/img/:id`.
10. Respond `{ ok: true, url, id, remaining }` where `remaining` is the day's count left.

**Daily cap counter** — a small module-level object, isolated for unit testing:
```
{ count, windowStart }   // windowStart = ms timestamp
take(now): increments and returns { allowed, remaining }; resets when now - windowStart >= 24h
```
Incremented **on dispatch** (step 4, before the Gemini call) so failed/abused calls cannot
push spend past the ceiling. Lives in `lib/daily-cap.js` as a factory `makeDailyCap(limit, windowMs)`
so it is pure and testable (inject `now`).

**Gemini call (REST):**
```
POST https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={GEMINI_API_KEY}
{
  "contents": [{ "parts": [
    { "text": "<prompt>" },
    { "inline_data": { "mime_type": "<mime>", "data": "<base64>" } }
  ]}],
  "generationConfig": { "responseModalities": ["IMAGE"], "imageConfig": { "aspectRatio": "1:1" } }
}
```
Response parsing: walk `candidates[0].content.parts`, pick the part with `inlineData.data`;
decode base64 to a Buffer. Treat the output as PNG.

**Prompt (fixed template):**
> "Professional product photograph of {name|"this industrial fire-protection product"}
> {brand?}. Isolate the product completely and remove the background so it is fully
> transparent (alpha). Studio lighting, crisp focus, true-to-original colors and details,
> centered, tight catalogue crop with even margins, square framing. Do not add any text,
> logos, watermarks, shadows on a backdrop, or extra objects. Output a clean cutout of the
> product only."

The prompt builder is a pure function (`buildPosterPrompt({name, brand})`) for unit testing.

### Component 3 — Config

- `GEMINI_API_KEY` — Google Gemini API key. Server-side only (never sent to browser),
  same handling as `OPENROUTER_API_KEY`. **Owner pastes the value into Railway service
  variables**; the code only reads `process.env.GEMINI_API_KEY`.
- `GEMINI_IMAGE_MODEL` — optional, defaults to `gemini-2.5-flash-image`.

### Component 4 — Shared image-store helper (DRY)

Extract the inline logic in `/api/admin/upload` (validate base64 → decode → size-check →
INSERT into `images` → return url) into a reusable function so both `/api/admin/upload`
and `/api/admin/poster-image` use it. Two small pieces:
- `validateImage({ mime, data })` → `{ ok, buf }` or `{ ok:false, error }`.
- `storeImage(c, buf, mime, label?)` → inserts and returns `/img/:id` (takes the db client
  so it runs inside the existing `withDb` wrapper).

These live in `lib/` (e.g. `lib/image-store.js`) alongside `image-id.js` and `admin-auth.js`.

## Data flow

1. Admin uploads raw valve photo → `state.photo` = data URL → AI button enables.
2. Click → confirm → POST base64 + name/brand.
3. Server: auth → rate → daily-cap (increment) → validate → Gemini (transparent PNG) →
   `storeImage` → `{ url, id, remaining }`.
4. UI sets `state.photo = url`, repaints; the polished cutout now sits on the dark gradient.
5. Admin downloads/saves the poster (existing flow) or attaches the shot to a product
   (existing Media → product-image flow).

## Error handling

| Condition | Status | Client message |
|---|---|---|
| Not authenticated | 401 | Unauthorized |
| No `GEMINI_API_KEY` | 503 | AI image generation isn't configured yet. |
| Per-minute rate hit | 429 | You're doing that too quickly — give it a moment. |
| Daily cap (10) hit | 429 | Daily AI image limit reached (10/day). Resets in Xh. |
| Bad/oversized image | 400 | Image must be a jp/png/webp/gif, 1 byte–5 MB. |
| Gemini returns no image | 502 | The AI couldn't produce an image — try a clearer photo. |
| Gemini/network error | 502 | The image service is busy — please try again. |
| DB error | 500 | (existing `withDb` handling) |

## Testing

- **`lib/daily-cap.js`** — `node:test`: increments, blocks at the limit, resets after the
  window, reports correct `remaining`. Inject `now` for determinism.
- **`buildPosterPrompt`** — unit: includes name/brand when present, has sane defaults when
  absent, always contains the "transparent / no text" instructions.
- **Gemini response parser** — unit: extracts base64 from a mocked `candidates` structure;
  returns null/throws cleanly when no image part is present.
- **`validateImage`** — unit: accepts allowed types within size, rejects bad type / empty /
  oversized.
- No live Gemini calls in the test suite.
- **Manual:** after the owner sets `GEMINI_API_KEY` in Railway and redeploys, generate a
  shot from a real valve photo against the live deploy; confirm the cutout is transparent,
  centered, and saved to Media; confirm the 10/day cap blocks the 11th attempt.

## Out of scope (YAGNI)

Full-poster generation, multiple template variants, background-color/style options, batch
processing, persistent (DB-backed) daily-cap counter across restarts. The in-memory cap is
acceptable: a restart resets it, which only ever loosens the bound briefly and never
exceeds intent in steady state.

## Security notes

- `GEMINI_API_KEY` never reaches the browser; the browser only calls same-origin
  `/api/admin/poster-image`, which requires admin auth.
- Endpoint is admin-gated, rate-limited, daily-capped, and input-validated — same posture
  as the existing upload/chat routes.
- Source images are not persisted unless the admin separately uploads them; only the
  AI-generated result is stored (in the existing `images` table).
