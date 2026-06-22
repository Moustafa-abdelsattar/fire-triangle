// Admin core: auth gate, sidebar routing, shared helpers + caches.
window.FTAdmin = (function () {
  "use strict";
  var KEY = "ft_admin_pw";
  var sectionInits = {}, sectionDone = {}, _products = null;
  var login = document.getElementById("admin-login");
  var dash = document.getElementById("admin-dash");

  function esc(s) {
    return (s == null ? "" : String(s)).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pw() { return sessionStorage.getItem(KEY) || ""; }
  function authHeaders() { return { "Content-Type": "application/json", "Authorization": "Bearer " + pw() }; }

  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({}, authHeaders(), opts.headers || {});
    return fetch(path, opts).then(function (r) {
      if (r.status === 401) { sessionStorage.removeItem(KEY); showLogin(); }
      return r.json().catch(function () { return {}; }).then(function (data) {
        return { ok: r.ok, status: r.status, data: data };
      });
    });
  }

  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById("dash-toast");
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2600);
  }

  function onSection(name, fn) { sectionInits[name] = fn; }
  function activate(name) {
    var links = document.querySelectorAll(".dash__link");
    var panels = document.querySelectorAll(".dash__panel");
    for (var i = 0; i < links.length; i++) links[i].classList.toggle("is-active", links[i].getAttribute("data-section") === name);
    for (var j = 0; j < panels.length; j++) panels[j].classList.toggle("is-active", panels[j].getAttribute("data-panel") === name);
    if (!sectionDone[name] && sectionInits[name]) { sectionDone[name] = true; sectionInits[name](); }
  }

  function showLogin() { login.hidden = false; dash.hidden = true; }
  function showDash() { login.hidden = true; dash.hidden = false; activate("products"); }

  function products() { return _products; }
  function setProducts(arr) { _products = arr; }

  // wiring
  document.getElementById("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    sessionStorage.setItem(KEY, document.getElementById("admin-pw").value);
    fetch("/api/admin/check", { headers: authHeaders() }).then(function (r) {
      if (r.ok) { document.getElementById("login-msg").textContent = ""; showDash(); }
      else { sessionStorage.removeItem(KEY); document.getElementById("login-msg").textContent = "Wrong password."; }
    }).catch(function () { document.getElementById("login-msg").textContent = "Network error."; });
  });
  document.getElementById("logout-btn").addEventListener("click", function () { sessionStorage.removeItem(KEY); showLogin(); });
  document.querySelector(".dash__nav nav").addEventListener("click", function (e) {
    var b = e.target.closest(".dash__link"); if (b) activate(b.getAttribute("data-section"));
  });

  // boot
  if (pw()) {
    fetch("/api/admin/check", { headers: authHeaders() }).then(function (r) {
      if (r.ok) showDash(); else { sessionStorage.removeItem(KEY); showLogin(); }
    }).catch(showLogin);
  } else { showLogin(); }

  return { esc: esc, pw: pw, authHeaders: authHeaders, api: api, toast: toast,
           onSection: onSection, products: products, setProducts: setProducts };
})();
