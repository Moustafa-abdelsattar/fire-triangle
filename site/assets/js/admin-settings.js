// Site Settings: edit global content (contact / offices / social / footer /
// header / nav) with a live preview. Saves to PUT /api/admin/content/site,
// which refreshes the server cache so the change is live on the site at once.
(function () {
  "use strict";
  var A = window.FTAdmin, esc = A.esc;
  var state = null;

  function getP(o, p) { return String(p).split(".").reduce(function (a, k) { return a == null ? undefined : a[k]; }, o); }
  function setP(o, p, v) {
    var ks = String(p).split("."), last = ks.pop();
    var t = ks.reduce(function (a, k) { if (a[k] == null) a[k] = {}; return a[k]; }, o);
    t[last] = v;
  }

  function field(label, path, max) {
    return '<label>' + esc(label) + '<input data-path="' + path + '" maxlength="' + (max || 200) + '" value="' + esc(getP(state, path)) + '"></label>';
  }
  function area(label, path, max) {
    return '<label>' + esc(label) + '<textarea data-path="' + path + '" rows="2" maxlength="' + (max || 600) + '">' + esc(getP(state, path)) + '</textarea></label>';
  }

  function render() {
    var panel = document.getElementById("panel-settings");
    panel.innerHTML =
      '<h2>Site Settings</h2>' +
      '<p class="form__note">Your global contact details, footer, social links and navigation. Saving updates the whole website (and the chat assistant) live.</p>' +
      '<div class="set-wrap"><div class="poster__form" id="set-form">Loading…</div>' +
      '<div class="set-prev" id="set-preview"></div></div>' +
      '<div class="hero__cta" style="margin-top:16px"><button class="btn btn--primary" id="set-save" type="button">Save changes</button></div>' +
      '<p class="form__note" id="set-msg"></p>';

    document.getElementById("set-save").addEventListener("click", save);
    // Event delegation on the (persistent) form container so it survives the
    // innerHTML rebuilds in buildForm().
    var f = document.getElementById("set-form");
    f.addEventListener("input", onInput);
    f.addEventListener("change", onInput);

    A.api("/api/content/site").then(function (res) {
      state = (res && res.data) || {};
      buildForm();
      paint();
    });
  }

  function onInput(e) {
    var el = e.target, p = el.getAttribute && el.getAttribute("data-path");
    if (!p || !state) return;
    setP(state, p, el.type === "checkbox" ? el.checked : el.value);
    paint();
  }

  function buildForm() {
    var navRows = (state.nav || []).map(function (n, i) {
      return '<div class="set-navrow"><input data-path="nav.' + i + '.label" maxlength="60" value="' + esc(n.label) + '">' +
        '<label class="set-show"><input type="checkbox" data-path="nav.' + i + '.show"' + (n.show !== false ? " checked" : "") + '> show</label></div>';
    }).join("");

    document.getElementById("set-form").innerHTML =
      '<h3 class="set-h">Contact</h3>' +
      field("Telephone 1", "contact.tel1", 40) + field("Telephone 2", "contact.tel2", 40) +
      field("Mobile", "contact.mobile", 40) + field("Email", "contact.email", 120) +
      field("WhatsApp link", "contact.whatsapp", 300) +
      '<h3 class="set-h">Head office</h3>' +
      field("Label", "offices.head.label", 60) + field("Address", "offices.head.address", 200) +
      area("Google Maps embed URL", "offices.head.maps", 600) +
      '<h3 class="set-h">Branch office</h3>' +
      field("Label", "offices.branch.label", 60) + field("Address", "offices.branch.address", 200) +
      area("Google Maps embed URL", "offices.branch.maps", 600) +
      '<h3 class="set-h">Social links</h3>' +
      field("Facebook", "social.facebook", 300) + field("LinkedIn", "social.linkedin", 300) +
      field("WhatsApp", "social.whatsapp", 300) + field("YouTube", "social.youtube", 300) +
      '<h3 class="set-h">Footer</h3>' +
      field("Tagline", "footer.tagline", 160) + field("Copyright", "footer.copyright", 120) +
      '<h3 class="set-h">Header</h3>' +
      field("Wordmark", "header.wordmark", 60) + field("CTA label", "header.cta_label", 40) +
      field("CTA link (page)", "header.cta_href", 120) +
      '<h3 class="set-h">Navigation (label + show)</h3>' + navRows;
  }

  function paint() {
    var s = state || {}, c = s.contact || {}, off = s.offices || { head: {}, branch: {} }, soc = s.social || {}, hd = s.header || {}, ft = s.footer || {};
    var nav = (s.nav || []).filter(function (n) { return n && n.show !== false; })
      .map(function (n) { return '<span class="set-nav">' + esc(n.label) + '</span>'; }).join("");
    var socNames = ["facebook", "linkedin", "whatsapp", "youtube"].filter(function (k) { return soc[k]; }).join(" · ");
    document.getElementById("set-preview").innerHTML =
      '<div class="set-card"><div class="set-prev-h">Header / Nav</div>' +
      '<div class="set-wordmark">' + esc(hd.wordmark) + '</div>' +
      '<div>' + nav + ' <span class="set-cta">' + esc(hd.cta_label) + '</span></div></div>' +
      '<div class="set-card"><div class="set-prev-h">Contact</div>' +
      '<p>Tel: ' + esc(c.tel1) + ' / ' + esc(c.tel2) + '<br>Mobile: ' + esc(c.mobile) + '<br>Email: ' + esc(c.email) + '</p>' +
      '<p>' + esc((off.head || {}).label) + ': ' + esc((off.head || {}).address) + '<br>' +
      esc((off.branch || {}).label) + ': ' + esc((off.branch || {}).address) + '</p></div>' +
      '<div class="set-card"><div class="set-prev-h">Footer</div>' +
      '<p class="set-tag">' + esc(ft.tagline) + '</p>' +
      '<p>' + esc(socNames) + '</p>' +
      '<p class="set-legal">' + esc(ft.copyright) + '</p></div>';
  }

  function save() {
    var msg = document.getElementById("set-msg");
    msg.textContent = "Saving…";
    A.api("/api/content/site", { method: "PUT", body: JSON.stringify(state) }).then(function (res) {
      if (res.ok && res.data && res.data.ok) {
        state = res.data.value; buildForm(); paint();
        msg.textContent = "Saved ✓ — live on the website.";
        A.toast("Site settings saved");
      } else {
        msg.textContent = (res.data && res.data.error) || "Save failed.";
      }
    }).catch(function (e) { msg.textContent = "Save failed: " + e.message; });
  }

  A.onSection("settings", render);
})();
