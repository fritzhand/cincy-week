/* tests/ics.test.mjs · OWNER: Agent D · site/js/lib/ics.js (RFC 5545 output for "Add to calendar" and the plan export) */
import { test } from "node:test";
import assert from "node:assert/strict";
import { vcalendar, vevent, fold, escText, utc, gcalUrl, icsFilename, nextDay } from "../site/js/lib/ics.js";
import { nyToEpoch } from "../site/js/lib/time.js";

const octets = (s) => new TextEncoder().encode(s).length;
const unfold = (text) => text.replace(/\r\n /g, "");

test("utc() writes basic-format UTC with Z", () => {
  assert.equal(utc(Date.UTC(2026, 9, 8, 23, 0, 0)), "20261008T230000Z");
  // 7:00 PM in Cincinnati on Oct 8 (EDT, UTC-4) is 23:00 UTC
  assert.equal(utc(nyToEpoch("2026-10-08", "19:00")), "20261008T230000Z");
  // after midnight: 1:30 AM New York on Oct 9 = 05:30 UTC
  assert.equal(utc(nyToEpoch("2026-10-09", "01:30")), "20261009T053000Z");
  assert.equal(nextDay("2026-10-31"), "2026-11-01");
});

test("TEXT escaping: backslash, semicolon, comma, newline; control characters dropped", () => {
  assert.equal(escText("a;b,c\\d"), "a\\;b\\,c\\\\d");
  assert.equal(escText("line one\r\nline two\nthree"), "line one\\nline two\\nthree");
  assert.equal(escText("tab\there\u0007bell"), "tab\there" + "bell");
  assert.equal(escText(null), "");
});

test("fold(): 75 octets per line, continuation lines start with a space, UTF-8 never split", () => {
  assert.equal(fold("SUMMARY:short"), "SUMMARY:short");
  const long = "DESCRIPTION:" + "Opening night — “First Sight” drone show ✨ over the Ohio. ".repeat(6);
  const folded = fold(long);
  const lines = folded.split("\r\n");
  assert.ok(lines.length > 3);
  for (const [i, l] of lines.entries()) {
    assert.ok(octets(l) <= 75, `line ${i} has ${octets(l)} octets`);
    if (i > 0) assert.equal(l[0], " ");
    assert.ok(!l.includes("�"));
  }
  assert.equal(unfold(folded), long, "unfolding restores the line exactly");
  // a line of 4-byte characters folds on character boundaries
  const emoji = "X:" + "😀".repeat(40);
  for (const l of fold(emoji).split("\r\n")) assert.ok(octets(l) <= 75);
  assert.equal(unfold(fold(emoji)), emoji);
});

test("vcalendar(): CRLF everywhere, UTC times, escaped text, one VEVENT per item", () => {
  const s = nyToEpoch("2026-10-08", "19:00"), e = nyToEpoch("2026-10-08", "23:00");
  const ics = vcalendar([
    { uid: "blink-nightly-2026-10-08", title: "BLINK, night 1; lights, art", s, e, location: "Central Parkway, Cincinnati", geo: [39.11, -84.515], description: "Free.\nNo ticket needed.", url: "https://fritzhand.github.io/cincy-week/schedule.html?e=blink-nightly#e-blink-nightly", category: "BLINK" },
    { uid: "scw-talk", title: "A talk", s: nyToEpoch("2026-10-05", "10:00"), e: null },
  ], { name: "My Plan · Cincy Week", stamp: Date.UTC(2026, 8, 24, 12, 0, 0) });
  assert.ok(ics.endsWith("\r\n"));
  assert.ok(!/[^\r]\n/.test(ics), "every line ends in CRLF");
  const L = unfold(ics).split("\r\n");
  assert.equal(L[0], "BEGIN:VCALENDAR");
  assert.ok(L.includes("VERSION:2.0"));
  assert.ok(L.includes("X-WR-CALNAME:My Plan · Cincy Week"));
  assert.equal(L.filter((l) => l === "BEGIN:VEVENT").length, 2);
  assert.equal(L.filter((l) => l === "END:VEVENT").length, 2);
  assert.ok(L.includes("UID:blink-nightly-2026-10-08@fritzhand.github.io"));
  assert.ok(L.includes("DTSTAMP:20260924T120000Z"));
  assert.ok(L.includes("DTSTART:20261008T230000Z"));
  assert.ok(L.includes("DTEND:20261009T030000Z"));
  assert.ok(L.includes("SUMMARY:BLINK\\, night 1\\; lights\\, art"));
  assert.ok(L.includes("LOCATION:Central Parkway\\, Cincinnati"));
  assert.ok(L.includes("GEO:39.11;-84.515"));
  assert.ok(L.includes("DESCRIPTION:Free.\\nNo ticket needed."));
  assert.ok(L.includes("CATEGORIES:BLINK"));
  assert.ok(L.some((l) => l.startsWith("URL:https://fritzhand.github.io/cincy-week/schedule.html?e=blink-nightly#e-blink-nightly")));
  assert.equal(L[L.length - 2], "END:VCALENDAR");
  // an end time that is not listed is never invented
  const talk = L.slice(L.lastIndexOf("BEGIN:VEVENT"));
  assert.ok(talk.includes("DTSTART:20261005T140000Z"));
  assert.ok(!talk.some((l) => l.startsWith("DTEND")), "no DTEND when the end time is not listed");
});

test("all-day spans use VALUE=DATE with an exclusive end, and are transparent", () => {
  const L = vevent({ uid: "fotofocus-show", title: "Exhibition", allDay: { start: "2026-10-01", end: "2026-10-31" } }, { stamp: 0 });
  assert.ok(L.includes("DTSTART;VALUE=DATE:20261001"));
  assert.ok(L.includes("DTEND;VALUE=DATE:20261101"));
  assert.ok(L.includes("TRANSP:TRANSPARENT"));
  const one = vevent({ uid: "x", title: "One day", allDayDate: "2026-10-03" }, { stamp: 0 });
  assert.ok(one.includes("DTSTART;VALUE=DATE:20261003"));
  assert.ok(one.includes("DTEND;VALUE=DATE:20261004"));
  const c = vevent({ uid: "y", title: "Gone", s: 0, e: 3600000, cancelled: true }, { stamp: 0 });
  assert.ok(c.includes("STATUS:CANCELLED"));
  // UIDs stay safe even with odd characters
  assert.ok(vevent({ uid: "a b/c", title: "t", s: 0 }, { stamp: 0 }).includes("UID:a-b-c@fritzhand.github.io"));
});

test("Google Calendar link and file names", () => {
  const s = nyToEpoch("2026-10-08", "19:00"), e = nyToEpoch("2026-10-08", "23:00");
  const u = new URL(gcalUrl({ title: "BLINK & more", s, e, location: "OTR", description: "Free" }));
  assert.equal(u.origin + u.pathname, "https://calendar.google.com/calendar/render");
  assert.equal(u.searchParams.get("action"), "TEMPLATE");
  assert.equal(u.searchParams.get("text"), "BLINK & more");
  assert.equal(u.searchParams.get("dates"), "20261008T230000Z/20261009T030000Z");
  assert.equal(new URL(gcalUrl({ title: "x", s, e: null })).searchParams.get("dates"), "20261008T230000Z/20261008T230000Z");
  assert.equal(new URL(gcalUrl({ title: "x", allDay: { start: "2026-10-01", end: "2026-10-31" } })).searchParams.get("dates"), "20261001/20261101");
  assert.equal(icsFilename("Ready. Set. BLINK! Opening Ceremony"), "ready-set-blink-opening-ceremony.ics");
  assert.equal(icsFilename("Café — “Première”"), "cafe-premiere.ics");
  assert.equal(icsFilename(""), "cincy-week.ics");
});
