// Baseline chrome + triangle + interactions.
// Classic (non-module) script so it renders on file:// double-click too —
// ES-module imports are CORS-blocked from origin "null" on file://.
// The Three.js/GSAP/Lenis upgrade lives in enhance.js (a module) and is
// expected to be absent over file://; this baseline must always render.
(function () {
  "use strict";

  var NAV = [
    ["index", "Home"], ["about", "About"], ["products", "Products"],
    ["services", "Services"], ["projects", "Projects"], ["careers", "Careers"], ["contact", "Contact"]
  ];
  var SOCIAL = [
    ["https://www.facebook.com/firetriangleoffical/", "Facebook", "f"],
    ["https://linkedin.com/company/fire-triangle", "LinkedIn", "in"],
    ["https://wa.link/zya3z4", "WhatsApp", "wa"],
    ["https://www.youtube.com/@FireTriangleforengineering", "YouTube", "yt"]
  ];

  function renderChrome(active) {
    var header = document.getElementById("site-header");
    if (header) {
      header.innerHTML =
        '<a class="logo" href="index.html" aria-label="Fire Triangle home">' +
        '<svg viewBox="0 0 40 36" width="34" height="30" aria-hidden="true">' +
        '<polygon points="20,3 3,33 37,33" fill="none" stroke="#DD3333" stroke-width="3"/>' +
        '<polygon points="20,15 13,28 27,28" fill="#DD3333"/>' +
        '</svg>' +
        '<span class="logo__word">FIRE&nbsp;TRIANGLE</span>' +
        '</a>' +
        '<nav aria-label="Primary"><ul class="nav">' +
        NAV.map(function (p) {
          return '<li><a href="' + p[0] + '.html"' + (p[0] === active ? ' aria-current="page"' : '') + '>' + p[1] + '</a></li>';
        }).join("") +
        '</ul></nav>' +
        '<a class="btn btn--primary header__cta" href="contact.html">Request a quote</a>';
    }
    var footer = document.getElementById("site-footer");
    if (footer) {
      footer.innerHTML =
        '<div class="container footer__grid">' +
        '<div><a class="logo logo--light" href="index.html" aria-label="Fire Triangle home">' +
        '<span class="logo__word">FIRE TRIANGLE</span></a>' +
        '<p class="footer__tag">Fire needs three things. We control all three.</p></div>' +
        '<nav aria-label="Footer"><h3 class="footer__h">Site</h3><ul>' +
        NAV.slice(1).map(function (p) { return '<li><a href="' + p[0] + '.html">' + p[1] + '</a></li>'; }).join("") +
        '</ul></nav>' +
        '<div><h3 class="footer__h">Find us</h3>' +
        '<p>Head Office: 737 El-Gaish St. — Mandara, Alexandria, Egypt.</p>' +
        '<p>Branch: 49 El-Shaikh Ali Abd El-Razik St, Heliopolis, Cairo.</p></div>' +
        '<div><h3 class="footer__h">Contact</h3>' +
        '<p>Tel: +20 3 5550609 / +20 3 5527726</p>' +
        '<p>Mobile: +20 1068 990 088</p>' +
        '<p>Email: <a href="mailto:sales@firetriangle.net">sales@firetriangle.net</a></p>' +
        '<ul class="social">' +
        SOCIAL.map(function (s) { return '<li><a href="' + s[0] + '" aria-label="' + s[1] + '" class="social__' + s[2] + '">' + s[2] + '</a></li>'; }).join("") +
        '</ul></div>' +
        '</div>' +
        '<div class="container footer__legal"><span>All rights reserved for Fire Triangle © 2026</span></div>';
    }
  }

  function buildTriangle(opts) {
    opts = opts || {};
    var size = opts.size || 420;
    var labels = opts.labels || ["HEAT", "FUEL", "OXYGEN"];
    var s = size, pad = 56, w = s, h = s * 0.9;
    var pts = [[w / 2, pad], [pad, h - pad], [w - pad, h - pad]];
    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    svg.setAttribute("class", "ftri");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "The fire triangle: heat, fuel, oxygen");
    var poly = document.createElementNS(svgNS, "polygon");
    poly.setAttribute("points", pts.map(function (p) { return p.join(","); }).join(" "));
    poly.setAttribute("class", "ftri__poly");
    svg.appendChild(poly);
    pts.forEach(function (p, i) {
      var c = document.createElementNS(svgNS, "circle");
      c.setAttribute("cx", p[0]); c.setAttribute("cy", p[1]); c.setAttribute("r", 7);
      c.setAttribute("class", "ftri__vtx"); c.dataset.i = i;
      svg.appendChild(c);
      var t = document.createElementNS(svgNS, "text");
      t.setAttribute("x", p[0]); t.setAttribute("y", i === 0 ? p[1] - 16 : p[1] + 28);
      t.setAttribute("text-anchor", "middle"); t.setAttribute("class", "ftri__label");
      t.textContent = labels[i];
      svg.appendChild(t);
    });
    return svg;
  }

  var page = document.body.dataset.page || "index";
  renderChrome(page);

  var slot = document.getElementById("triangle-slot");
  if (slot) slot.appendChild(buildTriangle({}));

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
  }, { threshold: .15 });
  document.querySelectorAll("[data-reveal]").forEach(function (el) { io.observe(el); });

  document.querySelectorAll("[data-count]").forEach(function (el) {
    var target = +el.dataset.count, n = 0;
    var tick = function () { n += Math.ceil(target / 40); if (n >= target) { el.textContent = target; return; } el.textContent = n; requestAnimationFrame(tick); };
    new IntersectionObserver(function (es, o) { es.forEach(function (e) { if (e.isIntersecting) { tick(); o.disconnect(); } }); }).observe(el);
  });

  window.filterProducts = function (cat) {
    document.querySelectorAll("[data-vtx]").forEach(function (v) { v.classList.toggle("is-active", v.dataset.vtx === cat); });
    document.querySelectorAll("[data-cat]").forEach(function (p) { p.hidden = !(cat === "all" || p.dataset.cat === cat); });
  };

  window.filterProjects = function (cat) {
    document.querySelectorAll("[data-pf]").forEach(function (b) { b.classList.toggle("is-active", b.dataset.pf === cat); });
    document.querySelectorAll("[data-proj]").forEach(function (p) { p.hidden = !(cat === "all" || p.dataset.proj === cat); });
  };
})();
