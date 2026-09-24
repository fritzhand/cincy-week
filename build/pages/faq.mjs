/* ============================================================
   build/pages/faq.mjs · OWNER: Agent G (home, programs & info)
   faq.html: the programs' own questions and answers (data/faqs.json), grouped by program
   and, within a program, by the organizers' own topic headings. Each question is a
   <details id="<faq id>"> (search results link to faq.html#<id>); answers are verbatim,
   each with its source. Program chips (?p=) and a search box (?q=) filter the list
   (features/faq.js); without JS every question is there, closed, in order.
   ============================================================ */
import { norm } from "../../site/js/lib/search.js";

export function pages(ctx) {
  const { db, c, h } = ctx;
  const { esc, attr, icon } = h;
  const order = [...c.programIds, null];
  const groups = order.map((p) => [p, db.faqs.filter((f) => (f.program || null) === p)]).filter(([, fs]) => fs.length);
  const gid = (p) => `faq-${p || "general"}`;
  const item = (f) => `<details class="faq" id="${attr(f.id)}" data-p="${attr(f.program || "")}" data-q="${attr(norm(`${f.q} ${f.a} ${f.topic || ""}`))}"><summary>${esc(f.q)}</summary><div class="prose">${h.paras(f.a)}</div>${c.sourceLine([f.source_url])}</details>`;
  const group = ([p, fs]) => {
    const topics = h.groupBy(fs, (f) => f.topic || "");
    const body = [...topics].map(([t, xs]) => `${t && topics.size > 1 ? `<h3 class="sub-h faq-topic">${esc(t)}</h3>` : ""}<div class="faq-list" data-faq-list>${xs.map(item).join("\n")}</div>`).join("\n");
    return `<section class="section faq-group" id="${gid(p)}" aria-labelledby="${gid(p)}-h" data-faq-group${p ? ` data-prog="${p}"` : ""}>
<div class="sec-head oxford"><p class="sec-kicker label">${p ? h.bullet(p) : ""}${esc(h.plural(fs.length, "question"))}${topics.size === 1 && [...topics.keys()][0] ? ` · ${esc([...topics.keys()][0])}` : ""}</p><h2 id="${gid(p)}-h">${esc(p ? c.progName(p) : "General questions")}</h2></div>
${body}
</section>`;
  };
  const tools = `<div class="faq-tools js-only" data-faq-tools>
<label class="field faq-search">${icon("search")}<span class="sr-only">Search the questions and answers</span><input type="search" name="q" placeholder="Search questions and answers" autocomplete="off" data-faq-q></label>
<div class="chip-row" role="group" aria-label="Programs">${groups.filter(([p]) => p).map(([p, fs]) => c.chip(c.progName(p, true), null, { prog: p, pressed: false, count: fs.length, attrs: `data-faq-p="${p}"` })).join("")}</div>
${c.resultCount(db.faqs.length, db.faqs.length, "questions")}
<button class="btn btn-ghost btn-sm" type="button" data-faq-clear hidden>Clear filters</button>
</div>`;
  return [{
    path: "faq.html", nav: "faq", title: "FAQ", features: ["faq"],
    description: "Questions and answers about Cincinnati Art Week, StartupCincy Week, BLINK and the FotoFocus Biennial, in the organizers' own words, with sources.",
    toc: groups.length >= 2 ? groups.map(([p]) => [gid(p), p ? c.progName(p) : "General"]) : undefined,
    body: (root) => `${c.pageHead({ num: 4, kicker: `Visit · ${h.plural(db.faqs.length, "question")}`, title: "FAQ", lede: "The programs' own questions and answers, in their words. Each answer links to the page it was published on; check it before you go, since answers can change." })}
${db.faqs.length ? tools : ""}
${groups.length ? groups.map(group).join("\n") : c.emptyState({ title: "No questions yet", body: "Questions appear here as the programs publish them.", glyph: "help" })}
${c.emptyState({ title: "No questions match", body: "Try another word, or clear the filters.", glyph: "help", attrs: "data-faq-empty hidden" })}
<p class="faq-note faint">Not answered here? Each program's official site has its full FAQ: ${db.programs.filter((p) => p.url).map((p) => h.extLink(p.url, esc(h.hostOf(p.url)))).join(" · ")}.</p>`,
  }];
}

export function search(ctx) {
  return ctx.db.faqs.map((f) => ({ k: "fq", id: f.id, t: f.q, s: f.program ? ctx.c.progName(f.program) : "FAQ", u: `faq.html#${f.id}`, p: f.program || undefined, g: f.topic || "" }));
}
