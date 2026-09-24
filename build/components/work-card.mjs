/* ============================================================
   build/components/work-card.mjs · OWNER: Agent F (directory)
   Landed by Agent A as a working stub; Agent F owns it.

   makeWorkCards(ctx) → { workCard(root, work, { headingLevel }) }
   article.work[data-prog] (DESIGN.md §9.6): 4:3 photo or halftone "Photo coming", credit,
   kicker (bullet + medium glyph + medium), serif title (the link opens ?w=), artist, zone, floating star.
   ============================================================ */
import { esc, attr, hostOf } from "../core/util.mjs";
import { icon } from "../core/icons.mjs";
import { norm } from "../../site/js/lib/search.js";

const GLYPH = { "projection mapping": "projector", mural: "brush", "light installation": "light", "drone show": "light", painting: "brush" };

export function makeWorkCards(ctx) {
  const { db, img, h, c } = ctx;
  function workCard(root, w, { headingLevel = 3 } = {}) {
    const artists = (w.artists || []).map((a) => db.byId.person.get(a)?.name).filter(Boolean);
    const by = artists.length ? artists.join(", ") : w.artist_text || "";
    const medium = w.medium.charAt(0).toUpperCase() + w.medium.slice(1);
    const H = `h${headingLevel}`;
    const photo = img.has("w", w.id)
      ? `<div class="photo">${img.img(root, "w", w.id, { alt: `${w.title}, ${w.medium}` })}</div><p class="credit label">Photo: ${esc(hostOf(w.source_url))}</p>`
      : `<div class="photo halftone"><span class="photo-missing">${icon(GLYPH[w.medium] || "light")}<span class="label">Photo coming</span></span></div>`;
    return `<article class="work" data-prog="${w.program}" id="w-${attr(w.id)}" data-p="${w.program}" data-m="${attr(w.medium)}" data-z="${attr(w.zone || "")}" data-q="${attr(norm([w.title, by, w.zone, w.medium].filter(Boolean).join(" ")))}">${photo}<p class="wk-kicker label">${h.bullet(w.program)}${icon(GLYPH[w.medium] || "light")}${esc(medium)}</p><${H}><a href="${root}art.html?w=${attr(w.id)}" data-open-work="${attr(w.id)}">${esc(w.title)}</a></${H}>${by ? `<p class="by">${esc(by)}</p>` : ""}${w.zone || w.location_text ? `<p class="zone">${icon("pin")}${esc(w.zone || w.location_text)}</p>` : ""}${c.starButton(w.id, w.title, { kind: "w", cls: "floating" })}</article>`;
  }
  return { workCard };
}
