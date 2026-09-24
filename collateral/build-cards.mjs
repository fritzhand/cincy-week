#!/usr/bin/env node
/* ============================================================
   collateral/build-cards.mjs — LinkedIn and Instagram launch collateral for Cincy Week.

     node collateral/build-cards.mjs            # both decks, the LinkedIn PDF, alt text, proofs
     node collateral/build-cards.mjs linkedin   # one deck
     node collateral/build-cards.mjs instagram

   Needs Playwright (NODE_PATH=/opt/node22/lib/node_modules or any global install) and python3
   with Pillow (the 2x → 1x downsample), like scripts/og.mjs and scripts/fetch-images.py.
   Reads docs/ (build it first with node build.mjs) and never writes to it.

   Every card is drawn with the site's own tokens.css, site.css, self-hosted fonts and icon
   sprite. Every number is counted from data/ at build time, and every sentence that describes
   the site is read from the built page it describes (see WORDS below and collateral/README.md).
   Site views are real captures of docs/ served locally.

   A card is written only if it passes the checks in check(): both web fonts loaded, no text
   under 13 px, no box overflowing, and every text line inside the crop-safe frame (64 px from
   each side, 40 px top and bottom for 4:5 cards; for Stories also clear of the top 250 px and
   bottom 340 px that Instagram's own controls cover). A failing card is written as
   <file>.failed.png and the build exits 1.
   ============================================================ */
import { createRequire } from "node:module";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { sprite, wordmark, riverRule, bullet } from "../build/core/icons.mjs";
import { PROGRAM_PAGES } from "../build/nav.mjs";
import { fmtDateRange, fmtDowRange, fmtTime } from "../site/js/lib/time.js";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { console.error("Playwright not found (set NODE_PATH to a global install)."); process.exit(1); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = path.join(ROOT, "docs");
const OUT = path.join(ROOT, "collateral");
if (!fs.existsSync(path.join(DOCS, "index.html"))) { console.error("Build the site first: node build.mjs"); process.exit(1); }
const only = process.argv[2];

/* ---------- data: every number on a card is counted here ---------- */
const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const config = J("site.config.json");
const programs = J("data/programs.json");
const events = J("data/events.json");
const P = new Map(programs.map((p) => [p.id, p]));
const count = (f) => J(`data/${f}.json`).length;
const N = {
  events: events.length, people: count("people"), works: count("works"), venues: count("venues"),
  orgs: count("orgs"), stays: count("stays"), news: count("news"),
  byProg: Object.fromEntries(programs.map((p) => [p.id, events.filter((e) => e.program === p.id).length])),
  worksBlink: J("data/works.json").filter((w) => w.program === "blink").length,
};
const fmt = (n) => n.toLocaleString("en-US");
const URL_SHORT = config.siteBase.replace(/^https:\/\//, "").replace(/\/$/, "");
const REPO_SHORT = config.repo.replace(/^https:\/\//, "");
const LANES = ["caw", "scw", "blink", "fotofocus"].filter((id) => P.has(id));
const label = (id) => (PROGRAM_PAGES.find((x) => x.programs.includes(id)) || {}).label || P.get(id).name;
const YEAR = config.week.start.slice(0, 4);
const WEEK = `${fmtDateRange(config.week.start, config.week.end)}, ${YEAR}`;

/* ---------- words: read from the built pages they describe ---------- */
const page = (f) => fs.readFileSync(path.join(DOCS, f), "utf8");
const text = (html) => html.replace(/<span class="sr-only">[\s\S]*?<\/span>/g, "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
const grab = (f, re, what) => { const m = page(f).match(re); if (!m) { console.error(`✗ ${f}: could not find ${what} (the site changed; update WORDS)`); process.exit(1); } return text(m[1]); };
const WORDS = {
  headline: grab("index.html", /<h1[^>]*>([\s\S]*?)<\/h1>/, "the home page headline"),
  dek: grab("index.html", /<p class="dek[^"]*">([\s\S]*?)<\/p>/, "the home page dek"),
  weekHead: grab("index.html", /id="wk-h"[^>]*>([\s\S]*?)<\/h2>/, "the week line heading"),
  schedLede: grab("schedule.html", /<p class="lede">([\s\S]*?)<\/p>/, "the schedule lede"),
  mapKicker: grab("map.html", /<p class="kicker[^"]*">([\s\S]*?)<\/p>/, "the map kicker").replace(/^\d\s*Plan\s*·\s*/, ""),
  mapLede: grab("map.html", /<p class="lede">([\s\S]*?)<\/p>/, "the map lede"),
  planLede: grab("plan.html", /<p class="lede">([\s\S]*?)<\/p>/, "the My Plan lede"),
  aboutLede: grab("about.html", /<p class="lede">([\s\S]*?)<\/p>/, "the about lede"),
  independent: grab("index.html", /<div class="footer-base"><span>([\s\S]*?)<\/span>/, "the footer's independence line"),
  osm: "Map data © OpenStreetMap contributors (ODbL)",
  weekNote: grab("index.html", /(Each program is a line; each day is a station\.)/, "the week line's note"),
  weekOrder: grab("index.html", /(Lanes keep the same order every day\.)/, "the week line's order note"),
  sources: grab("index.html", /<p class="byline">[\s\S]*?·\s*([^·<]*Sources linked on every page)/, "the byline"),
};
if (!page("index.html").includes(WORDS.osm)) { console.error("✗ the footer no longer carries the OSM credit"); process.exit(1); }

/* ---------- card styles: the site's tokens and components, set at card size ---------- */
const CSS = `
html, body { margin: 0; background: var(--bg); color: var(--text); }
.card { box-sizing: border-box; width: 1080px; height: 1350px; padding: 64px 80px 56px; display: flex; flex-direction: column; overflow: hidden; position: relative; }
.card.story { height: 1920px; padding: 260px 88px 350px; }
.card .folio { font-size: 15px; }
.card .nameplate { justify-content: center; }
.kick { font: var(--wght-strong) 17px/1.2 var(--font-body); letter-spacing: .14em; text-transform: uppercase; color: var(--river-text, var(--accent-strong)); display: flex; align-items: center; gap: 12px; }
.kick .sec-num { font-size: 16px; }
h1.hl, h2.hl { margin: 18px 0 0; font: var(--wght-head) 78px/1.03 var(--font-display); letter-spacing: -0.02em; color: var(--text); }
h2.hl.sm { font-size: 64px; }
.lede-c { margin: 22px 0 0; font: 400 29px/1.42 var(--font-body); color: var(--text-muted); max-width: 900px; }
.dek-c { margin: 26px auto 0; font: italic 420 34px/1.3 var(--font-display); color: var(--text-muted); text-align: center; max-width: 880px; }
.rows { display: grid; gap: 0; border-top: var(--rule-heavy) solid var(--rule-ink); }
.row { display: grid; grid-template-columns: 76px 1fr auto; gap: 22px; align-items: center; padding: 20px 0; border-bottom: var(--rule-thin, 1px) solid var(--border); }
.row .bullet { width: 60px; height: 60px; }
.row b { display: block; font: var(--wght-head) 36px/1.1 var(--font-display); }
.row small { display: block; margin-top: 6px; font: 500 22px/1.3 var(--font-body); color: var(--text-muted); }
.row .n { font: var(--wght-strong) 26px/1.1 var(--font-body); color: var(--ink-text); text-align: right; white-space: nowrap; }
.row .n small { color: var(--text-muted); font-weight: 500; font-size: 18px; }
.foot { margin-top: auto; display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; border-top: var(--rule-heavy) solid var(--rule-ink); padding-top: 18px; }
.foot .wm { width: 250px; height: auto; }
.foot .u { font: var(--wght-strong) 24px/1.2 var(--font-mono, var(--font-body)); color: var(--accent-strong); white-space: nowrap; }
.foot .pg { white-space: nowrap; }
.tl { margin-top: 36px; border-top: var(--rule-heavy) solid var(--rule-ink); }
.tl-row { display: grid; grid-template-columns: 220px 56px 1fr; gap: 16px; align-items: center; padding: 18px 0; border-bottom: 1px solid var(--border); }
.tl-row .t { font: var(--wght-strong) 26px/1.2 var(--font-body); font-variant-numeric: tabular-nums; white-space: nowrap; }
.tl-row .bullet { width: 44px; height: 44px; }
.tl-row b { font: var(--wght-head) 36px/1.15 var(--font-display); }
.tl-row { padding: 26px 0; }
.foot .pg { font: var(--wght-strong) 18px/1 var(--font-body); color: var(--text-muted); letter-spacing: .08em; }
.indep { font: 500 19px/1.35 var(--font-body); color: var(--text-muted); }
.stage { margin-top: 34px; flex: 1; min-height: 0; display: flex; align-items: flex-start; justify-content: center; gap: 44px; }
.phone { flex: none; width: 400px; border-radius: 58px; padding: 14px; background: #16130f; box-shadow: 0 30px 60px rgba(29,26,23,.28), inset 0 0 0 2px #3a342c; }
.phone img { display: block; width: 372px; border-radius: 46px; }
.side { flex: 1; display: flex; flex-direction: column; gap: 22px; padding-top: 16px; }
.side p { margin: 0; font: 400 28px/1.42 var(--font-body); color: var(--text-muted); }
.pt { display: grid; grid-template-columns: 36px 1fr; gap: 14px; font: 500 26px/1.35 var(--font-body); color: var(--text); }
.pt .i { width: 30px; height: 30px; color: var(--accent-strong); margin-top: 3px; }
.shot-wide { width: 100%; border: var(--rule-mid) solid var(--rule-ink); background: var(--surface); }
.tiles { margin-top: 36px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 0; border-top: var(--rule-heavy) solid var(--rule-ink); }
.tile { padding: 22px 0 20px; border-bottom: 1px solid var(--border); }
.tile:nth-child(odd) { padding-right: 24px; border-right: 1px solid var(--border); }
.tile:nth-child(even) { padding-left: 28px; }
.tile b { display: block; font: var(--wght-head) 66px/1 var(--font-display); letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.tile span { display: block; margin-top: 8px; font: 500 23px/1.3 var(--font-body); color: var(--text-muted); }
.big-url { font: var(--wght-head) 62px/1.1 var(--font-display); color: var(--accent-strong); letter-spacing: -0.01em; word-break: keep-all; }
.credits { font: 500 21px/1.5 var(--font-body); color: var(--text-muted); }
.credits b { color: var(--text); font-weight: var(--wght-strong); }
.xday { font: var(--wght-head) 120px/1 var(--font-display); letter-spacing: -0.03em; }
.center { text-align: center; }
[data-theme="dark"] .phone { box-shadow: 0 30px 60px rgba(0,0,0,.5), inset 0 0 0 2px #4a4238; }
`;
const shell = (theme, inner, extra = "") => `<!doctype html><html lang="en" data-theme="${theme}" class="js"><head><meta charset="utf-8">
<link rel="stylesheet" href="/assets/tokens.css"><link rel="stylesheet" href="/assets/site.css"><style>${CSS}${extra}</style></head>
<body>${sprite()}${inner}</body></html>`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const icon = (name) => `<svg class="i" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const folio = (left) => `<div class="folio oxford label tnum"><span class="vol">${esc(left)}</span><span class="today">${esc(WEEK)}</span><span class="region">Cincinnati &amp; Northern Kentucky</span></div>`;
const foot = (pg) => `<div class="foot" data-box>${wordmark("wm", false)}<span class="u">${esc(URL_SHORT)}</span>${pg ? `<span class="pg tnum">${pg}</span>` : ""}</div>`;
const progRows = (withCounts) => `<div class="rows" data-box>${LANES.map((id) => {
  const p = P.get(id);
  const n = id === "blink" ? `${fmt(N.worksBlink)}<small> works of art</small>` : `${fmt(N.byProg[id])}<small> ${id === "scw" ? "sessions" : "events"}</small>`;
  return `<div class="row" data-prog="${id}">${bullet(id, "xl")}<span><b>${esc(label(id))}</b><small>${esc([fmtDowRange(p.dates.start, p.dates.end), fmtDateRange(p.dates.start, p.dates.end)].filter(Boolean).join(" · "))}</small></span>${withCounts ? `<span class="n">${n}</span>` : "<span></span>"}</div>`;
}).join("")}</div>`;
const phone = (shot) => `<div class="phone" data-box><img src="/shots/${shot}.png" alt=""></div>`;

/* ---------- the cards ---------- */
const TOTAL_LI = 8;
const pg = (n) => `${String(n).padStart(2, "0")} / ${String(TOTAL_LI).padStart(2, "0")}`;
const CARDS = {
  cover: (n) => ({
    alt: `Cover. The Cincy Week nameplate over a line drawing of the Ohio River, dated ${WEEK}. Headline: ${WORDS.headline} Below, the four programs with their dates: ${LANES.map((id) => `${label(id)}, ${fmtDateRange(P.get(id).dates.start, P.get(id).dates.end)}`).join("; ")}. Footer: ${URL_SHORT}.`,
    html: `<div class="card">${folio("Vol. 1 · Special section")}
<div class="nameplate" style="padding-top:40px">${wordmark("wm", false)}</div>
<div class="river" style="margin-top:10px">${riverRule("rr", true)}</div>
<h1 class="hl center" style="font-size:66px;margin-top:40px" data-box>${esc(WORDS.headline)}</h1>
<p class="dek-c" data-box>${esc(WORDS.dek)}</p>
<div style="margin-top:auto">${progRows(false)}</div>
<p class="indep center" style="margin:22px 0 0" data-box>${esc(WORDS.independent)}</p>
<div class="foot" data-box><span class="u">${esc(URL_SHORT)}</span>${n ? `<span class="pg tnum">${pg(n)}</span>` : ""}</div></div>`,
  }),
  week: (n) => ({
    alt: `${WORDS.weekHead}. ${WORDS.headline} A phone shows the site's week line: nine rows from Saturday, October 3 to Sunday, October 11, each with a lane for every program running that day and a one-line summary, with Thursday, October 8 marked as the interchange.`,
    html: `<div class="card">${folio("The week")}
<div class="kick" style="margin-top:44px"><span class="sec-num">1</span>${esc(WEEK)}</div>
<h2 class="hl" data-box>${esc(WORDS.weekHead)}.</h2>
<div class="stage">${phone("weekline")}<div class="side" data-box><p style="color:var(--text);font-size:31px">${esc(WORDS.headline)}</p>
<div class="pt">${icon("calendar")}<span>${esc(WORDS.weekNote)}</span></div>
<div class="pt">${icon("list")}<span>${esc(WORDS.weekOrder)}</span></div></div></div>
${foot(n && pg(n))}</div>`,
  }),
  programs: (n) => ({
    alt: `${config.siteTagline}. The four programs with their dates and counts: ${LANES.map((id) => `${label(id)}, ${fmtDateRange(P.get(id).dates.start, P.get(id).dates.end)}, ${id === "blink" ? `${N.worksBlink} works of art` : `${N.byProg[id]} ${id === "scw" ? "sessions" : "events"}`}`).join("; ")}; plus ${N.byProg.also} more happenings around town.`,
    html: `<div class="card">${folio("The programs")}
<div class="kick" style="margin-top:44px"><span class="sec-num">2</span>Four programs, one guide</div>
<h2 class="hl" data-box>${esc(config.siteTagline)}</h2>
<div style="margin-top:40px">${progRows(true)}</div>
<p class="lede-c" data-box style="margin-top:26px">Plus ${fmt(N.byProg.also)} more happenings around town, from museum shows to concerts and games.</p>
${foot(n && pg(n))}</div>`,
    srcNote: "“from museum shows to concerts and games” summarizes the kinds in data/events.json program also",
  }),
  schedule: (n) => ({
    alt: `${fmt(N.events)} events, one schedule. ${WORDS.schedLede} A phone shows The Week on Thursday, October 8: the day strip with each program's ticks, the program filters, and the evening's events.`,
    html: `<div class="card">${folio("The Week")}
<div class="kick" style="margin-top:44px"><span class="sec-num">3</span>Every day, by time</div>
<h2 class="hl" data-box>${fmt(N.events)} events, one schedule.</h2>
<div class="stage">${phone("schedule")}<div class="side" data-box><p>${esc(WORDS.schedLede)}</p>
<div class="pt">${icon("sliders")}<span>Filter by program, day, kind and neighborhood</span></div>
<div class="pt">${icon("star")}<span>Star it and it goes to My Plan</span></div>
<div class="pt">${icon("calendar")}<span>Add any event to your calendar</span></div></div></div>
${foot(n && pg(n))}</div>`,
  }),
  map: (n) => ({
    alt: `${WORDS.mapKicker}. ${WORDS.mapLede} A phone shows the Cincy Week map: numbered venue pins and program-shaped art pins over Over-the-Rhine, downtown and the riverfront, with the Connector streetcar loop.`,
    html: `<div class="card">${folio("Map")}
<div class="kick" style="margin-top:44px"><span class="sec-num">4</span>From Findlay Market to Covington</div>
<h2 class="hl sm" data-box>${esc(WORDS.mapKicker[0].toUpperCase() + WORDS.mapKicker.slice(1))}.</h2>
<div class="stage">${phone("map")}<div class="side" data-box><p>${esc(WORDS.mapLede)}</p>
<div class="pt">${icon("pin")}<span>${fmt(N.venues)} venue pages with directions and what's on</span></div>
<div class="pt">${icon("bed")}<span>${fmt(N.stays)} places to stay, room blocks first</span></div></div></div>
${foot(n && pg(n))}</div>`,
  }),
  plan: (n) => ({
    alt: `My Plan. ${WORDS.planLede} A phone shows a plan for Thursday, October 8 with starred events, a time conflict flagged, and buttons to add the plan to a calendar and share it.`,
    html: `<div class="card">${folio("My Plan")}
<div class="kick" style="margin-top:44px"><span class="sec-num">5</span>Your week, your way</div>
<h2 class="hl" data-box>Star it. It goes to My Plan.</h2>
<div class="stage">${phone("plan")}<div class="side" data-box><p>${esc(WORDS.planLede)}</p>
<div class="pt">${icon("clock")}<span>See overlaps and the walk between venues</span></div>
<div class="pt">${icon("calendar")}<span>Export the whole plan to your calendar</span></div>
<div class="pt">${icon("share")}<span>Share it with a link</span></div></div></div>
${foot(n && pg(n))}</div>`,
  }),
  sources: (n) => ({
    alt: `How it is made. ${WORDS.aboutLede} Counts: ${fmt(N.events)} events, ${fmt(N.people)} people, ${fmt(N.works)} works of art, ${fmt(N.venues)} venues, ${fmt(N.orgs)} organizations, ${fmt(N.stays)} places to stay. ${WORDS.sources}.`,
    html: `<div class="card">${folio("How it is made")}
<div class="kick" style="margin-top:44px"><span class="sec-num">6</span>${esc(WORDS.sources)}</div>
<h2 class="hl sm" data-box>Built from the organizers' own pages.</h2>
<p class="lede-c" data-box>${esc(WORDS.aboutLede)}</p>
<div class="tiles" data-box>${[[N.events, "events"], [N.people, "speakers, artists and curators"], [N.works, "works of art"], [N.venues, "venues"], [N.orgs, "sponsors and partners"], [N.stays, "places to stay"]].map(([v, l]) => `<div class="tile"><b>${fmt(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>
<p class="credits" data-box style="margin-top:24px">When an organizer hasn't published a room, an end time or an address, the guide says so. ${esc(WORDS.osm)}.</p>
${foot(n && pg(n))}</div>`,
  }),
  close: (n, ig) => ({
    alt: ig
      ? `Link in bio: ${URL_SHORT}. ${WORDS.independent} By ${config.author.name}.`
      : `${URL_SHORT}. Open source at ${REPO_SHORT}. ${WORDS.independent} By ${config.author.name}.`,
    html: `<div class="card">${folio(ig ? "Link in bio" : "Read it")}
<div class="nameplate" style="padding-top:120px">${wordmark("wm", false)}</div>
<div class="river" style="margin-top:10px">${riverRule("rr", true)}</div>
<div class="center" style="margin-top:56px" data-box><div class="kick" style="justify-content:center">${ig ? "Link in bio" : esc(WEEK)}</div><div class="big-url" style="margin-top:18px">${esc(URL_SHORT)}</div></div>
<p class="dek-c" data-box>${esc(config.siteTagline)}.</p>
<div style="margin-top:auto" class="credits center" data-box>${ig ? "" : `<p style="margin:0 0 10px">Open source: <b>${esc(REPO_SHORT)}</b></p>`}<p style="margin:0">${esc(WORDS.independent)}</p></div>
<div class="foot" data-box><span class="credits">By <b>${esc(config.author.name)}</b></span><span class="u">${esc(URL_SHORT)}</span>${n ? `<span class="pg tnum">${pg(n)}</span>` : ""}</div></div>`,
  }),
};

/* Stories: 1080x1920, text kept out of the top 250 px and bottom 340 px */
const thu = "2026-10-08";
const onThu = (id) => events.filter((e) => e.program === id && e.date <= thu && (e.end_date || e.date) >= thu).length;
const byId = new Map(events.map((e) => [e.id, e]));
const timeOf = (e) => `${(e.tags || []).includes("approximate-time") ? "About " : ""}${fmtTime(e.start)}`;
/* Thursday, one anchor per program so all three show. Art Week's only Thursday times are on its own
   unlisted schedule page (tagged draft-schedule, "plans change"); the site shows them with that label,
   and this Story uses that one item by name. Everything else must be published, not draft. */
const THU_DRAFT_OK = new Set(["caw-10-08-exhibitions-art-market"]);
const THU = ["caw-10-08-exhibitions-art-market", "scw-student-pitch-competition", "blink-2026-10-08-ready-set-blink-opening-ceremony", "blink-2026-10-08-flip-the-switch", "blink-2026-10-08-drone-show-2030"].map((id) => {
  const e = byId.get(id);
  if (!e || e.date !== thu || ((e.tags || []).includes("draft-schedule") && !THU_DRAFT_OK.has(id))) { console.error(`✗ Thursday story: ${id} is missing, moved or draft`); process.exit(1); }
  return e;
});
if (["caw", "scw", "blink"].some((p) => !THU.some((e) => e.program === p))) { console.error("✗ Thursday story: all three programs must appear"); process.exit(1); }
const STORIES = {
  "story-01-week": {
    alt: `Cincy Week, ${WEEK}. ${config.siteTagline}. ${LANES.map((id) => `${label(id)}, ${fmtDateRange(P.get(id).dates.start, P.get(id).dates.end)}`).join("; ")}. ${URL_SHORT}.`,
    html: `<div class="card story"><div class="nameplate">${wordmark("wm", false)}</div><div class="river" style="margin-top:8px">${riverRule("rr", true)}</div>
<div class="kick" style="justify-content:center;margin-top:40px">${esc(WEEK)}</div>
<p class="dek-c" data-box>${esc(config.siteTagline)}.</p>
<div style="margin-top:56px">${progRows(false)}</div>
<div class="center" style="margin-top:auto" data-box><div class="big-url" style="font-size:52px">${esc(URL_SHORT)}</div></div></div>`,
  },
  "story-02-thursday": {
    alt: `Thursday, October 8. ${WORDS.headline} That day: ${THU.map((e) => `${e.title}, ${timeOf(e)}`).join("; ")}. ${URL_SHORT}.`,
    html: `<div class="card story"><div class="kick"><span class="sec-num">★</span>The interchange</div>
<div class="xday" style="margin-top:28px" data-box>Thursday,<br>Oct 8</div>
<p class="lede-c" style="font-size:36px;color:var(--text)" data-box>${esc(WORDS.headline)}</p>
<div class="tl" data-box>${THU.map((e) => `<div class="tl-row" data-prog="${e.program}"><span class="t">${esc(timeOf(e))}</span>${bullet(e.program, "xl")}<b>${esc(e.title)}</b></div>`).join("")}</div>
<div class="center" style="margin-top:auto" data-box><div class="big-url" style="font-size:52px">${esc(URL_SHORT)}</div></div></div>`,
  },
  "story-03-link": {
    alt: `At this hour: the Cincy Week home page on a phone during the week, listing what is on now and next. ${URL_SHORT}, with room for a link sticker.`,
    html: `<div class="card story"><div class="kick" style="justify-content:center">What's on now, what's next</div>
<div class="center" style="margin-top:22px" data-box><div class="big-url" style="font-size:54px">${esc(URL_SHORT)}</div></div>
<div class="stage" style="margin-top:40px">${phone("athour")}</div></div>`,
  },
};
const STORY_CSS = `.card.story .nameplate .wm { width: 860px; } .card.story .stage .phone { zoom: 1.28; }`;

const DECKS = {
  linkedin: { dir: "linkedin-2026-09", cards: [["01-cover", CARDS.cover(1)], ["02-week", CARDS.week(2)], ["03-programs", CARDS.programs(3)], ["04-schedule", CARDS.schedule(4)], ["05-map", CARDS.map(5)], ["06-my-plan", CARDS.plan(6)], ["07-sources", CARDS.sources(7)], ["08-read-it", CARDS.close(8, false)]] },
  instagram: { dir: "instagram-2026-09", cards: [["01-cover", CARDS.cover()], ["02-week", CARDS.week()], ["03-programs", CARDS.programs()], ["04-schedule", CARDS.schedule()], ["05-map", CARDS.map()], ["06-link", CARDS.close(0, true)], ...Object.entries(STORIES)] },
};

/* ---------- server: docs/ + generated cards + captures ---------- */
const SHOTS = path.join(ROOT, ".cache", "collateral-shots");
fs.mkdirSync(SHOTS, { recursive: true });
const cardPages = new Map();
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg" };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/card/")) { res.writeHead(200, { "Content-Type": TYPES[".html"] }); res.end(cardPages.get(u.pathname.slice(6))); return; }
  let f = u.pathname.startsWith("/shots/") ? path.join(SHOTS, u.pathname.slice(7)) : path.join(DOCS, decodeURIComponent(u.pathname));
  if (f.endsWith("/")) f += "index.html";
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); res.end(d); });
}).listen(0);
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch();

/* ---------- captures of the real site ---------- */
async function captures() {
  const phoneCtx = async (init) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, colorScheme: "light", reducedMotion: "reduce" });
    if (init) await ctx.addInitScript(init);
    return ctx;
  };
  const settle = async (tab) => { await tab.evaluate(() => document.fonts.ready); await tab.waitForTimeout(400); };
  const shot = async (ctx, url, file, scrollTo, cut = 844) => {
    const tab = await ctx.newPage();
    await tab.goto(BASE + url, { waitUntil: "networkidle" });
    await settle(tab);
    let y = 0;
    if (scrollTo) y = await tab.evaluate((sel) => {
      const el = typeof sel === "string" && sel.startsWith("text:") ? [...document.querySelectorAll("main p, main div")].find((e) => e.children.length < 8 && e.textContent.trim().startsWith(sel.slice(5))) : document.querySelector(sel);
      if (!el) return -1;
      let stuck = 70; // the topbar
      let s = document.querySelector(".dt-ticks"); while (s && getComputedStyle(s).position !== "sticky") s = s.parentElement;
      if (s && sel.startsWith("text:")) stuck = parseFloat(getComputedStyle(s).top) + s.offsetHeight + 10;
      const target = sel.startsWith("text:") ? el.nextElementSibling || el : el;
      const top = target.getBoundingClientRect().top + scrollY - stuck; scrollTo(0, top); return top;
    }, scrollTo);
    if (y < 0) throw new Error(`${url}: ${scrollTo} not found`);
    await tab.waitForTimeout(300);
    /* the ?now= override labels itself "Test clock" on the page; a promo capture hides that label */
    await tab.evaluate(() => { for (const el of document.querySelectorAll("main *")) if (!el.children.length && /^test clock$/i.test(el.textContent.trim())) el.style.visibility = "hidden"; });
    await tab.screenshot({ path: path.join(SHOTS, `${file}.png`), clip: { x: 0, y: 0, width: 390, height: cut } });
    await tab.close();
  };
  const light = await phoneCtx();
  await shot(light, `/schedule.html?day=${thu}&theme=light&now=2026-10-06T12:00`, "schedule", "text:Ticks under each date", 760);
  await shot(light, "/index.html?theme=light&now=2026-09-24T12:00", "weekline", "section.wk", 760);
  await shot(light, "/map.html?theme=light", "map", ".map-view", 760);
  await shot(light, "/index.html?theme=light&now=2026-10-08T19:30", "athour", null, 844);
  const planIds = ["scw-student-pitch-competition", "blink-2026-10-08-ready-set-blink-opening-ceremony", "blink-2026-10-08-asianati-night-market", "blink-2026-10-08-flip-the-switch", "blink-2026-10-08-drone-show-2030"];
  for (const id of planIds) if (!events.some((e) => e.id === id)) throw new Error(`plan capture: no event ${id}`);
  const planCtx = await phoneCtx(`try{localStorage.setItem("cw-plan",JSON.stringify({v:1,e:${JSON.stringify(planIds)},w:[],t:Date.now()}))}catch(e){}`);
  await shot(planCtx, "/plan.html?theme=light&now=2026-10-06T12:00", "plan", "main h1", 760);
  const desk = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2, colorScheme: "light", reducedMotion: "reduce" });
  const tab = await desk.newPage();
  await tab.goto(BASE + "/index.html?theme=light&now=2026-09-24T12:00", { waitUntil: "networkidle" });
  await settle(tab);
  const wk = await tab.$("section.wk ol, section.wk .wk-list, section.wk");
  await wk.screenshot({ path: path.join(SHOTS, "weekline-desktop.png") });
  for (const c of [light, planCtx, desk]) await c.close();
  console.log("captures → .cache/collateral-shots/");
}

/* ---------- checks, run in the card page ---------- */
async function check(tab, story) {
  return tab.evaluate(({ story }) => {
    const W = 1080, H = story ? 1920 : 1350, SIDE = 64, TOP = story ? 250 : 40, BOT = story ? 340 : 40;
    const problems = [];
    for (const fam of ["Newsreader", "Public Sans"]) if (![...document.fonts].some((f) => f.family.replace(/"/g, "") === fam && f.status === "loaded")) problems.push(`web font not loaded: ${fam}`);
    const walker = document.createTreeWalker(document.querySelector(".card"), NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (el.closest("svg, .phone, .sr-only")) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      if (parseFloat(cs.fontSize) < 13) problems.push(`text under 13px: "${n.textContent.trim().slice(0, 40)}"`);
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        if (r.width < 1) continue;
        if (r.left < SIDE - 0.5 || r.right > W - SIDE + 0.5 || r.top < TOP - 0.5 || r.bottom > H - BOT + 0.5) { problems.push(`outside the safe frame: "${n.textContent.trim().slice(0, 40)}" (${Math.round(r.left)},${Math.round(r.top)}–${Math.round(r.right)},${Math.round(r.bottom)})`); break; }
      }
    }
    for (const b of document.querySelectorAll("[data-box]")) {
      const r = b.getBoundingClientRect();
      if (b.scrollHeight > b.clientHeight + 1 || b.scrollWidth > b.clientWidth + 1) problems.push(`overflows its box: ${b.className || b.tagName}`);
      if (r.bottom > H + 0.5 || r.right > W + 0.5) problems.push(`leaves the card: ${b.className || b.tagName}`);
    }
    const blocks = [...document.querySelectorAll(".card > [data-box], .card > .stage, .card > div > [data-box]")].map((b) => [b, b.getBoundingClientRect()]);
    for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
      const [a, ra] = blocks[i], [b, rb] = blocks[j];
      if (a.contains(b) || b.contains(a)) continue;
      const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ox > 2 && oy > 2) problems.push(`blocks overlap: ${a.className || a.tagName} / ${b.className || b.tagName}`);
    }
    return problems;
  }, { story });
}

/* ---------- render ---------- */
if (!fs.existsSync(path.join(SHOTS, "weekline.png")) || !only || only === "captures") await captures();
const failed = [];
const pyDown = (src, dst, w, h) => execFileSync("python3", ["-c", `from PIL import Image; Image.open(${JSON.stringify(src)}).convert("RGB").resize((${w},${h}), Image.LANCZOS).save(${JSON.stringify(dst)}, optimize=True)`]);
for (const [deckName, deck] of Object.entries(DECKS)) {
  if (only && only !== "captures" && only !== deckName) continue;
  const dir = path.join(OUT, deck.dir);
  fs.mkdirSync(dir, { recursive: true });
  const alts = [];
  for (const [id, card] of deck.cards) {
    const story = id.startsWith("story-");
    const H = story ? 1920 : 1350;
    cardPages.set(id, shell("light", card.html, story ? STORY_CSS : ""));
    const ctx = await browser.newContext({ viewport: { width: 1080, height: H }, deviceScaleFactor: 2, colorScheme: "light" });
    const tab = await ctx.newPage();
    await tab.goto(`${BASE}/card/${id}`, { waitUntil: "networkidle" });
    await tab.evaluate(() => document.fonts.ready);
    const problems = await check(tab, story);
    const big = path.join(SHOTS, `${deckName}-${id}@2x.png`);
    await tab.screenshot({ path: big });
    await ctx.close();
    const file = `${id}${story ? "" : ""}.png`;
    if (problems.length) { failed.push(`${deck.dir}/${id}: ${problems.join("; ")}`); pyDown(big, path.join(dir, `${id}.failed.png`), 1080, H); continue; }
    try { fs.unlinkSync(path.join(dir, `${id}.failed.png`)); } catch {}
    pyDown(big, path.join(dir, file), 1080, H);
    alts.push(`## ${file}\n\n${card.alt}\n`);
    console.log(`${deck.dir}/${file}`);
  }
  if (!failed.length) fs.writeFileSync(path.join(dir, "alt-text.md"), `# Alt text, ${deckName === "linkedin" ? "LinkedIn" : "Instagram"}\n\nWritten by \`node collateral/build-cards.mjs\`. Paste each entry into the matching image's alt text before posting.\n\n${alts.join("\n")}`);
  if (deckName === "linkedin" && !failed.length) {
    const all = deck.cards.map(([, c]) => `<section class="pdfpage">${c.html}</section>`).join("");
    cardPages.set("pdf", shell("light", all, "@page { size: 1080px 1350px; margin: 0 } .pdfpage { width: 1080px; height: 1350px; break-after: page; overflow: hidden }"));
    const ctx = await browser.newContext({ viewport: { width: 1080, height: 1350 } });
    const tab = await ctx.newPage();
    await tab.goto(`${BASE}/card/pdf`, { waitUntil: "networkidle" });
    await tab.evaluate(() => document.fonts.ready);
    await tab.pdf({ path: path.join(dir, "cincy-week-carousel.pdf"), width: "1080px", height: "1350px", printBackground: true, pageRanges: `1-${deck.cards.length}` });
    await ctx.close();
    console.log(`${deck.dir}/cincy-week-carousel.pdf`);
  }
  if (!failed.length) {
    const files = deck.cards.map(([id]) => path.join(dir, `${id}.png`));
    execFileSync("python3", ["-c", `
from PIL import Image
fs=${JSON.stringify(files)}
ims=[Image.open(f) for f in fs]
h=640; row=[im.resize((int(im.width*h/im.height),h), Image.LANCZOS) for im in ims]
W=sum(i.width for i in row)+24*(len(row)+1); out=Image.new("RGB",(W,h+48),(40,36,31)); x=24
for i in row: out.paste(i,(x,24)); x+=i.width+24
out.save(${JSON.stringify(path.join(dir, "proof.png"))})`]);
  }
}
await browser.close();
server.close();
if (failed.length) { console.error(`\n✗ ${failed.length} card(s) failed the checks:\n  ${failed.join("\n  ")}`); process.exit(1); }
console.log("\n✓ all cards passed: fonts, 13px minimum, safe frame, no overflow or overlap");
