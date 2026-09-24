/* tests/search.test.mjs · OWNER: Agent A · site/js/lib/search.js */
import { test } from "node:test";
import assert from "node:assert/strict";
import { norm, prepare, search, group, mark } from "../site/js/lib/search.js";
import { esc } from "../site/js/lib/text.js";

const ITEMS = prepare([
  { k: "ve", id: "cafe", t: "Café Mochiko", s: "Over-the-Rhine", u: "venues/cafe.html" },
  { k: "pe", id: "abby-grimm", t: "Abby Grimm", s: "Speaker · Cintrifuse", u: "people/abby-grimm.html", g: "startupcincy" },
  { k: "ev", id: "scw-kickoff", t: "SUCW 2026 Kickoff!", s: "Mon, Oct 5 · 8:30 AM · Union Hall", u: "schedule.html?e=scw-kickoff#e-scw-kickoff", g: "abby grimm aftab pureval" },
  { k: "ve", id: "union-hall", t: "Union Hall", s: "1311 Vine St", u: "venues/union-hall.html" },
  { k: "pr", id: "blink", t: "BLINK", s: "Oct 8–11", u: "blink.html" },
  { k: "wo", id: "blink-in-light-of-us", t: "In Light of Us", s: "Fountain District", u: "art.html?w=blink-in-light-of-us" },
  ...Array.from({ length: 8 }, (_, i) => ({ k: "pe", id: `p${i}`, t: `Person Union ${i}`, s: "", u: `people/p${i}.html` })),
]);

test("accent folding: Café ~ cafe", () => {
  assert.equal(norm("Café"), "cafe");
  assert.equal(search(ITEMS, "cafe")[0].id, "cafe");
  assert.equal(search(ITEMS, "CAFÉ")[0].id, "cafe");
});

test("multi-term AND", () => {
  const ids = search(ITEMS, "union hall").map((h) => h.id);
  assert.ok(ids.includes("union-hall") && ids.includes("scw-kickoff"));
  assert.ok(!ids.includes("p0"), "every term must match");
  assert.deepEqual(search(ITEMS, "union zebra"), []);
});

test("exact and word-prefix matches rank first", () => {
  assert.equal(search(ITEMS, "union hall")[0].id, "union-hall", "exact title beats a subline match");
  assert.equal(search(ITEMS, "light")[0].id, "blink-in-light-of-us", "word prefix inside a title");
  assert.equal(search(ITEMS, "grimm")[0].id, "abby-grimm", "a person's name beats a keyword hit");
});

test("happening-soon boost for events during the week", () => {
  const items = prepare([
    { k: "ev", id: "a", t: "Talk A", s: "", u: "a", st: 1000, en: 5000 },
    { k: "ev", id: "b", t: "Talk B", s: "", u: "b", st: 90000000, en: 90005000 },
  ]);
  assert.equal(search(items, "talk", { now: 2000 })[0].id, "a");
});

test("grouping caps each group and keeps totals", () => {
  const groups = group(search(ITEMS, "union"), 5);
  const people = groups.find((g) => g.label === "People");
  assert.equal(people.items.length, 5);
  assert.equal(people.total, 8);
  assert.deepEqual(groups.map((g) => g.label), ["Events", "People", "Venues"]);
});

test("mark wraps matches and escapes", () => {
  assert.equal(mark("Union <Hall>", "hall", esc), "Union &lt;<mark>Hall</mark>&gt;");
  assert.equal(mark("Café", "cafe", esc), "<mark>Café</mark>");
});
