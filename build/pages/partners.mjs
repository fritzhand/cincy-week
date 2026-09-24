/* ============================================================
   build/pages/partners.mjs · OWNER: Agent F (directory: people, art, partners)
   partners.html: logo walls grouped by program, then by tier in each program's own order
   (db.orgsByProgram is ordered by tier_rank from the source), DESIGN §9.8. Logos are shown
   unaltered on the plate they were made for (white, or black for light-on-dark logos: the image
   manifest's tone), so the wall reads the same in both editions; a missing logo is a text plate.
   Orgs have no pages: each plate links out, and carries id="o-<id>" for search hits.
   Filters (site/js/features/directory.js): ?p= program chips, search, and ?tier=<tier slug> deep links.
   A last group shows the official program marks, unaltered.
   ============================================================ */
import { esc, attr, slugify } from "../core/util.mjs";
import { PROGRAM_IDS } from "../core/schema.mjs";
import { searchField, filterGroup, dirStatus, dirEmpty } from "./_directory.mjs";

export function pages(ctx) {
  const { db, c, h, cards, img } = ctx;
  const progs = PROGRAM_IDS.filter((p) => (db.orgsByProgram.get(p) || []).length);
  // one plate per org per tier (an org can hold two roles in one tier)
  const walls = progs.map((p) => {
    const seen = new Set();
    const entries = db.orgsByProgram.get(p).filter((x) => { const k = `${cards.tierLabel(x.role)}|${x.org.id}`; if (seen.has(k)) return false; seen.add(k); return true; });
    return [p, entries];
  });
  const plates = walls.reduce((n, [, xs]) => n + xs.length, 0);
  const marks = db.programs.filter((p) => img.has("o", `prog-${p.id}`));
  const tiers = new Map();
  for (const [p, xs] of walls) for (const x of xs) { const t = cards.tierLabel(x.role); tiers.set(slugify(t), t); }
  const progOpts = walls.map(([p, xs]) => ({ v: p, label: c.progName(p, true), prog: p, count: xs.length }));
  const withLogo = db.orgs.filter((o) => img.has("o", o.id)).length;
  const hostFor = (p) => { const prog = db.byId.program.get(p); return prog && prog.url ? h.hostOf(prog.url) : ""; };

  return [{
    path: "partners.html", nav: "partners", title: "Sponsors & partners", features: ["directory"],
    description: `The ${db.orgs.length} organizers, sponsors and partners behind each program, grouped by program and tier as the programs list them.`,
    body: (root) => {
      const seen = new Set();
      return `${c.pageHead({ num: 3, kicker: `Directory · ${db.orgs.length} organizations`, title: "Sponsors & partners", lede: "The organizations behind each program, grouped by program and tier the way each program lists them. Logos link to their sites." })}
<div class="dir-tools js-only" data-dir-tools>
${searchField("Search sponsors and partners", "Search by name")}
${filterGroup({ key: "p", label: "Program", options: progOpts })}
${filterGroup({ key: "tier", label: "Tier", options: [...tiers].map(([v, label]) => ({ v, label })), hidden: true })}
</div>
${dirStatus(plates + marks.length, "listings")}
${walls.map(([p, xs]) => `<section class="wall-group" data-dir-group data-prog="${p}" aria-labelledby="wall-${p}"><div class="wall-head">${h.bullet(p, "lg")}<h2 id="wall-${p}">${esc(c.progName(p))}</h2>${hostFor(p) ? `<span class="cap label">As listed on ${esc(hostFor(p))}</span>` : ""}</div>${cards.logoWall(root, xs, seen, { prog: p })}</section>`).join("\n")}
${marks.length ? `<section class="wall-group wall-marks" data-dir-group aria-labelledby="wall-marks"><div class="wall-head"><h2 id="wall-marks">Program marks</h2><span class="cap label">Official logos, unaltered</span></div><div class="wall-tier" data-dir-group><div class="plates lg" data-dir>${marks.map((p) => `<span class="plate"${img.entry("o", `prog-${p.id}`).tone === "dark" ? ' data-tone="dark"' : ""} data-p="${p.id}" data-q="${attr(c.progName(p.id).toLowerCase())}">${img.img(root, "o", `prog-${p.id}`, { alt: `${c.progName(p.id)} logo` })}</span>`).join("")}</div></div></section>` : ""}
${dirEmpty(c, { title: "No organizations match these filters", glyph: "plates" })}
<p class="source-line">${h.icon("info")}<span>Tiers and names are as each program lists them on its own site; ${withLogo} of ${db.orgs.length} organizations have a published logo. Logos belong to their owners.</span></p>`;
    },
  }];
}

export function search(ctx) {
  const { db, c, cards, img } = ctx;
  return db.orgs.map((o) => {
    const s = o.roles.map((r) => `${cards.tierLabel(r)}, ${c.progName(r.program, true)}`).join(" · ");
    const g = [...new Set(o.roles.map((r) => r.relationship))].filter((r) => !s.toLowerCase().includes(r)).join(" ");
    const i = img.path("o", o.id);
    return { k: "or", id: o.id, t: o.name, s, u: `partners.html#o-${o.id}`, p: o.roles[0]?.program, ...(g ? { g } : {}), ...(i ? { i } : {}) };
  });
}
