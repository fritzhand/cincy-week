/* ============================================================
   site/js/lib/geo.js · OWNER: Agent E (map, venues & visit) · PURE (no DOM)
   STUB landed by Agent A so imports resolve from day one. The API below
   is the contract (engine spec §4.8); Agent E owns and may rewrite it,
   and owns tests/geo.test.mjs.
   ============================================================ */
const R = 6371008.8; // mean Earth radius, m
const rad = (d) => (d * Math.PI) / 180;

/** Great-circle distance in meters between {lat,lng} points. */
export function haversine(a, b) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Walking estimate in whole minutes: straight line × 1.3 detour ÷ 80 m/min (always labelled an estimate). */
export const walkMinutes = (a, b) => Math.max(1, Math.round((haversine(a, b) * 1.3) / 80));

/** Equirectangular projection into a basemap's viewBox units.
 *  meta = { bbox: { s, n, w, e }, k: cos(lat0), sx: scale, W, H } (site/map meta / data/map.json). */
export function project(lat, lng, meta) {
  return [(lng - meta.bbox.w) * meta.k * meta.sx, (meta.bbox.n - lat) * meta.sx];
}

export const bboxContains = (b, lat, lng) => lat >= b.s && lat <= b.n && lng >= b.w && lng <= b.e;
