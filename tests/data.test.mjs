/* tests/data.test.mjs · OWNER: Agent C (data)
   1. scripts/merge-lib.mjs: the pure rules the merge applies (text, URLs, is_free, keys, hoods).
   2. data/*.json: the merge's own policies, beyond what the schema checks (page policy for FotoFocus people,
      credits vs people, program-prefixed ids, room blocks first, news order, 2026-only events).
   3. The merge is deterministic: two offline runs write byte-identical files (skipped without the research). */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { REPO, CONFIG, hashTree, cleanup } from "./helpers.mjs";
import { txt, https, isFree, nameKey, tightKey, orgKey, addrKey, brandTok, hoodFromOsm, decodeEntities, daySpan, toId } from "../scripts/merge-lib.mjs";

/* ---------------------------------------------------------------- 1. pure rules */
test("txt keeps text verbatim and only normalizes whitespace, entities and tags", () => {
  assert.equal(txt("  Founder &amp; CEO&#8217;s  plan\r\n\r\n\r\nNext  para "), "Founder & CEO’s plan\n\nNext para");
  assert.equal(txt("a<br>b<br/>c"), "a\nb\nc");
  const fixes = [];
  assert.equal(txt("<p>Hello <b>there</b></p>", (m) => fixes.push(m)), "Hello there");
  assert.equal(fixes.length, 1);
  assert.equal(txt("   "), null);
  assert.equal(txt(null), null);
  assert.equal(txt("AT&T & friends"), "AT&T & friends", "a bare ampersand is not an entity");
  assert.equal(decodeEntities("&ndash;&nbsp;&#x2019;&unknown;"), "\u2013 \u2019&unknown;", "NBSP becomes a plain space");
});

test("https keeps https URLs only (spaces encoded)", () => {
  assert.equal(https("https://example.org/a b.png"), "https://example.org/a%20b.png");
  assert.equal(https("http://example.org/"), null);
  assert.equal(https("mailto:x@y.z"), null);
  assert.equal(https("#"), null);
  assert.equal(https("https://"), null);
  assert.equal(https(null), null);
});

test("is_free is true only when the published cost says free, false only for a price without 'free'", () => {
  for (const c of ["Free", "Free to the Public", "Free Admission", "Free, drop-in.", "Free (approval required)", "This is a FREE EVENT, but you must register to receive a ticket.", "Entry is free."]) assert.equal(isFree(c), true, c);
  for (const c of ["$40", "Tickets start at $39", "$54.42 (Race Roster, incl. fees)", "Exhibition Ticket Required. Adult: $19.50; Senior: $14.50"]) assert.equal(isFree(c), false, c);
  for (const c of ["Free to Biennial Pass Holders", "Free to Pass Holders in October, venue members. General admission: $15", "FREE with Zoo Admission or membership",
    "Free add-on to any StartupCincy Week ticket", "$0.00 add-on, offered only with the Venture Capital Investor ticket ($300.00)", "Ticketed. Free for members. Adult tickets: $17.", null, ""]) assert.equal(isFree(c), null, String(c));
});

test("name keys ignore case, accents, punctuation, parentheticals and a leading 'the'", () => {
  assert.equal(nameKey("The Mz.Icar Collective"), nameKey("mz icar collective"));
  assert.equal(nameKey("Julieta González"), "julieta gonzalez");
  assert.equal(tightKey("VisitCincy"), tightKey("Visit Cincy"));
  assert.equal(orgKey("Procter & Gamble (P&G)"), orgKey("P&G"));
  assert.equal(orgKey("Fifth Third Bank"), orgKey("Fifth Third"));
  assert.notEqual(orgKey("Luther Foundation"), orgKey("H.B., E.W. & F.R. Luther Foundation"), "unverified variants never merge");
});

test("stay addresses match across spellings, but only with the same leading name word", () => {
  assert.equal(addrKey("210 East Sixth Street, Cincinnati, OH 45202"), addrKey("210 E 6th St., Cincinnati"));
  assert.equal(addrKey("Freedom Way, Cincinnati"), null, "no house number, no key");
  assert.notEqual(brandTok("Hampton Inn & Suites Cincinnati-Downtown"), brandTok("Homewood Suites by Hilton Cincinnati-Downtown"));
  assert.notEqual(brandTok("Hotel Covington"), brandTok("North by Hotel Covington"));
  assert.equal(brandTok("The Symphony Hotel"), brandTok("Symphony Hotel & Restaurant"));
});

test("OpenStreetMap addresses map to the canonical hoods, else to a Cincinnati suburb, else nothing", () => {
  assert.deepEqual(hoodFromOsm({ suburb: "Over-the-Rhine", city: "Cincinnati" }), { hood: "over-the-rhine", suburb: "Over-the-Rhine" });
  assert.equal(hoodFromOsm({ suburb: "Central Business District", city: "Cincinnati" }).hood, "downtown-cbd");
  assert.equal(hoodFromOsm({ hamlet: "Kenton Hills", city: "Covington" }).hood, "covington");
  assert.deepEqual(hoodFromOsm({ suburb: "Walnut Hills", city: "Cincinnati" }), { hood: null, suburb: "Walnut Hills" });
  assert.deepEqual(hoodFromOsm({ quarter: "Downtown", city: "Columbus" }), { hood: null, suburb: null });
  assert.deepEqual(hoodFromOsm(null), { hood: null, suburb: null });
});

test("date spans and ids", () => {
  assert.deepEqual(daySpan("2026-10-30", "2026-11-02"), ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  assert.equal(toId("When and Where is BLINK?"), "when-and-where-is-blink");
  assert.ok(toId("x".repeat(200), 60).length <= 60);
});

/* ---------------------------------------------------------------- 2. data policies */
const DATA = path.join(REPO, "data");
const merged = fs.existsSync(path.join(DATA, "README.md")) && /^# data\/ — the merged research/.test(fs.readFileSync(path.join(DATA, "README.md"), "utf8"));
const D = (f) => JSON.parse(fs.readFileSync(path.join(DATA, `${f}.json`), "utf8"));
const skip = !merged && "data/ is not the merged research yet";

test("events: program-prefixed ids, a place for every event, 2026 dates inside the window", { skip }, () => {
  for (const e of D("events")) {
    assert.ok(e.id.startsWith(`${e.program}-`), e.id);
    assert.ok(e.venue_id || e.location_text, `${e.id}: venue or location_text`);
    const last = e.end_date || e.date;
    assert.ok(last >= CONFIG.dataWindow.start && e.date <= CONFIG.dataWindow.end, `${e.id}: ${e.date}–${last} inside the data window`);
    assert.ok(e.date >= "2026-01-01" || /^2026-/.test(last), `${e.id}: a 2026 event`);
    if (e.is_free === true) assert.match(e.cost || "", /free/i, `${e.id}: is_free true needs a published "free"`);
    if (e.is_free === false) assert.doesNotMatch(e.cost || "", /free/i, `${e.id}: is_free false never says free`);
  }
});

test("credits: plain names only, never also a linked person on the same event", { skip }, () => {
  const people = new Map(D("people").map((p) => [p.id, p]));
  let names = 0;
  for (const e of D("events")) {
    const linked = new Set((e.people || []).map((id) => nameKey(people.get(id)?.name)));
    for (const c of e.credits || []) {
      assert.ok(c.role && c.names.length, `${e.id}: a credit has a role and names`);
      for (const n of c.names) { names++; assert.ok(!linked.has(nameKey(n)), `${e.id}: "${n}" is both a person and a credit`); }
    }
  }
  assert.ok(names > 100, "the FotoFocus name-only artists are kept as credits");
});

test("people: FotoFocus / also-only people meet the page policy", { skip }, () => {
  const events = D("events");
  const byPerson = new Map();
  for (const e of events) for (const p of e.people || []) { if (!byPerson.has(p)) byPerson.set(p, []); byPerson.get(p).push(e); }
  const inWeek = (a, b) => a <= CONFIG.week.end && b >= CONFIG.week.start;
  const week = (e) => (e.occurrences ? e.occurrences.some((o) => inWeek(o.date, o.date)) : inWeek(e.date, e.end_date || e.date));
  for (const p of D("people")) {
    if (p.programs.some((x) => ["caw", "scw", "blink"].includes(x))) continue;
    const pageRole = (byPerson.get(p.id) || []).some((e) => week(e) && ["curator", "speaker", "performer", "moderator"].includes((e.people_roles || {})[p.id]));
    assert.ok(p.bio || p.headshot_url || pageRole, `${p.id}: bio, headshot or a page role on an Oct 3–11 event`);
    assert.ok(byPerson.has(p.id), `${p.id}: appears on at least one event`);
  }
});

test("stays: room blocks first; portals are BLINK's; news newest first with unique URLs", { skip }, () => {
  const stays = D("stays");
  const firstPlain = stays.findIndex((s) => !s.room_block);
  assert.ok(stays.slice(firstPlain).every((s) => !s.room_block), "room blocks come first");
  for (const s of stays) if (s.booking_portal) assert.equal(s.booking_portal.program, "blink");
  const news = D("news");
  assert.equal(new Set(news.map((n) => n.url)).size, news.length, "news URLs are unique");
  for (let i = 1; i < news.length; i++) assert.ok(news[i - 1].date >= news[i].date, `news order at ${news[i].id}`);
});

test("hoods, aliases and orgs are consistent", { skip }, () => {
  const hoods = new Set(D("places").filter((p) => p.kind === "neighborhood").map((p) => p.id));
  for (const f of ["venues", "stays", "places"]) for (const r of D(f)) if (r.hood) assert.ok(hoods.has(r.hood), `${f}#${r.id}.hood`);
  const aliases = D("aliases");
  for (const [k, v] of Object.entries(aliases.hoods)) assert.ok(hoods.has(v), `alias ${k}`);
  const orgs = D("orgs");
  assert.equal(new Set(orgs.map((o) => orgKey(o.name))).size, orgs.length, "one org record per organization");
});

/* ---------------------------------------------------------------- 3. determinism */
const RESEARCH = process.env.CW_RESEARCH || "/tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research";
test("the merge is deterministic (two offline runs, byte-identical output)", { skip: !fs.existsSync(RESEARCH) && "research folder not present" }, () => {
  const outs = [".cache/test-merge-a", ".cache/test-merge-b"];
  try {
    for (const o of outs) {
      cleanup(path.join(REPO, o));
      const r = spawnSync(process.execPath, ["scripts/merge-research.mjs", "--offline"], { cwd: REPO, encoding: "utf8", env: { ...process.env, CW_DATA_OUT: o } });
      assert.equal(r.status, 0, r.stderr);
    }
    assert.deepEqual(hashTree(path.join(REPO, outs[0])), hashTree(path.join(REPO, outs[1])));
  } finally { for (const o of outs) cleanup(path.join(REPO, o)); }
});
