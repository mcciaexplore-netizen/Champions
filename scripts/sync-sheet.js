// Copies any Neon nominations missing from the Google Sheet (matched by ID). Run: npm run sheet:sync
// Safe to run repeatedly — rows already in the sheet are skipped.
import { existsSync } from "node:fs";
import { getSql } from "../lib/db.js";
import { appendNominations, ensureHeaders, getSheetIds, isSheetsConfigured } from "../lib/sheets.js";

if (existsSync(".env")) process.loadEnvFile(".env");

if (!process.env.DATABASE_URL || !isSheetsConfigured()) {
  console.error("Missing settings in .env — need DATABASE_URL, GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY.");
  process.exit(1);
}

try {
  if (await ensureHeaders()) console.log("✓ wrote header row");

  const sql = getSql();
  const rows = await sql`SELECT id, name, company, email, phone, award, submitted_at FROM nominations ORDER BY id`;
  const inSheet = await getSheetIds();
  const missing = rows.filter((r) => !inSheet.has(String(r.id)));

  await appendNominations(missing);
  console.log(`✓ sheet in sync — ${rows.length} in Neon, ${missing.length} added to the sheet`);
} catch (err) {
  console.error("✗", err.message);
  process.exit(1);
}
