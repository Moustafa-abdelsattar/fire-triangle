const test = require("node:test");
const assert = require("node:assert");
const { SITE_DEFAULTS, validateSite, mergeDefaults, buildSystemPrompt } = require("../lib/content");

test("defaults are a complete, sane document", () => {
  assert.ok(SITE_DEFAULTS.contact.email.includes("@"));
  assert.strictEqual(SITE_DEFAULTS.nav.length, 7);
  assert.ok(SITE_DEFAULTS.footer.tagline.length > 0);
});

test("validateSite merges a partial update over defaults", () => {
  const r = validateSite({ contact: { email: "new@firetriangle.net" } });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.value.contact.email, "new@firetriangle.net");
  // untouched fields keep their defaults
  assert.strictEqual(r.value.contact.mobile, SITE_DEFAULTS.contact.mobile);
  assert.strictEqual(r.value.footer.tagline, SITE_DEFAULTS.footer.tagline);
});

test("validateSite trims and length-caps strings", () => {
  const long = "x".repeat(500);
  const r = validateSite({ footer: { tagline: "  hi  ", copyright: long } });
  assert.strictEqual(r.value.footer.tagline, "hi");
  assert.ok(r.value.footer.copyright.length <= 120);
});

test("validateSite rejects a malformed email", () => {
  const r = validateSite({ contact: { email: "not-an-email" } });
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /email/i);
});

test("empty email is allowed (clears the field)", () => {
  const r = validateSite({ contact: { email: "" } });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.value.contact.email, "");
});

test("validateSite rejects a non-URL social link", () => {
  const r = validateSite({ social: { facebook: "javascript:alert(1)" } });
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /facebook|url/i);
});

test("validateSite accepts https social links", () => {
  const r = validateSite({ social: { facebook: "https://facebook.com/x" } });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.value.social.facebook, "https://facebook.com/x");
});

test("nav: only label and show are applied; href is pinned to fixed routes", () => {
  const r = validateSite({
    nav: [{ href: "evil.com", label: "Pwned", show: false }],
  });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.value.nav.length, 7);
  // first route stays index.html regardless of input href
  assert.strictEqual(r.value.nav[0].href, "index.html");
  assert.strictEqual(r.value.nav[0].label, "Pwned");
  assert.strictEqual(r.value.nav[0].show, false);
  // routes not present in input keep default label + show:true
  assert.strictEqual(r.value.nav[1].href, "about.html");
  assert.strictEqual(r.value.nav[1].show, true);
});

test("header.cta_href must be a same-site .html path", () => {
  const bad = validateSite({ header: { cta_href: "https://evil.com" } });
  assert.strictEqual(bad.ok, false);
  const good = validateSite({ header: { cta_href: "contact.html" } });
  assert.strictEqual(good.ok, true);
  assert.strictEqual(good.value.header.cta_href, "contact.html");
});

test("mergeDefaults fills missing fields on an old stored doc", () => {
  const stored = { contact: { email: "old@x.net" } }; // missing everything else
  const m = mergeDefaults(stored);
  assert.strictEqual(m.contact.email, "old@x.net");
  assert.strictEqual(m.contact.mobile, SITE_DEFAULTS.contact.mobile);
  assert.strictEqual(m.nav.length, 7);
});

test("buildSystemPrompt embeds the current contact/office values", () => {
  const site = validateSite({
    contact: { email: "sales2@firetriangle.net", mobile: "+20 100 000 0000" },
    offices: { head: { address: "New HQ Address" } },
  }).value;
  const prompt = buildSystemPrompt(site);
  assert.ok(prompt.includes("sales2@firetriangle.net"));
  assert.ok(prompt.includes("+20 100 000 0000"));
  assert.ok(prompt.includes("New HQ Address"));
  assert.ok(/Fire Triangle Assistant/.test(prompt));
});
