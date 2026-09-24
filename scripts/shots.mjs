#!/usr/bin/env node
/* ============================================================
   scripts/shots.mjs · OWNER: Agent A (core engine)
   Playwright QA screenshots (not part of npm test): every built page ×
   390 / 1440 × light / dark → .cache/shots/<page>-<width>-<theme>.png
   (first screen) and -full.png (whole page) with --full, plus a small audit
   per shot (horizontal overflow, text under 12px, touch targets under 44px
   on phones, console errors) in .cache/shots/audit.json.

   Usage (build first; the script serves docs/ itself on a free port):
     NODE_PATH=/opt/node22/lib/node_modules node scripts/shots.mjs
       [--pages index,schedule,people/abby-grimm] [--widths 390,1440] [--themes light,dark]
       [--now 2026-10-08T16:40] [--full] [--states]   (--states adds drawer, search, dialog shots)
       [--dir .cache/shots-me]   (where the PNGs and audit.json go)
     CW_OUT=.cache/out-me node build.mjs && CW_OUT=.cache/out-me NODE_PATH=… node scripts/shots.mjs
       shoots a private build (default output .cache/shots-out-me/), so parallel agents never collide.
   Playwright is not a dependency: install it globally, or point NODE_PATH at it.
   ============================================================ */
import { createRequire } from "node:module";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { console.error("Playwright not found. Run with NODE_PATH pointing at a global install, e.g. NODE_PATH=/opt/node22/lib/node_modules"); process.exit(1); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : d; };
// CW_OUT=<dir> (the same variable build.mjs takes) shoots a private build; --dir picks where the PNGs go
const DOCS = process.env.CW_OUT ? path.resolve(ROOT, process.env.CW_OUT) : path.join(ROOT, "docs");
const OUT = path.resolve(ROOT, arg("dir", process.env.CW_OUT ? path.join(".cache", `shots-${path.basename(DOCS)}`) : path.join(".cache", "shots")));
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, "site.config.json"), "utf8"));
const flag = (k) => process.argv.includes(`--${k}`);
if (!fs.existsSync(DOCS)) { console.error(`${path.relative(ROOT, DOCS)}/ does not exist yet. Run: ${process.env.CW_OUT ? `CW_OUT=${process.env.CW_OUT} ` : ""}node build.mjs`); process.exit(1); }

const allPages = (dir = DOCS, base = "") => fs.readdirSync(dir).flatMap((f) => {
  const p = path.join(dir, f), rel = base ? `${base}/${f}` : f;
  if (fs.statSync(p).isDirectory()) return f === "assets" ? [] : allPages(p, rel);
  return f.endsWith(".html") ? [rel.replace(/\.html$/, "")] : [];
});
let pages = arg("pages") ? arg("pages").split(",") : allPages();
if (!arg("pages")) { // one detail page per family is enough by default
  const seen = new Set();
  pages = pages.filter((p) => { const fam = p.includes("/") ? p.split("/")[0] : p; if (!p.includes("/")) return true; if (seen.has(fam)) return false; seen.add(fam); return true; });
}
const widths = arg("widths", "390,1440").split(",").map(Number);
const themes = arg("themes", "light,dark").split(",");
const now = arg("now", null);
const full = flag("full");

/* a tiny static server under pathPrefix (like GitHub Pages) */
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".xml": "application/xml" };
const prefix = CONFIG.pathPrefix || "/";
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.startsWith(prefix)) p = "/" + p.slice(prefix.length);
  let f = path.join(DOCS, p);
  if (f.endsWith("/")) f = path.join(f, "index.html");
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404, { "Content-Type": TYPES[".html"] }); res.end(fs.readFileSync(path.join(DOCS, "404.html"))); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); res.end(data);
  });
}).listen(0);
const port = server.address().port;
const base = `http://localhost:${port}${prefix}`;

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--ignore-certificate-errors-spki-list=KnP1OnzHv/y42eRQmbGwoYTHcSJF448m6CU5mdngwKk="] });
const audit = {};

async function open(url, w, theme) {
  const phone = w < 700;
  const ctx = await browser.newContext({ viewport: { width: w, height: phone ? 844 : 900 }, deviceScaleFactor: phone ? 2 : 1, hasTouch: phone, isMobile: phone, colorScheme: theme });
  const p = await ctx.newPage();
  const errs = [];
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("requestfailed", (r) => errs.push(`request failed: ${r.url()}`));
  p.on("response", (r) => { if (r.status() >= 400 && !r.url().endsWith("favicon.ico")) errs.push(`${r.status()} ${r.url()}`); });
  const q = new URLSearchParams({ theme }); if (now) q.set("now", now);
  await p.goto(`${url}${url.includes("?") ? "&" : "?"}${q}`, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = "eager"; }));
  await p.waitForTimeout(250);
  return { p, ctx, errs };
}
async function probe(p) {
  return p.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const overflow = document.documentElement.scrollWidth > vw + 1;
    const wide = [];
    if (overflow) document.querySelectorAll("body *").forEach((el) => { const r = el.getBoundingClientRect(); if (r.right > vw + 1 && wide.length < 6 && !el.closest(".sidebar, .sprite, .modal:not(.open), .toast")) wide.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} ${Math.round(r.right)}`); });
    let small = 0; const smallEx = [];
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (tw.nextNode()) {
      const n = tw.currentNode; if (!n.textContent.trim()) continue;
      const el = n.parentElement; if (!el || el.closest("[hidden], .sr-only, svg, .modal:not(.open)")) continue;
      const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none") continue;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      if (parseFloat(cs.fontSize) < 11.95) { small++; if (smallEx.length < 5) smallEx.push(`${n.textContent.trim().slice(0, 24)} @${cs.fontSize}`); }
    }
    let tiny = 0; const tinyEx = [];
    if (innerWidth < 700) document.querySelectorAll("a, button, summary, input, select").forEach((el) => {
      if (el.closest("[hidden], .modal:not(.open), .sidebar, .sprite, .skip-link")) return;
      const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden") return;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
      if (el.matches(".prose a, p a, dd a, cite a, .ev-where a, .source-line a, .lede a, .by a, li > a:not([class])") || el.matches(".stretched, .ev-title a, .venue h3 a, .work h3 a")) return;
      if (r.height < 43.5) { tiny++; if (tinyEx.length < 6) tinyEx.push(`${(el.className || el.tagName).toString().slice(0, 30)} ${Math.round(r.width)}×${Math.round(r.height)}`); }
    });
    return { overflow, wide, textUnder12: small, smallEx, targetsUnder44: tiny, tinyEx };
  });
}

for (const pg of pages) for (const w of widths) for (const theme of themes) {
  const name = `${pg.replace(/\//g, "--")}-${w}-${theme}`;
  const { p, ctx, errs } = await open(`${base}${pg}.html`, w, theme);
  await p.screenshot({ path: path.join(OUT, `${name}.png`) });
  if (full) await p.screenshot({ path: path.join(OUT, `${name}-full.png`), fullPage: true });
  audit[name] = { ...(await probe(p)), consoleErrors: errs };
  await ctx.close();
}

if (flag("states")) {
  const state = async (name, url, w, theme, fn) => {
    const { p, ctx, errs } = await open(`${base}${url}`, w, theme);
    await fn(p); await p.waitForTimeout(450);
    await p.screenshot({ path: path.join(OUT, `state-${name}.png`) });
    audit[`state-${name}`] = { ...(await probe(p)), consoleErrors: errs };
    await ctx.close();
  };
  await state("drawer-390-light", "schedule.html", 390, "light", (p) => p.click("[data-nav-toggle]"));
  await state("drawer-390-dark", "people.html", 390, "dark", (p) => p.click("[data-nav-toggle]"));
  await state("search-1440-light", "index.html", 1440, "light", async (p) => { await p.keyboard.press("Control+k"); await p.waitForTimeout(300); await p.keyboard.type("union"); await p.waitForTimeout(200); await p.keyboard.press("ArrowDown"); });
  await state("search-390-dark", "index.html", 390, "dark", async (p) => { await p.click(".dock [data-search-open]"); await p.waitForTimeout(300); await p.keyboard.type("blink"); });
  await state("dialog-1440-light", "schedule.html", 1440, "light", async (p) => { await p.click(".ev-title a"); });
  await state("dialog-390-dark", "schedule.html", 390, "dark", async (p) => { await p.click(".ev-title a"); });
  await state("rail-1440-light", "people.html", 1440, "light", (p) => p.click("[data-nav-toggle]"));
}

await browser.close();
server.close();
fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify(audit, null, 1));
let bad = 0;
for (const [k, v] of Object.entries(audit)) {
  const issues = [v.overflow && `overflow ${v.wide.join(", ")}`, v.textUnder12 && `${v.textUnder12} text <12px (${v.smallEx.join("; ")})`, v.targetsUnder44 && `${v.targetsUnder44} targets <44px (${v.tinyEx.join("; ")})`, v.consoleErrors.length && `errors: ${v.consoleErrors.slice(0, 3).join(" | ")}`].filter(Boolean);
  if (issues.length) { bad++; console.log(`✗ ${k}: ${issues.join(" · ")}`); }
}
console.log(`${Object.keys(audit).length} shots → ${path.relative(ROOT, OUT)}/ (${bad} with issues)`);
