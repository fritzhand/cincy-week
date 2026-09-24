/* ============================================================
   build/pages/home.mjs · OWNER: Agent G (home, programs & info)
   STUB landed by Agent A: masthead (folio, nameplate, river rule), the lead,
   a static "First up" ear, program cards and derived counts. Agent G owns
   this file and replaces it with the phase-aware home (ticker, At this hour,
   Tonight, the week line, highlights, doors, latest news).
   ============================================================ */
import { PROGRAM_PAGES } from "../nav.mjs";

export function pages(ctx) {
  const { db, c, h, cards, config } = ctx;
  const { esc, attr, icon, bullet } = h;
  const first = db.instances.filter((x) => x.ev.live && !x.ongoing && x.day >= config.week.start).slice(0, 4);
  const card = (root, pp) => {
    const p = db.byId.program.get(pp.programs[0]);
    if (!p) return "";
    const desc = h.truncate((p.description || "").split("\n\n")[0], 180);
    const org = (p.organizers || []).map((o) => o.name).filter(Boolean);
    return `<article class="prog-card" data-prog="${p.id}">
<p class="pk label tnum">${bullet(p.id, "lg")}<span>${esc(h.fmtDateRange(p.dates.start, p.dates.end))}</span></p>
<h3><a class="stretched" href="${root}${pp.slug}.html">${esc(pp.label)}</a></h3>
${desc ? `<p>${esc(desc)}</p>` : ""}
${org.length ? `<dl><div><dt>By</dt><dd>${esc(h.listJoin(org))}</dd></div></dl>` : ""}
<p class="links"><a href="${root}${pp.slug}.html">Program guide${icon("arrow-r")}</a>${p.url ? h.extLink(p.url, `Official site${icon("ext")}`) : ""}</p>
</article>`;
  };
  const stats = [[db.counts.events, "events", "schedule.html"], [db.counts.people, "people", "people.html"], [db.counts.venues, "venues", "venues.html"], [db.counts.works, "works of art", "art.html"]];
  return [{
    path: "index.html", nav: "index", title: "Overview", features: ["home"],
    description: `${config.siteName}: ${config.siteTagline}. Every session, show, installation and venue of the first week of October in Cincinnati, with sources.`,
    body: (root) => `<div class="home-top">
<div class="mast">
<div class="folio oxford label tnum"><span class="vol">Vol. 1 · Special section</span><span class="today" data-folio-date>${esc(h.fmtDateRange(config.week.start, config.week.end))}, ${config.week.start.slice(0, 4)}</span><span class="region">Cincinnati &amp; Northern Kentucky</span></div>
<div class="nameplate">${h.wordmark("wm", false)}</div>
<div class="river" aria-hidden="true"><span class="river-bank label">Ohio</span>${h.riverRule("rr", true)}</div>
<div class="river-caption label" aria-hidden="true"><span class="rc-bank">Kentucky</span><span class="rc-tick">OTR · Downtown · Covington</span><span class="rc-name">The Ohio River</span></div>
</div>
<div class="lead">
<div class="lead-story">
<p class="kicker label"><span class="sec-num" aria-hidden="true">1</span><span data-show="before">The week ahead</span><span data-show="during">This week</span><span data-show="after">The week in review</span></p>
<h1>Three festivals share one week, and on Thursday all three run at once.</h1>
</div>
<div class="lead-body">
<p class="dek">Cincinnati Art Week, StartupCincy Week and BLINK, plus the FotoFocus Biennial: every session, show, installation and venue in one guide.</p>
<p class="byline">An independent guide · Sources linked on every page</p>
<div class="btn-row stack-sm spaced"><a class="btn btn-primary" href="${root}schedule.html">${icon("calendar")}See the schedule</a><a class="btn btn-secondary" href="${root}map.html">${icon("map")}Open the map</a></div>
<button class="hero-search" type="button" data-search-open>${icon("search")}Try “BLINK”, “Union Hall” or a speaker's name<kbd data-k-hint>⌘K</kbd></button>
</div>
<aside class="ear" aria-labelledby="ear-h"><div class="ear-static">
<div class="ear-head"><h2 id="ear-h">First up</h2></div>
<p class="clock label tnum"><span>${esc(h.fmtDay(config.week.start))} onward</span></p>
<ol class="tonight">${first.map((x) => cards.eventRow(root, x)).join("")}</ol>
</div></aside>
</div>
</div>
${c.section({ id: "programs", num: 2, kicker: "Programs", title: "The programs", body: `<div class="prog-cards">${PROGRAM_PAGES.map((pp) => card(root, pp)).join("")}</div>` })}
<div class="stats">${stats.map(([n, l, href]) => `<a class="stat" href="${root}${href}"><span class="n">${n}</span><span class="l">${esc(l)} in the guide so far</span></a>`).join("")}</div>
${c.placeholder("The phase-aware first screen (a countdown before the week, At this hour and Tonight during it, a recap after), the week line and the news ticker are coming to this page.", "home")}`,
  }];
}
