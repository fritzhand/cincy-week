/* ============================================================
   site/js/lib/agenda.js · OWNER: Agent D (schedule & plan) · PURE (no DOM)
   The schedule and plan logic that has nothing to do with the page:
   festival "today", the default day, the when=now|next|tonight presets,
   overlaps between starred events (printed with their length, or as
   "may overlap" when an end time is not listed), and walking gaps between
   consecutive venues (straight-line estimate, always labeled as one).
   Imported by features/schedule.js, features/plan.js and tests/agenda.test.mjs.

   An "item" is one festival-day instance: { id, t (title), day, s, e, f (flags), v (venue id) }
   with the flags of assets/data/events.json: 1 endUnknown · 2 timeUnknown · 4 allDay · 8 ongoing · 16 lateNight.
   ============================================================ */
import { nyParts, addDays, MIN, HOUR } from "./time.js";
import { haversine, walkMinutes } from "./geo.js";

export const F = { END_UNKNOWN: 1, TIME_UNKNOWN: 2, ALL_DAY: 4, ONGOING: 8, LATE: 16 };
/** A timed session: it has a listed start and is not a multi-day or all-day item. */
export const isTimed = (f) => !(f & (F.TIME_UNKNOWN | F.ALL_DAY | F.ONGOING));
/** Listed hours: a start time is known (ongoing items with daily hours count; all-day and hours-not-listed don't). */
export const hasHours = (f) => !(f & (F.TIME_UNKNOWN | F.ALL_DAY));

/** 45 → "45 min", 60 → "1 h", 75 → "1 h 15 min" (the relative-time voice of DESIGN.md §14) */
export function dur(minutes) {
  const m = Math.max(1, Math.round(minutes));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`;
}

/** The festival day at an instant: 00:00–04:59 still belongs to the previous day (the after-party rule). */
export function festivalToday(now) {
  const p = nyParts(now);
  return p.minutes < 5 * 60 ? addDays(p.date, -1) : p.date;
}

/** Default day of The Week: today during the week (when it is a day with events), else the first week day. */
export function defaultDay(now, days, weekStart) {
  const t = festivalToday(now);
  return days.includes(t) ? t : weekStart || days[0];
}

/** Does an item match a when= preset? now = on right now (listed hours only); next = starts within 2 h;
 *  tonight = today's items that start at 5:00 PM or later (after-midnight starts count as tonight). */
export function inWhen(it, when, now) {
  if (!when) return true;
  if (!hasHours(it.f)) return false;
  if (when === "now") return it.s <= now && now < it.e && !(it.f & F.END_UNKNOWN);
  if (when === "next") return it.s >= now && it.s < now + 2 * HOUR;
  if (when === "tonight") {
    if (it.day !== festivalToday(now) || it.e <= now) return false;
    return !!(it.f & F.LATE) || nyParts(it.s).minutes >= 17 * 60;
  }
  return true;
}

/** Overlaps between items (timed sessions only; exhibitions and nightly runs never "conflict").
 *  → Map id → [{ other (item), kind, minutes? }] where kind is
 *    "overlap" both end times listed, minutes = the overlap
 *    "same"    both start at the same minute (and an end time is not listed)
 *    "during"  the later one starts before the earlier one's listed end (the later end is not listed)
 *    "maybe"   the earlier end is not listed and the later one starts within `window` of its start */
export function conflicts(items, { window = HOUR } = {}) {
  const xs = items.filter((x) => isTimed(x.f)).sort((a, b) => a.s - b.s || a.e - b.e || (a.id < b.id ? -1 : 1));
  const out = new Map();
  const add = (x, c) => { if (!out.has(x.id)) out.set(x.id, []); out.get(x.id).push(c); };
  for (let i = 0; i < xs.length; i++) {
    const a = xs[i];
    for (let j = i + 1; j < xs.length; j++) {
      const b = xs[j];
      if (b.id === a.id) continue;
      if (b.s >= Math.max(a.e, a.s + window)) break; // sorted by start: nothing later can touch a
      const aEnd = !(a.f & F.END_UNKNOWN), bEnd = !(b.f & F.END_UNKNOWN);
      let c = null;
      if (aEnd && bEnd) { const m = (Math.min(a.e, b.e) - b.s) / MIN; if (m > 0) c = { kind: "overlap", minutes: m }; }
      else if (b.s === a.s) c = { kind: "same" };
      else if (aEnd && b.s < a.e) c = { kind: "during" };
      else if (!aEnd && b.s - a.s < window) c = { kind: "maybe" };
      if (c) { add(a, { ...c, other: b }); add(b, { ...c, other: a }); }
    }
  }
  return out;
}

/** "Overlaps “Ready. Set. BLINK!” in your plan by 1 h" (DESIGN.md §9.4) */
export function conflictText(c, { inPlan = true } = {}) {
  const t = `“${c.other.t}”${inPlan ? " in your plan" : ""}`;
  if (c.kind === "overlap") return `Overlaps ${t} by ${dur(c.minutes)}`;
  if (c.kind === "same") return `Starts at the same time as ${t}`;
  if (c.kind === "during") return `Overlaps ${t} (an end time is not listed)`;
  return `May overlap ${t}: an end time is not listed`;
}

/** Walking gap between two consecutive items at venues (lookup: id → { n: name, ll: [lat, lng] | null }).
 *  → { kind: "same" | "walk" | "unknown", from, to, minutes?, meters?, long?, free? (minutes between, when both are listed), missing? } */
export function walkGap(a, b, venues, { longAt = 25 } = {}) {
  const va = a.v ? venues[a.v] : null, vb = b.v ? venues[b.v] : null;
  const from = va ? va.n : null, to = vb ? vb.n : null;
  const free = !(a.f & F.END_UNKNOWN) && isTimed(a.f) && isTimed(b.f) ? Math.round((b.s - a.e) / MIN) : null;
  if (a.v && a.v === b.v) return { kind: "same", from, to, free };
  // a venue without coordinates is named; an item with no venue record is named by its title
  const miss = (v, x) => (v && v.ll ? null : v ? v.n : `the place of “${x.t}”`);
  if (!va || !vb || !va.ll || !vb.ll) return { kind: "unknown", from, to, free, missing: [miss(va, a), miss(vb, b)].filter(Boolean) };
  const pa = { lat: va.ll[0], lng: va.ll[1] }, pb = { lat: vb.ll[0], lng: vb.ll[1] };
  const minutes = walkMinutes(pa, pb);
  return { kind: "walk", from, to, minutes, meters: Math.round(haversine(pa, pb)), long: minutes > longAt, free };
}

/** "About 12 min walk (estimate) from Union Hall to Findlay Market" and friends. */
export function gapText(g) {
  if (g.kind === "same") return `Same place: ${g.from}`;
  if (g.kind === "unknown") return `Walking time not estimated: ${g.missing.join(" and ")} ${g.missing.length > 1 ? "are" : "is"} not on the map`;
  let s = `About ${dur(g.minutes)} walk (estimate) from ${g.from} to ${g.to}`;
  if (g.long) s += " · consider the Connector streetcar or a ride";
  return s;
}
