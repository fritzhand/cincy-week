/* tests/qa-ux.test.mjs · OWNER: QA (UX, visual, accessibility)
   Pure logic added during the UX/visual/accessibility QA pass:
   - lib/text.js roomText(): a room that repeats its venue's name prints only what it adds (event card, dialog,
     program rows), so "Court Street Plaza · Court Street Plaza, East Court Street" reads "Court Street Plaza · East Court Street"
   - lib/search.js group(): an exact title match leads its group, so "Findlay Market" finds the venue first
   - lib/ics.js eventItems(): with the site root as base, every URL is the schedule deep link (the plan page used to
     pass its own URL, giving ".../plan.html?theme=lightschedule.html?e=…") */
import { test } from "node:test";
import assert from "node:assert/strict";
import { roomText } from "../site/js/lib/text.js";
import { prepare, search, group } from "../site/js/lib/search.js";

test("roomText drops a room the venue name already holds", () => {
  assert.equal(roomText("Ready. Set. BLINK! footprint: Central Parkway between Liberty Street and West 14th Street", "Central Parkway between Liberty Street and West 14th Street"), "");
  assert.equal(roomText("Kinley Cincinnati Downtown — The Exchange (lobby bar)", "The Exchange"), "");
  assert.equal(roomText("Memorial Hall", "memorial hall"), "", "case and punctuation are ignored");
});

test("roomText keeps only what a room adds after the venue name, verbatim", () => {
  assert.equal(roomText("Court Street Plaza", "Court Street Plaza, East Court Street"), "East Court Street");
  assert.equal(roomText("Hyde Park Square", "Hyde Park Square (Erie Ave closed from Edwards to Michigan)"), "Erie Ave closed from Edwards to Michigan");
  assert.equal(roomText("Café Momus", "cafe momus – Back room"), "Back room", "accents fold");
});

test("roomText leaves real rooms alone", () => {
  assert.equal(roomText("Union Hall", "Beer Hall"), "Beer Hall");
  assert.equal(roomText("Hall", "Hall of Mirrors"), "Hall of Mirrors", "a name that merely starts with the venue's word stays whole");
  assert.equal(roomText("Union Hall", ""), "");
  assert.equal(roomText("Union Hall", null), "");
  assert.equal(roomText("", "Studio B"), "Studio B");
});

const ITEMS = prepare([
  { k: "ev", id: "e1", t: "BLINK at Findlay Market", s: "Oct 8–11 · Findlay Market", u: "schedule.html?e=e1" },
  { k: "ev", id: "e2", t: "Findlay Market Tasting Tour", s: "Findlay Market", u: "schedule.html?e=e2" },
  { k: "pe", id: "p1", t: "Jordon Kuhn", s: "Findlay Market", u: "people/p1.html" },
  { k: "ve", id: "findlay-market", t: "Findlay Market", s: "1801 Race St", u: "venues/findlay-market.html" },
  { k: "ve", id: "union-hall", t: "Union Hall", s: "1311 Vine St", u: "venues/union-hall.html" },
]);

test("search: an exact title match leads its group", () => {
  const hits = search(ITEMS, "Findlay Market");
  assert.equal(hits[0].id, "findlay-market");
  assert.equal(hits[0].exact, true);
  const groups = group(hits, 5);
  assert.equal(groups[0].label, "Venues", "the venue asked for comes first");
  assert.deepEqual(groups.map((g) => g.label), ["Venues", "Events", "People"], "the other groups keep their order");
});

test("search: without an exact match the group order is unchanged", () => {
  const groups = group(search(ITEMS, "findlay"), 5);
  assert.deepEqual(groups.map((g) => g.label), ["Events", "People", "Venues"]);
  assert.equal(search(ITEMS, "u")[0]?.exact ?? false, false, "a one-letter query is never exact");
});

test("ics: with the site root as base, URLs are schedule deep links", async () => {
  const { eventItems } = await import("../site/js/lib/ics.js");
  const data = { v: 1, tz: "America/New_York", venues: {}, people: {}, programs: { scw: { n: "StartupCincy Week", s: "StartupCincy" } } };
  const ev = { id: "scw-x", p: "scw", t: "Kickoff", d: null, v: null, r: null, lt: "Union Hall", pp: [], src: "https://startupcincyweek.com/", i: [["2026-10-05", Date.UTC(2026, 9, 5, 12, 30), Date.UTC(2026, 9, 5, 13, 30), 0]] };
  const base = new URL("./", "https://fritzhand.github.io/cincy-week/plan.html?theme=light").href;
  assert.equal(base, "https://fritzhand.github.io/cincy-week/");
  const items = eventItems(ev, data, { base });
  assert.ok(items.length >= 1);
  const url = items[0].url || items[0].URL || JSON.stringify(items[0]);
  assert.match(url, /https:\/\/fritzhand\.github\.io\/cincy-week\/schedule\.html\?e=scw-x/);
  assert.doesNotMatch(url, /plan\.html/);
});

test("approximate-time: the home ear says About", async () => {
  const { items, hoursText } = await import("../site/js/lib/athour.js");
  const s = Date.UTC(2026, 9, 8, 23, 0), e = s + 3600e3;
  const data = { events: [{ id: "blink-x", p: "blink", t: "Flip", tg: ["approximate-time"], i: [["2026-10-08", s, e, 1]] }, { id: "blink-y", p: "blink", t: "Show", tg: [], i: [["2026-10-08", s, e, 0]] }] };
  const [x, y] = items(data).sort((a, b) => a.id.localeCompare(b.id));
  assert.equal(hoursText(x), "About 7:00 PM · end time not listed");
  assert.equal(hoursText(y), "7:00–8:00 PM", "no tag, no About");
});

/* ---------- fixture build: the markup these helpers feed ---------- */
import { copyRepo, build, read, cleanup } from "./helpers.mjs";

let dir;
test("setup: the fixture builds", () => {
  dir = copyRepo();
  const r = build(dir);
  assert.equal(r.status, 0, r.stderr);
});

test("event card: a room that repeats the venue name is not printed twice, and is no 'Room not listed' venue", () => {
  const sched = read(dir, "docs/schedule.html");
  const card = sched.match(/<article class="ev" id="e-blink-2026-10-08-ready-set-blink-opening-ceremony"[\s\S]*?<\/article>/)[0];
  const where = card.match(/<p class="ev-where">[\s\S]*?<\/p>/)[0];
  assert.doesNotMatch(where, /ev-room/, "no second copy of the place");
  assert.doesNotMatch(where, /Room not listed/);
  const kick = sched.match(/<article class="ev" id="e-scw-sucw-2026-kickoff"[\s\S]*?<\/article>/)[0];
  assert.match(kick, /<span class="ev-room"> · Beer Hall<\/span>/, "a real room still prints");
});

test("venue page: its own cards print the room, not a link back to the page", () => {
  const page = read(dir, "docs/venues/union-hall.html");
  const cards = [...page.matchAll(/<article class="ev"[\s\S]*?<\/article>/g)].map((m) => m[0]);
  assert.ok(cards.length >= 1);
  for (const c of cards) {
    assert.doesNotMatch(c.match(/<p class="ev-where">[\s\S]*?<\/p>/)?.[0] || "", /venues\/union-hall\.html/);
  }
  assert.ok(cards.some((c) => /Beer Hall/.test(c)));
});

test("plan: the empty state heading follows the h1 (no skipped level)", () => {
  const plan = read(dir, "docs/plan.html");
  const main = plan.match(/<main[\s\S]*?<\/main>/)[0];
  const levels = [...main.matchAll(/<h([1-6])\b/g)].map((m) => +m[1]);
  assert.equal(levels[0], 1);
  for (let i = 1; i < levels.length; i++) assert.ok(levels[i] <= levels[i - 1] + 1, `h${levels[i - 1]} → h${levels[i]}`);
});

test("sidebar: program sub-lines wrap between segments, never inside one", () => {
  const home = read(dir, "docs/index.html");
  const all = (home.match(/<span class="nav-sub">/g) || []).length;
  const segmented = (home.match(/<span class="nav-sub">(?:<span>[^<]+<\/span>(?: · )?)+<\/span>/g) || []).length;
  assert.ok(all >= 1);
  assert.equal(segmented, all, "every sub-line is made of whole segments");
});

test("cleanup", () => cleanup(dir));
