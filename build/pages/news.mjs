/* ============================================================
   build/pages/news.mjs · OWNER: Agent G (home, programs & info)
   news.html: coverage of the week from data/news.json (scripts/fetch-cincy-news.py
   merges Google News results into the curated research items). Newest first; this
   year's coverage, then background (earlier editions, history). Every headline links
   to the publisher; the one-line summaries are the guide's. Program chips and a
   source menu filter the list (features/news.js, ?p= in the URL); without JS the
   whole list is there.
   Also exports newsCard() and latestNews() for the home and program pages.
   ============================================================ */
import { sortBy } from "../core/util.mjs";

const KIND_LABEL = { "press-release": "Press release", opinion: "Opinion", sponsored: "Sponsored", guide: "Guide", profile: "Profile", "organizer-post": "Organizer post", history: "Background", article: "", news: "" };

/** Current coverage: not a background item, dated this year or last, newest first. */
export function latestNews(db, n = 8, { programs = null } = {}) {
  const year = Number(db.config?.week?.start?.slice(0, 4)) || 2026;
  return sortBy(db.news.filter((x) => x.kind !== "history" && Number(String(x.date).slice(0, 4)) >= year - 1
    && (!programs || (x.programs || []).some((p) => programs.includes(p)))), (x) => x.date).reverse().slice(0, n);
}

const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** One news card: source · date (· kind), the headline linked to the publisher, our summary, program badges. */
export function newsCard(ctx, root, n, { anchor = true, level = 3 } = {}) {
  const { h, c } = ctx;
  const { esc, attr } = h;
  const kind = KIND_LABEL[n.kind] ?? "";
  const progs = n.programs || [];
  const H = `h${level}`;
  return `<article class="news-card"${anchor ? ` id="n-${attr(n.id)}"` : ""} data-p="${attr(progs.join(" "))}" data-src="${attr(slug(n.source))}">
<p class="news-meta label"><span>${esc(n.source)}</span><time datetime="${attr(n.date)}">${esc(h.fmtDate(n.date))}, ${esc(String(n.date).slice(0, 4))}</time>${kind ? `<span class="news-kind${n.kind === "sponsored" ? " is-sponsored" : ""}">${esc(kind)}</span>` : ""}</p>
<${H} class="news-title">${h.extLink(n.url, esc(n.title), "stretched")}</${H}>
${n.summary ? `<p class="news-sum">${esc(n.summary)}</p>` : ""}
${progs.length ? `<p class="news-progs">${progs.map((p) => c.progBadge(p)).join("")}</p>` : ""}
<p class="news-host">${esc(h.hostOf(n.url))}</p>
</article>`;
}

export function pages(ctx) {
  const { db, c, h, config } = ctx;
  const { esc, attr } = h;
  const year = config.week.start.slice(0, 4);
  const all = sortBy(db.news, (n) => n.date).reverse();
  const current = all.filter((n) => n.kind !== "history" && n.date.slice(0, 4) === year);
  const background = all.filter((n) => !current.includes(n));
  const progs = c.programIds.filter((p) => db.news.some((n) => (n.programs || []).includes(p)));
  const sources = sortBy([...new Set(db.news.map((n) => n.source))], (s) => s.toLowerCase());
  const count = (p) => db.news.filter((n) => (n.programs || []).includes(p)).length;
  const toolbar = `<div class="news-tools js-only" data-news-tools>
<div class="chip-row" role="group" aria-label="Programs">${progs.map((p) => c.chip(c.progName(p, true), null, { prog: p, pressed: false, count: count(p), attrs: `data-news-p="${p}"` })).join("")}</div>
<label class="news-src-pick"><span class="label">Source</span><select class="select" data-news-src><option value="">All sources (${sources.length})</option>${sources.map((s) => `<option value="${attr(slug(s))}">${esc(s)}</option>`).join("")}</select></label>
${c.resultCount(all.length, all.length, "stories")}
<button class="btn btn-ghost btn-sm" type="button" data-news-clear hidden>Clear filters</button>
</div>`;
  const grid = (items) => `<div class="news-grid">${items.map((n) => newsCard(ctx, "", n)).join("\n")}</div>`;
  const toc = [["news-now", `${year} coverage`], ...(background.length ? [["news-background", "Background"]] : [])];
  return [{
    path: "news.html", nav: "news", title: "News", features: ["news"], toc,
    description: "Coverage of Cincinnati Art Week, StartupCincy Week, BLINK and the FotoFocus Biennial from the region's newsrooms, linked to the publishers.",
    body: (root) => `${c.pageHead({ num: 5, kicker: `Reference · ${h.plural(all.length, "story", "stories")} from ${h.plural(sources.length, "source")}`, title: "News", lede: "Coverage of the week from the region's newsrooms and the programs' own newsrooms. Headlines link to the publisher; where a one-line summary appears, it is this guide's." })}
${toolbar}
${all.length ? `${c.section({ id: "news-now", kicker: "This year", title: `${year} coverage`, body: current.length ? grid(current) : c.emptyState({ title: `No ${year} stories yet`, body: "Headlines appear here as the region's outlets cover the week.", glyph: "news" }) })}
${background.length ? c.section({ id: "news-background", kicker: "Earlier editions and history", title: "Background", body: grid(background) }) : ""}
${c.emptyState({ title: "No stories match these filters", body: "Clear the filters to see every story.", glyph: "news", attrs: "data-news-empty hidden" })}` : c.emptyState({ title: "No news yet", body: "Headlines appear here as the region's outlets cover the week.", glyph: "news" })}
<p class="news-note faint">Stories are gathered from Google News searches and the programs' press pages, and each links to its publisher. ${h.extLink(`${config.repo}/issues`, "Report a wrong or missing story")}.</p>`,
  }];
}

/** Search: this year's coverage and recent stories (background items stay on news.html, out of the palette). */
export function search(ctx) {
  const year = ctx.config.week.start.slice(0, 4);
  return ctx.db.news.filter((n) => n.kind !== "history").map((n) => ({ k: "nw", id: n.id, t: n.title, s: `${n.source} · ${ctx.h.fmtDate(n.date)}${n.date.slice(0, 4) === year ? "" : `, ${n.date.slice(0, 4)}`}`, u: `news.html#n-${n.id}`, p: (n.programs || [])[0] }));
}
