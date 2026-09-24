/* ============================================================
   build/nav.mjs · OWNER: Agent A (core engine)
   The single source of navigation (engine spec §4.5). Every top-level
   page is listed here exactly once; page modules produce them. The build
   fails if a nav page has no producer, if two modules produce the same
   page, or if a module produces a page that is neither here nor a detail
   page (people/<id>.html, venues/<id>.html).

   Sidebar: 5 numbered sections (DESIGN.md §4.5: numbers mean sections,
   letters mean programs). The Programs section is filled from
   data/programs.json through PROGRAM_PAGES (slug = programs[].slug).
   ============================================================ */
import { KIND_GROUP, EVENT_KINDS, PERSON_ROLES, MEDIUMS } from "./core/schema.mjs";
import { BUCKETS } from "./core/time.mjs";

/** Program pages, in sidebar order. `programs` = which program ids the page covers. */
export const PROGRAM_PAGES = [
  { slug: "art-week", programs: ["caw"], label: "Cincinnati Art Week" },
  { slug: "startupcincy-week", programs: ["scw"], label: "StartupCincy Week" },
  {
    slug: "blink", programs: ["blink"], label: "BLINK",
    sub: [
      { label: "Program guide", href: "blink.html" },
      { label: "Art & installations", href: "art.html?p=blink", count: "works:blink" },
      { label: "Live entertainment", href: "schedule.html?p=blink&k=performance" },
    ],
  },
  { slug: "fotofocus", programs: ["fotofocus", "also"], label: "FotoFocus & more" },
];

/** Sidebar groups. `slug` is the page file name without .html; `meta` asks the shell for a count. */
export const NAV = [
  { num: 1, label: "Plan", items: [
    { slug: "index", label: "Overview", icon: "home" },
    { slug: "schedule", label: "The Week", icon: "calendar", meta: "events" },
    { slug: "map", label: "Map", icon: "map" },
    { slug: "plan", label: "My Plan", icon: "star", meta: "plan" },
  ] },
  { num: 2, label: "Programs", programs: true },
  { num: 3, label: "Directory", items: [
    { slug: "people", label: "People", icon: "users", meta: "people" },
    { slug: "art", label: "Art & installations", icon: "light", meta: "works" },
    { slug: "venues", label: "Venues", icon: "pin", meta: "venues" },
    { slug: "partners", label: "Sponsors & partners", icon: "plates" },
  ] },
  { num: 4, label: "Visit", items: [
    { slug: "stay", label: "Where to stay", icon: "bed" },
    { slug: "getting-around", label: "Getting around", icon: "tram" },
    { slug: "neighborhoods", label: "Neighborhoods", icon: "hood" },
    { slug: "eat-drink", label: "Eat & drink", icon: "utensils" },
    { slug: "faq", label: "FAQ", icon: "help" },
  ] },
  { num: 5, label: "Reference", items: [
    { slug: "news", label: "News", icon: "news" },
    { slug: "about", label: "About & sources", icon: "info" },
  ] },
];

/** Every nav page slug, in order (program pages included). */
export const NAV_SLUGS = NAV.flatMap((g) => (g.programs ? PROGRAM_PAGES.map((p) => p.slug) : g.items.map((i) => i.slug)));

/** Detail-page folders: <folder>/<id>.html. Their nav parent gets aria-current. */
export const DETAIL_FOLDERS = { people: "people", venues: "venues" };

/** The phone dock (engine spec §4.7): Week · Map · Plan · Search. */
export const DOCK = [
  { slug: "schedule", label: "Week", icon: "calendar" },
  { slug: "map", label: "Map", icon: "map" },
  { slug: "plan", label: "Plan", icon: "star", plan: true },
  { search: true, label: "Search", icon: "search" },
];

/** Query parameters each page accepts (engine spec §4.6). The crawler fails on a link to a page with a
 *  query string it does not list, or with an unknown key, so deep links stay honest. Values are checked
 *  too (paramValues below): a deep link must name a real program, day, venue, kind, … */
export const PARAMS = {
  schedule: ["day", "p", "k", "t", "h", "v", "free", "q", "past", "star", "view", "when", "e"],
  people: ["q", "r", "p", "l"],
  art: ["q", "p", "m", "c", "z", "h", "view", "w"],
  venues: ["q", "p", "h", "day", "view"],
  map: ["layers", "p", "day", "focus"],
  partners: ["p", "tier"],
  faq: ["p", "q"],
  news: ["p"],
  "eat-drink": ["h"],
};

/** Allowed VALUES per page and key, built from the data (the crawler checks every internal link's query
 *  string with these; the client re-validates at runtime, AIM parseVenueZone style). List params take
 *  comma-separated values. `k` takes kind groups (talks, hands-on, social, art, pitch, other) or single
 *  event kinds (performance, keynote, …): a kind narrows within its group (sidebar: BLINK › Live
 *  entertainment = schedule.html?p=blink&k=performance). Keys without a validator accept any value. */
export function paramValues(db) {
  const inSet = (arr) => { const s = new Set(arr); return (v) => s.has(v); };
  const list = (ok) => (v) => v.split(",").every((x) => x !== "" && ok(x));
  const any = () => true;
  const progs = list(inSet(db.programs.map((p) => p.id)));
  const hoods = list(inSet(db.places.filter((p) => p.kind === "neighborhood").map((p) => p.id)));
  const days = (v) => v === "all" || db.days.some((d) => d.date === v);
  const one = (...vals) => inSet(vals);
  const focus = (v) => { const [k, id] = v.split(":"); return (k === "venue" && db.byId.venue.has(id)) || (k === "work" && db.byId.work.has(id)) || (k === "stay" && db.byId.stay.has(id)) || (k === "facility" && db.byId.place.get(id)?.kind === "facility"); };
  return {
    schedule: {
      day: days, p: progs, k: list(inSet([...new Set(Object.values(KIND_GROUP)), ...EVENT_KINDS])), t: list(inSet(Object.keys(BUCKETS))),
      h: hoods, v: inSet(db.venues.map((v) => v.id)), free: one("1"), q: any, past: one("0", "1"), star: one("1"),
      view: one("list", "map"), when: one("now", "next", "tonight"), e: inSet(db.events.map((e) => e.id)),
    },
    people: { q: any, r: list(inSet(PERSON_ROLES)), p: progs, l: (v) => /^[A-Z#]$/.test(v) },
    art: { q: any, p: progs, m: list(inSet(MEDIUMS)), c: any, z: any, h: hoods, view: one("grid", "map"), w: inSet(db.works.map((w) => w.id)) },
    venues: { q: any, p: progs, h: hoods, day: days, view: one("list", "map") },
    map: { layers: list(inSet(["venues", "art", "facilities", "stays", "transit", "food"])), p: progs, day: days, focus },
    partners: { p: progs, tier: any },
    faq: { p: progs, q: any },
    news: { p: progs },
    "eat-drink": { h: hoods },
  };
}
