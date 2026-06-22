const test = require("node:test");
const assert = require("node:assert");
const { imageId } = require("../lib/image-id");

test("keeps valid hex id", () => {
  assert.strictEqual(imageId("a1b2c3d4e5f60718"), "a1b2c3d4e5f60718");
});
test("strips non-hex characters", () => {
  assert.strictEqual(imageId("../../etc/passwd"), "ecad");
});
test("uppercases are dropped (only lowercase hex kept)", () => {
  assert.strictEqual(imageId("ABCdef123"), "def123");
});
test("truncates to 32 chars", () => {
  assert.strictEqual(imageId("a".repeat(40)).length, 32);
});
test("empty / nullish -> empty string", () => {
  assert.strictEqual(imageId(null), "");
  assert.strictEqual(imageId(undefined), "");
  assert.strictEqual(imageId(""), "");
});
