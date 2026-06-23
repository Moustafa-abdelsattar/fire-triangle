// Rolling-window counter to bound per-day API spend. Pure aside from its own
// closed-over state; `now` is injected so it is deterministic in tests.
function makeDailyCap(limit, windowMs) {
  let count = 0;
  let windowStart = 0;
  function roll(now) {
    if (now - windowStart >= windowMs) { windowStart = now; count = 0; }
  }
  return {
    take(now) {
      roll(now);
      if (count >= limit) {
        return { allowed: false, remaining: 0, resetInMs: windowMs - (now - windowStart) };
      }
      count++;
      return { allowed: true, remaining: limit - count, resetInMs: windowMs - (now - windowStart) };
    },
    peek(now) {
      const active = (now - windowStart >= windowMs) ? 0 : count;
      return { remaining: Math.max(0, limit - active) };
    },
  };
}
module.exports = { makeDailyCap };
