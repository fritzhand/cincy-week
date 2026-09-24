/* ============================================================
   build/components/event-card.mjs · OWNER: Agent D (schedule & plan)
   Landed by Agent A as a working stub that already emits the engine §4.8
   card contract (tests/build.test.mjs checks it). Agent D owns this file.

   makeEventCards(ctx) → {
     eventCard(root, evOrInstance, { anchor = true, headingLevel = 3, span = false }),
     eventRow(root, instance)          compact time-first row (.tonight li),
     eventList(root, instances, { groupBy: "day" | "none" })
   }
   Card contract (reused everywhere: schedule, person, venue, program, plan):
   <article class="ev" id="e-{id}" data-ev data-p data-kg data-k data-day data-s data-e data-t data-h data-v data-free data-q>
   (data-k = the raw kind, so ?k= may name a kind group or a single kind: see paramValues in build/nav.mjs)
     .ev-when (<time datetime>…, .ev-status[data-status]) · .ev-body (.ev-meta .ev-title a[data-open-event] .ev-where
     .ev-people .ev-tags details.ev-more) · button.star[data-star]
   The title link is the deep link schedule.html?e={id}#e-{id}; JS opens the dialog instead.
   ============================================================ */
import { esc, attr, paras, extLink, hostOf } from "../core/util.mjs";
import { icon } from "../core/icons.mjs";
import { KIND_LABEL } from "../core/schema.mjs";
import { norm } from "../../site/js/lib/search.js";
import { fmtTime, fmtDay, fmtDateRange, isoLocal, bucket, toMinutes } from "../core/time.mjs";

export function makeEventCards(ctx) {
  const { db, c, img } = ctx;
  const P = db.byId.person;

  /** "9:00–10:00 AM" as two <time> elements; unknowns printed as unknowns. */
  function when(inst) {
    const ev = inst.ev;
    if (inst.allDay) return `<span>All day</span>`;
    if (inst.timeUnknown) return `<span class="unk">${ev.hours_text ? esc(ev.hours_text) : "Hours not listed"}</span>`;
    const a = fmtTime(inst.start), b = inst.end ? fmtTime(inst.end) : "";
    const sameHalf = b && a.slice(-2) === b.slice(-2) && inst.end > inst.start;
    const t1 = `<time datetime="${isoLocal(inst.s)}">${esc(sameHalf ? a.slice(0, -3) : a)}</time>`;
    if (!b) return `${t1} <span class="unk">end time not listed</span>`;
    return `${t1}–<time datetime="${isoLocal(inst.e)}">${esc(b)}</time>`;
  }

  function peopleLine(root, ev) {
    const ps = (ev.people || []).map((id) => P.get(id)).filter(Boolean);
    if (!ps.length) return "";
    const mugs = ps.slice(0, 3).map((p) => img.mug(root, p, { size: "s", prog: ev.program })).join("");
    const names = ps.slice(0, 2).map((p, i) => (i === 0 ? `<b>${esc(p.name)}</b>` : esc(p.name)));
    const more = ps.length > 2 ? ` and ${ps.length - 2} more` : "";
    return `<p class="ev-people"><span class="avatar-stack" aria-hidden="true">${mugs}</span><span>${names.join(", ")}${more}</span></p>`;
  }

  /** span: one card for a multi-day item; data-inst lists every day's s:e so live status follows the current day. */
  function eventCard(root, x, { anchor = true, headingLevel = 3, span = false } = {}) {
    let inst = x.ev ? x : { ...(x.instances?.[0] || {}), ev: x };
    const all = inst.ev.instances || [];
    const instAttr = span && all.length > 1 ? ` data-inst="${all.map((y) => `${y.s}:${y.e}`).join(",")}"` : "";
    const ev = inst.ev;
    const v = ev.venue;
    const people = (ev.people || []).map((id) => P.get(id)?.name).filter(Boolean);
    const q = norm([ev.title, c.progName(ev.program, true), v?.name, ev.location_text, ev.room, ...people, ...(ev.tags || []), ...(ev.tracks || [])].filter(Boolean).join(" "));
    const where = v
      ? `${icon("pin")}<span><a href="${root}venues/${attr(v.id)}.html">${esc(v.name)}</a>${ev.room ? `<span class="ev-room"> · ${esc(ev.room)}</span>` : ""}</span>`
      : ev.location_text ? `${icon("pin")}<span>${esc(ev.location_text)}</span>` : `${icon("pin")}<span class="unk">Place not listed</span>`;
    const multi = ev.end_date && ev.end_date !== ev.date ? ` <span class="faint">· ${esc(fmtDateRange(ev.date, ev.end_date))}</span>` : "";
    const tags = [ev.is_free === true ? '<span class="free">Free</span>' : "", ...(ev.tracks || []).slice(0, 2).map(esc)].filter(Boolean);
    const H = `h${headingLevel}`;
    const more = [paras(ev.description), ev.cost ? `<p><b>Cost:</b> ${esc(ev.cost)}</p>` : "", ev.registration_url ? `<p>${extLink(ev.registration_url, "Registration")}</p>` : "", `<p class="faint">Source: ${extLink(ev.source_url, esc(hostOf(ev.source_url)))}</p>`].filter(Boolean).join("");
    const status = ev.status === "cancelled" ? '<span class="badge badge-warn">Cancelled</span>' : ev.status === "changed" ? '<span class="badge badge-warn">Changed</span>' : "";
    return `<article class="ev"${anchor ? ` id="e-${attr(ev.id)}"` : ""} data-ev="${attr(ev.id)}" data-p="${ev.program}" data-kg="${ev.kg}" data-k="${ev.kind}" data-day="${inst.day}" data-s="${inst.s}" data-e="${inst.e}"${instAttr}${inst.endUnknown ? ' data-end-unknown="1"' : ""}${inst.timeUnknown ? ' data-time-unknown="1"' : ""} data-t="${inst.start ? bucket(inst.start) : "allday"}" data-h="${attr(ev.hood || "")}" data-v="${attr(ev.venue_id || "")}" data-free="${ev.is_free === true ? 1 : 0}" data-q="${attr(q)}"${ev.status === "cancelled" ? ' data-cancelled="1"' : ""}>
<div class="ev-when">${when(inst)}${multi} <span class="ev-status" data-status aria-live="off"></span>${status}</div>
<div class="ev-body">
<p class="ev-meta">${c.progBadge(ev.program)}<span class="ev-kind">${esc(KIND_LABEL[ev.kind] || ev.kind)}</span></p>
<${H} class="ev-title"><a href="${root}schedule.html?e=${attr(ev.id)}#e-${attr(ev.id)}" data-open-event="${attr(ev.id)}">${esc(ev.title)}</a></${H}>
<p class="ev-where">${where}</p>
${peopleLine(root, ev)}${tags.length ? `<p class="ev-tags">${tags.join(" · ")}</p>` : ""}
<details class="ev-more"><summary>Details</summary>${more}</details>
</div>
${c.starButton(ev.id, ev.title)}
</article>`;
  }

  /** A time-first row for "Tonight"-style lists (DESIGN.md §9.2). */
  function eventRow(root, inst) {
    const ev = inst.ev;
    const t = inst.start && !inst.timeUnknown ? fmtTime(inst.start) : "";
    const [hm, ap] = t ? t.split(" ") : ["", ""];
    return `<li><a href="${root}schedule.html?e=${attr(ev.id)}#e-${attr(ev.id)}" data-open-event="${attr(ev.id)}"><time${inst.s && t ? ` datetime="${isoLocal(inst.s)}"` : ""}>${t ? `${esc(hm)}<small>${esc(ap)}</small>` : "<small>All day</small>"}</time>${ctx.h.bullet(ev.program)}<span><span class="t">${esc(ev.title)}</span><span class="w">${esc([fmtDay(inst.day), ev.venue?.name || ev.location_text].filter(Boolean).join(" · "))}</span></span></a></li>`;
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

  return { eventCard, eventRow, eventList, toMinutes };
}
