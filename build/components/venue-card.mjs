/* ============================================================
   build/components/venue-card.mjs · OWNER: Agent E (map, venues & visit)
   Landed by Agent A as a working stub; Agent E owns it.

   makeVenueCards(ctx) → {
     venueCard(root, venue)                 li.venue[data-prog] row with its stall number (DESIGN.md §9.7)
     miniMap(root, lat, lng, { prog, n, label })  a crop of the shared basemap via <use href="…basemap.svg#bm">
                                                   plus one pin; plain SVG, works without JS
     directions(lat, lng)                   { apple, google } walking-direction URLs
   }
   ============================================================ */
import { esc, attr, extLink } from "../core/util.mjs";
import { icon } from "../core/icons.mjs";
import { project } from "../../site/js/lib/geo.js";

export function makeVenueCards(ctx) {
  const { db, h, c } = ctx;
  const meta = db.map && db.map.projection && db.map.bbox ? { bbox: db.map.bbox.core, k: db.map.projection.k, sx: db.map.projection.sx, W: db.map.projection.viewBox[0], H: db.map.projection.viewBox[1] } : null;

  const directions = (lat, lng) => ({
    apple: `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=w`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`,
  });

  function miniMap(root, lat, lng, { prog = "also", n = "", label = "" } = {}) {
    if (!meta || lat == null) return `<p class="unk">Not on the map: the address is not listed</p>`;
    const [x, y] = project(lat, lng, meta);
    if (x < 0 || y < 0 || x > meta.W || y > meta.H) return `<p class="unk">Outside the map area</p>`;
    return `<div class="mini-map"${label ? ` role="img" aria-label="${attr(label)}"` : ""}><svg viewBox="${(x - 80).toFixed(1)} ${(y - 60).toFixed(1)} 160 120" aria-hidden="true" focusable="false"><use href="${root}assets/map/basemap.svg#bm"/></svg><span class="pin pin-venue" data-prog="${prog}" style="left: 50%; top: 50%"><span>${esc(n)}</span></span></div>`;
  }

  function venueCard(root, v) {
    const prog = v.programs[0] || "also";
    const hood = v.hood ? db.byId.place.get(v.hood) : null;
    const addr = [v.address, hood?.name || v.neighborhood].filter(Boolean).join(" · ");
    const roles = v.programs.map((p) => `<li>${h.bullet(p)}${esc(c.progName(p))}</li>`).join("");
    const d = v.lat != null ? directions(v.lat, v.lng) : null;
    return `<li class="venue" data-prog="${prog}" id="v-${attr(v.id)}" data-p="${attr(v.programs.join(" "))}" data-h="${attr(v.hood || "")}"><span class="stall${v.stall ? "" : " is-off"}" aria-hidden="true">${v.stall || "–"}</span><h3><a href="${root}venues/${attr(v.id)}.html">${esc(v.name)}</a></h3>${addr ? `<p class="addr">${esc(addr)}</p>` : ""}${roles ? `<ul class="roles">${roles}</ul>` : ""}${v.events.length ? `<p class="today"><b>${v.events.length} event${v.events.length === 1 ? "" : "s"}</b> this week</p>` : ""}${d ? `<div class="acts">${extLink(d.google, `${icon("walk")}Walking directions`, "btn btn-secondary btn-sm")}</div>` : `<p class="today"><span class="badge badge-unconfirmed">Address unconfirmed · not on the map</span></p>`}</li>`;
  }
  return { venueCard, miniMap, directions, meta };
}
