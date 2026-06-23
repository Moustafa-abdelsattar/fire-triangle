const test = require("node:test");
const assert = require("node:assert");
const { validateImage } = require("../lib/image-store");

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX = 5 * 1024 * 1024;
// 1x1 transparent PNG, base64.
const TINY_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

test("accepts an allowed type within size", () => {
  const r = validateImage({ mime: "image/png", data: TINY_PNG }, ALLOWED, MAX);
  assert.strictEqual(r.ok, true);
  assert.ok(Buffer.isBuffer(r.buf));
  assert.strictEqual(r.mime, "image/png");
});

test("rejects a disallowed mime", () => {
  const r = validateImage({ mime: "image/svg+xml", data: TINY_PNG }, ALLOWED, MAX);
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /Unsupported/);
});

test("rejects when data is not a string", () => {
  const r = validateImage({ mime: "image/png", data: 123 }, ALLOWED, MAX);
  assert.strictEqual(r.ok, false);
});

test("rejects empty image", () => {
  const r = validateImage({ mime: "image/png", data: "" }, ALLOWED, MAX);
  assert.strictEqual(r.ok, false);
});

test("rejects oversized image", () => {
  const big = Buffer.alloc(MAX + 1).toString("base64");
  const r = validateImage({ mime: "image/png", data: big }, ALLOWED, MAX);
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /MB/);
});
