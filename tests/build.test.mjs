/* ============================================================
   tests/build.test.mjs · OWNER: Agent A (core engine) — the QS port.
   Every test builds in a throwaway copy of the repo (build.mjs, build/,
   site/, site.config.json) with tests/fixtures/mini as data/, so the real
   docs/ and the moving real data are never touched. Helpers: tests/helpers.mjs
   (domain agents add tests/<domain>.test.mjs with them; see build/CONTRACTS.md).
   Run: npm test   (node --test tests/*.test.mjs)
   ============================================================ */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { REPO, CONFIG, fx, copyRepo, build, read, write, cleanup, json, editData, edit, extraPage, hashTree } from "./helpers.mjs";

const { NAV_SLUGS } = await import(path.join(REPO, "build", "nav.mjs"));

test("the fixture builds: every page, asset, link, index entry and card contract", () => {
  const dir = copyRepo();
  try {
    const r = build(dir);
    assert.equal(r.status, 0, `build failed:\n${r.stderr}${r.stdout}`);
    assert.match(r.stdout, /✓ built \d+ pages → docs\//);
    const docs = path.join(dir, "docs");
    assert.ok(!fs.existsSync(path.join(dir, "docs.tmp")), "docs.tmp/ is cleaned up");
    const people = fx("people"), venues = fx("venues"), events = fx("events"), works = fx("works"), orgs = fx("orgs"), faqs = fx("faqs");
    for (const s of NAV_SLUGS) assert.ok(fs.existsSync(path.join(docs, `${s}.html`)), `missing docs/${s}.html`);
    for (const p of people) assert.ok(fs.existsSync(path.join(docs, "people", `${p.id}.html`)), `missing people/${p.id}.html`);
    for (const v of venues) assert.ok(fs.existsSync(path.join(docs, "venues", `${v.id}.html`)), `missing venues/${v.id}.html`);
    for (const f of ["404.html", "sitemap.xml", "robots.txt", ".nojekyll", "assets/tokens.css", "assets/site.css", "assets/js/main.js", "assets/favicon.svg",
      "assets/data/search.json", "assets/data/events.json", "assets/data/works.json", "assets/fonts/newsreader-roman-latin.woff2", "assets/fonts/OFL-Newsreader.txt", "assets/map/basemap.svg", "assets/img/brand/mark.svg", "assets/img/brand/jeremy.png"]) {
      assert.ok(fs.existsSync(path.join(docs, f)), `missing docs/${f}`);
    }
    // the no-JS dark block ships with tokens.css
    assert.match(read(docs, "assets/tokens.css"), /@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme\]\)/);

    // search index: one entry per event, person, venue, work, org, faq, program page; every nav page reachable
    const idx = json(docs, "assets/data/search.json");
    assert.equal(idx.v, 1);
    const have = (k, id) => idx.items.some((e) => e.k === k && e.id === id);
    for (const e of events) assert.ok(have("ev", e.id), `search: event ${e.id}`);
    for (const p of people) assert.ok(have("pe", p.id), `search: person ${p.id}`);
    for (const v of venues) assert.ok(have("ve", v.id), `search: venue ${v.id}`);
    for (const w of works) assert.ok(have("wo", w.id), `search: work ${w.id}`);
    for (const o of orgs) assert.ok(have("or", o.id), `search: org ${o.id}`);
    for (const f of faqs) assert.ok(have("fq", f.id), `search: faq ${f.id}`);
    for (const s of NAV_SLUGS) assert.ok(idx.items.some((e) => e.u === `${s}.html`), `search: page ${s}`);

    // sitemap: every indexable page, index maps to siteBase
    const sitemap = read(docs, "sitemap.xml");
    assert.equal((sitemap.match(/<loc>/g) || []).length, NAV_SLUGS.length + people.length + venues.length);
    assert.ok(sitemap.includes(`<loc>${CONFIG.siteBase}</loc>`));

    // 404: every link absolute
    const nf = read(docs, "404.html");
    const rel = [...nf.matchAll(/\s(?:href|src)="([^"]+)"/g)].map((m) => m[1]).filter((u) => !/^(https?:|mailto:|#)/.test(u));
    assert.ok(rel.length > 10);
    for (const u of rel) assert.ok(u.startsWith(CONFIG.pathPrefix), `404.html link not absolute: ${u}`);
    assert.match(nf, /<meta name="robots" content="noindex">/);

    // every nav page: title, canonical, aria-current, exactly one h1, the boot script before CSS
    for (const s of NAV_SLUGS) {
      const html = read(docs, `${s}.html`);
      assert.match(html, /<title>[^<]+<\/title>/, `${s}: title`);
      assert.match(html, /<link rel="canonical" href="https:\/\//, `${s}: canonical`);
      assert.match(html.split('<nav class="sidebar"')[1].split("</nav>")[0], /aria-current="page"/, `${s}: active nav item`);
      assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, `${s}: one h1`);
      assert.ok(html.indexOf("data-phase") < html.indexOf("assets/tokens.css"), `${s}: boot before CSS`);
      assert.match(html, /<html lang="en" class="no-js"/);
    }

    // the event card contract (engine spec §4.8), on the schedule
    const sched = read(docs, "schedule.html");
    for (const e of events) {
      const card = sched.match(new RegExp(`<article class="ev" id="e-${e.id}"[^>]*>`));
      assert.ok(card, `schedule: card e-${e.id}`);
      for (const a of ["data-ev", "data-p", "data-kg", "data-day", "data-s", "data-e", "data-t", "data-free", "data-q"]) assert.match(card[0], new RegExp(`\\s${a}="`), `card ${e.id}: ${a}`);
      assert.ok(sched.includes(`href="schedule.html?e=${e.id}#e-${e.id}" data-open-event="${e.id}"`), `card ${e.id}: deep link`);
      assert.ok(sched.includes(`data-star="${e.id}"`), `card ${e.id}: star`);
    }
    // the dialogs' JSON has every event, with instants
    const ej = json(docs, "assets/data/events.json");
    assert.deepEqual(ej.events.map((e) => e.id).sort(), events.map((e) => e.id).sort());
    for (const e of ej.events) assert.ok(e.i.length && e.i.every(([d, s, en]) => /^\d{4}-\d\d-\d\d$/.test(d) && en > s), `events.json ${e.id}: instances`);
    assert.equal(json(docs, "assets/data/works.json").works.length, works.length);

    // no inline color anywhere in the output, and no color literal in site.css
    for (const f of ["index.html", "schedule.html", "people.html"]) assert.doesNotMatch(read(docs, f).replace(/<meta name="theme-color"[^>]*>/g, ""), /style="[^"]*#[0-9a-f]{3,8}/i);
    assert.doesNotMatch(read(docs, "assets/site.css").replace(/\/\*[\s\S]*?\*\//g, ""), /:\s*[^;{}]*#[0-9a-f]{3,8}\b/i);
  } finally { cleanup(dir); }
});

test("building twice gives byte-identical output", () => {
  const dir = copyRepo();
  try {
    assert.equal(build(dir).status, 0);
    const a = hashTree(path.join(dir, "docs"));
    assert.equal(build(dir).status, 0);
    assert.equal(hashTree(path.join(dir, "docs")), a);
  } finally { cleanup(dir); }
});

test("a failed build leaves the previous docs/ untouched", () => {
  const dir = copyRepo();
  try {
    assert.equal(build(dir).status, 0);
    const before = hashTree(path.join(dir, "docs"));
    editData("events", (a) => { a[0].venue_id = "nowhere"; })(dir);
    const r = build(dir);
    assert.notEqual(r.status, 0);
    assert.equal(hashTree(path.join(dir, "docs")), before);
    assert.ok(!fs.existsSync(path.join(dir, "docs.tmp")));
  } finally { cleanup(dir); }
});

test("an event may end after midnight, by 06:00", () => {
  const dir = copyRepo();
  try {
    editData("events", (a) => { const e = a.find((x) => !x.end_date && x.start); e.start = "21:00"; e.end = "02:00"; })(dir);
    const r = build(dir);
    assert.equal(r.status, 0, r.stderr);
  } finally { cleanup(dir); }
});

test("aliases resolve a free-text neighborhood to a hood and a location_text to a venue", () => {
  const dir = copyRepo();
  try {
    editData("venues", (a) => { const v = a.find((x) => x.id === "tql-stadium"); v.hood = null; v.neighborhood = "West-End"; })(dir);
    editData("events", (a) => { const e = a.find((x) => x.venue_id === "union-hall"); e.venue_id = null; e.location_text = "Union Hall (OTR)"; })(dir);
    const r = build(dir);
    assert.equal(r.status, 0, r.stderr);
    assert.match(read(dir, "docs/venues/tql-stadium.html"), /href="\.\.\/neighborhoods\.html#west-end"/);
    const ej = json(dir, "docs/assets/data/events.json");
    assert.ok(ej.events.some((e) => e.v === "union-hall" && e.lt === "Union Hall (OTR)"), "location_text resolved to union-hall");
  } finally { cleanup(dir); }
});

test("CW_OUT builds into a private directory and never touches docs/", () => {
  const dir = copyRepo();
  try {
    const r = build(dir, { CW_OUT: ".cache/out-test" });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /→ \.cache\/out-test\//);
    for (const f of ["index.html", "schedule.html", "assets/site.css", "assets/data/search.json"]) assert.ok(fs.existsSync(path.join(dir, ".cache/out-test", f)), `missing ${f}`);
    assert.ok(!fs.existsSync(path.join(dir, "docs")), "docs/ must not be written");
    assert.ok(!fs.existsSync(path.join(dir, ".cache/out-test.tmp")), "the temp dir is cleaned up");
    const bad = build(dir, { CW_OUT: "site" });
    assert.notEqual(bad.status, 0, "CW_OUT=site must be refused");
    assert.ok(fs.existsSync(path.join(dir, "site/css/tokens.css")), "sources untouched");
  } finally { cleanup(dir); }
});

test("the real data/ builds", { skip: !fs.existsSync(path.join(REPO, "data", "events.json")) && "data/ is empty" }, () => {
  const dir = copyRepo({ data: path.join(REPO, "data") });
  try {
    const r = build(dir);
    assert.equal(r.status, 0, `real data failed:\n${r.stderr}`);
  } finally { cleanup(dir); }
});

const ev0 = (fn) => editData("events", (a) => fn(a[0], a));
const BROKEN = [
  ["an unknown program", ev0((e) => { e.program = "nope"; }), `program: must be one of`],
  ["a dangling venue_id", ev0((e) => { e.venue_id = "nowhere-hall"; }), `unknown venue "nowhere-hall"`],
  ["a dangling person in event.people", ev0((e) => { e.people = [...e.people, "nobody-at-all"]; }), `unknown person "nobody-at-all"`],
  ["a bad date", ev0((e) => { e.date = "2026-13-40"; }), "must be a YYYY-MM-DD date"],
  ["a date outside the data window", ev0((e) => { e.date = "2026-12-01"; }), "outside the data window"],
  ["an end before its start (not after midnight)", ev0((e) => { e.start = "10:00"; e.end = "09:00"; e.end_date = null; }), "suspicious times"],
  ["an http:// URL", ev0((e) => { e.source_url = "http://startupcincyweek.com/"; }), "insecure link"],
  ["&amp; in a bio", editData("people", (a) => { a[0].bio = "Founder &amp; CEO."; }), "is plain text"],
  ["<b> in a description", ev0((e) => { e.description = "A <b>bold</b> claim."; }), "is plain text"],
  ["a duplicate id", editData("people", (a) => { a.push({ ...a[0] }); }), `duplicate id "${fx("people")[0].id}"`],
  ["a missing source_url", editData("venues", (a) => { delete a[0].source_url; }), "source_url: is required"],
  ["a lat outside the region", editData("venues", (a) => { const v = a.find((x) => x.lat != null); v.lat = 49.2; }), "outside the region bbox"],
  ["an unknown key (typo)", ev0((e) => { e.venueid = e.venue_id; }), `unknown key "venueid"`],
  ["a TBA string", ev0((e) => { e.room = "TBA"; }), "placeholder"],
  ["invalid JSON", (dir) => write(dir, "data/works.json", "[{,"), "invalid JSON"],
  ["a missing program token", edit("site/css/tokens.css", (s) => s.replace(/--prog-blink-tint:[^;]+;/g, "")), "--prog-blink-tint is missing"],
  ["a color literal in a partial", edit("site/css/40-schedule.css", (s) => `${s}\n.zz { color: #ff0000; }\n`), "color literal"],
  ["a font size under 12px", edit("site/css/40-schedule.css", (s) => `${s}\n.zz { font-size: 10px; }\n`), "under the 12px floor"],
  ["an orphan page module", (dir) => write(dir, "build/pages/zz-orphan.mjs", `export function pages() { return [{ path: "orphan.html", title: "O", description: "O.", body: () => "<h1>O</h1>" }]; }\n`), "orphan page"],
  ["a nav page with no producer", (dir) => fs.rmSync(path.join(dir, "build/pages/faq.mjs")), "nav page faq.html is not produced"],
  ["a broken internal link", extraPage("<h1>X</h1><a href=\"../nope.html\">x</a>"), "broken link ../nope.html"],
  ["a broken anchor", extraPage("<h1>X</h1><a href=\"../about.html#no-such-id\">x</a>"), `no id "no-such-id"`],
  ["an unknown query parameter", extraPage("<h1>X</h1><a href=\"../schedule.html?zz=1\">x</a>"), `unknown parameter "zz"`],
  ["href=\"#\"", extraPage("<h1>X</h1><a href=\"#\">x</a>"), `href="#"`],
  ["an external link without a new-tab note", extraPage("<h1>X</h1><a href=\"https://example.com/\">x</a>"), "needs target"],
  ["two h1 elements", extraPage("<h1>X</h1><h1>Y</h1>"), "has 2 <h1> elements"],
  ["an img without alt", extraPage("<h1>X</h1><img src=\"../assets/favicon.svg\" width=\"1\" height=\"1\">"), "needs alt"],
  ["a color in a style attribute", extraPage("<h1>X</h1><p style=\"color: #c00\">x</p>"), "color literal in style"],
  ["an unknown feature module", extraPage("<h1>X</h1>", `features: ["nope"]`), "has no site/js/features/nope.js"],
  ["a deep link naming nothing (?p=nope)", extraPage("<h1>X</h1><a href=\"../schedule.html?p=nope\">x</a>"), `bad value "nope" for "p"`],
  ["a deep link to an unknown event (?e=)", extraPage("<h1>X</h1><a href=\"../schedule.html?e=scw-no-such-event#main\">x</a>"), `bad value "scw-no-such-event" for "e"`],
  ["a broken srcset", extraPage("<h1>X</h1><img src=\"../assets/favicon.svg\" srcset=\"../assets/img/w/nope-960.webp 960w\" alt=\"\" width=\"1\" height=\"1\">"), "broken link ../assets/img/w/nope-960.webp"],
  ["a font url() that does not resolve", edit("site/css/tokens.css", (s) => s.replace(/url\((['"]?)fonts\/public-sans-roman-latin\.woff2/, "url($1fonts/nope.woff2")), "does not resolve"],
  ["a placeholder inside a title", ev0((e) => { e.title = "Keynote speaker TBA"; }), `contains the placeholder "TBA"`],
  ["a wrong-typed list (no crash, a message)", ev0((e) => { e.people = "jane-doe"; }), "people: must be an array"],
  ["a search entry that does not resolve", (dir) => write(dir, "build/pages/zz-search.mjs", `export function pages() { return []; }\nexport function search() { return [{ k: "pg", id: "zz", t: "ZZ", u: "zz-nowhere.html" }]; }\n`), "assets/data/search.json"],
];

for (const [name, mutate, expected] of BROKEN) {
  test(`fails loudly on ${name}`, () => {
    const dir = copyRepo();
    try {
      mutate(dir);
      const r = build(dir);
      assert.notEqual(r.status, 0, `expected the build to fail on ${name}`);
      assert.ok(r.stderr.includes(expected), `stderr should mention ${JSON.stringify(expected)}:\n${r.stderr}`);
      assert.ok(!fs.existsSync(path.join(dir, "docs")), "a failed build must not write docs/");
      assert.ok(!fs.existsSync(path.join(dir, "docs.tmp")), "a failed build cleans up docs.tmp/");
    } finally { cleanup(dir); }
  });
}
