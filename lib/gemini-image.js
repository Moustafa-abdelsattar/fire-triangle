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
