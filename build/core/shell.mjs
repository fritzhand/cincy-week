/* ============================================================
   build/core/shell.mjs · OWNER: Agent A (core engine)
   The page shell: SIG's shell (topbar, brand, grouped icon sidebar,
   collapsible rail, drawer, theme toggle + FOUC-free boot, ⌘K palette,
   breadcrumbs, TOC rail, prev/next, footer with the author block,
   back-to-top) with QS's accessibility upgrades and the Interchange
   design (wordmark, numbered sections, program items with bullet + date
   line, My Plan card, Live pill, phone dock, one modal component).

   makeShell(site) → shell(page) where `page` is a page-module output
   (engine spec §5.2) plus the orchestrator's `root` and `slug`.
   Modules never write <html>, <head>, the topbar, sidebar, footer, dock
   or modals: they return a body and optional head/modals/features.
   ============================================================ */
import { esc, attr, extLink, hostOf, plural } from "./util.mjs";
import { icon, bullet, wordmark, riverRule, sprite, DOWNTOWN_T } from "./icons.mjs";
import { crumbs as crumbsHtml, pagenav, toc as tocAside, tocMobile, progName } from "./components.mjs";
import { NAV, PROGRAM_PAGES, NAV_SLUGS, DOCK } from "../nav.mjs";
import { fmtDateRange, fmtDowRange, fmtRangeCompact } from "./time.mjs";

/** Inline boot script (runs before CSS paints): js class, theme, rail, phase.
 *  ?now=YYYY-MM-DDTHH:MM (New York wall time) overrides the clock on localhost or with localStorage cw-debug=1. */
function bootScript({ weekStart, weekEnd }) {
  return `<script>(function(){var d=document.documentElement,t=null,r=null,dbg=null,q;d.className=d.className.replace(/\\bno-js\\b/,"js");
try{t=localStorage.getItem("cw-theme");r=localStorage.getItem("cw-rail");dbg=localStorage.getItem("cw-debug")}catch(e){}
try{q=new URLSearchParams(location.search)}catch(e){q={get:function(){return null}}}
var qt=q.get("theme");if(qt==="light"||qt==="dark")t=qt;
if(t!=="light"&&t!=="dark")t=window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
d.setAttribute("data-theme",t);if(r==="1")d.classList.add("rail-collapsed");
var now=Date.now(),s=q.get("now"),m=s&&/^(\\d{4})-(\\d\\d)-(\\d\\d)T(\\d\\d):(\\d\\d)$/.exec(s);
if(m&&(dbg==="1"||/^(localhost|127\\.0\\.0\\.1|\\[::1\\])$/.test(location.hostname))){var off=function(x){var p={};try{new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",hourCycle:"h23",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).formatToParts(new Date(x)).forEach(function(o){p[o.type]=o.value})}catch(e){return -144e5}return Date.UTC(+p.year,p.month-1,+p.day,p.hour%24,+p.minute)-Math.floor(x/6e4)*6e4};
var g=Date.UTC(+m[1],m[2]-1,+m[3],+m[4],+m[5]);now=g-off(g-off(g));d.setAttribute("data-now",String(now))}
d.setAttribute("data-phase",now<${weekStart}?"before":now<${weekEnd}?"during":"after")})();</script>`;
}

const GA = (id) => (id ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${attr(id)}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","${attr(id)}");</script>
` : "");

export function makeShell(site) {
  const { config, db, tokens, hashes, hasOg } = site;
  const NAME = config.siteName;
  const P = db.byId.program;

  /* ---------- program page labels for the sidebar ---------- */
  const progInfo = new Map(PROGRAM_PAGES.map((pp) => {
    const recs = pp.programs.map((id) => P.get(id)).filter(Boolean);
    const main = recs[0];
    let sub = "";
    if (main?.dates) {
      const dates = fmtDateRange(main.dates.start, main.dates.end), dow = fmtDowRange(main.dates.start, main.dates.end);
      let where = "";
      const hub = main.hub_venue_id ? db.byId.venue.get(main.hub_venue_id) : null;
      if (hub) {
        const hood = hub.hood ? db.byId.place.get(hub.hood) : null;
        where = hub.kind !== "zone" && hub.name.length <= 22 ? hub.name : (hood?.short_name || hood?.name || "");
      } else {
        const daily = (db.eventsByProgram.get(main.id) || []).find((e) => e.end_date && e.start && e.end);
        if (daily) where = fmtRangeCompact(daily.start, daily.end);
        else {
          const vs = new Set(pp.programs.flatMap((id) => (db.eventsByProgram.get(id) || []).map((e) => e.venue_id).filter(Boolean)));
          if (vs.size) where = plural(vs.size, "venue");
        }
      }
      sub = [dow, dates, where].filter(Boolean).join(" · ");
    }
    return [pp.slug, { slug: pp.slug, programs: pp.programs, subLinks: pp.sub || null, prog: pp.programs[0], sub, name: pp.label || main?.name || pp.slug }];
  }));
  const navLabel = new Map(NAV.flatMap((g) => (g.programs ? [...progInfo.values()].map((p) => [p.slug, p.name]) : g.items.map((i) => [i.slug, i.label]))));

  const metaCount = (k) => {
    if (k === "events") return db.counts.events;
    if (k === "people") return db.counts.people;
    if (k === "works") return db.counts.works;
    if (k === "venues") return db.counts.venues;
    if (/^works:/.test(k)) return db.works.filter((w) => w.program === k.slice(6)).length;
    return null;
  };

  /* ---------- sidebar ---------- */
  function sidebar(root, active) {
    const cur = (slug) => (slug === active ? ' aria-current="page"' : "");
    const link = (it) => {
      const n = it.meta === "plan" ? `<span class="nav-meta" data-plan-count hidden>0</span>` : it.meta ? `<span class="nav-meta">${metaCount(it.meta) ?? ""}</span>` : "";
      return `<a class="nav-link" href="${root}${it.slug}.html"${cur(it.slug)}>${icon(it.icon)}<span>${esc(it.label)}</span>${n}</a>`;
    };
    const progItem = (pi) => {
      const two = `${bullet(pi.prog)}<span class="nav-2">${esc(pi.name)}${pi.sub ? `<span class="nav-sub">${esc(pi.sub)}</span>` : ""}</span>`;
      if (pi.subLinks) {
        const open = active === pi.slug ? " open" : "";
        const subs = pi.subLinks.map((s) => {
          const slug = s.href.replace(/\.html.*$/, "");
          const isCur = s.href === `${slug}.html` && slug === active;
          const n = s.count ? metaCount(s.count) : null;
          return `<a class="nav-link" href="${root}${attr(s.href)}"${isCur ? ' aria-current="page"' : ""}><span>${esc(s.label)}</span>${n ? `<span class="nav-meta">${n}</span>` : ""}</a>`;
        }).join("");
        return `<details data-prog="${pi.prog}"${open}><summary>${two}${icon("chev-r", "chev")}</summary><div class="sub">${subs}</div></details>`;
      }
      return `<a class="nav-link prog" href="${root}${pi.slug}.html"${cur(pi.slug)}>${two}</a>`;
    };
    const groups = NAV.map((g) => `<div class="sidebar-group"><div class="sidebar-title label"><span class="sec-num" aria-hidden="true">${g.num}</span>${esc(g.label)}</div>
${g.programs ? [...progInfo.values()].map(progItem).join("\n") : g.items.map(link).join("\n")}
</div>`).join("\n");
    return `<nav class="sidebar" id="sidebar" aria-label="Guide">
<a class="plan-card is-empty" href="${root}plan.html" data-plan-card><span class="pc-top">${icon("star", "i-fill")}<span data-plan-card-title>My Plan</span></span><span class="pc-next" data-plan-card-next>Star events to build your plan</span></a>
${groups}
<p class="sidebar-src">An independent guide built from the organizers' public sites. Always check the official sites.</p>
</nav>`;
  }

  /* ---------- topbar ---------- */
  const weekLabel = `${fmtDateRange(config.week.start, config.week.end)}, ${config.week.start.slice(0, 4)}`;
  const topbar = (root) => `<header class="topbar">
<button class="nav-toggle" type="button" aria-controls="sidebar" aria-expanded="false" aria-label="Open navigation" data-nav-toggle><span class="hb" aria-hidden="true"><span class="hb-t"></span><span class="hb-m"></span><span class="hb-b"></span></span></button>
<a class="brand" href="${root}index.html" aria-label="${attr(NAME)}, home"><img class="brand-mark" src="${root}assets/img/brand/mark.svg" alt="" width="32" height="32">${wordmark("brand-name", false)}<span class="brand-date label tnum">${esc(weekLabel)}</span></a>
<span class="topbar-spacer"></span>
<a class="live-pill label" href="${root}schedule.html?when=now" hidden data-live-pill><span class="dot-live" aria-hidden="true"></span><span data-live-text>Live now</span></a>
<button class="searchbtn" type="button" data-search-open aria-keyshortcuts="Meta+K Control+K /">${icon("search")}<span class="searchbtn-label">Search sessions, people, places</span><kbd data-k-hint>⌘K</kbd></button>
<a class="planbtn" href="${root}plan.html">${icon("star")}My Plan <span class="count" data-plan-count hidden>0</span></a>
<button class="icon-btn search-icon-btn" type="button" aria-label="Search" data-search-open>${icon("search")}</button>
<button class="icon-btn theme-toggle" type="button" aria-label="Switch to the Night edition" data-theme-toggle>${icon("moon", "moon")}${icon("sun", "sun")}</button>
</header>`;

  /* ---------- footer ---------- */
  const officials = db.programs.filter((p) => p.url);
  const author = config.author || {};
  const footer = (root) => `<footer class="footer">
<div class="footer-inner">
<div class="river" aria-hidden="true">${riverRule("rr")}</div>
<div class="footer-grid">
<div>
${wordmark("wm")}
<p class="motto"><em>Juncta juvant</em>: things joined together help.</p>
<p class="motto-note">Cincinnati's city motto, and the idea behind this guide: the week's festivals and the city around them, in one place.</p>
<div class="footer-author"><span class="avatar m" data-prog="also"><img src="${root}assets/img/brand/jeremy.png" alt="" width="44" height="44" loading="lazy" decoding="async"></span><span>Built and maintained by <b>${esc(author.name || "")}</b><br>${author.github ? extLink(author.github, "GitHub") : ""}${author.linkedin ? extLink(author.linkedin, "LinkedIn") : ""}</span></div>
</div>
<div>
<h2>Official sites</h2>
<ul>${officials.map((p) => `<li>${extLink(p.url, `${bullet(p.id)}${esc(hostOf(p.url))}`)}</li>`).join("")}</ul>
</div>
<div>
<h2>This guide</h2>
<ul><li><a href="${root}about.html">About and sources</a></li><li><a href="${root}about.html#corrections">Corrections and takedowns</a></li><li>${extLink(config.repo, "Source on GitHub")}</li></ul>
</div>
</div>
<div class="footer-base"><span>Independent guide, not affiliated with the organizers. Always check the official sites.</span><span>Map data © OpenStreetMap contributors (ODbL)</span></div>
</div>
</footer>`;

  /* ---------- dock, to-top, toast, modals ---------- */
  const dock = (root, active) => `<nav class="dock" aria-label="Quick">
${DOCK.map((d) => (d.search
    ? `<button type="button" data-search-open>${icon(d.icon)}${esc(d.label)}</button>`
    : `<a href="${root}${d.slug}.html"${d.slug === active ? ' aria-current="page"' : ""}>${icon(d.icon)}${esc(d.label)}${d.plan ? '<span class="count" data-plan-count hidden>0</span>' : ""}</a>`)).join("\n")}
</nav>`;
  const extras = (root) => `<button class="to-top" type="button" aria-label="Back to top" data-to-top>${icon("arrow-up")}</button>
<div class="toast" role="status" aria-live="polite" data-toast><span data-toast-text></span><a href="${root}plan.html" data-toast-link hidden>View</a></div>
<div class="modal search-modal" id="search" role="dialog" aria-modal="true" aria-label="Search the guide" data-modal>
<div class="modal-backdrop" data-close></div>
<div class="modal-panel">
<div class="search-field">${icon("search")}<input type="text" role="combobox" aria-expanded="true" aria-controls="sr-list" aria-autocomplete="list" aria-label="Search sessions, people, art and places" placeholder="Search sessions, people, art and places" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" data-search-input><button class="icon-btn" type="button" aria-label="Close search" data-close>${icon("x")}</button></div>
<p class="sr-only" role="status" aria-live="polite" data-search-status></p>
<div class="search-results" id="sr-list" role="listbox" aria-label="Results" data-search-results></div>
<p class="search-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> to move</span><span><kbd>Enter</kbd> to open</span><span><kbd>Esc</kbd> to close</span></p>
</div>
</div>
<div class="modal" id="event-dialog" role="dialog" aria-modal="true" aria-labelledby="evd-title" data-modal>
<div class="modal-backdrop" data-close></div>
<div class="modal-panel"><div class="modal-head"><span data-evd-kicker></span><button class="icon-btn" type="button" aria-label="Close" data-close>${icon("x")}</button></div><div class="modal-body evd" data-evd-body></div></div>
</div>
<div class="modal" id="work-dialog" role="dialog" aria-modal="true" aria-labelledby="wd-title" data-modal>
<div class="modal-backdrop" data-close></div>
<div class="modal-panel"><div class="modal-head"><span data-wd-kicker></span><button class="icon-btn" type="button" aria-label="Close" data-close>${icon("x")}</button></div><div class="modal-body evd" data-wd-body></div></div>
</div>`;

  /* ---------- head ---------- */
  const preload = (root) => tokens.preload.map((f) => `<link rel="preload" href="${root}assets/${f}" as="font" type="font/woff2" crossorigin>`).join("\n");
  const BOOT = bootScript(db.phaseInstants);

  return function shell(page) {
    const { root, slug } = page;
    const active = page.nav ?? slug;
    const isHome = slug === "index";
    const fullTitle = isHome ? `${NAME} · ${config.siteTagline}` : `${page.title} · ${NAME}`;
    const canonical = page.noindex ? "" : `${config.siteBase}${page.path === "index.html" ? "" : page.path}`;
    const ogImg = page.og && site.ogFiles.has(page.og) ? page.og : hasOg ? "og.png" : null;
    const jsonld = page.jsonld ? `<script type="application/ld+json">${JSON.stringify(page.jsonld).replace(/</g, "\\u003c")}</script>\n` : "";
    const features = [...new Set(page.features || [])];
    const tocItems = page.toc || [];
    const crumbItems = page.crumbs !== undefined ? page.crumbs : isHome ? [] : [["Overview", "index.html"], [navLabel.get(slug) || page.title, null]];
    const navIdx = NAV_SLUGS.indexOf(slug);
    const pn = page.pagenav !== undefined ? page.pagenav
      : navIdx > -1 ? { prev: navIdx > 0 ? { href: `${NAV_SLUGS[navIdx - 1]}.html`, label: navLabel.get(NAV_SLUGS[navIdx - 1]) } : null, next: navIdx < NAV_SLUGS.length - 1 ? { href: `${NAV_SLUGS[navIdx + 1]}.html`, label: navLabel.get(NAV_SLUGS[navIdx + 1]) } : null }
      : null;
    const body = typeof page.body === "function" ? page.body(root) : page.body || "";
    const main = `${crumbsHtml(root, crumbItems)}
${tocItems.length ? `<div class="content-with-toc"><div class="content-main">${tocMobile(tocItems)}${body}${pn ? pagenav(root, pn.prev, pn.next) : ""}</div>${tocAside(tocItems)}</div>` : `${body}${pn ? pagenav(root, pn.prev, pn.next) : ""}`}`;
    return `<!doctype html>
<html lang="en" class="no-js" data-root="${attr(root)}" data-page="${attr(slug)}" data-phase="before" data-v="${hashes.data}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${GA(config.analyticsId)}<title>${esc(fullTitle)}</title>
<meta name="description" content="${attr(page.description)}">
${canonical ? `<link rel="canonical" href="${attr(canonical)}">\n` : ""}${page.noindex ? '<meta name="robots" content="noindex">\n' : ""}<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="${attr(tokens.light)}" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="${attr(tokens.dark)}" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${attr(NAME)}">
<meta property="og:title" content="${attr(fullTitle)}">
<meta property="og:description" content="${attr(page.description)}">
${canonical ? `<meta property="og:url" content="${attr(canonical)}">\n` : ""}${ogImg ? `<meta property="og:image" content="${attr(config.siteBase)}assets/${ogImg}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${attr(`${NAME}: ${config.siteTagline}`)}">
` : ""}<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/svg+xml" href="${root}assets/favicon.svg">
${preload(root)}
${BOOT}
<link rel="stylesheet" href="${root}assets/tokens.css?v=${hashes.tokens}">
<link rel="stylesheet" href="${root}assets/site.css?v=${hashes.css}">
<script type="module" src="${root}assets/js/main.js?v=${hashes.js}"></script>
${jsonld}${page.head || ""}</head>
<body${features.length ? ` data-features="${attr(features.join(" "))}"` : ""}>
<a class="skip-link" href="#main">Skip to content</a>
${sprite()}
${topbar(root)}
<div class="scrim" data-scrim></div>
<div class="layout">
${sidebar(root, active)}
<main id="main" class="content${page.pageClass ? " " + page.pageClass : ""}" tabindex="-1">
${main}
</main>
</div>
${footer(root)}
${dock(root, active)}
${extras(root)}
${typeof page.modals === "function" ? page.modals(root) : page.modals || ""}
</body>
</html>
`;
  };
}

export { DOWNTOWN_T, progName };
