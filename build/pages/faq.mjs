/* ============================================================
   build/pages/faq.mjs · OWNER: Agent G (home, programs & info)
   STUB landed by Agent A: questions grouped by program, each a <details>
   whose id is the FAQ id (search links to faq.html#<id>), answers verbatim
   from the programs, each with its source. Agent G owns this file
   (topic grouping, filter chips, search; engine spec §4.5).
   ============================================================ */
import { PROGRAM_IDS } from "../core/schema.mjs";

export function pages(ctx) {
  const { db, c, h } = ctx;
  const { esc } = h;
  const groups = [...PROGRAM_IDS, null].map((p) => [p, db.faqs.filter((f) => (f.program || null) === p)]).filter(([, fs]) => fs.length);
  return [{
    path: "faq.html", nav: "faq", title: "FAQ", features: ["faq"],
    description: "Answers to common questions about the week's programs, in the organizers' own words, with sources.",
    toc: groups.length >= 2 ? groups.map(([p]) => [`faq-${p || "general"}`, p ? c.progName(p) : "General"]) : undefined,
    body: (root) => `${c.pageHead({ num: 4, kicker: "Visit", title: "FAQ", lede: "Common questions, answered in the organizers' own words. Each answer links to where it was published." })}
${groups.map(([p, fs]) => `<section class="section" id="faq-${p || "general"}" aria-labelledby="faq-${p || "general"}-h"${p ? ` data-prog="${p}"` : ""}><div class="sec-head oxford"><p class="sec-kicker label">${p ? h.bullet(p) : ""}${esc(p ? c.progName(p) : "General")}</p><h2 id="faq-${p || "general"}-h">${esc(p ? `About ${c.progName(p)}` : "General questions")}</h2></div>
${fs.map((f) => `<details class="faq" id="${h.attr(f.id)}"><summary>${esc(f.q)}</summary><div class="prose">${h.paras(f.a)}</div>${c.sourceLine([f.source_url])}</details>`).join("\n")}
</section>`).join("\n")}
${c.placeholder("Filters by program and topic, and a search box, are coming to this page.", "faq")}`,
  }];
}

export function search(ctx) {
  return ctx.db.faqs.map((f) => ({ k: "fq", id: f.id, t: f.q, s: f.program ? ctx.c.progName(f.program) : "FAQ", u: `faq.html#${f.id}`, p: f.program || undefined, g: f.topic || "" }));
}
