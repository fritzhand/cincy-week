/* ============================================================
   build/pages/map.mjs · OWNER: Agent E (map, venues & visit)
   map.html (engine spec §4.10, DESIGN.md §9.7): the full map. Everything on it is also in the server-rendered
   list (li.map-li[data-id="<kind>:<id>"][data-kind][data-ll][data-p][data-day][data-h][data-n]), grouped by
   layer, so the page reads without JS and the map is never the only path to anything. features/map.js reads
   that list to make the pins, and adds pan/zoom, clusters, layers (venues art stays transit food), program
   and day filters, the selection panel (a side panel on wide screens, a bottom sheet on phones), the edge
   chip, "Near me" and the ?layers ?p ?day ?focus deep links (build/nav.mjs PARAMS.map).
   Without JS the map box shows the basemap of the home frame with the numbered venue pins, not interactive.
   Data output: assets/data/map-meta.json = data/map.json (bbox, projection, labels, transit, attribution).
   ============================================================ */
import { sortBy } from "../core/util.mjs";
import { project, onMap } from "../../site/js/lib/geo.js";

export const LAYERS = [
  { id: "venues", label: "Venues", icon: "pin", on: true },
  { id: "art", label: "Art", icon: "light", on: true },
  { id: "stays", label: "Stays", icon: "bed", on: false },
  { id: "transit", label: "Transit", icon: "tram", on: false },
  { id: "food", label: "Food & drink", icon: "utensils", on: false },
];

/** Everything the map can show, as plain records (used by map.html and by tests). */
export function mapItems(ctx) {
  const { db, cards, c } = ctx;
  const meta = cards.meta;
  const hoodName = (id) => db.byId.place.get(id)?.name || "";
  const progDays = (p) => { const r = db.byId.program.get(p)?.dates; return r ? db.days.filter((d) => d.date >= r.start && d.date <= r.end).map((d) => d.date) : []; };
  const on = (r) => onMap(meta, r.lat, r.lng);
  const venues = db.venues.filter((v) => v.stall && on(v)).map((v) => ({
    kind: "venue", layer: "venues", id: v.id, rec: v, name: v.name, lat: v.lat, lng: v.lng, p: v.programs, n: v.stall, h: v.hood || "",
    days: cards.daysOf(v), meta: [v.address, hoodName(v.hood) || v.neighborhood].filter(Boolean).join(" · "), href: `venues/${v.id}.html`,
  }));
  const works = db.works.filter(on).map((w) => {
    const v = w.venue_id ? db.byId.venue.get(w.venue_id) : null;
    const artists = (w.artists || []).map((id) => db.byId.person.get(id)?.name).filter(Boolean);
    return { kind: "work", layer: "art", id: w.id, rec: w, name: w.title, lat: w.lat, lng: w.lng, p: [w.program], h: v?.hood || "", days: progDays(w.program),
      meta: [artists.length ? h_listJoin(artists) : w.artist_text, w.zone || v?.name].filter(Boolean).join(" · "), href: `art.html?w=${w.id}`, medium: w.medium };
  });
  const stays = db.stays.filter(on).map((s) => ({
    kind: "stay", layer: "stays", id: s.id, rec: s, name: s.name, lat: s.lat, lng: s.lng, p: s.room_block ? [s.room_block.program] : [], h: s.hood || "", days: [],
    meta: [s.room_block ? `${c.progName(s.room_block.program)} room block` : s.booking_portal ? `On ${c.progName(s.booking_portal.program)}'s hotel portal` : "", hoodName(s.hood)].filter(Boolean).join(" · "), href: `stay.html#${s.id}`,
  }));
  const transit = db.places.filter((p) => p.kind === "transit" && on(p)).map((p) => ({
    kind: "stop", layer: "transit", id: p.id, rec: p, name: p.name, lat: p.lat, lng: p.lng, p: [], h: p.hood || "", days: [], meta: hoodName(p.hood), href: `getting-around.html#${p.id}`,
  }));
  const food = db.places.filter((p) => (p.kind === "food" || p.kind === "drink") && on(p)).map((p) => ({
    kind: "food", layer: "food", id: p.id, rec: p, name: p.name, lat: p.lat, lng: p.lng, p: [], h: p.hood || "", days: [], meta: [p.kind === "drink" ? "Drink" : "Food", p.address].filter(Boolean).join(" · "), href: `eat-drink.html#${p.id}`,
  }));
  return { venues, works, stays, transit, food };
}
const h_listJoin = (a) => (a.length < 3 ? a.join(" and ") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);

export function pages(ctx) {
  const { db, c, h, cards } = ctx;
  const { esc, attr } = h;
  const meta = cards.meta;
  const items = mapItems(ctx);
  const byLayer = { venues: items.venues, art: items.works, stays: items.stays, transit: items.transit, food: items.food };
  const offVenues = db.venues.filter((v) => !items.venues.some((x) => x.id === v.id));
  const offWorks = db.works.filter((w) => !items.works.some((x) => x.id === w.id));
  const offStays = db.stays.length - items.stays.length;
  const dayOpts = db.days.filter((d) => d.count || d.inWeek).map((d) => [d.date, h.fmtDay(d.date)]);
  const progs = db.programs.filter((p) => items.venues.some((x) => x.p.includes(p.id)) || items.works.some((x) => x.p.includes(p.id)));

  const marker = (x) => {
    if (x.kind === "venue") return `<span class="map-mk mk-venue" data-prog="${x.p[0] || "also"}"${x.p[1] ? ` data-prog2="${x.p[1]}"` : ""} aria-hidden="true">${x.n}</span>`;
    if (x.kind === "work") return `<span class="map-mk mk-work" data-prog="${x.p[0]}" aria-hidden="true"><i></i></span>`;
    if (x.kind === "stay") return `<span class="map-mk mk-stay"${x.p[0] ? ` data-prog="${x.p[0]}"` : ""} aria-hidden="true">${h.icon("bed")}</span>`;
    if (x.kind === "stop") return `<span class="map-mk mk-stop" aria-hidden="true"><i></i></span>`;
    return `<span class="map-mk mk-food" aria-hidden="true"><i></i></span>`;
  };
  const row = (root, x) => `<li class="map-li" data-id="${x.kind}:${attr(x.id)}" data-kind="${x.kind}" data-layer="${x.layer}" data-ll="${x.lat},${x.lng}" data-p="${attr(x.p.join(" "))}" data-day="${x.days.join(" ")}" data-h="${attr(x.h)}"${x.n ? ` data-n="${x.n}"` : ""}>${marker(x)}<span class="map-li-b"><a class="t" href="${root}${attr(x.href)}"${x.kind === "work" ? ` data-open-work="${attr(x.id)}"` : ""}>${x.n ? `<span class="sr-only">${x.n}. </span>` : ""}${esc(x.name)}</a>${x.meta ? `<span class="m">${esc(x.meta)}</span>` : ""}</span><button class="map-show js-only" type="button" data-map-show="${x.kind}:${attr(x.id)}" aria-label="Show ${attr(x.name)} on the map">${h.icon("locate")}</button></li>`;
  const section = (root, l) => {
    const xs = byLayer[l.id];
    if (!xs.length) return "";
    const sorted = l.id === "venues" ? sortBy(xs, (x) => x.n) : sortBy(xs, (x) => x.name.toLowerCase());
    return `<section class="map-sec" data-layer-sec="${l.id}" aria-labelledby="ml-${l.id}"><h2 class="map-sec-h" id="ml-${l.id}">${h.icon(l.icon)}<span>${esc(LAYER_TITLE[l.id])}</span><span class="label faint" data-sec-count>${xs.length}</span></h2><ul class="map-items">${sorted.map((x) => row(root, x)).join("")}</ul></section>`;
  };

  /* the no-JS map: the home frame with the numbered venues (the interactive map replaces it) */
  const staticMap = (root) => {
    if (!meta) return "";
    const [x0, y0] = project(meta.home.n, meta.home.w, meta), [x1, y1] = project(meta.home.s, meta.home.e, meta);
    const w = x1 - x0, hh = y1 - y0, pct = (v, a, b) => (((v - a) / b) * 100).toFixed(2);
    const pins = items.venues.map((x) => { const [px, py] = project(x.lat, x.lng, meta); return px >= x0 && px <= x1 && py >= y0 && py <= y1 ? `<span class="pin pin-venue" data-prog="${x.p[0] || "also"}" style="left: ${pct(px, x0, w)}%; top: ${pct(py, y0, hh)}%"><span>${x.n}</span></span>` : ""; }).join("");
    const labels = (db.map.labels || []).filter((l) => l.kind === "hood" && l.minZoom <= 1).map((l) => { const [px, py] = project(l.lat, l.lng, meta); return px >= x0 && px <= x1 && py >= y0 && py <= y1 ? `<span class="map-label" style="left: ${pct(px, x0, w)}%; top: ${pct(py, y0, hh)}%">${esc(l.text)}</span>` : ""; }).join("");
    return `<div class="map-static"><svg class="map-base" viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${w.toFixed(1)} ${hh.toFixed(1)}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><use href="${root}assets/map/basemap.svg#bm"/></svg><div class="map-labels" aria-hidden="true">${labels}</div><div class="map-pins" aria-hidden="true">${pins}</div></div>`;
  };

  const homeRatio = meta ? (() => { const [x0, y0] = project(meta.home.n, meta.home.w, meta), [x1, y1] = project(meta.home.s, meta.home.e, meta); return `${(x1 - x0).toFixed(1)} / ${(y1 - y0).toFixed(1)}`; })() : "";
  const legend = `<div class="map-legend" data-map-legend><span data-lg="venues"><i class="lg-station"></i>Venue, numbered as in the list</span><span data-lg="art"><i class="lg-work"></i>Artwork (BLINK diamond, Art Week square)</span><span data-lg="stays" hidden><i class="lg-stay"></i>Place to stay</span><span data-lg="transit" hidden><i class="lg-stop"></i>Streetcar stop or transit center</span><span data-lg="food" hidden><i class="lg-food"></i>Food and drink</span><span class="js-only"><i class="lg-live"></i>Live now</span><span class="js-only"><i class="lg-cluster"></i>Several places: tap to zoom</span><span><i class="lg-tram"></i>Connector streetcar line</span>${h.extLink("https://www.openstreetmap.org/copyright", "© OpenStreetMap contributors", "map-attrib")}</div>`;

  return [{
    path: "map.html", nav: "map", title: "Map", features: ["map"], pageClass: "page-map",
    description: `Every venue, artwork, place to stay, streetcar stop and place to eat of the week on one map of Over-the-Rhine, downtown, The Banks and the Kentucky riverfront.`,
    body: (root) => `${c.pageHead({ num: 1, kicker: `Plan · ${items.venues.length} venues and ${items.works.length} works on the map`, title: "Map", lede: "Venues, art, hotels, the streetcar and places to eat, from Findlay Market to Covington. Venue numbers match the venue list." })}
<div class="map-page" data-map-page>
<div class="map-main">
<div class="map-box" data-map-box>
<div class="map-bar"><p class="label" data-map-title>Over-the-Rhine, downtown and the riverfront</p><span class="map-bar-acts js-only"><button class="btn btn-secondary btn-sm" type="button" data-near-me>${h.icon("locate")}Near me</button><span class="view-toggle" role="group" aria-label="View" data-map-views><button type="button" data-view="map" aria-pressed="true">${h.icon("map")}Map</button><button type="button" data-view="list" aria-pressed="false">${h.icon("list")}List</button></span></span></div>
<div class="map-view" data-map-view${homeRatio ? ` style="--map-ratio: ${homeRatio}"` : ""}>${staticMap(root)}</div>
${legend}
</div>
<div class="map-side" data-map-side>
<div class="map-ctrl js-only">
<div class="dir-group" role="group" aria-labelledby="mc-layers"><span class="dir-glabel label" id="mc-layers">Show</span><div class="dir-chips">${LAYERS.map((l) => `<button class="chip" type="button" data-layer="${l.id}" aria-pressed="${l.on}">${h.icon(l.icon)}<span>${esc(l.label)}</span><span class="n">${byLayer[l.id].length}</span>${h.icon("check", "ck")}</button>`).join("")}</div></div>
${progs.length > 1 ? `<div class="dir-group" role="group" aria-labelledby="mc-p"><span class="dir-glabel label" id="mc-p">Program</span><div class="dir-chips">${progs.map((p) => `<button class="chip" type="button" data-mp="${p.id}" data-prog="${p.id}" aria-pressed="false">${h.bullet(p.id)}<span>${esc(c.progName(p.id, true))}</span>${h.icon("check", "ck")}</button>`).join("")}</div></div>` : ""}
<div class="dir-group"><label class="dir-glabel label" for="mc-day">Day</label><div class="vn-sel"><select class="select" id="mc-day" data-md><option value="">All days</option>${dayOpts.map(([v, l]) => `<option value="${attr(v)}">${esc(l)}</option>`).join("")}</select><span class="faint map-day-note" data-day-note hidden>Venues with an event that day; art on its program's dates.</span></div></div>
</div>
<div class="map-panel" id="map-panel" data-map-panel role="region" aria-label="Selected place" tabindex="-1" hidden></div>
<p class="result-count" role="status" aria-live="polite" data-map-count>Showing <b>${items.venues.length + items.works.length}</b> places</p>
<div class="map-list" data-map-list>
${LAYERS.map((l) => section(root, l)).join("\n")}
<section class="map-sec map-off" aria-labelledby="ml-off"><h2 class="map-sec-h" id="ml-off">${h.icon("warn")}<span>Not on this map</span><span class="label faint">${offVenues.length + offWorks.length}</span></h2>
<p class="faint map-off-note">The map covers Over-the-Rhine, downtown, The Banks, the West End, Mount Adams and the Kentucky riverfront. These are elsewhere, or their address is not published.${offStays ? ` ${h.plural(offStays, "more hotel")} outside the map area ${offStays === 1 ? "is" : "are"} on <a href="${root}stay.html">Where to stay</a>.` : ""}</p>
<ul class="map-items">${sortBy(offVenues, (v) => (v.lat == null ? 0 : 1), (v) => v.city || "", (v) => v.name).map((v) => `<li class="map-li is-off" data-kind="venue"><span class="map-mk mk-venue is-off" aria-hidden="true">–</span><span class="map-li-b"><a class="t" href="${root}venues/${attr(v.id)}.html">${esc(v.name)}</a><span class="m">${esc([v.address, v.hood ? db.byId.place.get(v.hood)?.name : v.city].filter(Boolean).join(" · "))}</span>${cards.placeStatus(v)}</span></li>`).join("")}${offWorks.map((w) => `<li class="map-li is-off" data-kind="work"><span class="map-mk mk-work is-off" data-prog="${w.program}" aria-hidden="true"><i></i></span><span class="map-li-b"><a class="t" href="${root}art.html?w=${attr(w.id)}" data-open-work="${attr(w.id)}">${esc(w.title)}</a><span class="m">${esc([w.zone, w.location_text].filter(Boolean).join(" · ") || c.progName(w.program))}</span>${c.badge("unconfirmed", "Location not published · not on the map")}</span></li>`).join("")}</ul>
</section>
</div>
</div>
</div>
</div>
<p class="source-line">${h.icon("info")}<span>Basemap © OpenStreetMap contributors (ODbL), data as of ${esc((db.map.osm_timestamp || "").slice(0, 10) || "the last basemap build")}. Places and positions come from the programs' listings and Visit Cincy; each list entry links to its source.</span></p>`,
  }];
}
const LAYER_TITLE = { venues: "Venues", art: "Art and installations", stays: "Places to stay", transit: "Streetcar and transit", food: "Food and drink" };

export function data(ctx) {
  const m = ctx.db.map || {};
  return { "assets/data/map-meta.json": { v: 1, bbox: m.bbox || null, projection: m.projection || null, labels: m.labels || [], transit: m.transit || null, attribution: m.attribution || "© OpenStreetMap contributors" } };
}
