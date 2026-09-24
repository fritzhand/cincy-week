/* tests/geo.test.mjs · OWNER: Agent E · site/js/lib/geo.js, data/map.json, site/map/basemap.svg,
   and the map, venue and visit pages built from the mini fixture. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { haversine, walkMinutes, project, unproject, metaOf, bboxContains, onMap, crop, compass, cluster, fitScale, clampView, METERS_PER_DEG_LAT } from "../site/js/lib/geo.js";
import { REPO, copyRepo, build, read, json, editData, cleanup } from "./helpers.mjs";

const MAP = JSON.parse(fs.readFileSync(path.join(REPO, "data", "map.json"), "utf8"));
const META = metaOf(MAP);
const UNION_HALL = { lat: 39.109898, lng: -84.515591 };
const FOUNTAIN_SQUARE = { lat: 39.101794, lng: -84.512811 };

test("haversine and the walking estimate", () => {
  const d = haversine(UNION_HALL, FOUNTAIN_SQUARE);
  assert.ok(d > 900 && d < 960, `Union Hall → Fountain Square is about 930 m, got ${d}`);   // research/stay-move walking.json: 0.93 km
  assert.equal(haversine(UNION_HALL, UNION_HALL), 0);
  assert.equal(walkMinutes(UNION_HALL, FOUNTAIN_SQUARE), Math.round((d * 1.3) / 80));
  assert.equal(walkMinutes(UNION_HALL, UNION_HALL), 1, "never zero minutes");
  assert.ok(Math.abs(METERS_PER_DEG_LAT - 111195) < 1);
});

test("data/map.json: the projection matches lib/geo.js and the basemap's viewBox", () => {
  assert.ok(META, "metaOf(map.json)");
  const { core, home } = MAP.bbox;
  assert.ok(home.s >= core.s && home.n <= core.n && home.w >= core.w && home.e <= core.e, "home frame inside the core bbox");
  assert.ok(Math.abs(MAP.projection.k - Math.cos((MAP.projection.lat0 * Math.PI) / 180)) < 1e-12, "k = cos(lat0)");
  assert.equal(MAP.projection.scale, MAP.projection.sx);
  const [x0, y0] = project(core.n, core.w, META), [x1, y1] = project(core.s, core.e, META);
  assert.ok(Math.abs(x0) < 1e-6 && Math.abs(y0) < 1e-6, "NW corner is 0,0");
  assert.ok(Math.abs(x1 - META.W) < 0.5 && Math.abs(y1 - META.H) < 0.6, "SE corner is W,H");
  const svg = fs.readFileSync(path.join(REPO, "site", "map", "basemap.svg"), "utf8");
  assert.match(svg, new RegExp(`viewBox="0 0 ${META.W} ${META.H}"`));
  assert.match(svg, /<g id="bm">/);
  // meters per unit agree with the projection: 1 km east ≈ 1000 / mPerUnit units
  const east = { lat: UNION_HALL.lat, lng: UNION_HALL.lng + 1000 / (METERS_PER_DEG_LAT * Math.cos((UNION_HALL.lat * Math.PI) / 180)) };
  const dx = project(east.lat, east.lng, META)[0] - project(UNION_HALL.lat, UNION_HALL.lng, META)[0];
  assert.ok(Math.abs(dx * META.mPerUnit - 1000) < 5, `1 km east = ${dx * META.mPerUnit} m on the map`);
});

test("project / unproject round-trip, bbox checks", () => {
  for (const p of [UNION_HALL, FOUNTAIN_SQUARE, { lat: 39.08, lng: -84.51 }]) {
    const [x, y] = project(p.lat, p.lng, META);
    const [lat, lng] = unproject(x, y, META);
    assert.ok(Math.abs(lat - p.lat) < 1e-9 && Math.abs(lng - p.lng) < 1e-9);
  }
  assert.ok(bboxContains(MAP.bbox.core, UNION_HALL.lat, UNION_HALL.lng));
  assert.ok(onMap(META, UNION_HALL.lat, UNION_HALL.lng));
  assert.equal(onMap(META, 39.76557, -84.2018), false, "Dayton Art Institute is off the basemap");
  assert.equal(onMap(META, null, null), false);
  assert.equal(onMap(null, UNION_HALL.lat, UNION_HALL.lng), false);
});

test("crop: a mini-map viewBox around a point, kept inside the basemap", () => {
  const c = crop(UNION_HALL.lat, UNION_HALL.lng, META, { halfWidthM: 350 });
  const [x, y, w, h] = c.vb;
  assert.ok(Math.abs(w * META.mPerUnit - 700) < 2, "700 m wide");
  assert.ok(Math.abs(w / h - 4 / 3) < 0.01);
  assert.ok(Math.abs(c.px - 50) < 0.1 && Math.abs(c.py - 50) < 0.1, "centered when away from the edges");
  // near the NW corner the crop is clamped and the pin moves off-center
  const nw = crop(MAP.bbox.core.n - 0.0005, MAP.bbox.core.w + 0.0005, META);
  assert.equal(nw.vb[0], 0); assert.equal(nw.vb[1], 0);
  assert.ok(nw.px < 20 && nw.py < 20);
  assert.equal(crop(39.76557, -84.2018, META), null);
});

test("compass words", () => {
  const o = { lat: 39.1, lng: -84.5 };
  assert.equal(compass(o, { lat: 39.11, lng: -84.5 }), "north");
  assert.equal(compass(o, { lat: 39.09, lng: -84.5 }), "south");
  assert.equal(compass(o, { lat: 39.1, lng: -84.49 }), "east");
  assert.equal(compass(o, { lat: 39.1, lng: -84.51 }), "west");
  assert.equal(compass(o, { lat: 39.107, lng: -84.491 }), "northeast");
});

test("cluster: pins closer than one hit area merge; others stay single", () => {
  const pts = [{ id: "a", x: 100, y: 100 }, { id: "b", x: 120, y: 110 }, { id: "c", x: 300, y: 100 }, { id: "d", x: 143, y: 100 }, { id: "e", x: 300, y: 150 }];
  const g = cluster(pts, 44);
  const sets = g.map((x) => x.members.map((m) => m.id).sort().join(""));
  assert.deepEqual(sets.sort(), ["abd", "c", "e"]);
  const abd = g.find((x) => x.members.length === 3);
  assert.equal(Math.round(abd.x), Math.round((100 + 120 + 143) / 3));
  assert.deepEqual(cluster([], 44), []);
  // the first point seeds its group (callers pass the most important pins first)
  assert.equal(cluster([{ id: "x", x: 0, y: 0 }, { id: "y", x: 10, y: 0 }], 44)[0].members[0].id, "x");
  // seeds are at least one radius apart, so no two single pins overlap
  const many = Array.from({ length: 200 }, (_, i) => ({ id: i, x: (i * 37) % 400, y: (i * 53) % 300 }));
  const out = cluster(many, 44).filter((x) => x.members.length === 1);
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) assert.ok(Math.hypot(out[i].x - out[j].x, out[i].y - out[j].y) >= 44, "two single pins never overlap");
  assert.equal(cluster(many, 44).reduce((n, x) => n + x.members.length, 0), 200, "every pin lands in exactly one group");
});

test("fitScale and clampView keep the view on the basemap", () => {
  assert.equal(fitScale([0, 0, 100, 50], 300, 200, 0), 3);
  assert.equal(fitScale([0, 0, 100, 50], 300, 200, 50), 2);
  const v = clampView({ cx: -500, cy: 99999, s: 0.0001 }, 400, 300, META, 4);
  const minS = Math.max(400 / META.W, 300 / META.H);
  assert.equal(v.s, minS, "never zoomed out past the basemap");
  assert.ok(v.cx >= 400 / v.s / 2 - 1e-9 && v.cy <= META.H - 300 / v.s / 2 + 1e-9, "no empty space at the edges");
  assert.equal(clampView({ cx: 500, cy: 500, s: 99 }, 400, 300, META, 4).s, 4, "max zoom");
});

test("basemap.svg: token-only paint, one path per layer, under budget", () => {
  const svg = fs.readFileSync(path.join(REPO, "site", "map", "basemap.svg"), "utf8");
  assert.doesNotMatch(svg, /#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i, "no color literals");
  for (const m of svg.matchAll(/style="([^"]+)"/g)) for (const decl of m[1].split(";")) if (/^(fill|stroke)$/.test(decl.split(":")[0])) assert.match(decl, /:(none|var\(--map-[a-z-]+\))$/, decl);
  for (const cls of ["m-water", "m-park", "m-minor", "m-tertiary", "m-primary", "m-motorway", "m-tram"]) assert.equal(svg.split(`class="${cls}"`).length - 1, 1, cls);
  assert.ok(zlib.gzipSync(svg).length / 1024 <= 60, "≤ 60 KB gzipped");
});

test("map.json labels come from OpenStreetMap or our data, inside the basemap", () => {
  const data = fs.readdirSync(path.join(REPO, "data")).filter((f) => f.endsWith(".json") && f !== "map.json").map((f) => fs.readFileSync(path.join(REPO, "data", f), "utf8")).join("\n");
  assert.ok(MAP.labels.length > 10);
  const kinds = new Set(MAP.labels.map((l) => l.kind));
  for (const k of ["hood", "water", "street"]) assert.ok(kinds.has(k), k);
  for (const l of MAP.labels) {
    assert.ok(onMap(META, l.lat, l.lng), `${l.text} is on the map`);
    assert.ok(l.minZoom >= 1);
    if (l.kind !== "street" && l.kind !== "bridge") assert.ok(data.includes(l.text), `"${l.text}" appears in data/`);
  }
  assert.equal(MAP.transit.stops.length, 18, "the Connector's 18 stops");
});

/* ---------- pages, built from the mini fixture ---------- */
test("fixture build: map, venue and visit pages", () => {
  const dir = copyRepo();
  try {
    // the fixture carries the design's small map.json: give it this repo's so stall numbers match the basemap
    fs.copyFileSync(path.join(REPO, "data", "map.json"), path.join(dir, "data", "map.json"));
    editData("venues", (a) => { a.push({ id: "far-gallery", name: "Far Gallery", aliases: [], address: "1 Main St", city: "Dayton", state: "OH", zip: null, neighborhood: null, hood: null, lat: 39.7656, lng: -84.2018, programs: ["also"], kind: "gallery", url: null, accessibility: null, source_url: "https://example.org/far" }); })(dir);
    const r = build(dir);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const venues = read(dir, "docs/venues.html");
    // every venue is in the HTML (no-JS), with its stall number, grouped by neighborhood
    const V = json(dir, "data/venues.json");
    for (const v of V) assert.match(venues, new RegExp(`id="v-${v.id}"`), v.id);
    assert.match(venues, /<li class="venue"[^>]*id="v-union-hall"[^>]*data-ll="39\.109898,-84\.515591" data-n="1"/);
    // a venue row runs from its id to the next venue row
    const rowOf = (id) => { const i = venues.indexOf(`id="v-${id}"`); const j = venues.indexOf('<li class="venue"', i); return venues.slice(i, j > -1 ? j : undefined); };
    assert.match(rowOf("far-gallery"), /Outside the map area/, "an off-map venue says so");
    assert.doesNotMatch(rowOf("far-gallery"), /data-ll=/, "and has no pin");
    assert.match(rowOf("caw-footprint-otr"), /Address unconfirmed · not on the map/);
    assert.match(venues, /data-filter-group="p"/);
    assert.match(venues, /<select[^>]+data-filter="day"/);
    assert.match(venues, /data-venue-views/);
    // venue page: facts, mini-map, directions, JSON-LD Place
    const uh = read(dir, "docs/venues/union-hall.html");
    assert.match(uh, /class="mini-map"[^>]*><svg viewBox="[\d. ]+"[^>]*><use href="\.\.\/assets\/map\/basemap\.svg#bm"\/>/);
    assert.match(uh, /https:\/\/maps\.apple\.com\/\?daddr=39\.109898,-84\.515591&amp;dirflg=w/);
    assert.match(uh, /"@type":"Place"/);
    assert.match(uh, /map\.html\?focus=venue:union-hall/);
    // the far venue has no stall number and no pin
    const far = read(dir, "docs/venues/far-gallery.html");
    assert.doesNotMatch(far, /class="mini-map"/);
    assert.match(far, /Outside the map area/);
    // map page: every layer listed without JS, the static fallback map, deep-linkable
    const map = read(dir, "docs/map.html");
    assert.match(map, /data-map-page/);
    assert.match(map, /data-id="venue:union-hall"/);
    assert.match(map, /data-id="stay:kinley-cincinnati-downtown"/);
    assert.match(map, /data-id="food:brown-bear-bakery"/);
    assert.match(map, /openstreetmap\.org\/copyright/);
    const meta = json(dir, "docs/assets/data/map-meta.json");
    assert.deepEqual(meta.projection.viewBox, MAP.projection.viewBox);
    // visit pages
    const stay = read(dir, "docs/stay.html");
    assert.match(stay, /CINTRIFUSEOCT/, "the group code as published");
    assert.match(stay, /estimate/i, "walking times are labeled estimates");
    const ga = read(dir, "docs/getting-around.html");
    assert.match(ga, /<table class="data walk"/);
    assert.match(read(dir, "docs/neighborhoods.html"), /schedule\.html\?h=over-the-rhine/);
    assert.match(read(dir, "docs/eat-drink.html"), /id="brown-bear-bakery"/);
  } finally { cleanup(dir); }
});
