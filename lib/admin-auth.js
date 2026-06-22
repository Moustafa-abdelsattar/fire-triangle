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
