// Local dev server: serves the static frontend and runs api/*.js the same way Vercel does.
import { createServer } from "node:http";
import { readFile, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import submit from "./api/submit.js";
import { isSheetsConfigured } from "./lib/sheets.js";

if (existsSync(".env")) process.loadEnvFile(".env");

const ROOT = fileURLToPath(new URL("./public/", import.meta.url));
const PORT = Number(process.env.PORT) || 5500;
const API = { "/api/submit": submit };
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};
createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);

  if (API[path]) return API[path](req, res);

  const file = path === "/" ? "/index.html" : path;
  const full = normalize(join(ROOT, file));
  if (!full.startsWith(ROOT)) {
    res.statusCode = 404;
    return res.end("Not found");
  }
  readFile(full, (err, buf) => {
    if (err) {
      res.statusCode = 404;
      return res.end("Not found");
    }
    res.setHeader("Content-Type", TYPES[extname(full)] || "application/octet-stream");
    res.end(buf);
  });
}).listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  if (!process.env.DATABASE_URL) console.warn("⚠ DATABASE_URL not set — submissions will fail until you add it to .env");
  if (!isSheetsConfigured()) console.warn("⚠ Google Sheets not configured — submissions save to Neon only (see .env.example)");
});
