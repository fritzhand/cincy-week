/* ============================================================
   site/js/lib/week.js · OWNER: Agent G (home, programs & info) · PURE (no DOM)
   The week line's logic (DESIGN.md §4.4): which lane runs on which day and how
   (start | mid | end | only | thru), the interchange day(s), the words a screen
   reader hears for each day, and the one-line phone summary. Everything is
   computed from program dates and the day's events; nothing is typed in.
   Imported by build/pages/home.mjs and tests/week.test.mjs.

   A lane is { id, name, short, start, end, nightly, themes: { date: theme } }.
   ============================================================ */

/** How a lane runs on `date` inside the week [weekStart, weekEnd]:
 *  "start" first day, "end" last day, "only" a one-day program, "mid" in between,
 *  "thru" a program that runs past both ends of the week (the cased FotoFocus line), null = not running. */
export function laneRun(lane, date, weekStart, weekEnd) {
  const { start, end } = lane;
  if (!start || !end || date < start || date > end) return null;
  if (start < weekStart && end > weekEnd) return "thru";
  if (start === end) return "only";
  if (date === start) return "start";
  if (date === end) return "end";
  return "mid";
}

/** Days on which every solid lane (every lane that does not run through the whole week) runs: the interchange. */
export function interchangeDays(lanes, days, weekStart, weekEnd) {
  const solid = lanes.filter((l) => l.start && l.end && !(l.start < weekStart && l.end > weekEnd));
  if (solid.length < 2) return [];
  return days.filter((d) => solid.every((l) => d >= l.start && d <= l.end));
}

/** The qualifier a screen reader hears after a program's name: " (opening day)", " (last night)", "". */
export function runNote(lane, date) {
  if (!lane.start || !lane.end || lane.start === lane.end) return "";
  const unit = lane.nightly ? "night" : "day";
  return date === lane.start ? ` (opening ${unit})` : date === lane.end ? ` (last ${unit})` : "";
}

/** "Cincinnati Art Week, StartupCincy Week (last day), BLINK (opening night), FotoFocus Biennial" */
export function programLine(lanes, date) {
  return lanes.filter((l) => l.start && date >= l.start && date <= l.end).map((l) => `${l.name}${runNote(l, date)}`).join(", ");
}

const WORDS = ["no", "one", "two", "three", "four", "five", "six"];

/** The phone row's one-line summary, as parts [{ t: text, b: bold }]. At most three parts:
 *  the day's news first (the interchange, openings, closings, in bold), then one detail
 *  (a nightly program's "night 2 of 4", a program's theme for the day, the day's featured event),
 *  then the day's event count. `featured` is a title or null; `count` the day's events. */
export function daySummary({ date, lanes, weekStart, weekEnd, interchange = false, featured = null, count = null }) {
  const running = lanes.filter((l) => l.start && date >= l.start && date <= l.end);
  const solid = running.filter((l) => laneRun(l, date, weekStart, weekEnd) !== "thru");
  const news = [];
  if (interchange) news.push(`Interchange: all ${WORDS[solid.length] || solid.length} run`);
  for (const l of solid) if (l.start === date) news.push(`${l.short} opens`);
  for (const l of solid) if (l.end === date && l.start !== date) news.push(l.nightly ? `${l.short}'s last night` : `${l.short}'s last day`);
  const said = (short) => news.some((n) => n.startsWith(short));
  // details, in order: a nightly program's "night 2 of 4"; the theme of a short program (up to four days: its
  // day theme is the day's news); the day's featured event; then the themes of longer programs
  const nights = [], short = [], long = [];
  for (const l of solid) {
    if (l.nightly && l.start !== date && l.end !== date) nights.push(`${l.short} night ${dayDiff(l.start, date) + 1} of ${dayDiff(l.start, l.end) + 1}`);
    const th = l.themes && l.themes[date];
    if (!th || (l.start === date && /open/i.test(th)) || (l.end === date && /clos|final/i.test(th))) continue;
    (dayDiff(l.start, l.end) < 4 ? short : long).push(said(l.short) ? th : `${l.short}: ${th}`);
  }
  const details = [...nights, ...short, ...(featured ? [featured] : []), ...long];
  const parts = news.slice(0, 2).map((t) => ({ t, b: true }));
  if (parts.length < 2 && details.length) parts.push({ t: details[0], b: false });
  if (count !== null && parts.length < 3) parts.push({ t: `${count} ${count === 1 ? "event" : "events"}`, b: false });
  return parts;
}

function dayDiff(a, b) {
  const [y1, m1, d1] = a.split("-").map(Number), [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 864e5);
}
