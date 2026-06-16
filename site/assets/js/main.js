import { renderChrome } from "./components.js";
import { buildTriangle } from "./triangle.js";

const page = document.body.dataset.page || "index";
renderChrome(page);

const slot = document.getElementById("triangle-slot");
if(slot) slot.appendChild(buildTriangle({}));

const io = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add("is-in"); io.unobserve(e.target);} });
},{threshold:.15});
document.querySelectorAll("[data-reveal]").forEach(el=>io.observe(el));

document.querySelectorAll("[data-count]").forEach(el=>{
  const target = +el.dataset.count; let n = 0;
  const tick = ()=>{ n += Math.ceil(target/40); if(n>=target){el.textContent=target;return;} el.textContent=n; requestAnimationFrame(tick); };
  new IntersectionObserver((es,o)=>{es.forEach(e=>{if(e.isIntersecting){tick();o.disconnect();}})}).observe(el);
});

window.filterProducts = (cat)=>{
  document.querySelectorAll("[data-vtx]").forEach(v=>v.classList.toggle("is-active", v.dataset.vtx===cat));
  document.querySelectorAll("[data-cat]").forEach(p=>{
    p.hidden = !(cat==="all" || p.dataset.cat===cat);
  });
};
