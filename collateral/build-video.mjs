#!/usr/bin/env node
/* ============================================================
   collateral/build-video.mjs — a 32-second walkthrough of Cincy Week on a phone.

     node collateral/build-video.mjs                 # both cuts: 9:16 (1080×1920) and 4:5 (1080×1350)
     node collateral/build-video.mjs 9x16            # one cut
     node collateral/build-video.mjs stills 9x16 3,8.5,13   # PNG stills at those seconds (for review)

   Needs Playwright (NODE_PATH=/opt/node22/lib/node_modules) and an ffmpeg with libx264
   (`pip install imageio-ffmpeg` provides one; or set FFMPEG=/path/to/ffmpeg). Reads docs/ (build
   the site first) and never writes to it.

   How it works. The phone is the quickstart set's iPhone drawing. Its screen is the real site,
   served from docs/ and running live in iframes at a phone's size (390×710 css px). The browser's
   clock is installed at Thursday, Oct 8, 2026, 7:30 PM Eastern (BLINK's opening night) and advanced
   one frame at a time, so the site's own "now" states, timers and toasts move with the video, not
   with how long a frame takes to render. Every scroll is set per frame, every tap is a real click on
   the real element (except links that would leave the page: those show the tap, then the next page,
   preloaded in a second iframe, slides in). A touch ripple is drawn where each tapped element is.
   Captions are the site's own words where it has them (see CAPTIONS). Frames are JPEG screenshots,
   encoded to H.264 at 30 fps.
   ============================================================ */
import { createRequire } from "node:module";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { sprite, wordmark, riverRule, bullet } from "../build/core/icons.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = path.join(ROOT, "docs");
const OUTDIR = path.join(ROOT, "collateral", "video-2026-09");
const WORK = path.join(ROOT, ".cache", "video");
fs.mkdirSync(OUTDIR, { recursive: true });
const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const config = J("site.config.json");
const NEVENTS = J("data/events.json").length;
const URL_SHORT = config.siteBase.replace(/^https:\/\//, "").replace(/\/$/, "");
const FFMPEG = process.env.FFMPEG || (() => { try { return execFileSync("python3", ["-c", "import imageio_ffmpeg as f;print(f.get_ffmpeg_exe())"]).toString().trim(); } catch { return "ffmpeg"; } })();

const FPS = 30, DURATION = 32, NF = FPS * DURATION;
const CLOCK = Date.UTC(2026, 9, 8, 23, 30, 0); // Thu, Oct 8, 2026, 7:30 PM EDT
const argv = process.argv.slice(2);
const mode = argv[0] === "stills" ? "stills" : "video";
const cuts = (mode === "stills" ? [argv[1] || "9x16"] : argv[0] ? [argv[0]] : ["9x16", "4x5"]);
const stillTimes = mode === "stills" ? (argv[2] || "1,3,6,8.5,11,13,16,18,21,23,26,28,31").split(",").map(Number) : [];

/* ---------- words ---------- */
const read = (f, re) => { const m = fs.readFileSync(path.join(DOCS, f), "utf8").match(re); if (!m) throw new Error(`${f}: ${re} not found (the site changed)`); return m[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim(); };
const W = {
  tagline: config.siteTagline,
  weekHead: read("index.html", /id="wk-h"[^>]*>([\s\S]*?)<\/h2>/),
  mapKick: read("map.html", /<p class="kicker[^"]*">([\s\S]*?)<\/p>/).replace(/^\d\s*Plan\s*·\s*/, ""),
  searchPh: read("index.html", /placeholder="([^"]+)"[^>]*data-search-input/),
  planLede: read("plan.html", /<p class="lede">([\s\S]*?)<\/p>/).split(". ")[0],
  independent: read("index.html", /<div class="footer-base"><span>([\s\S]*?)<\/span>/),
};
/* captions: [start second, kicker, text]. Hand-written: "What's on now, and what's next." and the
   kickers; the rest are the site's own words or a count from data/. */
const CAPTIONS = [
  [1.5, "Cincy Week", `${W.tagline}.`],
  [3.0, "At this hour", "What's on now, and what's next."],
  [5.3, "The week", `${W.weekHead}.`],
  [7.6, "The Week", `${NEVENTS} events, by day and time.`],
  [10.3, "Star it", "Star what you want to see; it goes to My Plan."],
  [15.2, "Map", `${W.mapKick[0].toUpperCase()}${W.mapKick.slice(1)}.`],
  [19.8, "Search", `${W.searchPh}.`],
  [24.9, "My Plan", `${W.planLede}.`],
  [28.9, "", ""],
];

/* ---------- server: docs/ plus the stage ---------- */
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".ics": "text/calendar" };
let stageHtml = "";
const server = http.createServer((q, r) => {
  const u = new URL(q.url, "http://x");
  if (u.pathname === "/__stage") { r.writeHead(200, { "Content-Type": TYPES[".html"] }); r.end(stageHtml); return; }
  let f = path.join(DOCS, decodeURIComponent(u.pathname)); if (f.endsWith("/")) f += "index.html";
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); r.end(d); });
}).listen(0);
const BASE = `http://localhost:${server.address().port}`;

/* ---------- the stage ---------- */
const PHONE = { w: 390, vp: 710, status: 50, toolbar: 84, bezel: 12, band: 3.5, radius: 54 };
const PHONE_H = PHONE.status + PHONE.vp + PHONE.toolbar + 2 * (PHONE.bezel + PHONE.band); // 875
const LAYOUT = {
  "9x16": { cssW: 720, cssH: 1280, phoneScale: 1.14, phoneX: (720 - 1.14 * (PHONE.w + 2 * (PHONE.bezel + PHONE.band))) / 2, phoneY: 258, capX: 48, capY: 104, capW: 624, capSize: 38 },
  "4x5": { cssW: 720, cssH: 900, phoneScale: 0.9, phoneX: 32, phoneY: 58, capX: 440, capY: 150, capW: 244, capSize: 30 },
};
const lockSvg = `<svg class="lock" viewBox="0 0 11 13" aria-hidden="true"><rect x=".5" y="5.5" width="10" height="7" rx="1.6" fill="currentColor"/><path d="M2.7 5.6V3.9a2.8 2.8 0 0 1 5.6 0v1.7" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>`;
const statusIcons = `<span class="st-icons" aria-hidden="true"><svg width="19" height="12" viewBox="0 0 19 12"><rect x="0" y="8" width="3.2" height="4" rx=".8" fill="currentColor"/><rect x="5.2" y="5.5" width="3.2" height="6.5" rx=".8" fill="currentColor"/><rect x="10.4" y="3" width="3.2" height="9" rx=".8" fill="currentColor"/><rect x="15.6" y="0" width="3.2" height="12" rx=".8" fill="currentColor"/></svg><svg width="17" height="12" viewBox="0 0 17 12"><path d="M8.5 11.6 6.1 9.2a3.4 3.4 0 0 1 4.8 0z" fill="currentColor"/><path d="M3.7 6.8a6.8 6.8 0 0 1 9.6 0l-1.4 1.4a4.8 4.8 0 0 0-6.8 0z" fill="currentColor"/><path d="M1.2 4.3a10.4 10.4 0 0 1 14.6 0l-1.4 1.4a8.4 8.4 0 0 0-11.8 0z" fill="currentColor"/></svg><svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.6" fill="none" stroke="currentColor" stroke-opacity=".45"/><rect x="2.3" y="2.3" width="19.4" height="8.4" rx="2.2" fill="currentColor"/><path d="M25 4.4v4.2c.9-.3 1.5-1.1 1.5-2.1s-.6-1.8-1.5-2.1z" fill="currentColor" fill-opacity=".5"/></svg></span>`;
const SLOTS = ["home", "sched", "map", "venue", "plan"];
const stage = (L) => `<!doctype html><html lang="en" data-theme="light" class="js"><head><meta charset="utf-8">
<link rel="stylesheet" href="/assets/tokens.css"><link rel="stylesheet" href="/assets/site.css"><style>
html,body{margin:0;background:var(--bg);overflow:hidden}
#stage{position:relative;width:${L.cssW}px;height:${L.cssH}px;overflow:hidden;background:var(--bg)}
.folio{position:absolute;left:${L === LAYOUT["4x5"] ? 440 : 48}px;right:${L === LAYOUT["4x5"] ? 36 : 48}px;top:${L === LAYOUT["4x5"] ? 58 : 44}px;font-size:11px}
#cap{position:absolute;left:${L.capX}px;top:${L.capY}px;width:${L.capW}px}
.cap{position:absolute;left:0;top:0;width:100%}
.cap .k{font:var(--wght-strong) 13px/1.2 var(--font-body);letter-spacing:.14em;text-transform:uppercase;color:var(--accent-strong)}
.cap .t{margin-top:12px;font:var(--wght-head) ${L.capSize}px/1.1 var(--font-display);letter-spacing:-.015em;color:var(--text);text-wrap:balance}
#brand{position:absolute;left:0;right:0;top:${L === LAYOUT["4x5"] ? 250 : 380}px;text-align:center}
#brand .wm{width:${L === LAYOUT["4x5"] ? 520 : 560}px;height:auto}
#brand .rr{width:${L === LAYOUT["4x5"] ? 560 : 600}px;height:44px;margin-top:6px}
#brand .date{margin-top:26px;font:var(--wght-strong) 16px/1 var(--font-body);letter-spacing:.14em;text-transform:uppercase;color:var(--accent-strong)}
#brand .url{margin-top:22px;font:var(--wght-head) ${L === LAYOUT["4x5"] ? 40 : 42}px/1.1 var(--font-display);color:var(--accent-strong)}
#brand .dek{margin:22px auto 0;max-width:520px;font:italic 420 22px/1.35 var(--font-display);color:var(--text-muted)}
#brand .progs{margin:30px auto 0;display:flex;justify-content:center;gap:26px}
#brand .progs span{display:flex;align-items:center;gap:8px;font:var(--wght-strong) 15px/1 var(--font-body)}
#brand .progs .bullet{width:30px;height:30px}
#brand .ind{margin-top:26px;font:500 14px/1.4 var(--font-body);color:var(--text-muted)}
#phone{position:absolute;left:${L.phoneX}px;top:${L.phoneY}px;transform-origin:0 0}
.phone-body{position:relative;padding:${PHONE.band}px;border-radius:${PHONE.radius + PHONE.bezel + PHONE.band}px;background:linear-gradient(150deg,#7a7e87 0%,#3a3d45 18%,#202228 50%,#3a3d45 82%,#8a8e97 100%);box-shadow:0 1px 0 rgba(255,255,255,.18) inset,0 40px 70px -28px rgba(40,30,20,.55)}
.bezel{padding:${PHONE.bezel}px;border-radius:${PHONE.radius + PHONE.bezel}px;background:#040507}
.screen{position:relative;width:${PHONE.w}px;border-radius:${PHONE.radius}px;overflow:hidden;background:var(--bg)}
.status{height:${PHONE.status}px;display:flex;align-items:center;justify-content:space-between;padding:4px 33px 0 50px;color:var(--text);background:var(--topbar-bg, var(--bg))}
.time{font:600 17px/1 var(--font-body)}
.st-icons{display:flex;gap:6px;align-items:center}
.island{position:absolute;top:11px;left:50%;transform:translateX(-50%);width:122px;height:35px;border-radius:18px;background:#000;z-index:5}
.vp{position:relative;width:${PHONE.w}px;height:${PHONE.vp}px;overflow:hidden;background:var(--bg)}
.vp iframe{position:absolute;left:0;top:0;width:${PHONE.w}px;height:${PHONE.vp}px;border:0;opacity:0;background:var(--bg)}
.toolbar{position:relative;height:${PHONE.toolbar}px;background:var(--surface-alt);border-top:1px solid var(--border)}
.addr{position:absolute;left:18px;right:18px;top:11px;height:44px;border-radius:22px;display:flex;align-items:center;justify-content:center;gap:7px;background:var(--surface-sunken);color:var(--text);font:500 16px/1 var(--font-body)}
.lock{width:11px;height:13px;flex:none}
.home{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);width:134px;height:5px;border-radius:3px;background:var(--text)}
.key{position:absolute;width:4px;border-radius:2px}
.key.l{left:-2.5px;background:linear-gradient(90deg,#2a2c32,#6a6e77)}
.key.r{right:-2.5px;background:linear-gradient(90deg,#6a6e77,#2a2c32)}
#tap{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;z-index:20}
#tap .dot{position:absolute;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(29,26,23,.28);border:2px solid rgba(255,255,255,.85);box-shadow:0 2px 10px rgba(0,0,0,.25)}
#tap .ring{position:absolute;border-radius:50%;border:3px solid rgba(29,26,23,.35)}
</style></head><body>${sprite()}<div id="stage">
<div class="folio oxford label tnum"><span class="vol">Cincy Week</span><span class="today">Oct 3–11, 2026</span><span class="region">${L === LAYOUT["4x5"] ? "Cincinnati" : "Cincinnati &amp; Northern Kentucky"}</span></div>
<div id="cap"><div class="cap" id="capA"><div class="k"></div><div class="t"></div></div><div class="cap" id="capB"><div class="k"></div><div class="t"></div></div></div>
<div id="brand"><div class="nameplate" style="justify-content:center">${wordmark("wm", false)}</div><div class="river">${riverRule("rr", true)}</div>
<div class="date">Oct 3–11, 2026 · Cincinnati</div>
<div class="url" id="b-url">${URL_SHORT}</div>
<p class="dek" id="b-dek">${config.siteTagline}.</p>
<div class="progs" id="b-progs">${[["caw", "Art Week"], ["scw", "StartupCincy"], ["blink", "BLINK"], ["fotofocus", "FotoFocus"]].map(([id, n]) => `<span data-prog="${id}">${bullet(id, "xl")}${n}</span>`).join("")}</div>
<div class="ind" id="b-ind">${W.independent}</div></div>
<div id="phone"><div class="phone-body">
<i class="key l" style="top:150px;height:30px"></i><i class="key l" style="top:206px;height:58px"></i><i class="key l" style="top:276px;height:58px"></i><i class="key r" style="top:226px;height:88px"></i>
<div class="bezel"><div class="screen"><div class="status"><span class="time">7:30</span>${statusIcons}</div><div class="island"></div>
<div class="vp">${SLOTS.map((s) => `<iframe name="${s}" id="f-${s}" src="about:blank"></iframe>`).join("")}</div>
<div class="toolbar"><div class="addr">${lockSvg}<span>fritzhand.github.io</span></div><div class="home"></div></div></div></div></div></div>
<div id="tap"><div class="ring"></div><div class="dot"></div></div>
</div>
<script>
const ease = (p) => p < 0 ? 0 : p > 1 ? 1 : p < .5 ? 4*p*p*p : 1 - Math.pow(-2*p+2, 3)/2;
const out = (p) => p < 0 ? 0 : p > 1 ? 1 : 1 - Math.pow(1-p, 3);
window.render = (s) => {
  const $ = (id) => document.getElementById(id);
  // phone entrance and exit
  const ph = $("phone"); const k = ${L.phoneScale};
  const inP = out((s.t - 1.0) / 0.9), exP = ease((s.t - 28.8) / 0.9);
  const y = (1 - inP) * 380 + exP * 900; ph.style.transform = "translateY(" + y + "px) scale(" + k + ")"; ph.style.opacity = String(Math.min(1, inP * 1.4) * (1 - exP));
  // slots
  for (const [name, o] of Object.entries(s.slots)) { const f = $("f-" + name); f.style.opacity = o.op; f.style.transform = "translateX(" + o.x + "px)"; f.style.zIndex = o.z; f.style.filter = o.dim ? "brightness(" + (1 - o.dim) + ")" : "none"; f.style.boxShadow = o.x > 0.5 ? "-10px 0 24px rgba(0,0,0,.18)" : "none"; }
  // captions
  const set = (el, c, a, dy) => { el.querySelector(".k").textContent = c ? c.k : ""; el.querySelector(".t").textContent = c ? c.t : ""; el.style.opacity = a; el.style.transform = "translateY(" + dy + "px)"; };
  set($("capA"), s.cap.cur, s.cap.a, (1 - s.cap.a) * 14); set($("capB"), s.cap.prev, s.cap.pa, 0);
  // brand block: intro (wordmark only, lifting away) and outro (full)
  const br = $("brand"), introA = 1 - ease((s.t - 0.85) / 0.5), outroA = ease((s.t - 29.3) / 0.7);
  br.style.opacity = String(Math.max(introA, outroA));
  const outroOnly = ["b-url", "b-dek", "b-progs", "b-ind"]; for (const id of outroOnly) $(id).style.opacity = String(outroA);
  br.style.transform = "translateY(" + (s.t < 5 ? (-60 * ease((s.t - 0.85) / 0.5)) : (1 - outroA) * 30) + "px)";
  $("cap").style.opacity = String(1 - outroA);
  // tap ripple
  const tp = $("tap");
  if (s.tap) { const p = s.tap.p; tp.style.display = "block"; tp.style.left = s.tap.x + "px"; tp.style.top = s.tap.y + "px";
    const dot = tp.querySelector(".dot"), ring = tp.querySelector(".ring");
    const press = p < .35 ? out(p / .35) : 1, fade = p < .55 ? 1 : 1 - (p - .55) / .45;
    dot.style.opacity = String(fade); dot.style.transform = "scale(" + (1.15 - .2 * press) + ")";
    const r = 20 + 46 * out(Math.max(0, (p - .2) / .8)); ring.style.width = ring.style.height = 2 * r + "px"; ring.style.left = ring.style.top = -r + "px"; ring.style.opacity = String(Math.max(0, .9 - p) * (p > .2 ? 1 : 0));
  } else tp.style.display = "none";
};
</script></body></html>`;

/* ---------- timeline helpers ---------- */
const ease = (p) => p < 0 ? 0 : p > 1 ? 1 : p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const TAP = 0.55; // seconds a ripple lasts

async function renderCut(cut) {
  const L = LAYOUT[cut];
  stageHtml = stage(L);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: L.cssW, height: L.cssH }, deviceScaleFactor: 1080 / L.cssW, reducedMotion: "reduce", colorScheme: "light" });
  // an empty plan to start, then three published Thursday items so My Plan has something to show;
  // the drone show is added on camera
  await ctx.addInitScript(() => { try { if (!localStorage.getItem("cw-plan")) localStorage.setItem("cw-plan", JSON.stringify({ v: 1, e: ["scw-student-pitch-competition", "blink-2026-10-08-ready-set-blink-opening-ceremony", "blink-2026-10-08-flip-the-switch"], w: [], t: 1 })); } catch (e) {} });
  await ctx.clock.install({ time: CLOCK });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/__stage`, { waitUntil: "load" });
  const F = (name) => page.frame({ name });
  const tick = async (ms = 1000 / FPS) => ctx.clock.runFor(ms);
  const load = async (name, url) => { await F(name).goto(`${BASE}${url}`, { waitUntil: "load" }); for (let i = 0; i < 12; i++) await tick(100); await F(name).evaluate(() => document.fonts.ready); };
  await load("home", "/index.html?theme=light");
  await load("sched", "/schedule.html?day=2026-10-08&theme=light");
  await load("map", "/map.html?theme=light");
  await F("map").evaluate(() => { const mm = window.matchMedia.bind(window); window.matchMedia = (q) => mm(/prefers-reduced-motion:\s*reduce/.test(q) ? "(max-width: 0px)" : q); });
  await load("venue", "/venues/findlay-market.html?theme=light");
  // positions measured on the real pages
  const docY = (name, sel) => F(name).evaluate((s) => { const e = document.querySelector(s); if (!e) return null; return e.getBoundingClientRect().top + scrollY; }, sel);
  const atHourY = await F("home").evaluate(() => { const h = [...document.querySelectorAll("h2,h3")].find((x) => /At this hour/.test(x.textContent)); return h ? h.getBoundingClientRect().top + scrollY : 250; });
  const wkY = await docY("home", "section.wk");
  const mapY = await docY("map", ".map-view");
  if (wkY == null || mapY == null) throw new Error("home week line or map view not found");
  const stageBox = async (name, sel, pick) => { // centre of an element, in stage css px
    const fr = F(name);
    const box = await fr.evaluate(({ s, pick }) => { let els = [...document.querySelectorAll(s)]; if (pick === "text") els = els.filter((e) => e.offsetParent); const vis = els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight; }); const e = vis[0] || els[0]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, { s: sel, pick });
    if (!box) throw new Error(`${name}: ${sel} not found`);
    const fb = await page.evaluate((n) => { const r = document.getElementById("f-" + n).getBoundingClientRect(); return { x: r.left, y: r.top, k: r.width / 390 }; }, name);
    return { x: fb.x + box.x * fb.k, y: fb.y + box.y * fb.k };
  };
  const clickIn = (name, sel) => F(name).evaluate((s) => { const e = document.querySelector(s); if (!e) throw new Error("no " + s); e.click(); }, sel);

  /* state */
  const slots = Object.fromEntries(SLOTS.map((s) => [s, { op: 0, x: 0, z: 0, dim: 0 }]));
  slots.home.op = 1; slots.home.z = 1;
  let tap = null; let z = 1;
  const scrolls = []; // { name, from, to, t0, t1, el?, x? }
  const slides = [];  // { name, sel, t0, dur }: a panel rising into place (the site itself runs with reduced motion)
  const swaps = [];   // { from, to, t0 }
  const actions = []; // [t, fn]
  const at = (t, fn) => actions.push([t, fn]);
  const scroll = (name, t0, t1, to, el = null) => scrolls.push({ name, t0, t1, to, el, from: null });
  const tapAt = (t, name, sel, then) => at(t, async () => { const p = await stageBox(name, sel); tap = { ...p, t0: t }; if (then) await then(); });
  const swap = (t, from, to) => at(t, () => { z += 1; swaps.push({ from, to, t0: t, z }); });

  // 1. home: "At this hour", then down to the week line
  scroll("home", 2.5, 3.3, Math.max(0, atHourY - 64));
  scroll("home", 4.6, 5.9, wkY - 58);
  // 2. tap Thursday on the week line -> The Week, Thursday
  tapAt(6.6, "home", 'li[data-date="2026-10-08"] .wk-link');
  swap(7.0, "home", "sched");
  // 3. filter to BLINK, scroll to the drone show, open it
  at(7.8, async () => { const h = await F("sched").evaluate(() => { const c = document.querySelector('button.chip[data-v="blink"]'); let row = c.parentElement; while (row && !(row.scrollWidth > row.clientWidth + 2 && /auto|scroll/.test(getComputedStyle(row).overflowX))) row = row.parentElement; if (!row) return null; row.setAttribute("data-video-row", "1"); const r = c.getBoundingClientRect(), rr = row.getBoundingClientRect(); return Math.max(0, row.scrollLeft + (r.right - rr.right) + 24); }); if (h != null) scrolls.push({ name: "sched", t0: 7.9, t1: 8.35, to: h, from: null, el: "[data-video-row]", x: true }); });
  tapAt(8.55, "sched", 'button.chip[data-v="blink"]', () => clickIn("sched", 'button.chip[data-v="blink"]'));
  at(9.0, async () => { const y = await docY("sched", "#e-blink-2026-10-08-drone-show-2030"); scrolls.push({ name: "sched", t0: 9.1, t1: 10.3, to: y - 250, from: null }); });
  tapAt(10.9, "sched", "#e-blink-2026-10-08-drone-show-2030 [data-open-event]", () => clickIn("sched", "#e-blink-2026-10-08-drone-show-2030 [data-open-event]"));
  slides.push({ name: "sched", sel: "#event-dialog .modal-panel", t0: 10.9, dur: 0.38 });
  // 4. in the dialog: scroll to "Add to My Plan", tap it, close
  at(11.5, async () => { scrolls.push({ name: "sched", t0: 11.8, t1: 12.6, to: 300, from: null, el: "#event-dialog .modal-body" }); });
  at(12.9, async () => { const sel = await F("sched").evaluate(() => { const b = [...document.querySelectorAll("#event-dialog button")].find((x) => /My Plan/.test(x.textContent)); if (!b) return null; b.setAttribute("data-video-star", "1"); return "[data-video-star]"; }); if (!sel) throw new Error("no Add to My Plan button"); const p = await stageBox("sched", sel); tap = { ...p, t0: 12.9 }; await clickIn("sched", sel); });
  tapAt(14.3, "sched", '#event-dialog button[aria-label="Close"]', () => clickIn("sched", '#event-dialog button[aria-label="Close"]'));
  // 5. map: tap Map in the dock, then a cluster, then a venue pin
  tapAt(14.9, "sched", 'nav.dock a[href$="map.html"]');
  at(15.0, () => F("map").evaluate((y) => scrollTo(0, y), mapY - 64));
  swap(15.25, "sched", "map");
  at(16.6, async () => {
    const sel = await F("map").evaluate(() => { const c = [...document.querySelectorAll(".pin-cluster")].map((e) => { const r = e.getBoundingClientRect(); return { e, d: Math.hypot(r.left + r.width / 2 - 195, r.top + r.height / 2 - 380), ok: r.top > 120 && r.bottom < 600 }; }).filter((o) => o.ok).sort((a, b) => a.d - b.d)[0]; if (!c) return null; c.e.setAttribute("data-video-cluster", "1"); return "[data-video-cluster]"; });
    if (!sel) throw new Error("no cluster on the map"); const p = await stageBox("map", sel); tap = { ...p, t0: 16.6 }; await clickIn("map", sel);
  });
  at(17.9, async () => {
    const sel = await F("map").evaluate(() => { const c = [...document.querySelectorAll(".pin-venue, .pin-work, .pin:not(.pin-cluster)")].map((e) => { const r = e.getBoundingClientRect(); return { e, d: Math.hypot(r.left + r.width / 2 - 195, r.top + r.height / 2 - 380), ok: r.top > 120 && r.bottom < 560 }; }).filter((o) => o.ok).sort((a, b) => a.d - b.d)[0]; if (!c) return null; c.e.setAttribute("data-video-pin", "1"); return "[data-video-pin]"; });
    if (!sel) throw new Error("no pin on the map"); const p = await stageBox("map", sel); tap = { ...p, t0: 17.9 }; await clickIn("map", sel);
  });
  // 6. search from the dock, type, open the venue
  tapAt(19.6, "map", "nav.dock button[data-search-open]", () => clickIn("map", "nav.dock button[data-search-open]"));
  slides.push({ name: "map", sel: ".search-modal .modal-panel", t0: 19.6, dur: 0.34 });
  slides.push({ name: "map", sel: ".map-card", t0: 17.9, dur: 0.3 });
  const word = "Findlay Market";
  for (let i = 1; i <= word.length; i++) at(20.25 + i * 0.1, () => F("map").evaluate((v) => { const el = document.querySelector("[data-search-input]"); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); }, word.slice(0, i)));
  at(22.4, async () => {
    const sel = await F("map").evaluate(() => { const a = [...document.querySelectorAll("#search-modal a, .search-modal a, [role=option]")].find((x) => /venues\/findlay-market\.html/.test(x.getAttribute("href") || x.querySelector("a")?.getAttribute("href") || "")); if (!a) return null; a.setAttribute("data-video-hit", "1"); return "[data-video-hit]"; });
    if (!sel) throw new Error("no Findlay Market search result"); const p = await stageBox("map", sel); tap = { ...p, t0: 22.4 };
  });
  swap(22.8, "map", "venue");
  scroll("venue", 23.4, 24.2, 190);
  // 7. My Plan from the dock (loaded now, so it shows the drone show starred on camera)
  at(24.0, () => load("plan", "/plan.html?theme=light"));
  tapAt(24.7, "venue", 'nav.dock a[href$="plan.html"]');
  swap(24.95, "venue", "plan");
  at(25.9, async () => { await F("plan").evaluate(() => { const b = [...document.querySelectorAll("main button")].find((x) => /Export to calendar/.test(x.textContent)); if (!b) throw new Error("no export button"); b.setAttribute("data-video-export", "1"); }); const p = await stageBox("plan", "[data-video-export]"); tap = { ...p, t0: 25.9 }; });
  at(26.5, async () => { const y = await F("plan").evaluate(() => { const h = [...document.querySelectorAll("main h2, main h3")].find((x) => /Thursday/.test(x.textContent)); return h ? h.getBoundingClientRect().top + scrollY : null; }); if (y == null) throw new Error("no Thursday group on My Plan"); scrolls.push({ name: "plan", t0: 26.6, t1: 27.7, to: y - 120, from: null }); });
  actions.sort((a, b) => a[0] - b[0]);

  /* render */
  const frames = path.join(WORK, cut); fs.rmSync(frames, { recursive: true, force: true }); fs.mkdirSync(frames, { recursive: true });
  let ai = 0; const want = new Set(stillTimes.map((s) => Math.round(s * FPS)));
  for (let i = 0; i < NF; i++) {
    const t = i / FPS;
    while (ai < actions.length && actions[ai][0] <= t + 1e-6) { await actions[ai][1](); ai++; }
    for (const s of scrolls) {
      if (t < s.t0 || t > s.t1 + 1 / FPS) continue;
      if (s.from == null) s.from = await F(s.name).evaluate(({ el, x }) => el ? document.querySelector(el)[x ? "scrollLeft" : "scrollTop"] : scrollY, { el: s.el, x: !!s.x });
      const y = s.from + (s.to - s.from) * ease((t - s.t0) / (s.t1 - s.t0));
      await F(s.name).evaluate(({ el, y, x }) => { if (el) document.querySelector(el)[x ? "scrollLeft" : "scrollTop"] = y; else scrollTo(0, y); }, { el: s.el, y, x: !!s.x });
    }
    for (const sl of slides) {
      if (t < sl.t0 || sl.done) continue;
      const p = ease((t - sl.t0) / sl.dur);
      await F(sl.name).evaluate(({ sel, p }) => { const e = document.querySelector(sel); if (!e) return; e.style.transform = p >= 1 ? "" : "translateY(" + (100 - 100 * p) + "%)"; }, { sel: sl.sel, p });
      if (p >= 1) sl.done = true;
    }
    for (const sw of swaps) {
      if (t < sw.t0 || sw.done) continue;
      const q = Math.min(1, (t - sw.t0) / 0.42), p = 1 - Math.pow(1 - q, 3);
      slots[sw.to].z = sw.z; slots[sw.to].op = 1; slots[sw.to].x = (1 - p) * 390; slots[sw.to].dim = 0;
      slots[sw.from].x = -p * 110; slots[sw.from].dim = 0.14 * p;
      if (q >= 1) { Object.assign(slots[sw.from], { op: 0, x: 0, dim: 0 }); sw.done = true; }
    }
    const capIdx = CAPTIONS.reduce((acc, c, j) => (c[0] <= t ? j : acc), -1);
    const cur = capIdx >= 0 ? CAPTIONS[capIdx] : null, prev = capIdx > 0 ? CAPTIONS[capIdx - 1] : null;
    const since = cur ? t - cur[0] : 0;
    const cap = { cur: cur && cur[2] ? { k: cur[1], t: cur[2] } : null, prev: prev && prev[2] ? { k: prev[1], t: prev[2] } : null, a: ease(since / 0.35), pa: Math.max(0, 1 - since / 0.2) };
    const tp = tap && t - tap.t0 < TAP ? { x: tap.x, y: tap.y, p: (t - tap.t0) / TAP } : null;
    await page.evaluate((s) => window.render(s), { t, slots, cap, tap: tp });
    await tick();
    if (mode === "stills") { if (want.has(i)) { await page.screenshot({ path: path.join(OUTDIR, `still-${cut}-${t.toFixed(1)}s.png`) }); console.log(`still ${t.toFixed(1)}s`); } }
    else await page.screenshot({ path: path.join(frames, `${String(i).padStart(4, "0")}.jpg`), type: "jpeg", quality: 92 });
    if (i % 60 === 0) process.stdout.write(`\r${cut}: ${Math.round((i / NF) * 100)}%`);
  }
  await browser.close();
  if (mode === "video") {
    const out = path.join(OUTDIR, `cincy-week-walkthrough-${cut}.mp4`);
    execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(frames, "%04d.jpg"), "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]);
    execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-ss", "3.5", "-i", out, "-frames:v", "1", path.join(OUTDIR, `poster-${cut}.jpg`)]);
    console.log(`\r${path.relative(ROOT, out)} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`);
  }
}

try { for (const c of cuts) await renderCut(c); } finally { server.close(); }
