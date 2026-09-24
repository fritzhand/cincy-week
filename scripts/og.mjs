#!/usr/bin/env node
/* ============================================================
   scripts/og.mjs · OWNER: Agent B (design system); landed by Agent A.
   Renders the 1200×630 social cards with Playwright from the built site's
   own tokens, fonts and sprite (QS og.mjs pattern), in the Morning edition:
     site/og.png            the guide
     site/og-<program>.png  one per program page (program.mjs sets page.og)
   Dev-time only; the build just copies site/og*.png into docs/assets/.
   Usage: node build.mjs && NODE_PATH=/opt/node22/lib/node_modules node scripts/og.mjs && node build.mjs
   ============================================================ */
import { createRequire } from "node:module";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sprite, wordmark, riverRule, bullet } from "../build/core/icons.mjs";
import { PROGRAM_PAGES } from "../build/nav.mjs";
import { fmtDateRange, fmtDowRange } from "../site/js/lib/time.js";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { console.error("Playwright not found (set NODE_PATH to a global install)."); process.exit(1); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = path.join(ROOT, "docs");
if (!fs.existsSync(path.join(DOCS, "assets", "tokens.css"))) { console.error("Build first: node build.mjs"); process.exit(1); }
const config = JSON.parse(fs.readFileSync(path.join(ROOT, "site.config.json"), "utf8"));
const programs = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "programs.json"), "utf8"));
const P = new Map(programs.map((p) => [p.id, p]));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const CSS = `
body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: var(--bg); color: var(--text); }
.og { box-sizing: border-box; width: 1200px; height: 630px; padding: 44px 64px 40px; display: flex; flex-direction: column; }
.og .folio { font-size: 15px; }
.og .nameplate { padding-top: 34px; justify-content: center; }
.og .nameplate .wm { width: 820px; }
.og .river { margin-top: 10px; } .og .river .rr { height: 50px; }
.og .og-dek { margin: 34px auto 0; font: italic 420 34px/1.25 var(--font-display); color: var(--text-muted); text-align: center; }
.og .progs { margin-top: auto; display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; border-top: var(--rule-mid) solid var(--rule-ink); padding-top: 18px; }
.og .progs div { display: flex; gap: 12px; align-items: center; font: var(--wght-strong) 19px/1.25 var(--font-body); }
.og .progs small { display: block; font-weight: 500; color: var(--text-muted); font-size: 16px; }
.og .p-name { margin-top: 64px; font: var(--wght-head) 104px/1.02 var(--font-display); letter-spacing: -0.02em; }
.og .p-when { margin-top: 26px; font: var(--wght-strong) 30px/1.3 var(--font-body); color: var(--ink-text); display: flex; align-items: center; gap: 16px; }
.og .p-foot { margin-top: auto; display: flex; align-items: flex-end; justify-content: space-between; border-top: var(--rule-heavy) solid var(--rule-ink); padding-top: 18px; }
.og .p-foot .wm { width: 300px; height: auto; }
.og .p-foot span { font: 500 20px/1.3 var(--font-body); color: var(--text-muted); }
.og .bullet.xxl { width: 92px; height: 92px; }
`;
const page = (inner) => `<!doctype html><html lang="en" data-theme="light" class="js"><head><meta charset="utf-8">
<link rel="stylesheet" href="/assets/tokens.css"><link rel="stylesheet" href="/assets/site.css"><style>${CSS}</style></head>
<body>${sprite()}${inner}</body></html>`;

const lanes = ["caw", "scw", "blink", "fotofocus"].filter((id) => P.has(id));
const home = page(`<div class="og">
<div class="folio oxford label tnum"><span class="vol">Vol. 1 · Special section</span><span class="today">${esc(fmtDateRange(config.week.start, config.week.end))}, ${config.week.start.slice(0, 4)}</span><span class="region">Cincinnati &amp; Northern Kentucky</span></div>
<div class="nameplate">${wordmark("wm", false)}</div>
<div class="river">${riverRule("rr", true)}</div>
<p class="og-dek">Every session, show, installation and venue of the week, in one guide.</p>
<div class="progs">${lanes.map((id) => { const p = P.get(id); const pp = PROGRAM_PAGES.find((x) => x.programs.includes(id)); return `<div data-prog="${id}">${bullet(id, "xl")}<span>${esc(pp ? pp.label : p.name)}<small>${esc(fmtDateRange(p.dates.start, p.dates.end))}</small></span></div>`; }).join("")}</div>
</div>`);
const prog = (pp) => {
  const p = P.get(pp.programs[0]);
  const dow = fmtDowRange(p.dates.start, p.dates.end);
  return page(`<div class="og" data-prog="${p.id}">
<div class="folio oxford label tnum"><span class="vol">Program guide</span><span class="today">${esc(fmtDateRange(config.week.start, config.week.end))}, ${config.week.start.slice(0, 4)}</span><span class="region">Cincinnati &amp; Northern Kentucky</span></div>
<div class="p-name"><span class="prog-u">${esc(pp.label)}</span></div>
<div class="p-when">${bullet(p.id).replace('class="bullet"', 'class="bullet xxl"')}<span>${esc([dow, fmtDateRange(p.dates.start, p.dates.end)].filter(Boolean).join(" · "))}</span></div>
<div class="p-foot">${wordmark("wm", false)}<span>${esc(config.siteTagline)}</span></div>
</div>`);
};

const pages = new Map([["og.png", home], ...PROGRAM_PAGES.filter((pp) => P.has(pp.programs[0])).map((pp) => [`og-${pp.programs[0]}.png`, prog(pp)])]);
const TYPES = { ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/og/")) { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(pages.get(u.pathname.slice(4))); return; }
  const f = path.join(DOCS, u.pathname);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); res.end(d); });
}).listen(0);
const port = server.address().port;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, colorScheme: "light" });
const tab = await ctx.newPage();
for (const name of pages.keys()) {
  await tab.goto(`http://localhost:${port}/og/${name}`, { waitUntil: "networkidle" });
  await tab.evaluate(() => document.fonts.ready);
  await tab.screenshot({ path: path.join(ROOT, "site", name) });
  console.log(`site/${name}`);
}
await browser.close();
server.close();
