/* ============================================================
   build/core/client-data.mjs · OWNER: Agent A (core engine)
   The JSON the client runtime fetches lazily (never inlined in pages):
     assets/data/events.json  the event dialog, My Plan, the Live pill, home strips
     assets/data/works.json   the work dialog, My Plan's "Art to see"
   Compact keys keep them within budget (events.json ≤ 120 KB gzipped).
   Shape (v1) — agents D, E, F, G code against this; change it only here:
   events.json = { v, tz, week: {start,end}, phase: {weekStart, weekEnd},
     programs: { id: { n: name, s: short } },
     venues:   { id: { n, a: address|null, h: hood|null, ll: [lat,lng]|null, st: stall|null } },
     people:   { id: { n, t: "Title, Org"|null, i: image path|null } },
     events:   [{ id, x: share code, p, t, k: kind, kg, d: description|null, v: venue_id|null, r: room|null,
                  lt: location_text|null, pp: [person ids], pr: { id: role }, c: cost|null, f: is_free (1|0|null),
                  u: registration_url|null, src, st: status, fe: featured (1|0),
                  tg: [tags], tr: [tracks], tt: time_text|null, ht: hours_text|null, wk: [work ids],
                  i: [[day, s, e, flags]] }] }   flags: 1 endUnknown · 2 timeUnknown · 4 allDay · 8 ongoing · 16 lateNight
                  (i lists every festival-day instance inside dataWindow, sorted by s; day = festival day)
   works.json = { v, works: [{ id, x, p, t, a: [person ids], at: artist_text|null, m: medium, c: category|null,
                  z: zone|null, v: venue_id|null, lt: location_text|null, ll: [lat,lng]|null, ht: hours_text|null,
                  sp: sponsor|null, d: description|null, i: image path|null, src }],
                  people: { id: { n } } }
   Additive changes only (new keys); never rename a key other agents read.
   ============================================================ */
import { PROGRAM_LABELS } from "./components.mjs";

const nz = (v) => (v === undefined || v === "" ? null : v);

export function clientData(db, images) {
  const programs = Object.fromEntries(db.programs.map((p) => [p.id, { n: PROGRAM_LABELS[p.id]?.name || p.name, s: PROGRAM_LABELS[p.id]?.short || p.short_name || p.name }]));
  const venues = Object.fromEntries(db.venues.map((v) => [v.id, { n: v.name, a: nz(v.address), h: nz(v.hood), ll: v.lat != null ? [v.lat, v.lng] : null, st: v.stall }]));
  const people = Object.fromEntries(db.people.map((p) => [p.id, { n: p.name, t: nz([p.title, p.org].filter(Boolean).join(", ")), i: images.path("p", p.id) }]));
  const flags = (x) => (x.endUnknown ? 1 : 0) | (x.timeUnknown ? 2 : 0) | (x.allDay ? 4 : 0) | (x.ongoing ? 8 : 0) | (x.lateNight ? 16 : 0);
  const events = db.events.map((e) => ({
    id: e.id, x: db.code(e.id), p: e.program, t: e.title, k: e.kind, kg: e.kg, d: nz(e.description), v: nz(e.venue_id), r: nz(e.room),
    lt: nz(e.location_text), pp: e.people || [], pr: e.people_roles || {}, c: nz(e.cost), f: e.is_free === true ? 1 : e.is_free === false ? 0 : null,
    u: nz(e.registration_url), src: e.source_url, st: e.status || "scheduled", fe: e.featured ? 1 : 0,
    tg: e.tags || [], tr: e.tracks || [], tt: nz(e.time_text), ht: nz(e.hours_text), wk: e.work_ids || [],
    i: e.instances.map((x) => [x.day, x.s, x.e, flags(x)]),
  }));
  const works = db.works.map((w) => ({
    id: w.id, x: db.code(w.id), p: w.program, t: w.title, a: w.artists || [], at: nz(w.artist_text), m: w.medium, c: nz(w.category), z: nz(w.zone),
    v: nz(w.venue_id), lt: nz(w.location_text), ll: w.lat != null ? [w.lat, w.lng] : null, ht: nz(w.hours_text), sp: nz(w.sponsor),
    d: nz(w.description), i: images.path("w", w.id), src: w.source_url,
  }));
  const wp = new Set(db.works.flatMap((w) => w.artists || []));
  return {
    "assets/data/events.json": { v: 1, tz: db.config.timezone, week: db.config.week, phase: db.phaseInstants, programs, venues, people, events },
    "assets/data/works.json": { v: 1, works, people: Object.fromEntries([...wp].map((id) => [id, { n: db.byId.person.get(id)?.name || id }])) },
  };
}
