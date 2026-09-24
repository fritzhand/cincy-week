/* ============================================================
   build/pages/venues.mjs · OWNER: Agent E (map, venues & visit)
   venues.html: every venue, grouped by neighborhood (server-rendered, readable without JS), filtered by
     program, day, neighborhood and search through features/directory.js (Agent F's engine: data-dir,
     data-filter-group, select[data-filter]), with a List/Map toggle (features/map.js: ?view=map; on wide
     screens the map sits beside the list). Deep links: ?q ?p ?h ?day ?view (build/nav.mjs PARAMS.venues).
   venues/<id>.html: one page per venue (engine spec §4.5, DESIGN.md §9.13): stall number, facts, mini-map with
     Apple/Google walking directions, what's on here by day (Agent D's event cards), works here (Agent F's cards),
     nearby venues, food and drink and places to stay (≤ 500 m, straight-line estimates), source, JSON-LD Place.
   ============================================================ */
import { sortBy } from "../core/util.mjs";
import { searchField, filterGroup, dirStatus, dirEmpty } from "./_directory.mjs";
import { MAP_REGION } from "../core/schema.mjs";

export function pages(ctx) {
  const { db, c, h, cards, config, seo } = ctx;
  const { esc, attr } = h;
  const place = (id) => db.byId.place.get(id);
  const inRegion = (v) => v.lat != null && v.lat >= MAP_REGION.s && v.lat <= MAP_REGION.n && v.lng >= MAP_REGION.w && v.lng <= MAP_REGION.e;

  /* ---------- groups: neighborhoods by how much happens there, then the rest of the area, then other cities ---------- */
  const hoodGroups = sortBy([...db.venuesByHood].filter(([k]) => k), ([, vs]) => -vs.reduce((n, v) => n + v.events.length + 1, 0), ([k]) => place(k)?.name || k)
    .map(([k, vs]) => ({ id: `hood-${k}`, title: place(k) ? (place(k).name.includes("(") ? place(k).short_name || place(k).name : place(k).name) : k, hood: k, venues: vs }));
  const noHood = db.venuesByHood.get("") || [];
  const local = noHood.filter((v) => v.lat == null || inRegion(v));
  const away = noHood.filter((v) => v.lat != null && !inRegion(v));
  const cities = [...new Set(away.map((v) => v.city).filter(Boolean))].sort();
  const groups = [
    ...hoodGroups,
    ...(local.length ? [{ id: "hood-other", title: "Elsewhere in the Cincinnati area", hood: null, venues: local }] : []),
    ...(away.length ? [{ id: "hood-away", title: cities.length ? h.listJoin(cities) : "Other cities", hood: null, venues: sortBy(away, (v) => v.city || "", (v) => v.name) }] : []),
  ].map((g) => ({ ...g, venues: sortBy(g.venues, (v) => (v.stall ? 0 : 1), (v) => v.stall || 0, (v) => v.name.toLowerCase()) }));

  const onMapN = db.venues.filter((v) => v.stall).length;
  const progOpts = db.programs.map((p) => ({ v: p.id, label: c.progName(p.id, true), prog: p.id, count: db.venues.filter((v) => v.programs.includes(p.id)).length })).filter((o) => o.count);
  const dayOpts = db.days.filter((d) => db.venues.some((v) => v.events.some((e) => e.live && e.instances.some((x) => x.day === d.date)))).map((d) => [d.date, h.fmtDay(d.date)]);
  const hoodOpts = hoodGroups.map((g) => [g.hood, `${g.title} (${g.venues.length})`]);

  const list = {
    path: "venues.html", nav: "venues", title: "Venues", features: ["directory", "map"],
    description: `The ${db.venues.length} venues of the week by neighborhood, with addresses, map numbers and walking directions.`,
    toc: groups.length >= 2 ? groups.map((g) => [g.id, g.title]) : undefined,
    body: (root) => `${c.pageHead({ num: 3, kicker: `Directory · ${db.venues.length} venues`, title: "Venues", lede: `Every venue in this guide, with its address and neighborhood where published. The ${onMapN} numbered venues are on the map under the same number.` })}
<div class="dir-tools js-only" data-dir-tools>
${searchField("Search venues", "Search by name, street or neighborhood")}
${progOpts.length > 1 ? filterGroup({ key: "p", label: "Program", options: progOpts }) : ""}
<div class="dir-group vn-selects"><span class="dir-glabel label" id="vn-when">Filter</span><div class="vn-sel" role="group" aria-labelledby="vn-when">
<label><span class="sr-only">Day</span><select class="select" name="day" data-filter="day"><option value="">Day: all</option>${dayOpts.map(([v, l]) => `<option value="${attr(v)}">${esc(l)}</option>`).join("")}</select></label>
<label><span class="sr-only">Neighborhood</span><select class="select" name="h" data-filter="h"><option value="">Neighborhood: all</option>${hoodOpts.map(([v, l]) => `<option value="${attr(v)}">${esc(l)}</option>`).join("")}</select></label>
</div></div>
</div>
<div class="vn-bar">${dirStatus(db.venues.length, "venues")}<span class="view-toggle js-only" role="group" aria-label="View" data-venue-views><button type="button" data-view="list" aria-pressed="true">${h.icon("list")}List</button><button type="button" data-view="map" aria-pressed="false">${h.icon("map")}Map</button></span></div>
<div class="map-layout vn-layout" data-venue-layout>
<div class="vn-map js-only" data-venue-map></div>
<div class="vn-list" data-venue-list>
${groups.map((g) => `<section class="vn-group" id="${attr(g.id)}" data-dir-group aria-labelledby="${attr(g.id)}-h"><h2 class="sub-h vn-head" id="${attr(g.id)}-h"><span>${esc(g.title)}</span><span class="label faint" data-dir-count data-one="venue" data-many="venues">${h.plural(g.venues.length, "venue")}</span>${g.hood ? `<a class="vn-hood-link" href="${root}neighborhoods.html#${attr(g.hood)}">About ${esc(place(g.hood)?.short_name || g.title)}</a>` : ""}</h2><ul class="venues" data-dir>${g.venues.map((v) => cards.venueCard(root, v)).join("")}</ul></section>`).join("\n")}
${dirEmpty(c, { title: "No venues match these filters", glyph: "pin" })}
</div>
</div>
<p class="source-line">${h.icon("info")}<span>Addresses and neighborhoods come from each program's published listings and each venue's own page (every venue page links its source). Map positions are geocoded from the published address with OpenStreetMap.</span></p>`,
  };

  const detail = db.venues.map((v) => venuePage(ctx, v));
  return [list, ...detail];
}

function venuePage(ctx, v) {
  const { db, c, h, cards, config, seo } = ctx;
  const { esc, attr } = h;
  const hood = v.hood ? db.byId.place.get(v.hood) : null;
  const prog = v.programs[0] || "also";
  const d = cards.directionsTo(v);
  const w = cards.where(v);
  const works = db.worksByVenue.get(v.id) || [];
  const live = v.events.filter((e) => e.live || e.status === "cancelled");
  // exhibitions and other multi-day or hours-not-listed items once, as a spanning card; dated items by day
  const spans = live.filter((e) => e.instances.length > 1 || e.instances.some((x) => x.ongoing));
  const dated = live.filter((e) => !spans.includes(e));
  const byDay = new Map();
  for (const e of dated) for (const x of e.instances) { if (!byDay.has(x.day)) byDay.set(x.day, []); byDay.get(x.day).push(x); }
  const days = [...byDay.keys()].sort();
  const near = v.lat != null ? cards.nearbyOf(v.lat, v.lng, 500) : [];
  const nearV = near.filter((x) => x.kind === "venue").slice(0, 8);
  const nearF = near.filter((x) => x.kind === "place" && ["food", "drink"].includes(x.rec.kind)).slice(0, 8);
  const nearS = near.filter((x) => x.kind === "stay").slice(0, 6);
  // BLINK's restrooms, Oasis Stations, viewing areas and the like (places kind "facility", from BLINK's maps)
  const nearB = near.filter((x) => x.kind === "place" && x.rec.kind === "facility").slice(0, 6);
  const hub = db.programs.filter((p) => p.hub_venue_id === v.id);
  const place = hood ? hood.name : v.neighborhood || [v.city, v.state].filter(Boolean).join(", ");
  const fullAddr = v.address ? [v.address, v.city, [v.state, v.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ") : null;
  const toc = [
    ["vp-facts", "At a glance"],
    ...(spans.length ? [["vp-onview", "On view"]] : []),
    ...(days.length ? [["vp-byday", "By day"]] : []),
    ...(works.length ? [["vp-works", "Works here"]] : []),
    ...(near.length ? [["vp-nearby", "Nearby"]] : []),
  ];
  const nearList = (title, id, xs, link) => (xs.length ? `<div class="vp-near-col"><h3 class="sub-h" id="${id}">${esc(title)}</h3><ul class="vp-near">${xs.map((x) => `<li><a href="${link(x.rec)}">${x.kind === "venue" && x.rec.stall ? `<span class="stall s" aria-hidden="true">${x.rec.stall}</span>` : ""}<span><b>${esc(x.rec.name)}</b><span class="faint">${esc(cards.walkLabel(x.d))}</span></span></a></li>`).join("")}</ul></div>` : "");

  return {
    path: `venues/${v.id}.html`, nav: "venues", title: v.name,
    description: h.truncate(`${v.name}${v.address ? `, ${v.address}` : ""}${hood ? ` (${hood.name})` : ""}: what's on here during the week, with walking directions.`, 155),
    crumbs: [["Overview", "index.html"], ["Venues", "venues.html"], [v.name, null]],
    toc: toc.length >= 3 ? toc : undefined,
    jsonld: seo.placeLd(v, { url: `${config.siteBase}venues/${v.id}.html` }),
    body: (root) => `<header class="page-head vp-head" data-prog="${prog}">
<p class="kicker label">${v.stall ? `<span class="stall s" aria-hidden="true">${v.stall}</span><span class="sr-only">Map number ${v.stall}. </span>` : `<span class="stall s is-off" aria-hidden="true">–</span>`}<span>Venue${place ? ` · ${esc(place)}` : ""}</span></p>
<h1>${esc(v.name)}</h1>
${v.address ? `<p class="lede tnum">${esc(v.address)}</p>` : `<p class="lede unk">Address not listed</p>`}
</header>
<div class="vp-top" id="vp-facts">
<div>${c.facts(root, [
  ["Address", fullAddr ? esc(fullAddr) : '<span class="unk">Address not listed</span>'],
  ["Neighborhood", hood ? `<a href="${root}neighborhoods.html#${attr(hood.id)}">${esc(hood.name)}</a>` : v.neighborhood ? esc(v.neighborhood) : null],
  ["Programs", v.programs.length ? v.programs.map((p) => c.progBadge(p)).join(" ") : null],
  ["Role", hub.length ? esc(hub.map((p) => `${c.progName(p.id)} hub`).join(", ")) : null],
  ["This week", live.length || works.length ? esc([live.length ? h.plural(live.length, "event") : "", works.length ? h.plural(works.length, "work") : ""].filter(Boolean).join(" · ")) : null],
  ["Accessibility", v.accessibility ? esc(v.accessibility) : '<span class="unk">Not listed</span>'],
  ["Website", v.url ? h.extLink(v.url, esc(h.hostOf(v.url))) : null],
])}
${w !== "on" ? `<p class="vp-status">${cards.placeStatus(v)}</p>` : ""}</div>
<div class="vp-map">${w === "on" ? cards.miniMap(root, v.lat, v.lng, { prog, n: v.stall || "", label: `Map: ${v.name}${hood ? `, ${hood.name}` : ""}` }) : ""}
${d ? `<p class="btn-row vp-dir"><span class="acts-l">${h.icon(d.walk ? "walk" : "pin")}${d.walk ? "Walking directions" : "Directions"}</span>${d.apple ? h.extLink(d.apple, "Apple Maps", "btn btn-secondary btn-sm") : ""}${h.extLink(d.google, "Google Maps", "btn btn-secondary btn-sm")}${w === "on" ? `<a class="btn btn-ghost btn-sm" href="${root}map.html?focus=venue:${attr(v.id)}">${h.icon("map")}On the map</a>` : ""}</p>` : ""}${v.approx_m && v.lat != null ? `<p class="faint vp-approx">Approximate position (about ±${esc(v.approx_m)} m)</p>` : ""}</div>
</div>
${spans.length ? `<section class="vp-sec" aria-labelledby="vp-onview"><h2 class="sub-h" id="vp-onview">On view</h2><p class="faint vp-note">Exhibitions and other items that run over several days.</p><div class="grid">${sortBy(spans, (e) => e.date).map((e) => cards.eventCard(root, e, { anchor: false, headingLevel: 3, compact: true, here: v.id })).join("")}</div></section>` : ""}
${days.length ? `<section class="vp-sec byday" aria-labelledby="vp-byday"><h2 class="sub-h" id="vp-byday">What's on here, by day</h2>${days.map((day) => `<h3 class="vp-day">${esc(h.fmtDayLong(day))}</h3><div class="grid">${sortBy(byDay.get(day), (x) => x.s).map((x) => cards.eventCard(root, x, { anchor: false, headingLevel: 4, compact: true, here: v.id })).join("")}</div>`).join("")}</section>` : ""}
${!live.length && !works.length ? c.emptyState({ title: "No events listed here yet", body: "Nothing on the programs' published schedules names this venue for the week.", glyph: "calendar", prog }) : ""}
${works.length ? `<section class="vp-sec" aria-labelledby="vp-works"><h2 class="sub-h" id="vp-works">Works here</h2><div class="works">${works.map((wk) => cards.workCard(root, wk, { headingLevel: 3 })).join("")}</div></section>` : ""}
${near.length ? `<section class="vp-sec" aria-labelledby="vp-nearby"><h2 class="sub-h" id="vp-nearby">Nearby</h2><p class="faint vp-note">Within 500 m in a straight line. Walking times are estimates (distance × 1.3 at 80 m a minute).</p><div class="vp-nearby">
${nearList("Venues", "vp-near-v", nearV, (r) => `${root}venues/${attr(r.id)}.html`)}
${nearList("Food and drink", "vp-near-f", nearF, (r) => `${root}eat-drink.html#${attr(r.id)}`)}
${nearList("Places to stay", "vp-near-s", nearS, (r) => `${root}stay.html#${attr(r.id)}`)}
${nearList("BLINK restrooms and facilities", "vp-near-b", nearB, (r) => `${root}getting-around.html#${attr(r.id)}`)}
</div></section>` : ""}
${c.sourceLine([v.source_url, ...new Set(live.map((e) => e.source_url))].slice(0, 4))}`,
  };
}

export function search(ctx) {
  const { db } = ctx;
  return db.venues.map((v) => ({ k: "ve", id: v.id, t: v.name, s: [v.address, db.byId.place.get(v.hood)?.name || v.neighborhood || v.city].filter(Boolean).join(" · "), u: `venues/${v.id}.html`, p: v.programs[0], g: [...(v.aliases || []), v.kind].join(" ") }));
}
