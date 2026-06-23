const test = require("node:test");
const assert = require("node:assert");
const { buildPosterPrompt, parseImageFromResponse, cleanupProductImage } = require("../lib/gemini-image");

test("prompt always demands transparent background and no text", () => {
  const p = buildPosterPrompt({});
  assert.match(p, /transparent/i);
  assert.match(p, /no .*text|do not add any text/i);
});

test("prompt includes name and brand when present", () => {
  const p = buildPosterPrompt({ name: "OS&Y Gate Valve", brand: "Rapidrop" });
  assert.match(p, /OS&Y Gate Valve/);
  assert.match(p, /Rapidrop/);
});

test("prompt has a sane default when name is missing", () => {
  const p = buildPosterPrompt({ brand: "" });
  assert.match(p, /product/i);
  assert.ok(p.length > 40);
});

test("parses the first inlineData image part", () => {
  const json = { candidates: [{ content: { parts: [
    { text: "here you go" },
    { inlineData: { mimeType: "image/png", data: "AAAA" } },
  ] } }] };
  assert.deepStrictEqual(parseImageFromResponse(json), { data: "AAAA", mime: "image/png" });
});

test("defaults mime to image/png when absent", () => {
  const json = { candidates: [{ content: { parts: [{ inlineData: { data: "BBBB" } }] } }] };
  assert.deepStrictEqual(parseImageFromResponse(json), { data: "BBBB", mime: "image/png" });
});

test("returns null when there is no image part", () => {
  assert.strictEqual(parseImageFromResponse({ candidates: [{ content: { parts: [{ text: "no image" }] } }] }), null);
  assert.strictEqual(parseImageFromResponse({}), null);
  assert.strictEqual(parseImageFromResponse(null), null);
});

test("cleanupProductImage posts to the model URL and returns the parsed image", async () => {
  let seen = null;
  const fakeFetch = async (url, opts) => {
    seen = { url, opts };
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "ZZZZ" } }] } }] }),
    };
  };
  const out = await cleanupProductImage({
    apiKey: "test-key", model: "gemini-2.5-flash-image",
    mime: "image/jpeg", data: "SRC", name: "Valve", brand: "Rapidrop", fetchImpl: fakeFetch,
  });
  assert.deepStrictEqual(out, { data: "ZZZZ", mime: "image/png" });
  assert.match(seen.url, /models\/gemini-2\.5-flash-image:generateContent\?key=test-key/);
  const body = JSON.parse(seen.opts.body);
  assert.strictEqual(body.contents[0].parts[1].inlineData.data, "SRC");
  assert.deepStrictEqual(body.generationConfig.responseModalities, ["IMAGE"]);
});

test("cleanupProductImage throws on non-2xx", async () => {
  const fakeFetch = async () => ({ ok: false, status: 429, text: async () => "rate limited" });
  await assert.rejects(
    () => cleanupProductImage({ apiKey: "k", mime: "image/png", data: "x", fetchImpl: fakeFetch }),
    /gemini_http_429/
  );
});

test("cleanupProductImage throws gemini_no_image when no image returned", async () => {
  const fakeFetch = async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "nope" }] } }] }) });
  await assert.rejects(
    () => cleanupProductImage({ apiKey: "k", mime: "image/png", data: "x", fetchImpl: fakeFetch }),
    /gemini_no_image/
  );
});
