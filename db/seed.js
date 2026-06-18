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

  // Only the private network (*.railway.internal) is safe without TLS. Any other
  // host (the public TCP proxy) carries the password over the internet, so require
  // TLS to encrypt it. Railway's managed Postgres presents a self-signed cert, so
  // verification is relaxed — encryption (not cert-pinning) is what protects the
  // credentials here; cleartext would be the real vulnerability.
  const isPrivate = /\.railway\.internal(?::|\/|$)/.test(url);
  const client = new Client({ connectionString: url, ssl: isPrivate ? false : { rejectUnauthorized: false } });
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
