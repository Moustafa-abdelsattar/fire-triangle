const test = require("node:test");
const assert = require("node:assert");
const { tokensMatch } = require("../lib/admin-auth");

test("equal tokens match", () => {
  assert.strictEqual(tokensMatch("s3cret-token", "s3cret-token"), true);
});
test("different same-length tokens do not match", () => {
  assert.strictEqual(tokensMatch("aaaaaa", "bbbbbb"), false);
});
test("different-length tokens do not match", () => {
  assert.strictEqual(tokensMatch("short", "longertoken"), false);
});
test("empty provided token never matches a real password", () => {
  assert.strictEqual(tokensMatch("", "realpw"), false);
});
test("does not throw on tokens longer than the fixed buffer", () => {
  assert.strictEqual(tokensMatch("x".repeat(500), "realpw"), false);
});
