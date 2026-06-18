// Seeds the Fire Triangle product catalogue into Postgres from db/products.json.
// Run with DATABASE_URL set, e.g.:
//   railway run --service fire-triangle node db/seed.js
// or locally with the Railway Postgres public connection string in DATABASE_URL.
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }
  const products = JSON.parse(fs.readFileSync(path.join(__dirname, "products.json"), "utf8"));

  // TLS posture from the parsed hostname. Private Railway network: no TLS needed.
  // Any public host: verify the cert by default. Railway's managed Postgres uses a
  // self-signed cert, so a one-off seed over the public proxy needs the operator to
  // opt in explicitly with PGSSL_NO_VERIFY=1 — it is never the shipped default.
  let host = ""; try { host = new URL(url).hostname; } catch (e) { host = ""; }
  const ssl = host.endsWith(".railway.internal") ? false
    : (process.env.PGSSL_NO_VERIFY === "1" ? { rejectUnauthorized: false } : { rejectUnauthorized: true });
  const client = new Client({ connectionString: url, ssl });
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
  for (const p of products) {
    await client.query(
      "INSERT INTO products (name, brand, category, certifications, specs, image) VALUES ($1,$2,$3,$4,$5,$6)",
      [p.name, p.brand, p.category, p.certifications, p.specs, p.image]
    );
  }
  const { rows } = await client.query("SELECT category, count(*)::int AS n FROM products GROUP BY category ORDER BY category;");
  console.log(`Seeded ${products.length} products.`);
  console.table(rows);
  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
