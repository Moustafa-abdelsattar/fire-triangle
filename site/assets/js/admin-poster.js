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
    // export wiring is added in Task 7
  }

  function stageHTML() {
    var bullets = state.bullets.filter(function (b) { return b && b.trim(); })
      .map(function (b) { return '<li>' + esc(b) + '</li>'; }).join("");
    var badges =
      (state.fm ? '<span class="pz-badge pz-fm"><b>FM</b><i>APPROVED</i></span>' : "") +
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

  function buildForm() {
    var f = document.getElementById("poster-form");
    f.innerHTML =
      '<label>Title<input id="pz-title" value="' + esc(state.title) + '"></label>' +
      '<label>Subtitle / size<input id="pz-subtitle" value="' + esc(state.subtitle) + '"></label>' +
      '<label>Product photo<div class="hero__cta"><button class="btn btn--ghost btn--sm" type="button" id="pz-pick">Pick from Media</button>' +
      '<label class="btn btn--ghost btn--sm" style="cursor:pointer">Upload<input type="file" id="pz-file" accept="image/*" hidden></label></div></label>' +
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
  }
  function bind(id, key) { document.getElementById(id).addEventListener("input", function () { state[key] = this.value; paint(); }); }

  window.addEventListener("resize", function () { if (document.getElementById("poster-stage")) fitStage(); });
  A.poster = { stageEl: function () { return document.getElementById("poster-stage"); }, state: state };
  A.onSection("poster", render);
})();
