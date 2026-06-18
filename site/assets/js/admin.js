// Product admin: password-gated CRUD against the secured /api/admin endpoints.
(function () {
  "use strict";
  var KEY = "ft_admin_pw";
  var $ = function (id) { return document.getElementById(id); };
  var login = $("admin-login"), panel = $("admin-panel");

  function esc(s) {
    return (s == null ? "" : String(s)).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pw() { return sessionStorage.getItem(KEY) || ""; }
  function authHeaders() { return { "Content-Type": "application/json", "Authorization": "Bearer " + pw() }; }

  function show(authed) {
    login.hidden = authed; panel.hidden = !authed;
    if (authed) loadProducts();
  }

  // ---- login ----
  $("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var val = $("admin-pw").value;
    sessionStorage.setItem(KEY, val);
    fetch("/api/admin/check", { headers: authHeaders() }).then(function (r) {
      if (r.ok) { $("login-msg").textContent = ""; show(true); }
      else { sessionStorage.removeItem(KEY); $("login-msg").textContent = "Wrong password."; }
    }).catch(function () { $("login-msg").textContent = "Network error."; });
  });
  $("logout-btn").addEventListener("click", function () { sessionStorage.removeItem(KEY); show(false); });

  // ---- list ----
  function loadProducts() {
    fetch("/api/products").then(function (r) { return r.json(); }).then(function (data) {
      var products = (data && data.products) || [];
      $("admin-count").textContent = products.length + " products · source: " + (data.source || "?");
      var cats = products.map(function (p) { return p.category; }).filter(function (c, i, a) { return c && a.indexOf(c) === i; });
      $("cat-list").innerHTML = cats.map(function (c) { return '<option value="' + esc(c) + '">'; }).join("");
      $("admin-list").innerHTML = products.map(row).join("") || "<p>No products yet.</p>";
    });
  }
  function row(p) {
    var img = p.image ? '<img src="' + esc(p.image) + '" alt="" loading="lazy">' : '<span class="admin__noimg">—</span>';
    return '<div class="admin__row" data-id="' + esc(p.id) + '">' +
      '<div class="admin__thumb">' + img + "</div>" +
      '<div class="admin__info"><strong>' + esc(p.name) + "</strong>" +
      '<span class="prod__brand">' + esc(p.brand || "") + (p.certifications ? " · " + esc(p.certifications) : "") + " · " + esc(p.category) + "</span>" +
      (p.specs ? '<span class="admin__specs">' + esc(p.specs) + "</span>" : "") + "</div>" +
      '<div class="admin__actions"><button class="btn btn--ghost btn--sm" data-act="edit">Edit</button>' +
      '<button class="btn btn--ghost btn--sm" data-act="del">Delete</button></div></div>';
  }

  // ---- form (add / edit) ----
  var editing = null;
  function fillForm(p) {
    editing = p ? p.id : null;
    $("p-id").value = p ? p.id : "";
    $("p-name").value = p ? p.name || "" : "";
    $("p-brand").value = p ? p.brand || "" : "";
    $("p-category").value = p ? p.category || "" : "";
    $("p-cert").value = p ? p.certifications || "" : "";
    $("p-specs").value = p ? p.specs || "" : "";
    $("p-image").value = p ? p.image || "" : "";
    $("form-title").textContent = p ? "Edit product" : "Add a product";
    $("save-btn").textContent = p ? "Save changes" : "Add product";
    $("cancel-btn").hidden = !p;
    if (p) window.scrollTo({ top: 0, behavior: "smooth" });
  }
  $("cancel-btn").addEventListener("click", function () { fillForm(null); $("form-msg").textContent = ""; });

  $("product-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var body = {
      name: $("p-name").value, brand: $("p-brand").value, category: $("p-category").value,
      certifications: $("p-cert").value, specs: $("p-specs").value, image: $("p-image").value
    };
    var url = editing ? "/api/admin/products/" + editing : "/api/admin/products";
    var method = editing ? "PUT" : "POST";
    $("form-msg").textContent = "Saving…";
    fetch(url, { method: method, headers: authHeaders(), body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok || res.d.error) { $("form-msg").textContent = res.d.error || "Save failed."; return; }
        $("form-msg").textContent = editing ? "Updated ✓" : "Added ✓";
        fillForm(null); loadProducts();
      }).catch(function () { $("form-msg").textContent = "Network error."; });
  });

  $("admin-list").addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-act]"); if (!btn) return;
    var rowEl = e.target.closest(".admin__row"); var id = rowEl.getAttribute("data-id");
    if (btn.getAttribute("data-act") === "edit") {
      var info = rowEl.querySelector(".admin__info");
      fillForm({
        id: id,
        name: rowEl.querySelector("strong").textContent,
        // reload full record from API to get exact fields
      });
      // fetch exact record fields from current list data
      fetch("/api/products").then(function (r) { return r.json(); }).then(function (data) {
        var p = (data.products || []).filter(function (x) { return String(x.id) === String(id); })[0];
        if (p) fillForm(p);
      });
    } else if (btn.getAttribute("data-act") === "del") {
      if (!confirm("Delete this product?")) return;
      fetch("/api/admin/products/" + id, { method: "DELETE", headers: authHeaders() })
        .then(function (r) { return r.json(); })
        .then(function () { loadProducts(); })
        .catch(function () { alert("Delete failed."); });
    }
  });

  // ---- boot ----
  if (pw()) {
    fetch("/api/admin/check", { headers: authHeaders() }).then(function (r) { show(r.ok); if (!r.ok) sessionStorage.removeItem(KEY); });
  } else { show(false); }
})();
