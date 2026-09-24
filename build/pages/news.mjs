/* ============================================================
   build/pages/news.mjs · OWNER: Agent G (home, programs & info)
   STUB landed by Agent A: news cards from data/news.json (the fetch
   script's output), newest first, each linking straight to the publisher.
   Agent G owns this file (sources chips, program filter; SIG news page).
   ============================================================ */
import { sortBy } from "../core/util.mjs";

export function pages(ctx) {
  const { db, c, h } = ctx;
  const { esc } = h;
  const news = sortBy(db.news, (n) => n.date).reverse();
  return [{
    path: "news.html", nav: "news", title: "News", features: [],
    description: "Coverage of Cincinnati Art Week, StartupCincy Week, BLINK and FotoFocus from Cincinnati outlets, linked to the publishers.",
    body: (root) => `${c.pageHead({ num: 5, kicker: "Reference", title: "News", lede: "Coverage of the week from the region's newsrooms. Headlines link straight to the publisher; the short summaries are ours." })}
${news.length ? `<div class="grid">${news.map((n) => `<article class="card news-card" id="n-${h.attr(n.id)}"><p class="label faint">${esc(n.source)} · <time datetime="${n.date}">${esc(h.fmtDay(n.date))}</time></p><h2 class="h-card">${h.extLink(n.url, esc(n.title), "stretched")}</h2>${n.summary ? `<p class="muted">${esc(n.summary)}</p>` : ""}<p class="head-chips">${(n.programs || []).map((p) => c.progBadge(p)).join("")}</p></article>`).join("")}</div>` : c.emptyState({ title: "No news yet", body: "Headlines appear here as the region's outlets cover the week.", glyph: "news" })}
${c.placeholder("Source and program filters are coming to this page.", "news")}`,
  }];
}

export function search(ctx) {
  return ctx.db.news.map((n) => ({ k: "nw", id: n.id, t: n.title, s: `${n.source} · ${ctx.h.fmtDay(n.date)}`, u: `news.html#n-${n.id}`, p: (n.programs || [])[0] }));
}
