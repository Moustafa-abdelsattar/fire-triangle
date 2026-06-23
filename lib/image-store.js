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
