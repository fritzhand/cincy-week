/* tests/agenda.test.mjs · OWNER: Agent D · site/js/lib/agenda.js (today, presets, overlaps, walking gaps) */
import { test } from "node:test";
import assert from "node:assert/strict";
import { dur, festivalToday, defaultDay, inWhen, conflicts, conflictText, walkGap, gapText, isTimed, hasHours, F } from "../site/js/lib/agenda.js";
import { nyToEpoch, HOUR, MIN } from "../site/js/lib/time.js";

const at = (d, t) => nyToEpoch(d, t);
const item = (id, day, start, end, f = 0, v = null) => {
  const s = at(day, start);
  let e = end ? at(day, end) : s + HOUR;
  if (end && end < start) e = at(day, end) + 24 * HOUR;
  return { id, t: id.toUpperCase(), day, s, e, f: end ? f : f | F.END_UNKNOWN, v };
};

test("dur() speaks in minutes and hours", () => {
  assert.equal(dur(45), "45 min");
  assert.equal(dur(60), "1 h");
  assert.equal(dur(75), "1 h 15 min");
  assert.equal(dur(0.2), "1 min");
});

test("festival today: after midnight still belongs to the night before", () => {
  assert.equal(festivalToday(at("2026-10-08", "19:30")), "2026-10-08");
  assert.equal(festivalToday(at("2026-10-09", "01:30")), "2026-10-08");
  assert.equal(festivalToday(at("2026-10-09", "05:00")), "2026-10-09");
  const days = ["2026-10-03", "2026-10-04", "2026-10-08"];
  assert.equal(defaultDay(at("2026-10-08", "12:00"), days, "2026-10-03"), "2026-10-08");
  assert.equal(defaultDay(at("2026-09-24", "12:00"), days, "2026-10-03"), "2026-10-03", "before the week: the first week day");
  assert.equal(defaultDay(at("2026-10-20", "12:00"), days, "2026-10-03"), "2026-10-03", "after the week: the first week day");
});

test("flags: timed sessions and listed hours", () => {
  assert.ok(isTimed(0) && isTimed(F.END_UNKNOWN) && isTimed(F.LATE));
  assert.ok(!isTimed(F.ONGOING) && !isTimed(F.ALL_DAY) && !isTimed(F.TIME_UNKNOWN));
  assert.ok(hasHours(F.ONGOING) && !hasHours(F.ONGOING | F.TIME_UNKNOWN) && !hasHours(F.ALL_DAY));
});

test("when= presets: now, next (2 h), tonight (from 5:00 PM, after-midnight included)", () => {
  const now = at("2026-10-08", "19:30");
  const blink = { ...item("blink", "2026-10-08", "19:00", "23:00"), f: F.ONGOING };
  const talk = item("talk", "2026-10-08", "19:00"); // end not listed: never "now"
  const soon = item("soon", "2026-10-08", "21:00", "22:00");
  const later = item("later", "2026-10-08", "22:00", "23:00");
  const after = { ...item("after", "2026-10-09", "00:30", "02:00"), day: "2026-10-08", f: F.LATE };
  const lunch = item("lunch", "2026-10-08", "12:00", "13:00");
  const show = { ...item("show", "2026-10-08", "00:00", "23:59"), f: F.ONGOING | F.TIME_UNKNOWN };
  assert.ok(inWhen(blink, "now", now));
  assert.ok(!inWhen(talk, "now", now));
  assert.ok(!inWhen(show, "now", now), "hours not listed never claims now");
  assert.ok(inWhen(soon, "next", now) && !inWhen(later, "next", now) && !inWhen(blink, "next", now));
  assert.ok(inWhen(soon, "tonight", now) && inWhen(later, "tonight", now) && inWhen(after, "tonight", now));
  assert.ok(!inWhen(lunch, "tonight", now), "ended afternoon items are not tonight");
  assert.ok(inWhen(lunch, null, now));
});

test("overlaps: with a length when both ends are listed, honest words when not", () => {
  const a = item("a", "2026-10-08", "16:00", "21:00");
  const b = item("b", "2026-10-08", "17:00", "18:00");
  const c = item("c", "2026-10-08", "20:30"); // starts before a ends, end not listed
  const d = item("d", "2026-10-08", "10:00"); // end not listed
  const e = item("e", "2026-10-08", "10:30", "11:30"); // starts 30 min after d: may overlap
  const f = item("f", "2026-10-08", "10:00", "10:45"); // same start as d
  const g = item("g", "2026-10-08", "12:00", "13:00"); // clear of everything
  const blink = { ...item("blink", "2026-10-08", "19:00", "23:00"), f: F.ONGOING }; // ongoing never conflicts
  const m = conflicts([a, b, c, d, e, f, g, blink]);
  const kinds = (id) => (m.get(id) || []).map((x) => `${x.kind}:${x.other.id}${x.minutes ? ":" + x.minutes : ""}`).sort();
  assert.deepEqual(kinds("a"), ["during:c", "overlap:b:60"]);
  assert.deepEqual(kinds("b"), ["overlap:a:60"]);
  assert.deepEqual(kinds("c"), ["during:a"]);
  assert.deepEqual(kinds("d"), ["maybe:e", "same:f"]);
  assert.deepEqual(kinds("e"), ["maybe:d", "overlap:f:15"]);
  assert.deepEqual(kinds("g"), []);
  assert.deepEqual(kinds("blink"), []);
  assert.equal(conflictText(m.get("b")[0]), "Overlaps “A” in your plan by 1 h");
  assert.equal(conflictText({ kind: "overlap", minutes: 75, other: a }, { inPlan: false }), "Overlaps “A” by 1 h 15 min");
  assert.equal(conflictText({ kind: "same", other: f }), "Starts at the same time as “F” in your plan");
  assert.equal(conflictText({ kind: "during", other: a }), "Overlaps “A” in your plan (an end time is not listed)");
  assert.equal(conflictText({ kind: "maybe", other: d }), "May overlap “D” in your plan: an end time is not listed");
  // the same start with both ends listed is an overlap with its length
  const g2 = item("g2", "2026-10-08", "12:00", "12:30");
  assert.deepEqual(conflicts([g, g2]).get("g2").map((x) => [x.kind, x.minutes]), [["overlap", 30]]);
  // a later session far from an open-ended one is not flagged
  assert.equal(conflicts([d, item("h", "2026-10-08", "11:30", "12:00")]).size, 0);
});

test("walking gaps: estimates from straight-line distance, labeled; unknown places say so", () => {
  const venues = {
    "union-hall": { n: "Union Hall", ll: [39.1096, -84.5145] },
    "findlay": { n: "Findlay Market", ll: [39.1153, -84.5192] },
    "banks": { n: "The Banks", ll: [39.0955, -84.5098] },
    "far": { n: "Far Away", ll: [39.14, -84.46] },
    "nowhere": { n: "Storefront galleries", ll: null },
  };
  const a = item("a", "2026-10-08", "10:00", "11:00", 0, "union-hall");
  const b = item("b", "2026-10-08", "11:30", "12:00", 0, "findlay");
  const g = walkGap(a, b, venues);
  assert.equal(g.kind, "walk");
  assert.ok(g.minutes >= 8 && g.minutes <= 14, `about 10 min, got ${g.minutes}`);
  assert.equal(g.free, 30);
  assert.equal(gapText(g), `About ${g.minutes} min walk (estimate) from Union Hall to Findlay Market`);
  const long = walkGap(a, item("c", "2026-10-08", "12:00", "13:00", 0, "far"), venues);
  assert.ok(long.long);
  assert.match(gapText(long), /consider the Connector streetcar or a ride$/);
  assert.equal(gapText(walkGap(a, item("d", "2026-10-08", "12:00", "13:00", 0, "union-hall"), venues)), "Same place: Union Hall");
  const unk = walkGap(a, item("e", "2026-10-08", "12:00", "13:00", 0, "nowhere"), venues);
  assert.equal(unk.kind, "unknown");
  assert.equal(gapText(unk), "Walking time not estimated: Storefront galleries is not on the map");
  const none = walkGap(a, { ...item("f", "2026-10-08", "12:00", "13:00"), v: null, t: "Pop-up" }, venues);
  assert.equal(gapText(none), "Walking time not estimated: the place of “Pop-up” is not on the map");
  assert.equal(walkGap(item("x", "2026-10-08", "10:00"), b, venues).free, null, "no free time when an end is not listed");
});
