/* ============================================================
   build/pages/schedule.mjs · OWNER: Agent D (schedule & plan)
   "The Week" (engine spec §4.5, §4.6, §4.8; DESIGN.md §9.4).

   Server-rendered so it works without JS: every event appears once.
   - The sticky day strip: one tab per guide day (+ All), four program ticks in a fixed order
     (A S B F), a count, and an accessible name that says the day, the count and every program
     running ("Thursday, October 8, 42 events. Cincinnati Art Week, StartupCincy Week (last day), …").
     Without JS the tabs are links to the day sections.
   - "All day and all night": multi-day, all-day and hours-not-listed items (exhibitions, BLINK
     nights, the Biennial) once each, in priority order; the rest folds into a <details>.
   - Day sections → time slots (h3, sticky on phones, a time rail on desktop) → cards (h4).
   - The filter sheet (modals): search, when (now / next / tonight), kind, time of day,
     neighborhood, venue, and switches for In my plan, Hide ended and Free.
   features/schedule.js (D) filters, syncs the URL (engine §4.6: day p k t h v free q past star
   view when e), folds ended slots, draws the NOW line and marks conflicts.
   Data output: assets/data/schedule-extra.json = { v, venues: { id: { mm: mini-map HTML with the root as
   "{R}", d: { apple, google } } }, spans: { eventId: [firstDate, lastDate] } } for the event dialog and
   My Plan (mini-maps built with Agent E's components; spans are the full runs of multi-day items).
   ============================================================ */
import { KIND_GROUP, KIND_GROUP_LABEL, KIND_LABEL } from "../core/schema.mjs";
import { BUCKETS, dowShort, fmtDayLong, fmtDay, fmtDateRange, fmtTime, isoLocal, nyParts } from "../core/time.mjs";

const TICKS = ["caw", "scw", "blink", "fotofocus"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const BAND_TOP = 5; // rows shown before "Show n more" in the band (features/schedule.js uses the same number)

export function pages(ctx) {
  const { db, c, h, cards, config } = ctx;
  const { esc, attr, icon, bullet, plural } = h;
  const P = db.byId.program;
  const shown = (e) => e.live || e.status === "cancelled";

  /* ---------- what goes where ---------- */
  const ongoing = db.events.filter((e) => shown(e) && e.instances.length && e.instances.every((x) => x.ongoing));
  const ongoingIds = new Set(ongoing.map((e) => e.id));
  const timed = db.instances.filter((x) => shown(x.ev) && !ongoingIds.has(x.id));
  // band order (the first rows of each day's band): listed hours first (BLINK nights, tours, markets), then
  // one-day items, then featured, then the festivals before the long museum runs, shorter runs first
  const BAND_PROG = ["caw", "scw", "blink", "also", "fotofocus"];
  const bandKey = (e) => [e.instances[0].timeUnknown || e.instances[0].allDay ? 1 : 0, e.instances.length > 1 ? 1 : 0, e.featured ? 0 : 1, BAND_PROG.indexOf(e.program), e.instances.length];
  ongoing.sort((a, b) => { const ka = bandKey(a), kb = bandKey(b); for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i]; return a.title.localeCompare(b.title); });
  const days = [...new Set([...db.days.map((d) => d.date), ...timed.map((x) => x.day)])].sort();
  const weekMonth = Number(config.week.start.slice(5, 7));
  const byDay = new Map(days.map((d) => [d, []]));
  for (const x of timed) byDay.get(x.day).push(x);
  const liveCount = (xs) => xs.filter((x) => x.ev.live).length;
  const ongoingOn = (d) => ongoing.filter((e) => e.live && e.instances.some((x) => x.day === d)).length;
  const programsHere = db.programs.filter((p) => db.events.some((e) => e.program === p.id && shown(e)));

  /* ---------- day strip ---------- */
  const runs = (pid, d) => {
    const p = P.get(pid);
    if (p?.dates?.start && p?.dates?.end) return d >= p.dates.start && d <= p.dates.end;
    return (db.eventsByDay.get(d) || []).some((x) => x.ev.program === pid);
  };
  const runNote = (pid, d) => {
    const p = P.get(pid); const s = p?.dates?.start, e = p?.dates?.end;
    if (!s || !e || s === e) return "";
    const unit = pid === "blink" ? "night" : "day";
    return d === s ? ` (opening ${unit})` : d === e ? ` (last ${unit})` : "";
  };
  const progLine = (d) => TICKS.filter((p) => P.has(p) && runs(p, d)).map((p) => `${c.progName(p)}${runNote(p, d)}`).join(", ");
  const dayLabel = (d) => fmtDayLong(d) + (d.slice(0, 4) !== config.week.start.slice(0, 4) ? `, ${d.slice(0, 4)}` : "");
  function tab(d) {
    const n = liveCount(byDay.get(d)), out = d < config.week.start || d > config.week.end;
    const prog = progLine(d);
    const month = Number(d.slice(5, 7));
    const ticks = TICKS.map((p) => (runs(p, d) ? `<i data-prog="${p}"></i>` : "<i></i>")).join("");
    return `<a class="daytab${out ? " is-out" : ""}" id="dt-${d}" href="#d-${d}" data-day="${d}" data-l1="${attr(dayLabel(d))}" data-l2="${attr(prog)}" aria-label="${attr(`${dayLabel(d)}, ${plural(n, "event")}${prog ? `. ${prog}` : ""}`)}"><span class="dt-dow">${month !== weekMonth ? MON[month - 1] : dowShort(d)}</span><span class="dt-num">${Number(d.slice(8))}</span><span class="dt-ticks" aria-hidden="true">${ticks}</span><span class="dt-n" aria-hidden="true" data-dt-n>${n}</span></a>`;
  }
  const total = liveCount(timed);
  const allTab = `<a class="daytab dt-all" id="dt-all" href="#sched-list" data-day="all" data-l1="All days" data-l2="" aria-label="All days, ${plural(total, "event")}"><span class="dt-dow">All</span><span class="dt-num">${Number(config.week.start.slice(8))}–${Number(config.week.end.slice(8))}</span><span class="dt-ticks" aria-hidden="true">${TICKS.map((p) => `<i data-prog="${p}"></i>`).join("")}</span><span class="dt-n" aria-hidden="true" data-dt-n>${total}</span></a>`;
  const legend = `<p class="tick-legend" id="tick-legend"><span>Ticks under each date show which programs run that day, always in this order:</span>${TICKS.filter((p) => P.has(p)).map((p) => `<span data-prog="${p}"><i></i>${esc(c.progName(p, true))}</span>`).join("")}</p>`;

  /* ---------- filters (JS only): program chips, Filters (n), status, active chips, view ---------- */
  // one chip per program page (FotoFocus & more covers fotofocus + also), in the order of the ticks
  const chipGroups = ctx.nav.PROGRAM_PAGES.map((pp) => ({ ids: pp.programs.filter((id) => programsHere.some((p) => p.id === id)), label: pp.programs.length > 1 ? pp.label : c.progName(pp.programs[0], true) })).filter((g) => g.ids.length);
  for (const p of programsHere) if (!chipGroups.some((g) => g.ids.includes(p.id))) chipGroups.push({ ids: [p.id], label: c.progName(p.id, true) });
  const progCount = (ids) => liveCount(timed.filter((x) => ids.includes(x.ev.program)));
  const chipsRow = `<div class="filter-row js-only"><div class="filter-scroll" role="group" aria-label="Programs">${chipGroups.map((g) => c.chip(g.label, null, { prog: g.ids[0], pressed: false, count: progCount(g.ids), attrs: `data-sf="p" data-v="${g.ids.join(",")}"` })).join("")}</div><button class="chip chip-more" type="button" aria-haspopup="dialog" aria-controls="sched-filters" data-sheet-open>${icon("sliders")}Filters <span class="count" data-filter-count hidden>0</span></button></div>`;
  const status = `<div class="sched-status"><p class="result-count" role="status" aria-live="polite" data-result-count><b>${total}</b> events on ${days.length} days, plus ${ongoing.filter((e) => e.live).length} all-day and ongoing</p><span class="sched-tools js-only"><button class="btn btn-ghost btn-sm" type="button" data-sched-clear hidden>Clear filters</button><span class="view-toggle" role="group" aria-label="View"><button type="button" data-view="list" aria-pressed="true">${icon("list")}List</button><button type="button" data-view="map" aria-pressed="false">${icon("map")}Map</button></span></span></div>
<div class="active-chips js-only" role="group" aria-label="Active filters" data-active-chips hidden></div>
<div class="sched-map js-only" data-sched-map hidden></div>`;

  /* ---------- the band ---------- */
  const band = (root) => {
    if (!ongoing.length) return "";
    const card = (e) => cards.eventCard(root, e, { span: true, compact: true, headingLevel: 3 });
    const top = ongoing.slice(0, BAND_TOP), rest = ongoing.slice(BAND_TOP);
    return `<section class="ongoing" aria-labelledby="ongoing-h" data-ongoing><h2 class="ongoing-head label" id="ongoing-h">${icon("clock")}All day and all night <span class="n tnum" data-ongoing-n>${ongoing.filter((e) => e.live).length}</span></h2>
<div class="ongoing-list" data-ongoing-top>${top.map(card).join("")}</div>${rest.length ? `
<details class="ongoing-more" data-ongoing-more><summary>${icon("chev-r", "chev")}<span>Show <b data-ongoing-more-n>${rest.length}</b> more all-day and ongoing</span></summary><div class="ongoing-list">${rest.map(card).join("")}</div></details>` : `
<details class="ongoing-more" data-ongoing-more hidden><summary>${icon("chev-r", "chev")}<span>Show <b data-ongoing-more-n>0</b> more all-day and ongoing</span></summary><div class="ongoing-list"></div></details>`}
</section>`;
  };

  /* ---------- day sections → slots → cards ---------- */
  function slots(root, d) {
    const groups = new Map();
    for (const x of byDay.get(d)) { if (!groups.has(x.s)) groups.set(x.s, []); groups.get(x.s).push(x); }
    return [...groups].map(([s, xs]) => {
      const hhmm = nyParts(s).hhmm, [hm, ap] = fmtTime(hhmm).split(" ");
      const sid = `s-${d}-${hhmm.replace(":", "")}`;
      return `<section class="slot" data-slot-s="${s}" aria-labelledby="${sid}"><h3 class="slot-head" id="${sid}"><time class="slot-time" datetime="${isoLocal(s)}">${hm}<span class="ampm">${ap}</span></time><span class="slot-rel" data-slot-rel></span></h3><div class="slot-cards">${xs.map((x) => cards.eventCard(root, x, { headingLevel: 4 })).join("")}</div></section>`;
    }).join("\n");
  }
  const daySection = (root, d) => {
    const n = liveCount(byDay.get(d)), o = ongoingOn(d);
    return `<section class="sched-day" id="d-${d}" data-day="${d}" aria-labelledby="d-${d}-h">
<h2 class="sched-day-h" id="d-${d}-h">${esc(dayLabel(d))} <span class="sched-day-n label tnum" data-day-n>${plural(n, "event")}</span></h2>
${n || byDay.get(d).length ? `<div class="slots" data-slots>${slots(root, d)}</div>` : `<p class="unk sched-none">No scheduled sessions listed for this day${o ? `; ${plural(o, "all-day or ongoing item")} above` : ""}</p>`}
</section>`;
  };

  const empty = c.emptyState({ title: "Nothing matches these filters", body: "Try another day, or clear the filters.", glyph: "calendar", action: `<button class="btn btn-secondary btn-sm" type="button" data-sched-clear>Clear filters</button>`, attrs: "data-sched-empty hidden" });

  /* ---------- the filter sheet (rendered outside .layout) ---------- */
  const kgCount = (g) => liveCount(timed.filter((x) => x.ev.kg === g)) + ongoing.filter((e) => e.live && e.kg === g).length;
  const groups = [...new Set(Object.values(KIND_GROUP))].filter((g) => kgCount(g));
  const tCount = (b) => liveCount(timed.filter((x) => x.start && ctx.time.bucket(x.start) === b));
  const hoods = db.places.filter((p) => p.kind === "neighborhood").map((p) => [p, db.events.filter((e) => shown(e) && e.hood === p.id).length]).filter(([, n]) => n);
  const venues = db.venues.filter((v) => db.events.some((e) => shown(e) && e.venue_id === v.id)).sort((a, b) => a.name.localeCompare(b.name));
  const sw = (key, label) => `<label class="switch">${esc(label)}<button type="button" role="switch" aria-checked="false" data-sf-switch="${key}"></button></label>`;
  const sheet = () => `<div class="modal sheet" id="sched-filters" role="dialog" aria-modal="true" aria-labelledby="sched-filters-h" data-modal>
<div class="modal-backdrop" data-close></div>
<div class="modal-panel">
<span class="grip" aria-hidden="true"></span>
<div class="modal-head"><h2 id="sched-filters-h" class="sheet-h">Filters</h2><button class="icon-btn" type="button" aria-label="Close filters" data-close>${icon("x")}</button></div>
<div class="sheet-body">
<label class="field sf-q">${icon("search")}<span class="sr-only">Search this schedule</span><input type="search" placeholder="Search titles, people, venues" autocomplete="off" enterkeyhint="done" data-sf-q></label>
<fieldset data-sf-when-set><legend class="label">When</legend><div class="chip-row">${[["now", "On now"], ["next", "Starting in the next 2 hours"], ["tonight", "Tonight, from 5:00 PM"]].map(([v, l]) => c.chip(l, null, { pressed: false, attrs: `data-sf="when" data-v="${v}"` })).join("")}</div></fieldset>
<fieldset><legend class="label">Kind</legend><div class="chip-row">${groups.map((g) => c.chip(KIND_GROUP_LABEL[g], null, { pressed: false, count: kgCount(g), attrs: `data-sf="k" data-v="${g}"` })).join("")}<span data-sf-kinds></span></div></fieldset>
<fieldset><legend class="label">Time of day</legend><div class="chip-row">${Object.entries(BUCKETS).map(([b, l]) => c.chip(l, null, { pressed: false, count: tCount(b), attrs: `data-sf="t" data-v="${b}"` })).join("")}</div></fieldset>
${hoods.length ? `<fieldset><legend class="label">Neighborhood</legend><div class="chip-row">${hoods.map(([p, n]) => c.chip(p.short_name || p.name, null, { pressed: false, count: n, attrs: `data-sf="h" data-v="${attr(p.id)}"` })).join("")}</div></fieldset>` : ""}
${venues.length ? `<fieldset><legend class="label"><label for="sf-venue">Venue</label></legend><select class="select sf-venue" id="sf-venue" data-sf-v><option value="">All venues</option>${venues.map((v) => `<option value="${attr(v.id)}">${esc(v.name)}</option>`).join("")}</select></fieldset>` : ""}
<fieldset><legend class="label">Show</legend>${sw("star", "In my plan only")}${sw("past", "Hide ended")}${sw("free", "Free only")}</fieldset>
<p class="sf-note faint">“Free only” shows events the organizers list as free.</p>
</div>
<div class="sheet-foot"><button class="btn btn-secondary" type="button" data-sched-clear>Clear</button><button class="btn btn-primary" type="button" data-close data-show-n>Show events</button></div>
</div>
</div>`;

  const kinds = Object.fromEntries(Object.entries(KIND_LABEL).filter(([k]) => db.events.some((e) => e.kind === k)));
  const hoodNames = Object.fromEntries(hoods.map(([p]) => [p.id, p.short_name || p.name]));
  const island = JSON.stringify({ week: config.week, top: BAND_TOP, kinds, groups: KIND_GROUP_LABEL, hoods: hoodNames, buckets: BUCKETS }).replace(/</g, "\\u003c");

  return [{
    path: "schedule.html", nav: "schedule", title: "The Week", features: ["schedule"],
    description: `Every session, show and party of Cincinnati Art Week, StartupCincy Week, BLINK and FotoFocus, ${h.fmtDateRange(config.week.start, config.week.end)}, 2026, by day and time, with filters and live status.`,
    body: (root) => `${c.pageHead({ num: 1, kicker: "The Week", title: "The Week", lede: `Every session, show and party from ${h.fmtDateRange(config.week.start, config.week.end)}, by day and time. Star what you want to see; it goes to My Plan.` })}
<div class="sched" data-sched data-top="${BAND_TOP}">
<script type="application/json" data-sched-meta>${island}</script>
<nav class="sched-bar" aria-label="Days"><div class="daytabs" data-daytabs>${days.map(tab).join("")}${allTab}</div></nav>
${legend}
${chipsRow}
${status}
<div class="sched-days" id="sched-list">
${band(root)}
${days.map((d) => daySection(root, d)).join("\n")}
${empty}
</div>
</div>`,
    modals: () => sheet(),
  }];
}

/** Search entries: one per event (engine spec §4.9). */
export function search(ctx) {
  const { db, h } = ctx;
  return db.events.filter((e) => e.live).map((e) => {
    const x = e.instances[0];
    const multi = e.end_date && e.end_date !== e.date;
    const when = x ? (multi ? fmtDateRange(e.date, e.end_date) : [fmtDay(x.day), x.start && !x.timeUnknown ? fmtTime(x.start) : null].filter(Boolean).join(" · ")) : "";
    const people = (e.people || []).map((p) => db.byId.person.get(p)?.name).filter(Boolean);
    return {
      k: "ev", id: e.id, t: e.title, s: [when, e.venue?.name || e.location_text].filter(Boolean).join(" · "),
      u: `schedule.html?e=${e.id}`, p: e.program, // the palette needs JS, and with JS ?e= opens the dialog over the card g: [e.kind, ...(e.tags || []), ...(e.tracks || []), ...people, ...(e.credits || []).flatMap((c) => c.names || [])].join(" "),
      // st/en drive "Now and next" in the palette: only for listed hours (an exhibition with no hours is never "now")
      ...(x && !x.timeUnknown && !x.allDay ? { st: x.s, en: x.e } : {}),
    };
  });
}

/** For the event dialog and My Plan: mini-maps and directions (built with Agent E's components so they match
 *  the venue pages), and the full date span of multi-day items (events.json lists only the days inside the
 *  guide's window, so an exhibition running Sep 4–Nov 8 would otherwise read "Sep 26–Oct 18"). */
export function data(ctx) {
  const { db, cards } = ctx;
  const spans = {};
  for (const e of db.events) {
    if (e.instances.length < 2) continue;
    const occ = Array.isArray(e.occurrences) && e.occurrences.length ? e.occurrences.map((o) => o.date).sort() : null;
    spans[e.id] = occ ? [occ[0], occ[occ.length - 1]] : [e.date, e.end_date || e.date];
  }
  const venues = {};
  for (const v of db.venues) {
    if (v.lat == null || v.lng == null || !db.events.some((e) => e.venue_id === v.id)) continue;
    const mm = cards.miniMap ? cards.miniMap("{R}", v.lat, v.lng, { prog: v.programs[0] || "also", n: v.stall || "", label: `Map: ${v.name}` }) : "";
    const d = cards.directions ? cards.directions(v.lat, v.lng) : null;
    venues[v.id] = { mm: /class="mini-map"/.test(mm) ? mm : null, d };
  }
  return { "assets/data/schedule-extra.json": { v: 1, venues, spans } };
}
