/* ============================================================
   build/core/schema.mjs · OWNER: Agent A (core engine)
   Per-file field specs for data/*.json (engine spec §4.3) and a tiny
   validator. Every problem is reported as
       data/<file>.json#<record id>.<field>: <message>
   so a scraper typo points straight at the record.

   Spec vocabulary (one object per field):
     t:   "id" | "text" (plain text) | "str" (short code/string) | "url" (https) |
          "date" (YYYY-MM-DD) | "time" (HH:MM) | "bool" | "num" | "int" |
          "enum" | "list" | "obj" | "map"
     req: the value must be present and non-null
     values: allowed values (enum)       of: item spec (list, map values)
     fields: nested spec (obj)           long: long prose (length warning at 5,000)
   Unknown keys fail, listing the allowed ones. `notes` is allowed on every
   record and never rendered. To add a field: add it here AND to CLAUDE.md.
   ============================================================ */
import { HTML_IN_TEXT, PLACEHOLDER, PLACEHOLDER_WORD } from "./util.mjs";
import { ISO_DATE, HHMM } from "../../site/js/lib/time.js";
import { PROGRAM_IDS } from "./icons.mjs";

export { PROGRAM_IDS };
export const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

export const EVENT_KINDS = ["keynote", "panel", "workshop", "fireside", "networking", "party", "pitch", "exhibition", "installation", "performance", "talk", "tour", "market", "screening", "other"];
/** Filter groups in the UI (engine spec §4.3): kind → group id */
export const KIND_GROUP = {
  keynote: "talks", panel: "talks", fireside: "talks", talk: "talks", screening: "talks",
  workshop: "hands-on", tour: "hands-on",
  networking: "social", party: "social", market: "social",
  exhibition: "art", installation: "art", performance: "art",
  pitch: "pitch", other: "other",
};
export const KIND_GROUP_LABEL = { talks: "Talks", "hands-on": "Hands-on", social: "Social", art: "Art", pitch: "Pitch", other: "Other" };
export const KIND_LABEL = {
  keynote: "Keynote", panel: "Panel", workshop: "Workshop", fireside: "Fireside chat", networking: "Networking", party: "Party",
  pitch: "Pitch", exhibition: "Exhibition", installation: "Installation", performance: "Performance", talk: "Talk", tour: "Tour",
  market: "Market", screening: "Screening", other: "Event",
};
export const EVENT_STATUS = ["scheduled", "cancelled", "changed"];
export const PERSON_ROLES = ["speaker", "artist", "curator", "performer", "moderator", "organizer", "judge", "host", "founder", "panelist", "facilitator", "mentor"];
export const ROLE_LABEL = { speaker: "Speaker", artist: "Artist", curator: "Curator", performer: "Performer", moderator: "Moderator", organizer: "Organizer", judge: "Judge", host: "Host", founder: "Founder", panelist: "Panelist", facilitator: "Facilitator", mentor: "Mentor" };
export const MEDIUMS = ["projection mapping", "mural", "sculpture", "interactive", "light installation", "drone show", "performance", "photography", "painting", "mixed media", "other"];
export const VENUE_KINDS = ["venue", "zone", "gallery", "studio", "museum", "hotel", "park", "street", "bar", "restaurant", "outdoor", "other"];
export const RELATIONSHIPS = ["presenting sponsor", "sponsor", "partner", "organizer", "founding partner", "media partner", "venue", "community partner", "funder"];
export const PLACE_KINDS = ["neighborhood", "transit", "parking", "airport", "food", "drink", "landmark", "accessibility", "tip", "bike", "rideshare"];
export const STAY_KINDS = ["hotel", "inn", "hostel", "rental", "other"];

/** Coordinates outside REGION fail (swapped or mistyped); outside MAP_REGION warn ("not on the map").
 *  REGION is generous on purpose: FotoFocus venues reach Dayton and Columbus. */
export const REGION = { s: 38.4, n: 40.4, w: -85.2, e: -82.4 };
export const MAP_REGION = { s: 38.9, n: 39.4, w: -84.9, e: -84.2 };

const text = (o = {}) => ({ t: "text", ...o });
const url = (o = {}) => ({ t: "url", ...o });
const id = (o = {}) => ({ t: "id", ...o });
const list = (of, o = {}) => ({ t: "list", of, ...o });
const obj = (fields, o = {}) => ({ t: "obj", fields, ...o });
const en = (values, o = {}) => ({ t: "enum", values, ...o });
const R = { req: true };

export const SPECS = {
  programs: {
    id: en(PROGRAM_IDS, R), slug: id(), name: text(R), short_name: text(), tagline: text(), edition: text(),
    dates: obj({ start: { t: "date", req: true }, end: { t: "date", req: true } }, R),
    description: text({ long: true }),
    organizers: list(obj({ name: text(R), url: url(), org_id: id(), role: text() })),
    url: url(), hub_venue_id: id(),
    tickets: list(obj({ name: text(R), price: text(), url: url(), notes: text() })),
    daily_themes: list(obj({ date: { t: "date", req: true }, theme: text(R), highlights: list(text()) })),
    hours: text(), hashtags: list(text()),
    social: obj({ instagram: url(), x: url(), facebook: url(), linkedin: url(), tiktok: url(), youtube: url() }),
    contact: obj({ email: { t: "str" }, phone: { t: "str" } }),
    history: list(obj({ year: { t: "int", req: true }, fact: text(R), source_url: url(R) })),
    stats: list(obj({ label: text(R), value: text(R), source_url: url(R) })),
    logo: obj({ url: url(), format: en(["svg", "png", "jpg", "webp"]), on: en(["light", "dark"]) }),
    brand: obj({ colors: list({ t: "str" }), fonts: list(text()) }),
    source_url: url(R),
  },
  events: {
    id: id(R), program: en(PROGRAM_IDS, R), title: text(R), kind: en(EVENT_KINDS, R),
    date: { t: "date", req: true }, end_date: { t: "date" }, start: { t: "time" }, end: { t: "time" },
    time_text: text(), all_day: { t: "bool" }, hours_text: text(),
    occurrences: list(obj({ date: { t: "date", req: true }, start: { t: "time" }, end: { t: "time" } })),
    venue_id: id(), room: text(), location_text: text(),
    description: text({ long: true }), tracks: list(text()), tags: list({ t: "str" }),
    people: list(id()), people_roles: { t: "map", of: text() }, work_ids: list(id()), org_ids: list(id()),
    credits: list(obj({ role: text(R), names: list(text()) })),   // C: other credited names without a person record (FotoFocus artists)
    cost: text(), is_free: { t: "bool" }, registration_url: url(),
    status: en(EVENT_STATUS), featured: { t: "bool" }, image_url: url(), source_url: url(R),
  },
  people: {
    id: id(R), name: text(R), sort_name: text(), roles: list(en(PERSON_ROLES)), programs: list(en(PROGRAM_IDS)),
    title: text(), org: text(), org_id: id(), bio: text({ long: true }), headshot_url: url(), location: text(), pronouns: text(),
    links: obj({ website: url(), instagram: url(), linkedin: url(), x: url(), facebook: url(), tiktok: url(), youtube: url(), threads: url(), bluesky: url() }),
    also_sources: list(url()), source_url: url(R),
  },
  works: {
    id: id(R), program: en(PROGRAM_IDS, R), title: text(R), artists: list(id()), artist_text: text(),
    medium: en(MEDIUMS, R), category: text(), zone: text(), venue_id: id(), location_text: text(),
    lat: { t: "num" }, lng: { t: "num" }, hours_text: text(), description: text({ long: true }), image_url: url(),
    sponsor: text(), sponsor_org_id: id(), year: { t: "int" }, source_url: url(R),
  },
  venues: {
    id: id(R), name: text(R), aliases: list(text()), address: text(), city: text(), state: { t: "str" }, zip: { t: "str" },
    neighborhood: text(), hood: id(), lat: { t: "num" }, lng: { t: "num" }, programs: list(en(PROGRAM_IDS)),
    kind: en(VENUE_KINDS, R), url: url(), accessibility: text({ long: true }), source_url: url(R),
  },
  orgs: {
    id: id(R), name: text(R),
    roles: list(obj({ program: en(PROGRAM_IDS, R), relationship: en(RELATIONSHIPS, R), tier: text(), tier_rank: { t: "int" } }), R),
    logo_url: url(), url: url(), source_url: url(R),
  },
  stays: {
    id: id(R), name: text(R), kind: en(STAY_KINDS), address: text(), hood: id(), lat: { t: "num" }, lng: { t: "num" }, url: url(),
    room_block: obj({ program: en(PROGRAM_IDS, R), group_code: text(), rate: text(), dates: text(), deadline: text(), booking_url: url(), status: text() }),
    booking_portal: obj({ program: en(PROGRAM_IDS, R), url: url(R), label: text() }),   // C: listed on a program's hotel portal (not a room block)
    source_url: url(R),
  },
  places: {
    id: id(R), kind: en(PLACE_KINDS, R), name: text(R), short_name: text(), summary: text({ long: true }), details: text({ long: true }),
    address: text(), hood: id(), lat: { t: "num" }, lng: { t: "num" }, url: url(), source_url: url(R),
  },
  faqs: { id: id(R), program: en(PROGRAM_IDS), topic: text(), q: text(R), a: text({ req: true, long: true }), source_url: url(R) },
  news: {
    id: id(R), title: text(R), source: text(R), sourceTier: { t: "any" }, date: { t: "date", req: true }, url: url(R),
    programs: list(en(PROGRAM_IDS)), summary: text({ long: true }), tags: list({ t: "str" }), gnId: { t: "str" },
    image_url: url(), author: text(), kind: { t: "str" }, date_source: { t: "str" },
  },
  facts: { id: id(R), program: en(PROGRAM_IDS), label: text(R), value: text(R), as_of: { t: "date" }, source_url: url(R), source: text(), quote: text({ long: true }) },
};
/** Files that must exist and be non-empty arrays; the rest may be [] (engine spec §4.12). */
export const REQUIRED_NONEMPTY = ["programs", "events", "people", "venues"];
export const ARRAY_FILES = Object.keys(SPECS);

function typeOk(spec, v) {
  switch (spec.t) {
    case "id": return typeof v === "string" && ID_RE.test(v);
    case "text": case "str": return typeof v === "string";
    case "url": return typeof v === "string";
    case "date": return typeof v === "string" && ISO_DATE.test(v);
    case "time": return typeof v === "string" && HHMM.test(v);
    case "bool": return typeof v === "boolean";
    case "num": return typeof v === "number" && Number.isFinite(v);
    case "int": return Number.isInteger(v);
    case "enum": return spec.values.includes(v);
    case "list": return Array.isArray(v);
    case "obj": case "map": return v && typeof v === "object" && !Array.isArray(v);
    default: return true;
  }
}
const expected = (spec) => ({
  id: "an id (lowercase letters, digits and hyphens)", text: "plain text", str: "a string", url: "an https:// URL",
  date: "a YYYY-MM-DD date", time: "an HH:MM time (24-hour)", bool: "true, false or null", num: "a number", int: "an integer",
  enum: `one of: ${spec.values?.join(", ")}`, list: "an array", obj: "an object", map: "an object",
}[spec.t] || spec.t);

/** Validate one value against a spec; push problems into `out` as [path, message, level]. */
function check(spec, v, path, out) {
  if (v === undefined || v === null) {
    if (spec.req) out.push([path, "is required (use a real value; unknown optional fields are null)", "error"]);
    return;
  }
  if (!typeOk(spec, v)) { out.push([path, `must be ${expected(spec)}, got ${JSON.stringify(v).slice(0, 60)}`, "error"]); return; }
  if (spec.t === "text" || spec.t === "str") {
    if (v !== v.trim()) out.push([path, "has leading or trailing whitespace", "error"]);
    if (!v.trim() && spec.req) out.push([path, "is empty", "error"]);
    if (v.trim() && PLACEHOLDER.test(v.trim())) out.push([path, `is a placeholder ("${v.trim()}"): use null for unknowns`, "error"]);
    else if (PLACEHOLDER_WORD.test(v)) {
      // "Speaker TBA" in a name, title, room or time is a guess dressed as data: fail. Long prose is quoted
      // verbatim from the source, so there it is a warning (print the unknown as an unknown instead).
      const w = v.match(PLACEHOLDER_WORD)[0];
      out.push([path, `contains the placeholder "${w}": use null (or leave it out) for unknowns`, spec.long && !/^lorem/i.test(w) ? "warn" : "error"]);
    }
    if (spec.t === "text" && HTML_IN_TEXT.test(v)) out.push([path, `is plain text: no HTML tags or entities (found "${v.match(HTML_IN_TEXT)[0]}")`, "error"]);
    if (spec.long && v.length > 5000) out.push([path, `is ${v.length} characters (over 5,000)`, "warn"]);
  }
  if (spec.t === "url") {
    if (/^http:/i.test(v)) { out.push([path, `insecure link: use https:// (${v})`, "error"]); return; }
    let u = null; try { u = new URL(v); } catch { /* below */ }
    if (!u || u.protocol !== "https:") out.push([path, `must be an https:// URL, got ${JSON.stringify(v).slice(0, 80)}`, "error"]);
  }
  if (spec.t === "list") v.forEach((x, i) => check(spec.of, x, `${path}[${i}]`, out));
  if (spec.t === "map") for (const [k, x] of Object.entries(v)) check(spec.of, x, `${path}.${k}`, out);
  if (spec.t === "obj") checkFields(spec.fields, v, path, out);
}
function checkFields(fields, rec, path, out) {
  for (const k of Object.keys(rec)) {
    if (k === "notes") continue;
    if (!fields[k]) out.push([`${path}${path ? "." : ""}${k}`, `unknown key "${k}" (allowed: ${Object.keys(fields).join(", ")}, notes)`, "error"]);
  }
  for (const [k, spec] of Object.entries(fields)) check(spec, rec[k], `${path}${path ? "." : ""}${k}`, out);
}

/** After validation, blank out values of the wrong type (in memory only) so the loader can keep going and
 *  report every other problem instead of crashing on the first bad shape: wrong-typed lists become [],
 *  wrong-typed objects and scalars become null, and list items of the wrong type are dropped. The errors
 *  were already recorded by validateFile, so the build still fails. */
export function coerce(file, records) {
  const spec = SPECS[file];
  if (!spec || !Array.isArray(records)) return;
  for (const rec of records) {
    if (!rec || typeof rec !== "object" || Array.isArray(rec)) continue;
    for (const [k, f] of Object.entries(spec)) {
      const v = rec[k];
      if (v === undefined || v === null) continue;
      if (!typeOk(f, v)) rec[k] = f.t === "list" ? [] : null;
      else if (f.t === "list") rec[k] = v.filter((x) => x !== null && x !== undefined && typeOk(f.of, x));
    }
  }
}

/** Validate a whole file. Returns [{ where, msg, level }]. */
export function validateFile(file, records) {
  const spec = SPECS[file];
  const out = [];
  if (!Array.isArray(records)) return [{ where: `data/${file}.json`, msg: "must be a JSON array", level: "error" }];
  records.forEach((rec, i) => {
    const rid = rec && typeof rec.id === "string" && rec.id ? rec.id : `[${i}]`;
    if (!rec || typeof rec !== "object" || Array.isArray(rec)) { out.push([`#${rid}`, "must be an object", "error"]); return; }
    const probs = [];
    checkFields(spec, rec, "", probs);
    for (const [p, m, l] of probs) out.push([`#${rid}.${p}`, m, l]);
  });
  return out.map(([p, msg, level]) => ({ where: `data/${file}.json${p}`, msg, level }));
}
