/* tests/athour.test.mjs · OWNER: Agent G · the home page's clock logic (site/js/lib/athour.js) */
import { test } from "node:test";
import assert from "node:assert/strict";
import { items, atThisHour, firstUp, countdown, kicker, hoursText, rel, FL } from "../site/js/lib/athour.js";
import { nyToEpoch } from "../site/js/lib/time.js";

const t = (d, hm) => nyToEpoch(d, hm);
const inst = (day, a, b, f = 0) => [day, t(day, a), b ? t(day, b) : t(day, a) + 3600e3, f];
/** a small events.json: the shape of build/core/client-data.mjs */
const DATA = {
  events: [
    { id: "blink-rsb", p: "blink", t: "Ready. Set. BLINK!", fe: 1, v: "v1", i: [inst("2026-10-08", "16:00", "21:00")] },
    { id: "scw-soft", p: "scw", t: "Soft Launch", fe: 0, lt: "Imagination Alley", i: [inst("2026-10-08", "16:00", null, FL.END_UNKNOWN)] },
    { id: "caw-mta", p: "caw", t: "Meet the Artists", fe: 0, i: [inst("2026-10-08", "17:00", "18:00")] },
    { id: "blink-nightly", p: "blink", t: "BLINK nights", fe: 1, i: ["2026-10-08", "2026-10-09"].map((d) => inst(d, "19:00", "23:00", FL.ONGOING)) },
    { id: "blink-drone", p: "blink", t: "Drone show", fe: 0, i: [inst("2026-10-08", "20:30", "21:00")] },
    { id: "ff-exh", p: "fotofocus", t: "An exhibition", fe: 0, i: [["2026-10-08", t("2026-10-08", "00:00"), t("2026-10-09", "00:00"), FL.TIME_UNKNOWN | FL.ONGOING]] },
    { id: "also-late", p: "also", t: "After party", fe: 0, i: [["2026-10-08", t("2026-10-09", "00:30"), t("2026-10-09", "02:00"), FL.LATE]] },
    { id: "scw-cancel", p: "scw", t: "Cancelled talk", st: "cancelled", i: [inst("2026-10-08", "16:30", "17:00")] },
    { id: "caw-sat", p: "caw", t: "Exhibitions + Art Market", fe: 1, i: [inst("2026-10-03", "16:00", "19:00")] },
    { id: "also-sat", p: "also", t: "A museum class", fe: 0, i: [inst("2026-10-03", "10:00", "12:00")] },
  ],
};
const ALL = items(DATA);
const ids = (xs) => xs.map((x) => x.id);

test("items: one per instance, cancelled events left out, sorted by start", () => {
  assert.ok(!ALL.some((x) => x.id === "scw-cancel"));
  assert.equal(ALL.filter((x) => x.id === "blink-nightly").length, 2);
  for (let i = 1; i < ALL.length; i++) assert.ok(ALL[i - 1].s <= ALL[i].s);
});

test("At this hour, Thu 4:40 PM: Now (featured first), open now, next, tonight; nothing guessed", () => {
  const r = atThisHour(ALL, t("2026-10-08", "16:40"));
  assert.equal(r.today, "2026-10-08");
  assert.deepEqual(ids(r.now), ["blink-rsb", "scw-soft"], "an unlisted end counts only for the hour after its start");
  assert.deepEqual(ids(r.open), [], "the nightly run has not opened yet");
  assert.equal(r.onView, 1, "hours-not-listed items are counted, never shown as open now");
  assert.deepEqual(ids(r.next), ["caw-mta", "blink-nightly", "blink-drone"].filter((id) => ids(r.next).includes(id)).slice(0, 3));
  assert.equal(r.next[0].id, "caw-mta");
  assert.ok(!ids(r.tonight).some((id) => ids(r.next).includes(id)), "tonight does not repeat next");
  assert.ok(ids(r.tonight).includes("also-late"), "an after-midnight start belongs to tonight");
});

test("At this hour, Thu 7:30 PM: the nightly run is open now; 5:10 PM: the unlisted end has dropped out of Now", () => {
  const r = atThisHour(ALL, t("2026-10-08", "19:30"));
  assert.deepEqual(ids(r.open), ["blink-nightly"]);
  assert.deepEqual(ids(r.now), ["blink-rsb"]);
  assert.equal(r.next[0].id, "blink-drone");
  const r2 = atThisHour(ALL, t("2026-10-08", "17:10"));
  assert.ok(!ids(r2.now).includes("scw-soft"));
  assert.ok(ids(r2.now).includes("caw-mta"));
});

test("At this hour after midnight still belongs to the evening before; Next falls back to the next start", () => {
  const r = atThisHour(ALL, t("2026-10-09", "00:45"));
  assert.equal(r.today, "2026-10-08");
  assert.deepEqual(ids(r.now), ["also-late"]);
  const r2 = atThisHour(ALL, t("2026-10-09", "03:00"));
  assert.equal(r2.next[0].id, "blink-nightly", "nothing within three hours: the very next start");
  assert.equal(r2.next[0].day, "2026-10-09");
  const r3 = atThisHour(ALL, t("2026-10-08", "11:00"));
  assert.deepEqual(ids(r3.next), ["blink-rsb", "scw-soft"], "a session comes before a multi-day run's next opening");
});

test("First up: the next festival items with listed hours, never the 'also' program", () => {
  const up = firstUp(ALL, t("2026-09-24", "10:00"));
  assert.equal(up[0].id, "caw-sat");
  assert.ok(!up.some((x) => x.p === "also"));
  assert.ok(!up.some((x) => x.f & FL.TIME_UNKNOWN));
  assert.ok(up.length <= 4);
});

test("countdown and kicker words", () => {
  assert.deepEqual(countdown(t("2026-09-24", "10:00"), "2026-10-03", "Art Week"), { n: "9", text: "days until Art Week opens" });
  assert.deepEqual(countdown(t("2026-10-02", "23:59"), "2026-10-03", "Art Week"), { n: "1", text: "day until Art Week opens" });
  assert.equal(countdown(t("2026-10-03", "09:00"), "2026-10-03", "Art Week").text, "Art Week opens today");
  assert.equal(countdown(t("2026-10-04", "09:00"), "2026-10-03", "Art Week"), null);
  const meta = { weekStart: "2026-10-03", weekEnd: "2026-10-11", first: { name: "Art Week", date: "2026-10-03" }, interchange: ["2026-10-08"] };
  assert.equal(kicker("before", t("2026-09-24", "10:00"), meta), "9 days out · Art Week opens Sat, Oct 3");
  assert.equal(kicker("during", t("2026-10-08", "16:40"), meta), "Today is interchange day");
  assert.equal(kicker("during", t("2026-10-06", "10:50"), meta), "Day 4 of 9 · Tue, Oct 6");
  assert.equal(kicker("after", t("2026-10-13", "12:00"), meta), "The week in review");
});

test("hours text and relative time", () => {
  assert.equal(hoursText(ALL.find((x) => x.id === "blink-rsb")), "4:00–9:00 PM");
  assert.equal(hoursText(ALL.find((x) => x.id === "scw-soft")), "4:00 PM · end time not listed");
  assert.equal(rel(20 * 60e3), "in 20 min");
  assert.equal(rel(100 * 60e3), "in 1 h 40 min");
  assert.equal(rel(-40 * 60e3), "Started 40 min ago");
});
