/* ============================================================
   build/pages/program.mjs · OWNER: Agent G (home, programs & info)
   One template, one page per PROGRAM_PAGES entry (build/nav.mjs): art-week, startupcincy-week,
   blink and fotofocus ("FotoFocus & more" also covers the `also` program). Engine spec §4.5,
   DESIGN.md §9.13:
     page head in the program's identity (32px bullet, plate-underlined name, the edition as dek),
     "From the organizers" (their tagline, quoted, with its source), facts (dates, hours, where,
     admission, organizers, hashtags, social, contact, official site), the verbatim about text,
     tickets and passes, history, the organizers' numbers, day by day (themes), the schedule by
     day (compact time-first rows with stars and live state; multi-day runs listed once; "Full
     schedule" deep link), people by role, works, venues (a static map of the program's stall
     numbers + venue rows), sponsors by tier, the program's FAQs, news and sources. JSON-LD Festival.
   Honest gaps: a program whose schedule comes from a draft page (tag draft-schedule) says so.
   ============================================================ */
import { PROGRAM_PAGES } from "../nav.mjs";
import { ROLE_LABEL } from "../core/schema.mjs";
import { project } from "../../site/js/lib/geo.js";
import { newsCard, latestNews } from "./news.mjs";

const UNLISTED = "Location not listed";
const SOCIAL = [["instagram", "Instagram"], ["x", "X"], ["facebook", "Facebook"], ["linkedin", "LinkedIn"], ["tiktok", "TikTok"], ["youtube", "YouTube"]];
const PLURAL_ROLE = { speaker: "Speakers", artist: "Artists", curator: "Curators", performer: "Performers", moderator: "Moderators", organizer: "Organizers", judge: "Judges", host: "Hosts", founder: "Founders", panelist: "Panelists", facilitator: "Facilitators", mentor: "Mentors" };
const MAX_PEOPLE = 8, MAX_WORKS = 8, MAX_VENUES = 12, MAX_FAQ = 6, MAX_STATS = 8;

export function pages(ctx) {
  const { db, c, h, cards, config, seo, img } = ctx;
  const { esc, attr, icon, bullet } = h;
  const P = db.byId.program;
  const W0 = config.week.start, W1 = config.week.end;
  const allOngoing = (e) => e.instances.length && e.instances.every((x) => x.ongoing);

  /* ---------- pieces ---------- */
  const whereText = (ev) => {
    if (ev.venue) return `${esc(ev.venue.name)}${ev.room && !ev.room.includes(ev.venue.name) && !ev.venue.name.includes(ev.room) ? ` · ${esc(ev.room)}` : ""}`;
    if (ev.location_text && ev.location_text !== UNLISTED) return esc(ev.location_text);
    return `<span class="unk">${UNLISTED}</span>`;
  };
  /** a compact time-first row (the shared .tonight list) with live state and a star */
  const row = (root, x) => {
    const ev = x.ev;
    const timed = !x.timeUnknown && !x.allDay;
    const [hm, ap] = timed ? h.fmtTime(x.start).split(" ") : ["", ""];
    const lab = x.allDay ? "All day" : "Hours not listed";
    const cancelled = ev.status === "cancelled" ? ' <span class="badge badge-warn">Cancelled</span>' : "";
    return `<li data-s="${x.s}" data-e="${x.e}"${x.endUnknown ? ' data-end-unknown="1"' : ""}${x.timeUnknown ? ' data-time-unknown="1"' : ""}><a href="${root}schedule.html?e=${attr(ev.id)}#e-${attr(ev.id)}" data-open-event="${attr(ev.id)}"><time${timed ? ` datetime="${h.isoLocal(x.s)}"` : ""}>${timed ? `${esc(hm)}<small>${esc(ap)}</small>` : `<small>${lab}</small>`}</time>${bullet(ev.program)}<span><span class="t">${esc(ev.title)}</span><span class="w">${esc(cards.whenText(x))}${x.lateNight ? " · after midnight" : ""} · ${whereText(ev)}${cancelled} <span class="pr-st" data-status></span></span></span></a>${c.starButton(ev.id, ev.title)}</li>`;
  };
  /** a multi-day run, listed once: its dates and daily hours */
  const runRow = (root, ev) => {
    const x = ev.instances[0];
    const hours = x.timeUnknown ? (ev.hours_text || "Hours not listed") : x.allDay ? "All day" : cards.whenText(x);
    const inst = !x.timeUnknown ? ` data-inst="${ev.instances.map((y) => `${y.s}:${y.e}`).join(",")}"` : "";
    return `<li data-s="${x.s}" data-e="${ev.instances[ev.instances.length - 1].e}"${inst}${x.timeUnknown ? ' data-time-unknown="1"' : ""}><a href="${root}schedule.html?e=${attr(ev.id)}#e-${attr(ev.id)}" data-open-event="${attr(ev.id)}"><time><small>${esc(h.fmtDateRange(ev.date, ev.end_date || ev.date))}</small></time>${bullet(ev.program)}<span><span class="t">${esc(ev.title)}</span><span class="w"><span${x.timeUnknown ? ' class="unk"' : ""}>${esc(hours)}</span> · ${whereText(ev)} <span class="pr-st" data-status></span></span></span></a>${c.starButton(ev.id, ev.title)}</li>`;
  };

  /** A static overview map of the program's venues: a crop of the shared basemap and their stall numbers. */
  const meta = cards.meta || null;
  function progMap(root, venues, prog, label) {
    if (!meta) return "";
    const pts = venues.filter((v) => v.lat != null && v.stall).map((v) => [v, ...project(v.lat, v.lng, meta)]).filter(([, x, y]) => x >= 0 && y >= 0 && x <= meta.W && y <= meta.H);
    if (!pts.length) return "";
    let x0 = Math.min(...pts.map((p) => p[1])) - 40, x1 = Math.max(...pts.map((p) => p[1])) + 40;
    let y0 = Math.min(...pts.map((p) => p[2])) - 40, y1 = Math.max(...pts.map((p) => p[2])) + 40;
    let w = Math.max(x1 - x0, 200), hh = Math.max(y1 - y0, 150);
    if (w / hh > 4 / 3) hh = (w * 3) / 4; else w = (hh * 4) / 3;
    w = Math.min(w, meta.W); hh = Math.min(hh, meta.H);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    x0 = Math.min(Math.max(0, cx - w / 2), meta.W - w); y0 = Math.min(Math.max(0, cy - hh / 2), meta.H - hh);
    const pins = pts.map(([v, x, y]) => `<span class="pin pin-venue" data-prog="${prog}" style="left: ${(((x - x0) / w) * 100).toFixed(2)}%; top: ${(((y - y0) / hh) * 100).toFixed(2)}%"><span>${v.stall}</span></span>`).join("");
    return `<div class="mini-map prog-map" role="img" aria-label="${attr(label)}"><svg viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${w.toFixed(1)} ${hh.toFixed(1)}" aria-hidden="true" focusable="false"><use href="${root}assets/map/basemap.svg#bm"/></svg>${pins}</div>`;
  }

  return PROGRAM_PAGES.map((pp) => {
    const progs = pp.programs.map((id) => P.get(id)).filter(Boolean);
    const p = progs[0];
    if (!p) return null;
    const ids = progs.map((x) => x.id);
    const pid = p.id;
    const events = ids.flatMap((id) => db.eventsByProgram.get(id) || []).filter((e) => e.live || e.status === "cancelled");
    const nightly = (db.eventsByProgram.get(pid) || []).find((e) => e.end_date && e.start && e.start >= "17:00");
    const hub = p.hub_venue_id ? db.byId.venue.get(p.hub_venue_id) : null;
    const draft = events.filter((e) => (e.tags || []).includes("draft-schedule"));
    const dateLine = `${h.fmtDowRange(p.dates.start, p.dates.end) ? `${h.fmtDowRange(p.dates.start, p.dates.end)}, ` : ""}${h.fmtDateRange(p.dates.start, p.dates.end)}`;
    const kickerHours = nightly ? ` · ${h.fmtRange(nightly.start, nightly.end)}` : "";
    const people = h.sortBy(db.people.filter((x) => x.programs.some((pr) => ids.includes(pr))), (x) => (img.has("p", x.id) ? 0 : 1), (x) => -x.events.length - x.works.length, (x) => (x.sort_name || x.name).toLowerCase());
    const works = h.sortBy(db.works.filter((w) => ids.includes(w.program)), (w) => (img.has("w", w.id) ? 0 : 1), (w) => w.title.toLowerCase());
    // venues with a stall number first, in stall order (they pair with the map), then the rest by activity
    const venues = h.sortBy(db.venues.filter((v) => v.programs.some((pr) => ids.includes(pr))), (v) => (v.stall ? 0 : 1), (v) => v.stall || 0, (v) => -v.events.filter((e) => ids.includes(e.program)).length, (v) => v.name.toLowerCase());
    const faqs = db.faqs.filter((f) => ids.includes(f.program));
    const news = latestNews(db, 4, { programs: ids });
    const newsAll = db.news.filter((n) => (n.programs || []).some((x) => ids.includes(x))).length;
    const orgs = ids.flatMap((id) => (db.orgsByProgram.get(id) || []).map((x) => ({ ...x, prog: id })));
    const q = ids.join(",");
    const url = `${config.siteBase}${pp.slug}.html`;

    /* ---------- facts ---------- */
    const social = SOCIAL.map(([k, l]) => (p.social?.[k] ? h.extLink(p.social[k], esc(l)) : "")).filter(Boolean).join(" · ");
    const firstTicket = (p.tickets || [])[0];
    const factRows = (root) => [
      ["Dates", esc(`${dateLine}, ${p.dates.start.slice(0, 4)}`)],
      ["Hours", p.hours ? esc(p.hours) : nightly ? esc(`Nightly, ${h.fmtRange(nightly.start, nightly.end)}`) : null],
      ["Where", hub ? `<a href="${root}venues/${attr(hub.id)}.html">${esc(hub.name)}</a>${hub.address && !hub.name.includes(hub.address.split(",")[0]) ? `, ${esc(hub.address)}` : ""}` : venues.length ? `<a href="${root}venues.html?p=${pid}">${esc(h.plural(venues.length, "venue"))}</a>` : null],
      ["Admission", firstTicket ? `${esc(firstTicket.price || "Price not listed")}${firstTicket.name ? ` <span class="faint">(${esc(firstTicket.name)})</span>` : ""}${p.tickets.length > 1 ? ` · <a href="#tickets">${esc(h.plural(p.tickets.length, "ticket or pass", "tickets and passes"))}</a>` : ""}` : null],
      ["Organizers", (p.organizers || []).length ? p.organizers.map((o) => `${o.url ? h.extLink(o.url, esc(o.name)) : esc(o.name)}${o.role ? ` <span class="faint">(${esc(o.role)})</span>` : ""}`).join("; ") : null],
      ["Hashtags", (p.hashtags || []).length ? esc(p.hashtags.join(" ")) : null],
      ["Social", social || null],
      ["Contact", [p.contact?.email ? `<a href="mailto:${attr(p.contact.email)}">${esc(p.contact.email)}</a>` : "", p.contact?.phone ? esc(p.contact.phone) : ""].filter(Boolean).join(" · ") || null],
      ["Official site", p.url ? h.extLink(p.url, esc(h.hostOf(p.url))) : null],
    ];

    /* ---------- sections (built per root) ---------- */
    const toc = [["about", "About"]];
    const secs = [];
    const add = (id, label, fn) => { toc.push([id, label]); secs.push(fn); };

    if ((p.tickets || []).length > 1) add("tickets", "Tickets and passes", (root) => c.section({ id: "tickets", title: "Tickets and passes", anchor: true, body: `<div class="table-wrap"><table class="data prog-tickets"><thead><tr><th scope="col">Ticket or pass</th><th scope="col">Price</th><th scope="col">Details</th></tr></thead><tbody>${p.tickets.map((t) => `<tr><th scope="row" data-label="Ticket">${t.url ? h.extLink(t.url, esc(t.name)) : esc(t.name)}</th><td data-label="Price" class="tnum">${t.price ? esc(t.price) : '<span class="unk">Price not listed</span>'}</td><td data-label="Details">${t.notes ? esc(t.notes) : ""}</td></tr>`).join("")}</tbody></table></div>${c.sourceLine(p.tickets.map((t) => t.url))}` }));

    const themes = progs.flatMap((x) => (x.daily_themes || []).map((t) => ({ ...t, prog: x.id }))).filter((t) => t.date && t.theme);
    if (themes.length) add("days", "Day by day", () => c.section({ id: "days", title: "Day by day", anchor: true, body: `<ol class="themes">${h.sortBy(themes, (t) => t.date).map((t) => `<li><time datetime="${t.date}">${esc(h.fmtDate(t.date))}<small>${esc(h.fmtDay(t.date).split(",")[0])}</small></time><div><b>${esc(t.theme)}</b>${t.highlights?.length ? `<p>${esc(t.highlights.join(" · "))}</p>` : ""}</div></li>`).join("")}</ol>${c.sourceLine([p.source_url], { note: "Themes as the organizers publish them." })}` }));

    // schedule: per program covered, runs (multi-day) once, then each day's sessions
    const schedFor = (root, id) => {
      const evs = events.filter((e) => e.program === id);
      const runs = h.sortBy(evs.filter((e) => allOngoing(e) && new Set(e.instances.map((x) => x.day)).size > 1), (e) => (e.instances[0].timeUnknown ? 1 : 0), (e) => (e.featured ? 0 : 1), (e) => e.date, (e) => e.title.toLowerCase());
      const runIds = new Set(runs.map((e) => e.id));
      const inst = db.instances.filter((x) => x.ev.program === id && !runIds.has(x.id) && (x.ev.live || x.ev.status === "cancelled"));
      // each day: sessions with listed times first, then that day's items with hours not listed
      const byDay = h.groupBy(h.sortBy(inst, (x) => (x.timeUnknown || x.allDay ? 1 : 0), (x) => x.s), (x) => x.day);
      const days = [...byDay.keys()].sort();
      const runsHtml = runs.length ? `<h3 class="sub-h">${esc(runs.every((e) => e.kind === "exhibition") ? `Exhibitions · ${runs.length}` : `Runs over several days · ${runs.length}`)}</h3><ol class="tonight prog-rows is-runs">${runs.map((e) => runRow(root, e)).join("")}</ol>` : "";
      const daysHtml = days.map((d) => `<h3 class="sub-h" id="${id}-d-${d}">${esc(h.fmtDay(d))} · ${esc(h.plural(byDay.get(d).length, "event"))}</h3><ol class="tonight prog-rows">${byDay.get(d).map((x) => row(root, x)).join("")}</ol>`).join("\n");
      return { html: daysHtml + runsHtml, n: evs.length };
    };
    add("schedule", "Schedule", (root) => {
      const parts = ids.map((id) => ({ id, ...schedFor(root, id) })).filter((x) => x.n);
      const draftNote = draft.length ? c.callout("warn", `<p>This schedule comes from a draft schedule page the organizers had published but not linked (${h.extLink(draft[0].source_url, esc(h.hostOf(draft[0].source_url)))}). Storefront gallery addresses, the map and most participating artists had not been announced when this guide was last updated. Check ${p.url ? h.extLink(p.url, esc(h.hostOf(p.url))) : "the official site"} for the full program.</p>`, { flag: "Still being announced" }) : "";
      const body = parts.length ? parts.map((x) => `${parts.length > 1 ? `<h3 class="prog-sub" data-prog="${x.id}">${bullet(x.id)}${esc(c.progName(x.id))} <span class="faint">· ${esc(h.plural(x.n, "event"))}</span></h3>` : ""}${x.html}`).join("\n")
        : c.emptyState({ title: "No events listed yet", body: "Events appear here as the organizers publish them.", glyph: "calendar", prog: pid });
      return c.section({ id: "schedule", title: "Schedule", kicker: `${h.plural(events.length, "event")} · times in Eastern Time`, anchor: true, more: { href: `schedule.html?p=${q}`, label: "Full schedule" }, root, body: `${draftNote}${body}` });
    });

    if (people.length) add("people", "People", (root) => {
      const roleCount = new Map();
      for (const x of people) for (const r of x.roles) roleCount.set(r, (roleCount.get(r) || 0) + 1);
      const roles = [...roleCount].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([r]) => r);
      const shown = new Set();
      const body = roles.map((r, ri) => {
        const list = people.filter((x) => x.roles.includes(r) && !shown.has(x.id));
        const total = roleCount.get(r);
        const pick = list.slice(0, MAX_PEOPLE);
        pick.forEach((x) => shown.add(x.id));
        if (!pick.length) return "";
        // the largest role leads with featured 4:5 portraits (DESIGN.md §8) when the program has photos; the rest are rows
        const prog = (x) => ids.find((i) => x.programs.includes(i));
        const featured = ri === 0 && cards.personFeature && pick.filter((x) => img.has("p", x.id)).length >= 4;
        const grid = featured ? `<div class="people-feature">${pick.map((x) => cards.personFeature(root, x, { prog: prog(x) })).join("")}</div>` : `<div class="people">${pick.map((x) => cards.personCard(root, x, { prog: prog(x) })).join("")}</div>`;
        return `<h3 class="sub-h">${esc(PLURAL_ROLE[r] || ROLE_LABEL[r] || r)} · ${total}</h3>${grid}${total > pick.length ? `<p class="prog-more"><a href="${root}people.html?p=${q}&amp;r=${r}">${esc(`All ${total} ${(PLURAL_ROLE[r] || r).toLowerCase()}`)}${icon("arrow-r")}</a></p>` : ""}`;
      }).join("\n");
      return c.section({ id: "people", title: "People", kicker: h.plural(people.length, "person", "people"), anchor: true, more: { href: `people.html?p=${q}`, label: "Everyone" }, root, body });
    });

    if (works.length) add("works", "Works", (root) => c.section({ id: "works", title: pid === "blink" ? "Art and installations" : "Works", kicker: h.plural(works.length, "work"), anchor: true, more: { href: `art.html?p=${q}`, label: `All ${works.length}` }, root, body: `<div class="works">${works.slice(0, MAX_WORKS).map((w) => cards.workCard(root, w)).join("")}</div>` }));

    if (venues.length) add("venues", "Venues", (root) => {
      const inArea = (v) => { if (!meta) return false; const [x, y] = project(v.lat, v.lng, meta); return x >= 0 && y >= 0 && x <= meta.W && y <= meta.H; };
      const noPoint = venues.filter((v) => v.lat == null);
      const outside = venues.filter((v) => v.lat != null && !inArea(v));
      const outCities = [...new Set(outside.map((v) => v.city).filter(Boolean))];
      const map = progMap(root, venues, pid, `Map of ${c.progName(pid)} venues in the guide, numbered as in the list`);
      const notes = [
        outside.length ? `${h.plural(outside.length, "venue")} ${outside.length === 1 ? "lies" : "lie"} outside this map's area${outCities.length ? ` (in ${h.listJoin(outCities.slice(0, 5))}${outCities.length > 5 ? " and more" : ""})` : ""}.` : "",
        noPoint.length ? `${h.plural(noPoint.length, "venue")} ${noPoint.length === 1 ? "has" : "have"} no published address, so ${noPoint.length === 1 ? "it is" : "they are"} not on the map.` : "",
      ].filter(Boolean).join(" ");
      const note = notes ? `<p class="prog-map-note">${esc(notes)}</p>` : "";
      return c.section({ id: "venues", title: "Venues", kicker: h.plural(venues.length, "venue"), anchor: true, more: { href: `venues.html?p=${pid}`, label: "All venues" }, root, body: `<div class="prog-venues">${map ? `<div class="prog-map-col">${map}${note}</div>` : ""}<ol class="venues">${venues.slice(0, MAX_VENUES).map((v) => cards.venueCard(root, v)).join("")}</ol></div>${venues.length > MAX_VENUES ? `<p class="prog-more"><a href="${root}venues.html?p=${pid}">${esc(`All ${venues.length} venues`)}${icon("arrow-r")}</a></p>` : ""}` });
    });

    if (orgs.length) add("sponsors", "Sponsors and partners", (root) => c.section({ id: "sponsors", title: "Sponsors and partners", kicker: h.plural(orgs.length, "organization"), anchor: true, more: { href: `partners.html?p=${pid}`, label: "All partners" }, root, body: ids.map((id) => {
      const es = db.orgsByProgram.get(id) || [];
      if (!es.length) return "";
      const home = P.get(id)?.url ? h.hostOf(P.get(id).url) : "";
      const all = [...new Set(es.map((x) => x.org.source_url))];
      const src = all.filter((u) => h.hostOf(u) === home);
      return `<div class="wall-group" data-prog="${id}">${ids.length > 1 ? `<div class="wall-head">${bullet(id, "lg")}<h3>${esc(c.progName(id))}</h3></div>` : ""}${cards.logoWall(root, es)}${c.sourceLine((src.length ? src : all).slice(0, 3), { note: "Tiers and names as the organizers list them; logos unaltered." })}</div>`;
    }).join("") }));

    if (faqs.length) add("faq", "Questions", (root) => c.section({ id: "faq", title: "Questions and answers", kicker: `${h.plural(faqs.length, "question")} · the organizers' answers`, anchor: true, more: faqs.length > MAX_FAQ ? { href: `faq.html?p=${pid}`, label: `All ${faqs.length}` } : { href: `faq.html?p=${pid}`, label: "FAQ" }, root, body: `<div class="faq-list">${faqs.slice(0, MAX_FAQ).map((f) => `<details class="faq"><summary>${esc(f.q)}</summary><div class="prose">${h.paras(f.a)}</div>${c.sourceLine([f.source_url])}</details>`).join("")}</div>` }));

    if (news.length) add("news", "News", (root) => c.section({ id: "news", title: "In the news", kicker: h.plural(newsAll, "story", "stories"), anchor: true, more: { href: `news.html?p=${q}`, label: "All news" }, root, body: `<div class="news-grid">${news.map((n) => newsCard(ctx, root, n, { anchor: false })).join("")}</div>` }));

    toc.push(["sources", "Sources"]);
    const srcHosts = new Map();
    const note = (u) => { if (!u) return; const host = h.hostOf(u); if (!host) return; if (!srcHosts.has(host)) srcHosts.set(host, { url: u, n: 0 }); srcHosts.get(host).n++; };
    for (const x of progs) { note(x.url); note(x.source_url); }
    for (const e of events) note(e.source_url);
    for (const x of people) note(x.source_url);
    for (const w of works) note(w.source_url);
    for (const f of faqs) note(f.source_url);
    for (const o of orgs) note(o.org.source_url);
    const sources = [...srcHosts].sort((a, b) => b[1].n - a[1].n);

    // the organizers' numbers: short values only (a date or an hour range is already in the facts)
    const stats = (p.stats || []).filter((x) => /\d/.test(x.value) && x.value.length <= 12 && !/^\d{1,2}:\d\d|^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(x.value)).slice(0, MAX_STATS);
    const history = p.history || [];
    // the organizers' text, verbatim; long pages are cut at four paragraphs with a link to the rest
    const paras = (p.description || "").split(/\n\s*\n/).filter((x) => x.trim());
    const about = paras.slice(0, 4).join("\n\n");

    return {
      path: `${pp.slug}.html`, nav: pp.slug, title: pp.label, toc, features: [], og: `og-${pid}.png`,
      description: h.truncate(`${pp.label}, ${h.fmtDateRange(p.dates.start, p.dates.end)}, ${p.dates.start.slice(0, 4)}: schedule, people, venues, tickets and sponsors, from the organizers' own pages.`, 158),
      jsonld: seo.programLd(config, p, { url, venue: hub }),
      body: (root) => `${c.pageHead({
        prog: pid, kicker: `Program · ${dateLine}${kickerHours}`, title: pp.label,
        titleHtml: `<span class="prog-u">${esc(pp.label)}</span>`,
        dek: [p.edition, ids.length > 1 ? `plus ${h.plural(events.filter((e) => e.program !== pid).length, "other happening")} around the week` : ""].filter(Boolean).join(" · "),
      })}
${p.tagline ? c.callout("org", `<p>“${esc(p.tagline)}”</p>`, { prog: pid, cite: `${esc(p.organizers?.[0]?.name || c.progName(pid))}, ${h.extLink(p.source_url, esc(h.hostOf(p.source_url)))}` }) : ""}
${c.facts(root, factRows(root))}
${c.section({ id: "about", title: `About ${pp.label}`, anchor: true, body: `${about ? `<div class="prose">${h.paras(about)}</div>${paras.length > 4 ? `<p class="prog-more">${h.extLink(p.source_url, `The organizers' page continues${icon("ext")}`)}</p>` : ""}` : '<p class="unk">Description not published</p>'}
${stats.length ? `<div class="stats stats-facts prog-stats" aria-label="The organizers' numbers">${stats.map((s) => `<div class="stat" data-prog="${pid}"><span class="n">${esc(s.value)}</span><span class="l">${esc(s.label)}</span><p class="src">Source: ${h.extLink(s.source_url, esc(h.hostOf(s.source_url)))}</p></div>`).join("")}</div>` : ""}
${history.length ? `<details class="prog-history"><summary>${icon("clock")}<span>History · ${esc(h.plural(history.length, "note"))}</span>${icon("chev-d", "chev")}</summary><ol>${h.sortBy(history, (x) => x.year).map((x) => `<li><b class="tnum">${esc(x.year)}</b><p>${esc(x.fact)} <span class="faint">(${h.extLink(x.source_url, esc(h.hostOf(x.source_url)))})</span></p></li>`).join("")}</ol></details>` : ""}
${c.sourceLine([p.source_url, p.url])}` })}
${secs.map((fn) => fn(root)).join("\n")}
${c.section({ id: "sources", title: "Sources", anchor: true, body: `<p class="prog-src-note">Everything on this page comes from these public pages. Counts are records in this guide.</p><ul class="prog-sources">${sources.map(([host, s]) => `<li>${h.extLink(s.url, esc(host))} <span class="faint tnum">${esc(h.plural(s.n, "record"))}</span></li>`).join("")}</ul><p class="prog-src-note">Something wrong or missing? ${h.extLink(`${config.repo}/issues`, "Report a correction")}.</p>` })}`,
    };
  }).filter(Boolean);
}

export function search(ctx) {
  const { db, h } = ctx;
  return PROGRAM_PAGES.map((pp) => {
    const p = db.byId.program.get(pp.programs[0]);
    return p ? { k: "pr", id: pp.slug, t: pp.label, s: h.fmtDateRange(p.dates.start, p.dates.end), u: `${pp.slug}.html`, p: p.id, g: [p.name, p.short_name, p.tagline].filter(Boolean).join(" ") } : null;
  }).filter(Boolean);
}
