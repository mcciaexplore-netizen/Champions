// Runs a SQL file against Neon. Default: db/schema.sql (npm run db:init).
// Pass a path to run a migration instead, e.g. node scripts/init-db.js db/migrations/001_....sql
import { readFileSync, existsSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

if (existsSync(".env")) process.loadEnvFile(".env");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to .env first (see .env.example).");
  process.exit(1);
}

const sql = neon(url);
const file = process.argv[2] || new URL("../db/schema.sql", import.meta.url);
const statements = readFileSync(file, "utf8")
  .split(";")
  .map((s) => s.replace(/--.*$/gm, "").trim())
  .filter(Boolean);

for (const stmt of statements) await sql.query(stmt);

const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM nominations`;
console.log(`✓ nominations table ready (${count} rows)`);
