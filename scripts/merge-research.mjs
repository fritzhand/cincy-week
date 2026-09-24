#!/usr/bin/env node
/* ============================================================
   scripts/merge-research.mjs · OWNER: Agent C (data)
   Research slices → data/*.json in the shapes build/core/schema.mjs validates
   (engine spec §4.3). Zero dependencies, deterministic, re-runnable:

     node scripts/merge-research.mjs            # merge, geocode (cached), validate, write data/ + data/README.md
     node scripts/merge-research.mjs --offline  # never touch the network: cache misses stay unknown
     node scripts/merge-research.mjs --check    # merge + validate, write nothing

   Input:  $CW_RESEARCH, default research/ (the frozen Sep 24, 2026 research snapshot committed in the repo:
           one folder per slice: scw-agenda, scw-info, blink-art, blink-info, caw, also, news, stay-move),
           falling back to .cache/research/. Without all eight slice folders the script refuses to run (it would write
           empty data/ files); --allow-missing overrides that for a slice under re-verification, and a
           missing file inside a present slice is logged and treated as empty.
   Cache:  research/geocode.json when present, else .cache/geocode.json (Nominatim search + reverse, ≤ 1 request/second,
           User-Agent "cincy-week-build"). Same research + same cache → byte-identical output.
   Writes: data/{programs,events,people,works,venues,orgs,stays,places,faqs,facts,news,aliases}.json
           and data/README.md (provenance, counts, every merge/drop decision, gaps).
           data/news.json is a union: items already in it (Agent G's refresher) are kept.
           Never writes data/images.json (F) or data/map.json (E).
   Rules:  never invent a fact. Unknown → null. Text is verbatim (whitespace and HTML entities
           normalized only). Every record keeps its source_url. Every judgment call below is an
           explicit, named table and is logged into data/README.md.
   ============================================================ */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { validateFile, PROGRAM_IDS, PERSON_ROLES, EVENT_KINDS, MEDIUMS, VENUE_KINDS, RELATIONSHIPS, PLACE_KINDS, REGION, MAP_REGION } from "../build/core/schema.mjs";
import { aliasKey } from "../site/js/lib/text.js";
import { txt as txtRaw, https, nz, uniq, first, sortBy, idOk, toId, nameKey, tightKey, orgKey, addrKey, brandTok, isFree, hoodFromOsm, daySpan, scrubInternal } from "./merge-lib.mjs";
import { haversine } from "../site/js/lib/geo.js";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const ARGS = new Set(process.argv.slice(2));
const OFFLINE = ARGS.has("--offline");
const CHECK = ARGS.has("--check");
const RESEARCH = process.env.CW_RESEARCH || [join(REPO, "research"), join(REPO, ".cache", "research")].find((d) => existsSync(d)) || join(REPO, "research");
const SLICES = ["scw-agenda", "scw-info", "blink-art", "blink-info", "caw", "also", "news", "stay-move"];
{ // never turn a missing research folder into empty data/ files (integration pass, 2026-09-24)
  const missing = SLICES.filter((s) => !existsSync(join(RESEARCH, s)));
  if (missing.length && !ARGS.has("--allow-missing")) {
    console.error(`merge-research: the research folder ${RESEARCH} lacks ${missing.join(", ")}.\n` +
      "The research is not in the repo, so data/*.json is the source of truth: edit it directly (see CLAUDE.md,\n" +
      "\"Maintaining the site during the week\"). Point CW_RESEARCH at a full copy of the research to regenerate data/,\n" +
      "or pass --allow-missing to treat the missing slices as empty (that drops their records).");
    process.exit(2);
  }
}
const DATA = join(REPO, "data");
const DATA_OUT = process.env.CW_DATA_OUT ? join(REPO, process.env.CW_DATA_OUT) : DATA;   // tests and dry runs write elsewhere
const CACHE_FILE = [join(REPO, "research", "geocode.json"), join(REPO, ".cache", "geocode.json")].find((f) => existsSync(f)) || join(REPO, ".cache", "geocode.json");
const CONFIG = JSON.parse(readFileSync(join(REPO, "site.config.json"), "utf8"));
const WIN = CONFIG.dataWindow;            // { start, end } — anything outside is dropped
const WEEK = CONFIG.week;                 // { start: 2026-10-03, end: 2026-10-11 }
const CAPTURE_DATE = "2026-09-24";        // the day every research slice was captured

/* ---------------------------------------------------------------- log ---------------------------------------------------------------- */
const LOG = { merge: [], drop: [], fix: [], geo: [], gap: [], input: [], qa: [] };
const note = (kind, msg) => LOG[kind].push(msg);

/* ---------------------------------------------------------------- io ---------------------------------------------------------------- */
function slice(name, file, fallback = []) {
  const p = join(RESEARCH, name, file);
  if (!existsSync(p)) { note("input", `research/${name}/${file}: missing, treated as empty`); return fallback; }
  const v = JSON.parse(readFileSync(p, "utf8"));
  note("input", `research/${name}/${file}: ${Array.isArray(v) ? `${v.length} records` : "1 object"}`);
  return v;
}

/* ---------------------------------------------------------------- text (scripts/merge-lib.mjs) ---------------------------------------------------------------- */
const txt = (s, where = "") => txtRaw(s, (m) => note("fix", `${where}: ${m}`));
const inWindow = (a, b = a) => !(b < WIN.start || a > WIN.end);
const overlapsWeek = (a, b = a) => !(b < WEEK.start || a > WEEK.end);
const byKey = (arr, key) => new Map(arr.map((r) => [key(r), r]));

/* ---------------------------------------------------------------- geocoding (Nominatim, cached) ---------------------------------------------------------------- */
const cache = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, "utf8")) : {};
let cacheDirty = false, lastCall = 0, netCalls = 0, failedCalls = 0, offlineMisses = 0;
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function nominatim(key, url) {
  if (key in cache) return cache[key];
  if (OFFLINE) { offlineMisses++; return null; }
  let out = null;
  for (let attempt = 0; attempt < 4 && out === null; attempt++) {
    const wait = (attempt ? 5000 * 2 ** attempt : 1100) - (Date.now() - lastCall);   // ≤ 1 request/second; back off on 429/5xx
    if (wait > 0) sleepSync(wait);
    lastCall = Date.now(); netCalls++;
    try {
      const raw = execFileSync("curl", ["-sS", "--max-time", "30", "-A", "cincy-week-build", "-w", "\n%{http_code}", url], { encoding: "utf8" });
      const cut = raw.lastIndexOf("\n"), status = Number(raw.slice(cut + 1)), body = raw.slice(0, cut);
      if (status === 200) out = JSON.parse(body);
      else if (status !== 429 && status < 500) { note("geo", `Nominatim HTTP ${status} for ${key}`); return null; }
    } catch (e) { if (attempt === 3) note("geo", `Nominatim request failed (${key}): ${String(e.message).split("\n")[0]}`); }
  }
  if (out === null) { failedCalls++; return null; }
  cache[key] = out; cacheDirty = true;
  if (netCalls % 25 === 0) { saveCache(); console.error(`geocode: ${netCalls} Nominatim calls, ${Object.keys(cache).length} cached`); }
  return out;
}
function saveCache() {
  if (!cacheDirty || OFFLINE) return;   // offline runs (tests) never write the shared cache
  mkdirSync(dirname(CACHE_FILE), { recursive: true });
  const sorted = Object.fromEntries(Object.keys(cache).sort().map((k) => [k, cache[k]]));
  writeFileSync(CACHE_FILE, JSON.stringify(sorted, null, 1) + "\n");
  cacheDirty = false;
}
const ADDR_KEYS = ["neighbourhood", "suburb", "quarter", "city_district", "city", "town", "village", "hamlet", "county", "state", "postcode"];
/** The research slices' own Nominatim lookups (raw/<slice>/*geocode*): points with structured addresses. A reverse
 *  lookup within 25 m of one of them reuses its address instead of calling Nominatim again. */
let SEEDS = null;
function seeds() {
  if (SEEDS) return SEEDS;
  SEEDS = [];
  const RAW = process.env.CW_RAW || join(RESEARCH, "..", "raw");
  const walkObj = (o) => {
    if (Array.isArray(o)) { o.forEach(walkObj); return; }
    if (!o || typeof o !== "object") return;
    const la = num(o.lat), lo = num(o.lon ?? o.lng);
    if (la !== null && lo !== null && o.address && typeof o.address === "object") SEEDS.push({ lat: la, lng: lo, address: Object.fromEntries(ADDR_KEYS.filter((x) => o.address[x]).map((x) => [x, o.address[x]])) });
    for (const v of Object.values(o)) if (v && typeof v === "object") walkObj(v);
  };
  const walkDir = (d) => {
    if (!existsSync(d)) return;
    for (const f of readdirSync(d).sort()) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walkDir(p);
      else if (/\.json$/.test(f) && /geocode/i.test(p)) { try { walkObj(JSON.parse(readFileSync(p, "utf8"))); } catch { /* not JSON */ } }
    }
  };
  walkDir(RAW);
  return SEEDS;
}
function reverse(lat, lng) {
  const k = `rev:${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (!(k in cache)) {
    let best = null, bd = 25;
    for (const s of seeds()) { const d = haversine({ lat, lng }, s); if (d <= bd) { bd = d; best = s; } }
    // a seed hit is cached too, so .cache/geocode.json alone reproduces the output (the raw captures are not kept)
    if (best) { cache[k] = { slim: 1, seed: 1, address: best.address }; cacheDirty = true; return best.address; }
  }
  const r = nominatim(k, `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat.toFixed(6)}&lon=${lng.toFixed(6)}&zoom=18&addressdetails=1`);
  if (r && r.address && !r.slim) { cache[k] = { slim: 1, address: Object.fromEntries(ADDR_KEYS.filter((x) => r.address[x]).map((x) => [x, r.address[x]])) }; cacheDirty = true; }
  return cache[k]?.address || null;
}
function search(q) {
  const k = `q:${q}`;
  const r = nominatim(k, `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&countrycodes=us&q=${encodeURIComponent(q)}`);
  const hit = Array.isArray(r) ? r[0] : Array.isArray(r?.hits) ? r.hits[0] : null;
  if (Array.isArray(r)) { cache[k] = { slim: 1, hits: r.slice(0, 1).map((h) => ({ lat: h.lat, lon: h.lon, osm_type: h.osm_type, osm_id: h.osm_id, place_rank: h.place_rank, addresstype: h.addresstype, display_name: h.display_name })) }; cacheDirty = true; }
  return hit || null;
}
const inRegion = (lat, lng) => lat >= REGION.s && lat <= REGION.n && lng >= REGION.w && lng <= REGION.e;
const inMap = (lat, lng) => lat >= MAP_REGION.s && lat <= MAP_REGION.n && lng >= MAP_REGION.w && lng <= MAP_REGION.e;
const num = (v) => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const round6 = (v) => (v === null ? null : Math.round(v * 1e6) / 1e6);
const meters = (a, b) => Math.round(haversine(a, b));

/* ================================================================ LOAD ================================================================ */
const R = {
  scwAgendaEvents: slice("scw-agenda", "events.json"), scwAgendaPeople: slice("scw-agenda", "people.json"), scwAgendaVenues: slice("scw-agenda", "venues.json"), scwAgendaOrgs: slice("scw-agenda", "orgs.json"),
  scwProgram: slice("scw-info", "program.json", null), scwInfoEvents: slice("scw-info", "events.json"), scwEnrich: slice("scw-info", "agenda_enrichment.json"), scwInfoVenues: slice("scw-info", "venues.json"),
  scwInfoOrgs: slice("scw-info", "orgs.json"), scwInfoStays: slice("scw-info", "stays.json"), scwFaqs: slice("scw-info", "faqs.json"), scwNews: slice("scw-info", "news.json"),
  blinkEvents: slice("blink-art", "events.json"), blinkWorks: slice("blink-art", "works.json"), blinkArtVenues: slice("blink-art", "venues.json"), blinkArtPeople: slice("blink-art", "people.json"), blinkArtPlaces: slice("blink-art", "places.json"),
  blinkProgram: slice("blink-info", "program.json", null), blinkInfoPeople: slice("blink-info", "people.json"), blinkOrgs: slice("blink-info", "orgs.json"), blinkFaqs: slice("blink-info", "faqs.json"),
  blinkInfoPlaces: slice("blink-info", "places.json"), blinkStays: slice("blink-info", "stays.json"), blinkNews: slice("blink-info", "news.json"),
  cawProgram: slice("caw", "program.json", null), cawEvents: slice("caw", "events.json"), cawPeople: slice("caw", "people.json"), cawVenues: slice("caw", "venues.json"), cawWorks: slice("caw", "works.json"),
  cawOrgs: slice("caw", "orgs.json"), cawFaqs: slice("caw", "faqs.json"), cawNews: slice("caw", "news.json"), cawStays: slice("caw", "stays.json"),
  alsoPrograms: slice("also", "programs.json"), alsoEvents: slice("also", "events.json"), alsoPeople: slice("also", "people.json"), alsoVenues: slice("also", "venues.json"), alsoOrgs: slice("also", "orgs.json"), alsoFaqs: slice("also", "faqs.json"),
  news: slice("news", "news.json"), facts: slice("news", "facts.json"),
  smStays: slice("stay-move", "stays.json"), smPlaces: slice("stay-move", "places.json"), smVenues: slice("stay-move", "venues.json"),
};

/* ================================================================ JUDGMENT TABLES (each logged in data/README.md) ================================================================ */
/** People merged across slices: [kept id, merged id, evidence]. Exact normalized-name matches merge automatically. */
const PERSON_MERGES = [
  ["jason-snell", "snellbeast", "BLINK credits \"SnellBeast\" with the map item \"Projection by Jason Snell\"; snellbeast.com (the link BLINK gives) reads \"I’m Jason Snell\"; CAW names NO GRID \"by SnellBeast\" and \"by Jason Snell\"."],
  ["mz-icar", "the-mz-icar-collective", "Same collective: CAW (Cincinnati Magazine, bio from mzicar.com) \"Mz. Icar, an anonymous art collective\"; BLINK \"The Mz.Icar Collective\" (Instagram @mz.icar)."],
];
/** Titles in the caw slice that are research annotations rather than published titles. */
const TITLE_FIX = {
  "brandon-hill": null, "isaiah-armstrong": null, "andrea-sabugo": "Photographer", "sarah-schmidt": null, "take-a-moment-studio": null,
  "oliver-barrett": null, "aaron-sechrist": null, "mz-icar": null, "chas-wiederhold": "Architect", "gee-horton": null, "bailey-elderberry": null,
  "daniel-iroh": null, "javarri-lewis": "Curatorial Advisor (Creative Collaborator)", "jason-snell": "Artist Programming Advisor (Creative Collaborator)",
};
/** Venues merged across slices: [kept id, merged id, alias to keep]. Same id in two slices merges automatically. */
const VENUE_MERGES = [
  ["union-hall", "union-hall-beer-hall", "Beer Hall at Union Hall"],
  ["caw-art-market-hq-1417-main", "cincinnati-art-week-hq", "Cincinnati Art Week HQ"],
];
/** Neighborhood texts from the research → canonical hood ids (places.json neighborhoods). Unlisted texts fall back to OpenStreetMap. */
const HOOD_TEXT = {
  "over the rhine": "over-the-rhine", "over the rhine otr": "over-the-rhine", "otr": "over-the-rhine",
  "downtown": "downtown-cbd", "downtown cbd": "downtown-cbd", "downtown central business district": "downtown-cbd", "central business district": "downtown-cbd",
  "downtown fountain district": "downtown-cbd", "fountain district": "downtown-cbd", "downtown lytle park": "downtown-cbd",
  "the banks": "the-banks", "the banks downtown riverfront": "the-banks", "the banks downtown": "the-banks", "the banks central riverfront": "the-banks",
  "findlay market": "findlay-market-district", "over the rhine findlay market": "findlay-market-district", "findlay market north over the rhine": "findlay-market-district",
  "pendleton": "pendleton", "west end": "west-end",
  "west end over the rhine": "west-end",   // Ready. Set. BLINK!: the FAQ calls it "a 5-block celebration surrounding TQL Stadium in the West End"
  "covington": "covington", "covington ky": "covington", "covington kentucky": "covington", "covington roebling point": "covington",
  "mainstrasse village": "mainstrasse-village", "mainstrasse village covington": "mainstrasse-village", "newport": "newport", "newport ky": "newport", "newport kentucky": "newport",
};
/** Canonical neighborhood display names (the stay-move names carry clarifying parentheticals). */
const HOOD_NAMES = {
  "over-the-rhine": ["Over-the-Rhine", "OTR"], "downtown-cbd": ["Downtown (Central Business District)", "Downtown"], "the-banks": ["The Banks", "The Banks"],
  "findlay-market-district": ["Findlay Market", "Findlay Market"], pendleton: ["Pendleton", "Pendleton"], "west-end": ["West End", "West End"],
  covington: ["Covington, Kentucky", "Covington"], "mainstrasse-village": ["MainStrasse Village", "MainStrasse"], newport: ["Newport, Kentucky", "Newport"],
};
/** Editorial "featured" flags, each tied to an organizer's own highlight list (SCW Week at a Glance, BLINK homepage, CAW opening day + NO GRID). FotoFocus uses its own "Featured Exhibitions" flag. */
const FEATURED = [
  "scw-sucw-2026-kickoff", "scw-community-lunch-at-washington-park", "scw-cintrifuse-annual-meeting", "scw-cincy-does-demos-best-of-demo-night-live-at-sucw",
  "scw-startupcincy-10-year-anniversary-party-presented-by-visitcincy", "scw-student-pitch-competition",
  "blink-nightly", "blink-2026-10-08-ready-set-blink-opening-ceremony", "blink-2026-10-08-drone-show-2030",
  "caw-10-03-exhibitions-art-market", "caw-10-03-caw-offsite-opening-celebration", "caw-10-07-no-grid",
];
/** Events dropped on purpose (besides "outside the data window"): [id, reason]. */
const EVENT_DROPS = [
  ["caw-10-07-no-grid-schedule-listing", "superseded by the Eventbrite listing caw-10-07-no-grid (same program, full details)"],
  ["caw-art-week-happy-hour-series", "weekly pre-week series (Wednesdays Aug 5–Oct 7); its in-week instance is caw-10-07-caw-happy-hour"],
  ["blink-2026-10-08-anm-performances-tba", "placeholder: the market lists Thursday's performances as \"To Be Announced\""],
];
/** Descriptions that are template leftovers, not text: → null. */
const DESCRIPTION_NULL = new Set(["Details coming soon.", "The Exchange at Kinley Hotel · Address"]);
/** Research tags that describe the scrape, not the event. */
const DROP_TAGS = new Set(["superseded-by-eventbrite", "not-in-agenda", "no-grid-agenda", "past", "pre-week", "not-on-view-oct-3-11", "anchor", "satellite"]);
/** Tracks that only restate the program. */
const DROP_TRACKS = new Set(["FotoFocus Biennial 2026: The Long View"]);
/** People dropped on purpose. */
const LOCATION_UNLISTED = "Location not listed";

/* ================================================================ QA AUDIT TABLES (data-accuracy audit of 2026-09-24) ================================================================
   Each entry was checked against the live source on 2026-09-24 and carries its evidence; every applied entry is
   logged under "QA audit" in data/README.md (the full check list is in .cache/qa-data.md). */
/** Exhibitions the research dated with the capture day because the page shows only "through …": the published opening. */
const QA_OPENING = {
  "also-cac-sarah-rodriguez-homespun": ["2026-07-08", "the CAC's exhibition page is dated \"July 08, 2026\" (title \"Sarah Rodriguez: Homespun | July 08, 2026\"; the CAC dates exhibition pages with their opening day, e.g. SOFTlab's \"October 17, 2024\")", "https://www.contemporaryartscenter.org/visit/exhibitions/2026/07/sarah-rodriguez-homespun"],
  "also-cac-softlab-gravity-s-rainbow": ["2024-10-17", "the CAC's page is dated \"October 17, 2024\"; Movers & Makers (2024-10-07): \"CAC to unveil gravity-defying installation on Oct. 17\"", "https://moversmakers.org/2024/10/07/cac-to-unveil-gravity-defying-installation-on-oct-17/"],
  "also-cam-gifts-from-japan": ["2026-06-22", "\"Gifts from Japan will display 18 selected works across two rotations: Rotation 1: June 22-August 24, 2026\" (the museum's announcement as published by Asia Week New York); the CAM page gives only \"Now–October 8, 2026\"", "https://asiaweekny.com/a-celebration-of-japanese-art-at-the-cincinnati-art-museum/"],
  "also-cmc-lego-jurassic-world-the-exhibition": ["2026-05-22", "CMC press release of May 19, 2026: \"LEGO® Jurassic World: The Exhibition opens this Friday, May 22, at Cincinnati Museum Center\"", "https://www.cincymuseum.org/press/lego-jurassic-world-now-open/"],
};
/** Multi-day events whose hours differ by day or skip closed days: the published schedule as occurrences (inside the data window). */
const QA_OCCURRENCES = {
  "also-zoo-jack-olantern-glow": {
    occ: () => daySpan("2026-10-02", WIN.end).filter((d) => !["2026-10-05", "2026-10-12", "2026-10-19"].includes(d))
      .map((d) => ({ date: d, start: "17:30", end: [2, 3].includes(new Date(`${d}T12:00:00Z`).getUTCDay()) ? "21:00" : "22:00" })),
    why: "the Zoo's page: \"Closed Monday, October 5, 12 & 19\"; \"Tuesdays & Wednesdays 5:30pm - 9pm … Thursday - Sunday 5:30pm - 10pm\" (the research applied 5:30–10 PM to every day, closed Mondays included)",
  },
  "also-tct-mary-poppins-jr": {
    occ: () => [["2026-10-09", "19:00"], ["2026-10-10", "14:00"], ["2026-10-10", "17:00"], ["2026-10-11", "14:00"], ["2026-10-17", "11:00"], ["2026-10-17", "14:00"], ["2026-10-18", "14:00"]].map(([date, start]) => ({ date, start, end: null })),
    end_date: "2026-10-25",
    why: "The Children's Theatre's General Admission Show Times (\"October 9 Friday - 7:00pm; October 10 Saturday - 2:00pm; October 10 Saturday - 5:00pm; October 11 Sunday - 2:00pm; October 17 Saturday - 11:00am …\"; public run through October 25); the research applied 7:00 PM to Oct 10 and 11",
  },
  "also-findlay-blink-10-08": {
    occ: () => [["2026-10-08", "12:30", "23:30"], ["2026-10-09", "12:30", "23:30"], ["2026-10-10", "09:00", "16:00"], ["2026-10-11", "09:00", "16:00"]].map(([date, start, end]) => ({ date, start, end })),
    why: "Findlay Market's four BLINK pages (schema.org startDate/endDate): Oct 8 and 9 12:30 PM–11:30 PM, Oct 10 and 11 9:00 AM–4:00 PM (the research applied the Thursday hours to all four days)",
  },
};
/** Event fields clarified at the source's own wording. */
const QA_EVENT_FIX = {
  "blink-2026-10-08-flip-the-switch": { tags: ["approximate-time"], why: "BLINK gives the time as \"approximately 7:00 p.m.\" (\"As the sun sets\"); the tag marks the start as approximate until the card can print \"About 7:00 PM\"" },
};
/** NO GRID agenda slots whose stop Eventbrite names only "Location #2/#3": say that the venue is not named. */
const QA_LOCATION_LABEL = (t) => (/^Location #\d+$/.test(t || "") ? `NO GRID ${t} (venue not named by the organizers)` : t);
/** Research people who are not program participants on the evidence, or whose name was guessed. */
const QA_PERSON_DROP = {
  "caw:brandon-hill": "only on the unlisted cincinnatiartweek.com/artists draft, a template whose \"Brandon Hill\" card repeats 8 times with placeholder images; not confirmed as a 2026 participant",
  "caw:isaiah-armstrong": "only on the same unlisted template draft (links to a 404 page); not confirmed as a 2026 participant",
  "caw:daniel-iroh": "on the same template draft (image placeholder \"YOUR-DANIEL-IMAGE-URL\") and pictured in the sponsorship deck; participation not confirmed",
  "caw:andrea-sabugo": "credited only for photographs on CAW's homepage and in Cincinnati Magazine; a photo credit is not Art Week participation (she stays a FotoFocus \"Cultural Ties\" artist)",
};
const QA_PERSON_FIX = {
  "bailey-elderberry": {
    id: "bailey-elder", name: "Bailey Elder", title: null, location: "Ludlow, Kentucky",
    links: { website: "https://bailey-elder.com/", instagram: "https://www.instagram.com/baileyelderberry/" }, also: ["https://bailey-elder.com/about"],
    why: "the research turned the Instagram handle @baileyelderberry into the name \"Bailey Elderberry\"; the artist's own site (\"Info - Bailey Elder\", \"I am an artist living in Ludlow, Kentucky\") links instagram.com/baileyelderberry",
  },
};
/** Venue facts missing from the research, from the venue's own page. */
const QA_VENUE_FIX = {
  "mercantile-immersive": { address: "120 E 4th St", city: "Cincinnati", state: "OH", zip: "45202", url: "https://mercantileimmersive.com/", why: "the venue's contact page gives \"120 E 4th St, Cincinnati, OH 45202\" (https://mercantileimmersive.com/contact/); BLINK names the venue without an address" },
};
/** The guide's "Findlay Market" neighborhood is the market and its blocks (places.json findlay-market-district: "Findlay Market, at
 *  1801 Race Street … The surrounding blocks (Elder, Race and Elm streets)"). Records named for the market within 250 m of the market
 *  house belong to it, not to Over-the-Rhine at large (the venue and its merchants were split from BLINK's Findlay Market zone). */
const QA_FINDLAY = { hood: "findlay-market-district", at: { lat: 39.115645, lng: -84.518353 }, m: 250 };
const qa = (msg) => note("qa", msg);
/* ---- integration pass (2026-09-24): research asides that reached the page as if they were the organizers' words ---- */
/** Ticket notes that are the researcher's notes, not the organizers' text: kept in `notes` (never rendered). Every other
 *  ticket's notes are the organizer's own wording and become `details` (the "Details" column on program pages). */
const QA_TICKET_RESEARCH_NOTES = {
  "Guided BLINK walk with Urban Hikers": "a summary of two pages (Urban Hikers and BLINK Walking Tours), not one source's words",
  "LAZ Parking reserved spaces": "a note about the capture (\"not captured\"), not the operator's text",
  "NO GRID: A Creative Conversation Series (Wed Oct 7) — free RSVP": "Eventbrite sale dates and organizer as noted by the researcher",
};
/** FAQ group labels that carry a research aside in parentheses: the source's own heading. */
const QA_FAQ_TOPIC = {
  "About StartupCincy FAQ (startupcincy.com)": "About StartupCincy FAQ",
  "Startup Fellows Program FAQ (Cintrifuse; the Student Pitch Competition prize is a Builder Fellows spot)": "Startup Fellows Program FAQ",
};
/** Venue names with a typo in one source that another source by the same organizer spells correctly. */
const QA_VENUE_NAME = {
  "daap-galleries-reed-gallery": ["DAAP Galleries: Reed Gallery", "FotoFocus's venue announcement (fotofocus.org, 2026-06-16) writes \"DAAP Galleries: Reed Gallery\"; the double colon comes from its map widget"],
};

/* ================================================================ VENUES (pass 1: merge) ================================================================ */
const venueSlices = [
  ["scw-info", R.scwInfoVenues], ["scw-agenda", R.scwAgendaVenues], ["caw", R.cawVenues], ["blink-art", R.blinkArtVenues], ["also", R.alsoVenues], ["stay-move", R.smVenues],
];
const venueRemap = new Map();           // any research venue id → kept id
for (const [keep, drop] of VENUE_MERGES) venueRemap.set(drop, keep);
for (const v of R.scwAgendaVenues) if (v.same_as && v.same_as !== v.id) { venueRemap.set(v.id, v.same_as); }
const vid = (id) => (id ? venueRemap.get(id) || id : null);
const venueParts = new Map();           // kept id → [{ slice, rec }]
for (const [sl, arr] of venueSlices) for (const v of arr) {
  const k = vid(v.id);
  if (!venueParts.has(k)) venueParts.set(k, []);
  venueParts.get(k).push({ sl, v });
}
// the record whose own id is the kept id leads (its slice owns the venue); slice order breaks ties
for (const [k, parts] of venueParts) venueParts.set(k, sortBy(parts, (p) => (p.v.id === k ? 0 : 1)));
for (const [k, parts] of venueParts) if (parts.length > 1) {
  const names = uniq(parts.map((p) => p.v.name));
  note("merge", `venue **${k}** ← ${parts.map((p) => `${p.sl}:${p.v.id}`).join(" + ")}${names.length > 1 ? ` (names kept as aliases: ${names.slice(1).map((n) => `"${n}"`).join(", ")})` : ""}`);
  const pts = parts.filter((p) => num(p.v.lat) !== null).map((p) => ({ lat: num(p.v.lat), lng: num(p.v.lng), sl: p.sl }));
  for (let i = 1; i < pts.length; i++) { const d = meters(pts[0], pts[i]); if (d > 100) note("geo", `venue ${k}: ${pts[0].sl} and ${pts[i].sl} coordinates are ${d} m apart (kept ${pts[0].sl})`); }
}

/* ================================================================ PEOPLE (pass 1: index every research person) ================================================================ */
const personRemap = new Map(PERSON_MERGES.map(([keep, drop]) => [drop, keep]));
for (const [from, f] of Object.entries(QA_PERSON_FIX)) personRemap.set(from, f.id);
const pid = (id) => (id ? personRemap.get(id) || id : null);

/* ================================================================ ORGS ================================================================ */
const orgs = new Map();                  // orgKey → record under construction
const orgIdOf = new Map();               // research "<slice>:<id>" → kept org id
const tierRank = {};                     // program → Map(tier → rank)
function rankOf(program, tier) {
  if (!tier) return null;
  tierRank[program] ||= new Map();
  if (!tierRank[program].has(tier)) tierRank[program].set(tier, tierRank[program].size + 1);
  return tierRank[program].get(tier);
}
function addOrg(sl, r, roles, extra = {}) {
  const key = orgKey(r.name);
  let o = orgs.get(key);
  if (!o) {
    let id = toId(r.id || r.name);
    if ([...orgs.values()].some((x) => x.id === id)) id = `${id}-${sl.split("-")[0]}`;
    o = { id, name: txt(r.name), roles: [], logo_url: null, url: null, source_url: https(r.source_url), _slices: [] };
    orgs.set(key, o);
  } else if (!o._slices.includes(sl)) note("merge", `org **${o.id}** ← ${sl}:${r.id} ("${r.name}")`);
  o._slices.push(sl);
  o.logo_url ||= https(r.logo_url);
  o.url ||= https(r.url);
  o.source_url ||= https(r.source_url);
  for (const role of roles) if (!o.roles.some((x) => x.program === role.program && x.relationship === role.relationship && x.tier === role.tier)) o.roles.push(role);
  Object.assign(o, extra);
  orgIdOf.set(`${sl}:${r.id}`, o.id);
  return o;
}
const relOk = (rel) => (RELATIONSHIPS.includes(rel) ? rel : "partner");
// SCW 2026 sponsors (partners page; tier ranks as published)
for (const r of R.scwInfoOrgs) {
  const rank = Number.isInteger(r.tier_rank) ? r.tier_rank : null;
  if (r.tier && rank) { tierRank.scw ||= new Map(); if (!tierRank.scw.has(r.tier)) tierRank.scw.set(r.tier, rank); }
  addOrg("scw-info", r, [{ program: "scw", relationship: relOk(r.relationship), tier: txt(r.tier), tier_rank: rank ?? rankOf("scw", r.tier) }]);
  if (r.agenda_org_id) orgIdOf.set(`scw-agenda:${r.agenda_org_id}`, orgIdOf.get(`scw-info:${r.id}`));
}
// SCW session sponsors: resolved to the partners-page record, else added as session sponsors
for (const r of R.scwAgendaOrgs) if (!orgIdOf.has(`scw-agenda:${r.id}`)) addOrg("scw-agenda", r, [{ program: "scw", relationship: "sponsor", tier: txt(r.tier), tier_rank: rankOf("scw", r.tier) }]);
// BLINK 2026 (sponsors page order; past partners and 2024-only sponsors are not 2026 roles)
for (const r of sortBy(R.blinkOrgs, (x) => x.order ?? 999)) {
  if (/past partner|unconfirmed for 2026/i.test(r.status_2026 || "")) { note("drop", `org role: blink-info:${r.id} ("${r.name}"): ${r.status_2026}`); continue; }
  const tiers = uniq((r.tiers && r.tiers.length ? r.tiers : [r.tier]).map((t) => txt(String(t || "").replace(/^Footer:\s*/i, ""))));
  const rel = relOk(r.relationship);
  addOrg("blink-info", r, tiers.map((t) => ({ program: "blink", relationship: rel, tier: t, tier_rank: rankOf("blink", t) })));
}
// CAW (sponsors section order)
for (const r of R.cawOrgs) addOrg("caw", r, [{ program: "caw", relationship: relOk(r.relationship), tier: txt(r.tier), tier_rank: rankOf("caw", r.tier) }]);
// FotoFocus and the "also" organizers/venues
for (const r of R.alsoOrgs) {
  const program = (r.programs || []).includes("fotofocus") ? "fotofocus" : "also";
  addOrg("also", r, [{ program, relationship: relOk(r.relationship), tier: txt(r.tier), tier_rank: rankOf(program, r.tier) }]);
}
note("gap", "StartupCincy coalition partners (research/scw-info/ecosystem_orgs.json, 51) and 2025 SCW sponsors (orgs_2025.json, 44) are not 2026 week partners and are not merged.");
const orgByName = (name) => (name ? orgs.get(orgKey(name)) || null : null);

/* ================================================================ EVENTS ================================================================ */
const events = [];
const dropEvent = new Map(EVENT_DROPS);
const peopleRefs = new Map();            // research person id (remapped) → Set(event ids)
const kindOk = (k) => (EVENT_KINDS.includes(k) ? k : "other");
function evBase(e, sl) {
  const id = e.id;
  const desc = txt(e.description, `events#${id}.description`);
  return {
    id, program: e.program, title: txt(e.title), kind: kindOk(e.kind),
    date: e.date, end_date: e.end_date && e.end_date !== e.date ? e.end_date : null, start: nz(e.start), end: nz(e.end),
    time_text: txt(e.time_text), all_day: e.all_day === true ? true : false, hours_text: null, occurrences: null,
    venue_id: vid(e.venue_id), room: txt(e.room), location_text: null,
    description: desc && DESCRIPTION_NULL.has(desc) ? null : desc,
    tracks: uniq((e.tracks || []).map((t) => txt(t))).filter((t) => !DROP_TRACKS.has(t)),
    tags: uniq((e.tags || []).map((t) => String(t).trim().toLowerCase().replace(/\s+/g, "-"))).filter((t) => !DROP_TAGS.has(t)),
    people: uniq((e.people || []).map(pid)), people_roles: {}, credits: [], work_ids: [], org_ids: [],
    cost: txt(e.cost), is_free: isFree(e.cost), registration_url: https(e.registration_url),
    status: "scheduled", featured: false, image_url: https(e.image_url), source_url: https(e.source_url),
    notes: txt(e.notes), _slice: sl, _raw: e,
  };
}
function pushEvent(ev) {
  const last = ev.end_date || ev.date;
  if (dropEvent.has(ev.id)) { note("drop", `event ${ev.id}: ${dropEvent.get(ev.id)}`); return; }
  if (!ev.date) { note("drop", `event ${ev.id}: no date`); return; }
  if (!inWindow(ev.date, last) || (ev.occurrences && !ev.occurrences.some((o) => inWindow(o.date)))) { note("drop", `event ${ev.id} ("${ev.title}", ${ev.date}${ev.end_date ? `–${ev.end_date}` : ""}): outside the data window ${WIN.start}–${WIN.end}`); return; }
  if (ev.start && !/^\d\d:\d\d$/.test(ev.start)) { note("fix", `event ${ev.id}: unparseable start "${ev.start}" → null`); ev.start = null; }
  if (!ev.start && ev.end) { note("fix", `event ${ev.id}: end ${ev.end} without a start → end null`); ev.end = null; }
  if (!ev.venue_id && !ev.location_text) ev.location_text = LOCATION_UNLISTED;
  if (!ev.source_url) { note("drop", `event ${ev.id}: no https source_url`); return; }
  events.push(ev);
}

// --- StartupCincy Week: the agenda (vFairs API) + enrichment from official host pages
const enrich = byKey(R.scwEnrich, (x) => x.agenda_event_id);
const agendaOrgs = new Map();
for (const o of R.scwAgendaOrgs) for (const s of o.sessions || []) { if (!agendaOrgs.has(s)) agendaOrgs.set(s, []); agendaOrgs.get(s).push(orgIdOf.get(`scw-agenda:${o.id}`)); }
for (const e of R.scwAgendaEvents) {
  const ev = evBase(e, "scw-agenda");
  const x = enrich.get(e.id);
  if (x) {
    if (x.venue_id && !ev.venue_id) { ev.venue_id = vid(x.venue_id); note("fix", `event ${e.id}: venue ${x.venue_id} from ${x.source_url} (not on the agenda)`); }
    if (!ev.start && x.start) ev.start = x.start;
    for (const s of x.sponsors || []) { const oid = orgIdOf.get(`scw-info:${s}`); if (oid) ev.org_ids.push(oid); }
    if (x.registration && !ev.notes) ev.notes = txt(x.registration);
  }
  ev.org_ids = uniq([...ev.org_ids, ...(agendaOrgs.get(e.id) || [])]);
  pushEvent(ev);
}
// SCW anchor events published outside the agenda (registration add-ons, homepage features, satellites)
const agendaTitles = new Set(R.scwAgendaEvents.map((e) => nameKey(e.title)));
for (const e of R.scwInfoEvents) {
  if (e.in_agenda || agendaTitles.has(nameKey(e.title))) { note("drop", `event ${e.id}: already on the agenda`); continue; }
  pushEvent(evBase(e, "scw-info"));
}

// --- BLINK: the four identical nightly records become one Oct 8–11 multi-day event
const nightly = R.blinkEvents.filter((e) => /-nightly$/.test(e.id)).sort((a, b) => (a.date < b.date ? -1 : 1));
if (nightly.length) {
  const n0 = nightly[0], nl = nightly[nightly.length - 1];
  const same = nightly.every((n) => n.start === n0.start && n.end === n0.end);
  const ev = evBase({ ...n0, id: "blink-nightly", title: n0.title.replace(/\s*\(nightly\)\s*$/i, ""), end_date: nl.date }, "blink-art");
  if (!same) ev.occurrences = nightly.map((n) => ({ date: n.date, start: n.start, end: n.end }));
  const faq = R.blinkFaqs.find((f) => /When and Where is BLINK/i.test(f.q));
  ev.location_text = "30+ city blocks from Findlay Market in Cincinnati to Covington";   // BLINK FAQ "When and Where is BLINK?"
  ev.notes = `Merged from ${nightly.map((n) => n.id).join(", ")}. Location text from the BLINK FAQ (${faq ? faq.source_url : "https://www.blinkcincinnati.com/faqs"}).`;
  note("merge", `event **blink-nightly** ← ${nightly.map((n) => n.id).join(" + ")} (identical nightly hours ${n0.start}–${n0.end}; location text from the BLINK FAQ)`);
  pushEvent(ev);
}
for (const e of R.blinkEvents) {
  if (/-nightly$/.test(e.id)) continue;
  const ev = evBase(e, "blink-art");
  if (e.id === "blink-2026-10-09-0h10m1ke-light-installation") ev.work_ids = ["blink-0h10m1ke-light-installation"];
  pushEvent(ev);
}

// --- Cincinnati Art Week (draft schedule page + NO GRID on Eventbrite)
for (const e of R.cawEvents) {
  const ev = evBase(e, "caw");
  if (!ev.venue_id && ev.room && /^Location #\d+$/.test(ev.room)) {
    ev.location_text = QA_LOCATION_LABEL(ev.room); ev.room = null;
    qa(`event ${ev.id}: location "${e.room}" → "${ev.location_text}" (Eventbrite's agenda names the stop only "${e.room}"; the three spaces are named on Instagram without saying which is which)`);
  }
  pushEvent(ev);
}

// --- FotoFocus Biennial + other happenings
const alsoPeopleById = byKey(R.alsoPeople, (p) => p.id);
for (const e of R.alsoEvents) {
  const raw = e;
  let date = e.date;
  const ev = evBase({ ...e, date: date || null }, "also");
  if (!date && e.end_date && QA_OPENING[e.id]) {
    const [open, why, src] = QA_OPENING[e.id];
    ev.date = open;
    ev.notes = [ev.notes, `Opening date ${open}: ${why} (${src}).`].filter(Boolean).join(" ");
    qa(`event ${e.id}: opening date ${open} (was the research capture date ${CAPTURE_DATE}, which the pages printed as the start of the run): ${why}`);
  } else if (!date && e.end_date) {
    // "On view through Oct 4" / "Now–October 8": the page showed it on view on the capture date; the opening date is not published
    note("gap", `event ${e.id}: no published opening date; the capture date ${CAPTURE_DATE} stands in and pages will print it as the start of the run`);
    ev.date = CAPTURE_DATE;
    ev.notes = [ev.notes, `Opening date not published; date is the research capture date (${CAPTURE_DATE}), when the page listed it as on view.`].filter(Boolean).join(" ");
    note("fix", `event ${e.id}: no opening date ("${e.time_text}") → date ${CAPTURE_DATE} (capture date, on view then), end ${e.end_date}`);
  }
  const dates = Array.isArray(e.dates) ? [...e.dates].sort() : [];
  if (dates.length > 1) {
    const span = daySpan(dates[0], dates[dates.length - 1]);
    if (span.length !== dates.length) {
      ev.occurrences = dates.filter((d) => inWindow(d)).map((d) => ({ date: d, start: ev.start, end: ev.end }));
      ev.date = dates[0]; ev.end_date = dates[dates.length - 1];
    }
  }
  if (!ev.venue_id && ev.room) { ev.location_text = ev.room; ev.room = null; }
  if (raw.featured === true) ev.featured = true;
  ev._curatedBy = raw.curated_by || "";
  ev._credits = raw.credits || [];
  pushEvent(ev);
}

// --- event ids unique, program-prefixed; duplicates (same program, title, date, start) collapse into the first
{
  const seen = new Set(), slot = new Map();
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (!e.id.startsWith(`${e.program}-`)) { const old = e.id; e.id = `${e.program}-${e.id}`; note("fix", `event ${old}: id prefixed with its program → ${e.id}`); }
    if (seen.has(e.id)) { note("drop", `event ${e.id}: duplicate id (${e._slice})`); events.splice(i--, 1); continue; }
    seen.add(e.id);
    const k = [e.program, (e.title || "").toLowerCase(), e.date, e.start || ""].join("|");   // the loader's duplicate key
    if (e.start && slot.has(k)) { note("drop", `event ${e.id}: duplicate of ${slot.get(k)} (same program, title, day and start)`); events.splice(i--, 1); seen.delete(e.id); continue; }
    slot.set(k, e.id);
  }
}
for (const id of FEATURED) { const e = events.find((x) => x.id === id); if (e) e.featured = true; else note("gap", `featured event ${id} not found in this run`); }
// QA audit: published per-day schedules and field clarifications
for (const [id, fx] of Object.entries(QA_OCCURRENCES)) {
  const e = events.find((x) => x.id === id);
  if (!e) { note("gap", `QA occurrences: event ${id} not found in this run`); continue; }
  const before = e.occurrences ? `${e.occurrences.length} occurrences` : `${e.date}–${e.end_date || e.date} ${e.start || "?"}–${e.end || "?"} every day`;
  e.occurrences = fx.occ().filter((o) => inWindow(o.date));
  if (fx.end_date) e.end_date = fx.end_date;
  e.start = e.occurrences[0].start; e.end = e.occurrences[0].end;
  e.notes = [e.notes, `Occurrences (QA audit 2026-09-24): ${fx.why}.`].filter(Boolean).join(" ");
  qa(`event ${id}: ${before} → ${e.occurrences.length} dated occurrences inside the window: ${fx.why}`);
}
for (const [id, fx] of Object.entries(QA_EVENT_FIX)) {
  const e = events.find((x) => x.id === id);
  if (!e) { note("gap", `QA event fix: event ${id} not found in this run`); continue; }
  if (fx.tags) e.tags = uniq([...e.tags, ...fx.tags]);
  qa(`event ${id}: tags + ${(fx.tags || []).join(", ")}: ${fx.why}`);
}
for (const e of events) for (const p of e.people) { if (!peopleRefs.has(p)) peopleRefs.set(p, new Set()); peopleRefs.get(p).add(e.id); }

/* ================================================================ WORKS ================================================================ */
const works = [];
const mediumOk = (m) => (MEDIUMS.includes(m) ? m : "other");
for (const w of R.blinkWorks) {
  works.push({
    id: w.id, program: "blink", title: txt(w.title), artists: uniq((w.artists || []).map(pid)), artist_text: null,
    medium: mediumOk(w.medium), category: txt(w.category), zone: txt(w.zone), venue_id: vid(w.venue_id), location_text: txt(w.location_text),
    lat: round6(num(w.lat)), lng: round6(num(w.lng)), hours_text: null, description: txt(w.description, `works#${w.id}.description`),
    image_url: https(w.image_url), sponsor: typeof w.sponsor === "string" ? txt(w.sponsor) : null, sponsor_org_id: null, year: 2026, source_url: https(w.source_url),
    notes: txt([w.notes, w.description_is_artist_bio ? "description_is_artist_bio: the published artwork text is the artist biography." : null].filter(Boolean).join(" ")),
  });
}
for (const w of R.cawWorks) {
  const venue = vid(w.venue_id) || (w.zone === "Over-the-Rhine" ? "caw-footprint-otr" : null);
  if (!w.venue_id && venue) note("fix", `work ${w.id}: storefront not published → venue caw-footprint-otr (the CAW Over-the-Rhine footprint; research zone "${w.zone}")`);
  const sp = typeof w.sponsor === "string" ? txt(w.sponsor) : null;
  works.push({
    id: w.id, program: "caw", title: txt(w.title), artists: uniq((w.artists || []).map(pid)), artist_text: null,
    medium: mediumOk(w.medium), category: null, zone: txt(w.zone), venue_id: venue, location_text: txt(w.location_text),
    lat: round6(num(w.lat)), lng: round6(num(w.lng)), hours_text: null, description: txt(w.description), image_url: https(w.image_url),
    sponsor: sp, sponsor_org_id: sp ? orgByName(sp)?.id || null : null, year: 2026, source_url: https(w.source_url),
    notes: txt([w.medium_text ? `Medium as described: ${w.medium_text}.` : null, w.notes].filter(Boolean).join(" ")),
  });
}
for (const w of works) for (const a of w.artists) { if (!peopleRefs.has(a)) peopleRefs.set(a, new Set()); peopleRefs.get(a).add(w.id); }

/* ================================================================ PEOPLE (pass 2: page policy + merge) ================================================================ */
const eventById = new Map(events.map((e) => [e.id, e]));
const PAGE_ROLES = new Set(["curator", "speaker", "performer", "moderator"]);
const ROLE_PLURAL = { artist: "Artists", curator: "Curators", speaker: "Speakers", performer: "Performers", moderator: "Moderators", judge: "Jurors", organizer: "Organizers", host: "Hosts", founder: "Founders", panelist: "Panelists", facilitator: "Facilitators", mentor: "Mentors" };
const LABEL_ROLE = [[/artist|filmmaker|photographer/i, "artist"], [/juror|judge/i, "judge"], [/curator/i, "curator"], [/advisor|faculty|organi[sz]er/i, "organizer"], [/performer/i, "performer"], [/speaker/i, "speaker"], [/moderator/i, "moderator"]];
/** A person's role on one also/fotofocus event: the event's own credit line, "Curated by", then the kind of event. */
function roleOn(person, ev) {
  const roles = (person.roles || []).filter((r) => PERSON_ROLES.includes(r));
  for (const c of ev._credits || []) {
    const [label, rest] = [c.split(":")[0], c.slice(c.indexOf(":") + 1)];
    if (rest.includes(person.name)) { const hit = LABEL_ROLE.find(([re]) => re.test(label)); return { role: hit ? hit[1] : roles[0] || "artist", label: txt(label) }; }
  }
  if (ev._curatedBy && ev._curatedBy.includes(person.name)) return { role: "curator", label: null };
  if (roles.length === 1) return { role: roles[0], label: null };
  const pref = ["exhibition", "installation"].includes(ev.kind) ? ["artist", "curator"] : ["keynote", "talk", "panel", "fireside", "screening"].includes(ev.kind) ? ["speaker", "moderator", "curator", "artist"] : ["performer", "speaker", "artist"];
  return { role: pref.find((r) => roles.includes(r)) || roles[0] || "artist", label: null };
}
const evOverlapsWeek = (ev) => (ev.occurrences ? ev.occurrences.some((o) => overlapsWeek(o.date)) : overlapsWeek(ev.date, ev.end_date || ev.date));

const peopleOut = new Map();             // kept id → record
const personSlices = new Map();
function addPerson(sl, p) {
  if (QA_PERSON_DROP[`${sl}:${p.id}`]) { qa(`person ${sl}:${p.id} ("${p.name}") dropped: ${QA_PERSON_DROP[`${sl}:${p.id}`]}`); return; }
  const id = pid(p.id);
  const links = {};
  for (const k of ["website", "instagram", "linkedin", "x", "facebook", "tiktok", "youtube", "threads", "bluesky"]) { const u = https(p.links?.[k]); if (u) links[k] = u; }
  const rec = peopleOut.get(id);
  const headshot = p.headshot_is_group ? null : https(p.headshot_url);
  if (p.headshot_is_group) note("fix", `person ${id}: headshot is a group photo → null`);
  const bioSrc = txt(p.bio) ? https(p.bio_source_url) : null;   // where the bio was published when that is not the record's source page
  if (!rec) {
    const fx = QA_PERSON_FIX[p.id];
    if (fx) qa(`person ${sl}:${p.id} → **${fx.id}**, name "${p.name}" → "${fx.name}": ${fx.why}`);
    peopleOut.set(id, {
      id, name: fx ? fx.name : txt(p.name), sort_name: null, roles: uniq((p.roles || []).filter((r) => PERSON_ROLES.includes(r))), programs: uniq((p.programs || []).filter((x) => PROGRAM_IDS.includes(x))),
      title: fx ? fx.title : id in TITLE_FIX ? TITLE_FIX[id] : txt(p.title), org: txt(p.org), org_id: null, bio: txt(p.bio, `people#${id}.bio`), headshot_url: headshot, location: fx?.location ?? txt(p.location), pronouns: null,
      links: { ...links, ...(fx?.links || {}) }, also_sources: uniq([bioSrc, ...(fx?.also || [])].filter((u) => u && u !== https(p.source_url))), source_url: https(p.source_url),
      notes: txt([p.notes, fx ? `QA audit 2026-09-24: ${fx.why}.` : null, bioSrc ? `Bio from ${bioSrc}.` : null].filter(Boolean).join(" ")),
    });
    personSlices.set(id, [`${sl}:${p.id}`]);
    return;
  }
  // merge: first slice wins scalar fields; lists are unioned; later sources are kept in also_sources
  if (nameKey(rec.name) !== nameKey(p.name) && !PERSON_MERGES.some(([k, d]) => k === id && d === p.id)) {
    note("gap", `person id collision: ${sl}:${p.id} ("${p.name}") vs "${rec.name}"; kept apart as ${id}-${p.programs?.[0] || sl}`);
    addPerson(sl, { ...p, id: `${id}-${p.programs?.[0] || sl}` }); return;
  }
  personSlices.get(id).push(`${sl}:${p.id}`);
  rec.roles = uniq([...rec.roles, ...(p.roles || []).filter((r) => PERSON_ROLES.includes(r))]);
  rec.programs = uniq([...rec.programs, ...(p.programs || []).filter((x) => PROGRAM_IDS.includes(x))]);
  if (!(id in TITLE_FIX)) rec.title ??= txt(p.title);
  const bioFromHere = !rec.bio && !!txt(p.bio);
  rec.org ??= txt(p.org); rec.bio ??= txt(p.bio); rec.headshot_url ??= headshot; rec.location ??= txt(p.location);
  for (const [k, u] of Object.entries(links)) rec.links[k] ??= u;
  const s = https(p.source_url); if (s && s !== rec.source_url) rec.also_sources = uniq([...rec.also_sources, s]);
  if (bioSrc && bioFromHere && bioSrc !== rec.source_url) rec.also_sources = uniq([...rec.also_sources, bioSrc]);
}
// SCW speakers, CAW team + artists, BLINK leadership: every record is kept
for (const p of R.scwAgendaPeople) addPerson("scw-agenda", p);
for (const p of R.cawPeople) addPerson("caw", p);
for (const p of R.blinkInfoPeople) addPerson("blink-info", p);
// BLINK artists: referenced by a kept 2026 work/event, or on the 2026 participating-artists list
for (const p of R.blinkArtPeople) {
  if (peopleRefs.has(pid(p.id)) || p.in_2026_participating_artists_list) addPerson("blink-art", p);
  else note("drop", `person blink-art:${p.id} ("${p.name}"): only referenced by dropped records, not on the 2026 artists list`);
}
// FotoFocus / also: page policy (bio, headshot, or curator/speaker/performer/moderator on an event overlapping Oct 3–11)
const creditBuckets = new Map();         // event id → Map(label → [names])
let creditedNames = 0;
const alsoKept = new Set(), alsoCredited = new Set();
for (const p of R.alsoPeople) {
  const id = pid(p.id);
  const evs = [...(peopleRefs.get(id) || [])].map((x) => eventById.get(x)).filter(Boolean);
  if (!evs.length) { note("drop", `person also:${p.id} ("${p.name}"): no kept event`); continue; }
  const onWeek = evs.filter(evOverlapsWeek).some((ev) => PAGE_ROLES.has(roleOn(p, ev).role));
  const keep = peopleOut.has(id) || !!(txt(p.bio) || https(p.headshot_url) || onWeek);   // already a caw/scw/blink person → link
  if (keep) { addPerson("also", p); alsoKept.add(id); }
  else alsoCredited.add(id);
  for (const ev of evs) {
    const { role, label } = roleOn(p, ev);
    if (keep) { if (PERSON_ROLES.includes(role)) ev.people_roles[id] = role; continue; }
    const lab = label || ROLE_PLURAL[role] || "Credits";
    if (!creditBuckets.has(ev.id)) creditBuckets.set(ev.id, new Map());
    const b = creditBuckets.get(ev.id);
    if (!b.has(lab)) b.set(lab, []);
    b.get(lab).push(txt(p.name));
    creditedNames++;
  }
}
// events: drop person refs without a record; unreferenced credited people become plain-text credits
for (const e of events) {
  e.people = e.people.filter((p) => peopleOut.has(p));
  for (const k of Object.keys(e.people_roles)) if (!e.people.includes(k)) delete e.people_roles[k];
  const b = creditBuckets.get(e.id);
  if (b) e.credits = [...b].map(([role, names]) => ({ role, names: uniq(names) }));
}
for (const w of works) {
  const missing = w.artists.filter((a) => !peopleOut.has(a));
  if (missing.length) { note("fix", `work ${w.id}: artist ids without a person record dropped: ${missing.join(", ")}`); w.artists = w.artists.filter((a) => peopleOut.has(a)); }
}
// merge log for people
for (const [id, srcs] of personSlices) if (srcs.length > 1) {
  const ev = PERSON_MERGES.find(([k]) => k === id);
  note("merge", `person **${id}** ← ${srcs.join(" + ")}${ev ? `: ${ev[2]}` : " (exact normalized-name match)"}`);
}
// org links on people (exact normalized name only)
for (const p of peopleOut.values()) { const o = orgByName(p.org); if (o) p.org_id = o.id; }

/* ================================================================ VENUES (pass 2: keep referenced, hoods, coordinates) ================================================================ */
const FOUNTAIN_SQUARE_HUB = { lat: 39.101794, lng: -84.512811 };   // research/stay-move/venues.json hub "fountain-square"
const PROGRAM_HUBS = { caw: "caw-hub-1600-race", scw: "union-hall", blink: null, fotofocus: "fotofocus-center", also: null };
const venueUsed = new Set([...events.map((e) => e.venue_id), ...works.map((w) => w.venue_id), ...Object.values(PROGRAM_HUBS)].filter(Boolean));
const venues = [];
const osmHoodExtra = new Map();          // suburb name → count (Cincinnati neighborhoods outside the nine canonical hoods)
for (const [k, parts] of venueParts) {
  if (!venueUsed.has(k)) { note("drop", `venue ${k} (${parts.map((p) => p.sl).join(", ")}): no kept event, work or program hub refers to it`); continue; }
  const P = parts.map((p) => p.v);
  const pick = (f) => first(...P.map((v) => v[f]));
  const names = uniq(P.map((v) => txt(v.name)));
  const kind = VENUE_KINDS.includes(pick("kind")) ? pick("kind") : "other";
  const withLL = P.find((v) => num(v.lat) !== null && num(v.lng) !== null);
  const v = {
    id: k, name: names[0], aliases: uniq([...names.slice(1), ...VENUE_MERGES.filter(([kk]) => kk === k).map(([, , a]) => a)]),
    address: txt(pick("address")), city: txt(pick("city")), state: nz(pick("state")), zip: pick("zip") ? String(pick("zip")) : null,
    neighborhood: txt(pick("neighborhood")), hood: null, lat: withLL ? round6(num(withLL.lat)) : null, lng: withLL ? round6(num(withLL.lng)) : null,
    programs: uniq(P.flatMap((x) => x.programs || []).filter((x) => PROGRAM_IDS.includes(x))),
    kind: /\bmuseum\b/i.test(names[0]) && kind === "venue" ? "museum" : kind, url: first(...P.map((x) => https(x.url))), accessibility: null,
    source_url: first(...P.map((x) => https(x.source_url))), notes: txt(P.map((x) => x.notes).filter((n) => typeof n === "string").join(" ")),
  };
  venues.push(v);
}
// the Ready. Set. BLINK! footprint surrounds TQL Stadium (BLINK FAQ): pin it at the stadium, as research/blink-info/places.json does
{
  const fp = venues.find((v) => v.id === "blink-ready-set-blink-central-parkway"), tql = venues.find((v) => v.id === "tql-stadium") || null;
  const pl = R.blinkInfoPlaces.find((p) => p.id === "blink-ready-set-blink-footprint");
  if (fp && fp.lat === null && pl && num(pl.lat) !== null) {
    fp.lat = round6(num(pl.lat)); fp.lng = round6(num(pl.lng));
    note("geo", `venue ${fp.id}: no published point; pinned at TQL Stadium (${fp.lat}, ${fp.lng}), which the footprint surrounds (BLINK FAQ; research/blink-info place blink-ready-set-blink-footprint)${tql ? "" : ""}`);
  }
}
for (const [id, fx] of Object.entries(QA_VENUE_FIX)) {
  const v = venues.find((x) => x.id === id);
  if (!v) { note("gap", `QA venue fix: venue ${id} not found in this run`); continue; }
  for (const k of ["address", "city", "state", "zip", "url"]) if (fx[k] && !v[k]) v[k] = fx[k];
  v.notes = txt([v.notes, `Address (QA audit 2026-09-24): ${fx.why}.`].filter(Boolean).join(" "));
  qa(`venue ${id}: address "${fx.address}, ${fx.city}, ${fx.state} ${fx.zip}" added: ${fx.why}`);
}
for (const [id, [name, why]] of Object.entries(QA_VENUE_NAME)) {
  const v = venues.find((x) => x.id === id);
  if (!v) { note("gap", `QA venue name: venue ${id} not found in this run`); continue; }
  if (v.name === name) continue;
  qa(`venue ${id}: name "${v.name}" → "${name}": ${why}`);
  v.aliases = uniq([...(v.aliases || []), v.name]);
  v.name = name;
}
// geocode venues that have a street address but no coordinates (house/building-level hits only)
for (const v of venues) {
  if (v.lat !== null || !v.address || !/^\d/.test(v.address)) continue;
  const q = `${v.address}, ${v.city || "Cincinnati"}, ${v.state || "OH"}${v.zip ? ` ${v.zip}` : ""}`;
  const hit = search(q);
  if (!hit) { note("geo", `venue ${v.id}: geocode "${q}" found nothing${OFFLINE ? " (offline)" : ""}`); continue; }
  const lat = Number(hit.lat), lng = Number(hit.lon);
  if (Number(hit.place_rank) < 28) { note("geo", `venue ${v.id}: geocode "${q}" matched only ${hit.addresstype} level (rank ${hit.place_rank}); left unmapped`); continue; }
  if (!inRegion(lat, lng)) { note("geo", `venue ${v.id}: geocode "${q}" landed outside the region (${lat}, ${lng}); rejected`); continue; }
  v.lat = round6(lat); v.lng = round6(lng);
  note("geo", `venue ${v.id}: geocoded "${q}" → ${v.lat}, ${v.lng} (${hit.display_name})`);
}
// hoods: research text first, then OpenStreetMap reverse geocoding
for (const v of venues) {
  const t = v.neighborhood ? aliasKey(v.neighborhood) : null;
  if (t && HOOD_TEXT[t]) { v.hood = HOOD_TEXT[t]; continue; }
  if (v.lat === null) { if (v.neighborhood) note("fix", `venue ${v.id}: neighborhood "${v.neighborhood}" has no canonical hood and no coordinates → neighborhood null`); v.neighborhood = null; continue; }
  if (!inMap(v.lat, v.lng)) { if (v.neighborhood) note("fix", `venue ${v.id}: neighborhood "${v.neighborhood}" is outside the map region → neighborhood null`); v.neighborhood = null; continue; }
  const addr = reverse(v.lat, v.lng);
  const { hood, suburb } = hoodFromOsm(addr);
  if (addr && v.city && addr.city && aliasKey(addr.city) !== aliasKey(v.city) && !(addr.town && aliasKey(addr.town) === aliasKey(v.city))) note("geo", `venue ${v.id}: city "${v.city}" but OpenStreetMap places the point in ${addr.city || addr.town}`);
  if (hood) { v.hood = hood; if (v.neighborhood && !HOOD_TEXT[t]) note("fix", `venue ${v.id}: neighborhood "${v.neighborhood}" resolved via OpenStreetMap to ${hood}`); continue; }
  // a Cincinnati neighborhood the research names ("Mount Adams (Eden Park)", "Kennedy Heights") wins over OpenStreetMap's suburb
  const named = v.neighborhood && !/\//.test(v.neighborhood) && aliasKey(v.city || "") === "cincinnati" ? txt(v.neighborhood.replace(/\([^)]*\)/g, "")) : null;
  const sub = named || suburb;
  if (sub) { v._suburb = sub; osmHoodExtra.set(sub, (osmHoodExtra.get(sub) || 0) + 1); if (named && suburb && aliasKey(named) !== aliasKey(suburb)) note("geo", `venue ${v.id}: research neighborhood "${v.neighborhood}" kept; OpenStreetMap says ${suburb}`); continue; }
  if (v.neighborhood) note("fix", `venue ${v.id}: neighborhood "${v.neighborhood}" is outside the guide's neighborhoods → neighborhood null (city ${v.city || "?"} kept)`);
  v.neighborhood = null;
}
// Cincinnati neighborhoods outside the canonical nine that host a venue: a neighborhood place sourced to OpenStreetMap
const extraHoods = [];
for (const [suburb] of sortBy([...osmHoodExtra], ([s]) => s)) {
  const hit = search(`${suburb}, Cincinnati, Ohio`);
  const id = toId(suburb);
  if (!hit || !hit.osm_type || !inRegion(Number(hit.lat), Number(hit.lon))) { note("geo", `neighborhood "${suburb}": no OpenStreetMap match; its venues keep hood null`); continue; }
  extraHoods.push({ id, kind: "neighborhood", name: suburb, short_name: null, summary: null, details: null, address: null, hood: null, lat: round6(Number(hit.lat)), lng: round6(Number(hit.lon)), url: null, source_url: `https://www.openstreetmap.org/${hit.osm_type}/${hit.osm_id}`, notes: `Cincinnati neighborhood from OpenStreetMap (Nominatim "${hit.display_name}"); added because a guide venue sits in it. No summary: nothing sourced to quote.` });
}
const extraHoodIds = new Map(extraHoods.map((h) => [h.name, h.id]));
for (const v of venues) {
  if (v._suburb) { v.hood = extraHoodIds.get(v._suburb) || null; if (!v.hood) v.neighborhood = null; else if (v.neighborhood && aliasKey(v.neighborhood) !== aliasKey(v._suburb)) note("fix", `venue ${v.id}: neighborhood "${v.neighborhood}" → OpenStreetMap neighborhood ${v.hood}`); delete v._suburb; }
  if (v.hood && v.neighborhood && !HOOD_TEXT[aliasKey(v.neighborhood)] && !extraHoods.some((h) => aliasKey(h.name) === aliasKey(v.neighborhood))) v.neighborhood = null;   // the hood is authoritative; drop spellings the loader cannot resolve
  if (v.lat !== null && !inRegion(v.lat, v.lng)) { note("geo", `venue ${v.id}: ${v.lat}, ${v.lng} outside the region; coordinates removed`); v.lat = v.lng = null; }
}
for (const v of venues) if (v.lat === null && (events.some((e) => e.venue_id === v.id))) note("gap", `venue ${v.id} ("${v.name}") has events but no published point: ${v.id === "caw-footprint-otr" ? "CAW storefront addresses were not public on 2026-09-24" : v.id === "blink-ohio-river-drone-show" ? "BLINK gives only \"over the Ohio River\"" : "no address or point published"}`);

/* ================================================================ STAYS ================================================================ */
const stayParts = new Map();             // key → [{ sl, s }]
const stayKeyOf = new Map();             // id / address+brand key / name key → group key
/** Same property under two research ids whose names share no leading word (checked by hand). */
const STAY_SAME = { "residence-inn-by-marriott-cincinnati-downtown-the-phelps": "residence-inn-cincinnati-downtown-the-phelps" };
/** An address matches only with the same leading name word: 617 Vine St is both Hampton Inn and Homewood Suites,
 *  638 Madison Ave both Hotel Covington and North by Hotel Covington. */
function stayGroup(s) {
  const keys = [`id:${STAY_SAME[s.id] || s.id}`, addrKey(s.address) && `a:${addrKey(s.address)}|${brandTok(s.name)}`, `n:${tightKey(s.name)}`].filter(Boolean);
  for (const k of keys) if (stayKeyOf.has(k)) { for (const kk of keys) stayKeyOf.set(kk, stayKeyOf.get(k)); return stayKeyOf.get(k); }
  for (const k of keys) stayKeyOf.set(k, keys[0]);
  return keys[0];
}
for (const [sl, arr] of [["scw-info", R.scwInfoStays], ["stay-move", R.smStays], ["caw", R.cawStays], ["blink-info", R.blinkStays]]) for (const s of arr) {
  const g = stayGroup(s);
  if (!stayParts.has(g)) stayParts.set(g, []);
  stayParts.get(g).push({ sl, s });
}
const stays = [];
for (const [, parts] of stayParts) {
  const P = parts.map((p) => p.s);
  const main = parts.find((p) => p.sl !== "blink-info")?.s || P[0];
  const portal = parts.find((p) => p.sl === "blink-info")?.s || null;
  if (parts.length > 1) note("merge", `stay **${main.id}** ← ${parts.map((p) => `${p.sl}:${p.s.id}`).join(" + ")}`);
  const rbSrc = parts.find((p) => p.s.room_block && p.s.room_block.program && p.sl !== "blink-info");
  let room_block = null, rbNote = null;
  if (rbSrc) {
    const rb = rbSrc.s.room_block;
    const status = /closed|full|cutoff/i.test(rb.status_2026_09_24 || "") ? (/full/i.test(rb.status_2026_09_24) ? "Closed: block full (checked Sep 24, 2026)" : "Closed: past the group cutoff date (checked Sep 24, 2026)") : null;
    // dates: the published block dates only; research sourcing remarks move to notes
    let dates = txt(rb.dates);
    if (dates && /block dates not published/i.test(dates)) { note("fix", `stay ${main.id}: room block dates not published ("${dates}") → null`); dates = null; }
    else if (dates && /\s\([^)]*\)$/.test(dates)) { note("fix", `stay ${main.id}: room block dates "${dates}" → "${dates.replace(/\s\([^)]*\)$/, "")}" (the source remark stays in notes)`); dates = dates.replace(/\s\([^)]*\)$/, ""); }
    room_block = { program: rb.program, group_code: txt(rb.group_code), rate: txt(rb.rate), dates, deadline: txt(rb.deadline), booking_url: https(rb.booking_url), status };
    rbNote = txt(`Room block as captured: dates "${rb.dates}"; ${rb.status_2026_09_24 || ""}`);
  }
  const ll = [...parts.filter((p) => p.sl !== "blink-info"), ...parts.filter((p) => p.sl === "blink-info")].map((p) => p.s).find((s) => num(s.lat) !== null && num(s.lng) !== null);   // portal points are rounded to 3 decimals: last resort
  const notesTxt = P.map((s) => s.notes).filter((n) => typeof n === "string").join(" ");
  const kind = /vaca?ti?on rentals|short-term rental/i.test(notesTxt) ? "rental" : "hotel";
  const url = first(...parts.filter((p) => p.sl !== "blink-info").map((p) => https(p.s.url)));
  const rec = {
    id: main.id, name: txt(main.name), kind, address: txt(main.address), hood: null,
    lat: ll ? round6(num(ll.lat)) : null, lng: ll ? round6(num(ll.lng)) : null, url,
    room_block, booking_portal: portal ? { program: "blink", url: https(portal.url) || https(portal.room_block?.booking_url), label: "Visit Cincy BLINK 2026 hotel booking portal" } : null,
    source_url: first(...parts.filter((p) => p.sl !== "blink-info").map((p) => https(p.s.source_url)), https(portal?.source_url)),
    notes: txt([rbNote, notesTxt].filter(Boolean).join(" ")),
    _nb: first(...P.map((s) => s.neighborhood)),
  };
  if (rec.booking_portal && !rec.booking_portal.url) rec.booking_portal = null;
  if (portal && main !== portal && num(portal.lat) !== null && rec.lat !== null) { const d = meters(rec, { lat: num(portal.lat), lng: num(portal.lng) }); if (d > 250) note("geo", `stay ${rec.id}: portal point is ${d} m from the kept point (portal coordinates are rounded to 3 decimals)`); }
  stays.push(rec);
}
// hoods exist only near the venues: skip reverse geocoding for points farther out than any hood-bearing venue (+2 km)
const HOOD_REACH = Math.max(3000, ...venues.filter((v) => v.hood && v.lat !== null).map((v) => haversine(FOUNTAIN_SQUARE_HUB, v))) + 2000;
const nearHoods = (r) => r.lat !== null && haversine(FOUNTAIN_SQUARE_HUB, r) <= HOOD_REACH;
for (const s of stays) {
  const t = s._nb ? aliasKey(s._nb) : null;
  if (t && HOOD_TEXT[t]) s.hood = HOOD_TEXT[t];
  else if (nearHoods(s)) { const { hood, suburb } = hoodFromOsm(reverse(s.lat, s.lng)); s.hood = hood || (suburb && extraHoodIds.get(suburb)) || null; }
  delete s._nb;
}
const stayDist = (s) => (s.lat === null ? 1e9 : haversine(FOUNTAIN_SQUARE_HUB, s));
const staysSorted = sortBy(stays, (s) => (s.room_block ? 0 : 1), (s) => (s.room_block ? s.name : ""), stayDist, (s) => s.id);

/* ================================================================ PLACES ================================================================ */
const places = [];
const placeIds = new Set();
const diffTail = (a, b) => { let i = 0; while (i < a.length && a[i] === (b || "")[i]) i++; return a.slice(i, i + 80); };
/** Place texts whose research capture includes page chrome (checked by hand): keep the verbatim content part only. */
const PLACE_TEXT_FIX = {
  "blink-covington-road-closures": Object.assign((d) => {
    if (!d || !/Skip to main content/.test(d)) return d;
    const i = d.lastIndexOf("Beginning at 8 a.m. Saturday");
    return i > 0 ? d.slice(i).trim() : d;
  }, { why: "the capture included the page's navigation text; kept the published closure list (from \"Beginning at 8 a.m. Saturday\" on)" }),
};
const KIND_REMAP = { "red-bike": "bike", "blink-red-bike": "bike", "rideshare-and-taxi-cvg": "rideshare", taxi: "rideshare" };
function addPlace(sl, p, extra = {}) {
  let id = p.id;
  if (placeIds.has(id)) { note("drop", `place ${sl}:${id}: duplicate id`); return; }
  const kind = KIND_REMAP[id] || p.kind;
  if (!PLACE_KINDS.includes(kind)) { note("drop", `place ${sl}:${id}: kind "${p.kind}" not in the schema`); return; }
  if (KIND_REMAP[id]) note("fix", `place ${id}: kind ${p.kind} → ${kind}`);
  placeIds.add(id);
  const scrub = (field, v) => { const out = scrubInternal(v); if (out !== v) note("fix", `place ${id}.${field}: removed a pointer to research files ("${v.length > 90 ? "…" : ""}${diffTail(v, out)}")`); return out; };
  let details = txt(typeof p.details === "string" ? p.details : null);
  if (PLACE_TEXT_FIX[id]) { const d = PLACE_TEXT_FIX[id](details); if (d !== details) note("fix", `place ${id}.details: ${PLACE_TEXT_FIX[id].why}`); details = d; }
  places.push({
    id, kind, name: txt(p.name), short_name: null, summary: scrub("summary", txt(p.summary, `places#${id}.summary`)), details: scrub("details", details),
    address: txt(p.address), hood: null, lat: round6(num(p.lat)), lng: round6(num(p.lng)), url: https(p.url), source_url: https(p.source_url), notes: txt(p.notes), ...extra,
  });
}
for (const p of R.smPlaces) {
  if (p.kind === "neighborhood" && HOOD_NAMES[p.id]) { const [name, short] = HOOD_NAMES[p.id]; addPlace("stay-move", p, { name, short_name: short }); if (name !== p.name) note("fix", `neighborhood ${p.id}: name "${p.name}" → "${name}" (short "${short}")`); }
  else addPlace("stay-move", p);
}
const venueNameKeys = new Set(venues.flatMap((v) => [v.name, ...v.aliases]).map(tightKey));
const placeNameKeys = () => new Set(places.map((p) => tightKey(p.name)));
for (const p of R.blinkInfoPlaces) {
  if (p.kind === "neighborhood") { note("drop", `place blink-info:${p.id}: a BLINK zone description (the zone is venue blink-zone-*), not a neighborhood`); continue; }
  if (p.id === "blink-ready-set-blink-footprint") { note("drop", `place blink-info:${p.id}: same as venue blink-ready-set-blink-central-parkway`); continue; }
  addPlace("blink-info", p);
}
for (const p of R.blinkArtPlaces) {
  if (p.kind === "landmark") {
    const k = tightKey(p.name);
    if (placeNameKeys().has(k) || venueNameKeys.has(k) || [...placeNameKeys()].some((x) => x.startsWith(k))) { note("drop", `place blink-art:${p.id} ("${p.name}"): a map label for a landmark or venue already listed`); continue; }
  }
  addPlace("blink-art", p);
}
for (const h of extraHoods) { if (placeIds.has(h.id)) continue; placeIds.add(h.id); places.push(h); note("fix", `neighborhood ${h.id} ("${h.name}") added from OpenStreetMap (${h.source_url}) for ${osmHoodExtra.get(h.name)} venue(s)`); }
for (const p of places) {
  if (p.kind === "neighborhood" || p.lat === null) continue;
  if (!inRegion(p.lat, p.lng)) { note("geo", `place ${p.id}: ${p.lat}, ${p.lng} outside the region; coordinates removed`); p.lat = p.lng = null; continue; }
  if (!inMap(p.lat, p.lng) || !nearHoods(p)) continue;
  const { hood, suburb } = hoodFromOsm(reverse(p.lat, p.lng));
  p.hood = hood || (suburb && extraHoodIds.get(suburb)) || null;
}
// QA audit: the Findlay Market neighborhood holds the market and its merchants (QA_FINDLAY)
if (places.some((p) => p.id === QA_FINDLAY.hood && p.kind === "neighborhood")) {
  const moved = [];
  for (const [f, arr] of [["venue", venues], ["place", places], ["stay", stays]]) for (const r of arr) {
    if (r.kind === "neighborhood" || r.lat === null || r.hood === QA_FINDLAY.hood) continue;
    if (!/findlay market/i.test(r.name) && !/^findlay-/.test(r.id)) continue;
    if (haversine(QA_FINDLAY.at, r) > QA_FINDLAY.m) continue;
    moved.push(`${f} ${r.id} (${r.hood || "none"})`);
    r.hood = QA_FINDLAY.hood;
    if (f === "venue") r.neighborhood = null;   // the hood is authoritative; the research's "Over-the-Rhine" would contradict it
  }
  if (moved.length) qa(`hood → ${QA_FINDLAY.hood} for ${moved.length} records named for Findlay Market within ${QA_FINDLAY.m} m of the market house (the neighborhood the guide defines by the market): ${moved.join(", ")}`);
}

/* ================================================================ FAQS ================================================================ */
const faqs = [];
const faqIds = new Set();
const faqTopicLogged = new Set();
function addFaq(program, f, topic) {
  if (/carried over from BLINK 2024|unconfirmed for 2026/i.test(f.notes || "")) { note("drop", `faq ${program}: "${f.q}": ${f.notes}`); return; }
  let id = `${program}-${toId(f.q, 60)}`;
  for (let n = 2; faqIds.has(id); n++) id = `${program}-${toId(f.q, 56)}-${n}`;
  faqIds.add(id);
  if (topic && QA_FAQ_TOPIC[topic]) { if (!faqTopicLogged.has(topic)) { faqTopicLogged.add(topic); qa(`FAQ topic "${topic}" → "${QA_FAQ_TOPIC[topic]}" (the parenthesis was a research aside)`); } topic = QA_FAQ_TOPIC[topic]; }
  faqs.push({ id, program, topic: txt(topic), q: txt(f.q), a: txt(f.a, `faqs#${id}.a`), source_url: https(f.source_url), notes: txt(f.notes) });
}
for (const f of R.cawFaqs) addFaq("caw", f, null);
for (const f of R.scwFaqs) addFaq("scw", f, f.group);
for (const f of R.blinkFaqs) addFaq("blink", f, f.section);
for (const f of R.alsoFaqs) addFaq(PROGRAM_IDS.includes(f.program) ? f.program : "fotofocus", f, null);

/* ================================================================ PROGRAMS ================================================================ */
const orgLink = (name) => orgByName(name)?.id || null;
const socialOf = (s = {}) => Object.fromEntries(["instagram", "x", "facebook", "linkedin", "tiktok", "youtube"].map((k) => [k, https(s?.[k])]));
const roleText = (r) => { const t = txt(String(r || "").split(";")[0].replace(/\([^)]*\)/g, "")); return t ? t[0].toUpperCase() + t.slice(1) : null; };
const stat = (arr) => (arr || []).filter((s) => s && s.label && s.value && https(s.source_url)).map((s) => ({ label: txt(s.label), value: txt(String(s.value)), source_url: https(s.source_url) }));
const hist = (arr) => (arr || []).filter((h) => h && Number.isInteger(h.year) && h.fact && https(h.source_url) && h.verified !== false).map((h) => {
  const f = txt(h.fact), out = scrubInternal(f);
  if (out !== f) note("fix", `program history ${h.year}: removed a pointer to research files`);
  return { year: h.year, fact: out, source_url: https(h.source_url) };
});
for (const p of [R.scwProgram, R.blinkProgram, R.cawProgram, ...R.alsoPrograms].filter(Boolean)) for (const h of p.history || []) if (h.verified === false) note("drop", `program ${p.id} history ${h.year}: unverified (${h.note || "no note"})`);
const tickets = (arr) => (arr || []).filter((t) => t && t.name).map((t) => {
  const name = txt(t.name), research = QA_TICKET_RESEARCH_NOTES[name];
  if (research && t.notes) qa(`ticket "${name}": notes kept as research notes, not shown (${research})`);
  return { name, price: t.price === null || t.price === undefined ? null : txt(String(t.price)), url: https(t.url), details: research ? null : txt(t.notes), notes: research ? txt(t.notes) : null };
});
const themes = (arr) => (arr || []).filter((t) => t.date && t.theme).map((t) => ({ date: t.date, theme: txt(t.theme), highlights: (t.highlights || []).map((x) => txt(x)).filter(Boolean) }));
const logo = (l) => (l && https(l.url) && /\.(svg|png|jpe?g|webp)(\?|$)/i.test(l.url) ? { url: https(l.url), format: ["svg", "png", "jpg", "webp"].includes(l.format) ? l.format : null, on: ["light", "dark"].includes(l.on) ? l.on : null } : null);
const brand = (b) => (b ? { colors: (b.colors || []).map(String), fonts: (b.fonts || []).map((f) => txt(f)).filter(Boolean) } : null);
const organizers = (arr) => (arr || []).map((o) => ({ name: txt(o.name), url: https(o.url), org_id: orgLink(o.name), role: roleText(o.role) }));
const programs = [];
if (R.cawProgram) {
  const p = R.cawProgram;
  programs.push({
    id: "caw", slug: "art-week", name: "Cincinnati Art Week", short_name: txt(p.short_name), tagline: txt(p.tagline), edition: "2026 (inaugural)",
    dates: p.dates, description: txt(p.description), organizers: organizers(p.organizers), url: https(p.url), hub_venue_id: PROGRAM_HUBS.caw,
    tickets: tickets(p.tickets), daily_themes: themes(p.daily_themes), hours: txt(p.hours), hashtags: [], social: socialOf(p.social), contact: { email: nz(p.contact?.email), phone: nz(p.contact?.phone) },
    history: hist(p.history), stats: stat(p.stats), logo: logo(p.logo), brand: brand(p.brand), source_url: https(p.source_url),
    notes: "Edition: CAW's FAQ calls it \"a new annual celebration\" and \"the inaugural week\" (research/caw/faqs.json). Hub: Cincinnati Magazine (Sep 23, 2026) calls the Welcome Center at 1600 Race St. \"the main hub for the week\".",
  });
}
if (R.scwProgram) {
  const p = R.scwProgram;
  programs.push({
    id: "scw", slug: "startupcincy-week", name: "StartupCincy Week", short_name: txt(p.short_name), tagline: txt(p.tagline), edition: "10th annual",
    dates: p.dates, description: txt([p.description, (p.description_more || [])[0]].filter(Boolean).join("\n\n")), organizers: organizers(p.organizers), url: https(p.url), hub_venue_id: PROGRAM_HUBS.scw,
    tickets: tickets(p.tickets), daily_themes: themes(p.daily_themes), hours: txt(p.hours), hashtags: (p.hashtags || []).map(String), social: socialOf(p.social), contact: { email: nz(p.contact?.email), phone: nz(p.contact?.phone) },
    history: hist(p.history), stats: stat(p.stats), logo: logo(p.logo), brand: brand(p.brand), source_url: https(p.source_url),
    notes: "Description: homepage line + the agenda page's intro paragraph (both startupcincyweek.com). Edition from the agenda (\"the 10th Annual StartupCincy Week\"). Tickets verbatim from the registration form (prices as published).",
  });
}
if (R.blinkProgram) {
  const p = R.blinkProgram;
  const ed = (p.stats || []).find((s) => /^Edition/i.test(s.label) && s.value);
  programs.push({
    id: "blink", slug: "blink", name: "BLINK", short_name: txt(p.short_name), tagline: txt(p.tagline), edition: ed ? txt(String(ed.value).split(" (")[0]) : null,
    dates: p.dates, description: txt(p.description), organizers: organizers(p.organizers), url: https(p.url), hub_venue_id: null,
    tickets: tickets(p.tickets), daily_themes: [], hours: txt(p.hours), hashtags: (p.hashtags || []).map(String), social: socialOf(p.social), contact: { email: nz(p.contact?.email), phone: nz(p.contact?.phone) },
    history: hist(p.history), stats: stat(p.stats), logo: logo(p.logo), brand: brand(p.brand), source_url: https(p.source_url),
    notes: `Name: BLINK's own short form ("${p.name}" in full). daily_themes left empty: BLINK publishes no daily themes (the research's per-night summaries are ours, not the organizer's). Edition from ${ed ? ed.source_url : "research stats"}.`,
  });
  if ((p.daily_themes || []).length) note("drop", "program blink daily_themes: research-authored nightly summaries, not published by BLINK (the events carry the same facts)");
}
for (const p of R.alsoPrograms) {
  if (p.id === "fotofocus") programs.push({
    id: "fotofocus", slug: "fotofocus", name: "FotoFocus Biennial", short_name: "FotoFocus", tagline: txt(p.tagline), edition: "2026: The Long View (eighth iteration)",
    dates: p.dates, description: txt(p.description), organizers: organizers(p.organizers), url: https(p.url), hub_venue_id: venueUsed.has("fotofocus-center") && venues.some((v) => v.id === "fotofocus-center") ? "fotofocus-center" : null,
    tickets: tickets(p.tickets), daily_themes: themes(p.daily_themes), hours: txt(String(p.hours || "").replace(/\s*Other venues: see venues\.json notes\.?\s*$/, "")), hashtags: (p.hashtags || []).map(String), social: socialOf(p.social), contact: { email: nz(p.contact?.email), phone: nz(p.contact?.phone) },
    history: hist(p.history), stats: stat(p.stats), logo: logo(p.logo), brand: brand(p.brand), source_url: https(p.source_url),
    notes: "Hours: the research's pointer to venue notes is removed (each venue keeps its own hours in notes). Name shortened from \"FotoFocus Biennial 2026: The Long View\" (edition holds the rest; \"eighth iteration\" from the Biennial page). Logo: FotoFocus publishes only an inline SVG wordmark (research raw/also/fotofocus_logo_inline.svg), so logo is null.",
  });
  if (p.id === "also") programs.push({
    id: "also", slug: null, name: "More happenings", short_name: "More", tagline: null, edition: null, dates: p.dates, description: null, organizers: [], url: null, hub_venue_id: null,
    tickets: [], daily_themes: [], hours: null, hashtags: [], social: socialOf({}), contact: { email: null, phone: null }, history: [], stats: [], logo: null, brand: null,
    source_url: https(p.source_url), notes: txt(p.notes),
  });
}
programs.sort((a, b) => PROGRAM_IDS.indexOf(a.id) - PROGRAM_IDS.indexOf(b.id));
// organizers named by a program get an organizer role on their org record
for (const p of programs) for (const o of p.organizers) {
  const org = o.org_id && [...orgs.values()].find((x) => x.id === o.org_id);
  // only when the program names it as an organizer (SCW lists both without a role; CAW "Creator"/"Partner"); BLINK's list
  // mixes executive producing partners and its title sponsor, which already carry their published roles
  if (o.role && !/creator|organi[sz]er|^partner$/i.test(o.role)) continue;
  if (org && !org.roles.some((r) => r.program === p.id && r.relationship === "organizer")) org.roles.push({ program: p.id, relationship: "organizer", tier: null, tier_rank: null });
}

/* ================================================================ FACTS ================================================================ */
const facts = [];
const factIds = new Set();
const factKey = new Set();
function addFact(f) {
  const k = [f.program, aliasKey(f.value), f.source_url].join("|");
  if (factKey.has(k) && !f.quote) return;
  factKey.add(k);
  let id = f.id;
  for (let n = 2; factIds.has(id); n++) id = `${f.id}-${n}`;
  factIds.add(id);
  facts.push({ ...f, id });
}
for (const f of R.facts) {
  const program = PROGRAM_IDS.includes(f.program) ? f.program : null;
  if (!https(f.url)) { note("drop", `fact "${f.fact}": no https url`); continue; }
  addFact({ id: `${program || "week"}-${toId(f.fact, 56)}`, program, label: txt(f.fact), value: txt(String(f.value)), as_of: /^\d{4}-\d\d-\d\d$/.test(f.date || "") ? f.date : null, source_url: https(f.url), source: txt(f.source), quote: txt(f.quote), notes: txt(f.notes) });
}
for (const p of programs) for (const s of p.stats) addFact({ id: `${p.id}-stat-${toId(s.label, 50)}`, program: p.id, label: s.label, value: s.value, as_of: null, source_url: s.source_url, source: null, quote: null, notes: "Program stat (programs.json stats)." });

/* ================================================================ NEWS (union with data/news.json) ================================================================ */
const urlKey = (u) => { try { const x = new URL(u); x.hash = ""; for (const k of [...x.searchParams.keys()]) if (/^utm_|^fbclid$|^gclid$/.test(k)) x.searchParams.delete(k); return (x.host.replace(/^www\./, "") + x.pathname.replace(/\/+$/, "") + (x.search || "")).toLowerCase(); } catch { return u; } };
const newsMap = new Map();
const researchNews = new Set();
const existingNews = existsSync(join(DATA, "news.json")) ? JSON.parse(readFileSync(join(DATA, "news.json"), "utf8")) : [];
function addNews(sl, n) {
  const url = https(n.url);
  if (!url) { note("drop", `news ${sl}:${n.id}: no https url`); return; }
  if (!/^\d{4}-\d\d-\d\d$/.test(n.date || "")) { note("drop", `news ${sl}:${n.id} ("${n.title}"): no publication date`); return; }
  const k = urlKey(url);
  if (sl !== "data/news.json") researchNews.add(k);
  if (newsMap.has(k)) { const o = newsMap.get(k); o.programs = uniq([...o.programs, ...(n.programs || []).filter((p) => PROGRAM_IDS.includes(p))]); o.image_url ||= https(n.image_url); return; }
  let id = toId(n.id || `${n.source}-${n.date}-${n.title}`, 90);
  if (!idOk(id)) id = toId(`${n.source}-${n.date}-${n.title}`, 90);
  newsMap.set(k, {
    id, title: txt(n.title), source: sl === "caw" ? txt(String(n.source || "").replace(/\s*\([^)]*\)\s*$/, "")) : txt(n.source), sourceTier: n.sourceTier ?? null, date: n.date, url,
    programs: uniq((n.programs || []).filter((p) => PROGRAM_IDS.includes(p))), summary: txt(n.summary), tags: (n.tags || []).map(String), gnId: n.gnId ?? null,
    image_url: https(n.image_url), author: txt(n.author), kind: n.kind ? String(n.kind) : null, date_source: n.date_source ? String(n.date_source) : null, _sl: sl,
  });
}
for (const n of existingNews) addNews("data/news.json", n);   // G's refresher output (and earlier seeds) win
const before = newsMap.size;
for (const n of R.news) addNews("news", n);
for (const n of R.blinkNews) addNews("blink-info", { ...n, kind: n.kind === "press release" ? "press-release" : n.kind });
for (const n of R.cawNews) addNews("caw", n);
for (const n of R.scwNews) addNews("scw-info", n);
const newsIds = new Set();
const news = sortBy([...newsMap.values()], (n) => -Number(n.date.replace(/-/g, "")), (n) => n.title).map((n) => {
  let id = n.id; for (let k = 2; newsIds.has(id); k++) id = `${n.id.slice(0, 86)}-${k}`; newsIds.add(id);
  const { _sl, ...rest } = n; return { ...rest, id };
});
note("merge", `news: ${news.length} items after deduplicating by URL: ${researchNews.size} from the research slices, ${[...newsMap.keys()].filter((k) => !researchNews.has(k)).length} only in the existing data/news.json (kept: Agent G's refresher)`);

/* ================================================================ ALIASES ================================================================ */
const oldAliases = existsSync(join(DATA, "aliases.json")) ? JSON.parse(readFileSync(join(DATA, "aliases.json"), "utf8")) : {};
const venueIds = new Set(venues.map((v) => v.id)), placeIdSet = new Set(places.filter((p) => p.kind === "neighborhood").map((p) => p.id));
const aliasVenues = {}, aliasHoods = {};
for (const [k, v] of Object.entries(oldAliases.venues || {})) if (venueIds.has(vid(v))) aliasVenues[aliasKey(k)] = vid(v);
for (const [keep, drop, alias] of VENUE_MERGES) if (venueIds.has(keep)) { aliasVenues[aliasKey(alias)] = keep; aliasVenues[aliasKey(drop.replace(/-/g, " "))] = keep; }
for (const v of venues) for (const a of v.aliases) aliasVenues[aliasKey(a)] = v.id;
for (const [k, v] of Object.entries({ ...(oldAliases.hoods || {}), ...HOOD_TEXT })) if (placeIdSet.has(v)) aliasHoods[aliasKey(k)] = v;
const aliases = { venues: Object.fromEntries(Object.keys(aliasVenues).sort().map((k) => [k, aliasVenues[k]])), hoods: Object.fromEntries(Object.keys(aliasHoods).sort().map((k) => [k, aliasHoods[k]])) };

/* ================================================================ SHAPE (fixed key order, no helper keys) ================================================================ */
const EV_KEYS = ["id", "program", "title", "kind", "date", "end_date", "start", "end", "time_text", "all_day", "hours_text", "occurrences", "venue_id", "room", "location_text", "description", "tracks", "tags", "people", "people_roles", "credits", "work_ids", "org_ids", "cost", "is_free", "registration_url", "status", "featured", "image_url", "source_url", "notes"];
const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k] === undefined ? null : o[k]]));
const eventsOut = events.map((e) => pick(e, EV_KEYS));
const peopleList = sortBy([...peopleOut.values()], (p) => p.id);
const orgsOut = sortBy([...orgs.values()], (o) => o.id).map((o) => pick({ ...o, roles: sortBy(o.roles, (r) => PROGRAM_IDS.indexOf(r.program), (r) => r.tier_rank ?? 999) }, ["id", "name", "roles", "logo_url", "url", "source_url"]));
const worksOut = works.map((w) => pick(w, ["id", "program", "title", "artists", "artist_text", "medium", "category", "zone", "venue_id", "location_text", "lat", "lng", "hours_text", "description", "image_url", "sponsor", "sponsor_org_id", "year", "source_url", "notes"]));
const venuesOut = venues.map((v) => pick(v, ["id", "name", "aliases", "address", "city", "state", "zip", "neighborhood", "hood", "lat", "lng", "programs", "kind", "url", "accessibility", "source_url", "notes"]));
const staysOut = staysSorted.map((s) => pick(s, ["id", "name", "kind", "address", "hood", "lat", "lng", "url", "room_block", "booking_portal", "source_url", "notes"]));
const placesOut = places.map((p) => pick(p, ["id", "kind", "name", "short_name", "summary", "details", "address", "hood", "lat", "lng", "url", "source_url", "notes"]));
const faqsOut = faqs.map((f) => pick(f, ["id", "program", "topic", "q", "a", "source_url", "notes"]));
const factsOut = facts.map((f) => pick(f, ["id", "program", "label", "value", "as_of", "source_url", "source", "quote", "notes"]));
const newsOut = news.map((n) => pick(n, ["id", "title", "source", "sourceTier", "date", "url", "programs", "summary", "tags", "gnId", "image_url", "author", "kind", "date_source"]));
for (const e of eventsOut) { if (!e.notes) delete e.notes; if (!e.credits.length) e.credits = []; }
for (const arr of [peopleList, worksOut, venuesOut, staysOut, placesOut, faqsOut, factsOut]) for (const r of arr) if (r.notes === null || r.notes === undefined) delete r.notes;
for (const p of peopleList) { p.links = Object.fromEntries(["website", "instagram", "linkedin", "x", "facebook", "tiktok", "youtube", "threads", "bluesky"].filter((k) => p.links[k]).map((k) => [k, p.links[k]])); }

const OUT = { programs, events: eventsOut, people: peopleList, works: worksOut, venues: venuesOut, orgs: orgsOut, stays: staysOut, places: placesOut, faqs: faqsOut, facts: factsOut, news: newsOut };

/* ================================================================ VALIDATE (the build's own schema) ================================================================ */
saveCache();
let errors = 0;
for (const [f, arr] of Object.entries(OUT)) for (const pr of validateFile(f, arr)) {
  if (pr.level === "error") { errors++; console.error(`ERROR ${pr.where}: ${pr.msg}`); } else console.warn(`warn  ${pr.where}: ${pr.msg}`);
}
// references the build checks too (reported here with the research context)
const has = { venue: venueIds, person: new Set(peopleList.map((p) => p.id)), org: new Set(orgsOut.map((o) => o.id)), work: new Set(worksOut.map((w) => w.id)), place: new Set(placesOut.map((p) => p.id)) };
const bad = (what, where, v) => { errors++; console.error(`ERROR ${where}: unknown ${what} "${v}"`); };
for (const e of eventsOut) {
  if (e.venue_id && !has.venue.has(e.venue_id)) bad("venue", `events#${e.id}.venue_id`, e.venue_id);
  for (const p of e.people) if (!has.person.has(p)) bad("person", `events#${e.id}.people`, p);
  for (const o of e.org_ids) if (!has.org.has(o)) bad("org", `events#${e.id}.org_ids`, o);
  for (const w of e.work_ids) if (!has.work.has(w)) bad("work", `events#${e.id}.work_ids`, w);
}
for (const w of worksOut) { if (w.venue_id && !has.venue.has(w.venue_id)) bad("venue", `works#${w.id}.venue_id`, w.venue_id); for (const a of w.artists) if (!has.person.has(a)) bad("person", `works#${w.id}.artists`, a); }
for (const r of [...venuesOut, ...staysOut, ...placesOut]) if (r.hood && !has.place.has(r.hood)) bad("hood", `#${r.id}.hood`, r.hood);
for (const p of programs) { if (p.hub_venue_id && !has.venue.has(p.hub_venue_id)) bad("venue", `programs#${p.id}.hub_venue_id`, p.hub_venue_id); }
if (errors) { console.error(`\n${errors} error(s): nothing written.`); process.exit(1); }

/* ================================================================ COUNTS + README ================================================================ */
const count = (arr, key) => Object.fromEntries(PROGRAM_IDS.map((p) => [p, arr.filter((r) => key(r).includes(p)).length]));
const C = {
  events: count(eventsOut, (e) => [e.program]), works: count(worksOut, (w) => [w.program]), people: count(peopleList, (p) => p.programs),
  venues: count(venuesOut, (v) => v.programs.length ? v.programs : uniq([...eventsOut.filter((e) => e.venue_id === v.id).map((e) => e.program), ...worksOut.filter((w) => w.venue_id === v.id).map((w) => w.program)])),
  orgs: count(orgsOut, (o) => o.roles.map((r) => r.program)), faqs: count(faqsOut, (f) => [f.program]), facts: count(factsOut, (f) => [f.program || ""]), news: count(newsOut, (n) => n.programs),
};
const credits = eventsOut.reduce((n, e) => n + e.credits.reduce((m, c) => m + c.names.length, 0), 0);
function readme() {
  const L = [];
  const row = (label, c, total) => `| ${label} | ${PROGRAM_IDS.map((p) => c[p]).join(" | ")} | ${total} |`;
  L.push("# data/ — the merged research", "",
    "Generated by `scripts/merge-research.mjs` (Agent C). **Do not hand-edit the JSON**: fix the research or the named",
    "tables in the script, then regenerate. Every record keeps its `source_url`; unknowns are `null`; descriptions and",
    "bios are verbatim (whitespace and HTML entities normalized only). The build (`build/core/schema.mjs`) validates",
    "every field; the script runs the same validator before it writes anything.", "",
    "## Regenerate", "", "```sh",
    "node scripts/merge-research.mjs                 # research → data/*.json + this README (geocodes via Nominatim, cached)",
    "node scripts/merge-research.mjs --offline       # cache only, no network",
    "node scripts/merge-research.mjs --check         # validate without writing",
    "CW_OUT=.cache/out-c node build.mjs              # private build (never a plain build while agents work)",
    "```", "",
    "Research input: `$CW_RESEARCH` (default `.cache/research/`, a local copy that is not in the repo), one folder per slice. Geocoding cache:",
    "`.cache/geocode.json` (OpenStreetMap Nominatim, ≤ 1 request/second, User-Agent `cincy-week-build`).", "",
    "## Counts", "", `| file | ${PROGRAM_IDS.join(" | ")} | total |`, `|---|${PROGRAM_IDS.map(() => "---:").join("|")}|---:|`,
    row("events", C.events, eventsOut.length), row("works", C.works, worksOut.length), row("people (by program)", C.people, peopleList.length),
    row("venues (by program)", C.venues, venuesOut.length), row("orgs (by role)", C.orgs, orgsOut.length), row("faqs", C.faqs, faqsOut.length),
    row("facts", C.facts, factsOut.length), row("news (tagged)", C.news, newsOut.length), "",
    `Also: ${programs.length} programs, ${staysOut.length} stays (${staysOut.filter((s) => s.room_block).length} with a room block, ${staysOut.filter((s) => s.booking_portal).length} on BLINK's hotel portal), ${placesOut.length} places (${PLACE_KINDS.map((k) => `${placesOut.filter((p) => p.kind === k).length} ${k}`).join(", ")}), ${Object.keys(aliases.venues).length} venue aliases, ${Object.keys(aliases.hoods).length} hood aliases.`,
    `FotoFocus / also people: ${alsoKept.size} kept as person records, ${alsoCredited.size} name-only artists and participants kept as plain-text \`credits\` on their events (${credits} credit names).`, "",
    "## Provenance per file", "",
    "| file | built from (research/…) |", "|---|---|",
    "| programs.json | caw/program.json, scw-info/program.json, blink-info/program.json, also/programs.json (fotofocus, also) |",
    "| events.json | scw-agenda/events.json (+ scw-info/agenda_enrichment.json), scw-info/events.json (anchor events not on the agenda), blink-art/events.json, caw/events.json, also/events.json (fotofocus + also) |",
    "| people.json | scw-agenda/people.json, caw/people.json, blink-info/people.json, blink-art/people.json, also/people.json (page policy below) |",
    "| works.json | blink-art/works.json, caw/works.json |",
    "| venues.json | scw-info, scw-agenda, caw, blink-art, also, stay-move venues.json (merged by id; only venues a kept event, work or program hub uses) |",
    "| orgs.json | scw-info/orgs.json (2026 partners page), scw-agenda/orgs.json (session sponsors), blink-info/orgs.json (2026 sponsors page + footer), caw/orgs.json, also/orgs.json |",
    "| stays.json | scw-info/stays.json (room blocks), stay-move/stays.json, caw/stays.json, blink-info/stays.json (Visit Cincy BLINK 2026 hotel portal) |",
    "| places.json | stay-move/places.json, blink-info/places.json, blink-art/places.json, + OpenStreetMap neighborhoods for venues outside the nine core hoods |",
    "| faqs.json | caw/faqs.json, scw-info/faqs.json, blink-info/faqs.json, also/faqs.json |",
    "| facts.json | news/facts.json (with quote and source) + every program stat (programs.json `stats`) |",
    "| news.json | union of the current data/news.json (Agent G's refresher wins) with news/news.json, blink-info/news.json, caw/news.json, scw-info/news.json; deduplicated by URL; newest first |",
    "| aliases.json | the previous aliases.json + merged venue names + the neighborhood spellings table (`HOOD_TEXT`) |", "",
    "## Policies (the named tables in the script)", "",
    "- **People page policy.** Every person referenced by a caw, scw or blink record is a person record (BLINK artists also when they are on the 2026 participating-artists list). FotoFocus and \"also\" people become person records only when they have a bio or a headshot, or are a curator, speaker, performer or moderator on an event overlapping Oct 3–11. Everyone else (the ~550 name-only FotoFocus artists, jurors, advisors) stays searchable as plain text in the event's `credits: [{ role, names }]` (role is the source's own label when it has one: \"Artists\", \"Juror\", \"Advisors\"; otherwise a plural of the research role). `people` + `credits` together are everyone credited, with no name in both.",
    "- **people_roles** are set only on FotoFocus / also events: the event's credit line first, then \"Curated by\", then the kind of event (exhibition → artist, talk → speaker, performance → performer).",
    "- **Merges** are conservative: same id in two slices, an exact normalized-name match, or an entry in `PERSON_MERGES` / `VENUE_MERGES` with its evidence. Orgs merge on a normalized name (plus `ORG_ALIAS` for P&G and Fifth Third spellings).",
    `- **Locations.** An event without a venue gets \`location_text: "${LOCATION_UNLISTED}"\` (${eventsOut.filter((e) => e.location_text === LOCATION_UNLISTED).length} events, ${eventsOut.filter((e) => e.location_text === LOCATION_UNLISTED && e.program === "scw").length} of them StartupCincy Week: the agenda gives no room or venue; attendees check in daily at Union Hall). Pages should style that string as an unknown.`,
    "- **Hoods.** The research's neighborhood text (`HOOD_TEXT`), else OpenStreetMap reverse geocoding (suburb/city → the nine core hoods). Cincinnati neighborhoods outside the nine that hold a venue get an OpenStreetMap-sourced neighborhood place with `summary: null`. Venues outside Cincinnati/Covington/Newport keep `hood: null` and their city.",
    "- **is_free** is true only when the published cost starts with \"Free\" (not \"Free to Pass Holders\"/\"with admission\"), false only when it names a price and never the word free; otherwise null.",
    "- **featured** is set only from an organizer's own highlight list (`FEATURED`) and FotoFocus's own \"Featured Exhibitions\".",
    "- **Room blocks** keep the published code, rate, dates, deadline and booking link; `status` records that both SCW blocks were closed on Sep 24, 2026. The 128 hotels on BLINK's Visit Cincy portal are not room blocks: they carry `booking_portal` instead.", "",
  );
  L.push("## Notes for the page agents", "",
    `- \`location_text: "${LOCATION_UNLISTED}"\` is the only sentinel string in the data: print it as an unknown (\`.unk\`), never as a place.`,
    "- `events.credits` holds names without a person record; `people` + `people_roles` hold the linked ones (roles only on FotoFocus / also events). Index credit names for search. The client gets them as `cr` in assets/data/events.json.",
    "- `stays.room_block.status` says whether a block is still bookable (both SCW blocks were closed on Sep 24). `stays.booking_portal` marks BLINK's Visit Cincy portal hotels: a booking link, not a discounted block. Stays are ordered room blocks first, then by distance from Fountain Square.",
    "- `facts.quote` is the verbatim sentence a fact rests on and `facts.source` the publication; program `stats` are repeated in facts.json (`<program>-stat-…`) without a quote.",
    `- Neighborhood places: the nine core hoods carry sourced summaries; ${extraHoods.length} more (${extraHoods.map((h) => h.name).join(", ")}) come from OpenStreetMap for venues outside them and have \`summary: null\`.`,
    "- Works whose notes contain `description_is_artist_bio` publish the artist biography as the artwork text (same as the person's bio).",
    "- Event tags kept from the research include `draft-schedule` (CAW's unlisted draft schedule: say so), `sponsored`, `repeated-session`, `free`, `invitation-only`, `application-required`, `first-come-first-served`, `sign-up-required`, `registration-add-on`, `blink-around-town`, `blink-related`.",
    "- news.json mixes 2026 coverage with older background (`kind: \"history\"`, back to 2017); filter by `kind` or `date` for \"latest news\".",
    `- Merged person ids: ${PERSON_MERGES.map(([k, d]) => `\`${d}\` → \`${k}\``).join(", ")}. An images.json entry under the old id is no longer used.`,
    "");
  const sec = (title, arr) => { L.push(`## ${title}`, ""); if (!arr.length) L.push("None.", ""); else { for (const x of arr) L.push(`- ${x}`); L.push(""); } };
  L.push("## QA audit (2026-09-24)", "",
    "A data-accuracy audit re-checked records against the live sources (every StartupCincy Week session time, every BLINK and Art Week",
    "event, 31 FotoFocus and 25 other events, 25 people plus all 242 headshots, BLINK work points, 87 venue addresses, all 120 logos, both",
    "room blocks, facts and news). These corrections come from its named tables in the script (`QA_*`), each with its evidence:", "");
  for (const x of LOG.qa) L.push(`- ${x}`);
  L.push("", "Also fixed outside data/: `site/js/lib/time.js` `fmtDateRange` names both years for runs of a year or more (\"Aug 28–13\" was printed for Aug 28, 2026–Aug 13, 2027), and page copy that claimed \"every\" session or called all stays hotels. The full check list is in `.cache/qa-data.md` (not committed).", "");
  sec("Merges and deduplication", LOG.merge);
  sec("Dropped on purpose", LOG.drop);
  sec("Corrections and normalizations", LOG.fix);
  sec("Coordinates and geocoding", LOG.geo);
  sec("Known gaps", [
    `Cincinnati Art Week: the program is only partly announced. The schedule comes from an unlisted draft page (cincinnatiartweek.com/schedule, tagged \`draft-schedule\`); storefront gallery addresses, the map and most artists were not public on 2026-09-24, so ${eventsOut.filter((e) => e.venue_id === "caw-footprint-otr").length} CAW events sit on the zone venue \`caw-footprint-otr\` without coordinates.`,
    `StartupCincy Week: the agenda publishes no room or venue for most sessions ("${LOCATION_UNLISTED}"); only ${eventsOut.filter((e) => e.program === "scw" && e.venue_id).length} SCW events have a venue from their own text or an official host page. Speaker roles (moderator vs panelist) are not published, so SCW events carry no people_roles.`,
    `BLINK: Ready. Set. BLINK! performers and the Asianati Night Market's Thursday performances are not announced; ${worksOut.filter((w) => w.program === "blink" && !w.description).length} of ${worksOut.filter((w) => w.program === "blink").length} works have no description and ${worksOut.filter((w) => w.program === "blink" && !w.image_url).length} no image yet; ${worksOut.filter((w) => w.program === "blink" && /description_is_artist_bio/.test(w.notes || "")).length} works publish the artist's biography as their description (flagged in notes).`,
    "FotoFocus: most exhibition hours are venue hours, not listed per exhibition (events are all-day, \"hours not listed\"). Venues in Dayton and Columbus are listed but fall outside the map region.",
    "Each research slice documents its capture and verification in research/<slice>/REPORT-extract.md (and REPORT-verify.md where a verification pass ran); provenance above also comes from the JSON records and their notes.",
    ...LOG.gap,
  ]);
  sec("Research inputs read", LOG.input);
  return L.join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}

/* ================================================================ WRITE ================================================================ */
if (failedCalls) note("geo", `${failedCalls} Nominatim lookup(s) failed this run (not cached; rerun to retry)`);
if (offlineMisses) note("geo", `${offlineMisses} Nominatim lookup(s) not in the cache (offline run: those hoods stay unknown; run online to fill)`);
const summary = `programs ${programs.length} · events ${eventsOut.length} · people ${peopleList.length} · works ${worksOut.length} · venues ${venuesOut.length} · orgs ${orgsOut.length} · stays ${staysOut.length} · places ${placesOut.length} · faqs ${faqsOut.length} · facts ${factsOut.length} · news ${newsOut.length} · credit names ${credits}${netCalls ? ` · Nominatim calls ${netCalls}` : ""}${offlineMisses ? ` · uncached lookups ${offlineMisses}` : ""}`;
if (CHECK) { console.log(`check ok: ${summary}`); process.exit(0); }
mkdirSync(DATA_OUT, { recursive: true });
const write = (f, v) => writeFileSync(join(DATA_OUT, f), JSON.stringify(v, null, 2) + "\n");
for (const [f, arr] of Object.entries(OUT)) write(`${f}.json`, arr);
write("aliases.json", aliases);
writeFileSync(join(DATA_OUT, "README.md"), readme());
console.log(`wrote data/: ${summary}`);
