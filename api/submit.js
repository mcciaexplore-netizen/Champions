// POST /api/submit — Vercel serverless function (also used by server.js locally).
import { getSql } from "../lib/db.js";
import { validateNomination } from "../lib/validate.js";
import { appendNominations, isSheetsConfigured } from "../lib/sheets.js";

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  // Vercel pre-parses JSON into req.body; the local server does not.
  if (req.body !== undefined) {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 10_000) throw new Error("Payload too large");
  }
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { ok: false, error: "Method not allowed" });
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    return send(res, 400, { ok: false, error: "Invalid request body" });
  }

  const { data, errors, valid } = validateNomination(body);
  if (!valid) return send(res, 422, { ok: false, error: "Validation failed", errors });

  let row;
  try {
    const sql = getSql();
    [row] = await sql`
      INSERT INTO nominations (name, company, email, phone, award)
      VALUES (${data.name}, ${data.company}, ${data.email}, ${data.phone}, ${data.award})
      RETURNING id, submitted_at
    `;
  } catch (err) {
    console.error("[api/submit] database error:", err.message);
    return send(res, 500, { ok: false, error: "Could not save your nomination. Please try again." });
  }

  // Neon is the source of truth. A Sheets failure is logged but doesn't fail the submission;
  // `npm run sheet:sync` copies any missing rows later.
  let sheetSynced = false;
  if (isSheetsConfigured()) {
    try {
      await appendNominations([{ ...data, id: row.id, submitted_at: row.submitted_at }]);
      sheetSynced = true;
    } catch (err) {
      console.error(`[api/submit] google sheets error (nomination ${row.id} saved in Neon):`, err.message);
    }
  }

  return send(res, 201, { ok: true, id: row.id, submittedAt: row.submitted_at, sheetSynced, data });
}
