#!/usr/bin/env node
/* ============================================================
   scripts/apply-blink-map.mjs · data maintenance (2026-09-24)
   BLINK's official 2026 folding map (research/blink-map/blink-map-2026.json, extracted from
   https://www.blinkcincinnati.com/files/assets/2026blinkfoldingmapmap.pdf by scripts/extract-blink-map.py)
   → hand-maintained data/*.json, following CLAUDE.md ("Maintaining the site during the week"):
   ids are never renamed or deleted, text stays verbatim, every change says why in the record's `notes`.

     node scripts/apply-blink-map.mjs              # reconcile, log every decision, validate, write data/
     node scripts/apply-blink-map.mjs --check      # reconcile and log; write nothing; exit 1 if data/ would change
     node scripts/apply-blink-map.mjs --quiet      # only the summary
     node scripts/apply-blink-map.mjs --data <dir> # another data folder (tests run it on a copy)

   Idempotent: the target of every field is computed from the map and from BLINK's online map as it was frozen in
   research/blink-art/ (never from values this script wrote), so a second run changes nothing. It is NOT the merge:
   it edits only the records named below and leaves every other byte of data/ alone.

   What it does
   1. Works. Each of the 92 numbered entries (93 parts: No. 25 prints two works) is matched to BLINK's online-map
      works (research/blink-art/works.json), one to one, strongest evidence first:
        title+credit  the printed title and a printed credit name both match
        credit        a printed credit name matches the work's artists, same category, pin within 200 m
        title         the printed title matches, same category and zone, pin within 200 m
        location      the online record names no artist; same zone and category; the nearest such work, within
                      the pin's ~90% radius (approx_m) or 100 m. A probable match: its notes say "confirm".
      A matched work gets map_no, the KEY's category, the map's zone when it differs (and the zone venue, and the
      events that show it), the printed title verbatim whenever it differs (the online title moves to `aliases` unless
      it differs only in case or punctuation; the map's generic "Mural" and KEEP_TITLE keep the online title), people
      linked by exact name from the printed credit, `artist_text` = the printed credit verbatim (the by-line) unless the
      linked people's names already read exactly so, and the map PDF in `also_sources`. BLINK's online coordinates are
      kept; the printed pin only fills a missing point.
      Printed entries with no online work that are art or attractions become new works (id blink-<slug>), with the
      printed title and credit verbatim, the printed extra line as `description`, the pin's georeferenced
      coordinates (approximate) or the named venue's, source_url = the PDF.
   2. Facilities (places kind "facility"): the five Oasis Stations (numbered; matched by name to BLINK's online
      amenities, whose coordinates are kept), the merch shop (No. 45), restrooms (online restrooms paired by
      proximity keep their coordinates; the rest are added at the georeferenced symbol), hospitality zones (with
      the Food & Drinks symbol they hold), the Urban Hikers departure hubs (the map's Hike Departure symbols) and
      the two Drone Show Viewing Areas (No. 67).
   3. Venues and events: coordinates from the map for venues that had none (moved to the end of venues.json so no
      map pin is renumbered) and for the opening ceremony's street; the drone shows and the opening ceremony are
      checked against the printed times (reported, never guessed).
   4. programs.json: BLINK's `maps` lists the PDF.
   ============================================================ */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateFile, SPECS } from "../build/core/schema.mjs";
import { haversine } from "../site/js/lib/geo.js";
import { slugify } from "../site/js/lib/text.js";
import { listJoin } from "../build/core/util.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const opt = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const CHECK = flag("--check"), QUIET = flag("--quiet");
const DATA = resolve(opt("--data") || join(REPO, "data"));
const MAP_JSON = resolve(opt("--map") || join(REPO, "research", "blink-map", "blink-map-2026.json"));
const ONLINE = resolve(opt("--online") || join(REPO, "research", "blink-art"));

const TODAY = "2026-09-24";
const MARK = `BLINK official map (${TODAY}):`;   // every note this script writes starts with this …
const MARK_END = "[/BLINK map]";                   // … and ends with this, so a re-run replaces only its own sentence
const MAP = JSON.parse(readFileSync(MAP_JSON, "utf8"));
const PDF = MAP.source_url;

/* ---------------------------------------------------------------- tables (every judgment call, named) */
/** The map's zone names → the zone spellings data/works.json uses (BLINK's online map). */
const ZONE = { "Findlay Market": "Findlay Market", OTR: "Over the Rhine", Fountain: "Fountain District", "The Banks": "The Banks", Covington: "Covington", "BLINK at Lytle Park": "BLINK at Lytle Park" };
/** The KEY's art categories → the works schema's medium (anything else: see MEDIUM_OF). */
const MEDIUM = { Projections: "projection mapping", Murals: "mural", "Light Installations": "light installation" };
/** Unique Attractions whose medium is plain from the printed words; every other attraction is "other". */
const MEDIUM_OF = { 62: ["performance", "a fashion show is a performance"] };
/** Printed "titles" that name a maker, not a work: the online title stays. */
const KEEP_TITLE = {
  38: "the bold line \"4Wall Entertainment\" names the lighting company, not the work",
  46: "the bold line \"Tristan Eaton\" names the muralist whose 2022 mural the work lights (UC News), not the work",
};
/** Printed credits read differently from the default (title = bold line, credit = medium line). */
const CREDIT_OF = { 38: ["4Wall Entertainment", "the bold line names the maker (as the credit of Nos. 18 and 73); the medium line reads \"4Wall lighting\""] };
/** Entries whose printed extra line names a venue in data/venues.json: the work links it and takes its coordinates. */
const VENUE_OF = {
  53: ["mercantile-immersive", "printed \"at the Mercantile Immsersive\" (sic): The Mercantile Immersive, 120 E 4th St"],
  34: ["court-street-plaza", "the Asianati Night Market's events are at Court Street Plaza (anm.asianati.com); the map pins No. 34 on Court St"],
};
/** Facts about an entry worth keeping next to it (never rendered). */
const NOTE_OF = { 53: "BLINK Around Town and The Mercantile Immersive spell the artist \"Charley\" (data/events.json blink-2026-10-09-harper-alive, \"Harper Alive\"); the title keeps the map's spelling" };
/** Entries that are facilities (places.json), not works. */
const FACILITY_OF_CATEGORY = { "Oasis Station": "oasis-station", "Official BLINK Merch Shop": "merch-shop" };
const FACILITY_ENTRIES = { 67: "drone-viewing" };
/** Venues that take coordinates from a printed symbol or pin. */
const VENUE_COORDS = [
  { venue: "blink-ohio-river-drone-show", symbol: (s) => s.kind === "drone-show" && /FRI/.test(s.label),
    why: "the map's dotted ring over the river labeled \"DRONE SHOWS FRI, SAT, SUN 8 PM & 10 PM\"; the two Drone Show Viewing Areas (No. 67) are facilities in data/places.json" },
  { venue: "court-street-plaza", entry: 34, why: "the map pins No. 34, Asianati Night Market, on Court St between Vine and Walnut (the market's venue)" },
  { venue: "blink-ready-set-blink-central-parkway", symbol: (s) => s.kind === "opening-ceremony",
    why: "the midpoint of the map's opening-ceremony strip on Central Pkwy (\"OPENING CEREMONY ON CENTRAL PKWY 4-9 PM THURS 10/8\"); it replaces TQL Stadium's coordinates, which sat west of the street" },
];
/** Online facilities are paired with printed symbols within these distances (meters). */
const PAIR_M = { restroom: 150, "hike-departure": 200, "oasis-station": 150 };
const STOP = new Set(["studio", "studios", "design", "mural", "murals", "light", "lighting", "projection", "experience", "center", "centre", "the", "and", "collective", "university", "entertainment", "multiple", "artists", "series", "school", "cincinnati", "station", "oasis", "theater", "theatre", "bathroom", "bathrooms"]);

/* ---------------------------------------------------------------- helpers */
const key = (s) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/([a-z])!([a-z])/g, "$1i$2").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
const tight = (s) => key(s).replace(/^the /, "").replace(/ /g, "");
const tokens = (s) => key(s).split(" ").filter((t) => t.length >= 5 && !STOP.has(t));
const splitNames = (s) => String(s || "").split(/,\s*|\s+(?:and|&|\+)\s+|\s+-\s+/).map((x) => x.trim()).filter(Boolean);
const dist = (a, b) => (a && b && a.lat != null && b.lat != null ? Math.round(haversine(a, b)) : null);
const read = (f) => JSON.parse(readFileSync(join(DATA, `${f}.json`), "utf8"));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const log = [];
const say = (s) => { log.push(s); if (!QUIET) console.log(s); };
const tell = (s) => { log.push(s); console.log(s); };   // the summary prints even with --quiet

/** set `k` on a record; a new key goes where the schema lists it (before the first later field present, `notes` last),
 *  so a record gets the same key order however many runs added its fields */
function put(rec, k, v, changes, where) {
  if (k in rec) { if (!same(rec[k], v)) { changes.push(`${where}.${k}`); rec[k] = v; } return; }
  const order = [...Object.keys(SPECS[/data\/(\w+)\.json/.exec(where)[1]]), "notes"];
  const at = order.indexOf(k);
  const out = {};
  let placed = false;
  for (const [kk, vv] of Object.entries(rec)) {
    if (!placed && order.indexOf(kk) > at) { out[k] = v; placed = true; }
    out[kk] = vv;
  }
  if (!placed) out[k] = v;
  for (const kk of Object.keys(rec)) delete rec[kk];
  Object.assign(rec, out);
  changes.push(`${where}.${k}`);
}
/** notes = the record's own notes (this script's earlier sentence cut out; anything a maintainer wrote around it kept)
 *  + this script's sentence, last */
const ownNotes = (s) => {
  s = s || "";
  const i = s.indexOf(MARK); if (i < 0) return s.trim();
  const j = s.indexOf(MARK_END, i);
  return `${s.slice(0, i)} ${j < 0 ? "" : s.slice(j + MARK_END.length)}`.replace(/\s+/g, " ").trim();
};
function note(rec, text, changes, where) {
  put(rec, "notes", [ownNotes(rec.notes), `${MARK} ${text} ${MARK_END}`].filter(Boolean).join(" "), changes, where);
}

/* ---------------------------------------------------------------- load */
const files = ["works", "events", "venues", "places", "people", "programs"];
const D = Object.fromEntries(files.map((f) => [f, read(f)]));
const before = Object.fromEntries(files.map((f) => [f, JSON.stringify(D[f])]));
const changes = [];
/** Person ids the merge folded into another (data/README.md, "Merges"): research ids → data ids. */
const PERSON_MERGED = { "the-mz-icar-collective": "mz-icar", snellbeast: "jason-snell" };
const online = JSON.parse(readFileSync(join(ONLINE, "works.json"), "utf8")).filter((w) => w.program === "blink")
  .map((w) => ({ ...w, artists: (w.artists || []).map((a) => PERSON_MERGED[a] || a) }));
const onlinePlaces = JSON.parse(readFileSync(join(ONLINE, "places.json"), "utf8")).filter((p) => p.amenity_type);
const person = new Map(D.people.map((p) => [p.id, p]));
for (const w of online) for (const a of w.artists) if (!person.has(a)) throw new Error(`research/blink-art works.json#${w.id}: artist "${a}" is not in data/people.json (add it to PERSON_MERGED)`);
const byName = new Map(D.people.map((p) => [p.name, p.id]));
const work = new Map(D.works.map((w) => [w.id, w]));
const venue = new Map(D.venues.map((v) => [v.id, v]));
const place = new Map(D.places.map((p) => [p.id, p]));
const zoneVenue = new Map(D.venues.filter((v) => v.kind === "zone" && (v.programs || []).includes("blink")).map((v) => [v.name, v]));
const blink = D.programs.find((p) => p.id === "blink");
const zoneOf = (e) => ZONE[e.area || e.zone] || null;   // the list the entry is printed in decides (No. 55-58: the Lytle Park inset)

/* the printed parts: one per work (No. 25 has two) */
const parts = [];
for (const e of MAP.entries) {
  const ps = e.parts || [{ title: e.title, credit: e.credit, detail: e.detail ?? null }];
  ps.forEach((p, i) => parts.push({ e, n: e.n, i, title: p.title, credit: p.credit ?? null, detail: p.detail ?? e.detail ?? null, pin: e.pins[0], zone: zoneOf(e) }));
}
const isFacility = (x) => FACILITY_OF_CATEGORY[x.e.category] || FACILITY_ENTRIES[x.n];

/* ---------------------------------------------------------------- 1. works: match */
const namesOf = (w) => [...(w.artists || []).map((a) => person.get(a)?.name).filter(Boolean), w.artist_text].filter(Boolean);
function creditMatch(credit, w) {
  const ns = splitNames(credit);
  const ms = namesOf(w).flatMap((m) => [m, ...splitNames(m)]);
  for (const n of ns) for (const m of ms) {
    const a = tight(n), b = tight(m);
    if (a.length < 3 || b.length < 3) continue;
    if (a === b || (a.length >= 5 && b.includes(a)) || (b.length >= 5 && a.includes(b))) return `"${n}" ~ "${m}"`;
    const shared = tokens(n).filter((t) => tokens(m).includes(t));
    if (shared.length) return `"${n}" ~ "${m}" (shared name "${shared[0]}")`;
  }
  return null;
}
function titleMatch(title, w) {
  const a = tight(title), b = tight(w.title);
  if (a === b) return "same";
  if (a === "mural" && /^mural by /i.test(w.title)) return "generic mural";
  if (a.length >= 5 && b.includes(a)) return "online holds printed";
  if (b.length >= 5 && a.includes(b)) return "printed holds online";
  const sh = tokens(title).filter((t) => tokens(w.title).includes(t));
  if (sh.length) return `shared word "${sh[0]}"`;
  return null;
}
const cands = [];
for (const x of parts.filter((p) => !isFacility(p))) {
  for (const w of online) {
    const d = dist(x.pin, w);
    const t = titleMatch(x.title, w), c = x.credit ? creditMatch(x.credit, w) : null;
    const cat = w.category === x.e.category, zn = w.zone === x.zone, near = d == null || d <= 200;
    let rank = null, why = "";
    if (t && c) { rank = 0; why = `title ${t}, credit ${c}`; }
    else if (c && cat && near) { rank = 1; why = `credit ${c}; title differs`; }
    else if (t && cat && zn && near) { rank = 2; why = `title ${t}; no credit to compare`; }
    else if (!namesOf(w).length && cat && zn && d != null && d <= Math.max(x.pin.approx_m, 100)) { rank = 3; why = "location only: the online record names no artist"; }
    if (rank != null) cands.push({ x, w, rank, d: d ?? 9999, why });
    else if (d != null && d <= 60 && cat) cands.push({ x, w, rank: 9, d, why: "near-miss" });
  }
}
const matched = new Map(), usedW = new Set();
for (const c of cands.filter((c) => c.rank < 9).sort((a, b) => a.rank - b.rank || a.d - b.d || a.x.n - b.x.n)) {
  const k = `${c.x.n}:${c.x.i}`;
  if (matched.has(k) || usedW.has(c.w.id)) continue;
  if (c.rank === 3) {   // location: the nearest candidate-free work only
    const nearer = cands.some((o) => o.x === c.x && o.rank === 3 && o.d < c.d && !usedW.has(o.w.id));
    if (nearer) continue;
  }
  matched.set(k, c); usedW.add(c.w.id);
}
const METHOD = ["title+credit", "credit", "title", "location"];

/* ---------------------------------------------------------------- 1b. works: apply */
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const pinNote = (pin) => `the printed pin, georeferenced (research/blink-map; approximate, about ±${pin.approx_m} m)`;
const linked = (credit) => splitNames(credit).map((n) => byName.get(n)).filter(Boolean);
/** artist_text for a printed credit: the credit itself, unless the linked people's names (as the pages join them) read exactly so */
const byLineFor = (credit, ids) => (credit && listJoin(ids.map((id) => person.get(id)?.name).filter(Boolean)) !== credit ? credit : null);
const printedLines = (e) => e.printed.map((l) => `"${l}"`).join(" / ");
const counts = { matched: 0, byMethod: {}, titles: 0, zones: 0, added: 0, facilitiesAdded: 0, facilitiesUpdated: 0, events: 0, venues: 0 };

say(`\n== Works: ${parts.length} printed parts (${MAP.entries.length} numbered entries) against ${online.length} BLINK works on the online map`);
for (const x of parts) {
  const k = `${x.n}:${x.i}`;
  if (isFacility(x)) continue;
  const m = matched.get(k);
  const label = `No. ${x.n}${x.e.parts ? ` (part ${x.i + 1})` : ""} ${x.e.category} "${x.title}"${x.credit ? ` – ${x.credit}` : ""}`;
  const near = cands.filter((c) => c.x === x && (!m || c.w.id !== m.w.id) && c.d <= 150).sort((a, b) => a.d - b.d).slice(0, 2);
  if (m) {
    const w0 = m.w, w = work.get(w0.id), where = `data/works.json#${w0.id}`;
    const bits = [];
    counts.matched++; counts.byMethod[METHOD[m.rank]] = (counts.byMethod[METHOD[m.rank]] || 0) + 1;
    put(w, "map_no", x.n, changes, where);
    if (w0.category !== x.e.category) { bits.push(`category "${w0.category}" → "${x.e.category}" (the map's KEY)`); }
    put(w, "category", x.e.category, changes, where);
    const med = MEDIUM[x.e.category];
    if (med && w0.medium !== med) { bits.push(`medium "${w0.medium}" → "${med}" (the map's KEY)`); put(w, "medium", med, changes, where); }
    // zone: the map's list decides; the zone venue and the events that show the work follow
    let zone = w0.zone, zv = w0.venue_id;
    if (x.zone && x.zone !== w0.zone) {
      zone = x.zone; zv = zoneVenue.get(zone)?.id || w0.venue_id; counts.zones++;
      bits.push(`zone "${w0.zone}" → "${zone}" (the map lists No. ${x.n} under ${x.e.zone} and pins it there)`);
      // (the old zone venue or, on a re-run, the new one: the same events either way, so a second run writes the same notes)
      for (const ev of D.events.filter((ev) => (ev.work_ids || []).includes(w0.id) && [w0.venue_id, zv].includes(ev.venue_id))) {
        put(ev, "venue_id", zv, changes, `data/events.json#${ev.id}`);
        note(ev, `venue ${w0.venue_id} → ${zv}: BLINK's official map lists this work (No. ${x.n}, "${x.title}") in the ${x.e.zone} zone and pins it there; BLINK's online listing had filed it under ${w0.zone} with no spot (${PDF}).`, changes, `data/events.json#${ev.id}`);
        counts.events++;
        bits.push(`the event ${ev.id}, which shows this work, moves with it (venue ${w0.venue_id} → ${zv})`);
      }
    }
    put(w, "zone", zone, changes, where); put(w, "venue_id", zv, changes, where);
    // coordinates: BLINK's online point stays; the printed pin fills a missing one
    const d = dist(x.pin, w0);
    if (w0.lat == null) { put(w, "lat", x.pin.lat, changes, where); put(w, "lng", x.pin.lng, changes, where); put(w, "approx_m", x.pin.approx_m, changes, where); bits.push(`coordinates from ${pinNote(x.pin)}: BLINK's online map gives none`); }
    else { put(w, "lat", w0.lat, changes, where); put(w, "lng", w0.lng, changes, where); if (d > x.pin.approx_m) bits.push(`the printed pin is ${d} m from BLINK's online point (more than its ±${x.pin.approx_m} m): online coordinates kept`); }
    // title: the printed title, verbatim, whenever it differs (verification 2026-09-24: typography included, since the
    // printed map is what a visitor holds); the online title stays only for the map's generic "Mural" and KEEP_TITLE.
    // The online title goes to `aliases` (searchable, "Also listed as") unless it differs only in case or punctuation.
    const t = titleMatch(x.title, w0);
    let title = w0.title;
    if (KEEP_TITLE[x.n]) bits.push(`printed title "${x.title}" not used: ${KEEP_TITLE[x.n]}`);
    else if (t === "generic mural") bits.push(`printed title "${x.title}" (the map's generic "Mural"): online title kept`);
    else if (x.title !== w0.title) { title = x.title; counts.titles++; bits.push(`title "${w0.title}" (BLINK's online map${key(x.title) !== key(w0.title) ? ", kept in aliases" : "; the same words"}) → "${x.title}" (as printed)`); }
    put(w, "title", title, changes, where);
    const aliases = title !== w0.title && key(title) !== key(w0.title) ? [w0.title] : [];
    if (aliases.length) put(w, "aliases", aliases, changes, where);
    else if ("aliases" in w) put(w, "aliases", [], changes, where);
    // people: online artists + exact-name matches from the printed credit
    const credit = CREDIT_OF[x.n] ? CREDIT_OF[x.n][0] : x.credit;
    if (CREDIT_OF[x.n]) bits.push(`credit read as "${credit}": ${CREDIT_OF[x.n][1]}`);
    const add = linked(credit).filter((id) => !(w0.artists || []).includes(id));
    const artists = [...(w0.artists || []), ...add];
    put(w, "artists", artists, changes, where);
    if (add.length) bits.push(`linked ${add.join(", ")} (exact name in the printed credit)`);
    // the by-line is the printed credit, verbatim (artist_text), unless the linked people's names already read exactly so
    const at = credit ? byLineFor(credit, artists) : w0.artist_text ?? null;
    put(w, "artist_text", at, changes, where);
    if (credit && (w0.artists || []).length) { const on = namesOf(w0).join(", "); if (at === credit) bits.push(`credit "${credit}" as printed (the by-line); BLINK's online map credits ${on} (linked)`); }
    else if (at && at !== w0.artist_text) bits.push(`credit "${at}" as printed (BLINK's online map names no artist)`);
    if (x.detail) bits.push(`printed extra line "${x.detail}"`);
    for (const q of x.e.quirks || []) if (!/ligature/.test(q)) bits.push(`the map: ${q}`);
    put(w, "also_sources", [...new Set([...(w0.also_sources || []), PDF])], changes, where);
    const conf = m.rank === 3 ? ` PROBABLE MATCH, confirm with BLINK: ${m.why}; same zone and category, ${d} m from the printed pin.` : "";
    note(w, `No. ${x.n} (${x.e.category}), printed ${printedLines(x.e)}.${conf} ${cap(bits.join("; "))}${bits.length ? "." : ""}`.replace(/\s+/g, " ").trim(), changes, where);
    say(`${label}\n   → ${w0.id} [${METHOD[m.rank]}: ${m.why}; ${d == null ? "no online point" : `${d} m from the pin (±${x.pin.approx_m})`}]${bits.length ? `\n   · ${bits.join("\n   · ")}` : ""}${near.length ? `\n   near: ${near.map((c) => `${c.w.id} ${c.d} m (${c.why})`).join("; ")}` : ""}`);
    continue;
  }
  // unmatched printed art or attraction → a new work
  const slug = slugify(x.title);
  const id = slug.startsWith("blink-") ? slug : `blink-${slug}`;
  const ven = VENUE_OF[x.n] ? venue.get(VENUE_OF[x.n][0]) : null;
  const zv = zoneVenue.get(x.zone);
  const credit = x.credit;
  const people = linked(credit);
  const medium = MEDIUM[x.e.category] || (MEDIUM_OF[x.n] ? MEDIUM_OF[x.n][0] : "other");
  // a named venue's own coordinates (its address) beat the schematic pin, unless this script gave the venue the pin itself
  const ll = ven && ven.lat != null && !(ven.notes || "").includes(MARK) ? { lat: ven.lat, lng: ven.lng } : { lat: x.pin.lat, lng: x.pin.lng };
  const bits = [
    `Added from BLINK's official folding map: No. ${x.n}${x.e.parts ? ` (the ${x.i ? "second" : "first"} of ${x.e.parts.length} works printed under that number)` : ""}, KEY "${x.e.category}", ${x.e.zone} zone list, printed ${printedLines(x.e)}.`,
    `No BLINK online-map work matched (checked by title, credit, zone and distance).`,
    ll.lat === x.pin.lat ? `Coordinates: ${pinNote(x.pin)}.` : `Coordinates: ${ven.name}'s (its published address); the printed pin is ${dist(x.pin, ven)} m away.`,
    ven ? `Venue: ${VENUE_OF[x.n][1]}.` : "",
    medium === "other" ? `Medium "other": the map's KEY says only "${x.e.category}".` : MEDIUM_OF[x.n] ? `Medium "${medium}": ${MEDIUM_OF[x.n][1]}.` : "",
    people.length ? `Linked ${people.join(", ")} (exact name in the printed credit).` : "",
    x.detail ? "The description is the entry's printed extra line." : "",
    NOTE_OF[x.n] ? `${NOTE_OF[x.n]}.` : "",
    ...(x.e.quirks || []).filter((q) => !/ligature|2 works printed/.test(q)).map((q) => `The map: ${q}.`),
  ].filter(Boolean).join(" ");
  const rec = {
    id, program: "blink", title: x.title, artists: people, artist_text: byLineFor(credit, people),
    medium, category: x.e.category, zone: x.zone, venue_id: ven ? ven.id : zv ? zv.id : null, location_text: null,
    lat: ll.lat, lng: ll.lng, approx_m: ll.lat === x.pin.lat ? x.pin.approx_m : null, hours_text: null, description: x.detail, image_url: null, sponsor: null, sponsor_org_id: null, year: 2026,
    map_no: x.n, source_url: PDF, notes: `${MARK} ${bits} ${MARK_END}`,
  };
  if (!credit) rec.artist_text = null;
  const had = work.get(id);
  if (had && !(had.notes || "").includes(MARK)) throw new Error(`data/works.json#${id} exists and was not added by this script: pick another id`);
  if (D.events.some((e) => e.id === id)) throw new Error(`${id} is an event id (events and works share URL space)`);
  if (!had) { D.works.push(rec); work.set(id, rec); changes.push(`data/works.json#${id} (new)`); }
  else if (!same(had, rec)) { for (const k of Object.keys(had)) delete had[k]; Object.assign(had, rec); changes.push(`data/works.json#${id}`); }
  counts.added++;
  say(`${label}\n   + NEW ${id} (${medium}${ven ? `, at ${ven.id}` : ""})${near.length ? `\n   near: ${near.map((c) => `${c.w.id} ${c.d} m (${c.why})`).join("; ")}` : ""}`);
}
// online works the printed map does not show
for (const w0 of online.filter((w) => !usedW.has(w.id))) {
  const w = work.get(w0.id);
  const nearest = parts.map((x) => ({ x, d: dist(x.pin, w0) })).filter((o) => o.d != null).sort((a, b) => a.d - b.d)[0];
  const why = `Not on BLINK's printed folding map as its own entry; the nearest printed pin is No. ${nearest.x.n} "${nearest.x.title}" (${nearest.x.e.category}), ${nearest.d} m away. Kept as BLINK's online map lists it.`;
  note(w, why, changes, `data/works.json#${w0.id}`);
  say(`ONLINE ONLY ${w0.id} "${w0.title}" (${w0.zone}): ${why}`);
}

/* ---------------------------------------------------------------- 2. facilities */
say(`\n== Facilities`);
const KEYDESC = Object.fromEntries(MAP.key.map((k) => [k.category, k.description]));
const zslug = (z) => slugify(z === "OTR" ? "otr" : z);
const hoodOf = (zone) => zoneVenue.get(zone)?.hood || null;
function placeRec(id, f) {
  return { id, kind: "facility", name: f.name, short_name: null, summary: f.summary ?? null, details: f.details ?? null, address: null, hood: f.hood ?? null,
    lat: f.lat, lng: f.lng, approx_m: f.approx_m, url: f.url ?? null, facility: f.facility, program: "blink", zone: f.zone ?? null, map_no: f.map_no ?? null, source_url: PDF, notes: `${MARK} ${f.notes} ${MARK_END}` };
}
function upsertPlace(rec) {
  const had = place.get(rec.id);
  if (had && !(had.notes || "").includes(MARK)) throw new Error(`data/places.json#${rec.id} exists and was not added by this script`);
  if (!had) { D.places.push(rec); place.set(rec.id, rec); changes.push(`data/places.json#${rec.id} (new)`); }
  else if (!same(had, rec)) { for (const k of Object.keys(had)) delete had[k]; Object.assign(had, rec); changes.push(`data/places.json#${rec.id}`); }
  counts.facilitiesAdded++;
}
function updatePlace(id, fields, why) {
  const p = place.get(id), where = `data/places.json#${id}`;
  if (!p) throw new Error(`${where} is missing`);
  for (const [k, v] of Object.entries(fields)) put(p, k, v, changes, where);
  note(p, why, changes, where);
  counts.facilitiesUpdated++;
}
const onlineById = new Map(onlinePlaces.map((p) => [p.id, p]));
// Oasis Stations: by name (a shared distinctive word) and distance
for (const x of parts.filter((p) => isFacility(p) === "oasis-station")) {
  const nm = x.title.replace(/^Oasis Station:\s*/, "");
  const c = onlinePlaces.filter((p) => p.amenity_type === "oasis station").map((p) => ({ p, d: dist(x.pin, p), t: tokens(nm).filter((t) => tokens(p.name).includes(t)) }))
    .filter((o) => o.t.length && o.d <= PAIR_M["oasis-station"]).sort((a, b) => a.d - b.d)[0];
  if (!c) throw new Error(`No. ${x.n} "${x.title}": no online Oasis Station matches`);
  updatePlace(c.p.id, { kind: "facility", name: x.title, summary: KEYDESC["Oasis Station"], lat: c.p.lat, lng: c.p.lng, facility: "oasis-station", program: "blink", zone: x.zone, map_no: x.n, also_sources: [PDF] },
    `No. ${x.n}, printed "${x.title}" (was "${c.p.name}" on BLINK's online map); summary = the map's KEY for Oasis Station. Kind accessibility → facility. BLINK's online coordinates kept (the printed pin is ${c.d} m away).${(x.e.quirks || []).filter((q) => !/ligature/.test(q)).map((q) => ` The map: ${q}.`).join("")}`);
  say(`No. ${x.n} "${x.title}" → ${c.p.id} [name: ${c.t.join(", ")}; ${c.d} m]`);
}
// the merch shop and the drone viewing areas (numbered, no online record)
for (const x of parts.filter((p) => isFacility(p) === "merch-shop")) {
  upsertPlace(placeRec("blink-map-merch-shop", { name: x.title, details: x.detail, facility: "merch-shop", zone: x.zone, hood: hoodOf(x.zone), map_no: x.n, lat: x.pin.lat, lng: x.pin.lng, approx_m: x.pin.approx_m,
    notes: `No. ${x.n}, KEY "${x.e.category}", printed ${printedLines(x.e)}. Coordinates: ${pinNote(x.pin)}; the Contemporary Arts Center is ${dist(x.pin, place.get("contemporary-arts-center"))} m from it.` }));
  say(`No. ${x.n} "${x.title}" + blink-map-merch-shop`);
}
for (const e of MAP.entries.filter((e) => FACILITY_ENTRIES[e.n] === "drone-viewing")) {
  for (const pin of e.pins) {
    const zone = ZONE[pin.zone_on_map];
    const id = `blink-map-drone-show-viewing-area-${zslug(pin.zone_on_map)}`;
    upsertPlace(placeRec(id, { name: e.title, details: e.detail, facility: "drone-viewing", zone, hood: hoodOf(zone), map_no: e.n, lat: pin.lat, lng: pin.lng, approx_m: pin.approx_m,
      notes: `No. ${e.n} (KEY "${e.category}"), printed ${printedLines(e)} in both The Banks and Covington lists; this is the pin in ${pin.zone_on_map}. Coordinates: ${pinNote(pin)}.` }));
    say(`No. ${e.n} "${e.title}" (${pin.zone_on_map}) + ${id}`);
  }
}
// unnumbered symbols: online restrooms and the Urban Hikers hubs are paired by proximity (greedy, closest first)
function pair(symbols, pool, maxM) {
  const all = [];
  for (const s of symbols) for (const p of pool) { const d = dist(s, p); if (d != null && d <= maxM) all.push({ s, p, d }); }
  const out = new Map(), used = new Set();
  for (const c of all.sort((a, b) => a.d - b.d || a.p.id.localeCompare(b.p.id))) if (!out.has(c.s) && !used.has(c.p.id)) { out.set(c.s, c); used.add(c.p.id); }
  return { out, used };
}
const sym = (k) => MAP.symbols.filter((s) => s.kind === k);
const rest = pair(sym("restroom"), onlinePlaces.filter((p) => p.amenity_type === "restroom"), PAIR_M.restroom);
const perZone = new Map();
for (const s of sym("restroom")) {
  const c = rest.out.get(s), zone = ZONE[s.zone_on_map] || null;
  if (c) {
    updatePlace(c.p.id, { kind: "facility", facility: "restroom", program: "blink", zone: c.p.zone || zone, also_sources: [PDF] },
      `A Restrooms symbol on the printed map is ${c.d} m from this online point (paired by proximity; ±${s.approx_m} m): BLINK's online coordinates kept. Kind accessibility → facility.`);
    say(`Restrooms (${s.zone_on_map}) → ${c.p.id} "${c.p.details}" [${c.d} m]`);
  } else {
    const z = s.zone_on_map || "other", k = (perZone.get(z) || 0) + 1; perZone.set(z, k);
    const id = `blink-map-restrooms-${zslug(z)}-${k}`;
    upsertPlace(placeRec(id, { name: "Restrooms", facility: "restroom", zone, hood: hoodOf(zone), lat: s.lat, lng: s.lng, approx_m: s.approx_m,
      notes: `A Restrooms symbol on the printed map (${s.zone_on_map} zone) with no BLINK online-map restroom within ${PAIR_M.restroom} m. Coordinates: ${pinNote(s)}.` }));
    say(`Restrooms (${s.zone_on_map}) + ${id} [no online restroom within ${PAIR_M.restroom} m]`);
  }
}
for (const p of onlinePlaces.filter((p) => p.amenity_type === "restroom" && !rest.used.has(p.id))) {
  updatePlace(p.id, { kind: "facility", facility: "restroom", program: "blink", zone: p.zone || null },
    `On BLINK's online map but with no Restrooms symbol within ${PAIR_M.restroom} m on the printed map (the nearest is ${Math.min(...sym("restroom").map((s) => dist(s, p)))} m away): kept as the online map lists it. Kind accessibility → facility.`);
  say(`ONLINE ONLY ${p.id} "${p.details}": no printed Restrooms symbol within ${PAIR_M.restroom} m`);
}
const hubs = D.places.filter((p) => /^blink-walk-hub-\d+$/.test(p.id));
const hike = pair(sym("hike-departure"), hubs, PAIR_M["hike-departure"]);
for (const s of sym("hike-departure")) {
  const c = hike.out.get(s);
  if (!c) { say(`Hike Departure at ${s.lat},${s.lng}: no Urban Hikers hub within ${PAIR_M["hike-departure"]} m (not added: the map gives no hub name)`); continue; }
  const zone = ZONE[s.zone_on_map] || null;
  updatePlace(c.p.id, { kind: "facility", facility: "hike-departure", program: "blink", zone, also_sources: [PDF] },
    `A Hike Departure symbol on the printed map (KEY: "${KEYDESC["Hike Departure"]}") is ${c.d} m from this hub's address (±${s.approx_m} m${c.d > s.approx_m ? "; the farthest pair, matched as the one hub left" : ""}). Kind tip → facility; coordinates stay the geocoded hub address.`);
  say(`Hike Departure (${s.zone_on_map || "no zone color"}) → ${c.p.id} [${c.d} m]`);
}
// hospitality zones, each with the Food & Drinks symbol it holds (nearest within 150 m)
const food = pair(sym("hospitality-zone"), sym("food-drinks").map((s, i) => ({ ...s, id: `food-${i}` })), 150);
for (const s of sym("hospitality-zone")) {
  const zone = ZONE[s.zone_on_map] || null, f = food.out.get(s);
  const id = `blink-map-hospitality-zone-${zslug(s.zone_on_map)}`;
  upsertPlace(placeRec(id, { name: "Hospitality Zone", summary: f ? "Food & Drinks" : null, facility: "hospitality-zone", zone, hood: hoodOf(zone), lat: s.lat, lng: s.lng, approx_m: s.approx_m,
    notes: `A "HOSPITALITY ZONE" label on the printed map (${s.zone_on_map} zone; drawn as ${s.shape === "area" ? "a yellow area" : s.shape === "street" ? "a yellow band along the street" : "a label only"}).${f ? ` The map's Food & Drinks symbol sits ${f.d} m from it, so the summary quotes that KEY label.` : " No Food & Drinks symbol is drawn with it."} Coordinates: ${pinNote(s)}.` }));
  say(`Hospitality Zone (${s.zone_on_map}) + ${id}${f ? ` [Food & Drinks symbol ${f.d} m]` : ""}`);
}
for (const s of sym("food-drinks")) if (![...food.out.values()].some((c) => c.p.lat === s.lat && c.p.lng === s.lng)) say(`Food & Drinks symbol at ${s.lat},${s.lng} (${s.zone_on_map}): no hospitality zone within 150 m (not added)`);

/* ---------------------------------------------------------------- 3. venues and events */
say(`\n== Venues and events`);
for (const t of VENUE_COORDS) {
  const v = venue.get(t.venue), where = `data/venues.json#${t.venue}`;
  if (!v) throw new Error(`${where} is missing`);
  const src = t.symbol ? MAP.symbols.find(t.symbol) : MAP.entries.find((e) => e.n === t.entry).pins[0];
  const had = v.lat != null && !(v.notes || "").includes(MARK);
  const prev = had ? ` (was ${v.lat}, ${v.lng})` : "";
  const prevNote = (v.notes || "").includes(MARK) ? (/\(was [^)]*\)/.exec(v.notes.slice(v.notes.indexOf(MARK))) || [""])[0] : "";
  const moved = v.lat == null;
  put(v, "lat", src.lat, changes, where); put(v, "lng", src.lng, changes, where); put(v, "approx_m", src.approx_m, changes, where);
  note(v, `coordinates ${src.lat}, ${src.lng}${prev || (prevNote ? ` ${prevNote}` : "")}: ${t.why}. Approximate (georeferenced; about ±${src.approx_m} m).${moved || /moved to the end/i.test(v.notes || "") ? " Moved to the end of venues.json so no other venue's map number changes." : ""}`, changes, where);
  if (moved) { D.venues.splice(D.venues.indexOf(v), 1); D.venues.push(v); changes.push(`${where} (moved to the end)`); }
  counts.venues++;
  say(`${t.venue}: ${src.lat}, ${src.lng}${prev} ±${src.approx_m} m${moved ? " (had none; moved to the end)" : ""}`);
}
// the printed times of the drone shows and the opening ceremony, against events.json
const DOW = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, THURS: 4, FRI: 5, SAT: 6 };
const days = []; for (let d = blink.dates.start; d <= blink.dates.end; d = new Date(Date.parse(d + "T12:00:00Z") + 864e5).toISOString().slice(0, 10)) days.push(d);
const dowOf = (d) => new Date(d + "T12:00:00Z").getUTCDay();
const hhmm = (h, m = "00") => `${String(Number(h) + 12).padStart(2, "0")}:${m}`;   // every printed time is PM
const expect = [];
const cer = MAP.symbols.find((s) => s.kind === "opening-ceremony");
{
  const md = /THURS (\d+)\/(\d+)/.exec(cer.label), day = `${blink.dates.start.slice(0, 4)}-${md[1].padStart(2, "0")}-${md[2].padStart(2, "0")}`;
  const [, a, b] = /(\d+)-(\d+) PM/.exec(cer.label), [, dh, dm] = /DRONE SHOW (\d+):(\d+) PM/.exec(cer.label);
  expect.push({ what: "opening ceremony", date: day, start: hhmm(a), end: hhmm(b), test: (e) => /opening ceremony/i.test(e.title) });
  expect.push({ what: "drone show", date: day, start: hhmm(dh, dm), test: (e) => (e.tags || []).includes("drone-show") });
}
for (const s of MAP.symbols.filter((s) => s.kind === "drone-show" && /FRI/.test(s.label))) {
  const dows = s.label.match(/\b(SUN|MON|TUE|WED|THURS|THU|FRI|SAT)\b/g).map((x) => DOW[x]);
  const hours = [...s.label.matchAll(/(\d+) PM/g)].map((m) => hhmm(m[1]));
  for (const d of days.filter((d) => dows.includes(dowOf(d)))) for (const h of hours) expect.push({ what: "drone show", date: d, start: h, venue: "blink-ohio-river-drone-show", test: (e) => (e.tags || []).includes("drone-show") });
}
const problems = [];
for (const x of expect) {
  const ev = D.events.filter((e) => e.program === "blink" && e.status !== "cancelled" && e.date === x.date && x.test(e) && e.start === x.start);
  if (!ev.length) { problems.push(x); say(`MISSING ${x.what} ${x.date} ${x.start}: the map prints it; no event in data/events.json (not added automatically: add it by hand with its source)`); continue; }
  const e = ev[0];
  const ok = (!x.end || e.end === x.end) && (!x.venue || e.venue_id === x.venue);
  say(`${ok ? "ok" : "DIFFERS"} ${x.what} ${x.date} ${x.start}${x.end ? `–${x.end}` : ""}: ${e.id} (${e.start}–${e.end || "?"} at ${e.venue_id})`);
  if (!ok) problems.push(x);
}
const shows = D.events.filter((e) => e.program === "blink" && (e.tags || []).includes("drone-show") && e.status !== "cancelled");
for (const e of shows) if (!expect.some((x) => x.what === "drone show" && x.date === e.date && x.start === e.start)) { problems.push(e); say(`NOT ON THE MAP drone show ${e.id} ${e.date} ${e.start}`); }

/* ---------------------------------------------------------------- 4. programs.json: the map itself */
{
  const where = "data/programs.json#blink";
  const maps = [...(blink.maps || []).filter((m) => m.url !== PDF), { label: "BLINK 2026 folding map (PDF)", url: PDF, as_of: MAP.pdf.created.replace(/^D:(\d{4})(\d\d)(\d\d).*/, "$1-$2-$3") }];
  put(blink, "maps", maps, changes, where);
}

/* ---------------------------------------------------------------- validate, write */
const errors = [];
for (const f of files) for (const p of validateFile(f, D[f])) if (p.level === "error") errors.push(`${p.where}: ${p.msg}`);
const seen = new Set();
for (const r of [...D.events, ...D.works]) { if (seen.has(r.id)) errors.push(`duplicate id ${r.id} across events and works`); seen.add(r.id); }
const changed = files.filter((f) => JSON.stringify(D[f]) !== before[f]);
tell(`\n== Summary\nworks: ${counts.matched} matched (${Object.entries(counts.byMethod).map(([k, v]) => `${v} ${k}`).join(", ")}), ${counts.titles} titles changed to the printed title, ${counts.zones} zone corrected, ${counts.added} added (${D.works.filter((w) => w.program === "blink").length} BLINK works now)`);
tell(`facilities: ${counts.facilitiesUpdated} existing places updated, ${counts.facilitiesAdded} added (${D.places.filter((p) => p.kind === "facility").length} facilities)`);
tell(`venues: ${counts.venues} given the map's coordinates; events: ${counts.events} moved to the map's zone; printed times checked: ${expect.length - problems.filter((p) => p.what).length} of ${expect.length} match${problems.length ? `, ${problems.length} problem(s) above` : ""}`);
tell(`files that ${CHECK ? "would change" : "changed"}: ${changed.length ? changed.map((f) => `data/${f}.json`).join(", ") : "none"}`);
if (errors.length) { console.error(`\n✗ ${errors.length} schema error(s); nothing written:\n  ${errors.join("\n  ")}`); process.exit(1); }
if (CHECK) process.exit(changed.length ? 1 : 0);
for (const f of changed) writeFileSync(join(DATA, `${f}.json`), JSON.stringify(D[f], null, 2) + "\n");
if (changed.length) tell(`✓ wrote ${changed.map((f) => `data/${f}.json`).join(", ")}`);
