/* ============================================================
   build/components/event-card.mjs · OWNER: Agent D (schedule & plan)

   makeEventCards(ctx) → {
     eventCard(root, evOrInstance, { anchor = true, headingLevel = 3, span = false, compact = false }),
     eventRow(root, instance)          compact time-first row (.tonight li),
     eventList(root, instances, { groupBy: "day" | "none", headingLevel }),
     whenText(instance) → plain text ("4:00–9:00 PM", "10:00 AM · end time not listed", "Hours not listed")
   }
   Card contract (engine spec §4.8, reused on schedule, person, venue, program and plan pages):
   <article class="ev" id="e-{id}" data-ev data-p data-kg data-k data-day data-s data-e [data-inst] [data-days]
            [data-end-unknown] [data-time-unknown] data-t data-h data-v data-free data-q [data-cancelled]>
     .ev-when (<time datetime>…, .ev-status[data-status]) · .ev-body (.ev-meta .ev-title a[data-open-event]
     .ev-where .ev-people .ev-tags details.ev-more) · button.star[data-star]
   - data-k is the raw kind, so ?k= may name a kind group or a single kind (paramValues in build/nav.mjs).
   - data-q is normalized text of what the card does NOT print (credited names, people beyond
     the two named, their orgs, tags and tracks beyond the two shown); a filter adds the card's visible text.
   - data-h / data-v are left out when the event has no neighborhood / venue.
   - span (or an event record with several day instances): one card for a multi-day item; data-inst lists
     each day's "s:e" (only when hours are listed: the core gives hours-not-listed items no state), and
     data-days lists the festival days it runs inside the guide's days, for the schedule's day filter.
   - The title link is the deep link schedule.html?e={id}#e-{id}; with JS it opens the dialog. Without JS
     the reader lands on the card, whose <details> holds the verbatim description, people, cost and source.
   - compact: no people strip or tags (the schedule's "All day and all night" band).
   Unknowns are printed as unknowns: "end time not listed", "Hours not listed", "Room not listed",
   "Place not listed". Nothing here guesses.
   ============================================================ */
import { esc, attr, paras, extLink, hostOf } from "../core/util.mjs";
import { icon } from "../core/icons.mjs";
import { KIND_LABEL } from "../core/schema.mjs";
import { norm } from "../../site/js/lib/search.js";
import { fmtTime, fmtDay, fmtDateRange, isoLocal, bucket, toMinutes } from "../core/time.mjs";

/** data/README.md (C): the one sentinel string in the data; it is printed as an unknown, never as a place. */
const UNLISTED = "Location not listed";
/** A sprite icon for card internals (the same symbol as h.icon, a few bytes lighter: cards repeat it hundreds of times). */
const ic = (name) => { icon(name); return `<svg class="i" aria-hidden="true"><use href="#i-${name}"/></svg>`; };

export function makeEventCards(ctx) {
  const { db, c, img } = ctx;
  const P = db.byId.person;
  const dayset = new Set(db.days.map((d) => d.date));
  // venues where some event lists a room: a missing room there is "Room not listed" (a hub like Union Hall)
  const roomy = new Set(db.events.filter((e) => e.room && e.venue_id).map((e) => e.venue_id));

  /** "4:00–9:00 PM" as <time> elements; one AM/PM when both share it (DESIGN.md §14). */
  function when(inst, { dates = false } = {}) {
    const ev = inst.ev;
    const range = dates && ev.end_date && ev.end_date !== ev.date ? ` <span class="ev-dates">· ${esc(fmtDateRange(ev.date, ev.end_date))}</span>` : "";
    if (inst.allDay) return `<span>All day</span>${range}`;
    if (inst.timeUnknown) return `<span class="unk">${ev.hours_text ? esc(ev.hours_text) : "Hours not listed"}</span>${range}`;
    const a = fmtTime(inst.start), b = inst.end ? fmtTime(inst.end) : "";
    const sameHalf = b && a.slice(-2) === b.slice(-2) && inst.end > inst.start;
    const t1 = `<time datetime="${isoLocal(inst.s)}">${esc(sameHalf ? a.slice(0, -3) : a)}</time>`;
    const late = inst.lateNight ? ' <span class="ev-dates">· after midnight</span>' : "";
    if (!b) return `${t1} <span class="unk">end time not listed</span>${range}${late}`;
    return `${t1}–<time datetime="${isoLocal(inst.e)}">${esc(b)}</time>${range}${late}`;
  }
  /** Plain-text version for labels and search. */
  function whenText(inst) {
    if (inst.allDay) return "All day";
    if (inst.timeUnknown) return inst.ev.hours_text || "Hours not listed";
    return inst.end ? ctx.h.fmtRange(inst.start, inst.end) : `${fmtTime(inst.start)} · end time not listed`;
  }

  const people = (ev) => (ev.people || []).map((id) => P.get(id)).filter(Boolean);
  /** "<b>Jane Doe</b>, Org and 3 more" with up to three 28×35 mugs (DESIGN.md §9.4). */
  function peopleLine(root, ev) {
    const ps = people(ev);
    if (!ps.length) return "";
    const mugs = ps.slice(0, 3).map((p) => img.mug(root, p, { size: "s", prog: ev.program })).join("");
    const shown = ps.slice(0, 2);
    const org = shown.length === 1 ? shown[0].org : shown.every((p) => p.org && p.org === shown[0].org) ? shown[0].org : null;
    const names = shown.map((p) => `<a href="${root}people/${attr(p.id)}.html"><b>${esc(p.name)}</b></a>`).join(ps.length > 2 ? ", " : " and ");
    const more = ps.length > 2 ? ` and ${ps.length - 2} more` : "";
    return `<p class="ev-people"><span class="avatar-stack" aria-hidden="true">${mugs}</span><span>${names}${org && !more ? `, ${esc(org)}` : ""}${more}</span></p>`;
  }

  function where(root, ev) {
    const v = ev.venue;
    const pin = ic("pin");
    if (v) {
      const stall = v.stall ? `<span class="ev-stall" aria-hidden="true">${v.stall}</span>` : "";
      const room = ev.room ? `<span class="ev-room"> · ${esc(ev.room)}</span>` : roomy.has(v.id) ? ' <span class="unk">Room not listed</span>' : "";
      return `${pin}<span>${stall}<a href="${root}venues/${attr(v.id)}.html">${esc(v.name)}</a>${room}</span>`;
    }
    if (ev.location_text && ev.location_text !== UNLISTED) return `${pin}<span>${esc(ev.location_text)}${ev.room ? `<span class="ev-room"> · ${esc(ev.room)}</span>` : ""}</span>`;
    return `${pin}<span class="unk">${ev.location_text === UNLISTED ? UNLISTED : "Place not listed"}</span>`;
  }

  /** The no-JS body: the verbatim description, everyone with a link, cost, registration and the source. */
  function more(root, ev, compact) {
    const ps = people(ev).slice(compact ? 0 : 2);
    const role = (id) => (ev.people_roles || {})[id];
    return [
      ev.description ? paras(ev.description) : '<p class="unk">Description not listed</p>',
      ...(ev.credits || []).filter((cr) => cr.names?.length).map((cr) => `<p><b>${esc(cr.role)}:</b> ${esc(cr.names.join(", "))}</p>`),
      ps.length ? `<p><b>${compact ? "With" : "Also with"}</b> ${ps.map((p) => `<a href="${root}people/${attr(p.id)}.html">${esc(p.name)}</a>${role(p.id) ? ` (${esc(role(p.id))})` : ""}`).join(", ")}</p>` : "",
      ev.cost ? `<p><b>Cost:</b> ${esc(ev.cost)}</p>` : "",
      ev.registration_url ? `<p>${extLink(ev.registration_url, "Registration")}</p>` : "",
      `<p class="faint">Source: ${extLink(ev.source_url, esc(hostOf(ev.source_url)))}</p>`,
    ].join("");
  }

  function eventCard(root, x, { anchor = true, headingLevel = 3, span = false, compact = false } = {}) {
    const inst = x.ev ? x : { ...(x.instances?.[0] || {}), ev: x };
    const ev = inst.ev;
    const all = ev.instances || [];
    const multi = all.length > 1 && (span || !x.ev);
    const hours = !inst.timeUnknown && !inst.allDay;
    const instAttr = multi && !inst.timeUnknown ? ` data-inst="${all.map((y) => `${y.s}:${y.e}`).join(",")}"` : "";
    const days = multi ? [...new Set(all.map((y) => y.day))].filter((d) => dayset.has(d)) : [];
    const daysAttr = multi ? ` data-days="${days.join(" ")}"` : "";
    const v = ev.venue;
    const ps = people(ev);
    // tracks, then tags, without repeats ("Opening program" and "opening-program" are one tag); slugs read as words
    const seenTag = new Set(), tagList = [];
    for (const t of [...(ev.tracks || []), ...(ev.tags || [])]) { const k = ctx.h.slugify(t); if (k && !seenTag.has(k) && !(ev.is_free === true && k === "free")) { seenTag.add(k); tagList.push(/\s/.test(t) ? t : t.replace(/-/g, " ")); } }
    const tags = [ev.is_free === true ? '<span class="free">Free</span>' : "", ...tagList.slice(0, 3).map(esc)].filter(Boolean);
    // data-q holds only the words the card does not print (features/schedule.js adds the visible text)
    const shownPeople = compact ? 0 : 2, shownTags = compact ? 0 : 3;
    const q = [...new Set(norm([...ps.slice(shownPeople).map((p) => p.name), ...ps.map((p) => p.org), ...(ev.credits || []).flatMap((cr) => cr.names || []), ...tagList.slice(shownTags)].filter(Boolean).join(" ")).split(/\s+/))].join(" ");
    const H = `h${headingLevel}`;
    const status = ev.status === "cancelled" ? '<span class="badge badge-warn">Cancelled</span>' : ev.status === "changed" ? '<span class="badge badge-warn">Changed</span>' : "";
    const t = inst.start && hours ? bucket(inst.start) : "allday";
    return `<article class="ev"${anchor ? ` id="e-${attr(ev.id)}"` : ""} data-ev="${attr(ev.id)}" data-p="${ev.program}" data-kg="${ev.kg}" data-k="${ev.kind}" data-day="${inst.day}" data-s="${inst.s}" data-e="${inst.e}"${instAttr}${daysAttr}${inst.endUnknown ? ' data-end-unknown="1"' : ""}${inst.timeUnknown ? ' data-time-unknown="1"' : ""} data-t="${t}"${ev.hood ? ` data-h="${attr(ev.hood)}"` : ""}${ev.venue_id ? ` data-v="${attr(ev.venue_id)}"` : ""} data-free="${ev.is_free === true ? 1 : 0}" data-q="${attr(q)}"${ev.status === "cancelled" ? ' data-cancelled="1"' : ""}>`
      + `<div class="ev-when">${when(inst, { dates: true })} <span class="ev-status" data-status></span>${status}</div>`
      + `<div class="ev-body"><p class="ev-meta">${c.progBadge(ev.program)}<span class="ev-kind">${esc(KIND_LABEL[ev.kind] || ev.kind)}</span></p>`
      + `<${H} class="ev-title"><a href="${root}schedule.html?e=${attr(ev.id)}#e-${attr(ev.id)}" data-open-event="${attr(ev.id)}">${esc(ev.title)}</a></${H}>`
      + `<p class="ev-where">${where(root, ev)}</p>`
      + (compact ? "" : peopleLine(root, ev) + (tags.length ? `<p class="ev-tags">${tags.join(" · ")}</p>` : ""))
      + `<details class="ev-more"><summary>Details</summary>${more(root, ev, compact)}</details></div>`
      + `${c.starButton(ev.id, ev.title)}</article>`;
  }

  /** A time-first row for "Tonight"-style lists (DESIGN.md §9.2), styled by .tonight in 20-content.css. */
  function eventRow(root, inst) {
    const ev = inst.ev;
    const timed = inst.start && !inst.timeUnknown && !inst.allDay;
    const t = timed ? fmtTime(inst.start) : "";
    const [hm, ap] = t ? t.split(" ") : ["", ""];
    const label = inst.allDay ? "All day" : "Time not listed";
    return `<li><a href="${root}schedule.html?e=${attr(ev.id)}#e-${attr(ev.id)}" data-open-event="${attr(ev.id)}"><time${timed ? ` datetime="${isoLocal(inst.s)}"` : ""}>${t ? `${esc(hm)}<small>${esc(ap)}</small>` : `<small>${label}</small>`}</time>${ctx.h.bullet(ev.program)}<span><span class="t">${esc(ev.title)}</span><span class="w">${esc([fmtDay(inst.day), ev.venue?.name || ev.location_text].filter(Boolean).join(" · "))}</span></span></a></li>`;
  }

  /** Cards grouped by festival day (anchors only on the first card of each event). */
  function eventList(root, instances, { groupBy = "day", headingLevel = 3 } = {}) {
    const seen = new Set();
    const card = (x) => { const a = !seen.has(x.id); seen.add(x.id); return eventCard(root, x, { anchor: a, headingLevel: groupBy === "day" ? headingLevel + 1 : headingLevel }); };
    if (groupBy !== "day") return `<div class="grid">${instances.map(card).join("")}</div>`;
    const days = new Map();
    for (const x of instances) { if (!days.has(x.day)) days.set(x.day, []); days.get(x.day).push(x); }
    return [...days].map(([d, xs]) => `<h${headingLevel} class="sub-h">${esc(fmtDay(d))}</h${headingLevel}><div class="grid">${xs.map(card).join("")}</div>`).join("\n");
  }

  return { eventCard, eventRow, eventList, whenText, toMinutes };
}
