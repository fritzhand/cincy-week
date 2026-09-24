/* ============================================================
   build/pages/art.mjs · OWNER: Agent F (directory: people, art, partners)
   STUB landed by Agent A: the works grid, server-rendered. Works have no
   pages; the work dialog opens from art.html?w=<id>. Agent F owns this
   file (filters by program, medium, category and zone; grid/map view;
   engine spec §4.5, DESIGN §9.6).
   ============================================================ */
import { stubPage } from "./_stub.mjs";
import { sortBy } from "../core/util.mjs";

export function pages(ctx) {
  const { db, c, cards } = ctx;
  const works = sortBy(db.works, (w) => w.program, (w) => w.title.toLowerCase());
  return [stubPage(ctx, {
    slug: "art", title: "Art & installations", num: 3, kicker: "Directory",
    lede: "Projection mapping, light installations, murals and exhibitions, with the artists behind them and where to find each one.",
    what: "Filters by program, medium and zone, a map view and the artwork dialog are coming to this page.",
    owner: "directory", features: ["directory"],
    body: (root) => `${c.toolbar({ search: { label: "Search art", placeholder: "Search by title, artist or zone" } })}
${c.resultCount(works.length, works.length, "works")}
<h2 class="sub-h">All works</h2>
<div class="works" data-dir>${works.map((w) => cards.workCard(root, w)).join("")}</div>`,
  })];
}

export function search(ctx) {
  const { db } = ctx;
  return db.works.map((w) => {
    const by = (w.artists || []).map((a) => db.byId.person.get(a)?.name).filter(Boolean).join(", ") || w.artist_text || "";
    return { k: "wo", id: w.id, t: w.title, s: [by, w.zone].filter(Boolean).join(" · "), u: `art.html?w=${w.id}`, p: w.program, g: [w.medium, w.category, w.zone].filter(Boolean).join(" ") };
  });
}
