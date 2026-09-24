/* ============================================================
   site/js/lib/athour.js · OWNER: Agent G (home, programs & info) · PURE (no DOM)
   What the home page's first screen says at a given instant (DESIGN.md §9.2):
   "At this hour" during the week (Now, Next, open now, Tonight), "First up"
   before it, the countdown and the kicker. Everything comes from
   assets/data/events.json and the clock; nothing is guessed:
   - an item whose end time is not listed is "Started", never "Now", and drops
     out of Now an hour after its start (the engine's placeholder end);
   - items whose hours are not listed never appear as "open now": they are counted.
   Imported by site/js/features/home.js and tests/athour.test.mjs.
   ============================================================ */
import { nyParts, daysBetween, fmtRange, fmtTime, fmtDay, MIN, HOUR } from "./time.js";
import { festivalToday as festivalDay } from "./agenda.js";

export const FL = { END_UNKNOWN: 1, TIME_UNKNOWN: 2, ALL_DAY: 4, ONGOING: 8, LATE: 16 };
const FEST = ["caw", "scw", "blink", "fotofocus", "also"];

/** Flatten events.json into items, one per festival-day instance (cancelled events left out). */
export function items(data) {
  const out = [];
  for (const e of data.events || []) {
    if (e.st === "cancelled") continue;
    const ab = (e.tg || []).includes("approximate-time");   // QA: the source gives the time as approximate
    for (const [day, s, en, f] of e.i || []) out.push({ id: e.id, p: e.p, t: e.t, v: e.v, lt: e.lt, fe: !!e.fe, k: e.k, day, s, e: en, f, ...(ab ? { ab } : {}) });
  }
  return out.sort((a, b) => a.s - b.s || rank(a) - rank(b));
}

export { festivalDay };

const hasHours = (it) => !(it.f & (FL.TIME_UNKNOWN | FL.ALL_DAY));
const ongoing = (it) => !!(it.f & FL.ONGOING);
/** featured first, then the festivals in lane order, then the rest */
const rank = (it) => (it.fe ? 0 : 10) + (FEST.indexOf(it.p) < 0 ? 9 : FEST.indexOf(it.p));
const byRank = (a, b) => rank(a) - rank(b) || a.s - b.s;

/** "4:00–9:00 PM", "4:00 PM · end time not listed" (for an item with listed hours) */
export function hoursText(it) {
  const a = nyParts(it.s).hhmm, about = it.ab ? "About " : "";
  if (it.f & FL.END_UNKNOWN) return `${about}${fmtTime(a)} · end time not listed`;
  return about + fmtRange(a, nyParts(it.e).hhmm);
}

/** "in 20 min", "in 1 h 40 min", "Started 40 min ago" */
export function rel(ms) {
  const m = Math.max(1, Math.round(Math.abs(ms) / MIN));
  const span = m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`;
  return ms >= 0 ? `in ${span}` : `Started ${span} ago`;
}

/** The "At this hour" ear. Returns
 *  { today, now: [], nowMore, open: [], openMore, onView (hours not listed today), next: [], nextAt, tonight: [], tonightMore } */
export function atThisHour(all, now, { maxNow = 4, maxOpen = 2, maxNext = 3, maxTonight = 6 } = {}) {
  const today = festivalDay(now);
  const timed = all.filter((it) => hasHours(it) && !ongoing(it));
  // Now: listed hours include now; an unlisted end counts for the hour after the start (as "Started")
  const nowAll = timed.filter((it) => it.s <= now && now < it.e).sort(byRank);
  // Open now: exhibitions, nightly runs and markets with daily hours that include now
  const openAll = all.filter((it) => ongoing(it) && hasHours(it) && !(it.f & FL.END_UNKNOWN) && it.s <= now && now < it.e).sort(byRank);
  const onView = all.filter((it) => it.day === today && ongoing(it) && !hasHours(it)).length;
  // Next: what starts within three hours (else the very next start), festival programs first
  const later = all.filter((it) => hasHours(it) && it.s > now);
  const soon = later.filter((it) => it.s < now + 3 * HOUR);
  // nothing within three hours: the next start (a session before a multi-day run's next opening)
  const pool = later.filter((it) => !ongoing(it)).length ? later.filter((it) => !ongoing(it)) : later;
  const next = (soon.length ? soon : pool.filter((it) => it.s === (pool[0] || {}).s)).slice().sort(byRank).slice(0, maxNext).sort((a, b) => a.s - b.s);
  const shown = new Set([...nowAll.slice(0, maxNow), ...next].map((it) => it.id));
  // Tonight: today's items that start at 5:00 PM or later and haven't started (after-midnight starts count)
  const tonightAll = all.filter((it) => it.day === today && hasHours(it) && it.s > now && !shown.has(it.id)
    && ((it.f & FL.LATE) || nyParts(it.s).minutes >= 17 * 60));
  const tonight = tonightAll.slice().sort(byRank).slice(0, maxTonight).sort((a, b) => a.s - b.s || rank(a) - rank(b));
  return {
    today, now: nowAll.slice(0, maxNow), nowMore: Math.max(0, nowAll.length - maxNow),
    open: openAll.slice(0, maxOpen), openMore: Math.max(0, openAll.length - maxOpen), onView,
    next, nextAt: next.length ? next[0].s : null, tonight, tonightMore: Math.max(0, tonightAll.length - tonight.length),
  };
}

/** Before the week: the next items with listed hours from now on (festival programs; featured first within a day). */
export function firstUp(all, now, { max = 4 } = {}) {
  const up = all.filter((it) => hasHours(it) && !(ongoing(it) && it.e <= now) && it.e > now && it.p !== "also");
  const days = [...new Set(up.map((it) => it.day))];
  const out = [];
  for (const d of days) {
    for (const it of up.filter((x) => x.day === d).sort(byRank)) { if (out.length < max && !out.some((o) => o.id === it.id)) out.push(it); }
    if (out.length >= max) break;
  }
  return out.sort((a, b) => a.s - b.s);
}

/** Days until a date (New York calendar days): 0 today, 1 tomorrow. */
export const daysUntil = (now, date) => daysBetween(nyParts(now).date, date);

/** "9 days until Art Week opens" parts: { n, text } ; null once it has opened. */
export function countdown(now, date, what) {
  const n = daysUntil(now, date);
  if (n < 0) return null;
  if (n === 0) return { n: "Today", text: `${what} opens today` };
  if (n === 1) return { n: "1", text: `day until ${what} opens` };
  return { n: String(n), text: `days until ${what} opens` };
}

/** The lead's kicker for the phase: before "9 days out · Art Week opens Sat, Oct 3", during "Day 6 of 9 · Thursday"
 *  (on the interchange day "Today is interchange day"), after "The week in review". */
export function kicker(phase, now, { weekStart, weekEnd, first, interchange = [] }) {
  if (phase === "before") {
    const n = daysUntil(now, weekStart);
    const lead = n <= 0 ? "Opening day" : n === 1 ? "Tomorrow" : `${n} days out`;
    return first ? `${lead} · ${first.name} opens ${fmtDay(first.date)}` : lead;
  }
  if (phase === "during") {
    const d = festivalDay(now);
    if (interchange.includes(d)) return "Today is interchange day";
    const i = daysBetween(weekStart, d) + 1, total = daysBetween(weekStart, weekEnd) + 1;
    return i >= 1 && i <= total ? `Day ${i} of ${total} · ${fmtDay(d)}` : fmtDay(d);
  }
  return "The week in review";
}
