// Media library: grid + upload + rename + delete (+ picker modal for other sections).
(function () {
  "use strict";
  var A = window.FTAdmin, esc = A.esc;
  var images = [], pickResolve = null;

  function render() {
    document.getElementById("panel-media").innerHTML =
      '<h2>Media library</h2>' +
      '<div class="admin__bar"><label class="btn btn--primary btn--sm" style="cursor:pointer">Upload image' +
      '<input type="file" id="media-file" accept="image/*" hidden></label>' +
      '<span id="media-count" class="prod__brand"></span></div>' +
      '<p class="form__note" id="media-msg"></p>' +
      '<div class="media__grid" id="media-grid"></div>';
    document.getElementById("media-file").addEventListener("change", upload);
    document.getElementById("media-grid").addEventListener("click", onGridClick);
    refresh();
  }

  function refresh() {
    return A.api("/api/admin/images").then(function (res) {
      images = (res.data && res.data.images) || [];
      var grid = document.getElementById("media-grid");
      var count = document.getElementById("media-count");
      if (count) count.textContent = images.length + " images";
      if (grid) grid.innerHTML = images.map(tile).join("") || "<p>No images yet.</p>";
    }).catch(function () { var m = document.getElementById("media-msg"); if (m) m.textContent = "Failed to load images."; });
  }
  function tile(im) {
    var url = "/img/" + esc(im.id);
    var kb = Math.max(1, Math.round((im.size || 0) / 1024));
    return '<figure class="media__tile" data-id="' + esc(im.id) + '">' +
      '<img src="' + url + '" alt="" loading="lazy">' +
      '<figcaption><input class="media__label" value="' + esc(im.label || "") + '" placeholder="(no label)" maxlength="120">' +
      '<span class="media__meta">' + kb + ' KB</span></figcaption>' +
      '<div class="media__acts">' +
      '<button class="btn btn--ghost btn--sm" data-act="copy">Copy URL</button>' +
      '<button class="btn btn--ghost btn--sm" data-act="rename">Save name</button>' +
      '<button class="btn btn--ghost btn--sm" data-act="del">Delete</button></div></figure>';
  }
  function countUsedBy(id) {
    var prods = A.products();
    if (!prods) return -1; // unknown — Products section never opened or its fetch failed
    var u = "/img/" + id;
    return prods.filter(function (p) { return p.image === u; }).length;
  }
  function ensureProducts(cb) {
    if (A.products()) { cb(); return; }
    fetch("/api/products").then(function (r) { return r.json(); }).then(function (data) {
      if (data && data.products) A.setProducts(data.products);
      cb();
    }).catch(function () { cb(); });
  }
  function onGridClick(e) {
    var btn = e.target.closest("button[data-act]"); if (!btn) return;
    var fig = e.target.closest(".media__tile"); var id = fig.getAttribute("data-id");
    var act = btn.getAttribute("data-act");
    if (act === "copy") {
      navigator.clipboard.writeText(location.origin + "/img/" + id).then(function () { A.toast("URL copied"); });
    } else if (act === "rename") {
      var label = fig.querySelector(".media__label").value;
      A.api("/api/admin/images/" + id, { method: "PATCH", body: JSON.stringify({ label: label }) })
        .then(function () { A.toast("Renamed"); });
    } else if (act === "del") {
      ensureProducts(function () {
        var used = countUsedBy(id);
        var warn;
        if (used < 0) warn = "Couldn't verify product usage. Delete anyway?";
        else if (used > 0) warn = "This image is used by " + used + " product(s). Delete anyway?";
        else warn = "Delete this image?";
        if (!confirm(warn)) return;
        A.api("/api/admin/images/" + id, { method: "DELETE" }).then(function () { A.toast("Deleted"); refresh(); });
      });
    }
  }
  function upload() {
    var f = this.files && this.files[0]; if (!f) return;
    if (f.size > 5 * 1024 * 1024) { document.getElementById("media-msg").textContent = "Image too large (max 5 MB)."; this.value = ""; return; }
    var fr = new FileReader();
    fr.onload = function () {
      document.getElementById("media-msg").textContent = "Uploading…";
      A.api("/api/admin/upload", { method: "POST", body: JSON.stringify({ mime: f.type, data: String(fr.result).split(",")[1] }) })
        .then(function (res) {
          if (res.data && res.data.url) { document.getElementById("media-msg").textContent = "Uploaded ✓"; refresh(); }
          else { document.getElementById("media-msg").textContent = (res.data && res.data.error) || "Upload failed."; }
        });
    };
    fr.readAsDataURL(f);
    this.value = "";
  }

  // ---- picker modal (used by products + poster) ----
  function pick() {
    return refresh().then(function () {
      return new Promise(function (resolve) {
        pickResolve = resolve;
        var modal = document.createElement("div");
        modal.className = "media__modal"; modal.id = "media-modal";
        modal.innerHTML = '<div class="media__modalbox"><div class="admin__bar"><strong>Pick an image</strong>' +
          '<button class="btn btn--ghost btn--sm" data-pick="cancel">Cancel</button></div>' +
          '<div class="media__grid">' + images.map(function (im) {
            return '<figure class="media__tile media__tile--pick" data-pick-id="' + esc(im.id) + '"><img src="/img/' + esc(im.id) + '" alt=""><figcaption>' + esc(im.label || "") + '</figcaption></figure>';
          }).join("") + '</div></div>';
        modal.addEventListener("click", function (e) {
          if (e.target.closest('[data-pick="cancel"]') || e.target === modal) { finish(null); return; }
          var t = e.target.closest("[data-pick-id]"); if (t) finish("/img/" + t.getAttribute("data-pick-id"));
        });
        document.body.appendChild(modal);
      });
    });
  }
  function finish(url) {
    var m = document.getElementById("media-modal"); if (m) m.remove();
    if (pickResolve) { pickResolve(url); pickResolve = null; }
  }

  A.media = { refresh: refresh, pick: pick, countUsedBy: countUsedBy };
  A.onSection("media", render);
})();
