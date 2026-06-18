// Fire Triangle — static site + secure AI assistant proxy.
// The OpenRouter key NEVER reaches the browser: it lives in process.env and is
// only used server-side here. The browser talks to /api/chat on this origin.
const express = require("express");
const path = require("path");

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

const SITE = path.join(__dirname, "site");
const MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
const KEY = process.env.OPENROUTER_API_KEY;

// ---- Assistant persona + knowledge base (kept current with the site) ----
const SYSTEM_PROMPT = `You are "Ember", the friendly AI guide for Fire Triangle — a fire-protection company in Egypt. You live on firetriangle.net and help visitors understand the company, its products and services, and how to get in touch.

PERSONA & STYLE
- Warm, confident, concise. Default to 2–4 short sentences; use a tight bullet list only when listing products/options.
- You may answer in the visitor's language (English or Arabic).
- You represent Fire Triangle ("we"/"our"). Be helpful and sales-aware: when someone has a real need, guide them to request a quote or contact an engineer.
- NEVER invent prices, exact specs, model numbers, datasheet figures, certifications, or project names that aren't in your knowledge below. If asked for specifics you don't have, say so and point them to sales@firetriangle.net or the Request-a-Quote page.
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
- Fire alarm: sole agent for Velocity; also Simplex, Apollo, Notifier. Addressable & conventional panels, detectors, notification.
- Water systems: Rapidrop UK (UL/FM) — sprinklers, valves, grooved fittings, hydrants, fire hose reel cabinets (multiple sizes, for commercial/industrial/residential), bladder tanks, accessories. Waterfall (UL/FM) firefighting pumps (standard, UL/FM-listed, horizontal split-case), jockey pumps, pump sets. CLA-VAL precision automatic control valves (pressure-reducing, deluge, flow-control).
- Gas systems: FM-200 & CO₂ clean-agent (Tyco, Ceodeux, Ansul); Aerosol (FirePro, Mobiak); Fire extinguishers (Bavaria, Mobiak).
- Foam systems for flammable-liquid / high-hazard risks.
- Mobiak: gas and wet-chemical suppression — ball/angle/pressure-restricting valves, breeching inlets, aerosol, hood kitchen suppression. UL listed, FM approved, and LPCB & VDS certified.
- Jianzhi: threaded malleable-iron pipe fittings for fire fighting pipework.

PROJECTS
- 487+ delivered across commercial, industrial and residential sectors. A latest-projects PDF is available, and visitors can request references for their sector via Contact.

CAREERS
- No open positions right now. Candidates can send a CV via the Careers page; tagline "Are you passionate? Do you enjoy the work?".

CONTACT
- Head Office: 737 El-Gaish St., Mandara, Alexandria, Egypt. Branch: 49 El-Shaikh Ali Abd El-Razik St, Heliopolis, Cairo.
- Tel: +20 3 5550609 / +20 3 5527726. Mobile: +20 1068 990 088. Email: sales@firetriangle.net. WhatsApp available from the site.
- Site pages: Home, About, Products, Services, Projects, Careers, Contact.

When a visitor wants a quote, a site survey, a BOQ priced, or product availability: encourage them to use the Request-a-Quote form on the Contact page or email sales@firetriangle.net, and mention an engineer typically replies within one business day.`;

// ---- Simple in-memory rate limiter (protects the OpenRouter credits) ----
const HITS = new Map(); // ip -> [timestamps]
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 15;
function rateLimited(ip) {
  const now = Date.now();
  const arr = (HITS.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  HITS.set(ip, arr);
  if (HITS.size > 5000) HITS.clear(); // crude memory guard
  return arr.length > MAX_PER_WINDOW;
}

app.post("/api/chat", async (req, res) => {
  if (!KEY) return res.status(503).json({ error: "The assistant isn't configured yet." });

  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "?").toString().split(",")[0].trim();
  if (rateLimited(ip)) return res.status(429).json({ error: "You're sending messages too quickly — give me a moment." });

  const incoming = Array.isArray(req.body && req.body.messages) ? req.body.messages : [];
  const messages = incoming
    .slice(-10)
    .map((m) => ({
      role: m && m.role === "assistant" ? "assistant" : "user",
      content: String((m && m.content) || "").slice(0, 1500),
    }))
    .filter((m) => m.content.trim().length > 0);

  if (messages.length === 0) return res.status(400).json({ error: "Empty message." });

  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://fire-triangle-production.up.railway.app",
        "X-Title": "Fire Triangle Assistant",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        max_tokens: 500,
        temperature: 0.4,
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error("OpenRouter error", r.status, detail.slice(0, 500));
      return res.status(502).json({ error: "Ember is busy right now — please try again in a moment." });
    }
    const data = await r.json();
    const reply = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    res.json({ reply: reply || "Sorry, I couldn't generate a reply — please try rephrasing." });
  } catch (e) {
    console.error("Chat handler failed:", e);
    res.status(500).json({ error: "Something went wrong reaching the assistant." });
  }
});

// ---- Static site (serves index.html at /, clean .html URLs, no dir listing) ----
app.use(express.static(SITE, { extensions: ["html"] }));
app.use((req, res) => res.status(404).sendFile(path.join(SITE, "index.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Fire Triangle on :${PORT} (model ${MODEL}, key ${KEY ? "set" : "MISSING"})`));
