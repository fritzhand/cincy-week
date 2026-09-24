/* ============================================================
   build/pages/home.mjs · OWNER: Agent G (home, programs & info)
   index.html (engine spec §4.5, DESIGN.md §9.2–9.3 and §4.4):
   - the Updates ticker (latest news, linked to the publishers; static, never a marquee)
   - the masthead: folio, nameplate, the river rule and its captions
   - the lead (kicker, H1, dek, buttons, search) and the phase-aware ear:
       before  a countdown and "First up" (server-rendered from the first days; features/home.js
               refreshes it from the clock),
       during  "At this hour": Now, open now, Next, Tonight (drawn by features/home.js from events.json),
       after   a recap with the guide's counts and the latest news
   - THE WEEK LINE: one <ol> of nine day links, two layouts (desktop diagram with the interchange capsule,
     nine 56px phone rows with lanes and a one-line summary computed from the data; lib/week.js)
   - program cards, highlights (the organizers' featured events), stat tiles (our counts plus sourced
     facts from data/facts.json), quick doors, the latest news.
   Without JS the page reads as the "before" edition, and every list is in the HTML.
   ============================================================ */
import { PROGRAM_PAGES } from "../nav.mjs";
import { laneRun, interchangeDays, programLine, daySummary } from "../../site/js/lib/week.js";
import { newsCard, latestNews } from "./news.mjs";

/** Sourced numbers for the stat tiles (data/facts.json ids, in display order). A missing id is skipped. */
export const HOME_FACTS = [
  "blink-stat-artists-2026",
  "scw-stat-sessions-agenda-page",
  "fotofocus-stat-exhibitions-in-2026",
  "caw-stat-spaces-in-one-walkable-footprint-cincinnatiartweek",
];
const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
const FEST = ["caw", "scw", "blink", "fotofocus", "also"];

/** The lanes of the week line: one per program page, in sidebar order (A, S, B, F). */
export function weekLanes(ctx) {
  const { db, c } = ctx;
  return PROGRAM_PAGES.map((pp) => db.byId.program.get(pp.programs[0])).filter((p) => p && p.dates?.start && p.dates?.end).map((p) => {
    const nightlyEv = (db.eventsByProgram.get(p.id) || []).find((e) => e.end_date && e.start && e.start >= "17:00");
    return {
      id: p.id, name: c.progName(p.id), short: c.progName(p.id, true), start: p.dates.start, end: p.dates.end,
      nightly: !!nightlyEv, hours: nightlyEv ? [nightlyEv.start, nightlyEv.end] : null,
      themes: Object.fromEntries((p.daily_themes || []).filter((t) => t.date && t.theme).map((t) => [t.date, t.theme])),
    };
  });
}

export function pages(ctx) {
  const { db, c, h, cards, config, img } = ctx;
  const { esc, attr, icon, bullet } = h;
  const P = db.byId.program;
  const week = db.week, W0 = config.week.start, W1 = config.week.end;
  const lanes = weekLanes(ctx);
  const ix = interchangeDays(lanes, week, W0, W1);
  const solid = lanes.filter((l) => !(l.start < W0 && l.end > W1));
  const shown = (e) => e.live;
  // the day's count, as The Week's day tabs count it: live sessions, not the multi-day runs
  const ongoingIds = new Set(db.events.filter((e) => e.instances.length && e.instances.every((x) => x.ongoing)).map((e) => e.id));
  const dayCount = (d) => (db.eventsByDay.get(d) || []).filter((x) => shown(x.ev) && !ongoingIds.has(x.id)).length;
  const featuredOn = (d) => (db.eventsByDay.get(d) || []).find((x) => x.ev.featured && shown(x.ev) && !x.ongoing && FEST.slice(0, 3).includes(x.ev.program) && !["exhibition", "installation"].includes(x.ev.kind));
  const firstLane = [...solid].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))[0];

  /* ---------- ticker ---------- */
  const news = latestNews(db, 8);
  const ticker = news.length ? `<div class="ticker">
<span class="ticker-tag label">${icon("news")}Updates</span>
<div class="ticker-viewport" tabindex="0" role="region" aria-label="Latest news, scroll sideways for more">
${news.map((n) => h.extLink(n.url, `${(n.programs || [])[0] ? bullet(n.programs[0]) : ""}<span class="ti-t">${esc(n.title)}</span> <span class="ti-src">${esc(n.source)} · ${esc(h.fmtDate(n.date))}</span>`, "ticker-item")).join("\n")}
</div>
<a class="ticker-more" href="ROOT/news.html">All news${icon("arrow-r")}</a>
</div>` : "";

  /* ---------- the week line ---------- */
  const key = lanes.map((l) => {
    const extra = l.hours ? ` · ${h.fmtRange(l.hours[0], l.hours[1]).replace(/:00/g, "")}` : "";
    return `<li data-prog="${l.id}">${bullet(l.id)}<span>${esc(l.name)}<small>${esc(h.fmtDateRange(l.start, l.end) + extra)}</small></span></li>`;
  }).join("\n");
  const days = week.map((d) => {
    const isX = ix.includes(d);
    const f = featuredOn(d);
    const parts = daySummary({ date: d, lanes, weekStart: W0, weekEnd: W1, interchange: isX, featured: f ? f.ev.title : null, count: dayCount(d) });
    const sum = parts.map((p) => (p.b ? `<b>${esc(p.t)}</b>` : esc(p.t))).join(" · ");
    const laneHtml = lanes.map((l) => {
      const run = laneRun(l, d, W0, W1);
      const off = run === "thru" && d === W0 ? `<span class="wk-off l">‹ ${esc(h.fmtDate(l.start))}</span>` : run === "thru" && d === W1 ? `<span class="wk-off r">${esc(h.fmtDate(l.end))} ›</span>` : "";
      return `<i data-prog="${l.id}"${run ? ` data-run="${run}"` : ""}>${off}</i>`;
    }).join("");
    const [dow, num] = [h.fmtDay(d).slice(0, 3), Number(d.slice(8))];
    return `<li class="wk-day${isX ? " is-interchange" : ""}" data-date="${d}">
<a class="wk-link" href="ROOT/schedule.html?day=${d}"><span class="wk-date"><span class="wk-dow label">${dow}</span><span class="wk-num">${num}</span></span><span class="wk-sum"><b class="wk-today" hidden>Today · </b>${sum}</span>${icon("chev-r", "wk-chev")}<span class="sr-only">, ${esc(h.fmtDayLong(d))}<span data-wk-today hidden> (today)</span>: ${esc(programLine(lanes, d))}${isX ? ". Interchange day" : ""}</span></a>
<span class="wk-lanes" aria-hidden="true">${laneHtml}</span>${isX ? '<span class="wk-x label" aria-hidden="true">Interchange</span>' : ""}
</li>`;
  }).join("\n");
  const thruLane = lanes.find((l) => l.start < W0 && l.end > W1);
  const weekLine = `<section class="wk" aria-labelledby="wk-h">
<div class="wk-top"><h2 id="wk-h">The week on one line</h2><p class="wk-note">Lanes keep the same order every day.</p></div>
<div class="wk-grid">
<ul class="wk-key" aria-label="Programs, in lane order">
${key}
</ul>
<ol class="wk-days">
${days}
</ol>
</div>
<div class="wk-foot"><span>Each program is a line; each day is a station. Tap a day for its schedule.</span>${thruLane ? `<span class="tnum">${esc(thruLane.name)}: ${esc(h.fmtDateRange(thruLane.start, thruLane.end))}</span>` : ""}</div>
</section>`;

  /* ---------- lead + ear ---------- */
  const ixDay = ix[0];
  const headline = ixDay && solid.length >= 2
    ? `${WORDS[solid.length] || solid.length} festivals share one week, and on ${h.fmtDayLong(ixDay).split(",")[0]} all ${WORDS[solid.length].toLowerCase()} run at once.`
    : `${WORDS[lanes.length] || lanes.length} programs share the first week of October.`;
  const names = solid.map((l) => l.name);
  const dek = `${h.listJoin(names)}${thruLane ? `, plus the ${thruLane.name}` : ""}: their published sessions, shows, installations and venues in one guide.`;
  const before = firstLane ? `The week ahead · ${firstLane.short} opens ${h.fmtDay(firstLane.start)}` : "The week ahead";

  // "First up", server-rendered from the first days with listed hours (festival programs); the client refreshes it
  const firstUp = [];
  for (const x of db.instances) {
    if (firstUp.length >= 4) break;
    if (!shown(x.ev) || x.ev.program === "also" || x.timeUnknown || x.allDay || (x.ongoing && x.day !== x.ev.instances[0].day)) continue;
    if (!firstUp.some((y) => y.id === x.id)) firstUp.push(x);
  }
  const nnItem = (root, x, { withDay = true } = {}) => {
    const ev = x.ev;
    const where = ev.venue ? esc(ev.venue.name) : ev.location_text && ev.location_text !== "Location not listed" ? esc(ev.location_text) : '<span class="unk">Location not listed</span>';
    return `<a class="nn-item" href="${root}schedule.html?e=${attr(ev.id)}#e-${attr(ev.id)}" data-open-event="${attr(ev.id)}" data-prog="${ev.program}" data-s="${x.s}" data-e="${x.e}"${x.endUnknown ? ' data-end-unknown="1"' : ""}>${bullet(ev.program)}<span class="t">${esc(ev.title)}</span><span class="m"><span class="p">${esc(c.progName(ev.program, true))}</span> · ${withDay ? `${esc(h.fmtDay(x.day))} · ` : ""}${esc(cards.whenText(x))} · ${where} <span class="nn-st" data-status></span></span></a>`;
  };
  const counts = [[db.counts.events, "events"], [db.counts.people, "people"], [db.counts.venues, "venues"], [db.counts.works, "works and attractions"]];   // BLINK's map lists attractions (a night market, a fashion show) with its art
  const ear = (root) => `<aside class="ear" aria-label="The week at a glance">
<div data-show="before" data-ear="before">
<div class="ear-head"><h2>Before the week</h2></div>
<p class="clock label tnum"><span data-ear-date>${firstLane ? `${esc(firstLane.short)} opens ${esc(h.fmtDay(firstLane.start))}` : esc(h.fmtDateRange(W0, W1))}</span></p>
<div class="countdown" data-countdown hidden><span class="n" data-cd-n></span><span class="label" data-cd-t></span></div>
<div class="nn-group"><p class="nn-label label">First up</p><div data-first-up>${firstUp.map((x) => nnItem(root, x)).join("")}</div></div>
<p class="ear-more"><a href="${root}schedule.html">The whole week, day by day${icon("arrow-r")}</a></p>
</div>
<div data-show="during" data-ear="during">
<div class="ear-head"><span class="dot-live" aria-hidden="true"></span><h2>At this hour</h2></div>
<p class="clock label tnum"><span data-ear-clock></span><span class="sim" data-ear-sim hidden>Test clock</span></p>
<div data-ear-body><p class="muted ear-wait">Loading what is on now. <a href="${root}schedule.html?when=now">See what is on now in The Week</a>.</p></div>
</div>
<div data-show="after" data-ear="after">
<div class="ear-head"><h2>After the week</h2></div>
<p class="clock label tnum"><span>${esc(h.fmtDateRange(W0, W1))}, ${W0.slice(0, 4)}</span></p>
<p class="ear-note">${solid.length ? `The ${WORDS[solid.length].toLowerCase()} festivals of the week are over for ${W0.slice(0, 4)}.` : ""}${thruLane ? ` The ${esc(thruLane.name)} runs ${esc(h.fmtDateRange(thruLane.start, thruLane.end))}.` : ""} The guide stays up as a record, with its sources.</p>
<ul class="ear-recap">${counts.map(([n, l]) => `<li><b class="tnum">${n}</b> ${esc(l)}</li>`).join("")}</ul>
${news.length ? `<div class="nn-group"><p class="nn-label label">Latest news</p>${news.slice(0, 3).map((n) => h.extLink(n.url, `${(n.programs || [])[0] ? bullet(n.programs[0]) : icon("news", "bullet")}<span class="t">${esc(n.title)}</span><span class="m">${esc(n.source)} · ${esc(h.fmtDate(n.date))}</span>`, "nn-item")).join("")}</div>` : ""}
</div>
</aside>`;

  /* ---------- program cards ---------- */
  const progCard = (root, pp) => {
    const p = P.get(pp.programs[0]);
    if (!p) return "";
    const evs = pp.programs.flatMap((id) => db.eventsByProgram.get(id) || []).filter(shown);
    // the same venue set the program page and venues.html?p= count (venue.programs: events and works)
    const venueIds = new Set(db.venues.filter((v) => v.programs.some((pr) => pp.programs.includes(pr))).map((v) => v.id));
    const lane = lanes.find((l) => l.id === p.id);
    const hub = p.hub_venue_id ? db.byId.venue.get(p.hub_venue_id) : null;
    const hood = hub?.hood ? db.byId.place.get(hub.hood) : null;
    const where = lane?.hours ? h.fmtRange(lane.hours[0], lane.hours[1])
      : venueIds.size > 12 ? h.plural(venueIds.size, "venue")
        : hub ? (hub.kind !== "zone" && hub.name.length <= 22 ? `${hub.name}${hood ? `, ${hood.short_name || hood.name}` : ""}` : hood?.name || hub.name) : "";
    const first = (p.description || "").split("\n\n")[0];
    const sentence = (first.match(/^.*?[.!?](?=\s|$)/) || [first])[0];
    const quote = sentence ? `“${h.truncate(sentence, 190)}”` : "";
    const people = new Set(pp.programs.flatMap((id) => db.people.filter((x) => x.programs.includes(id)).map((x) => x.id)));
    const works = db.works.filter((w) => pp.programs.includes(w.program)).length;
    const inGuide = [h.plural(evs.length, "event"), works ? h.plural(works, "work") : "", h.plural(people.size, "person", "people"), h.plural(venueIds.size, "venue")].filter(Boolean).join(" · ");
    const org = (p.organizers || []).map((o) => o.name).filter(Boolean);
    return `<article class="prog-card" data-prog="${p.id}">
<p class="pk label tnum">${bullet(p.id, "lg")}<span>${esc(h.fmtDateRange(p.dates.start, p.dates.end))}${where ? ` · <span class="nw">${esc(where)}</span>` : ""}</span></p>
<h3><a class="stretched" href="${root}${pp.slug}.html">${esc(pp.label)}</a></h3>
${p.edition ? `<p class="pc-ed">${esc(p.edition)}${p.tagline && p.tagline.length <= 40 && !p.edition.includes(p.tagline) ? ` · “${esc(p.tagline)}”` : ""}</p>` : ""}
${quote ? `<p class="pc-q">${esc(quote)}</p>` : ""}
<dl>${org.length ? `<div><dt>By</dt><dd>${esc(h.listJoin(org))}</dd></div>` : ""}<div><dt>Here</dt><dd class="tnum">${esc(inGuide)}</dd></div></dl>
<p class="links"><a href="${root}${pp.slug}.html">Program guide${icon("arrow-r")}</a>${p.url ? h.extLink(p.url, `Official site${icon("ext")}`) : ""}</p>
</article>`;
  };

  /* ---------- stats: our counts, then sourced facts ---------- */
  const worksMapped = db.works.length;
  const derived = [
    [db.counts.events, "events and exhibitions in the guide", "schedule.html"],
    [db.counts.people, "speakers, artists, curators and organizers", "people.html"],
    [db.counts.venues, "venues", "venues.html"],
    [worksMapped, "artworks, installations and attractions", "art.html"],
  ];
  const facts = HOME_FACTS.map((id) => db.facts.find((f) => f.id === id)).filter(Boolean);
  const stats = (root) => `<div class="stats">${derived.map(([n, l, href]) => `<a class="stat" href="${root}${href}"><span class="n">${n}</span><span class="l">${esc(l)}</span></a>`).join("")}</div>
${facts.length ? `<div class="stats stats-facts" aria-label="By the organizers' numbers">${facts.map((f) => `<div class="stat" data-prog="${f.program || "also"}"><span class="n">${esc(f.value)}</span>${f.program ? `<span class="lp">${bullet(f.program)}${esc(c.progName(f.program, true))}</span>` : ""}<span class="l">${esc(f.label)}</span><p class="src">Source: ${h.extLink(f.source_url, esc(f.source || h.hostOf(f.source_url)))}</p></div>`).join("")}</div>` : ""}`;

  /* ---------- highlights: the organizers' featured events ---------- */
  const perProg = new Map();
  const featured = h.sortBy(db.events.filter((e) => e.featured && shown(e) && e.instances.length), (e) => e.instances[0].s).filter((e) => {
    const n = perProg.get(e.program) || 0;
    if (n >= 2) return false;
    perProg.set(e.program, n + 1);
    return true;
  });

  /* ---------- quick doors ---------- */
  const onMap = db.venues.filter((v) => v.stall).length;
  const kinds = ["transit", "parking", "bike", "rideshare"].filter((k) => (db.placesByKind.get(k) || []).length);
  const KIND_WORD = { transit: "transit", parking: "parking", bike: "bikes", rideshare: "rideshare" };
  const blocks = db.stays.filter((s) => s.room_block).length;
  const doors = [
    ["map.html", "map", "Map", `${h.plural(onMap, "venue")} with a number on the map`],
    ["plan.html", "star", "My Plan", "Star events and art, then export them to your calendar"],
    ["stay.html", "bed", "Where to stay", `${h.plural(db.stays.length, "place to stay", "places to stay")}${blocks ? `, ${h.plural(blocks, "program room block")} first` : ""}`],
    ["getting-around.html", "tram", "Getting around", kinds.length ? (([t]) => t.charAt(0).toUpperCase() + t.slice(1))([h.listJoin(kinds.map((k) => KIND_WORD[k]))]) + ", from the programs and the transit agencies" : "Transit and parking"],
  ];

  const primary = `<span data-show="before after">See the schedule</span><span data-show="during">See today's schedule</span>`;
  const body = (root) => `${ticker.replace(/ROOT\//g, root)}
<div class="home-top">
<div class="mast">
<div class="folio oxford label tnum"><span class="vol">Vol. 1 · Special section</span><span class="today" data-folio-date>${esc(h.fmtDateRange(W0, W1))}, ${W0.slice(0, 4)}</span><span class="region">Cincinnati &amp; Northern Kentucky</span></div>
<div class="nameplate">${h.wordmark("wm", true)}</div>
<div class="river" aria-hidden="true"><span class="river-bank label">Ohio</span>${h.riverRule("rr", true)}</div>
<div class="river-caption label" aria-hidden="true"><span class="rc-bank">Kentucky</span><span class="rc-tick">OTR · Downtown · Covington</span><span class="rc-name">The Ohio River</span></div>
</div>
<div class="lead">
<div class="lead-story">
<p class="kicker label"><span class="sec-num" aria-hidden="true">1</span><span data-show="before" data-kicker="before">${esc(before)}</span><span data-show="during" data-kicker="during">This week</span><span data-show="after">The week in review</span></p>
<h1>${esc(headline)}</h1>
</div>
<div class="lead-body">
<p class="dek">${esc(dek)}</p>
<p class="byline">An independent guide, not affiliated with the organizers · Sources linked on every page · <a class="nw" href="${root}about.html">How it is made</a></p>
<div class="btn-row stack-sm spaced"><a class="btn btn-primary" href="${root}schedule.html">${icon("calendar")}${primary}</a><a class="btn btn-secondary" href="${root}map.html">${icon("map")}Open the map</a></div>
<button class="hero-search" type="button" data-search-open>${icon("search")}<span>Try “BLINK”, “Union Hall” or a speaker's name</span><kbd data-k-hint>⌘K</kbd></button>
</div>
${ear(root)}
</div>
${weekLine.replace(/ROOT\//g, root)}
</div>
${c.section({ id: "programs", num: 2, kicker: "Programs", title: `${WORDS[PROGRAM_PAGES.length] || PROGRAM_PAGES.length} programs, one week`, body: `<div class="prog-cards">${PROGRAM_PAGES.map((pp) => progCard(root, pp)).join("")}</div>
${stats(root)}` })}
${featured.length ? c.section({ id: "highlights", num: 1, kicker: "Highlights · picked by the organizers", title: "What the programs are featuring", more: { href: "schedule.html", label: "Full schedule" }, root, body: `<div class="grid home-highlights">${featured.map((e) => cards.eventCard(root, e, { anchor: false })).join("")}</div>` }) : ""}
${c.section({ id: "visit", num: 4, kicker: "Visit", title: "Plan your visit", body: `<div class="doors">${doors.map(([href, ic, t, s]) => `<a class="door" href="${root}${href}">${icon(ic)}<span><strong>${esc(t)}</strong><span>${esc(s)}</span></span>${icon("chev-r")}</a>`).join("")}</div>` })}
${news.length ? c.section({ id: "news", num: 5, kicker: "News", title: "Latest coverage", more: { href: "news.html", label: "All news" }, root, body: `<div class="news-grid">${news.slice(0, 4).map((n) => newsCard(ctx, root, n, { anchor: false })).join("")}</div>` }) : ""}
<script type="application/json" data-home-meta>${JSON.stringify({ weekStart: W0, weekEnd: W1, first: firstLane ? { name: firstLane.short, date: firstLane.start } : null, interchange: ix }).replace(/</g, "\\u003c")}</script>`;

  return [{
    path: "index.html", nav: "index", title: "Overview", features: ["home"],
    description: `${config.siteName}: ${config.siteTagline}. The published sessions, shows, installations and venues of Cincinnati Art Week, StartupCincy Week, BLINK and the FotoFocus Biennial, with sources.`,
    body,
  }];
}
