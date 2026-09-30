// Google Sheets writer — service-account auth via the REST API (no Apps Script, no extra packages).
import { createSign } from "node:crypto";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://sheets.googleapis.com/v4/spreadsheets";

// Column order in the sheet: ID | Submitted At (IST) | Name | Company | Email | Phone | Award
export const HEADERS = ["ID", "Submitted At (IST)", "Name", "Company", "Email", "Phone", "Award"];

let cachedToken = null; // { value, expiresAt } — reused across warm serverless invocations

function config() {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  const tab = process.env.GOOGLE_SHEET_TAB || "Nominations";
  if (!sheetId || !email || !key) return null;
  // .env / Vercel may store the key with literal "\n" — turn them into real newlines.
  return { sheetId, email, key: key.replace(/\\n/g, "\n"), tab };
}

export function isSheetsConfigured() {
  return config() !== null;
}

const b64url = (input) => Buffer.from(input).toString("base64url");

async function getAccessToken({ email, key }) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }));
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(key, "base64url");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google auth failed (${res.status}): ${body.error_description || body.error || "unknown error"}`);

  cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return cachedToken.value;
}

async function sheetsRequest(cfg, path, init = {}) {
  const token = await getAccessToken(cfg);
  const res = await fetch(`${API}/${cfg.sheetId}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google Sheets error (${res.status}): ${body.error?.message || "unknown error"}`);
  return body;
}

const range = (tab, cells) => encodeURIComponent(`'${tab.replace(/'/g, "''")}'!${cells}`);

export function formatIST(date) {
  return new Date(date).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });
}

export function toRow(n) {
  return [String(n.id), formatIST(n.submitted_at), n.name, n.company, n.email, n.phone, n.award];
}

// Append nomination rows ({ id, submitted_at, name, company, email, phone, award }).
// RAW input keeps phone numbers as text and stops user input being run as a formula.
export async function appendNominations(rows) {
  const cfg = config();
  if (!cfg) throw new Error("Google Sheets is not configured (GOOGLE_SHEET_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY)");
  if (!rows.length) return 0;
  await sheetsRequest(cfg, `/values/${range(cfg.tab, "A:G")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    body: JSON.stringify({ values: rows.map(toRow) }),
  });
  return rows.length;
}

// IDs already present in column A (used by the sync script to avoid duplicates).
export async function getSheetIds() {
  const cfg = config();
  if (!cfg) throw new Error("Google Sheets is not configured");
  const body = await sheetsRequest(cfg, `/values/${range(cfg.tab, "A2:A")}`);
  return new Set((body.values || []).map(([id]) => String(id).trim()).filter(Boolean));
}

// Writes the header row if A1 is empty.
export async function ensureHeaders() {
  const cfg = config();
  if (!cfg) throw new Error("Google Sheets is not configured");
  const body = await sheetsRequest(cfg, `/values/${range(cfg.tab, "A1:G1")}`);
  if (body.values?.[0]?.length) return false;
  await sheetsRequest(cfg, `/values/${range(cfg.tab, "A1:G1")}?valueInputOption=RAW`, {
    method: "PUT",
    body: JSON.stringify({ values: [HEADERS] }),
  });
  return true;
}
