/* ============================================================
   build/pages/map.mjs · OWNER: Agent E (map, venues & visit)
   STUB landed by Agent A: the token-themed basemap as a static figure and
   the numbered list of mapped venues. Agent E replaces it with the full
   map (layers, pins, clusters, selection sheet; engine spec §4.10).
   ============================================================ */
import { stubPage } from "./_stub.mjs";

export function pages(ctx) {
  const { db, cards, h } = ctx;
  const mapped = db.venues.filter((v) => v.stall);
  const off = db.venues.filter((v) => !v.stall);
  return [stubPage(ctx, {
    slug: "map", title: "Map", num: 1, kicker: "Map",
    lede: "Every venue with a confirmed address, numbered like market stalls. The same numbers appear in the venue list.",
    what: "The interactive map (pan and zoom, program layers, art and stays, directions from each pin) is coming to this page.",
    owner: "map", features: ["map"],
    body: (root) => `<figure class="map-box"><div class="map-bar"><span class="label">Downtown, Over-the-Rhine and the riverfront</span></div><div class="map-view"><svg class="map-base" viewBox="0 0 ${db.map?.projection?.viewBox?.join(" ") || "600 641"}" role="img" aria-label="Basemap of central Cincinnati and Covington"><use href="${root}assets/map/basemap.svg#bm"/></svg></div><figcaption class="map-legend">${h.extLink("https://www.openstreetmap.org/copyright", "© OpenStreetMap contributors", "map-attrib")}</figcaption></figure>
<h2 class="sub-h">${mapped.length} venues on the map</h2>
<ul class="venues">${mapped.map((v) => cards.venueCard(root, v)).join("")}</ul>
${off.length ? `<h2 class="sub-h">Not on the map (${off.length})</h2><ul class="venues">${off.map((v) => cards.venueCard(root, v).replace(` id="v-${v.id}"`, "")).join("")}</ul>` : ""}`,
  })];
}
