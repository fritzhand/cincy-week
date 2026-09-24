#!/usr/bin/env node
/* scripts/build-basemap.mjs · OWNER: Agent E (map, venues & visit) · STUB landed by Agent A.
   Contract (engine spec §4.10): Overpass (mirror list, cached under .cache/osm/) → site/map/basemap.svg
   (<g id="bm">, one path per layer, paint only through inline var(--map-*) styles, no color literals)
   + data/map.json ({ bbox: { core, region }, projection: { k, sx, viewBox }, labels, transit, attribution,
   osm_timestamp }). Budget ≤ 60 KB gzipped. The committed basemap.svg and data/map.json are the
   design system's provisional versions (design/final/map). */
console.error("scripts/build-basemap.mjs has not landed yet (Agent E). The committed site/map/basemap.svg is provisional.");
process.exit(2);
