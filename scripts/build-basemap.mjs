#!/usr/bin/env node
/* ============================================================
   scripts/build-basemap.mjs · OWNER: Agent E (map, venues & visit)
   Dev-time only (zero dependencies, Node ≥ 18). OpenStreetMap → the token-themed basemap
   every map and mini-map uses (engine spec §4.10, DESIGN.md §9.7):

     .cache/osm/core.json    Overpass: roads (motorway … residential, pedestrian), parks, water, tram ways
     .cache/osm/water.json   Overpass: river areas (the Ohio and the Licking are multipolygon relations)
     .cache/osm/stops.json   Overpass: Connector streetcar stop positions
        ↓  clip to the core bbox (+ a margin), project (lib/geo.js), simplify, quantize
     site/map/basemap.svg    <svg viewBox="0 0 W H"><g id="bm"> with one <path> per layer
                             (m-water m-park m-minor m-tertiary m-primary(-casing) m-motorway(-casing) m-tram).
                             Paint is an inline style that references ONLY custom properties, so the map themes
                             when it is inlined and when it is referenced with <use href="…#bm"> (custom
                             properties inherit into the <use> shadow tree; stylesheet rules do not).
                             Line widths are screen pixels (vector-effect: non-scaling-stroke) times --mw, which
                             the interactive map sets per zoom level (default 1).
     data/map.json           { bbox: { core, home }, projection: { lat0, k, sx, scale, viewBox, mPerUnit },
                               labels: [{ text, lat, lng, kind, minZoom, angle? }], transit: { name, stops },
                               attribution, osm_timestamp, source_url }

   Every label string comes from an OpenStreetMap tag or from our own data files: the script checks each
   curated label against the OSM names and data/*.json text and fails on one it cannot find.

   Usage:
     node scripts/build-basemap.mjs            build from the cached Overpass responses in .cache/osm/
     node scripts/build-basemap.mjs --fetch    download them first (Overpass mirrors, one query per layer)
     node scripts/build-basemap.mjs --check    build in memory and report sizes; write nothing
   The build fails above 60 KB gzipped (the budget the site crawler also checks).
   OSM data © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright).
   ============================================================ */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { project, METERS_PER_DEG_LAT } from "../site/js/lib/geo.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = path.join(ROOT, ".cache", "osm");
const FETCH = process.argv.includes("--fetch");
const CHECK = process.argv.includes("--check");
const BUDGET_GZ_KB = 60;

/* ---------- the frame ---------- */
/** The basemap covers the core: Over-the-Rhine to the riverfront, the West End to Mount Adams, Covington and
 *  Newport (engine spec §4.10). `home` is the frame a map opens on (OTR, downtown and The Banks). */
export const CORE = { s: 39.075, n: 39.135, w: -84.545, e: -84.48 };
export const HOME = { s: 39.0905, n: 39.1195, w: -84.5335, e: -84.4985 };
const W = 1000;
const lat0 = (CORE.s + CORE.n) / 2;
const k = Math.cos((lat0 * Math.PI) / 180);
const sx = W / ((CORE.e - CORE.w) * k);
const H = Math.round((CORE.n - CORE.s) * sx);
const META = { bbox: CORE, k, sx, W, H };
const P = (lat, lon) => project(lat, lon, META);
const PAD = 24; // units kept beyond the frame so strokes and fills reach the edge

/* ---------- Overpass (only with --fetch) ---------- */
const MIRRORS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
const BB = `${CORE.s},${CORE.w},${CORE.n},${CORE.e}`;
const QUERIES = {
  core: `[out:json][timeout:180];(way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|pedestrian)$"](${BB});way["highway"~"^(footway|cycleway|path)$"]["bridge"]["name"](${BB});way["leisure"="park"](${BB});relation["leisure"="park"](${BB});way["natural"="water"](${BB});relation["natural"="water"](${BB});way["railway"="tram"](${BB}););out geom;`,
  water: `[out:json][timeout:120];(way["natural"="water"]["water"="river"](${BB});relation["natural"="water"]["water"="river"](${BB}););out geom;`,
  stops: `[out:json][timeout:60];node["railway"="tram_stop"](${BB});out;`,
};
async function overpass(name) {
  for (const url of MIRRORS) {
    try {
      process.stdout.write(`  ${name} ← ${new URL(url).host} … `);
      const r = await fetch(url, { method: "POST", headers: { "User-Agent": "cincy-week-basemap/1.0 (https://github.com/fritzhand/cincy-week)", "Content-Type": "application/x-www-form-urlencoded" }, body: "data=" + encodeURIComponent(QUERIES[name]), signal: AbortSignal.timeout(240000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (!Array.isArray(j.elements)) throw new Error("no elements");
      console.log(`${j.elements.length} elements`);
      return j;
    } catch (e) { console.log(`failed (${e.message})`); }
  }
  throw new Error(`every Overpass mirror failed for "${name}"`);
}
async function load(name) {
  const file = path.join(CACHE, `${name}.json`);
  if (FETCH) { fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(file, JSON.stringify(await overpass(name))); }
  if (!fs.existsSync(file)) { console.error(`Missing ${path.relative(ROOT, file)}. Run with --fetch to download it from Overpass.`); process.exit(1); }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/* ---------- geometry ---------- */
/** Douglas–Peucker on an open polyline. */
function dp(pts, eps) {
  if (pts.length < 3) return pts;
  let idx = 0, max = 0;
  const [x1, y1] = pts[0], [x2, y2] = pts[pts.length - 1];
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / L;
    if (d > max) { max = d; idx = i; }
  }
  if (max <= eps) return [pts[0], pts[pts.length - 1]];
  return [...dp(pts.slice(0, idx + 1), eps).slice(0, -1), ...dp(pts.slice(idx), eps)];
}
/** Douglas–Peucker on a closed ring: split at the farthest vertex first (plain DP collapses a closed ring,
 *  whose baseline has zero length: that is how the prototype lost the Ohio). */
function dpRing(pts, eps) {
  let far = 0, fd = -1;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > fd) { fd = d; far = i; } }
  if (far === 0) return pts;
  return [...dp(pts.slice(0, far + 1), eps).slice(0, -1), ...dp(pts.slice(far), eps)];
}
const inBox = ([x, y]) => x >= -PAD && x <= W + PAD && y >= -PAD && y <= H + PAD;
/** Split a projected polyline into the runs that fall inside the padded frame (one point of overhang each side). */
function clipLine(pts) {
  const runs = [];
  let cur = [];
  for (let i = 0; i < pts.length; i++) {
    const inside = inBox(pts[i]) || (i > 0 && inBox(pts[i - 1])) || (i < pts.length - 1 && inBox(pts[i + 1]));
    if (inside) cur.push(pts[i]);
    else if (cur.length) { runs.push(cur); cur = []; }
  }
  if (cur.length) runs.push(cur);
  return runs.filter((r) => r.length > 1);
}
/** Sutherland–Hodgman: clip a ring to the padded frame. */
function clipRing(ring) {
  const edges = [
    (p) => p[0] >= -PAD, (p) => p[0] <= W + PAD, (p) => p[1] >= -PAD, (p) => p[1] <= H + PAD,
  ];
  const cross = (a, b, i) => {
    const v = [-PAD, W + PAD, -PAD, H + PAD][i];
    if (i < 2) { const t = (v - a[0]) / (b[0] - a[0]); return [v, a[1] + t * (b[1] - a[1])]; }
    const t = (v - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), v];
  };
  let out = ring;
  for (let i = 0; i < 4 && out.length; i++) {
    const inp = out; out = [];
    for (let j = 0; j < inp.length; j++) {
      const a = inp[j], b = inp[(j + 1) % inp.length], ia = edges[i](a), ib = edges[i](b);
      if (ia) out.push(a);
      if (ia !== ib) out.push(cross(a, b, i));
    }
  }
  return out;
}
/** Join a relation's member ways into closed rings (end-to-end, either direction). */
function joinRings(ways) {
  const key = (p) => `${p.lat.toFixed(7)},${p.lon.toFixed(7)}`;
  const segs = ways.map((w) => w.slice());
  const rings = [];
  while (segs.length) {
    let ring = segs.shift(), grew = true;
    while (grew && key(ring[0]) !== key(ring[ring.length - 1])) {
      grew = false;
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i], end = key(ring[ring.length - 1]);
        if (key(s[0]) === end) ring = ring.concat(s.slice(1));
        else if (key(s[s.length - 1]) === end) ring = ring.concat(s.slice().reverse().slice(1));
        else if (key(s[s.length - 1]) === key(ring[0])) ring = s.concat(ring.slice(1));
        else if (key(s[0]) === key(ring[0])) ring = s.slice().reverse().concat(ring.slice(1));
        else continue;
        segs.splice(i, 1); grew = true; break;
      }
    }
    rings.push(ring);
  }
  return rings;
}

/* ---------- path encoding: absolute M, then relative l pairs, 0.5-unit grid ---------- */
const q = (v) => Math.round(v * 2) / 2;
const num = (v) => { const s = String(+v.toFixed(1)); return s.replace(/^0\./, ".").replace(/^-0\./, "-."); };
function encode(pts, close) {
  const p = [];
  for (const [x, y] of pts) { const r = [q(x), q(y)]; const last = p[p.length - 1]; if (!last || last[0] !== r[0] || last[1] !== r[1]) p.push(r); }
  if (p.length < 2 || (close && p.length < 3)) return "";
  let s = `M${num(p[0][0])} ${num(p[0][1])}l`;
  let prev = "";
  for (let i = 1; i < p.length; i++) {
    const pair = `${num(p[i][0] - p[i - 1][0])} ${num(p[i][1] - p[i - 1][1])}`;
    s += (i > 1 && !pair.startsWith("-") ? " " : "") + pair;
    prev = pair;
  }
  return s + (close ? "z" : "");
}

/* ---------- layers ---------- */
function classify(t) {
  if (t.natural === "water" || t.waterway === "riverbank") return t.amenity === "fountain" ? null : "water";
  if (t.leisure === "park") return "park";
  if (t.railway === "tram") return t.service ? null : "tram";   // yard and siding tracks are not the line
  const h = t.highway;
  if (!h) return null;
  if (/^(motorway|trunk)$/.test(h)) return "motorway";
  if (/^(primary|secondary)$/.test(h)) return "primary";
  if (h === "tertiary") return "tertiary";
  if (["residential", "unclassified", "living_street", "pedestrian"].includes(h)) return "minor";
  if (/^(footway|cycleway|path)$/.test(h) && t.bridge && t.name) return "minor"; // named pedestrian bridges
  return null;
}
const EPS = { water: 0.8, park: 0.8, minor: 0.6, tertiary: 0.6, primary: 0.6, motorway: 0.6, tram: 0.4 };
const MIN_AREA = { water: 30, park: 40 }; // square units: drop specks (fountains, tot lots) that would read as noise
const ringArea = (r) => Math.abs(r.reduce((a, p, i) => { const n = r[(i + 1) % r.length]; return a + p[0] * n[1] - n[0] * p[1]; }, 0) / 2);

function buildLayers(elements) {
  const L = { water: new Set(), park: new Set(), minor: new Set(), tertiary: new Set(), primary: new Set(), motorway: new Set(), tram: new Set() };
  const seen = new Set();
  const addRing = (layer, geom) => {
    const ring = clipRing(geom.map((g) => P(g.lat, g.lon)));
    if (ring.length < 3 || ringArea(ring) < MIN_AREA[layer]) return;
    const d = encode(dpRing(ring, EPS[layer]), true);
    if (d) L[layer].add(d);
  };
  for (const e of elements) {
    const key = `${e.type}/${e.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const c = classify(e.tags || {});
    if (!c) continue;
    const closed = c === "water" || c === "park";
    if (e.type === "way" && e.geometry) {
      if (closed) addRing(c, e.geometry);
      else for (const run of clipLine(e.geometry.map((g) => P(g.lat, g.lon)))) { const d = encode(dp(run, EPS[c]), false); if (d) L[c].add(d); }
    }
    if (e.type === "relation" && e.members && closed) {
      for (const role of ["outer", "inner"]) for (const r of joinRings(e.members.filter((m) => m.role === role && m.geometry).map((m) => m.geometry))) addRing(c, r);
    }
  }
  return L;
}

const W_ = (w) => `stroke-width:calc(${w}*var(--mw,1))`;
const PAINT = {
  park: "fill:var(--map-park)",
  water: "fill:var(--map-water);stroke:var(--map-water-edge);stroke-width:1",
  minor: `fill:none;stroke:var(--map-road-minor);${W_(1.6)};stroke-linecap:round;stroke-linejoin:round`,
  tertiary: `fill:none;stroke:var(--map-road);${W_(2.4)};stroke-linecap:round;stroke-linejoin:round`,
  "motorway-casing": `fill:none;stroke:var(--map-casing);${W_(6.4)};stroke-linecap:round;stroke-linejoin:round`,
  "primary-casing": `fill:none;stroke:var(--map-casing);${W_(5.2)};stroke-linecap:round;stroke-linejoin:round`,
  motorway: `fill:none;stroke:var(--map-road-major);${W_(4.4)};stroke-linecap:round;stroke-linejoin:round`,
  primary: `fill:none;stroke:var(--map-road-major);${W_(3.4)};stroke-linecap:round;stroke-linejoin:round`,
  tram: "fill:none;stroke:var(--map-rail);stroke-width:2.2;stroke-dasharray:6 4;stroke-linecap:butt",
};
function svgOf(L) {
  const layer = (cls, key) => { const d = [...L[key]].join(""); return d ? `<path class="m-${cls}" style="${PAINT[cls]}" vector-effect="non-scaling-stroke" d="${d}"/>` : ""; };
  const body = [
    layer("park", "park"), layer("water", "water"), layer("minor", "minor"), layer("tertiary", "tertiary"),
    layer("motorway-casing", "motorway"), layer("primary-casing", "primary"), layer("motorway", "motorway"), layer("primary", "primary"),
    layer("tram", "tram"),
  ].filter(Boolean).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><g id="bm"><rect width="${W}" height="${H}" style="fill:var(--map-bg)"/>\n${body}\n</g></svg>\n`;
}

/* ---------- labels ---------- */
const readData = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, "data", `${f}.json`), "utf8"));
const inCore = (lat, lng) => lat >= CORE.s && lat <= CORE.n && lng >= CORE.w && lng <= CORE.e;
const unproject = ([x, y]) => [CORE.n - y / sx, CORE.w + x / (k * sx)];
const round6 = (v) => Math.round(v * 1e6) / 1e6;
const normAngle = (a) => { let d = (a * 180) / Math.PI; while (d > 90) d -= 180; while (d <= -90) d += 180; return Math.round(d); };

/** Chain a name's ways end to end (either direction) into polylines, projected. */
function chains(elements, names) {
  const key = (p) => `${p.lat.toFixed(7)},${p.lon.toFixed(7)}`;
  const segs = elements.filter((e) => e.type === "way" && e.geometry && names.includes(e.tags?.name)).map((e) => e.geometry.slice());
  const out = [];
  while (segs.length) {
    let c = segs.shift(), grew = true;
    while (grew) {
      grew = false;
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        if (key(s[0]) === key(c[c.length - 1])) c = c.concat(s.slice(1));
        else if (key(s[s.length - 1]) === key(c[c.length - 1])) c = c.concat(s.slice().reverse().slice(1));
        else if (key(s[s.length - 1]) === key(c[0])) c = s.concat(c.slice(1));
        else if (key(s[0]) === key(c[0])) c = s.slice().reverse().concat(c.slice(1));
        else continue;
        segs.splice(i, 1); grew = true; break;
      }
    }
    out.push(c.map((g) => P(g.lat, g.lon)));
  }
  return out;
}
const lenOf = (pts) => { let n = 0; for (let i = 1; i < pts.length; i++) n += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return n; };
/** Points along a polyline at the given arc lengths, with the local direction. */
function pointsAlong(pts, at) {
  const out = [];
  let acc = 0, j = 0;
  for (let i = 1; i < pts.length && j < at.length; i++) {
    const a = pts[i - 1], b = pts[i], s = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (j < at.length && at[j] <= acc + s) {
      const f = s ? (at[j] - acc) / s : 0;
      const [lat, lng] = unproject([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
      out.push({ lat: round6(lat), lng: round6(lng), angle: normAngle(Math.atan2(b[1] - a[1], b[0] - a[0])) });
      j++;
    }
    acc += s;
  }
  return out;
}
/** Label positions for a named way: the longest run of each chain inside the frame, one label every `every`
 *  units (at least one, at the middle), skipping runs shorter than `min`. */
function along(elements, names, { frame = inBox, every = 0, min = 40 } = {}) {
  const res = [];
  for (const c of chains(elements, names)) {
    // the runs of the chain inside the frame
    let run = [];
    const runs = [];
    for (const p of c) { if (frame(p)) run.push(p); else if (run.length) { runs.push(run); run = []; } }
    if (run.length) runs.push(run);
    for (const r of runs) {
      const len = lenOf(r);
      if (len < min) continue;
      const n = every ? Math.max(1, Math.floor(len / every)) : 1;
      const at = Array.from({ length: n }, (_, i) => (len * (i + 0.5)) / n);
      for (const p of pointsAlong(r, at)) res.push({ ...p, len });
    }
  }
  return res.sort((a, b) => b.len - a.len);
}

/** A point inside the largest water ring along a vertical line at `lng` (for the river's name). */
function riverPoint(elements, lng) {
  const x = P(CORE.n, lng)[0];
  let best = null;
  const rings = [];
  for (const e of elements) {
    if (classify(e.tags || {}) !== "water") continue;
    if (e.type === "way" && e.geometry) rings.push(e.geometry.map((g) => P(g.lat, g.lon)));
    if (e.type === "relation" && e.members) for (const r of joinRings(e.members.filter((m) => m.role === "outer" && m.geometry).map((m) => m.geometry))) rings.push(r.map((g) => P(g.lat, g.lon)));
  }
  for (const ring of rings) {
    const ys = [];
    for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; if ((a[0] <= x) !== (b[0] <= x)) ys.push(a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1])); }
    ys.sort((m, n) => m - n);
    for (let i = 0; i + 1 < ys.length; i += 2) { const w = ys[i + 1] - ys[i]; if (!best || w > best.w) best = { w, y: (ys[i] + ys[i + 1]) / 2 }; }
  }
  return best ? { x, y: best.y, w: best.w } : null;
}

function buildLabels(elements, dataText) {
  const out = [];
  const osmNames = new Set(elements.map((e) => e.tags?.name).filter(Boolean));
  const verify = (text) => { if (!osmNames.has(text) && !dataText.includes(text)) throw new Error(`label "${text}" is neither an OpenStreetMap name nor in data/*.json`); return text; };

  // neighborhoods: our places.json records (their points are OpenStreetMap place nodes)
  const CORE_HOODS = new Set(["over-the-rhine", "downtown-cbd", "the-banks", "findlay-market-district", "pendleton", "west-end", "covington", "mainstrasse-village", "newport"]);
  for (const p of readData("places").filter((x) => x.kind === "neighborhood" && x.lat != null && inCore(x.lat, x.lng))) {
    const text = verify(p.name.includes("(") || p.name.includes(",") ? p.short_name || p.name.replace(/\s*[(,].*$/, "") : p.name);
    out.push({ text, lat: p.lat, lng: p.lng, kind: "hood", minZoom: CORE_HOODS.has(p.id) ? 1 : 1.6, id: p.id });
  }
  // the rivers
  for (const [text, lng] of [["Ohio River", -84.527], ["Ohio River", -84.488]]) {
    const at = riverPoint(elements, lng);
    if (!at) continue;
    const a = riverPoint(elements, lng - 0.004), b = riverPoint(elements, lng + 0.004);
    const angle = a && b ? normAngle(Math.atan2(b.y - a.y, b.x - a.x)) : 0;
    const [lat, lg] = unproject([at.x, at.y]);
    out.push({ text: verify(text), lat: round6(lat), lng: round6(lg), kind: "water", minZoom: lng > -84.5 ? 1.6 : 1, angle });
  }
  out.push({ text: verify("Kentucky"), lat: 39.0795, lng: -84.531, kind: "state", minZoom: 1 });
  // parks, bridges and streets at their longest run inside the home frame (names as tagged in OpenStreetMap,
  // or as our data spells them)
  const PARKS = [["Washington Park", ["Washington Park"]], ["Smale Riverfront Park", ["John G. and Phyllis W. Smale Riverfront Park"]], ["Lytle Park", ["Lytle Park"]], ["Sawyer Point", ["Sawyer Point Park"]], ["Devou Park", ["Devou Park"]]];
  for (const [text, names] of PARKS) {
    const els = elements.filter((e) => e.tags?.leisure === "park" && names.includes(e.tags.name) && e.geometry);
    if (!els.length) continue;
    const pts = els.flatMap((e) => e.geometry.map((g) => P(g.lat, g.lon)));
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    if (!inBox([cx, cy])) continue;
    const [lat, lng] = unproject([cx, cy]);
    out.push({ text: verify(text), lat: round6(lat), lng: round6(lng), kind: "park", minZoom: 2.2 });
  }
  const BRIDGES = [["Roebling Suspension Bridge", ["John A. Roebling Suspension Bridge"]], ["Purple People Bridge", ["Purple People Bridge Way"]], ["Clay Wade Bailey Bridge", ["Clay Wade Bailey Bridge"]], ["Taylor–Southgate Bridge", ["Taylor–Southgate Bridge"]]];
  for (const [text, names] of BRIDGES) {
    const [a] = along(elements, names, { min: 20 });
    if (a) out.push({ text: verify(text), lat: a.lat, lng: a.lng, kind: "bridge", minZoom: 2.6, angle: a.angle });
  }
  const STREETS = ["Central Parkway", "Vine Street", "Main Street", "Elm Street", "Race Street", "Walnut Street", "Sycamore Street", "West Liberty Street", "East Liberty Street", "West 5th Street", "East 5th Street", "West 12th Street", "West Freedom Way", "West Mehring Way", "Madison Avenue", "Gilbert Avenue", "Reading Road", "Eggleston Avenue", "Ezzard Charles Drive", "Court Street", "West Court Street"];
  for (const s of STREETS) {
    for (const a of along(elements, [s], { every: 240, min: 60 }).slice(0, 4)) out.push({ text: verify(s), lat: a.lat, lng: a.lng, kind: "street", minZoom: 3.2, angle: a.angle });
  }
  return out;
}

/* ---------- go ---------- */
const core = await load("core");
const water = await load("water");
const stops = await load("stops");
const elements = [...core.elements, ...water.elements];
const L = buildLayers(elements);
const svg = svgOf(L);
const dataText = fs.readdirSync(path.join(ROOT, "data")).filter((f) => f.endsWith(".json") && f !== "map.json").map((f) => fs.readFileSync(path.join(ROOT, "data", f), "utf8")).join("\n");
const labels = buildLabels(elements, dataText);

const byRef = new Map();
for (const n of stops.elements.filter((x) => x.type === "node" && x.tags?.name && inCore(x.lat, x.lon))) {
  const ref = n.tags.ref || n.tags.name;
  if (!byRef.has(ref)) byRef.set(ref, { ref: n.tags.ref || null, name: n.tags.name, lat: round6(n.lat), lng: round6(n.lon) });
}
const mapJson = {
  bbox: { core: CORE, home: HOME },
  projection: { lat0, k, sx, scale: sx, viewBox: [W, H], mPerUnit: METERS_PER_DEG_LAT / sx },
  labels,
  transit: { name: "Connector", stops: [...byRef.values()].sort((a, b) => (Number(a.ref) || 99) - (Number(b.ref) || 99)) },
  attribution: "© OpenStreetMap contributors",
  osm_timestamp: core.osm3s?.timestamp_osm_base || null,
  source_url: "https://www.openstreetmap.org/copyright",
};

const gz = zlib.gzipSync(Buffer.from(svg)).length / 1024;
const counts = Object.fromEntries(Object.entries(L).map(([a, b]) => [a, b.size]));
console.log(`basemap ${W}×${H} (${(svg.length / 1024).toFixed(1)} KB, ${gz.toFixed(1)} KB gzipped) · ${labels.length} labels · ${mapJson.transit.stops.length} stops`);
console.log(`  paths per layer: ${Object.entries(counts).map(([a, b]) => `${a} ${b}`).join(", ")}`);
if (gz > BUDGET_GZ_KB) { console.error(`✗ basemap.svg is ${gz.toFixed(1)} KB gzipped: over the ${BUDGET_GZ_KB} KB budget. Raise EPS or drop a layer.`); process.exit(1); }
if (CHECK) process.exit(0);
fs.writeFileSync(path.join(ROOT, "site", "map", "basemap.svg"), svg);
fs.writeFileSync(path.join(ROOT, "data", "map.json"), JSON.stringify(mapJson, null, 2) + "\n");
console.log("✓ wrote site/map/basemap.svg and data/map.json");
