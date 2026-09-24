/* ============================================================
   build/pages/visit.mjs · OWNER: Agent E (map, venues & visit)
   STUB landed by Agent A: stay.html, getting-around.html, neighborhoods.html
   and eat-drink.html from data/stays.json and data/places.json, each record
   with its source. Agent E owns this file (room blocks, computed walking
   distances to hubs, the walking matrix, maps; engine spec §4.5, DESIGN §9.9).
   ============================================================ */
import { stubPage } from "./_stub.mjs";
import { sortBy } from "../core/util.mjs";

/** Which page lists each places.json kind (every kind in schema PLACE_KINDS must appear exactly once, so every
 *  place renders somewhere and its search entry resolves). */
const PLACE_PAGES = {
  neighborhoods: ["neighborhood"],
  "eat-drink": ["food", "drink"],
  "getting-around": ["transit", "parking", "bike", "rideshare", "airport", "accessibility", "tip", "landmark"],
};
const PAGE_OF_KIND = Object.fromEntries(Object.entries(PLACE_PAGES).flatMap(([pg, ks]) => ks.map((k) => [k, pg])));

export function pages(ctx) {
  const { db, c, h, cards } = ctx;
  const { esc } = h;
  const placeCard = (root, p) => `<article class="card" id="${h.attr(p.id)}"><h2 class="h-card">${esc(p.name)}</h2>${p.summary ? `<div class="prose">${h.paras(p.summary)}</div>` : ""}${p.details ? `<details><summary>More</summary><div class="prose">${h.paras(p.details)}</div></details>` : ""}${p.address ? `<p class="faint">${esc(p.address)}</p>` : ""}${c.sourceLine([p.source_url])}</article>`;
  const kinds = (ks) => db.places.filter((p) => ks.includes(p.kind));
  const stays = sortBy(db.stays, (s) => (s.room_block ? 0 : 1), (s) => s.name);
  const hoods = kinds(["neighborhood"]);
  return [
    stubPage(ctx, {
      slug: "stay", title: "Where to stay", num: 4, kicker: "Visit",
      lede: "Hotels near the week's venues. Program room blocks come first, with their codes and rates as published.",
      what: "Walking times from each hotel to the week's hubs and a map are coming to this page.", owner: "visit",
      body: (root) => `<div class="stays">${stays.map((s) => `<article class="stay"${s.room_block ? ` data-prog="${s.room_block.program}"` : ""} id="${h.attr(s.id)}"><h2 class="h-card">${esc(s.name)}</h2>${s.address ? `<p class="addr">${esc(s.address)}</p>` : ""}${s.room_block ? `<div class="block"><p class="bh label">${h.bullet(s.room_block.program)}${esc(c.progName(s.room_block.program))} room block</p><dl>${[["Group code", s.room_block.group_code], ["Rate", s.room_block.rate], ["Dates", s.room_block.dates], ["Book by", s.room_block.deadline]].map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v ? esc(v) : '<span class="unk">not published</span>'}</dd>`).join("")}</dl></div>` : ""}<p class="acts">${s.url ? h.extLink(s.url, `Hotel site${h.icon("ext")}`, "btn btn-secondary btn-sm") : ""}${s.room_block?.booking_url ? h.extLink(s.room_block.booking_url, `Book the block${h.icon("ext")}`, "btn btn-primary btn-sm") : ""}</p>${c.sourceLine([s.source_url])}</article>`).join("")}</div>`,
    }),
    stubPage(ctx, {
      slug: "getting-around", title: "Getting around", num: 4, kicker: "Visit",
      lede: "The streetcar, parking, bikes and rides between the week's neighborhoods, from official sources.",
      what: "The streetcar route map, walking times between hubs and BLINK-night tips are coming to this page.", owner: "visit",
      body: (root) => `<div class="grid">${kinds(PLACE_PAGES["getting-around"]).map((p) => placeCard(root, p)).join("")}</div>`,
    }),
    stubPage(ctx, {
      slug: "neighborhoods", title: "Neighborhoods", num: 4, kicker: "Visit",
      lede: "Where the week happens: what each neighborhood is, and which venues are there.",
      what: "What's on in each neighborhood this week, with counts that open the filtered schedule, is coming to this page.", owner: "visit",
      toc: hoods.length >= 2 ? hoods.map((p) => [p.id, p.short_name || p.name]) : undefined,
      body: (root) => hoods.map((p) => `<section class="section" id="${h.attr(p.id)}" aria-labelledby="${h.attr(p.id)}-h"><div class="sec-head oxford"><h2 id="${h.attr(p.id)}-h">${esc(p.name)}</h2></div>${p.summary ? `<div class="prose">${h.paras(p.summary)}</div>` : ""}${(db.venuesByHood.get(p.id) || []).length ? `<ul class="venues">${db.venuesByHood.get(p.id).map((v) => cards.venueCard(root, v).replace(/ id="v-[^"]+"/, "")).join("")}</ul>` : ""}${c.sourceLine([p.source_url])}</section>`).join("\n"),
    }),
    stubPage(ctx, {
      slug: "eat-drink", title: "Eat & drink", num: 4, kicker: "Visit",
      lede: "Places to eat and drink near the venues, as listed by the city's visitor bureau and the programs.",
      what: "Places grouped by neighborhood, with the venues each is near, are coming to this page.", owner: "visit",
      body: (root) => `<div class="grid">${kinds(PLACE_PAGES["eat-drink"]).map((p) => placeCard(root, p)).join("")}</div>`,
    }),
  ];
}

export function search(ctx) {
  const { db } = ctx;
  return [
    ...db.stays.map((s) => ({ k: "st", id: s.id, t: s.name, s: [s.room_block ? "Room block" : "Hotel", s.address].filter(Boolean).join(" · "), u: `stay.html#${s.id}` })),
    ...db.places.map((p) => ({ k: "pl", id: p.id, t: p.name, s: p.kind.charAt(0).toUpperCase() + p.kind.slice(1), u: `${PAGE_OF_KIND[p.kind] || "getting-around"}.html#${p.id}` })),
  ];
}
