/* tests/qa-data.test.mjs · data-accuracy audit (2026-09-24)
   1. fmtDateRange names both years only for runs that would otherwise read backwards (the audit found
      "Aug 28–13" for Aug 28, 2026–Aug 13, 2027); short runs keep their compact form.
   2. The corrections the audit made through scripts/merge-research.mjs (QA_* tables) stay in data/:
      no invented opening dates, per-day schedules for closed days and changing hours, no guessed names or
      template placeholder people, bios linked to where they were published, one Findlay Market neighborhood. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { REPO } from "./helpers.mjs";
import { fmtDateRange } from "../site/js/lib/time.js";

test("fmtDateRange: compact within a year, both years when a run would read backwards", () => {
  assert.equal(fmtDateRange("2026-10-03", "2026-10-10"), "Oct 3–10");
  assert.equal(fmtDateRange("2026-09-30", "2026-11-01"), "Sep 30–Nov 1");
  assert.equal(fmtDateRange("2026-10-02", "2027-02-07"), "Oct 2–Feb 7", "into the next year, still unambiguous");
  assert.equal(fmtDateRange("2026-05-22", "2027-01-04"), "May 22–Jan 4");
  assert.equal(fmtDateRange("2026-08-28", "2027-08-13"), "Aug 28, 2026–Aug 13, 2027", "same month a year later");
  assert.equal(fmtDateRange("2024-10-17", "2026-10-31"), "Oct 17, 2024–Oct 31, 2026", "two years apart");
  assert.equal(fmtDateRange("2026-10-08", "2026-10-08"), "Oct 8");
});

const DATA = path.join(REPO, "data");
const merged = fs.existsSync(path.join(DATA, "README.md")) && /^# data\/ — the merged research/.test(fs.readFileSync(path.join(DATA, "README.md"), "utf8"));
const D = (f) => JSON.parse(fs.readFileSync(path.join(DATA, `${f}.json`), "utf8"));
const skip = !merged && "data/ is not the merged research yet";
const byId = (arr) => new Map(arr.map((r) => [r.id, r]));

test("no exhibition starts on the research capture day unless it truly opened then", { skip }, () => {
  const ev = byId(D("events"));
  const opened = { "also-cac-sarah-rodriguez-homespun": "2026-07-08", "also-cac-softlab-gravity-s-rainbow": "2024-10-17", "also-cam-gifts-from-japan": "2026-06-22", "also-cmc-lego-jurassic-world-the-exhibition": "2026-05-22" };
  for (const [id, date] of Object.entries(opened)) if (ev.has(id)) assert.equal(ev.get(id).date, date, id);
  for (const e of ev.values()) assert.doesNotMatch(e.notes || "", /date is the research capture date/, `${e.id}: a capture-day stand-in for an unpublished opening`);
});

test("per-day schedules: closed days skipped, weekday hours kept", { skip }, () => {
  const ev = byId(D("events"));
  const zoo = ev.get("also-zoo-jack-olantern-glow");
  if (zoo) {
    const dates = zoo.occurrences.map((o) => o.date);
    for (const closed of ["2026-10-05", "2026-10-12"]) assert.ok(!dates.includes(closed), `the Zoo is closed ${closed}`);
    assert.equal(zoo.occurrences.find((o) => o.date === "2026-10-06").end, "21:00", "Tuesdays end at 9 PM");
    assert.equal(zoo.occurrences.find((o) => o.date === "2026-10-08").end, "22:00", "Thursdays end at 10 PM");
  }
  const findlay = ev.get("also-findlay-blink-10-08");
  if (findlay) assert.deepEqual(findlay.occurrences.map((o) => `${o.date} ${o.start}-${o.end}`), ["2026-10-08 12:30-23:30", "2026-10-09 12:30-23:30", "2026-10-10 09:00-16:00", "2026-10-11 09:00-16:00"]);
  const tct = ev.get("also-tct-mary-poppins-jr");
  if (tct) assert.deepEqual(tct.occurrences.filter((o) => o.date === "2026-10-10").map((o) => o.start), ["14:00", "17:00"]);
});

test("people: no guessed names, no template placeholders, bios linked to their pages", { skip }, () => {
  const people = byId(D("people"));
  for (const id of ["bailey-elderberry", "brandon-hill", "isaiah-armstrong", "daniel-iroh"]) assert.ok(!people.has(id), `${id} is not a person record`);
  if (people.has("bailey-elder")) assert.equal(people.get("bailey-elder").name, "Bailey Elder");
  const sab = people.get("andrea-sabugo");
  if (sab) assert.ok(!sab.programs.includes("caw"), "a photo credit is not Art Week participation");
  const tc = people.get("tiffany-cooper");
  if (tc && tc.bio) assert.ok(tc.also_sources.includes("https://www.tiffanymcooper.com/about"), "the bio's own page is listed");
  for (const w of D("works")) for (const a of w.artists) assert.ok(people.has(a), `${w.id}: artist ${a} has a record`);
});

test("one Findlay Market: the market and its merchants share the neighborhood BLINK's zone uses", { skip }, () => {
  const venues = byId(D("venues"));
  if (venues.has("findlay-market") && venues.has("blink-zone-findlay-market")) assert.equal(venues.get("findlay-market").hood, venues.get("blink-zone-findlay-market").hood);
  for (const p of D("places")) if (/^findlay-/.test(p.id) && p.kind !== "neighborhood" && p.lat !== null) assert.equal(p.hood, "findlay-market-district", p.id);
});

test("every venue with events names an address or says why it has none", { skip }, () => {
  const ev = D("events");
  const used = new Set(ev.map((e) => e.venue_id).filter(Boolean));
  for (const v of D("venues")) if (used.has(v.id) && v.lat === null) assert.ok(v.notes && v.notes.length > 20, `${v.id}: an unmapped venue explains itself in notes`);
  const merc = D("venues").find((v) => v.id === "mercantile-immersive");
  if (merc) assert.equal(merc.address, "120 E 4th St");
});
