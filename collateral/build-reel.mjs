#!/usr/bin/env node
/* ============================================================
   collateral/build-reel.mjs — "The Interchange", a 22-second Reel (1080×1920, 30 fps) with its own score.

     node collateral/build-reel.mjs                    # render frames, score, mux → collateral/reel-2026-09/
     node collateral/build-reel.mjs stills 0.6,2.4,4   # review PNGs at those seconds (plus the audit)
     node collateral/build-reel.mjs audio              # the score only (WAV + loudness report)

   Needs Playwright (NODE_PATH=/opt/node22/lib/node_modules) and an ffmpeg with libx264 and aac
   (`pip install imageio-ffmpeg` provides one; or set FFMPEG). Reads docs/ (build the site first).

   The storyboard is collateral/reel-2026-09/brag-plan.md: every position below is in output pixels
   and comes from it. Scenes 1–3, 5 and 6 are drawn on the stage from the site's own parts (tokens,
   fonts, the bullet sprite, logo.svg, mark.svg, the river rule) and its own data; scene 4 is the real
   site, docs/schedule.html, running live in a phone on the browser's installed clock. Every sentence
   and count is read from docs/ or data/ at render time and asserted, so a data change fails the
   render instead of shipping stale copy. Two audits run on every frame (collateral/lib/reel-stage.mjs):
   reading time and the Reels safe zone.
   ============================================================ */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { sprite, bullet } from "../build/core/icons.mjs";
import { FPS, W, H, FFMPEG, serve, EASE_JS, PHONE, PHONE_CSS, phoneHtml, TAP_HTML, TAP_JS, AUDIT_JS, auditReport, easeInOut } from "./lib/reel-stage.mjs";
import { renderScore } from "./lib/reel-score.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = path.join(ROOT, "docs");
const OUT = path.join(ROOT, "collateral", "reel-2026-09");
const WORK = path.join(ROOT, ".cache", "reel");
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(WORK, { recursive: true });
const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));

const DURATION = 22, NF = DURATION * FPS;
const COVER_T = 2.4;                                   // the cover: S1 settled (brag-plan.md "Cover frame")
const CLOCK = Date.UTC(2026, 9, 1, 13, 41, 0);         // Thu, Oct 1, 2026, 9:41 AM EDT: before the week, no "Now" states
const argv = process.argv.slice(2);
const mode = argv[0] === "stills" ? "stills" : argv[0] === "audio" ? "audio" : "video";
const stillTimes = mode === "stills" ? (argv[1] || "0.3,0.6,1.2,2.4,2.8,3.4,6.2,6.45,6.7,7.8,8.8,11,12.4,12.7,13.2,13.9,15,16.2,16.6,17.8,18.7,19.2,21").split(",").map(Number) : [];

/* ---------- words and facts, read at render time (brag-plan.md "Render-time reads and assertions") ---------- */
const html = (f) => fs.readFileSync(path.join(DOCS, f), "utf8");
const txt = (s) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
const must = (f, re, what) => { const m = html(f).match(re); if (!m) throw new Error(`${f}: ${what} not found (the site changed)`); return txt(m[1]); };
const config = J("site.config.json");
const index = "index.html";
const WORDS = {
  tagline: config.siteTagline,                                                            // "Art Week, StartupCincy Week and BLINK in one guide"
  folioDate: must(index, /data-folio-date>([^<]+)</, "folio date"),                       // "Oct 3–11, 2026"
  region: must(index, /class="region">([^<]+)</, "folio region"),                         // "Cincinnati & Northern Kentucky"
  interchange: must(index, /class="wk-x[^"]*"[^>]*>([^<]+)</, "Interchange label"),
  thuSummary: must(index, /data-date="2026-10-08">[\s\S]*?class="wk-sum">([\s\S]*?)<svg/, "Thursday week-line summary"),
  motto: must(index, /class="motto">([\s\S]*?)<\/p>/, "motto"),                           // "Juncta juvant: things joined together help."
  mottoNote: must(index, /class="motto-note">([\s\S]*?)<\/p>/, "motto note"),
  independent: must(index, /class="footer-base"><span>([^<]+)</, "footer independence line").split(". ")[0] + ".",
  url: config.siteBase.replace(/^https:\/\//, "").replace(/\/$/, ""),
};
const tagRows = (() => { const m = WORDS.tagline.match(/^(Art Week), (StartupCincy Week) (and BLINK) (in one guide)$/); if (!m) throw new Error(`tagline changed: ${WORDS.tagline}`); return [`${m[1]},`, m[2], m[3], m[4]]; })();
const [mottoA, mottoB] = (() => { const m = WORDS.motto.match(/^(Juncta juvant:) (.+)$/); if (!m) throw new Error(`motto changed: ${WORDS.motto}`); return [m[1], m[2]]; })();
if (!/^Cincinnati's city motto/.test(WORDS.mottoNote)) throw new Error(`motto note changed: ${WORDS.mottoNote}`);
const THU_COUNT = Number((WORDS.thuSummary.match(/(\d+) events/) || [])[1]);
if (!/Interchange: all three run/.test(WORDS.thuSummary) || !THU_COUNT) throw new Error(`Thursday summary changed: ${WORDS.thuSummary}`);
const EV = new Map(J("data/events.json").map((e) => [e.id, e]));
const fmt12 = (hm) => { const [h, m] = hm.split(":").map(Number); return [`${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")}`, h < 12 ? "AM" : "PM"]; };
const STOPS = [
  { id: "caw-10-08-exhibitions-art-market", prog: "caw", extra: "DRAFT SCHEDULE", needTag: "draft-schedule" },
  { id: "scw-student-pitch-competition", prog: "scw" },
  { id: "blink-2026-10-08-drone-show-2030", prog: "blink" },
].map((s) => {
  const e = EV.get(s.id);
  if (!e) throw new Error(`stop ${s.id} is gone from data/events.json`);
  if (e.date !== "2026-10-08" || e.program !== s.prog || !e.start) throw new Error(`stop ${s.id} moved: ${e.date} ${e.program} ${e.start}`);
  if (e.status === "cancelled" || e.status === "changed") throw new Error(`stop ${s.id} is ${e.status}: swap or drop it`);
  if (s.needTag && !(e.tags || []).includes(s.needTag)) throw new Error(`stop ${s.id} lost its ${s.needTag} tag: drop the label`);
  const [time, ampm] = fmt12(e.start);
  return { ...s, title: e.title, time, ampm };
});
const P = new Map(J("data/programs.json").map((p) => [p.id, p]));
for (const [id, a, b] of [["caw", "2026-10-03", "2026-10-10"], ["scw", "2026-10-05", "2026-10-08"], ["blink", "2026-10-08", "2026-10-11"], ["brandfusion", "2026-10-06", "2026-10-07"], ["fotofocus", "2026-09-30", "2026-11-01"]])
  if (P.get(id)?.dates.start !== a || P.get(id)?.dates.end !== b) throw new Error(`${id} dates changed: redraw the week line`);
const svgFile = (f) => fs.readFileSync(path.join(ROOT, "site", "img", "brand", f), "utf8");
const LOGO = svgFile("logo.svg").replace(/<\?xml[^>]*>/, "").replace(/ role="img" aria-label="Cincy Week"/, ' aria-hidden="true"');
const LOGO_INNER = LOGO.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/<style>[\s\S]*?<\/style>/, "").replace('class="wm"', 'class="wm" style="fill:#1c1a17"');
if (!/class="wm" style/.test(LOGO_INNER)) throw new Error("logo.svg changed");
const RIVER_D = (svgFile("river-rule.svg").match(/<path d="([^"]+)"/) || [])[1];
if (!RIVER_D) throw new Error("river-rule.svg changed");

/* ---------- the world: the week line, in S2 coordinates (brag-plan.md "World geometry") ---------- */
const ROW = { 3: 856, 4: 928, 5: 1000, 6: 1072, 7: 1144, 8: 1216, 9: 1288, 10: 1360, 11: 1432 };
const DOW = { 3: "SAT", 4: "SUN", 5: "MON", 6: "TUE", 7: "WED", 8: "THU", 9: "FRI", 10: "SAT", 11: "SUN" };
const LANE = { caw: 300, scw: 348, blink: 396, brandfusion: 444, fotofocus: 492 };
const CAP = { x0: 274, x1: 422, y0: 1178, y1: 1254 };     // the capsule: A, S and B only

/* ---------- the stage ---------- */
const eyebrow = "font:var(--wght-strong) 40px/1.18 var(--font-body);letter-spacing:var(--track-label);text-transform:uppercase";
const stageHtml = `<!doctype html><html lang="en" data-theme="light" class="js"><head><meta charset="utf-8">
<link rel="stylesheet" href="/assets/tokens.css"><link rel="stylesheet" href="/assets/site.css"><style>
html,body{margin:0;background:var(--bg);overflow:hidden;width:${W}px;height:${H}px}
#stage{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:var(--bg);color:var(--text)}
.abs{position:absolute;left:0;top:0}
.lbl{${eyebrow};color:var(--text-muted);white-space:nowrap}
.hd{font-family:var(--font-display);font-weight:var(--wght-head);letter-spacing:var(--track-head);white-space:nowrap;color:var(--text)}
.tnum{font-variant-numeric:tabular-nums}
.bl{position:absolute;overflow:visible}
svg text{font-variant-numeric:tabular-nums}
${PHONE_CSS}
#warm{position:absolute;left:-9999px;top:0}
#stage svg{max-width:none}
#stage,#stage *,#stage *::before,#stage *::after{transition:none!important;animation:none!important}   /* the site's reduced-motion rule gives every element a 10 µs transition, which never ends on a frozen clock; the stage is a pure function of time */   /* site.css caps svg at 100% of an absolutely positioned (zero-width) parent */
#f-sched{opacity:1}
</style></head><body>${sprite()}<div id="stage">

<!-- S1 + S2: the masthead, the headline, the key and the world, under one push-in wrapper -->
<div id="s12" class="abs" style="width:${W}px;height:${H}px;transform-origin:348px 1216px">
  <svg id="world" class="abs" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
    <defs><clipPath id="wclip"><rect id="wclipr" x="0" y="780" width="${W}" height="${H}"/></clipPath></defs>
    <g clip-path="url(#wclip)"><g id="shake"><g id="cam">
      <g id="lanes"></g><g id="stations"></g><g id="labels"></g><g id="heads"></g>
      <rect id="capsule" x="${CAP.x0}" y="${CAP.y0}" width="${CAP.x1 - CAP.x0}" height="${CAP.y1 - CAP.y0}" rx="${(CAP.y1 - CAP.y0) / 2}" style="fill:var(--surface);stroke:var(--text);stroke-width:6"/>
      <text id="xlabel" x="528" y="1216" dominant-baseline="central" style="font:var(--wght-strong) 32px var(--font-body);letter-spacing:.085em;fill:var(--text)">${WORDS.interchange.toUpperCase()}</text>
    </g></g></g>
  </svg>
  <div id="mast" class="abs" style="width:${W}px;height:480px">
    <svg class="abs" style="left:64px;top:290px" width="319" height="64" viewBox="0 0 319 64" aria-hidden="true">${LOGO_INNER}</svg>
    <div class="lbl abs tnum" id="m-date" data-read="3" data-id="mast-date" style="top:302px;left:auto;right:${W - 940}px">${WORDS.folioDate.toUpperCase()}</div>
    <div class="abs" style="left:64px;top:374px;width:952px;height:4px;background:var(--rule-ink)"></div>
    <div class="abs" style="left:64px;top:384px;width:952px;height:1px;background:var(--rule-ink)"></div>
    <div class="lbl abs" data-read="3" data-id="mast-region" style="left:64px;top:400px">${WORDS.region.toUpperCase()}</div>
  </div>
  <div id="h1" class="abs" style="left:64px;top:484px">
    <div class="hd" id="h1a" data-read="2" data-id="h-three" style="position:absolute;left:0;top:0;font-size:112px;line-height:129px;transform-origin:0 50%">Three festivals.</div>
    <svg id="hcap" class="abs" style="overflow:visible" width="10" height="10" aria-hidden="true"><rect id="hcapr" rx="54" style="fill:var(--surface);stroke:var(--text);stroke-width:8"/></svg>
    <div class="hd" id="h1b" data-read="2" data-id="h-thursday" style="position:absolute;left:0;top:130px;font-size:112px;line-height:129px;transform-origin:0 50%">One <span id="thw" style="padding:0 .17em">Thursday</span>.</div>
  </div>
  <div id="key" class="abs">
    ${tagRows.map((r, i) => `<div class="krow abs" id="k${i}" style="left:64px;top:${480 + 84 * i}px;height:84px;display:flex;align-items:center">${i < 3 ? bullet(["caw", "scw", "blink"][i]).replace('class="bullet"', 'class="bullet" style="width:64px;height:64px"') : '<span style="width:64px"></span>'}<span class="hd" data-read="${r.split(" ").length}" data-id="key-${i}" style="margin-left:24px;font-size:72px;line-height:84px">${r}</span></div>`).join("")}
  </div>
</div>

<!-- S3: Thursday, three stops -->
<div id="s3" class="abs" style="width:${W}px;height:${H}px;visibility:hidden">
  <div id="sign" class="abs">
    <div class="lbl abs" data-read="1" data-id="s3-thu" style="left:64px;top:322px">THU</div>
    <div class="hd abs tnum" data-read="1" data-id="s3-8" style="left:176px;top:280px;font-size:112px;line-height:129px">8</div>
    <svg class="abs" style="left:0;top:0" width="${W}" height="480" aria-hidden="true">
      <line x1="348" y1="250" x2="348" y2="450" style="stroke:var(--prog-caw);stroke-width:20"/>
      <line x1="420" y1="250" x2="420" y2="350" style="stroke:var(--prog-scw);stroke-width:20"/>
      <line x1="492" y1="350" x2="492" y2="450" style="stroke:var(--prog-blink);stroke-width:20"/>
      <rect x="305" y="305" width="230" height="90" rx="45" style="fill:var(--surface);stroke:var(--text);stroke-width:10"/>
    </svg>
  </div>
  <div class="abs" style="left:148px;top:440px;width:4px;height:840px;background:var(--rule-ink)"></div>
  <div class="abs" style="left:130px;top:1277px;width:40px;height:6px;background:var(--rule-ink)"></div>
  ${STOPS.map((s, i) => { const cy = [520, 800, 1040][i], ty = [470, 750, 990][i]; const two = s.prog === "blink" && /^BLINK ".+" .+$/.test(s.title); const t1 = two ? s.title.replace(/ Drone Show$/, "") : s.title, t2 = two ? s.title.slice(t1.length + 1) : "";
    const words = 2 + s.title.split(" ").length + (s.extra ? s.extra.split(" ").length : 0);
    return `<div class="stop abs" id="st${i}" style="left:0;top:0">
    <div class="bl" id="stb${i}" style="left:110px;top:${cy - 40}px;width:80px;height:80px">${bullet(s.prog).replace('class="bullet"', 'class="bullet" style="width:80px;height:80px"')}</div>
    <div class="abs sttext" id="stt${i}" data-read="${words}" data-id="stop-${i}" style="left:230px;top:${ty}px;width:720px">
      <div class="hd tnum" style="font-size:72px;line-height:83px">${s.time} <span style="font:var(--wght-strong) 40px var(--font-body);letter-spacing:var(--track-label)">${s.ampm}</span></div>
      <div style="font:var(--wght-strong) 52px/59px var(--font-body);margin-top:9px;white-space:nowrap">${t1}</div>${t2 ? `<div style="font:var(--wght-strong) 52px/59px var(--font-body);white-space:nowrap">${t2}</div>` : ""}
      ${s.extra ? `<div class="lbl" style="margin-top:13px">${s.extra}</div>` : ""}
    </div></div>`; }).join("")}
</div>

<!-- S4: the real site -->
<div id="s4" class="abs" style="width:${W}px;height:${H}px;visibility:hidden">
  <div id="cam4" class="abs" style="width:${W}px;height:${H}px;transform-origin:559px 2109px">
    <div id="phwrap" class="abs" style="left:195px;top:560px">${phoneHtml("phone", ["sched"], { time: "9:41" })}</div>
    ${TAP_HTML}
  </div>
  <div id="band" class="abs" style="width:${W}px;height:540px;background:var(--bg);border-bottom:2px solid var(--border)">
    <div id="cap4" class="abs" data-read="6" data-id="count-caption" style="left:64px;top:300px;width:900px;height:185px">
      <div id="num" class="hd tnum abs" style="left:0;top:0;width:160px;text-align:right;font-size:160px;line-height:185px">1</div>
      <div class="abs" style="left:204px;top:100px;font:var(--wght-strong) 56px/64px var(--font-body);white-space:nowrap">events on Thu, Oct 8</div>
    </div>
  </div>
</div>

<!-- S5 + S6: the mark, the motto, the end card -->
<div id="s56" class="abs" style="width:${W}px;height:${H}px;visibility:hidden">
  <svg id="mark" class="abs" width="400" height="400" viewBox="0 0 64 64" style="left:340px;top:290px;overflow:visible;transform-origin:0 0" aria-hidden="true">
    <defs><clipPath id="sq"><rect x="1.5" y="1.5" width="61" height="61" rx="8"/></clipPath></defs>
    <rect x="1.5" y="1.5" width="61" height="61" rx="8" fill="#fffbf4" stroke="#1c1a17" stroke-width="3"/>
    <g clip-path="url(#sq)"><rect id="m0" x="13" y="3" width="8" height="58" fill="#75295c"/><rect id="m1" x="28" y="3" width="8" height="58" fill="#c23b24"/><rect id="m2" x="43" y="3" width="8" height="58" fill="#2747c6"/></g>
    <rect x="1.5" y="1.5" width="61" height="61" rx="8" fill="none" stroke="#1c1a17" stroke-width="3"/>
    <rect id="mcap" x="7" y="21" width="50" height="22" rx="11" fill="#fffbf4" stroke="#1c1a17" stroke-width="5" style="transform-origin:32px 32px;transform-box:view-box"/>
  </svg>
  <svg id="lockup" class="abs" style="left:241px;top:290px" width="598" height="120" viewBox="0 0 319 64" aria-hidden="true"><defs><clipPath id="wmclip"><rect id="wmclipr" x="64" y="0" width="0" height="64"/></clipPath></defs><g id="lk-mark">${LOGO_INNER.split("<g")[0]}</g><g clip-path="url(#wmclip)"><g${LOGO_INNER.split("<g").slice(1).join("<g")}</g></svg>
  <div id="e-date" class="lbl abs tnum" data-read="3" data-id="end-date" style="left:0;width:${W}px;text-align:center;top:440px">${WORDS.folioDate.toUpperCase()}</div>
  <svg id="e-river" class="abs" style="left:240px;top:515px" width="600" height="44" viewBox="0 0 1200 44" preserveAspectRatio="none" aria-hidden="true"><path id="riverp" d="${RIVER_D}" fill="none" style="stroke:var(--accent)" stroke-width="4" vector-effect="non-scaling-stroke" pathLength="1000" stroke-dasharray="1000" stroke-dashoffset="1000"/></svg>
  <div id="e-bul" class="abs" style="left:304px;top:598px;display:flex;gap:28px">${["caw", "scw", "blink", "brandfusion", "fotofocus"].map((p) => `<span class="eb" style="display:block;width:72px;height:72px">${bullet(p).replace('class="bullet"', 'class="bullet" style="width:72px;height:72px"')}</span>`).join("")}</div>
  <div id="mo-lbl" class="lbl abs" data-read="3" data-id="motto-label" style="left:0;width:${W}px;text-align:center;top:760px">${"Cincinnati's city motto".toUpperCase()}</div>
  <div id="mo-a" class="abs" data-read="2" data-id="motto-a" style="left:0;width:${W}px;text-align:center;top:830px;font:italic 600 128px/147px var(--font-display);white-space:nowrap">${mottoA}</div>
  <div id="mo-b" class="hd abs" data-read="${mottoB.split(" ").length}" data-id="motto-b" style="left:0;width:${W}px;text-align:center;top:995px;font-size:64px;line-height:74px">${mottoB.split(" ").map((w, i) => `<span class="mw" id="mw${i}" style="display:inline-block">${w}</span>`).join(" ")}</div>
  <div id="e-url" class="abs" data-read="3" data-id="end-url" style="left:0;width:${W}px;text-align:center;top:1150px">
    <span style="position:relative;display:inline-block;font:var(--wght-strong) 52px/59px var(--font-body);color:var(--link)">${WORDS.url}<span id="e-ul" style="position:absolute;left:0;bottom:-6px;height:4px;width:100%;background:var(--accent);transform-origin:0 50%"></span></span></div>
  <div id="e-ind" class="abs" data-read="${WORDS.independent.split(" ").length}" data-id="end-independent" style="left:0;width:${W}px;text-align:center;top:1260px;font:400 40px/52px var(--font-body);color:var(--text-muted)">${WORDS.independent.replace(/ with /, "<br>with ")}</div>
</div>

<div id="warm" aria-hidden="true"><span class="hd">Aa</span><span style="font:italic 600 20px var(--font-display)">Aa</span><span style="font:400 20px var(--font-body)">Aa</span><span style="font:650 20px var(--font-body)">Aa</span><span style="font:620 20px var(--font-display)">Aa</span></div>
</div>
<script>
${EASE_JS}
${TAP_JS}
${AUDIT_JS}
const W=${JSON.stringify({ ROW, DOW, LANE, CAP })};
const NS="http://www.w3.org/2000/svg";
const mk=(tag,attrs,parent)=>{const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);parent.appendChild(e);return e;};
const $=(id)=>document.getElementById(id);
const P=(t,t0,d)=>clamp((t-t0)/d);
/* the head of a line moving from a to b with ease-out between t0 and t1; when does it pass y? */
const headAt=(t,a,b,t0,t1)=>lerp(a,b,out(P(t,t0,t1-t0)));
const passT=(y,a,b,t0,t1)=>{for(let i=0;i<=400;i++){const p=i/400;if(lerp(a,b,out(p))>=y-.01)return t0+p*(t1-t0);}return t1;};
/* lane runs (world): [top, headFrom, headTo, t0, t1] phases */
const LN=W.LANE,R=W.ROW,C=W.CAP;
const lanes={
  caw:{x:LN.caw,ink:"--prog-caw",top:R[3],phases:[[1026,1216,.03,.5],[1254,R[10],.55,.85]],bars:[R[3],R[10]]},
  scw:{x:LN.scw,ink:"--prog-scw",top:R[5],phases:[[1026,1216,.03,.5]],bars:[R[5]]},
  blink:{x:LN.blink,ink:"--prog-blink",top:C.y1,phases:[[C.y1,R[11],.55,1.0]],bars:[R[11]]},
  brandfusion:{x:LN.brandfusion,ink:"--prog-brandfusion",top:R[6],phases:[[R[6],R[7],2.6,2.95]],bars:[R[6],R[7]]},
  fotofocus:{x:LN.fotofocus,ink:"--prog-fotofocus",top:836,phases:[[836,1470,2.6,2.95]],bars:[],cased:true},
};
const ST={caw:[4,5,6,7,9],scw:[6,7],blink:[9,10],brandfusion:[],fotofocus:[3,4,5,6,7,8,9,10,11]};
const lg=$("lanes"),sg=$("stations"),lb=$("labels"),hg=$("heads");
for(const [id,L] of Object.entries(lanes)){
  if(L.cased){L.el2=mk("line",{x1:L.x,x2:L.x,y1:L.top,y2:L.top,style:"stroke:var(--prog-fotofocus-edge);stroke-width:16"},lg);}
  L.el=mk("line",{x1:L.x,x2:L.x,y1:L.top,y2:L.top,style:"stroke:var("+L.ink+");stroke-width:12"},lg);
  L.barEls=L.bars.map((y)=>mk("rect",{x:L.x-14,y:y-3,width:28,height:6,style:"fill:var("+L.ink+")"},lg));
  L.st=ST[id].map((d)=>({d,y:R[d],el:mk("circle",{cx:L.x,cy:R[d],r:L.cased?6:10,style:"fill:var(--surface);stroke:var("+(L.cased?"--prog-fotofocus-edge":L.ink)+");stroke-width:"+(L.cased?4:6)},sg)}));
}
const labels={};
for(const d of Object.keys(R)){const g=mk("g",{},lb);mk("text",{x:213,y:R[d],"text-anchor":"end","dominant-baseline":"central",style:"font:var(--wght-strong) 24px var(--font-body);letter-spacing:.085em;fill:"+(d==8?"var(--text)":"var(--text-muted)")},g).textContent=W.DOW[d];mk("text",{x:218,y:R[d]+2,"dominant-baseline":"central",style:"font:var(--wght-head) 44px var(--font-display);fill:"+(d==8?"var(--text)":"var(--text-muted)")},g).textContent=d;labels[d]=g;}
const headB={caw:mk("use",{href:"#b-caw",width:36,height:36},hg),scw:mk("use",{href:"#b-scw",width:36,height:36},hg),blink:mk("use",{href:"#b-blink",width:36,height:36},hg)};
/* when each station and label first appears (pops as a head passes; rows above the S1 view are simply there) */
const popT=(lane,y)=>{const L=lanes[lane];for(const [a,b,t0,t1] of L.phases){if(y>=Math.min(a,b)-.01&&y<=Math.max(a,b)+.01)return passT(y,a,b,t0,t1);}return -1;};
for(const [id,L] of Object.entries(lanes))for(const s of L.st)s.t=s.y<1026&&!L.cased?-1:popT(id,s.y);
const labelT={3:-1,4:-1,5:-1,6:popT("caw",R[6]),7:popT("caw",R[7]),8:.5,9:popT("blink",R[9]),10:popT("blink",R[10]),11:popT("blink",R[11])};
const pop=(t,t0)=>t0<0?1:t<t0?0:t<t0+.08?lerp(0,1.1,out((t-t0)/.08)):lerp(1.1,1,out((t-t0-.08)/.06));
const setPop=(el,cx,cy,s)=>{el.setAttribute("transform","translate("+cx+" "+cy+") scale("+Math.max(s,.0001)+") translate("+(-cx)+" "+(-cy)+")");el.style.opacity=s>0?1:0;};
/* the capsule around "Thursday" in the headline */
let hcapBox=null;
window.layout=()=>{const r=$("thw").getBoundingClientRect(),h=$("h1").getBoundingClientRect();hcapBox={x:r.left-h.left+2,y:r.top-h.top+14,w:r.width-4,h:108};const rc=$("hcapr");rc.setAttribute("x",hcapBox.x);rc.setAttribute("y",hcapBox.y);rc.setAttribute("width",hcapBox.w);rc.setAttribute("height",hcapBox.h);const len=2*(hcapBox.w-hcapBox.h)+Math.PI*hcapBox.h;rc.setAttribute("stroke-dasharray",len);rc.dataset.len=len;return hcapBox;};

window.render=(t,ext)=>{
  const theme=(t>=8.5&&t<16)?"dark":"light";
  if(document.documentElement.dataset.theme!==theme)document.documentElement.dataset.theme=theme;
  // scenes are hidden with visibility, not display, so the live page in the phone keeps its layout and scroll
  const vis=(id,on)=>{const e=$(id);const d=on?"visible":"hidden";if(e.style.visibility!==d)e.style.visibility=d;};
  vis("s12",t<6.5);vis("s3",t>=6.5&&t<12.5);vis("s4",t>=12.5&&t<16);vis("s56",t>=16);
  /* ---------- S1 + S2 ---------- */
  if(t<6.5){
    // camera: S1 = 2x about the capsule; S2 = identity; pull-back 2.5-3.0
    const pb=inout(P(t,2.5,.5)),k=lerp(2,1,pb),sx=lerp(560,348,pb),sy=lerp(1160,1216,pb);
    $("cam").setAttribute("transform","translate("+sx+" "+sy+") scale("+k+") translate(-348 -1216)");
    $("wclipr").setAttribute("y",lerp(780,0,pb));
    const f=Math.round(t*30),sh={15:4,16:-3,17:2}[f]||0;$("shake").setAttribute("transform","translate("+sh+" 0)");
    for(const [id,L] of Object.entries(lanes)){
      let y=L.top,started=false;
      for(const [a,b,t0,t1] of L.phases){if(t>=t0){started=true;y=headAt(t,a,b,t0,t1);}}
      if(id==="caw"&&t<.03)y=1026;if(id==="scw"&&t<.03)y=Math.max(L.top,1026);
      const y2=started||L.top<1026?y:L.top;
      L.el.setAttribute("y2",y2);if(L.el2)L.el2.setAttribute("y2",y2);
      // termini above the S1 view (A at Sat 3, S at Mon 5) are simply there; the others appear when their head arrives
      L.barEls.forEach((b,i)=>{const by=L.bars[i];b.style.opacity=((by<1026&&(id==="caw"||id==="scw"))||(started&&by<=y2+.5))?1:0;});
      for(const s of L.st)setPop(s.el,L.x,s.y,pop(t,s.t));
      if(headB[id]){const hy=id==="blink"?y:y;const show=id==="blink"?(t>=.55&&t<1.08):(t<.5);headB[id].setAttribute("x",L.x-18);headB[id].setAttribute("y",hy-18);headB[id].style.opacity=show?(id==="blink"?1-P(t,1.0,.08):1):0;}
    }
    for(const d in labels)setPop(labels[d],213,R[d],pop(t,labelT[d]));
    // the capsule slams at 0.5
    const cs=t<.5?0:outBack(P(t,.5,.1)),cscale=t<.5?0:lerp(1.3,1,cs);
    const cap=$("capsule");cap.style.opacity=t<.5?0:1;cap.setAttribute("transform","translate(348 1216) scale("+cscale+") translate(-348 -1216)");
    $("xlabel").style.opacity=P(t,3.0,.15);
    // headline (S1)
    const slam=(el,t0)=>{const p=out(P(t,t0,.17));el.style.opacity=t<t0?0:p;el.style.transform="scale("+lerp(1.12,1,p)+")";};
    const lift=inout(P(t,2.5,.15));
    $("h1").style.opacity=1-lift;$("h1").style.transform="translateY("+(-24*lift)+"px)";$("h1").style.display=t>=2.65?"none":"block";
    slam($("h1a"),.03);slam($("h1b"),.5);
    if(!hcapBox)layout();
    const rc=$("hcapr"),tr=out(P(t,.55,.25));rc.style.strokeDashoffset=String(+rc.dataset.len*(1-tr));rc.style.opacity=t<.55?0:1;rc.style.fillOpacity=String(tr);
    // key rows (S2): 2.625, 2.75, 2.875, 3.0
    [2.625,2.75,2.875,3.0].forEach((t0,i)=>{const p=out(P(t,t0,.15));const e=$("k"+i);e.style.opacity=t<t0?0:p;e.style.transform="translateX("+(-20*(1-p))+"px)";});
    // the push into the capsule, 6.35-6.5
    const pi=P(t,6.35,.15);$("s12").style.transform=pi>0?"scale("+lerp(1,3,pi*pi*pi)+")":"none";
  }
  /* ---------- S3 ---------- */
  if(t>=6.5&&t<12.5){
    const pops=[6.5,7.5,8.5];
    STOPS_N.forEach((_,i)=>{const t0=pops[i],b=$("stb"+i),x=$("stt"+i);const s=pop(t,t0);
      const breathe=(i===2&&t>=8.7&&t<12.3)?(1+.02*Math.sin((t-8.7)*Math.PI*2*.5)):1;
      b.style.opacity=t<t0?0:1;b.style.transform="scale("+(s*breathe)+")";
      const w=i===0?1:out(P(t,t0,.2));x.style.opacity=t<t0?0:1;x.style.clipPath="inset(0 "+(100-100*w)+"% 0 0)";x.style.transform="translateX("+(-12*(1-w))+"px)";
      const ex=inout(P(t,12.3+.05*i,.15));$("st"+i).style.opacity=1-ex;$("st"+i).style.transform="translateY("+(-40*ex)+"px)";});
    const ex=inout(P(t,12.45,.05));$("sign").style.opacity=1-ex;
  }
  /* ---------- S4 ---------- */
  if(t>=12.5&&t<16){
    const rise=out(P(t,12.5,.3));$("phwrap").style.transform="translateY("+(1400*(1-rise))+"px)";
    const ph=$("phone");ph.style.transform="scale(${1.64})";
    const push=inout(P(t,13.8,.45));$("cam4").style.transform="scale("+lerp(1,1.75,push)+")";
    const cap=$("cap4");cap.style.opacity=out(P(t,12.6,.1));
    $("num").textContent=String(ext.num);cap.dataset.busy=ext.counting?"1":"";
    drawTap(ext.tap);
  }
  /* ---------- S5 + S6 ---------- */
  if(t>=16){
    // stripes drop in, 16.0/16.125/16.25; the capsule slams at 16.5
    [0,1,2].forEach((i)=>{const p=out(P(t,16+.125*i,.18));$("m"+i).setAttribute("transform","translate(0 "+(-64*(1-p))+")");});
    const cs=t<16.5?0:lerp(1.3,1,outBack(P(t,16.5,.1)));const mc=$("mcap");mc.style.opacity=t<16.5?0:1;mc.style.transform="scale("+cs+")";
    const f=Math.round(t*30),sh={495:4,496:-3,497:2}[f]||0;
    // the mark: 400 px at (340,290) → 120 px at (241,290), 18.5-18.9
    const mv=inout(P(t,18.5,.4)),ms=lerp(400,120,mv);const mk2=$("mark");mk2.style.left=(lerp(340,241,mv)+sh)+"px";mk2.style.top="290px";mk2.style.width=mk2.style.height=ms+"px";
    const landed=t>=18.9;mk2.style.display=landed?"none":"block";$("lk-mark").style.opacity=landed?1:0;
    $("wmclipr").setAttribute("width",String(255*out(P(t,18.86,.26))));$("lockup").style.opacity=t<18.86&&!landed?0:1;
    $("mo-lbl").style.opacity=P(t,16.1,.15);
    const ja=out(P(t,16.5,.15));$("mo-a").style.opacity=t<16.5?0:ja;$("mo-a").style.transform="scale("+lerp(1.1,1,ja)+")";
    let busy=false;document.querySelectorAll(".mw").forEach((w,i)=>{const t0=16.75+.25*i,p=out(P(t,t0,.07));w.style.opacity=t<t0?0:p;w.style.transform="translateY("+(-18*(1-p))+"px)";if(p<1)busy=true;});$("mo-b").dataset.busy=busy?"1":"";
    const d=out(P(t,18.9,.15));$("e-date").style.opacity=d;$("e-date").style.transform="translateY("+(12*(1-d))+"px)";
    $("riverp").setAttribute("stroke-dashoffset",String(1000*(1-inout(P(t,18.9,.4)))));
    document.querySelectorAll(".eb").forEach((e,i)=>{const s=pop(t,19+.06*i);e.style.opacity=t<19+.06*i?0:1;e.style.transform="scale("+s+")";});
    const u=out(P(t,19.1,.15));$("e-url").style.opacity=u;$("e-url").style.transform="translateY("+(12*(1-u))+"px)";$("e-ul").style.transform="scaleX("+inout(P(t,19.1,.3))+")";
    const ind=out(P(t,19.3,.15));$("e-ind").style.opacity=ind;$("e-ind").style.transform="translateY("+(12*(1-ind))+"px)";
  }
  return true;
};
const STOPS_N=[0,1,2];
</script></body></html>`;

/* ---------- render ---------- */
const S = serve(DOCS);
S.html = stageHtml;

async function renderFrames() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, reducedMotion: "reduce", colorScheme: "light" });
  await ctx.addInitScript(() => { try { localStorage.setItem("cw-plan", JSON.stringify({ v: 1, e: [], w: [], t: 1 })); } catch (e) {} });
  await ctx.clock.install({ time: CLOCK - 5000 });
  await ctx.clock.pauseAt(CLOCK);   // installed clocks keep flowing in real time: pause it, so only the per-frame advance moves the site's clock
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${S.base}/__stage`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const tick = (ms = 1000 / FPS) => ctx.clock.runFor(ms);
  const F = () => page.frame({ name: "sched" });
  await F().goto(`${S.base}/schedule.html?day=2026-10-08&theme=dark`, { waitUntil: "load" });
  for (let i = 0; i < 20; i++) await tick(100);
  await F().evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.layout());

  /* live reads in the phone (fail on any mismatch) */
  const live = await F().evaluate(() => {
    const cards = [...document.querySelectorAll('.slot-cards article.ev[data-day="2026-10-08"]')].filter((e) => e.offsetParent);
    const rc = document.querySelector("[data-result-count] b");
    const tab = document.querySelector('#dt-2026-10-08 [data-dt-n], [data-day="2026-10-08"] [data-dt-n]');
    const drone = document.getElementById("e-blink-2026-10-08-drone-show-2030");
    const head = [...document.querySelectorAll("h2,h3")].find((h) => /Thursday, October 8/.test(h.textContent));
    return { cards: cards.length, result: rc ? Number(rc.textContent) : null, tab: tab ? Number(tab.textContent) : null, lastIsDrone: cards.length ? cards[cards.length - 1].id === "e-blink-2026-10-08-drone-show-2030" : false,
      droneTop: drone ? drone.getBoundingClientRect().top + scrollY : null, headTop: head ? head.getBoundingClientRect().top + scrollY : null, headText: head ? head.textContent.replace(/\s+/g, " ").trim() : null };
  });
  const COUNT = live.result;
  if (!(COUNT === live.cards && COUNT === live.tab && COUNT === THU_COUNT && live.lastIsDrone && live.droneTop != null && live.headTop != null))
    throw new Error(`live Thursday check failed: ${JSON.stringify({ ...live, weekLine: THU_COUNT })}`);
  // open with Thursday's header just under the sticky day strip: scroll near it, measure the strip's real bottom, correct
  const Y0 = await F().evaluate((top) => {
    scrollTo(0, Math.max(0, top - 220));
    let e = document.getElementById("dt-2026-10-08"); while (e && getComputedStyle(e).position !== "sticky") e = e.parentElement;
    const stripBottom = e ? e.getBoundingClientRect().bottom : 0;
    const head = [...document.querySelectorAll("h2,h3")].find((h) => /Thursday, October 8/.test(h.textContent));
    const y = Math.round(scrollY + head.getBoundingClientRect().top - stripBottom - 10);
    scrollTo(0, y); return y;
  }, live.headTop);
  const Y1 = Math.round(live.droneTop - 400);
  console.log(`live: ${COUNT} Thursday events (tab ${live.tab}, week line ${THU_COUNT}); scroll ${Y0} → ${Y1}; "${live.headText}"`);

  const frames = path.join(WORK, "frames"); fs.rmSync(frames, { recursive: true, force: true }); fs.mkdirSync(frames, { recursive: true });
  const want = new Set(stillTimes.map((s) => Math.round(s * FPS)));
  const samples = [];
  let tapped = false, toastFixed = false;
  const starSel = 'button[data-star="blink-2026-10-08-drone-show-2030"]';
  const starStage = async () => {
    const b = await F().evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, starSel);
    const fb = await page.evaluate(() => { const r = document.getElementById("f-sched").getBoundingClientRect(); return { x: r.left, y: r.top, k: r.width / 390 }; });
    const cam = await page.evaluate(() => { const r = document.getElementById("cam4").getBoundingClientRect(); return { x: r.left, y: r.top, k: r.width / 1080 }; });
    // the tap layer lives inside cam4: undo the camera
    return { x: (fb.x + b.x * fb.k - cam.x) / cam.k, y: (fb.y + b.y * fb.k - cam.y) / cam.k };
  };
  let tapPos = null;
  for (let i = 0; i < NF; i++) {
    const t = i / FPS;
    const ext = { num: 1, counting: false, tap: null };
    if (t >= 12.5 && t < 16) {
      const p = Math.min(1, Math.max(0, (t - 12.7) / 0.8)), e = easeInOut(p);
      await F().evaluate((y) => scrollTo(0, y), Math.round(Y0 + (Y1 - Y0) * e));
      ext.num = Math.round(1 + (COUNT - 1) * e); ext.counting = t < 13.5;
      if (t >= 13.75 && !tapped) { tapPos = await starStage(); await F().evaluate((s) => document.querySelector(s).click(), starSel); tapped = true; }
      if (tapPos && t - 13.75 < 0.55) ext.tap = { x: tapPos.x, y: tapPos.y, p: (t - 13.75) / 0.55 };
      if (tapped && !toastFixed) { // the site runs with reduced motion: the stage drives the toast's rise, 13.80-14.00
        const q = Math.min(1, Math.max(0, (t - 13.8) / 0.2));
        await F().evaluate((q) => { const el = document.querySelector("[data-toast]"); if (!el) return; if (q >= 1) { el.style.opacity = ""; el.style.transform = ""; return; } el.style.opacity = String(q); el.style.transform = `translate(-50%, ${12 * (1 - q)}px)`; }, q);
        if (q >= 1) toastFixed = true;
      }
    }
    await page.evaluate(([t, ext]) => window.render(t, ext), [t, ext]);
    samples.push([i, await page.evaluate(() => window.audit())]);
    if (mode === "stills") { if (want.has(i)) { await page.screenshot({ path: path.join(OUT, `still-${t.toFixed(2)}s.png`) }); } }
    else await page.screenshot({ path: path.join(frames, `${String(i).padStart(4, "0")}.png`) });
    if (i === Math.round(COVER_T * FPS)) await page.screenshot({ path: path.join(WORK, "cover.png") });
    await tick();
    if (i % 60 === 0) process.stdout.write(`\rframes ${Math.round((i / NF) * 100)}%`);
  }
  process.stdout.write("\n");
  // the toast must be the site's own words
  const toastText = await F().evaluate(() => document.querySelector("[data-toast]")?.textContent.replace(/\s+/g, " ").trim());
  if (!/^Added to My Plan\s*View$/.test(toastText || "")) console.warn(`! toast read "${toastText}"`);
  await browser.close();
  if (errors.length) throw new Error(`page errors: ${errors.join(" | ")}`);
  return { samples, frames, COUNT };
}

function report(samples) {
  const { rows, failures } = auditReport(samples);
  const lines = rows.map((r) => `${r.ok && !r.unsafeCount ? "ok  " : "FAIL"} ${r.id.padEnd(22)} ${String(r.words).padStart(2)} words  settled ${r.settled.toFixed(2)} s / need ${r.need.toFixed(2)} s  (${r.first.toFixed(2)}–${r.last.toFixed(2)})  min ${r.minPx}px${r.unsafeCount ? `  UNSAFE ×${r.unsafeCount}: ${r.unsafe[0]}` : ""}`);
  fs.writeFileSync(path.join(WORK, "audit.txt"), lines.join("\n") + "\n");
  console.log(lines.join("\n"));
  return failures;
}

try {
  if (mode === "audio") { const r = renderScore(path.join(WORK, "score.wav")); console.log(r); }
  else {
    const { samples, frames } = await renderFrames();
    const failures = report(samples);
    if (mode === "video") {
      if (failures.length) throw new Error(`${failures.length} audit failure(s): see .cache/reel/audit.txt`);
      const wav = path.join(WORK, "score.wav"); renderScore(wav);
      // the cover replaces frame 0 (brag: bake the poster in without changing the duration)
      fs.copyFileSync(path.join(WORK, "cover.png"), path.join(frames, "0000.png"));
      const mp4 = path.join(OUT, "cincy-week-reel-9x16.mp4");
      execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(frames, "%04d.png"), "-i", wav,
        "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000",
        "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-profile:v", "high", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", mp4]);
      execFileSync("python3", ["-c", `from PIL import Image; Image.open(${JSON.stringify(path.join(WORK, "cover.png"))}).convert("RGB").save(${JSON.stringify(path.join(OUT, "cover-9x16.jpg"))}, quality=92)`]);
      console.log(`${path.relative(ROOT, mp4)} (${(fs.statSync(mp4).size / 1e6).toFixed(1)} MB)`);
    }
  }
} finally { S.server.close(); }
