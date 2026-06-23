// Poster Maker: one branded template, live preview, PNG export.
(function () {
  "use strict";
  var A = window.FTAdmin, esc = A.esc;
  var state = {
    title: "Fire Hose", subtitle: '2.5"', photo: "",
    bullets: ["Size : 2.5 x 30 meters long", "Single Jacket", "White Color", "c/w Aluminum Coupling", "Working pressure : 250 psi"],
    fm: true, rapidrop: true,
    head: "Head office: Alexandria", branch: "Branch office: Cairo",
    phones: "01068 990 088\n0106 949 474 8"
  };

  function render() {
    document.getElementById("panel-poster").innerHTML =
      '<h2>Poster Maker</h2>' +
      '<div class="poster__wrap">' +
        '<div class="poster__form" id="poster-form"></div>' +
        '<div class="poster__preview"><div id="poster-scale"><div id="poster-stage"></div></div>' +
          '<div class="hero__cta" style="margin-top:16px">' +
          '<button class="btn btn--primary" id="poster-download" type="button">Download PNG</button>' +
          '<button class="btn btn--ghost" id="poster-save" type="button">Save to Media</button></div>' +
          '<p class="form__note" id="poster-msg"></p>' +
        '</div>' +
      '</div>';
    buildForm();
    paint();
    document.getElementById("poster-download").addEventListener("click", exportPng);
    document.getElementById("poster-save").addEventListener("click", saveToMedia);
  }

  function stageHTML() {
    var bullets = state.bullets.filter(function (b) { return b && b.trim(); })
      .map(function (b) { return '<li><span class="pz-bullet">&#9658;</span>' + esc(b) + '</li>'; }).join("");
    var badges =
      (state.fm ? '<span class="pz-fm"><b>FM</b><i>APPROVED</i></span>' : "") +
      (state.rapidrop ? '<img class="pz-rd" src="/assets/img/brand-rapidrop.webp" alt="Rapidrop">' : "");
    var phones = esc(state.phones).split("\n").join("<br>");
    return '' +
      '<div class="pz-slash"></div>' +
      '<img class="pz-logo" src="/assets/img/logo.png" alt="Fire Triangle">' +
      '<div class="pz-badges">' + badges + '</div>' +
      (state.photo ? '<img class="pz-photo" src="' + esc(state.photo) + '" alt="">' : '<div class="pz-photo pz-photo--empty">photo</div>') +
      '<h3 class="pz-title">' + esc(state.title) + '</h3>' +
      '<div class="pz-sub">' + esc(state.subtitle) + '</div>' +
      '<ul class="pz-specs">' + bullets + '</ul>' +
      '<div class="pz-foot"><div class="pz-office">' + esc(state.head) + '<br>' + esc(state.branch) + '</div>' +
      '<div class="pz-contact"><span>Contact Us</span><div>' + phones + '</div></div></div>';
  }
  function paint() { document.getElementById("poster-stage").innerHTML = stageHTML(); fitStage(); }
  function fitStage() {
    var box = document.querySelector(".poster__preview");
    var scale = Math.min(1, (box.clientWidth - 4) / 1080);
    document.getElementById("poster-scale").style.transform = "scale(" + scale + ")";
    document.getElementById("poster-scale").style.height = (1080 * scale) + "px";
  }

  // Resolve the current photo (data: URL or /img/:id url) to { mime, data(base64) }.
  function sourceBytes(src) {
    var m = /^data:([^;]+);base64,(.*)$/.exec(src || "");
    if (m) return Promise.resolve({ mime: m[1], data: m[2] });
    return fetch(src).then(function (r) { return r.blob(); }).then(function (blob) {
      return new Promise(function (resolve, reject) {
        var fr = new FileReader();
        fr.onload = function () {
          var mm = /^data:([^;]+);base64,(.*)$/.exec(String(fr.result));
          if (mm) resolve({ mime: mm[1], data: mm[2] }); else reject(new Error("unreadable source"));
        };
        fr.onerror = function () { reject(new Error("read failed")); };
        fr.readAsDataURL(blob);
      });
    });
  }

  function buildForm() {
    var f = document.getElementById("poster-form");
    f.innerHTML =
      '<label>Title<input id="pz-title" value="' + esc(state.title) + '"></label>' +
      '<label>Subtitle / size<input id="pz-subtitle" value="' + esc(state.subtitle) + '"></label>' +
      '<label>Product photo<div class="hero__cta"><button class="btn btn--ghost btn--sm" type="button" id="pz-pick">Pick from Media</button>' +
      '<label class="btn btn--ghost btn--sm" style="cursor:pointer">Upload<input type="file" id="pz-file" accept="image/*" hidden></label>' +
      '<button class="btn btn--ghost btn--sm" type="button" id="pz-ai" title="Clean up the product photo with AI">✨ AI clean-up</button></div></label>' +
      '<label>Spec bullets (one per line)<textarea id="pz-bullets" rows="6">' + esc(state.bullets.join("\n")) + '</textarea></label>' +
      '<label class="poster__check"><input type="checkbox" id="pz-fm"' + (state.fm ? " checked" : "") + '> FM Approved badge</label>' +
      '<label class="poster__check"><input type="checkbox" id="pz-rd"' + (state.rapidrop ? " checked" : "") + '> Rapidrop badge</label>' +
      '<label>Head office line<input id="pz-head" value="' + esc(state.head) + '"></label>' +
      '<label>Branch office line<input id="pz-branch" value="' + esc(state.branch) + '"></label>' +
      '<label>Contact phones (one per line)<textarea id="pz-phones" rows="2">' + esc(state.phones) + '</textarea></label>';
    bind("pz-title", "title"); bind("pz-subtitle", "subtitle");
    bind("pz-head", "head"); bind("pz-branch", "branch"); bind("pz-phones", "phones");
    document.getElementById("pz-bullets").addEventListener("input", function () { state.bullets = this.value.split("\n"); paint(); });
    document.getElementById("pz-fm").addEventListener("change", function () { state.fm = this.checked; paint(); });
    document.getElementById("pz-rd").addEventListener("change", function () { state.rapidrop = this.checked; paint(); });
    document.getElementById("pz-pick").addEventListener("click", function () {
      A.media.pick().then(function (url) { if (url) { state.photo = url; paint(); } });
    });
    document.getElementById("pz-file").addEventListener("change", function () {
      var fl = this.files && this.files[0]; if (!fl) return;
      var fr = new FileReader();
      fr.onload = function () { state.photo = String(fr.result); paint(); }; // data URL (local preview)
      fr.readAsDataURL(fl);
    });
    var aiBtn = document.getElementById("pz-ai");
    function syncAi() { aiBtn.disabled = !state.photo; }
    syncAi();
    document.getElementById("pz-pick").addEventListener("click", syncAi);
    document.getElementById("pz-file").addEventListener("change", function () { setTimeout(syncAi, 0); });
    aiBtn.addEventListener("click", function () {
      if (!state.photo) return;
      var msg = document.getElementById("poster-msg");
      var left = (typeof state.aiRemaining === "number") ? " (" + state.aiRemaining + " left today)" : "";
      if (!confirm("This uses 1 of your 10 daily AI generations" + left + ". Continue?")) return;
      msg.textContent = "Generating AI product shot…";
      aiBtn.disabled = true;
      sourceBytes(state.photo).then(function (src) {
        return A.api("/api/admin/poster-image", { method: "POST", body: JSON.stringify({
          data: src.data, mime: src.mime, name: state.title, brand: state.rapidrop ? "Rapidrop" : "",
        }) });
      }).then(function (res) {
        if (res.ok && res.data && res.data.url) {
          state.photo = res.data.url;
          if (typeof res.data.remaining === "number") state.aiRemaining = res.data.remaining;
          paint(); syncAi();
          msg.textContent = "AI shot ready ✓ · saved to Media" +
            (typeof res.data.remaining === "number" ? " · " + res.data.remaining + "/10 left today" : "");
          if (A.media && A.media.refresh) A.media.refresh();
        } else {
          msg.textContent = (res.data && res.data.error) || "AI clean-up failed.";
          syncAi();
        }
      }).catch(function (e) { msg.textContent = "AI clean-up failed: " + e.message; syncAi(); });
    });
  }
  function bind(id, key) { document.getElementById(id).addEventListener("input", function () { state[key] = this.value; paint(); }); }

  function rasterize() {
    var stage = document.getElementById("poster-stage");
    var scaleEl = document.getElementById("poster-scale");
    return (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve())
      .then(function () {
        // Temporarily reset the CSS scale transform so html2canvas sees the full
        // 1080×1080 stage at 1:1 (avoids elements positioned outside the clipped
        // viewport due to the scale-down used for preview).
        var prevTransform = scaleEl ? scaleEl.style.transform : "";
        var prevHeight = scaleEl ? scaleEl.style.height : "";
        if (scaleEl) { scaleEl.style.transform = "scale(1)"; scaleEl.style.height = "1080px"; }
        return window.html2canvas(stage, { width: 1080, height: 1080, scale: 1, backgroundColor: null, useCORS: true })
          .then(function (canvas) {
            if (scaleEl) { scaleEl.style.transform = prevTransform; scaleEl.style.height = prevHeight; }
            return canvas;
          }, function (err) {
            if (scaleEl) { scaleEl.style.transform = prevTransform; scaleEl.style.height = prevHeight; }
            throw err;
          });
      });
  }
  function exportPng() {
    document.getElementById("poster-msg").textContent = "Rendering…";
    rasterize().then(function (canvas) {
      var a = document.createElement("a");
      a.download = (state.title || "poster").replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".png";
      a.href = canvas.toDataURL("image/png");
      a.click();
      document.getElementById("poster-msg").textContent = "Downloaded ✓";
    }).catch(function (e) { document.getElementById("poster-msg").textContent = "Export failed: " + e.message; });
  }
  function saveToMedia() {
    document.getElementById("poster-msg").textContent = "Rendering…";
    rasterize().then(function (canvas) {
      var data = canvas.toDataURL("image/png").split(",")[1];
      return A.api("/api/admin/upload", { method: "POST", body: JSON.stringify({ mime: "image/png", data: data }) });
    }).then(function (res) {
      if (res && res.data && res.data.url) {
        document.getElementById("poster-msg").textContent = "Saved to Media ✓ (" + res.data.url + ")";
        if (A.media) A.media.refresh();
      } else { document.getElementById("poster-msg").textContent = (res && res.data && res.data.error) || "Save failed."; }
    }).catch(function (e) { document.getElementById("poster-msg").textContent = "Save failed: " + e.message; });
  }

  window.addEventListener("resize", function () { if (document.getElementById("poster-stage")) fitStage(); });
  A.poster = { stageEl: function () { return document.getElementById("poster-stage"); }, state: state };
  A.onSection("poster", render);
})();
