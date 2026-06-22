// Products section: list + add/edit/delete against /api/admin/products.
(function () {
  "use strict";
  var A = window.FTAdmin, esc = A.esc;
  var editing = null;

  function render() {
    document.getElementById("panel-products").innerHTML =
      '<h2>Products</h2>' +
      '<div class="admin__bar"><span id="admin-count" class="prod__brand"></span></div>' +
      '<h3 id="form-title" style="margin-top:24px">Add a product</h3>' +
      '<form class="form admin__form" id="product-form">' +
      '<input type="hidden" id="p-id">' +
      '<div class="grid grid--2">' +
      '<label>Name *<input id="p-name" required maxlength="200"></label>' +
      '<label>Brand<input id="p-brand" maxlength="120"></label>' +
      '<label>Category *<input id="p-category" list="cat-list" required maxlength="80"><datalist id="cat-list"></datalist></label>' +
      '<label>Certifications<input id="p-cert" maxlength="120" placeholder="e.g. UL/FM"></label>' +
      '</div>' +
      '<label>Specs / variations<input id="p-specs" maxlength="600"></label>' +
      '<label>Upload image (jpg/png/webp, max 5 MB)<input type="file" id="p-file" accept="image/*"></label>' +
      '<label>Image path or URL<input id="p-image" maxlength="300" placeholder="/assets/img/products/example.jpg"></label>' +
      '<div class="hero__cta"><button class="btn btn--primary" type="submit" id="save-btn">Add product</button>' +
      '<button class="btn btn--ghost" type="button" id="cancel-btn" hidden>Cancel edit</button></div>' +
      '<p class="form__note" id="form-msg"></p></form>' +
      '<div class="admin__bar" style="margin-top:40px"><input id="prod-search" placeholder="Search products…" class="admin__search"></div>' +
      '<div id="cat-chips" class="admin__chips"></div>' +
      '<div class="admin__list" id="admin-list"></div>';
    wire();
    load();
  }

  var allProducts = [], activeCat = "";
  function load() {
    fetch("/api/products").then(function (r) { return r.json(); }).then(function (data) {
      allProducts = (data && data.products) || [];
      A.setProducts(allProducts);
      document.getElementById("admin-count").textContent = allProducts.length + " products · source: " + (data.source || "?");
      var cats = allProducts.map(function (p) { return p.category; }).filter(function (c, i, a) { return c && a.indexOf(c) === i; });
      document.getElementById("cat-list").innerHTML = cats.map(function (c) { return '<option value="' + esc(c) + '">'; }).join("");
      document.getElementById("cat-chips").innerHTML =
        '<button class="chip' + (activeCat === "" ? " is-active" : "") + '" data-cat="">All</button>' +
        cats.map(function (c) { return '<button class="chip' + (activeCat === c ? " is-active" : "") + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>'; }).join("");
      paint();
    }).catch(function () { document.getElementById("admin-count").textContent = "Failed to load products."; });
  }
  function paint() {
    var q = (document.getElementById("prod-search").value || "").toLowerCase();
    var list = allProducts.filter(function (p) {
      if (activeCat && p.category !== activeCat) return false;
      if (!q) return true;
      return ((p.name || "") + " " + (p.brand || "") + " " + (p.specs || "")).toLowerCase().indexOf(q) >= 0;
    });
    document.getElementById("admin-list").innerHTML = list.map(row).join("") || "<p>No matching products.</p>";
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
  function fillForm(p) {
    editing = p ? p.id : null;
    document.getElementById("p-id").value = p ? p.id : "";
    document.getElementById("p-name").value = p ? p.name || "" : "";
    document.getElementById("p-brand").value = p ? p.brand || "" : "";
    document.getElementById("p-category").value = p ? p.category || "" : "";
    document.getElementById("p-cert").value = p ? p.certifications || "" : "";
    document.getElementById("p-specs").value = p ? p.specs || "" : "";
    document.getElementById("p-image").value = p ? p.image || "" : "";
    document.getElementById("form-title").textContent = p ? "Edit product" : "Add a product";
    document.getElementById("save-btn").textContent = p ? "Save changes" : "Add product";
    document.getElementById("cancel-btn").hidden = !p;
  }
  function wire() {
    document.getElementById("prod-search").addEventListener("input", paint);
    document.getElementById("cat-chips").addEventListener("click", function (e) {
      var c = e.target.closest(".chip"); if (!c) return;
      activeCat = c.getAttribute("data-cat");
      var chips = document.getElementById("cat-chips").querySelectorAll(".chip");
      for (var i = 0; i < chips.length; i++) {
        if (chips[i].getAttribute("data-cat") === activeCat) { chips[i].classList.add("is-active"); }
        else { chips[i].classList.remove("is-active"); }
      }
      paint();
    });
    document.getElementById("cancel-btn").addEventListener("click", function () {
      fillForm(null); document.getElementById("form-msg").textContent = ""; document.getElementById("p-file").value = "";
    });
    document.getElementById("p-file").addEventListener("change", function () {
      var f = this.files && this.files[0]; if (!f) return;
      if (f.size > 5 * 1024 * 1024) { document.getElementById("form-msg").textContent = "Image too large (max 5 MB)."; this.value = ""; return; }
      var fr = new FileReader();
      fr.onload = function () {
        var data = String(fr.result).split(",")[1];
        document.getElementById("form-msg").textContent = "Uploading image…";
        A.api("/api/admin/upload", { method: "POST", body: JSON.stringify({ mime: f.type, data: data }), headers: {} })
          .then(function (res) {
            if (res.data && res.data.url) { document.getElementById("p-image").value = res.data.url; document.getElementById("form-msg").textContent = "Image uploaded ✓ — click Save."; }
            else { document.getElementById("form-msg").textContent = (res.data && res.data.error) || "Upload failed."; }
          });
      };
      fr.readAsDataURL(f);
    });
    document.getElementById("product-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var body = { name: val("p-name"), brand: val("p-brand"), category: val("p-category"),
        certifications: val("p-cert"), specs: val("p-specs"), image: val("p-image") };
      var url = editing ? "/api/admin/products/" + editing : "/api/admin/products";
      document.getElementById("form-msg").textContent = "Saving…";
      A.api(url, { method: editing ? "PUT" : "POST", body: JSON.stringify(body) }).then(function (res) {
        if (!res.ok || res.data.error) { document.getElementById("form-msg").textContent = res.data.error || "Save failed."; return; }
        document.getElementById("form-msg").textContent = editing ? "Updated ✓" : "Added ✓";
        fillForm(null); load();
      });
    });
    document.getElementById("admin-list").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-act]"); if (!btn) return;
      var id = e.target.closest(".admin__row").getAttribute("data-id");
      if (btn.getAttribute("data-act") === "edit") {
        var p = allProducts.filter(function (x) { return String(x.id) === String(id); })[0];
        if (p) { fillForm(p); window.scrollTo({ top: 0, behavior: "smooth" }); }
      } else {
        if (!confirm("Delete this product?")) return;
        A.api("/api/admin/products/" + id, { method: "DELETE" }).then(load);
      }
    });
  }
  function val(id) { return document.getElementById(id).value; }

  A.onSection("products", render);
})();
