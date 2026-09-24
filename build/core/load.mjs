/* ============================================================
   build/core/load.mjs · OWNER: Agent A (core engine)
   data/*.json → a validated, indexed `db` (engine spec §4.3–4.4).
   Nothing here writes files. Problems go to fail()/warn() with
   "data/<file>.json#<id>.<field>: …"; build.mjs stops before writing.

   db = {
     config, programs, events, people, works, venues, orgs, stays, places, faqs, news, facts,
     aliases, images, map,
     byId: { program, event, person, work, venue, org, place, stay, faq, news } (Maps),
     instances: [{ id, ev, date, day, s, e, lateNight, endUnknown, timeUnknown, allDay, ongoing, start, end }] (by s),
     eventsByDay, eventsByPerson, eventsByVenue, eventsByProgram, eventsByHood (Maps of instances or events),
     worksByPerson, worksByVenue, orgsByProgram (tier-ordered [{ org, role }]), venuesByHood, peopleByRole, placesByKind,
     days: [{ date, inWeek, before, after, count }], week: [dates], phaseInstants: { weekStart, weekEnd },
     code(id), codeToId (Map), nearby(lat, lng, meters), counts: { events, people, venues, works, orgs, programs },
   }
   Aliases resolved in place: venue.hood from venue.neighborhood; event/work venue_id from location_text.
   Derived fields added to records (documented in CLAUDE.md):
     event.kg (kind group) · event.instances · event.day (first festival day) · event.venue (record|null)
     event.hood (place id|null) · event.live (not cancelled)
     person.roles / person.programs merged with roles implied by events and works · person.events · person.works
     venue.programs derived and merged · venue.stall (1…n for venues with coordinates, data order) · venue.events
   ============================================================ */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SPECS, ARRAY_FILES, REQUIRED_NONEMPTY, validateFile, coerce, KIND_GROUP, PROGRAM_IDS, REGION, MAP_REGION, ID_RE } from "./schema.mjs";
import { expand, nyToEpoch, addDays, dateRange, ISO_DATE, HHMM } from "./time.mjs";
import { aliasKey, sortBy, groupBy } from "./util.mjs";
import { codeTable, code } from "../../site/js/lib/share.js";
import { haversine } from "../../site/js/lib/geo.js";

export function validateConfig(config, fail) {
  const w = "site.config.json";
  for (const k of ["siteName", "siteBase", "pathPrefix", "repo", "timezone"]) if (typeof config[k] !== "string" || !config[k]) fail(w, `"${k}" is required`);
  if (config.siteBase && !/^https:\/\/.+\/$/.test(config.siteBase)) fail(w, `"siteBase" must be an https:// URL ending in "/"`);
  if (config.pathPrefix && !/^\/([a-z0-9._-]+\/)*$/i.test(config.pathPrefix)) fail(w, `"pathPrefix" must look like "/x/"`);
  if (config.timezone && config.timezone !== "America/New_York") fail(w, `"timezone" must be America/New_York (the time model assumes it)`);
  for (const k of ["week", "dataWindow"]) {
    const v = config[k];
    if (!v || !ISO_DATE.test(v.start || "") || !ISO_DATE.test(v.end || "")) fail(w, `"${k}" needs ISO "start" and "end" dates`);
    else if (v.start > v.end) fail(w, `"${k}.start" is after "${k}.end"`);
  }
  if (config.week && config.dataWindow && (config.week.start < config.dataWindow.start || config.week.end > config.dataWindow.end)) fail(w, `"week" must sit inside "dataWindow"`);
  if (!config.author || typeof config.author.name !== "string") fail(w, `"author.name" is required`);
  if (config.analyticsId && !/^G-[A-Z0-9]+$/.test(config.analyticsId)) fail(w, `"analyticsId" must be a GA4 id like G-XXXX or empty`);
}

function readJSON(file, fail) {
  try { return JSON.parse(readFileSync(file, "utf8")); }
  catch (e) { fail(file.replace(/^.*\/(data\/)/, "$1"), `invalid JSON: ${e.message}`); return null; }
}

export function load({ dataDir, siteDir, config, fail, warn }) {
  const W = (file, rid, field) => `data/${file}.json#${rid}${field ? "." + field : ""}`;
  const db = { config };

  /* ---------- read + schema ---------- */
  for (const f of ARRAY_FILES) {
    const p = join(dataDir, `${f}.json`);
    if (!existsSync(p)) { if (REQUIRED_NONEMPTY.includes(f)) fail(`data/${f}.json`, "is missing"); db[f] = []; continue; }
    const v = readJSON(p, fail);
    db[f] = Array.isArray(v) ? v.filter((r) => r && typeof r === "object" && !Array.isArray(r)) : [];
    if (v !== null) for (const pr of validateFile(f, v)) (pr.level === "error" ? fail : warn)(pr.where, pr.msg);
    coerce(f, db[f]); // wrong-typed values → null / [] so the checks below report everything instead of crashing
    if (REQUIRED_NONEMPTY.includes(f) && Array.isArray(v) && !v.length) fail(`data/${f}.json`, "is empty");
    // ids: unique per file
    const seen = new Set();
    for (const r of db[f]) {
      if (!r || typeof r.id !== "string") continue;
      if (seen.has(r.id)) fail(W(f, r.id), `duplicate id "${r.id}"`);
      seen.add(r.id);
    }
  }
  const optObj = (f) => { const p = join(dataDir, `${f}.json`); if (!existsSync(p)) return {}; const v = readJSON(p, fail); if (v && (typeof v !== "object" || Array.isArray(v))) { fail(`data/${f}.json`, "must be a JSON object"); return {}; } return v || {}; };
  db.aliases = optObj("aliases");
  db.images = optObj("images");
  db.map = optObj("map");
  for (const k of Object.keys(db.aliases)) if (!["venues", "hoods"].includes(k)) fail(`data/aliases.json`, `unknown key "${k}" (allowed: venues, hoods)`);

  /* ---------- indexes ---------- */
  const byId = (arr) => new Map(arr.filter((r) => r && typeof r.id === "string").map((r) => [r.id, r]));
  db.byId = {
    program: byId(db.programs), event: byId(db.events), person: byId(db.people), work: byId(db.works), venue: byId(db.venues),
    org: byId(db.orgs), place: byId(db.places), stay: byId(db.stays), faq: byId(db.faqs), news: byId(db.news),
  };
  const B = db.byId;

  /* ---------- aliases (engine §4.3, AIM normalizeAuditorium): spellings → ids, at build time ----------
     venue.neighborhood (free text) → venue.hood when hood is null; event/work location_text → venue_id when
     venue_id is null and the text names a known venue (its name, one of its aliases[], or aliases.json
     "venues"). Keys are aliasKey()-normalized. Stored values always win; nothing is guessed. */
  const hoodKey = new Map();
  for (const p of db.places) if (p.kind === "neighborhood") for (const n of [p.id, p.name, p.short_name]) if (n) hoodKey.set(aliasKey(n), p.id);
  for (const [k, id] of Object.entries(db.aliases.hoods || {})) hoodKey.set(aliasKey(k), id);
  for (const v of db.venues) {
    if (v.hood != null || !v.neighborhood) continue;
    const id = hoodKey.get(aliasKey(v.neighborhood));
    if (id) v.hood = id;
    else warn(W("venues", v.id, "neighborhood"), `"${v.neighborhood}" is not a known neighborhood: add the spelling to data/aliases.json "hoods" or set hood`, "neighborhoods not resolved to a hood");
  }
  const venueKey = new Map();
  for (const v of db.venues) for (const n of [v.name, ...(v.aliases || [])]) if (n) venueKey.set(aliasKey(n), v.id);
  for (const [k, id] of Object.entries(db.aliases.venues || {})) venueKey.set(aliasKey(k), id);
  for (const r of [...db.events, ...db.works]) {
    if (r.venue_id != null || !r.location_text) continue;
    const id = venueKey.get(aliasKey(r.location_text));
    if (id) r.venue_id = id;
  }

  /* ---------- cross-file ids ---------- */
  for (const w of db.works) if (B.event.has(w.id)) fail(W("works", w.id), `id "${w.id}" is also an event id (events and works share URL space)`);
  const prefix = (r, file) => { if (r.program && r.id && !r.id.startsWith(`${r.program}-`)) fail(W(file, r.id), `id must start with its program ("${r.program}-…")`); };
  db.events.forEach((e) => prefix(e, "events"));
  db.works.forEach((w) => prefix(w, "works"));

  /* ---------- references ---------- */
  const ref = (map, kind, file, rid, field, v) => { if (v != null && !map.has(v)) fail(W(file, rid, field), `unknown ${kind} "${v}"`); };
  const hoodOk = (file, rid, v) => {
    if (v == null) return;
    const p = B.place.get(v);
    if (!p) fail(W(file, rid, "hood"), `unknown neighborhood "${v}" (a data/places.json id with kind "neighborhood")`);
    else if (p.kind !== "neighborhood") fail(W(file, rid, "hood"), `"${v}" is a ${p.kind}, not a neighborhood`);
  };
  for (const p of db.programs) {
    ref(B.venue, "venue", "programs", p.id, "hub_venue_id", p.hub_venue_id);
    (p.organizers || []).forEach((o, i) => ref(B.org, "org", "programs", p.id, `organizers[${i}].org_id`, o?.org_id));
  }
  for (const pid of PROGRAM_IDS) if (!B.program.has(pid)) warn("data/programs.json", `program "${pid}" has no record`);
  for (const e of db.events) {
    ref(B.program, "program", "events", e.id, "program", e.program);
    ref(B.venue, "venue", "events", e.id, "venue_id", e.venue_id);
    if (e.venue_id == null && !e.location_text) fail(W("events", e.id, "venue_id"), "is null: give a venue_id or a location_text");
    (e.people || []).forEach((p) => ref(B.person, "person", "events", e.id, "people", p));
    for (const k of Object.keys(e.people_roles || {})) if (!(e.people || []).includes(k)) fail(W("events", e.id, "people_roles"), `"${k}" is not in people`);
    (e.work_ids || []).forEach((w) => ref(B.work, "work", "events", e.id, "work_ids", w));
    (e.org_ids || []).forEach((o) => ref(B.org, "org", "events", e.id, "org_ids", o));
  }
  for (const w of db.works) {
    (w.artists || []).forEach((a) => ref(B.person, "person", "works", w.id, "artists", a));
    ref(B.venue, "venue", "works", w.id, "venue_id", w.venue_id);
    ref(B.org, "org", "works", w.id, "sponsor_org_id", w.sponsor_org_id);
    if ((w.lat == null) !== (w.lng == null)) fail(W("works", w.id, "lat"), "lat and lng must both be set or both be null");
    if (w.lat == null && !w.venue_id) warn(W("works", w.id), "has neither coordinates nor a venue (not on the map)", "works off the map");
  }
  for (const p of db.people) ref(B.org, "org", "people", p.id, "org_id", p.org_id);
  for (const v of db.venues) hoodOk("venues", v.id, v.hood);
  for (const s of db.stays) { hoodOk("stays", s.id, s.hood); }
  for (const p of db.places) hoodOk("places", p.id, p.hood);
  for (const f of db.faqs) ref(B.program, "program", "faqs", f.id, "program", f.program);
  for (const n of db.news) (n.programs || []).forEach((p) => ref(B.program, "program", "news", n.id, "programs", p));
  for (const f of db.facts) ref(B.program, "program", "facts", f.id, "program", f.program);
  for (const o of db.orgs) (o.roles || []).forEach((r, i) => ref(B.program, "program", "orgs", o.id, `roles[${i}].program`, r?.program));
  for (const [file, key] of [["venues", "venues"], ["hoods", "hoods"]]) {
    const m = db.aliases[key] || {};
    const target = file === "venues" ? B.venue : B.place;
    for (const [k, v] of Object.entries(m)) {
      if (k !== aliasKey(k)) fail(`data/aliases.json#${key}`, `key "${k}" is not normalized (expected "${aliasKey(k)}")`);
      if (!target.has(v)) fail(`data/aliases.json#${key}.${k}`, `unknown ${file === "venues" ? "venue" : "place"} "${v}"`);
    }
  }

  /* ---------- geo ---------- */
  const geo = (file, r) => {
    if (r.lat === undefined && r.lng === undefined) return;
    if ((r.lat == null) !== (r.lng == null)) { fail(W(file, r.id, "lat"), "lat and lng must both be set or both be null"); return; }
    if (r.lat == null) return;
    if (r.lat < REGION.s || r.lat > REGION.n || r.lng < REGION.w || r.lng > REGION.e) fail(W(file, r.id, "lat"), `coordinates ${r.lat}, ${r.lng} are outside the region bbox (${REGION.s}–${REGION.n} N, ${REGION.w}–${REGION.e}): swapped or mistyped?`);
    else if (r.lat < MAP_REGION.s || r.lat > MAP_REGION.n || r.lng < MAP_REGION.w || r.lng > MAP_REGION.e) warn(W(file, r.id), "is outside the map region (listed, but not on the map)", "outside the map region");
  };
  for (const f of ["venues", "works", "stays", "places"]) db[f].forEach((r) => geo(f, r));

  /* ---------- time ---------- */
  const win = config.dataWindow;
  const seenSlot = new Map();
  for (const e of db.events) {
    const where = (f) => W("events", e.id, f);
    if (!e.date || !ISO_DATE.test(e.date)) continue; // schema already failed
    if (e.end_date && e.end_date < e.date) fail(where("end_date"), `is before date (${e.end_date} < ${e.date})`);
    const last = e.end_date || e.date;
    if (last < win.start || e.date > win.end) fail(where("date"), `${e.date}${e.end_date ? `–${e.end_date}` : ""} is outside the data window (${win.start} to ${win.end})`);
    if (e.all_day && (e.start || e.end)) fail(where("all_day"), "an all-day event has no start or end time");
    if (!e.start && e.end) fail(where("end"), "has an end time but no start time");
    if (e.start && e.end && HHMM.test(e.start) && HHMM.test(e.end) && e.end < e.start && e.end > "06:00") fail(where("end"), `${e.end} is before start ${e.start}: an event may end after midnight only by 06:00 (suspicious times)`);
    for (const [i, o] of (e.occurrences || []).entries()) {
      if (!o || !o.date) continue;
      if (o.date < win.start || o.date > win.end) fail(where(`occurrences[${i}].date`), `${o.date} is outside the data window`);
      if (o.start && o.end && o.end < o.start && o.end > "06:00") fail(where(`occurrences[${i}].end`), `${o.end} is before start ${o.start}`);
    }
    if (e.status !== "cancelled" && e.start) {
      const key = [e.program, (e.title || "").toLowerCase(), e.date, e.start].join("|");
      if (seenSlot.has(key)) fail(where(), `duplicate of "${seenSlot.get(key)}" (same program, title, day and start: a duplicate scrape?)`);
      else seenSlot.set(key, e.id);
    }
    const prog = B.program.get(e.program);
    if (prog?.dates?.start && prog?.dates?.end && ISO_DATE.test(prog.dates.start) && ISO_DATE.test(prog.dates.end)) {
      const lo = addDays(prog.dates.start, -1), hi = addDays(prog.dates.end, 1);
      if (last < lo || e.date > hi) warn(where("date"), `falls outside ${prog.id}'s dates (${prog.dates.start} to ${prog.dates.end})`, "events outside their program's dates");
    }
  }
  for (const p of db.programs) {
    if (p.dates && ISO_DATE.test(p.dates.start || "") && ISO_DATE.test(p.dates.end || "") && p.dates.end < p.dates.start) fail(W("programs", p.id, "dates"), "end is before start");
    (p.daily_themes || []).forEach((t, i) => { if (t?.date && p.dates && (t.date < p.dates.start || t.date > p.dates.end)) warn(W("programs", p.id, `daily_themes[${i}]`), `${t.date} is outside the program's dates`); });
  }
  for (const n of db.news) if (n.url && !n.url.startsWith("https://")) { /* schema reports */ }

  /* ---------- derived: events ---------- */
  const hoodOf = (v) => (v ? v.hood || null : null);
  db.instances = [];
  for (const e of db.events) {
    e.kg = KIND_GROUP[e.kind] || "other";
    e.venue = e.venue_id ? B.venue.get(e.venue_id) || null : null;
    e.hood = hoodOf(e.venue);
    e.live = e.status !== "cancelled";
    let inst = [];
    try { inst = e.date && ISO_DATE.test(e.date) ? expand(e, win) : []; } catch (err) { fail(W("events", e.id), `could not expand times: ${err.message}`); }
    e.instances = inst.map((x) => ({ id: e.id, ev: e, ...x }));
    e.day = e.instances[0]?.day || e.date;
    db.instances.push(...e.instances);
  }
  db.instances = sortBy(db.instances, (x) => x.s, (x) => x.e, (x) => x.id);

  /* ---------- derived: people, venues, works ---------- */
  const add = (m, k, v) => { if (!m.has(k)) m.set(k, []); if (!m.get(k).includes(v)) m.get(k).push(v); };
  db.eventsByPerson = new Map(); db.eventsByVenue = new Map(); db.eventsByProgram = new Map(); db.eventsByHood = new Map();
  db.worksByPerson = new Map(); db.worksByVenue = new Map();
  const liveEvents = db.events.filter((e) => e.live);
  const byStart = (a) => sortBy(a, (e) => e.instances[0]?.s ?? 0, (e) => e.id);
  for (const e of liveEvents) {
    for (const p of e.people || []) add(db.eventsByPerson, p, e);
    if (e.venue_id) add(db.eventsByVenue, e.venue_id, e);
    add(db.eventsByProgram, e.program, e);
    if (e.hood) add(db.eventsByHood, e.hood, e);
  }
  for (const m of [db.eventsByPerson, db.eventsByVenue, db.eventsByProgram, db.eventsByHood]) for (const [k, v] of m) m.set(k, byStart(v));
  for (const w of db.works) {
    for (const a of w.artists || []) add(db.worksByPerson, a, w);
    if (w.venue_id) add(db.worksByVenue, w.venue_id, w);
  }
  for (const p of db.people) {
    const evs = db.eventsByPerson.get(p.id) || [];
    const wks = db.worksByPerson.get(p.id) || [];
    p.events = evs; p.works = wks;
    const derivedProgs = new Set([...evs.map((e) => e.program), ...wks.map((w) => w.program)]);
    const derivedRoles = new Set([...evs.map((e) => (e.people_roles || {})[p.id]).filter((r) => r && SPECS.people.roles.of.values.includes(r)), ...(wks.length ? ["artist"] : [])]);
    const stored = new Set(p.programs || []);
    const missing = [...derivedProgs].filter((x) => !stored.has(x));
    if (missing.length && stored.size) warn(W("people", p.id, "programs"), `appears in ${missing.join(", ")} but programs lists ${[...stored].join(", ")}`, "people whose stored programs disagree with their events");
    p.programs = PROGRAM_IDS.filter((x) => stored.has(x) || derivedProgs.has(x));
    p.roles = [...new Set([...(p.roles || []), ...derivedRoles])];
    if (!p.bio && !p.headshot_url && !evs.length && !wks.length) warn(W("people", p.id), "has no bio, headshot, event or work (the page will be thin)", "people with nothing to show");
  }
  let stall = 0;
  // stall numbers pair list rows with map pins, so only venues on the basemap (data/map.json bbox.core) get one;
  // a venue in Dayton has coordinates but no pin (E, 2026-09-24; without a map.json every venue with coordinates counts)
  const mapBox = db.map && db.map.bbox && db.map.bbox.core;
  const onBasemap = (v) => !mapBox || (v.lat >= mapBox.s && v.lat <= mapBox.n && v.lng >= mapBox.w && v.lng <= mapBox.e);
  for (const v of db.venues) {
    const evs = db.eventsByVenue.get(v.id) || [];
    const wks = db.worksByVenue.get(v.id) || [];
    v.events = evs;
    const progs = new Set([...(v.programs || []), ...evs.map((e) => e.program), ...wks.map((w) => w.program)]);
    v.programs = PROGRAM_IDS.filter((x) => progs.has(x));
    v.stall = v.lat != null && v.lng != null && onBasemap(v) ? ++stall : null;
    if (evs.length && v.lat == null) warn(W("venues", v.id), "has events but no coordinates (not on the map)", "venues with events but no coordinates");
  }

  /* ---------- groupings ---------- */
  db.orgsByProgram = new Map();
  for (const o of db.orgs) for (const r of o.roles || []) add(db.orgsByProgram, r.program, { org: o, role: r });
  for (const [k, v] of db.orgsByProgram) db.orgsByProgram.set(k, sortBy(v, (x) => x.role.tier_rank ?? 999, (x) => x.org.name.toLowerCase()));
  db.venuesByHood = groupBy(db.venues, (v) => v.hood || "");
  db.placesByKind = groupBy(db.places, (p) => p.kind);
  db.peopleByRole = new Map();
  for (const p of db.people) for (const r of p.roles) add(db.peopleByRole, r, p);

  /* ---------- days ---------- */
  const week = dateRange(config.week.start, config.week.end);
  db.week = week;
  db.eventsByDay = new Map();
  for (const x of db.instances) if (x.ev.live) add(db.eventsByDay, x.day, x);
  const extra = new Set(db.instances.filter((x) => x.ev.live && !x.ongoing && !week.includes(x.day) && x.day >= win.start && x.day <= win.end).map((x) => x.day));
  db.days = [...new Set([...week, ...extra])].sort().map((date) => ({
    date, inWeek: week.includes(date), before: date < config.week.start, after: date > config.week.end,
    count: (db.eventsByDay.get(date) || []).length,
  }));
  db.phaseInstants = { weekStart: nyToEpoch(config.week.start, "00:00"), weekEnd: nyToEpoch(addDays(config.week.end, 1), "05:00") };

  /* ---------- share codes ---------- */
  const { map, collisions } = codeTable([...db.events.map((e) => e.id), ...db.works.map((w) => w.id)]);
  for (const [c, a, b] of collisions) fail("data/events.json", `share code collision "${c}" between "${a}" and "${b}": rename one id`);
  db.codeToId = map;
  db.code = code;

  /* ---------- images manifest ---------- */
  for (const [k, v] of Object.entries(db.images)) {
    if (!/^[pow]\/[a-z0-9][a-z0-9-]*$/.test(k)) { fail("data/images.json", `bad key "${k}" (expected p/<id>, o/<id> or w/<id>)`); continue; }
    if (!v || typeof v.file !== "string") { fail(`data/images.json#${k}`, "needs a file"); continue; }
    if (!existsSync(join(siteDir, v.file))) fail(`data/images.json#${k}.file`, `site/${v.file} does not exist`);
    if (!Number.isInteger(v.w) || !Number.isInteger(v.h)) fail(`data/images.json#${k}`, "needs integer w and h");
  }
  const noImg = (kind, r, field) => { if (r[field] && !db.images[`${kind}/${r.id}`]) warn(W({ p: "people", o: "orgs", w: "works" }[kind], r.id, field), "has an image URL but no downloaded image yet (monogram / text fallback; run npm run images)", "images not downloaded yet"); };
  db.people.forEach((p) => noImg("p", p, "headshot_url"));
  db.orgs.forEach((o) => noImg("o", o, "logo_url"));
  db.works.forEach((w) => noImg("w", w, "image_url"));

  /* ---------- helpers ---------- */
  db.nearby = (lat, lng, meters = 500) => {
    const out = [];
    const scan = (kind, arr) => { for (const r of arr) if (r.lat != null && r.lng != null) { const d = haversine({ lat, lng }, r); if (d <= meters && d > 0.5) out.push({ kind, rec: r, d }); } };
    scan("venue", db.venues); scan("place", db.places); scan("stay", db.stays);
    return sortBy(out, (x) => x.d);
  };
  db.counts = {
    events: liveEvents.length, people: db.people.length, venues: db.venues.length, works: db.works.length,
    orgs: db.orgs.length, programs: db.programs.length,
  };
  for (const p of db.people) if (!ID_RE.test(p.id || "")) { /* schema reported */ }
  return db;
}
