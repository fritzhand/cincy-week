/* tests/integration.test.mjs · OWNER: Agent A (integration pass, 2026-09-24)
   1. events.json carries no descriptions; they live in event-text.json (loaded by the dialog and the .ics exports).
   2. The dialog's run of a multi-day item is its published date–end_date, widened only by listed occurrences.
   3. Program pages print a ticket's `details` (the organizer's words) and never its `notes` (research notes).
   4. On the merged data: news order matches both writers (date desc, then title), and the research asides the
      audit found (FAQ topics, a double colon in a venue name, ticket research notes) stay out of shown text. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { REPO, copyRepo, build, read, json, editData, cleanup } from "./helpers.mjs";

test("event descriptions move to event-text.json; events.json stays small", () => {
  const dir = copyRepo();
  try {
    const r = build(dir);
    assert.equal(r.status, 0, r.stderr);
    const ej = json(dir, "docs/assets/data/events.json"), tx = json(dir, "docs/assets/data/event-text.json");
    const src = json(dir, "data/events.json");
    assert.ok(ej.events.every((e) => !("d" in e)), "no description in events.json");
    assert.equal(tx.v, 1);
    for (const e of src) {
      if (e.description) assert.equal(tx.d[e.id], e.description, `${e.id}: verbatim description`);
      else assert.ok(!(e.id in tx.d), `${e.id}: no entry without a description`);
    }
    const dialog = read(dir, "docs/assets/js/core/event-dialog.js");
    assert.match(dialog, /getJSON\("event-text\.json"\)/, "the dialog loads the descriptions");
    assert.match(dialog, /did not load/, "a failed load is not reported as 'not listed'");
    assert.match(read(dir, "docs/assets/js/features/plan.js"), /app\.data\("event-text\.json"\)/, "My Plan's .ics export includes descriptions");
  } finally { cleanup(dir); }
});

test("the dialog's run of a day-by-day item is its published date–end_date", () => {
  const dir = copyRepo();
  try {
    editData("events", (a) => {
      const e = a.find((x) => x.id === "also-cac-10-03-the-creative-writing-project-fall");
      Object.assign(e, { date: "2026-10-02", end_date: "2026-10-31", start: null, end: null,
        occurrences: [{ date: "2026-10-02", start: "17:30", end: "22:00" }, { date: "2026-10-03", start: "17:30", end: "22:00" }, { date: "2026-10-06", start: "17:30", end: "21:00" }] });
    })(dir);
    const r = build(dir);
    assert.equal(r.status, 0, r.stderr);
    const { spans } = json(dir, "docs/assets/data/schedule-extra.json");
    assert.deepEqual(spans["also-cac-10-03-the-creative-writing-project-fall"], ["2026-10-02", "2026-10-31"]);
    assert.deepEqual(spans["fotofocus-exh-witness-to-the-journey-matt-herron-and-the-mississippi-delta1965"], ["2026-09-04", "2026-11-08"]);
  } finally { cleanup(dir); }
});

test("program pages print ticket details, never ticket notes", () => {
  const dir = copyRepo();
  try {
    editData("programs", (a) => {
      a.find((p) => p.id === "blink").tickets = [
        { name: "Festival admission", price: "Free", url: "https://blinkcincinnati.com/faq/", details: "Completely free and open to the public.", notes: null },
        { name: "Reserved parking", price: null, url: "https://blinkcincinnati.com/parking/", details: null, notes: "RESEARCH NOTE: price only inside a checkout widget" },
      ];
    })(dir);
    const r = build(dir);
    assert.equal(r.status, 0, r.stderr);
    const html = read(dir, "docs/blink.html");
    assert.match(html, /Completely free and open to the public\./);
    assert.doesNotMatch(html, /RESEARCH NOTE/);
  } finally { cleanup(dir); }
});

const DATA = path.join(REPO, "data");
const merged = fs.existsSync(path.join(DATA, "README.md")) && /^# data\/ — the merged research/.test(fs.readFileSync(path.join(DATA, "README.md"), "utf8"));
const D = (f) => JSON.parse(fs.readFileSync(path.join(DATA, `${f}.json`), "utf8"));
const skip = !merged && "data/ is not the merged research yet";

test("news.json is in the order both writers use: newest first, then title", { skip }, () => {
  const n = D("news");
  for (let i = 1; i < n.length; i++) {
    const a = n[i - 1], b = n[i];
    assert.ok(a.date > b.date || (a.date === b.date && a.title <= b.title), `news order at ${i}: ${a.id} before ${b.id}`);
  }
});

test("research asides stay out of shown text", { skip }, () => {
  for (const f of D("faqs")) assert.doesNotMatch(f.topic || "", /\((startupcincy\.com|Cintrifuse;)/, `faq ${f.id}: topic carries a research aside`);
  for (const v of D("venues")) assert.doesNotMatch(v.name, /::/, `venue ${v.id}: double colon`);
  for (const p of D("programs")) for (const t of p.tickets || []) assert.doesNotMatch(t.details || "", /not captured|Urban Hikers page:|sales open \d{4}-/, `${p.id} ticket "${t.name}": a research note in details`);
});
