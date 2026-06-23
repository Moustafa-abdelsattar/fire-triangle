const test = require("node:test");
const assert = require("node:assert");
const { makeDailyCap } = require("../lib/daily-cap");

test("allows up to the limit then blocks", () => {
  const cap = makeDailyCap(3, 1000);
  assert.deepStrictEqual(cap.take(0).allowed, true);   // 1
  assert.deepStrictEqual(cap.take(1).allowed, true);   // 2
  const third = cap.take(2);
  assert.strictEqual(third.allowed, true);             // 3
  assert.strictEqual(third.remaining, 0);
  assert.strictEqual(cap.take(3).allowed, false);      // 4 blocked
});

test("remaining counts down correctly", () => {
  const cap = makeDailyCap(2, 1000);
  assert.strictEqual(cap.take(0).remaining, 1);
  assert.strictEqual(cap.take(0).remaining, 0);
});

test("resets after the window elapses", () => {
  const cap = makeDailyCap(1, 1000);
  assert.strictEqual(cap.take(0).allowed, true);
  assert.strictEqual(cap.take(500).allowed, false);    // same window
  assert.strictEqual(cap.take(1000).allowed, true);    // window rolled over
});

test("peek does not consume quota", () => {
  const cap = makeDailyCap(2, 1000);
  assert.strictEqual(cap.peek(0).remaining, 2);
  cap.take(0);
  assert.strictEqual(cap.peek(0).remaining, 1);
  assert.strictEqual(cap.peek(0).remaining, 1);        // unchanged by peek
});

test("blocked take reports resetInMs within the window", () => {
  const cap = makeDailyCap(1, 1000);
  cap.take(0);
  const blocked = cap.take(200);
  assert.strictEqual(blocked.allowed, false);
  assert.strictEqual(blocked.resetInMs, 800);
});
