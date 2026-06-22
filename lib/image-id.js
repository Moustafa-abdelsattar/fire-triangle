// Pure helper: normalise an image id to lowercase hex, max 32 chars.
function imageId(raw) {
  return String(raw == null ? "" : raw).replace(/[^a-f0-9]/g, "").slice(0, 32);
}
module.exports = { imageId };
