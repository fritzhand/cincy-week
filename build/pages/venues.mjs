/* ============================================================
   build/pages/venues.mjs · OWNER: Agent E (map, venues & visit)
   STUB landed by Agent A: venues grouped by neighborhood, and one page per
   venue (venues/<id>.html) with facts, mini-map, walking directions, what's
   on there by day, works and sources. Agent E owns this file (filters,
   List/Map, nearby; engine spec §4.5, DESIGN §9.7 and §9.13).
   ============================================================ */
import { sortBy } from "../core/util.mjs";

export function pages(ctx) {
  const { db, c, h, cards, config, seo } = ctx;
  const { esc } = h;
  const hoodName = (id) => db.byId.place.get(id)?.name || "Other places";
  const groups = sortBy([...db.venuesByHood], ([k]) => (k ? 0 : 1), ([k]) => hoodName(k));
  const list = {
    path: "venues.html", nav: "venues", title: "Venues", features: ["directory"],
    description: `The ${db.venues.length} venues of the week, by neighborhood, with addresses and walking directions.`,
    body: (root) => `${c.pageHead({ num: 3, kicker: "Directory", title: "Venues", lede: "Every venue with its address and neighborhood. Numbered venues are on the map with the same number." })}
${groups.map(([hood, vs]) => `<h2 class="sub-h" id="${hood ? `hood-${hood}` : "hood-other"}">${esc(hood ? hoodName(hood) : "Other places")}</h2><ul class="venues">${vs.map((v) => cards.venueCard(root, v)).join("")}</ul>`).join("\n")}
${c.placeholder("Filters, a map view and today's events at each venue are coming to this page.", "venues")}`,
  };
  const detail = db.venues.map((v) => {
    const hood = v.hood ? db.byId.place.get(v.hood) : null;
    const d = v.lat != null ? cards.directions(v.lat, v.lng) : null;
    const byDay = new Map();
    for (const e of v.events) for (const x of e.instances) { if (!byDay.has(x.day)) byDay.set(x.day, []); byDay.get(x.day).push(x); }
    const days = [...byDay.keys()].sort();
    const works = db.worksByVenue.get(v.id) || [];
    return {
      path: `venues/${v.id}.html`, nav: "venues", title: v.name,
      description: h.truncate(`${v.name}${v.address ? `, ${v.address}` : ""}${hood ? ` (${hood.name})` : ""}: what's on here during the week, with walking directions.`, 155),
      crumbs: [["Overview", "index.html"], ["Venues", "venues.html"], [v.name, null]],
      jsonld: seo.placeLd(v, { url: `${config.siteBase}venues/${v.id}.html` }),
      body: (root) => `${c.pageHead({ kicker: v.stall ? `Venue ${v.stall}` : "Venue", num: 3, title: v.name, lede: [v.address, hood?.name || v.neighborhood].filter(Boolean).join(" · ") })}
<div class="vp-top">
<div>${c.facts(root, [
  ["Address", v.address ? esc([v.address, v.city, v.state].filter(Boolean).join(", ")) : '<span class="unk">Address not listed</span>'],
  ["Neighborhood", hood ? `<a href="${root}neighborhoods.html#${hood.id}">${esc(hood.name)}</a>` : v.neighborhood ? esc(v.neighborhood) : null],
  ["Programs", v.programs.length ? v.programs.map((p) => c.progBadge(p)).join(" ") : null],
  ["Website", v.url ? h.extLink(v.url, esc(h.hostOf(v.url))) : null],
])}
${d ? `<p class="btn-row">${h.extLink(d.apple, `${h.icon("walk")}Apple Maps`, "btn btn-secondary btn-sm")}${h.extLink(d.google, `${h.icon("walk")}Google Maps`, "btn btn-secondary btn-sm")}</p>` : `<p><span class="badge badge-unconfirmed">Address unconfirmed · not on the map</span></p>`}</div>
<div>${cards.miniMap(root, v.lat, v.lng, { prog: v.programs[0] || "also", n: v.stall || "", label: `Map of ${v.name}` })}</div>
</div>
<div class="byday">${days.length ? days.map((day) => `<h2 class="sub-h">${esc(h.fmtDayLong(day))}</h2><ol class="tonight">${byDay.get(day).map((x) => cards.eventRow(root, x)).join("")}</ol>`).join("") : `<p class="unk">No events listed here yet</p>`}</div>
${works.length ? `<h2 class="sub-h">Works here</h2><div class="works">${works.map((w) => cards.workCard(root, w, { headingLevel: 3 })).join("")}</div>` : ""}
${c.sourceLine([v.source_url])}`,
    };
  });
  return [list, ...detail];
}

export function search(ctx) {
  const { db } = ctx;
  return db.venues.map((v) => ({ k: "ve", id: v.id, t: v.name, s: [v.address, db.byId.place.get(v.hood)?.name || v.neighborhood].filter(Boolean).join(" · "), u: `venues/${v.id}.html`, p: v.programs[0], g: [...(v.aliases || []), v.kind].join(" ") }));
}
