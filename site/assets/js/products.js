// Renders the product catalogue (image-first) on the Products page from /api/products.
// Falls back gracefully if the API isn't reachable.
(function () {
  "use strict";
  var grid = document.getElementById("catalogue");
  var bar = document.getElementById("prodfilter");
  if (!grid) return;

  function esc(s) {
    return (s == null ? "" : String(s)).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var TRI = '<svg viewBox="0 0 40 36" width="38" height="34" aria-hidden="true"><polygon points="20,4 4,32 36,32" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>';

  function card(p) {
    var img = p.image
      ? '<div class="prod__img"><img src="' + esc(p.image) + '" alt="' + esc((p.brand ? p.brand + " " : "") + p.name) + '" loading="lazy"></div>'
      : '<div class="prod__img prod__img--ph">' + TRI + "</div>";
    var tag = esc(p.brand || "") + (p.certifications ? ' <span class="prod__cert">' + esc(p.certifications) + "</span>" : "");
    return '<article class="prod" data-cat="' + esc(p.category) + '">' + img +
      '<div class="prod__body"><span class="prod__brand">' + tag + "</span>" +
      '<h3 class="prod__name">' + esc(p.name) + "</h3>" +
      (p.specs ? '<p class="prod__spec">' + esc(p.specs) + "</p>" : "") +
      "</div></article>";
  }

  fetch("/api/products")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var products = (data && data.products) || [];
      if (!products.length) throw new Error("empty");
      // images first
      products.sort(function (a, b) { return (a.image ? 0 : 1) - (b.image ? 0 : 1); });

      var cats = ["All"].concat(products.map(function (p) { return p.category; }).filter(function (c, i, a) { return a.indexOf(c) === i; }));
      bar.innerHTML = cats.map(function (c, i) {
        return '<button class="prodfilter__btn' + (i === 0 ? " is-active" : "") + '" type="button" data-f="' + esc(c) + '">' + esc(c) + "</button>";
      }).join("");

      grid.innerHTML = products.map(card).join("");

      bar.addEventListener("click", function (e) {
        var b = e.target.closest(".prodfilter__btn");
        if (!b) return;
        var f = b.getAttribute("data-f");
        Array.prototype.forEach.call(bar.querySelectorAll(".prodfilter__btn"), function (x) { x.classList.toggle("is-active", x === b); });
        Array.prototype.forEach.call(grid.querySelectorAll(".prod"), function (el) {
          el.hidden = !(f === "All" || el.getAttribute("data-cat") === f);
        });
      });
    })
    .catch(function () {
      grid.innerHTML = '<p class="catalogue__loading">Couldn’t load the catalogue right now. Please refresh or email <a href="mailto:sales@firetriangle.net">sales@firetriangle.net</a>.</p>';
    });
})();
