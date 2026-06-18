// Seeds the Fire Triangle product catalogue into Postgres.
// Run with DATABASE_URL set (e.g. `railway run --service fire-triangle node db/seed.js`,
// or locally with the Railway Postgres public connection string).
// Products & specs extracted from the company's Facebook product posts; images are
// self-hosted under site/assets/img/products/ (served at /assets/img/products/<file>).
const { Client } = require("pg");

const IMG = (f) => (f ? "/assets/img/products/" + f : null);

// category | brand | name | certifications | specs | image-file
const PRODUCTS = [
  // ---- Sprinklers (Rapidrop) ----
  ["Sprinklers", "Rapidrop", "Concealed Pendent Sprinkler", "UL/FM", "K-factor 5.6; Quick Response", "sprinkler-concealed-pendent.jpg"],
  ["Sprinklers", "Rapidrop", "Pendent Sprinkler", "UL/FM", "Standard orifice; multiple temperature ratings", "sprinkler-pendent.jpg"],
  ["Sprinklers", "Rapidrop", "Upright Sprinkler", "UL/FM", "Standard orifice", "sprinkler-upright.jpg"],
  ["Sprinklers", "Rapidrop", "Horizontal Sidewall Sprinkler", "UL/FM", "Standard orifice", "sprinkler-sidewall.jpg"],
  // ---- Zone control valves & trim (Rapidrop) ----
  ["Valves & Control", "Rapidrop", "Zone Control Valve — Pressure Gauge", "UL/FM", "Size 1/4\"; NPT connection", null],
  ["Valves & Control", "Rapidrop", "Zone Control Valve — Test & Drain", "UL/FM", "Sight-glass test & drain", "zcv-test-drain.jpg"],
  ["Valves & Control", "Rapidrop", "Water Flow Switch", "UL/FM", "Size 2\"–8\"", "zcv-flow-switch.jpg"],
  ["Valves & Control", "Rapidrop", "Tamper Switch", "UL/FM", "Size 2\"+", "zcv-tamper-switch.jpg"],
  ["Valves & Control", "Rapidrop", "Swing Check Valve", "UL/FM", "Size 2\"–12\"", "zcv-check-valve.jpg"],
  ["Valves & Control", "Rapidrop", "OS&Y Gate Valve", "UL/FM", "Size 2\"–24\"; flanged (24\" supplied to Cairo Airport Aircraft Hangar)", "zcv-gate-valve.jpg"],
  ["Valves & Control", "Rapidrop", "Butterfly Valve", "UL/FM", "Multiple connection types for firefighting systems", null],
  // ---- CLA-VAL control valves ----
  ["Valves & Control", "CLA-VAL", "Pressure Reducing Valve", "UL/FM", "Size 2.5\"–8\"; ANSI Class 150, 175 psi max; Model 2050B-4KG; Origin Switzerland", "claval-pressure-reducing.jpg"],
  ["Valves & Control", "CLA-VAL", "Pressure Relief Valve", "FM Approved", "Size 3\"–8\"; Origin Switzerland", "claval-relief.jpg"],
  ["Valves & Control", "CLA-VAL", "Air Release Valve", "UL/FM", "Origin Switzerland", "claval-air-release.jpg"],
  ["Valves & Control", "CLA-VAL", "Deluge Valve", "UL listed", "Size 2\"–2.5\"; Origin Switzerland", "claval-deluge.jpg"],
  ["Valves & Control", "CLA-VAL", "Casing Relief Valve", "UL/FM", "Size 3/4\"+; Origin Switzerland", "claval-casing-relief.jpg"],
  ["Valves & Control", "CLA-VAL", "Modulating Float Valve", "FM Approved", "Size 3\"+; Origin Switzerland", null],
  // ---- Grooved fittings (Rapidrop) ----
  ["Fittings", "Rapidrop", "Standard Rigid Coupling", "UL/FM", "Grooved", "grooved-rigid-coupling.jpg"],
  ["Fittings", "Rapidrop", "Mechanical Tee Grooved Outlet", "UL/FM", "Grooved branch outlet", "grooved-mechanical-tee.jpg"],
  ["Fittings", "Rapidrop", "Grooved Equal Tee", "UL/FM", "DN65–DN250 (2.5\"–10\")", "grooved-equal-tee.jpg"],
  ["Fittings", "Rapidrop", "Grooved 90° Elbow", "UL/FM", "DN25–DN300 (1\"–12\")", "grooved-elbow-90.jpg"],
  ["Fittings", "Rapidrop", "Grooved 45° Elbow", "UL/FM", "2\"–12\"", null],
  ["Fittings", "Rapidrop", "Grooved Concentric Reducer", "UL/FM", "DN32–DN250", null],
  ["Fittings", "Rapidrop", "Grooved Adaptor Flange", "UL/FM", "DN50–DN250 (2\"–10\")", "grooved-flange.jpg"],
  ["Fittings", "Jianzhi", "Threaded Fittings", "UL/FM", "Malleable-iron threaded pipe fittings", "jianzhi-threaded-fittings.jpg"],
  // ---- Hydrants (Rapidrop) ----
  ["Hydrants", "Rapidrop", "Wet Hydrant", "FM Approved", "Sizes 4\"×2.5\"×2.5\", 6\"×2.5\"×2.5\"", "hydrant-wet.jpg"],
  ["Hydrants", "Rapidrop", "Dry Hydrant", "FM Approved", "Size 6\"×4.5\"×2.5\"", "hydrant-dry.jpg"],
  ["Hydrants", "Rapidrop", "Underground Squat-type Hydrant", "FM Approved", "Size DN80", "hydrant-underground.jpg"],
  ["Hydrants", "Rapidrop", "Wet Hydrant for Foam Monitors", "FM Approved", "Size 6\"", "hydrant-foam-monitor.jpg"],
  // ---- Pumps (Waterfall) ----
  ["Pumps", "Waterfall", "Horizontal Split-Case Pump", "UL/FM", "Capacity 300–5000 GPM", "pump-split-case.jpg"],
  ["Pumps", "Waterfall", "End-Suction Pump", "UL/FM", "Capacity 250–1000 GPM", null],
  ["Pumps", "Waterfall", "Turbine (Vertical) Pump", "UL/FM", "From 150 GPM", null],
  ["Pumps", "Waterfall", "Fire Pump Set", "UL/FM", "Electric/diesel (Clarke) + jockey; pump sets", "waterfall-pumps.jpg"],
  ["Pumps", "GVI / Clebasvision", "Flow Meter", "FM Approved", "Size 4\"–8\"", null],
  // ---- Tanks (Rapidrop) ----
  ["Tanks", "Rapidrop", "Foam Bladder Tank", "UL listed", "From 53 gallon (e.g. 396 gallon)", "rapidrop-bladder-tank.jpg"],
  // ---- Hoses & cabinets (Rapidrop) ----
  ["Hoses & Cabinets", "Rapidrop", "Fire Hose Cabinet — Single", null, "1.25mm metal thickness; 1\" & 2.5\"", "hose-cabinet-single.jpg"],
  ["Hoses & Cabinets", "Rapidrop", "Fire Hose Cabinet — Double", null, "1.25mm metal thickness; 1\" & 2.5\"", "hose-cabinet-double.jpg"],
  ["Hoses & Cabinets", "Rapidrop", "Fire Hose Cabinet — Stand Alone", null, "1.25mm metal thickness", "hose-cabinet-standalone.jpg"],
  ["Hoses & Cabinets", "Rapidrop", "Fire Hose Reel", "LPCB", "Size 1\"; working 12 bar, burst 42 bar; angle valve + mount", null],
  ["Hoses & Cabinets", "Rapidrop", "Fire Hose 2.5\"", null, "2.5\" × 30 m; single jacket; 250 psi; Model FIG 413", null],
  ["Hoses & Cabinets", "Rapidrop", "Fire Hose Nozzle 2.5\"", null, "Working pressure 16 bar; Model FHN25", null],
  // ---- Fire alarm (Velocity / Advanced / Apollo) ----
  ["Fire Alarm", "Advanced", "Axis AX Fire Alarm Control Panel", "UL", "Addressable", null],
  ["Fire Alarm", "Advanced", "Axis AX Remote Graphical LCD Annunciator", "UL", "Addressable", null],
  ["Fire Alarm", "Apollo", "XP95A Smoke Detector", "UL", "Addressable", null],
  ["Fire Alarm", "Apollo", "XP95A Heat Detector", "UL", "Addressable", null],
  ["Fire Alarm", "Apollo", "XP95A Multicriteria Detector", "UL", "Addressable", null],
  ["Fire Alarm", "Advanced", "Dual-Action Pull Station", "UL", "Manual call point", null],
  ["Fire Alarm", "Advanced", "Sounder Beacon", "UL", "15-tone, 7-volume; built-in synchronization", null],
  ["Fire Alarm", "Advanced", "Alarm Bell GB24-6", "UL", "6\" housing; 24 VDC", null],
  ["Fire Alarm", "FFE (UK)", "Fireray Beam Detector", null, "Optical beam smoke detector (long-range)", null],
  ["Fire Alarm", "FFE (UK)", "Talentum Flame Detector", null, "Flame detection", null],
  ["Fire Alarm", "FFE (UK)", "Proreact Linear Heat Detection System", null, "Linear heat detection cable", null],
  // ---- Gas & wet-chemical suppression ----
  ["Gas Suppression", "Tyco / Ceodeux / Ansul", "FM-200 / CO₂ Clean-Agent System", null, "Total-flooding for server rooms, archives, electrical spaces", null],
  ["Gas Suppression", "FirePro / Mobiak", "Aerosol Suppression", null, "Condensed-aerosol units (e.g. Mobiak Aerosol ECO GREEN)", null],
  ["Gas Suppression", "Mobiak", "Hood Kitchen Suppression System", "UL/FM, LPCB, VDS", "Automatic wet-chemical kitchen suppression", "mobiak-kitchen-hood.jpg"],
  ["Foam", "Rapidrop", "Foam System", "UL", "Foam suppression for flammable-liquid / high-hazard risks", null],
  // ---- Accessories (Mobiak) ----
  ["Accessories", "Mobiak", "Breeching Inlets", "UL/FM, LPCB", "Size range (e.g. 4\"×2.5\"×2.5\")", null],
  ["Accessories", "Mobiak", "Ball Valves", "FM Approved", "Firefighting ball valves", null],
  ["Accessories", "Mobiak", "Pressure Restricting Valves", "FM Approved", "Angle / pressure-restricting valves", null],
  ["Accessories", "Bavaria / Mobiak", "Portable Fire Extinguishers", null, "Portable extinguishers & fire hose cabinets", null],
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }
  // Railway's internal network needs no TLS; the public proxy uses a valid cert
  // (keep verification on — never disable it).
  const needsSsl = /sslmode=require/.test(url) || /proxy\.rlwy\.net/.test(url);
  const client = new Client({ connectionString: url, ssl: needsSsl ? { rejectUnauthorized: true } : false });
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      brand TEXT,
      category TEXT NOT NULL,
      certifications TEXT,
      specs TEXT,
      image TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  await client.query("TRUNCATE products RESTART IDENTITY;");
  let n = 0;
  for (const [category, brand, name, certs, specs, img] of PRODUCTS) {
    await client.query(
      "INSERT INTO products (name, brand, category, certifications, specs, image) VALUES ($1,$2,$3,$4,$5,$6)",
      [name, brand, category, certs, specs, IMG(img)]
    );
    n++;
  }
  const { rows } = await client.query("SELECT category, count(*)::int AS n FROM products GROUP BY category ORDER BY category;");
  console.log(`Seeded ${n} products.`);
  console.table(rows);
  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
