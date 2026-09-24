#!/usr/bin/env node
/* ============================================================
   scripts/serve.mjs · OWNER: Agent A — a tiny zero-dependency static server for docs/ (QS port).
   Dev-time only. Serves docs/ at http://localhost:8000/ and also under the
   site's pathPrefix (/cincy-week/), like GitHub Pages does, so the
   404 page's absolute links work locally too. Missing files get docs/404.html.
   Usage: node scripts/serve.mjs [port]      (or PORT=8123 node scripts/serve.mjs)
          CW_OUT=.cache/out-me PORT=8123 node scripts/serve.mjs   serves a private build (see build/CONTRACTS.md)
   ============================================================ */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = process.env.CW_OUT ? path.resolve(ROOT, process.env.CW_OUT) : path.join(ROOT, "docs"); // CW_OUT: a private build
const PORT = Number(process.argv[2] || process.env.PORT || 8000);
let prefix = "/";
try { prefix = JSON.parse(fs.readFileSync(path.join(ROOT, "site.config.json"), "utf8")).pathPrefix || "/"; } catch { /* default */ }

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".ico": "image/x-icon", ".xml": "application/xml; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".webp": "image/webp", ".woff2": "font/woff2", ".ics": "text/calendar; charset=utf-8",
};

if (!fs.existsSync(DOCS)) { console.error(`${path.relative(ROOT, DOCS)}/ does not exist yet. Run: ${process.env.CW_OUT ? `CW_OUT=${process.env.CW_OUT} ` : ""}node build.mjs`); process.exit(1); }

http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, "http://localhost").pathname); } catch { res.writeHead(400).end("Bad request"); return; }
  if (prefix !== "/" && p.startsWith(prefix)) p = "/" + p.slice(prefix.length);
  else if (prefix !== "/" && p === prefix.slice(0, -1)) { res.writeHead(301, { Location: prefix }).end(); return; }
  let file = path.normalize(path.join(DOCS, p));
  if (!file.startsWith(DOCS)) { res.writeHead(403).end("Forbidden"); return; }
  try { if (fs.statSync(file).isDirectory()) file = path.join(file, "index.html"); } catch { /* not found below */ }
  fs.readFile(file, (err, data) => {
    if (err) {
      fs.readFile(path.join(DOCS, "404.html"), (e2, nf) => {
        res.writeHead(404, { "Content-Type": TYPES[".html"] });
        res.end(e2 ? "Not found" : nf);
      });
      return;
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`Serving ${path.relative(ROOT, DOCS)}/ at http://localhost:${PORT}/${prefix !== "/" ? `  (also at http://localhost:${PORT}${prefix})` : ""}`);
  console.log("Press Ctrl+C to stop.");
});
