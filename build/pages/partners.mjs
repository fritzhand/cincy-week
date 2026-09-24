/* ============================================================
   build/pages/partners.mjs · OWNER: Agent F (directory: people, art, partners)
   STUB landed by Agent A: logo walls grouped by program, then tier, from
   data/orgs.json (db.orgsByProgram). Orgs have no pages; each plate links
   out and carries id="o-<id>" for search. Agent F owns this file.
   ============================================================ */
import { PROGRAM_IDS } from "../core/schema.mjs";

export function pages(ctx) {
  const { db, c, h, cards } = ctx;
  const progs = PROGRAM_IDS.filter((p) => db.orgsByProgram.has(p));
  return [{
    path: "partners.html", nav: "partners", title: "Sponsors & partners", features: ["directory"],
    description: "The organizers, sponsors and partners behind each program, as listed on the programs' own sites.",
    body: (root) => {
      const seen = new Set();
      return `${c.pageHead({ num: 3, kicker: "Directory", title: "Sponsors & partners", lede: "The organizations behind each program, grouped the way each program lists them. Logos link to their sites." })}
${progs.map((p) => {
  const src = db.programs.find((x) => x.id === p)?.url;
  return `<section class="wall-group" data-prog="${p}" aria-labelledby="wall-${p}"><div class="wall-head">${h.bullet(p, "lg")}<h2 id="wall-${p}">${h.esc(c.progName(p))}</h2>${src ? `<span class="cap label">As listed on ${h.esc(h.hostOf(src))}</span>` : ""}</div>${cards.logoWall(root, db.orgsByProgram.get(p), seen)}</section>`;
}).join("\n")}
${c.placeholder("Program filters and the official program marks are coming to this page.", "directory")}`;
    },
  }];
}

export function search(ctx) {
  const { db } = ctx;
  return db.orgs.map((o) => ({ k: "or", id: o.id, t: o.name, s: o.roles.map((r) => [r.tier || r.relationship, ctx.c.progName(r.program, true)].join(", ")).join(" · "), u: `partners.html#o-${o.id}`, p: o.roles[0]?.program, i: ctx.img.path("o", o.id) }));
}
