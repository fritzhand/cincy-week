/* ============================================================
   build/components/work-card.mjs · OWNER: Agent F (directory: people, art, partners)

   makeWorkCards(ctx) → {
     workCard(root, work, { headingLevel = 3, anchor = true })
       article.work (DESIGN.md §9.6): the 4:3 photo (never filtered) and its credit, or the program's
       halftone with the medium glyph and "Photo coming"; a kicker (bullet + medium glyph + medium);
       the serif title, stretched over the card (its link is the deep link art.html?w=<id>, and with JS
       it opens the work dialog); the artists; the zone with a pin; a floating 44px star.
     workFull(root, work, { headingLevel = 3 })
       the whole work for its artist's page (engine §4.5: works have no pages, so the artist's page
       carries the full work for readers without JS and for search engines): 960w image, facts,
       the verbatim description, sponsor and source.
     workMedium(work) → "Light installation" · workGlyph(work) → icon name · workArtists(work) → [names]
     zoneKey(work) → "over-the-rhine" (the art page's zone filter value; spellings of one zone share it)
   }
   Filter data on each card: data-p program · data-m medium (verbatim enum, "|"-separated list) ·
   data-c category slug · data-z zone slug · data-h neighborhood id · data-q search text.
   Only one card per page carries id="w-{id}" (anchor: false elsewhere).
   ============================================================ */
import { esc, attr, slugify, paras } from "../core/util.mjs";
import { icon } from "../core/icons.mjs";
import { norm } from "../../site/js/lib/search.js";

const GLYPH = { "projection mapping": "projector", mural: "brush", painting: "brush", "light installation": "light", "drone show": "light", photography: "projector" };
/** BLINK publishes some artworks with the artist's biography in place of a statement (flag set by the merge). */
export const isArtistBio = (w) => /description_is_artist_bio/.test(w.notes || "");

export function makeWorkCards(ctx) {
  const { db, img, h, c } = ctx;
  const workGlyph = (w) => GLYPH[w.medium] || "brush";
  const workMedium = (w) => (w.medium === "other" ? "Artwork" : w.medium.charAt(0).toUpperCase() + w.medium.slice(1));
  const workArtists = (w) => (w.artists || []).map((a) => db.byId.person.get(a)?.name).filter(Boolean);
  const byLine = (w) => { const a = workArtists(w); return a.length ? h.listJoin(a) : w.artist_text || ""; };
  const zoneKey = (w) => (w.zone ? slugify(w.zone) : "");
  const hoodOf = (w) => (w.venue_id ? db.byId.venue.get(w.venue_id)?.hood || "" : "");
  const where = (w) => w.zone || w.location_text || (w.venue_id ? db.byId.venue.get(w.venue_id)?.name : "") || "";

  function photoBlock(root, w, { big = false } = {}) {
    if (img.has("w", w.id)) {
      const cr = img.credit("w", w.id);
      return `<div class="photo">${img.img(root, "w", w.id, { alt: "", big, sizes: big ? img.SIZES.workBig : img.SIZES.work })}</div><p class="credit label">${cr ? `Photo via ${esc(cr)}` : ""}</p>`;
    }
    return `<div class="photo halftone"><span class="photo-missing">${icon(workGlyph(w))}<span class="label">No photo yet</span></span></div><p class="credit label" aria-hidden="true"></p>`;
  }

  function workCard(root, w, { headingLevel = 3, anchor = true } = {}) {
    const by = byLine(w);
    const z = where(w);
    const H = `h${headingLevel}`;
    const q = norm([w.title, by, w.artist_text, w.zone, w.location_text, w.medium, w.category, w.sponsor].filter(Boolean).join(" "));
    return `<article class="work" data-prog="${w.program}"${anchor ? ` id="w-${attr(w.id)}"` : ""} data-p="${w.program}" data-m="${attr(w.medium)}"${w.category ? ` data-c="${attr(slugify(w.category))}"` : ""}${w.zone ? ` data-z="${attr(zoneKey(w))}"` : ""}${hoodOf(w) ? ` data-h="${attr(hoodOf(w))}"` : ""}${w.lat != null ? ` data-ll="${w.lat},${w.lng}"` : ""} data-q="${attr(q)}">${photoBlock(root, w)}<p class="wk-kicker label">${h.bullet(w.program)}${icon(workGlyph(w))}${esc(workMedium(w))}</p><${H}><a href="${root}art.html?w=${attr(w.id)}" data-open-work="${attr(w.id)}">${esc(w.title)}</a></${H}>${by ? `<p class="by">${esc(by)}</p>` : ""}${z ? `<p class="zone">${icon("pin")}${esc(z)}</p>` : ""}${c.starButton(w.id, w.title, { kind: "w", cls: "floating" })}</article>`;
  }

  /** The full work, for the artist's page: nothing here is shown only by JS. */
  function workFull(root, w, { headingLevel = 3, bioShown = null } = {}) {
    const H = `h${headingLevel}`;
    const v = w.venue_id ? db.byId.venue.get(w.venue_id) : null;
    const artists = (w.artists || []).map((a) => db.byId.person.get(a)).filter(Boolean);
    const facts = [
      ["Medium", esc(workMedium(w))],
      ["Artists", artists.length > 1 ? artists.map((p) => `<a href="${root}people/${attr(p.id)}.html">${esc(p.name)}</a>`).join(", ") : null],
      ["Zone", w.zone && !(v && norm(v.name) === norm(w.zone)) ? esc(w.zone) : null],
      ["Where", v ? `<a href="${root}venues/${attr(v.id)}.html">${esc(v.name)}</a>` : w.location_text ? esc(w.location_text) : null],
      ["Hours", w.hours_text ? esc(w.hours_text) : null],
      ["Sponsor", w.sponsor ? (w.sponsor_org_id && db.byId.org.has(w.sponsor_org_id) ? `<a href="${root}partners.html#o-${attr(w.sponsor_org_id)}">${esc(w.sponsor)}</a>` : esc(w.sponsor)) : null],
    ];
    // BLINK sometimes publishes the artist's biography as the work's text: say so, and don't print it twice
    const same = bioShown && norm(bioShown) === norm(w.description || "");
    const text = !w.description
      ? `<p class="unk">Description not published by the organizers</p>`
      : isArtistBio(w) && same
        ? `<p class="wk-bio-note">The organizers publish the artist's biography (above) in place of a description of this work.</p>`
        : `${isArtistBio(w) ? `<p class="sub-h wk-note">The artist's biography, as the organizers publish it for this work</p>` : ""}<div class="prose">${paras(w.description)}</div>`;
    return `<article class="wk-full" id="w-${attr(w.id)}" data-prog="${w.program}"><div class="wk-media">${photoBlock(root, w, { big: true })}</div><div class="wk-body"><p class="wk-kicker label">${h.bullet(w.program)}${icon(workGlyph(w))}${esc(workMedium(w))}</p><${H} class="wk-title"><a href="${root}art.html?w=${attr(w.id)}" data-open-work="${attr(w.id)}">${esc(w.title)}</a></${H}>${c.facts(root, facts)}${text}<p class="btn-row">${c.starButton(w.id, w.title, { kind: "w" })}${w.lat != null ? `<a class="btn btn-secondary btn-sm" href="${root}map.html?focus=work:${attr(w.id)}">${icon("map")}On the map</a>` : ""}</p>${c.sourceLine([w.source_url])}</div></article>`;
  }

  return { workCard, workFull, workMedium, workGlyph, workArtists, zoneKey };
}
