/* tests/week.test.mjs · OWNER: Agent G · the week line's pure logic (site/js/lib/week.js) */
import { test } from "node:test";
import assert from "node:assert/strict";
import { laneRun, interchangeDays, runNote, programLine, daySummary } from "../site/js/lib/week.js";

const W0 = "2026-10-03", W1 = "2026-10-11";
const WEEK = ["2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"];
const LANES = [
  { id: "caw", name: "Cincinnati Art Week", short: "Art Week", start: "2026-10-03", end: "2026-10-10", nightly: false, themes: { "2026-10-03": "OPENING DAY", "2026-10-04": "MAKE IT", "2026-10-10": "CLOSING DAY" } },
  { id: "scw", name: "StartupCincy Week", short: "StartupCincy", start: "2026-10-05", end: "2026-10-08", nightly: false, themes: { "2026-10-05": "Kick-off", "2026-10-06": "Capital", "2026-10-08": "Students" } },
  { id: "blink", name: "BLINK", short: "BLINK", start: "2026-10-08", end: "2026-10-11", nightly: true, themes: {} },
  { id: "fotofocus", name: "FotoFocus Biennial", short: "FotoFocus", start: "2026-09-30", end: "2026-11-01", nightly: false, themes: {} },
];
const [caw, scw, blink, ff] = LANES;
const text = (parts) => parts.map((p) => (p.b ? `*${p.t}*` : p.t)).join(" · ");

test("laneRun: start, mid, end, only, thru and not running", () => {
  assert.equal(laneRun(caw, "2026-10-03", W0, W1), "start");
  assert.equal(laneRun(caw, "2026-10-06", W0, W1), "mid");
  assert.equal(laneRun(caw, "2026-10-10", W0, W1), "end");
  assert.equal(laneRun(caw, "2026-10-11", W0, W1), null);
  assert.equal(laneRun(scw, "2026-10-04", W0, W1), null);
  assert.equal(laneRun(ff, "2026-10-03", W0, W1), "thru", "FotoFocus runs past both ends of the week");
  assert.equal(laneRun(ff, "2026-10-11", W0, W1), "thru");
  assert.equal(laneRun({ start: "2026-10-06", end: "2026-10-06" }, "2026-10-06", W0, W1), "only");
  assert.equal(laneRun({ start: null, end: null }, "2026-10-06", W0, W1), null);
  // a program that starts before the week but ends inside it is a normal line, not "thru"
  assert.equal(laneRun({ start: "2026-09-30", end: "2026-10-05" }, "2026-10-05", W0, W1), "end");
});

test("interchange: the days every solid lane runs (Thursday, Oct 8); the cased FotoFocus line does not count", () => {
  assert.deepEqual(interchangeDays(LANES, WEEK, W0, W1), ["2026-10-08"]);
  assert.deepEqual(interchangeDays([caw, blink], WEEK, W0, W1), ["2026-10-08", "2026-10-09", "2026-10-10"]);
  assert.deepEqual(interchangeDays([caw, ff], WEEK, W0, W1), [], "one solid lane is not an interchange");
});

test("screen-reader line names every program running, with opening and last days (nights for a nightly program)", () => {
  assert.equal(runNote(blink, "2026-10-08"), " (opening night)");
  assert.equal(runNote(scw, "2026-10-08"), " (last day)");
  assert.equal(runNote(caw, "2026-10-06"), "");
  assert.equal(programLine(LANES, "2026-10-08"), "Cincinnati Art Week, StartupCincy Week (last day), BLINK (opening night), FotoFocus Biennial");
  assert.equal(programLine(LANES, "2026-10-11"), "BLINK (last night), FotoFocus Biennial");
});

test("day summaries: news first (bold), then one detail, then the count; at most three parts", () => {
  const sum = (date, extra = {}) => text(daySummary({ date, lanes: LANES, weekStart: W0, weekEnd: W1, count: 10, ...extra }));
  assert.equal(sum("2026-10-08", { interchange: true }), "*Interchange: all three run* · *BLINK opens* · 10 events");
  assert.equal(sum("2026-10-03", { featured: "CAW Offsite Opening Celebration" }), "*Art Week opens* · CAW Offsite Opening Celebration · 10 events", "the opening day's own theme is not repeated");
  assert.equal(sum("2026-10-04"), "Art Week: MAKE IT · 10 events", "a long program's theme when nothing else is on");
  assert.equal(sum("2026-10-05"), "*StartupCincy opens* · Kick-off · 10 events", "the program's name is not repeated");
  assert.equal(sum("2026-10-06", { featured: "Cintrifuse Annual Meeting" }), "StartupCincy: Capital · 10 events", "a short program's day theme comes before a featured event");
  assert.equal(sum("2026-10-09"), "BLINK night 2 of 4 · 10 events");
  assert.equal(sum("2026-10-10"), "*Art Week's last day* · BLINK night 3 of 4 · 10 events");
  assert.equal(sum("2026-10-11", { count: 1 }), "*BLINK's last night* · 1 event");
  for (const d of WEEK) assert.ok(daySummary({ date: d, lanes: LANES, weekStart: W0, weekEnd: W1, interchange: true, featured: "X", count: 3 }).length <= 3);
});
