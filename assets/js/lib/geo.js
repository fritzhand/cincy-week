/* ============================================================
   site/js/lib/geo.js · OWNER: Agent E (map, venues & visit) · PURE (no DOM)
   Shared by the build (build/components/venue-card.mjs, build/pages/{map,venues,visit}.mjs,
   scripts/build-basemap.mjs), the client (features/map.js) and tests/geo.test.mjs.

   The map projection is equirectangular with cos(lat0) (engine spec §4.10), in basemap viewBox units:
     x = (lng − bbox.w) · k · sx        y = (bbox.n − lat) · sx        k = cos(lat0), sx = units per degree
   meta = { bbox: { s, n, w, e }, k, sx, W, H } — metaOf(data/map.json) builds it (plus home and mPerUnit).

   API: haversine, walkMinutes (estimate), METERS_PER_DEG_LAT, project, unproject, metaOf, bboxContains,
        onMap, crop (mini-map viewBox), compass, cluster (screen-space greedy), fitScale, clampView.
   ============================================================ */
const R = 6371008.8; // mean Earth radius, m
const rad = (d) => (d * Math.PI) / 180;
/** Meters per degree of latitude on the mean sphere (≈ 111,195 m). */
export const METERS_PER_DEG_LAT = (2 * Math.PI * R) / 360;

/** Great-circle distance in meters between {lat,lng} points. */
export function haversine(a, b) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Walking estimate in whole minutes: straight line × 1.3 detour ÷ 80 m/min (always labelled an estimate). */
export const walkMinutes = (a, b) => Math.max(1, Math.round((haversine(a, b) * 1.3) / 80));

/** Equirectangular projection into a basemap's viewBox units. meta = { bbox: { s, n, w, e }, k, sx, W, H }. */
export function project(lat, lng, meta) {
  return [(lng - meta.bbox.w) * meta.k * meta.sx, (meta.bbox.n - lat) * meta.sx];
}
/** The inverse of project: viewBox units → [lat, lng]. */
export function unproject(x, y, meta) {
  return [meta.bbox.n - y / meta.sx, meta.bbox.w + x / (meta.k * meta.sx)];
}

/** meta from data/map.json (or assets/data/map-meta.json): { bbox, home, k, sx, W, H, mPerUnit }. */
export function metaOf(m) {
  if (!m || !m.bbox || !m.bbox.core || !m.projection) return null;
  const { k, sx, viewBox } = m.projection;
  return { bbox: m.bbox.core, home: m.bbox.home || m.bbox.core, k, sx, W: viewBox[0], H: viewBox[1], mPerUnit: m.projection.mPerUnit || METERS_PER_DEG_LAT / sx };
}

export const bboxContains = (b, lat, lng) => lat >= b.s && lat <= b.n && lng >= b.w && lng <= b.e;
/** True when a point has coordinates and lies inside the basemap. */
export const onMap = (meta, lat, lng) => !!meta && lat != null && lng != null && bboxContains(meta.bbox, lat, lng);

/** A mini-map crop around a point: a viewBox `halfWidthM` meters each side (ratio w:h), kept inside the
 *  basemap, and where the point falls in it (percent). → { vb: [x, y, w, h], px, py } or null (off the map). */
export function crop(lat, lng, meta, { halfWidthM = 350, ratio = 4 / 3 } = {}) {
  if (!onMap(meta, lat, lng)) return null;
  const [x, y] = project(lat, lng, meta);
  const mPer = meta.mPerUnit || METERS_PER_DEG_LAT / meta.sx;
  const w = Math.min(meta.W, (2 * halfWidthM) / mPer), h = Math.min(meta.H, w / ratio);
  const x0 = Math.min(Math.max(0, x - w / 2), meta.W - w), y0 = Math.min(Math.max(0, y - h / 2), meta.H - h);
  const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
  return { vb: [r1(x0), r1(y0), r1(w), r1(h)], px: r2(((x - x0) / w) * 100), py: r2(((y - y0) / h) * 100) };
}

/** Compass word from a to b ({lat,lng}): "north", "northeast", … (8 points). */
export function compass(a, b) {
  const y = b.lat - a.lat, x = (b.lng - a.lng) * Math.cos(rad((a.lat + b.lat) / 2));
  const deg = (Math.atan2(x, y) * 180) / Math.PI;               // 0 = north, 90 = east
  const names = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
  return names[((Math.round(deg / 45) % 8) + 8) % 8];
}

/** Greedy screen-space clustering (DESIGN §9.7): points [{ x, y, ... }] in pixels, visited in the given order
 *  (put the most important first); a point within `radius` px of a group's seed joins that group.
 *  → [{ x, y, members }] where x, y is the members' centroid. */
export function cluster(points, radius = 44) {
  const groups = [];
  const cell = new Map();                                       // grid buckets keep this near O(n)
  const key = (cx, cy) => `${cx},${cy}`;
  for (const p of points) {
    const cx = Math.floor(p.x / radius), cy = Math.floor(p.y / radius);
    let hit = null, best = Infinity;
    for (let i = -1; i <= 1 && !hit; i++) for (let j = -1; j <= 1; j++) {
      for (const g of cell.get(key(cx + i, cy + j)) || []) { const d = Math.hypot(g.sx - p.x, g.sy - p.y); if (d < radius && d < best) { best = d; hit = g; } }
    }
    if (hit) hit.members.push(p);
    else { const g = { sx: p.x, sy: p.y, members: [p] }; groups.push(g); const kk = key(cx, cy); if (!cell.has(kk)) cell.set(kk, []); cell.get(kk).push(g); }
  }
  return groups.map((g) => ({ x: g.members.reduce((a, m) => a + m.x, 0) / g.members.length, y: g.members.reduce((a, m) => a + m.y, 0) / g.members.length, members: g.members }));
}

/** Pixels per unit that fits a box of units [x0, y0, x1, y1] into a vw × vh viewport with `pad` px around it. */
export function fitScale([x0, y0, x1, y1], vw, vh, pad = 40) {
  const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
  return Math.min((vw - 2 * pad) / w, (vh - 2 * pad) / h);
}

/** Keep a view { cx, cy, s } (center in units, s px per unit) inside the basemap: s ≥ the scale that covers the
 *  viewport, s ≤ max, and the center far enough from the edges that no empty space shows. */
export function clampView(v, vw, vh, meta, maxScale) {
  const minS = Math.max(vw / meta.W, vh / meta.H);
  const s = Math.min(Math.max(v.s, minS), Math.max(minS, maxScale));
  const hw = vw / s / 2, hh = vh / s / 2;
  const cx = Math.min(Math.max(v.cx, hw), meta.W - hw), cy = Math.min(Math.max(v.cy, hh), meta.H - hh);
  return { cx, cy, s };
}
