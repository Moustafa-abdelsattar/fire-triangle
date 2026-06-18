// Renders the product catalogue (image-first) on the Products page from /api/products,
// with a click-to-open detail view showing the product image and its stated specs.
(function () {
  "use strict";
  var grid = document.getElementById("catalogue");
  var bar = document.getElementById("prodfilter");
  if (!grid) return;
  var PRODUCTS = [];

  function esc(s) {
    return (s == null ? "" : String(s)).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  var TRI = '<svg viewBox="0 0 40 36" width="40" height="36" aria-hidden="true"><polygon points="20,4 4,32 36,32" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>';
  function imgHtml(p, cls) {
    return p.image
      ? '<div class="' + cls + '"><img src="' + esc(p.image) + '" alt="' + esc((p.brand ? p.brand + " " : "") + p.name) + '" loading="lazy"></div>'
      : '<div class="' + cls + " " + cls + '--ph">' + TRI + "</div>";
  }
  function card(p, i) {
    var tag = esc(p.brand || "") + (p.certifications ? ' <span class="prod__cert">' + esc(p.certifications) + "</span>" : "");
    return '<article class="prod" data-cat="' + esc(p.category) + '" data-idx="' + i + '" tabindex="0" role="button" aria-label="' + esc(p.name) + ' — view details">' +
      imgHtml(p, "prod__img") +
      '<div class="prod__body"><span class="prod__brand">' + tag + "</span>" +
      '<h3 class="prod__name">' + esc(p.name) + "</h3>" +
      (p.specs ? '<p class="prod__spec">' + esc(p.specs) + "</p>" : "") +
      '<span class="prod__more">View details →</span></div></article>';
  }

  // ---- detail modal ----
  var modal = document.createElement("div");
  modal.className = "pmodal";
  modal.hidden = true;
  modal.innerHTML = '<div class="pmodal__backdrop"></div><div class="pmodal__box" role="dialog" aria-modal="true" aria-label="Product details">' +
    '<button class="pmodal__close" type="button" aria-label="Close">×</button><div class="pmodal__content"></div></div>';
  document.body.appendChild(modal);
  function openModal(p) {
    var certs = p.certifications ? '<span class="pmodal__cert">' + esc(p.certifications) + "</span>" : "";
    modal.querySelector(".pmodal__content").innerHTML =
      imgHtml(p, "pmodal__img") +
      '<div class="pmodal__info"><span class="prod__brand">' + esc(p.brand || "") + " " + certs + "</span>" +
      "<h2>" + esc(p.name) + "</h2>" +
      '<p class="pmodal__cat">' + esc(p.category) + "</p>" +
      (p.specs ? '<p class="pmodal__specs"><strong>Specifications:</strong> ' + esc(p.specs) + "</p>" : "") +
      '<p class="pmodal__note">Specifications as stated on the product sheet. Full size &amp; model variations available on request.</p>' +
      '<a class="btn btn--primary" href="contact.html">Request a quote</a></div>';
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    modal.querySelector(".pmodal__close").focus();
  }
  function closeModal() { modal.hidden = true; document.body.style.overflow = ""; }
  modal.addEventListener("click", function (e) {
    if (e.target.closest(".pmodal__close") || e.target.classList.contains("pmodal__backdrop")) closeModal();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !modal.hidden) closeModal(); });

  fetch("/api/products")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      PRODUCTS = (data && data.products) || [];
      if (!PRODUCTS.length) throw new Error("empty");
      PRODUCTS.sort(function (a, b) { return (a.image ? 0 : 1) - (b.image ? 0 : 1); });
      var cats = ["All"].concat(PRODUCTS.map(function (p) { return p.category; }).filter(function (c, i, a) { return a.indexOf(c) === i; }));
      bar.innerHTML = cats.map(function (c, i) {
        return '<button class="prodfilter__btn' + (i === 0 ? " is-active" : "") + '" type="button" data-f="' + esc(c) + '">' + esc(c) + "</button>";
      }).join("");
      grid.innerHTML = PRODUCTS.map(card).join("");

      bar.addEventListener("click", function (e) {
        var b = e.target.closest(".prodfilter__btn"); if (!b) return;
        var f = b.getAttribute("data-f");
        Array.prototype.forEach.call(bar.querySelectorAll(".prodfilter__btn"), function (x) { x.classList.toggle("is-active", x === b); });
        Array.prototype.forEach.call(grid.querySelectorAll(".prod"), function (el) {
          el.hidden = !(f === "All" || el.getAttribute("data-cat") === f);
        });
      });
      function openFromEl(el) { var i = el && el.getAttribute("data-idx"); if (i != null && PRODUCTS[i]) openModal(PRODUCTS[i]); }
      grid.addEventListener("click", function (e) { openFromEl(e.target.closest(".prod")); });
      grid.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { var el = e.target.closest(".prod"); if (el) { e.preventDefault(); openFromEl(el); } }
      });
    })
    .catch(function () {
      grid.innerHTML = '<p class="catalogue__loading">Couldn’t load the catalogue right now. Please refresh or email <a href="mailto:sales@firetriangle.net">sales@firetriangle.net</a>.</p>';
    });
})();
