// Global site settings: canonical defaults, validation/merge, and the chat
// system-prompt builder. Pure (no I/O) so it is unit-testable and reusable by
// both the server (fallback + validation) and seeding. Later content slices
// (page copy, projects) add their own keys; this module owns the `site` key.

// Seeded verbatim from the previously-hardcoded values so the first deploy is
// visually identical to today.
const SITE_DEFAULTS = {
  contact: {
    tel1: "+20 3 5550609",
    tel2: "+20 3 5527726",
    mobile: "+20 1068 990 088",
    email: "sales@firetriangle.net",
    whatsapp: "https://wa.link/zya3z4",
  },
  offices: {
    head: {
      label: "Head Office",
      address: "737 El-Gaish St. — Mandara, Alexandria, Egypt.",
      maps: "https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d1704.9930234204917!2d30.004649499752805!3d31.276481170984603!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x14f5d0743d7f1a31%3A0xdb2949dcf022c3d3!2z!5e0!3m2!1sen!2seg!4v1744191366399",
    },
    branch: {
      label: "Branch",
      address: "49 El-Shaikh Ali Abd El-Razik St, Heliopolis, Cairo.",
      maps: "https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d13805.169678710747!2d31.3552493!3d30.1144449!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x14581677c6a3873d%3A0x651f178f537a22c6!2sFire%20Triangle!5e0!3m2!1sen!2seg!4v1744191418536",
    },
  },
  social: {
    facebook: "https://www.facebook.com/firetriangleoffical/",
    linkedin: "https://linkedin.com/company/fire-triangle",
    whatsapp: "https://wa.link/zya3z4",
    youtube: "https://www.youtube.com/@FireTriangleforengineering",
  },
  footer: {
    tagline: "Fire needs three things. We control all three.",
    copyright: "All rights reserved for Fire Triangle © 2026",
  },
  header: {
    wordmark: "FIRE TRIANGLE",
    cta_label: "Request a quote",
    cta_href: "contact.html",
  },
  // href is FIXED to the real pages and never taken from user input; only
  // label + show are editable.
  nav: [
    { label: "Home", href: "index.html", show: true },
    { label: "About", href: "about.html", show: true },
    { label: "Products", href: "products.html", show: true },
    { label: "Services", href: "services.html", show: true },
    { label: "Projects", href: "projects.html", show: true },
    { label: "Careers", href: "careers.html", show: true },
    { label: "Contact", href: "contact.html", show: true },
  ],
};

const NAV_ROUTES = SITE_DEFAULTS.nav.map((n) => n.href);

function clampStr(v, max) {
  if (v == null) return "";
  return String(v).trim().slice(0, max);
}
function isEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
function isHttpUrl(s) { return /^https?:\/\//i.test(s); }
function isHtmlPath(s) { return /^[a-z0-9_\-]+\.html$/i.test(s); }

function clone(o) { return JSON.parse(JSON.stringify(o)); }

// Validate + normalize a (possibly partial) site update. Returns {ok,value} or
// {ok:false,error}. The result is always a complete document (merged over
// defaults), safe to store and serve directly.
function validateSite(input) {
  input = input && typeof input === "object" ? input : {};
  const out = clone(SITE_DEFAULTS);

  // --- contact ---
  const ci = input.contact || {};
  if (ci.tel1 !== undefined) out.contact.tel1 = clampStr(ci.tel1, 40);
  if (ci.tel2 !== undefined) out.contact.tel2 = clampStr(ci.tel2, 40);
  if (ci.mobile !== undefined) out.contact.mobile = clampStr(ci.mobile, 40);
  if (ci.email !== undefined) {
    const e = clampStr(ci.email, 120);
    if (e && !isEmail(e)) return { ok: false, error: "Contact email is not a valid email address." };
    out.contact.email = e;
  }
  if (ci.whatsapp !== undefined) {
    const w = clampStr(ci.whatsapp, 300);
    if (w && !isHttpUrl(w)) return { ok: false, error: "Contact WhatsApp must be an http(s) URL." };
    out.contact.whatsapp = w;
  }

  // --- offices ---
  const oi = input.offices || {};
  ["head", "branch"].forEach((k) => {
    const src = oi[k] || {};
    if (src.label !== undefined) out.offices[k].label = clampStr(src.label, 60);
    if (src.address !== undefined) out.offices[k].address = clampStr(src.address, 200);
    if (src.maps !== undefined) out.offices[k].maps = clampStr(src.maps, 600);
  });

  // --- social ---
  const si = input.social || {};
  for (const key of ["facebook", "linkedin", "whatsapp", "youtube"]) {
    if (si[key] !== undefined) {
      const u = clampStr(si[key], 300);
      if (u && !isHttpUrl(u)) return { ok: false, error: "Social link for " + key + " must be an http(s) URL." };
      out.social[key] = u;
    }
  }

  // --- footer ---
  const fi = input.footer || {};
  if (fi.tagline !== undefined) out.footer.tagline = clampStr(fi.tagline, 160);
  if (fi.copyright !== undefined) out.footer.copyright = clampStr(fi.copyright, 120);

  // --- header ---
  const hi = input.header || {};
  if (hi.wordmark !== undefined) out.header.wordmark = clampStr(hi.wordmark, 60) || SITE_DEFAULTS.header.wordmark;
  if (hi.cta_label !== undefined) out.header.cta_label = clampStr(hi.cta_label, 40);
  if (hi.cta_href !== undefined) {
    const h = clampStr(hi.cta_href, 120) || "contact.html";
    if (!isHtmlPath(h)) return { ok: false, error: "Header CTA link must be a same-site .html page." };
    out.header.cta_href = h;
  }

  // --- nav (label + show only, applied BY POSITION; href is always pinned to
  // the fixed route at that index, never taken from input) ---
  if (input.nav !== undefined) {
    const inNav = Array.isArray(input.nav) ? input.nav : [];
    out.nav = NAV_ROUTES.map((href, i) => {
      const def = SITE_DEFAULTS.nav[i];
      const inN = (inNav[i] && typeof inNav[i] === "object") ? inNav[i] : {};
      return {
        href: href,
        label: inN.label !== undefined ? (clampStr(inN.label, 60) || def.label) : def.label,
        show: inN.show !== undefined ? !!inN.show : true,
      };
    });
  }

  // maps URL validation (done here so an invalid value returns ok:false rather
  // than throwing from the loop above)
  for (const k of ["head", "branch"]) {
    const m = out.offices[k].maps;
    if (m && !isHttpUrl(m)) return { ok: false, error: "Office map URL for " + k + " must be an http(s) URL." };
  }

  return { ok: true, value: out };
}

// Deep-fill a stored doc with any missing default fields (for forward-compat
// when new fields are added after a doc was saved).
function mergeDefaults(stored) {
  const base = clone(SITE_DEFAULTS);
  if (!stored || typeof stored !== "object") return base;
  function merge(b, s) {
    for (const k in s) {
      if (Array.isArray(s[k])) { b[k] = s[k]; }
      else if (s[k] && typeof s[k] === "object" && b[k] && typeof b[k] === "object") { merge(b[k], s[k]); }
      else if (s[k] !== undefined) { b[k] = s[k]; }
    }
    return b;
  }
  const m = merge(base, stored);
  if (!Array.isArray(m.nav) || m.nav.length !== 7) m.nav = clone(SITE_DEFAULTS.nav);
  return m;
}

// Build the chat assistant's system prompt, interpolating the live contact /
// office values so the bot stays consistent with the rest of the site. Company
// stats and product knowledge remain static (owned by later content slices).
function buildSystemPrompt(site) {
  const s = mergeDefaults(site);
  const c = s.contact, head = s.offices.head, branch = s.offices.branch;
  return `You are the Fire Triangle Assistant, a friendly AI guide for Fire Triangle — a fire-protection company in Egypt. You live on firetriangle.net and help visitors understand the company, its products and services, and how to get in touch.

PERSONA & STYLE
- Warm, confident, concise. Default to 2–4 short sentences; use a tight bullet list only when listing products/options.
- You may answer in the visitor's language (English or Arabic).
- You represent Fire Triangle ("we"/"our"). Be helpful and sales-aware: when someone has a real need, guide them to request a quote or contact an engineer.
- NEVER invent prices, exact specs, model numbers, datasheet figures, certifications, or project names that aren't in your knowledge below. If asked for specifics you don't have, say so and point them to ${c.email} or the Request-a-Quote page.
- Only discuss Fire Triangle and fire protection. Politely decline unrelated topics and steer back.

COMPANY
- Fire Triangle, established early 2013; one of the largest specialized companies in the fire fighting & fire alarm field in Egypt. Authorized distributor for several international manufacturers since 2016.
- Works to NFPA standards and the Egyptian Codes. 13+ years' experience, 487+ projects delivered, 50+ staff (51–200 on LinkedIn).
- Mission: provide safety & protection for persons & properties by providing the highest quality fire alarm & fire fighting systems.
- Vision: fulfil our commitment to clients with the highest quality at the most cost efficiency, per NFPA standards & the Egyptian Codes.

SERVICES (three)
- Trading: supply a wide range of fire alarm, water, gas and foam systems as agent for reputed global brands.
- Contracting: implement all types of fire fighting & fire alarm systems (pumps, sprinklers, fire hose cabinets, gas, foam, conventional & addressable alarm) with NFPA-trained engineers and technicians.
- Maintenance: maintain all systems and supply spare parts under maintenance contracts, for all brands & systems.

PRODUCTS
- Fire alarm (addressable & conventional): sole agent for Velocity and for Advanced (newly introduced to Egypt — Axis AX control panels & LCD annunciators); Apollo (XP95A smoke/heat/multicriteria detectors), Simplex, Notifier; dual-action pull stations, sounder beacons, alarm bells (GB24-6). Partner of FFE UK for special detection — Fireray beam detector, Talentum flame detector, Proreact linear heat detection.
- Water systems: Rapidrop UK (UL/FM) — concealed/pendent/upright/sidewall sprinklers; zone control valves & trim (water flow switch, tamper switch, swing check valve, OS&Y gate valve, test & drain); grooved fittings (rigid couplings, mechanical & equal tees, 45°/90° elbows, concentric reducers, adaptor flanges); wet/dry/underground hydrants & foam-monitor hydrants; bladder tanks; fire hose reels, cabinets, hoses & nozzles. Waterfall (UL/FM) pumps — end-suction, horizontal split-case, turbine, jockey (300–5000 GPM) & pump sets, plus GVI/Clebasvision flow meters. CLA-VAL automatic control valves — pressure-reducing, relief, air-release, deluge, casing-relief, modulating-float.
- Gas systems: FM-200 & CO₂ clean-agent (Tyco, Ceodeux, Ansul); Aerosol (FirePro, Mobiak); Fire extinguishers (Bavaria, Mobiak).
- Foam systems for flammable-liquid / high-hazard risks.
- Mobiak: gas and wet-chemical suppression — ball/angle/pressure-restricting valves, breeching inlets, aerosol, hood kitchen suppression. UL listed, FM approved, and LPCB & VDS certified.
- Jianzhi: threaded malleable-iron pipe fittings for fire fighting pipework.

PROJECTS
- 487+ delivered across commercial, industrial and residential sectors. Named projects include: Cairo Airport Aircraft Hangar (24" Rapidrop OS&Y valve, via Triple A for Trading); DP World UAE (Waterfall horizontal split-case pump, via EDECS); GLC Paints (Waterfall pump system, delivered & inspected on-site); GÜLSAN Egypt Nonwoven Industries (Rapidrop 396-gallon bladder tank, UL listed); Dakahlia Agricultural Development (Waterfall split-case, 1500 GPM @ 9 bar); Souq El Habashi, Minya (Waterfall split-case, 1000 GPM @ 10 bar). A latest-projects PDF is available, and visitors can request references for their sector via Contact.
- Fire Triangle is a Diamond Sponsor of Egypt Energy – Firex 2026, and has exhibited at Firex since 2021.

CAREERS
- No open positions right now. Candidates can send a CV via the Careers page; tagline "Are you passionate? Do you enjoy the work?".

CONTACT
- ${head.label}: ${head.address} ${branch.label}: ${branch.address}
- Tel: ${c.tel1} / ${c.tel2}. Mobile: ${c.mobile}. Email: ${c.email}. WhatsApp available from the site.
- Site pages: Home, About, Products, Services, Projects, Careers, Contact.

When a visitor wants a quote, a site survey, a BOQ priced, or product availability: encourage them to use the Request-a-Quote form on the Contact page or email ${c.email}, and mention an engineer typically replies within one business day.`;
}

module.exports = { SITE_DEFAULTS, validateSite, mergeDefaults, buildSystemPrompt };
