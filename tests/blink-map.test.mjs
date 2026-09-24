/* tests/blink-map.test.mjs · BLINK's official folding map (2026-09-24)
   1. The additive schema: works.map_no / aliases / also_sources / approx_m, places kind "facility" (facility, program,
      zone, map_no), programs.maps; what the build rejects about them; where the pages show them ("BLINK map No. 29",
      the Facilities layer, getting-around.html#blink-facilities, the BLINK page's official-map section).
   2. scripts/apply-blink-map.mjs on a copy of the real data/: idempotent (a second run changes nothing), it restores
      what it owns when that is undone, every printed number ends up on a work or a facility, and no id disappears; and
      in data/, every numbered work's title and by-line read as printed (the verification pass, 2026-09-24).
      Skipped when data/ is not the merged research or the extracted map is missing. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { copyRepo, build, read, json, editData, cleanup, REPO, hashTree } from "./helpers.mjs";

const PDF = "https://www.blinkcincinnati.com/files/assets/2026blinkfoldingmapmap.pdf";

/** the fixture plus one numbered work, one facility and BLINK's map */
const withMap = (dir) => {
  editData("programs", (a) => { a.find((p) => p.id === "blink").maps = [{ label: "BLINK 2026 folding map (PDF)", url: PDF, as_of: "2026-09-23" }]; })(dir);
  editData("works", (a) => {
    const w = a.find((x) => x.id === "blink-in-light-of-us");
    Object.assign(w, { map_no: 40, aliases: ["In Light of Them"], also_sources: [PDF] });
  })(dir);
  editData("places", (a) => {
    a.push({ id: "blink-map-restrooms-test-1", kind: "facility", name: "Restrooms", short_name: null, summary: null, details: null, address: null, hood: "downtown-cbd",
      lat: 39.1041, lng: -84.5125, approx_m: 60, url: null, facility: "restroom", program: "blink", zone: "Fountain District", map_no: null, source_url: PDF });
    // on BLINK's online map only (no PDF among its sources): getting-around lists it, the official-map section does not
    a.push({ id: "blink-restroom-online-only", kind: "facility", name: "Restroom", short_name: null, summary: "Restroom", details: "Walnut & Central", address: null, hood: "downtown-cbd",
      lat: 39.1069, lng: -84.5131, url: null, facility: "restroom", program: "blink", zone: "Fountain District", map_no: null, source_url: "https://www.blinkcincinnati.com/map" });
    a.push({ id: "blink-oasis-test", kind: "facility", name: "Oasis Station: Test Hall", short_name: null, summary: "Indoor restrooms and facilities", details: null, address: null, hood: "over-the-rhine",
      lat: 39.1093, lng: -84.5186, url: null, facility: "oasis-station", program: "blink", zone: "Over the Rhine", map_no: 22, source_url: PDF });
  })(dir);
};

test("schema: map numbers, facilities and the program's map build and show up where readers look", () => {
  const dir = copyRepo();
  try {
    withMap(dir);
    const r = build(dir);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const art = read(dir, "docs/art.html");
    assert.match(art, /<span class="mapno">BLINK map No\. 40<\/span>/, "the work card names its map number in words");
    assert.match(art, /works are in the order of <a[^>]+href="https:\/\/www\.blinkcincinnati\.com\/files\/assets\/2026blinkfoldingmapmap\.pdf"/, "art.html credits the map");
    const works = json(dir, "docs/assets/data/works.json").works;
    const w = works.find((x) => x.id === "blink-in-light-of-us");
    assert.equal(w.mn, 40); assert.deepEqual(w.ak, ["In Light of Them"]); assert.deepEqual(w.as, [PDF]);
    const extra = json(dir, "docs/assets/data/art-extra.json");
    assert.deepEqual(extra.programs.blink.map, ["BLINK 2026 folding map (PDF)", PDF]);
    const ga = read(dir, "docs/getting-around.html");
    assert.match(ga, /id="blink-facilities"/);
    assert.match(ga, /<li class="fac" id="blink-oasis-test">/);
    assert.match(ga, /BLINK map No\. 22/);
    assert.match(ga, /Approximate position \(about ±60 m\)/, "a position read off the printed map says so");
    assert.match(ga, /href="map\.html\?focus=facility:blink-oasis-test"/);
    const map = read(dir, "docs/map.html");
    assert.match(map, /data-layer="facilities"/, "the Facilities layer chip");
    assert.match(map, /data-id="facility:blink-map-restrooms-test-1"[^>]*data-layer="facilities"/);
    assert.match(map, /data-mn="BLINK map No\. 22"/);
    assert.match(map, /data-lg="facilities"/, "the legend entry");
    const blink = read(dir, "docs/blink.html");
    assert.match(blink, /id="official-map"/);
    assert.match(blink, /Official map<\/dt><dd><a[^>]+href="https:\/\/www\.blinkcincinnati\.com\/files\/assets\/2026blinkfoldingmapmap\.pdf"/, "the facts name the map");
    // the official-map section counts only what the printed map shows (verification 2026-09-24)
    const sec = /<section[^>]*id="official-map"[\s\S]*?<\/section>/.exec(blink)[0];
    assert.match(sec, /2 facilities/, "the kicker counts the two facilities that cite the map");
    assert.match(sec, /Restrooms<\/span><span class="label faint">1<\/span>/, "the online-only restroom is not counted");
    assert.match(ga, /id="blink-restroom-online-only"/, "getting-around still lists it");
    const search = json(dir, "docs/assets/data/search.json").items;
    assert.ok(search.some((x) => x.k === "pl" && x.id === "blink-oasis-test" && /Oasis Station/.test(x.s)), "facilities are searchable");
  } finally { cleanup(dir); }
});

const BROKEN = [
  ["a facility that does not say which", (a) => { a.find((p) => p.id === "blink-oasis-test").facility = null; }, /blink-oasis-test\.facility: is required for kind "facility"/],
  ["a facility kind on another place", (a) => { a.find((p) => p.id === "brown-bear-bakery").facility = "restroom"; }, /brown-bear-bakery\.facility: is only for kind "facility"/],
  ["an unknown facility", (a) => { a.find((p) => p.id === "blink-oasis-test").facility = "porta-potty"; }, /blink-oasis-test\.facility: must be one of/],
  ["a map number of 0", (a) => { a.find((p) => p.id === "blink-oasis-test").map_no = 0; }, /blink-oasis-test\.map_no: must be 1 or more/],
  ["an estimate with no position", (a) => { const p = a.find((x) => x.id === "blink-map-restrooms-test-1"); p.lat = null; p.lng = null; }, /blink-map-restrooms-test-1\.approx_m: is set but the record has no coordinates/],
];
for (const [name, fn, re] of BROKEN) {
  test(`schema rejects ${name}`, () => {
    const dir = copyRepo();
    try {
      withMap(dir);
      editData("places", fn)(dir);
      const r = build(dir);
      assert.notEqual(r.status, 0, "the build must fail");
      assert.match(r.stderr + r.stdout, re);
      assert.ok(!fs.existsSync(path.join(dir, "docs")), "nothing is written");
    } finally { cleanup(dir); }
  });
}

/* ---------------------------------------------------------------- the apply script, on a copy of the real data */
const DATA = path.join(REPO, "data");
const merged = fs.existsSync(path.join(DATA, "README.md")) && /^# data\/ — the merged research/.test(fs.readFileSync(path.join(DATA, "README.md"), "utf8"));
const MAPJSON = path.join(REPO, "research", "blink-map", "blink-map-2026.json");
const skip = (!merged && "data/ is not the merged research") || (!fs.existsSync(MAPJSON) && "research/blink-map is missing") || false;
const run = (data, ...args) => spawnSync(process.execPath, ["scripts/apply-blink-map.mjs", "--data", data, "--quiet", ...args], { cwd: REPO, encoding: "utf8" });
const D = (dir, f) => JSON.parse(fs.readFileSync(path.join(dir, `${f}.json`), "utf8"));
const W = (dir, f, v) => fs.writeFileSync(path.join(dir, `${f}.json`), JSON.stringify(v, null, 2) + "\n");

test("apply-blink-map: idempotent, every printed number placed, no id lost", { skip }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cw-blinkmap-"));
  try {
    fs.cpSync(DATA, tmp, { recursive: true });
    const ids0 = Object.fromEntries(["works", "events", "venues", "places"].map((f) => [f, D(tmp, f).map((r) => r.id)]));
    const r1 = run(tmp);
    assert.equal(r1.status, 0, r1.stderr + r1.stdout);
    const h1 = hashTree(tmp);
    const r2 = run(tmp);
    assert.equal(r2.status, 0, r2.stderr);
    assert.match(r2.stdout, /files that changed: none/);
    assert.equal(hashTree(tmp), h1, "a second run writes nothing");
    assert.equal(run(tmp, "--check").status, 0, "--check agrees");
    for (const [f, ids] of Object.entries(ids0)) { const now = new Set(D(tmp, f).map((r) => r.id)); for (const id of ids) assert.ok(now.has(id), `data/${f}.json#${id} is still there`); }
    const map = JSON.parse(fs.readFileSync(MAPJSON, "utf8"));
    const placed = new Set([...D(tmp, "works"), ...D(tmp, "places")].map((r) => r.map_no).filter((n) => n != null));
    for (const e of map.entries) assert.ok(placed.has(e.n), `No. ${e.n} "${e.title}" is on a work or a facility`);
    const works = D(tmp, "works");
    for (const w of works.filter((x) => x.map_no != null)) {
      assert.ok(w.source_url === map.source_url || (w.also_sources || []).includes(map.source_url), `${w.id} cites the map`);
      assert.match(w.notes || "", /BLINK official map \(2026-09-24\):.*\[\/BLINK map\]/, `${w.id} says why in its notes`);
    }
    const venues = D(tmp, "venues");
    for (const id of ["blink-ohio-river-drone-show", "court-street-plaza"]) assert.ok(venues.find((v) => v.id === id).lat != null, `${id} has coordinates`);
    assert.equal(D(tmp, "places").filter((p) => p.kind === "facility").length >= 30, true, "the facilities are in");
  } finally { cleanup(tmp); }
});

test("apply-blink-map: every numbered work reads as printed (title and by-line), apart from the named exceptions", { skip }, () => {
  const map = JSON.parse(fs.readFileSync(MAPJSON, "utf8"));
  const works = D(DATA, "works"), people = new Map(D(DATA, "people").map((p) => [p.id, p.name]));
  const join = (a) => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);
  const KEEP = new Set([38, 46]);   // the bold line names a maker (scripts/apply-blink-map.mjs KEEP_TITLE)
  let checked = 0;
  for (const e of map.entries) {
    const ws = works.filter((w) => w.map_no === e.n);
    const parts = e.parts || [{ title: e.title, credit: e.credit }];
    for (const pt of parts) {
      const w = ws.length === 1 ? ws[0] : ws.find((x) => x.title === pt.title);   // No. 25 prints two works
      if (!w) continue;   // a facility (Oasis Stations, the merch shop, No. 67)
      checked++;
      if (!(pt.title === "Mural" && /^Mural by /.test(w.title)) && !KEEP.has(e.n)) assert.equal(w.title, pt.title, `No. ${e.n}: the printed title`);
      const by = w.artist_text || join((w.artists || []).map((a) => people.get(a)).filter(Boolean));
      if (pt.credit && e.n !== 38) assert.equal(by, pt.credit, `No. ${e.n}: the by-line is the printed credit`);
    }
  }
  assert.equal(checked, works.filter((w) => w.map_no != null).length, "every numbered work was checked");
});

test("apply-blink-map: undoing what it owns and re-running restores the same bytes", { skip }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cw-blinkmap-"));
  try {
    fs.cpSync(DATA, tmp, { recursive: true });
    assert.equal(run(tmp).status, 0);
    const h1 = hashTree(tmp);
    const works = D(tmp, "works");
    const w = works.find((x) => x.map_no === 36);
    w.title = w.aliases[0]; delete w.map_no; delete w.aliases;
    // (the last work and the last facility the script adds, so re-adding them at the end restores the file order)
    W(tmp, "works", works.filter((x) => x.id !== "blink-beyond-the-bridge"));
    W(tmp, "places", D(tmp, "places").filter((p) => p.id !== "blink-map-hospitality-zone-covington"));
    const r = run(tmp);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(hashTree(tmp), h1, "the map's values, the new work and the facility come back exactly");
  } finally { cleanup(tmp); }
});
