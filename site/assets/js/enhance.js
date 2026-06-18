// Progressive enhancement: Three.js 3D hero + GSAP/ScrollTrigger reveals + Lenis smooth scroll.
// Baseline (main.js) already works; this only upgrades. Bail safely on reduced-motion / no-WebGL / CDN failure.
import * as THREE from "three";
import Lenis from "lenis";

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;

const MOLTEN = 0xDD3333;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

function webglOK(){
  try { const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
  } catch(e){ return false; }
}

// --- Smooth scroll + GSAP scroll reveals ---
if(!reduce && gsap && ScrollTrigger){
  try{
    gsap.registerPlugin(ScrollTrigger);
    const lenis = new Lenis({ lerp: 0.12, smoothWheel: true });
    window.__lenis = lenis;
    function raf(t){ lenis.raf(t); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
    lenis.on("scroll", ScrollTrigger.update);

    // Take reveals over from the baseline IntersectionObserver so the two systems
    // don't double-handle the same elements. Skip any the baseline already showed
    // (don't re-hide them — that would cause a flash).
    if(window.__baselineReveal) window.__baselineReveal.disable();
    gsap.utils.toArray("[data-reveal]").forEach((el)=>{
      if(el.classList.contains("is-in")) return;
      gsap.fromTo(el, { autoAlpha: 0, y: 24 },
        { autoAlpha: 1, y: 0, duration: 0.8, ease: "power2.out",
          onStart: ()=> el.classList.add("is-in"),
          scrollTrigger: { trigger: el, start: "top 85%" } });
    });

    // Route in-page anchor links through Lenis so smooth-scroll works (native
    // anchor jumps bypass Lenis and feel broken). Honor an incoming hash on load.
    const headerH = 80;
    document.addEventListener("click",(e)=>{
      const a = e.target.closest('a[href*="#"]');
      if(!a) return;
      const url = new URL(a.getAttribute("href"), location.href);
      if(url.pathname===location.pathname && url.hash && document.querySelector(url.hash)){
        e.preventDefault();
        lenis.scrollTo(url.hash, { offset: -headerH });
        history.pushState(null, "", url.hash);
      }
    });
    if(location.hash && document.querySelector(location.hash)){
      requestAnimationFrame(()=> lenis.scrollTo(location.hash, { offset: -headerH, immediate: true }));
    }
  }catch(e){ /* baseline IntersectionObserver in main.js remains active */ }
}

// --- 3D fire-triangle hero (index only) ---
const slot = document.getElementById("triangle-slot");
if(slot && !reduce && webglOK()){
  try{ build3D(slot); }catch(e){ /* SVG fallback stays visible */ }
}

function build3D(slot){
  const svg = slot.querySelector(".ftri");
  let w = slot.clientWidth || 420;
  let h = Math.min(w, 460);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(w, h);
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.style.display = "block";
  slot.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
  cam.position.z = 5;

  const tri = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.TetrahedronGeometry(1.6)),
    new THREE.LineBasicMaterial({ color: MOLTEN })
  );
  scene.add(tri);

  const core = new THREE.Mesh(
    new THREE.TetrahedronGeometry(0.55),
    new THREE.MeshBasicMaterial({ color: MOLTEN, transparent: true, opacity: 0.22 })
  );
  scene.add(core);

  const N = 150;
  const pos = new Float32Array(N * 3);
  const spd = new Float32Array(N);
  for(let i = 0; i < N; i++){
    pos[i*3]   = (Math.random()-0.5) * 5;
    pos[i*3+1] = (Math.random()-0.5) * 5;
    pos[i*3+2] = (Math.random()-0.5) * 3;
    spd[i] = 0.004 + Math.random() * 0.012;
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const embers = new THREE.Points(pg,
    new THREE.PointsMaterial({ color: MOLTEN, size: 0.05, transparent: true, opacity: 0.85 }));
  scene.add(embers);

  if(svg) svg.style.display = "none";

  // Only render while the hero is on-screen and the tab is visible — otherwise the
  // loop burns ~180 draw calls/sec competing with scroll for the whole page.
  let inView = true, frame = 0;
  function tick(){
    frame = 0;
    if(!inView || document.hidden) return;
    tri.rotation.y += 0.005; tri.rotation.x += 0.0022;
    core.rotation.y -= 0.004;
    const p = pg.attributes.position.array;
    for(let i = 0; i < N; i++){ p[i*3+1] += spd[i]; if(p[i*3+1] > 2.6) p[i*3+1] = -2.6; }
    pg.attributes.position.needsUpdate = true;
    renderer.render(scene, cam);
    frame = requestAnimationFrame(tick);
  }
  function kick(){ if(!frame && inView && !document.hidden) frame = requestAnimationFrame(tick); }
  new IntersectionObserver((es)=>{ inView = es[0].isIntersecting; kick(); }).observe(slot);
  document.addEventListener("visibilitychange", kick);
  kick();

  addEventListener("resize", ()=>{
    w = slot.clientWidth || w; h = Math.min(w, 460);
    renderer.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix();
  });
}
