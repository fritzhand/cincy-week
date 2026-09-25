/* ============================================================
   build/pages/visit.mjs · OWNER: Agent E (map, venues & visit)
   The Visit section (engine spec §4.5, DESIGN.md §9.9), from data/stays.json and data/places.json:
     stay.html            room blocks first (code, rate, dates, book-by date, status and booking link exactly as
                          published), then hotels by neighborhood; walking minutes to the hubs computed from
                          coordinates and labeled estimates; the map (features/map.js) with every hotel on it.
     getting-around.html  the Connector (route map, 18 stations, hours and fare only as sourced), buses, bikes and
                          scooters, parking, the airport and trains, rides, walking (a computed hub-to-hub matrix,
                          labeled estimates), accessibility, tips.
     neighborhoods.html   one section per neighborhood: summary, this week's counts (links into the filtered
                          schedule, venues, art, food and stays), key venues, food and drink, stays, landmarks, map.
     eat-drink.html       food and drink by neighborhood with "near" venue chips; ?h= filters (features/directory.js).
   Every place record renders exactly once (its id is the anchor search entries point to: PLACE_PAGE below).
   ============================================================ */
import { sortBy } from "../core/util.mjs";
import { haversine, walkMinutes, onMap } from "../../site/js/lib/geo.js";
import { searchField, dirStatus, dirEmpty } from "./_directory.mjs";
import { FACILITY_KINDS, FACILITY_LABEL, FACILITY_ICON } from "../core/schema.mjs";

/** Which page lists each places.json kind (every kind in schema PLACE_KINDS appears once). */
const PLACE_PAGES = {
  neighborhoods: ["neighborhood", "landmark"],
  "eat-drink": ["food", "drink"],
  "getting-around": ["transit", "parking", "bike", "rideshare", "airport", "accessibility", "tip", "facility"],
};
const PAGE_OF_KIND = Object.fromEntries(Object.entries(PLACE_PAGES).flatMap(([pg, ks]) => ks.map((k) => [k, pg])));

/** The hubs walking times are measured to: each program's own hub or a central BLINK zone, as records. */
const HUBS = [
  { key: "union-hall", from: "venue", id: "union-hall", label: "Union Hall", note: "StartupCincy Week hub" },
  { key: "caw-hub", from: "venue", id: "caw-hub-1600-race", label: "Art Week hub", note: "1600 Race St" },
  { key: "findlay", from: "venue", id: "findlay-market", label: "Findlay Market" },
  { key: "fountain-square", from: "place", id: "fountain-square", label: "Fountain Square" },
  { key: "banks", from: "venue", id: "blink-zone-the-banks", label: "The Banks", note: "BLINK zone" },
  { key: "covington", from: "venue", id: "blink-zone-covington", label: "Covington", note: "BLINK zone" },
];
/** Stay cards show three of them, the same three on every card so hotels compare at a glance. */
const STAY_HUBS = ["union-hall", "caw-hub", "fountain-square"];

/** Getting around: the section a place belongs to (every getting-around place lands in exactly one). */
const GA_SECTIONS = [
  { id: "streetcar", title: "The Connector streetcar", icon: "tram" },
  { id: "buses", title: "Buses and shuttles", icon: "tram" },
  { id: "bikes", title: "Bikes, scooters and carts", icon: "walk" },
  { id: "walking", title: "Walking", icon: "walk" },
  { id: "blink-facilities", title: "BLINK restrooms, Oasis Stations and more", icon: "wc" },   // places kind "facility" (BLINK's map)
  { id: "parking", title: "Driving and parking", icon: "pin" },
  { id: "airport", title: "The airport and trains", icon: "map" },
  { id: "rides", title: "Rideshare and taxis", icon: "pin" },
  { id: "access", title: "Accessibility", icon: "info" },
  { id: "tips", title: "Tips from the organizers and the city", icon: "info" },
];
function gaSection(p) {
  const id = p.id;
  if (p.kind === "facility") return "blink-facilities";
  if (id.startsWith("connector-") || id === "blink-streetcar" || id === "accessibility-connector") return "streetcar";
  if (p.kind === "airport" || /(^|-)cvg(-|$)|airporter|amtrak/.test(id)) return "airport";
  if (p.kind === "parking") return "parking";
  if (p.kind === "bike" || id === "e-scooters" || id === "gest-carts") return "bikes";
  if (p.kind === "rideshare") return "rides";
  if (p.kind === "transit") return /^walking-/.test(id) ? "walking" : "buses";
  if (p.kind === "accessibility") return "access";
  if (p.kind === "tip") return /walk/.test(id) ? "walking" : "tips";
  return "tips";
}

export function pages(ctx) {
  const { db, c, h, cards } = ctx;
  const { esc, attr } = h;
  const place = (id) => db.byId.place.get(id);
  const hoodName = (id) => place(id)?.name || "";
  /** "Downtown (Central Business District)" → "Downtown": compact labels for headings, chips and lists. */
  const hoodShort = (id) => { const p = place(id); return !p ? "" : p.name.includes("(") ? p.short_name || p.name.replace(/\s*\(.*\)$/, "") : p.name; };
  const hubs = HUBS.map((x) => ({ ...x, rec: x.from === "venue" ? db.byId.venue.get(x.id) : place(x.id) })).filter((x) => x.rec && x.rec.lat != null);
  const hubByKey = new Map(hubs.map((x) => [x.key, x]));
  const kinds = (ks) => db.places.filter((p) => ks.includes(p.kind));
  const srcHost = (u) => `<p class="faint src">Source: ${h.extLink(u, esc(h.hostOf(u)))}</p>`;
  const onMapLink = (root, kind, r) => (onMap(cards.meta, r.lat, r.lng) ? `<a class="btn btn-ghost btn-sm" href="${root}map.html?focus=${kind}:${attr(r.id)}${kind === "stay" ? "&amp;layers=venues,stays" : ""}">${h.icon("map")}On the map</a>` : "");
  const dirLinks = (r) => { const d = cards.directionsTo(r); return d ? `${d.apple ? h.extLink(d.apple, "Apple Maps", "btn btn-secondary btn-sm") : ""}${h.extLink(d.google, "Google Maps", "btn btn-secondary btn-sm")}` : ""; };
  // QA: the fold-out names what it opens for screen readers ("Details about Metro (SORTA) buses") and shows a chevron
  const detailsBlock = (text, name = "") => (!text ? "" : text.length > 240 ? `<details class="more-d"><summary>Details${name ? `<span class="sr-only"> about ${esc(name)}</span>` : ""}${h.icon("chev-d")}</summary><div class="prose">${h.paras(text)}</div></details>` : `<div class="prose small">${h.paras(text)}</div>`);

  /** "12 min" to a hub; far away, the straight-line distance instead of a meaningless walking time. */
  const distChip = (r, hub) => {
    const m = haversine(r, hub.rec), min = walkMinutes(r, hub.rec);
    const val = min <= 45 ? `<b>${min} min</b>` : `<b>${(m / 1000).toFixed(1)} km</b>`;
    return `<span title="${attr(min <= 45 ? `About ${min} minutes' walk (estimate)` : `${(m / 1000).toFixed(1)} km in a straight line`)}">${val} ${esc(hub.label)}</span>`;
  };

  /* ================= stay.html ================= */
  const blocks = db.stays.filter((s) => s.room_block);
  const others = db.stays.filter((s) => !s.room_block);
  const fs = hubByKey.get("fountain-square");
  const dFS = (s) => (fs && s.lat != null ? haversine(s, fs.rec) : 1e9);
  const stayGroups = [...h.groupBy(sortBy(others, (s) => (s.hood ? 0 : 1), dFS), (s) => s.hood || "")]
    .map(([k, xs]) => ({ id: k ? `st-${k}` : "st-region", title: k ? hoodShort(k) : "Across the region", hood: k, stays: xs }));
  const orderedGroups = sortBy(stayGroups, (g) => (g.hood ? 0 : 1), (g) => Math.min(...g.stays.map(dFS)));
  const fmtISO = (s) => (/^\d{4}-\d\d-\d\d$/.test(s || "") ? `${h.fmtDate(s)}, ${s.slice(0, 4)}` : s);
  const fmtDates = (s) => { const m = /^(\d{4}-\d\d-\d\d) to (\d{4}-\d\d-\d\d)$/.exec(s || ""); return m ? `${h.fmtDate(m[1])} to ${h.fmtDate(m[2])}, ${m[1].slice(0, 4)}` : s; };
  const blockPanel = (s) => {
    const b = s.room_block;
    const closed = /^closed/i.test(b.status || "");
    const rows = [["Group code", b.group_code], ["Rate", b.rate], ["Dates", fmtDates(b.dates)], ["Book by", fmtISO(b.deadline)]];
    // b.label: what the program calls it when it is not a published block (Brand Fusion's "recommended hotel" and booking link)
    return `<div class="block" data-prog="${attr(b.program)}"><p class="bh label">${h.bullet(b.program)}${esc(c.progName(b.program))} ${esc(b.label || "room block")}</p><dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v ? esc(v) : '<span class="unk">not published</span>'}</dd>`).join("")}${b.status ? `<dt>Status</dt><dd>${closed ? c.badge("warn", "Closed") : ""} <span class="st-status">${esc(closed ? b.status.replace(/^closed:\s*/i, "") : b.status)}</span></dd>` : ""}</dl>${b.booking_url ? `<p class="bk">${h.extLink(b.booking_url, `${closed ? "Booking link as published" : b.label ? "Book with the organizers' link" : "Book the room block"}${h.icon("ext")}`, `btn ${closed ? "btn-secondary" : "btn-primary"} btn-sm`)}</p>` : ""}${b.source_url && b.source_url !== s.source_url ? srcHost(b.source_url) : ""}</div>`;
  };
  const stayCard = (root, s) => {
    const addr = [s.address, s.hood && !(s.address || "").includes(hoodShort(s.hood)) ? hoodShort(s.hood) : ""].filter(Boolean).join(" · ");
    const chips = s.lat != null ? STAY_HUBS.map((k) => hubByKey.get(k)).filter(Boolean).map((hub) => distChip(s, hub)).join("") : "";
    return `<article class="stay"${s.room_block ? ` data-prog="${attr(s.room_block.program)}"` : ""} id="${attr(s.id)}"${s.lat != null && onMap(cards.meta, s.lat, s.lng) ? ` data-ll="${s.lat},${s.lng}"` : ""} data-name="${attr(s.name)}">
<h3>${esc(s.name)}</h3>${addr ? `<p class="addr">${esc(addr)}</p>` : ""}
${chips ? `<p class="dist" aria-label="Estimated walking time to the hubs">${h.icon("walk")}${chips}</p>` : ""}
${s.room_block ? blockPanel(s) : ""}
${s.booking_portal ? `<p class="portal">${h.bullet(s.booking_portal.program)}<span>On ${esc(s.booking_portal.program === "blink" ? "BLINK's" : `${c.progName(s.booking_portal.program)}'s`)} hotel booking portal (no group code or discounted rate)</span></p>` : ""}
<p class="acts">${s.url ? h.extLink(s.url, `Hotel site${h.icon("ext")}`, "btn btn-secondary btn-sm") : ""}${s.booking_portal ? h.extLink(s.booking_portal.url, `Book via ${esc(s.booking_portal.program === "blink" ? "BLINK's" : `${c.progName(s.booking_portal.program)}'s`)} hotel portal${h.icon("ext")}`, "btn btn-secondary btn-sm") : ""}${onMapLink(root, "stay", s)}</p>
${srcHost(s.source_url)}</article>`;
  };
  const stayGroupIds = new Set(orderedGroups.map((g) => g.id));
  const hubLine = STAY_HUBS.map((k) => hubByKey.get(k)).filter(Boolean).map((x) => `${x.label}${x.note ? ` (${x.note})` : ""}`);

  const stayPage = {
    path: "stay.html", nav: "stay", title: "Where to stay", features: ["map"],
    description: `${h.plural(db.stays.length, "place", "places")} to stay: the StartupCincy Week room blocks as published, then hotels and rentals by neighborhood with estimated walking times to the hubs.`,
    toc: [["st-blocks", "Room blocks"], ...orderedGroups.map((g) => [g.id, g.title])],
    body: (root) => `${c.pageHead({ num: 4, kicker: `Visit · ${h.plural(db.stays.length, "place", "places")} to stay`, title: "Where to stay", lede: "Program room blocks come first, exactly as published. Then hotels and rentals by neighborhood, with estimated walking times to the week's hubs." })}
${c.callout("tip", `<p>Walking times are estimates: the straight-line distance × 1.3, at 80 m a minute. Chips show minutes to ${esc(h.listJoin(hubLine))}; beyond a 45-minute walk they show the distance instead.</p>`, { flag: "How to read the cards" })}
<section class="section" id="st-blocks" aria-labelledby="st-blocks-h"><div class="sec-head oxford"><p class="sec-kicker label">${c.secNum(4)}Room blocks</p><h2 id="st-blocks-h">${blocks.some((s) => s.room_block.label) ? "Program room blocks and hotels" : "Program room blocks"}</h2></div>
${blocks.length ? `<div class="stays">${blocks.map((s) => stayCard(root, s)).join("")}</div>` : `<p class="unk">No program has published a room block.</p>`}
<p class="faint st-note">Cincinnati Art Week and BLINK list no room block.${(() => { const bp = db.stays.find((s) => s.booking_portal)?.booking_portal; return bp ? ` BLINK links a hotel booking portal at ${esc(h.hostOf(bp.url))} instead. It shows no group code or discounted rate; hotels on it are marked below.` : ""; })()}</p>
</section>
<section class="section st-mapsec js-only" aria-labelledby="st-map-h"><div class="sec-head oxford"><h2 id="st-map-h">On the map</h2><a class="more" href="${root}map.html?layers=venues,stays">Full map${h.icon("arrow-r")}</a></div><div class="st-map" data-stay-map></div></section>
${orderedGroups.map((g) => `<section class="section" id="${attr(g.id)}" aria-labelledby="${attr(g.id)}-h"><div class="sec-head oxford"><p class="sec-kicker label">${h.plural(g.stays.length, "place to stay", "places to stay")}${g.hood ? "" : " · outside the core neighborhoods"}</p><h2 id="${attr(g.id)}-h">${esc(g.title)}</h2>${g.hood ? `<a class="more" href="${root}neighborhoods.html#${attr(g.hood)}">About ${esc(place(g.hood)?.short_name || g.title)}${h.icon("arrow-r")}</a>` : ""}</div><div class="stays">${g.stays.map((s) => stayCard(root, s)).join("")}</div></section>`).join("\n")}
<p class="source-line">${h.icon("info")}<span>Hotels and rentals from StartupCincy Week's Plan Your Visit page, Visit Cincy and BLINK's hotel portal. Each card links its source. Portal-only hotels have approximate coordinates, so their distances are rougher.</span></p>`,
  };

  /* ================= getting-around.html ================= */
  const gaPlaces = kinds(PLACE_PAGES["getting-around"]);
  const bySec = new Map(GA_SECTIONS.map((s) => [s.id, []]));
  for (const p of gaPlaces) bySec.get(gaSection(p)).push(p);
  const stations = sortBy(bySec.get("streetcar").filter((p) => /^connector-station-\d+/.test(p.id)), (p) => Number(/station-(\d+)/.exec(p.id)[1]));
  const streetcarOther = bySec.get("streetcar").filter((p) => !stations.includes(p));
  const tiny = (p) => (p.summary || "").length < 60 && (p.details || "").length < 60;   // BLINK restrooms and the like
  const placeCard = (root, p) => `<article class="gp" id="${attr(p.id)}"><h3>${esc(p.name)}</h3>${p.summary ? `<div class="prose">${h.paras(p.summary)}</div>` : ""}${detailsBlock(p.details, p.name)}${p.address ? `<p class="addr">${esc(p.address)}${p.hood && !p.address.includes(hoodShort(p.hood)) ? ` · ${esc(hoodShort(p.hood))}` : ""}</p>` : ""}<p class="acts">${p.url ? h.extLink(p.url, `${esc(h.hostOf(p.url))}${h.icon("ext")}`, "btn btn-ghost btn-sm") : ""}${p.lat != null ? dirLinks(p) : ""}</p>${srcHost(p.source_url)}</article>`;
  const tinyRow = (p) => `<li id="${attr(p.id)}"><p><b>${esc(p.name)}</b>${p.details || p.address ? ` <span>${esc(p.details || p.address)}</span>` : ""} <span class="faint">· ${h.extLink(p.source_url, esc(h.hostOf(p.source_url)))}</span></p></li>`;
  const secBody = (root, id, list) => {
    const big = list.filter((p) => !tiny(p)), small = list.filter(tiny);
    return `${big.length ? `<div class="gps">${big.map((p) => placeCard(root, p)).join("")}</div>` : ""}${small.length ? `<h3 class="sub-h">${id === "access" ? "Restrooms and rest stops during BLINK" : "More"}</h3><ul class="gp-mini">${small.map(tinyRow).join("")}</ul>` : ""}`;
  };
  const connector = place("connector-streetcar");
  const walkHubs = hubs;
  const matrix = `<div class="table-wrap"><table class="data walk"><caption>Walking minutes between the hubs. Estimates: straight-line distance × 1.3, at 80 m a minute; real routes can be longer (bridge ramps, hills, closed streets).</caption>
<thead><tr><th scope="col">From</th>${walkHubs.map((x) => `<th scope="col" class="num">${esc(x.label)}</th>`).join("")}</tr></thead>
<tbody>${walkHubs.map((a) => `<tr><th scope="row" data-label="From">${esc(a.label)}${a.note ? `<span class="faint"> · ${esc(a.note)}</span>` : ""}</th>${walkHubs.map((b) => (a === b ? `<td class="num" data-label="${attr(b.label)}"><span aria-label="same place">·</span></td>` : `<td class="num${walkMinutes(a.rec, b.rec) > 25 ? " far" : ""}" data-label="${attr(b.label)}"><b>${walkMinutes(a.rec, b.rec)}</b> min <span class="faint">${(haversine(a.rec, b.rec) / 1000).toFixed(1)} km</span></td>`)).join("")}</tr>`).join("")}</tbody></table></div>
<p class="walk-note">Above 25 minutes (in italics), the streetcar, a bus or a ride may be quicker. Hubs are placed at their published addresses; The Banks and Covington at the average position of BLINK's mapped points in each zone.</p>`;
  const stationMap = (root) => cards.areaMap(root, stations.map((p) => ({ lat: p.lat, lng: p.lng, kind: "stop", n: Number(/station-(\d+)/.exec(p.id)[1]) })), { label: `Map of the Connector streetcar loop and its ${stations.length} stations`, minHalfM: 600, ratio: 3 / 4, cls: "ga-route" });

  /* BLINK's facilities (places kind "facility", from BLINK's official folding map and its online map, 2026-09-24): grouped by
     the map's KEY symbol, each with its map number, zone, directions and a link to it on map.html. A text shared by every place
     in a group (the KEY's "Indoor restrooms and facilities", the Urban Hikers blurb) is printed once, under the group. */
  const blinkMap = db.byId.program.get("blink")?.maps?.[0] || null;
  const facMark = (k) => `<span class="fac-mk" aria-hidden="true">${h.icon(FACILITY_ICON[k])}</span>`;
  const facGroupTitle = { "oasis-station": "Oasis Stations", restroom: "Restrooms", "merch-shop": "Official BLINK Merch Shop", "hospitality-zone": "Hospitality Zones", "hike-departure": "Hike departures (Urban Hikers)", "drone-viewing": "Drone Show Viewing Areas" };
  function facilityBody(root, list) {
    // zone by zone in the map's own order (a zone ranks by the first number printed in it), then by name
    const zoneRank = new Map();
    for (const w of db.works) if (w.map_no != null && w.zone) zoneRank.set(w.zone, Math.min(zoneRank.get(w.zone) ?? Infinity, w.map_no));
    const groups = FACILITY_KINDS.map((k) => [k, sortBy(list.filter((p) => p.facility === k), (p) => p.map_no ?? 1e9, (p) => zoneRank.get(p.zone) ?? 1e9, (p) => p.name, (p) => p.id)]).filter(([, xs]) => xs.length);
    const shared = (xs, f) => (xs.length > 1 && xs[0][f] && xs.every((x) => x[f] === xs[0][f]) ? xs[0][f] : null);
    const item = (p, hide) => {
      const meta = [p.map_no != null ? `${c.progName(p.program || "blink", true)} map No. ${p.map_no}` : "", p.zone, !hide.details && p.details ? p.details : "", p.address && p.address !== p.details ? p.address : ""].filter(Boolean);
      return `<li class="fac" id="${attr(p.id)}">${facMark(p.facility)}<div class="fac-b"><p class="fac-t"><b>${esc(p.name)}</b>${meta.length ? ` <span class="fac-m">${esc(meta.join(" · "))}</span>` : ""}</p>${!hide.summary && p.summary && p.summary !== p.name ? `<p class="fac-s">${esc(p.summary)}</p>` : ""}${p.approx_m ? `<p class="fac-s faint">Approximate position (about ±${esc(p.approx_m)} m)</p>` : ""}<p class="acts">${p.lat != null ? dirLinks(p) : ""}${onMap(cards.meta, p.lat, p.lng) ? `<a class="btn btn-ghost btn-sm" href="${root}map.html?focus=facility:${attr(p.id)}">${h.icon("map")}On the map</a>` : ""}<span class="faint fac-src">Source: ${h.extLink(p.source_url, esc(h.hostOf(p.source_url)))}</span></p></div></li>`;
    };
    return `<p class="ga-fac-lede">Restrooms, Oasis Stations, the merch shop, hospitality zones, hike departures and the drone show viewing areas, from ${blinkMap ? h.extLink(blinkMap.url, esc(blinkMap.label)) : "BLINK's printed map"} and BLINK's online map. Numbers are the printed map's own.</p>
<p class="btn-row"><a class="btn btn-secondary btn-sm" href="${root}map.html?layers=venues,art,facilities&amp;p=blink">${h.icon("map")}All of them on the map</a></p>
${groups.map(([k, xs]) => {
  const sum = shared(xs, "summary"), det = shared(xs, "details");
  return `<h3 class="sub-h fac-h" id="fac-${k}">${facMark(k)}<span>${esc(facGroupTitle[k] || FACILITY_LABEL[k])}</span><span class="label faint">${xs.length}</span></h3>${sum ? `<p class="fac-gs">${k === "oasis-station" ? `“${esc(sum)}” <span class="faint">(the map's key)</span>` : esc(sum)}</p>` : ""}${det ? detailsBlock(det, facGroupTitle[k]) : ""}<ul class="fac-list">${xs.map((p) => item(p, { summary: !!sum, details: !!det })).join("")}</ul>`;
}).join("\n")}`;
  }

  const gaPage = {
    path: "getting-around.html", nav: "getting-around", title: "Getting around",
    description: "The free Connector streetcar, buses, bikes and scooters, parking, the airport and walking times between the week's hubs, from official sources.",
    toc: GA_SECTIONS.filter((s) => bySec.get(s.id).length || s.id === "walking").map((s) => [s.id, s.title]),
    body: (root) => `${c.pageHead({ num: 4, kicker: "Visit · streetcar, buses, bikes, parking", title: "Getting around", lede: "How to move between Over-the-Rhine, downtown, The Banks and Covington during the week, from the operators' and organizers' own pages." })}
${GA_SECTIONS.map((s) => {
  const list = bySec.get(s.id);
  if (s.id === "streetcar") {
    if (!list.length) return "";
    return c.section({ id: s.id, title: s.title, kicker: stations.length ? `${stations.length} stations · the dashed line on every map` : "", icon: s.icon, root, body: `<div class="ga-car">
<div>${connector ? `<div class="ga-intro" id="${attr(connector.id)}"><div class="prose">${h.paras(connector.summary || "")}</div>${detailsBlock(connector.details, connector.name)}${srcHost(connector.source_url)}</div>` : ""}
${stations.length ? `<h3 class="sub-h">Stations, in loop order</h3><ol class="ga-stops">${stations.map((p) => `<li id="${attr(p.id)}"><span class="ga-n" aria-hidden="true">${Number(/station-(\d+)/.exec(p.id)[1])}</span><span><b>${esc(p.name.replace(/^Connector station \d+:\s*/, ""))}</b>${p.hood ? ` <span class="faint">${esc(hoodShort(p.hood))}</span>` : ""}</span></li>`).join("")}</ol><p class="faint src">Station numbers and names: ${h.extLink(stations[0].source_url, "the city's route map")}.</p>` : ""}</div>
<div>${stationMap(root)}<p class="btn-row"><a class="btn btn-secondary btn-sm" href="${root}map.html?layers=venues,transit">${h.icon("map")}Stations on the full map</a></p></div>
</div>${streetcarOther.filter((p) => p !== connector).length ? `<div class="gps">${streetcarOther.filter((p) => p !== connector).map((p) => placeCard(root, p)).join("")}</div>` : ""}` });
  }
  if (s.id === "walking") return c.section({ id: s.id, title: s.title, kicker: "Walking times are estimates", icon: s.icon, root, body: `${walkHubs.length > 1 ? matrix : ""}${secBody(root, s.id, list)}` });
  if (s.id === "blink-facilities") return list.length ? c.section({ id: s.id, title: s.title, kicker: `${h.plural(list.length, "place")} · from BLINK's own maps`, icon: s.icon, root, body: facilityBody(root, list) }) : "";
  if (!list.length) return "";
  return c.section({ id: s.id, title: s.title, kicker: h.plural(list.length, "entry", "entries"), icon: s.icon, root, body: secBody(root, s.id, s.id === "parking" ? sortBy(list, (p) => (p.lat == null ? 1 : 0), (p) => p.name) : list) });
}).join("\n")}`,
  };

  /* ================= neighborhoods.html ================= */
  const hoods = db.places.filter((p) => p.kind === "neighborhood");
  const evsOf = (id) => (db.eventsByHood.get(id) || []).filter((e) => e.live);
  const venuesOf = (id) => db.venuesByHood.get(id) || [];
  const worksOf = (id) => db.works.filter((w) => w.venue_id && db.byId.venue.get(w.venue_id)?.hood === id);
  const foodOf = (id) => db.places.filter((p) => (p.kind === "food" || p.kind === "drink") && p.hood === id);
  const staysOf = (id) => db.stays.filter((s) => s.hood === id);
  const landOf = (id) => db.places.filter((p) => p.kind === "landmark" && p.hood === id);
  const weight = (id) => evsOf(id).length * 2 + venuesOf(id).length + foodOf(id).length + staysOf(id).length;
  const orderedHoods = sortBy(hoods, (p) => (p.summary ? 0 : 1), (p) => -weight(p.id), (p) => p.name);
  const artHoods = new Set(db.works.map((w) => (w.venue_id ? db.byId.venue.get(w.venue_id)?.hood : null)).filter(Boolean));
  const venueHoods = new Set(db.venues.map((v) => v.hood).filter(Boolean));
  const eatHoods = new Set(db.places.filter((p) => p.kind === "food" || p.kind === "drink").map((p) => p.hood).filter(Boolean));
  const hoodSection = (root, p) => {
    const evs = evsOf(p.id), vs = venuesOf(p.id), ws = worksOf(p.id), fd = foodOf(p.id), st = staysOf(p.id), lm = landOf(p.id);
    const progCounts = db.programs.map((pr) => [pr.id, evs.filter((e) => e.program === pr.id).length]).filter(([, n]) => n);
    const counts = [
      evs.length ? c.chip(`${h.plural(evs.length, "event")} this week`, `schedule.html?h=${p.id}&day=all`, { root }) : "",
      ...progCounts.map(([pr, n]) => c.chip(`${c.progName(pr, true)} · ${n}`, `schedule.html?h=${p.id}&p=${pr}&day=all`, { root, prog: pr })),
      vs.length && venueHoods.has(p.id) ? c.chip(h.plural(vs.length, "venue"), `venues.html?h=${p.id}`, { root }) : "",
      ws.length && artHoods.has(p.id) ? c.chip(h.plural(ws.length, "work"), `art.html?h=${p.id}`, { root }) : "",
      fd.length && eatHoods.has(p.id) ? c.chip(`${fd.length} to eat and drink`, `eat-drink.html?h=${p.id}`, { root }) : "",
      st.length ? c.chip(h.plural(st.length, "place to stay", "places to stay"), stayGroupIds.has(`st-${p.id}`) ? `stay.html#st-${p.id}` : `stay.html#${st[0].id}`, { root }) : "",
    ].filter(Boolean).join("");
    const keyV = sortBy(vs, (v) => -v.events.filter((e) => e.live).length, (v) => v.name).slice(0, 8);
    const map = cards.areaMap(root, keyV.filter((v) => v.stall).map((v) => ({ lat: v.lat, lng: v.lng, kind: "venue", prog: v.programs[0] || "also", n: v.stall })), { label: `Map of ${p.name} with its venues`, minHalfM: 450, center: p.lat != null ? { lat: p.lat, lng: p.lng } : null });
    const col = (title, xs, li) => (xs.length ? `<div><h3 class="sub-h">${esc(title)}</h3><ul class="hood-list">${xs.map(li).join("")}</ul></div>` : "");
    return `<section class="section hood" id="${attr(p.id)}" aria-labelledby="${attr(p.id)}-h"><div class="sec-head oxford"><p class="sec-kicker label">${esc([evs.length ? h.plural(evs.length, "event") : "", vs.length ? h.plural(vs.length, "venue") : ""].filter(Boolean).join(" · ") || "Neighborhood")}</p><h2 id="${attr(p.id)}-h">${esc(p.name)}</h2></div>
<div class="hood-top"><div>${p.summary ? `<div class="prose">${h.paras(p.summary)}</div>` : `<p class="faint">No summary published. The neighborhood and its boundary come from OpenStreetMap.</p>`}${detailsBlock(p.details, p.name)}${counts ? `<div class="hood-counts chip-row">${counts}</div>` : ""}</div>${map ? `<div class="hood-map">${map}</div>` : ""}</div>
<div class="hood-cols">
${col("Key venues", keyV, (v) => `<li><a href="${root}venues/${attr(v.id)}.html">${v.stall ? `<span class="stall s" aria-hidden="true">${v.stall}</span>` : `<span class="stall s is-off" aria-hidden="true">–</span>`}<span><b>${esc(v.name)}</b><span class="faint">${esc(v.events.filter((e) => e.live).length ? h.plural(v.events.filter((e) => e.live).length, "event") : v.address || "")}</span></span></a></li>`)}
${col("Food and drink", fd.slice(0, 8), (f) => `<li><a href="${root}eat-drink.html#${attr(f.id)}"><span><b>${esc(f.name)}</b><span class="faint">${esc(f.kind === "drink" ? "Drink" : "Food")}</span></span></a></li>`)}
${col("Places to stay", st.slice(0, 6), (s) => `<li><a href="${root}stay.html#${attr(s.id)}"><span><b>${esc(s.name)}</b>${s.room_block ? `<span class="faint">${esc(c.progName(s.room_block.program))} ${esc(s.room_block.label || "room block")}</span>` : ""}</span></a></li>`)}
</div>
${lm.length ? `<h3 class="sub-h">Landmarks</h3><div class="gps">${lm.map((x) => placeCard(root, x)).join("")}</div>` : ""}
${c.sourceLine([p.source_url])}</section>`;
  };
  const strayLandmarks = kinds(["landmark"]).filter((x) => !x.hood || !place(x.hood));

  const hoodPage = {
    path: "neighborhoods.html", nav: "neighborhoods", title: "Neighborhoods",
    description: "Where the week happens: Over-the-Rhine, downtown, The Banks, Covington and more, with what's on in each, its venues, food and hotels.",
    toc: [...orderedHoods.map((p) => [p.id, p.name.includes("(") ? p.short_name || p.name.replace(/\s*\(.*\)$/, "") : p.name.replace(/, (Kentucky|Ohio)$/, "")]), ...(strayLandmarks.length ? [["hood-landmarks", "Other landmarks"]] : [])],
    body: (root) => `${c.pageHead({ num: 4, kicker: `Visit · ${orderedHoods.length} neighborhoods`, title: "Neighborhoods", lede: "What each neighborhood is, what's on there this week, and its venues, food and hotels. Counts open the filtered schedule and lists." })}
${orderedHoods.map((p) => hoodSection(root, p)).join("\n")}
${strayLandmarks.length ? c.section({ id: "hood-landmarks", title: "Other landmarks", root, body: `<div class="gps">${strayLandmarks.map((x) => placeCard(root, x)).join("")}</div>` }) : ""}`,
  };

  /* ================= eat-drink.html ================= */
  const eats = kinds(PLACE_PAGES["eat-drink"]);
  const eatGroups = sortBy([...h.groupBy(eats, (p) => p.hood || "")], ([k, xs]) => (k ? 0 : 1), ([, xs]) => -xs.length);
  const nearChips = (root, p) => {
    if (p.lat == null) return "";
    const near = sortBy(db.venues.filter((v) => v.lat != null && v.stall).map((v) => ({ v, d: haversine(p, v) })).filter((x) => x.d <= 400), (x) => x.d).slice(0, 3);
    return near.length ? `<p class="near"><span class="label faint">Near · walking estimate</span>${near.map((x) => `<a class="chip" href="${root}venues/${attr(x.v.id)}.html"><span class="stall s" aria-hidden="true">${x.v.stall}</span><span>${esc(x.v.name)}</span><span class="n">${walkMinutes(p, x.v)} min</span></a>`).join("")}</p>` : "";
  };
  const eatCard = (root, p) => `<article class="eat" id="${attr(p.id)}" data-h="${attr(p.hood || "")}" data-q="${attr([p.kind === "drink" ? "drink bar" : "food restaurant", hoodName(p.hood)].join(" "))}"><p class="eat-k label">${p.kind === "drink" ? "Drink" : "Food"}</p><h3>${esc(p.name)}</h3>${p.summary ? `<div class="prose">${h.paras(p.summary)}</div>` : ""}${detailsBlock(p.details, p.name)}${p.address ? `<p class="addr">${esc(p.address)}</p>` : ""}${nearChips(root, p)}<p class="acts">${p.url ? h.extLink(p.url, `Website${h.icon("ext")}`, "btn btn-secondary btn-sm") : ""}${p.lat != null ? dirLinks(p) : ""}</p>${srcHost(p.source_url)}</article>`;
  const eatHoodOpts = eatGroups.filter(([k]) => k).map(([k, xs]) => [k, `${hoodShort(k)} (${xs.length})`]);

  const eatPage = {
    path: "eat-drink.html", nav: "eat-drink", title: "Eat & drink", features: ["directory"],
    description: `${eats.length} places to eat and drink near the week's venues, by neighborhood, as listed by Visit Cincy, The Banks, Findlay Market and the programs.`,
    toc: eatGroups.map(([k]) => [k ? `ed-${k}` : "ed-other", k ? hoodShort(k) : "Elsewhere"]),
    body: (root) => `${c.pageHead({ num: 4, kicker: `Visit · ${eats.length} places`, title: "Eat & drink", lede: "Restaurants, cafes and bars near the venues, by neighborhood, with the venues each one is near. Descriptions are the listing's own words." })}
<div class="dir-tools js-only" data-dir-tools>
${searchField("Search food and drink", "Search by name or kind of food")}
<div class="dir-group"><label class="dir-glabel label" for="ed-h">Where</label><div class="vn-sel"><select class="select" id="ed-h" name="h" data-filter="h"><option value="">Neighborhood: all</option>${eatHoodOpts.map(([v, l]) => `<option value="${attr(v)}">${esc(l)}</option>`).join("")}</select></div></div>
</div>
${dirStatus(eats.length, "places")}
${eatGroups.map(([k, xs]) => `<section class="ed-group" id="${k ? `ed-${attr(k)}` : "ed-other"}" data-dir-group aria-labelledby="${k ? `ed-${attr(k)}` : "ed-other"}-h"><h2 class="sub-h vn-head" id="${k ? `ed-${attr(k)}` : "ed-other"}-h"><span>${esc(k ? hoodShort(k) : "Elsewhere")}</span><span class="label faint" data-dir-count data-one="place" data-many="places">${h.plural(xs.length, "place")}</span></h2><div class="eats" data-dir>${xs.map((p) => eatCard(root, p)).join("")}</div></section>`).join("\n")}
${dirEmpty(c, { title: "Nothing matches", glyph: "utensils" })}
<p class="source-line">${h.icon("info")}<span>“Near” lists numbered venues within 400 m; minutes are walking estimates (straight line × 1.3 at 80 m a minute). Hours change: check each place before you go.</span></p>`,
  };

  return [stayPage, gaPage, hoodPage, eatPage];
}

export function search(ctx) {
  const { db, c } = ctx;
  const label = { neighborhood: "Neighborhood", landmark: "Landmark", food: "Food", drink: "Drink", transit: "Getting around", parking: "Parking", bike: "Bikes", rideshare: "Rides", airport: "Airport", accessibility: "Accessibility", tip: "Tip" };
  return [
    ...db.stays.map((s) => ({ k: "st", id: s.id, t: s.name, s: [s.room_block ? (s.room_block.label ? `${c.progName(s.room_block.program)} ${s.room_block.label}` : "Room block") : "Hotel", s.address].filter(Boolean).join(" · "), u: `stay.html#${s.id}`, p: s.room_block?.program })),
    ...db.places.map((p) => ({ k: "pl", id: p.id, t: p.name, s: p.kind === "facility" ? [FACILITY_LABEL[p.facility], p.map_no != null ? `map No. ${p.map_no}` : "", p.zone].filter(Boolean).join(" · ") : label[p.kind] || p.kind, u: `${PAGE_OF_KIND[p.kind] || "getting-around"}.html#${p.id}`, ...(p.kind === "facility" ? { p: p.program || undefined, ...(p.facility === "restroom" || p.facility === "oasis-station" ? { g: "restroom bathroom toilet" } : {}) } : {}) })),
  ];
}
