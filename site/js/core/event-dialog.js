/* ============================================================
   site/js/core/event-dialog.js · OWNER: Agent D (schedule & plan)
   (under core/ because every page hosts #event-dialog; engine spec §4.8, DESIGN.md §9.11)
     open(id, { trigger, push })  fetch assets/data/events.json once, render into #event-dialog,
                                  set ?e=<id> with pushState (Back closes it), focus the title
     initEventDialog()            a click on [data-open-event] opens the dialog (modifier clicks keep
                                  the link); ?e= on load opens it; popstate syncs; idle prefetch
   The dialog: program, kind, title, when (ET, with the live state word), place (stall, venue page,
   address, room, mini-map and walking directions from assets/data/schedule-extra.json), the verbatim
   description, people (mugs → person pages), cost, registration, tracks and tags, the source, and
   actions: Add to My Plan, Add to calendar (.ics; lib/ics.js is loaded on click), Google Calendar
   (single sessions) and Share. Unknowns are printed as unknowns.
   ============================================================ */
import { $, ROOT, esc, modified } from "./dom.js";
import { getJSON, idle } from "./data.js";
import { showModal, hideModal, current } from "./modal.js";
import { now, onTick } from "./clock.js";
import { has, toggle, subscribe } from "./plan-store.js";
import { share } from "./share.js";
import { toast } from "./toast.js";
import { updateStatus } from "./status.js";
import { nyParts, fmtDay, fmtTime, fmtRange, fmtDateRange } from "../lib/time.js";
import { paras, initials, hostOf, roomText } from "../lib/text.js";

let modal, bodyEl, kickerEl, openId = null, pushed = false, cur = null, ICS = null;
const I = (n, cls = "") => `<svg class="i${cls ? " " + cls : ""}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const ext = (href, html, cls = "") => `<a${cls ? ` class="${cls}"` : ""} href="${esc(href)}" target="_blank" rel="noopener">${html}<span class="sr-only"> (opens in a new tab)</span></a>`;
const KIND = { keynote: "Keynote", panel: "Panel", workshop: "Workshop", fireside: "Fireside chat", networking: "Networking", party: "Party", pitch: "Pitch", exhibition: "Exhibition", installation: "Installation", performance: "Performance", talk: "Talk", tour: "Tour", market: "Market", screening: "Screening", other: "Event" };
const hm = (t) => nyParts(t).hhmm;

/** "4:00–9:00 PM", "10:00 AM · end time not listed", "All day", "Hours not listed" for one instance */
function hours([, s, e, f], ev, tz = "") {
  if (f & 4) return "All day";
  if (f & 2) return ev.ht ? esc(ev.ht) : '<span class="unk">Hours not listed</span>';
  // QA: the time zone follows the time itself ("4:00 PM ET · end time not listed"), never a line of its own;
  // an event tagged approximate-time reads "About 7:00 PM"
  const z = tz ? ` <span class="faint">${tz}</span>` : "", about = (ev.tg || []).includes("approximate-time") ? "About " : "";
  return f & 1 ? `<span class="nw">${about}${fmtTime(hm(s))}${z}</span> <span class="unk">end time not listed</span>` : `<span class="nw">${about}${esc(fmtRange(hm(s), hm(e)))}${z}</span>`;
}
/** The calendar day of an instance: an after-midnight start is printed on its own date, with its night. */
const dayOf = ([day, s, , f]) => (f & 16 ? `${fmtDay(nyParts(s).date)} (${fmtDay(day).split(",")[0]} night)` : fmtDay(day));

function whenHtml(ev, t, span) {
  const inst = ev.i;
  const pick = inst.find(([, , e]) => e > t) || inst[inst.length - 1];
  if (!pick) return "";
  const multi = inst.length > 1;
  const attrs = (x) => (x[3] & 2 ? ' data-time-unknown="1"' : `${multi ? ` data-inst="${inst.map(([, s, e]) => `${s}:${e}`).join(",")}"` : ""} data-s="${x[1]}" data-e="${x[2]}"${x[3] & 1 ? ' data-end-unknown="1"' : ""}`);
  const st = '<span class="ev-status" data-status></span>';
  if (!multi) return `<p class="evd-when"${attrs(pick)}>${esc(dayOf(pick))} · ${hours(pick, ev, "ET")} ${st}</p>`;
  const [first, last] = span || [inst[0][0], inst[inst.length - 1][0]];
  const same = inst.every((x) => hours(x, ev) === hours(inst[0], ev));
  // hours that vary by day: the headline names the day its state word is about, and every listed day follows
  // (integration pass: the first day's hours used to read as everyone's, e.g. the Zoo's 9 PM Tue/Wed closings)
  let html = `<p class="evd-when"${attrs(pick)}>${esc(fmtDateRange(first, last))} · ${same ? hours(inst[0], ev, "ET, each day") : `${esc(dayOf(pick))}: ${hours(pick, ev, "ET")}`} ${st}</p>`;
  if (!same) html += `<ul class="evd-days">${inst.map((x) => `<li><span class="tnum">${esc(dayOf(x))}</span> ${hours(x, ev)}</li>`).join("")}</ul>`;
  return html;
}

function render(data, ev, extra) {
  const geo = extra && extra.venues;
  const t = now();
  const v = ev.v ? data.venues[ev.v] : null;
  const prog = data.programs[ev.p] || { n: ev.p, s: ev.p };
  kickerEl.innerHTML = `<span class="prog-badge" data-prog="${esc(ev.p)}"><svg class="bullet" aria-hidden="true"><use href="#b-${esc(ev.p)}"/></svg>${esc(prog.n)}</span>`;
  const g = v && geo ? geo[ev.v] : null;
  const people = ev.pp.map((id) => [id, data.people[id]]).filter(([, p]) => p);
  const role = (id) => (ev.pr && ev.pr[id] ? ev.pr[id][0].toUpperCase() + ev.pr[id].slice(1) : "");
  const mug = (id, p) => (p.i ? `<span class="avatar m" data-prog="${esc(ev.p)}"><img src="${esc(ROOT + p.i)}" alt="" width="44" height="55" loading="lazy" decoding="async"></span>` : `<span class="avatar m mono halftone" data-prog="${esc(ev.p)}"><span aria-hidden="true">${esc(initials(p.n))}</span></span>`);
  const place = v
    ? `${v.st ? `<span class="ev-stall" aria-hidden="true">${esc(v.st)}</span>` : ""}<a href="${ROOT}venues/${esc(ev.v)}.html">${esc(v.n)}</a>${roomText(v.n, ev.r) ? `<span class="ev-room"> · ${esc(roomText(v.n, ev.r))}</span>` : ""}${v.a ? `<span class="evd-addr">${esc(v.a)}</span>` : '<span class="evd-addr unk">Address not listed</span>'}`
    : ev.lt && ev.lt !== "Location not listed" ? `${esc(ev.lt)}${ev.r ? ` · ${esc(ev.r)}` : ""}` : `<span class="unk">${ev.lt ? "Location not listed" : "Place not listed"}</span>`;
  const side = v && v.ll
    ? `${g && g.mm ? g.mm.replace(/\{R\}/g, ROOT) : ""}${g && g.d ? `<p class="evd-dir">${ext(g.d.apple, `${I("walk")}Apple Maps`, "btn btn-secondary btn-sm")}${ext(g.d.google, `${I("walk")}Google Maps`, "btn btn-secondary btn-sm")}</p>` : ""}`
    : `<p class="unk">${v && v.a ? "Not on the map" : "Not on the map: the address is not listed"}</p>`;
  const cost = ev.f === 1 ? `<span class="badge badge-free">Free</span>${ev.c && !/^free\.?$/i.test(ev.c) ? ` ${esc(ev.c)}` : ""}` : ev.c ? esc(ev.c) : '<span class="unk">not listed</span>';
  // tags without repeats of the tracks or of the Free badge; slug-like tags read as words
  const seen = new Set([...ev.tr, ev.f === 1 ? "free" : ""].map((x) => x.toLowerCase().replace(/[^a-z0-9]+/g, "-")));
  const tags = ev.tg.filter((x) => { const k = x.toLowerCase().replace(/[^a-z0-9]+/g, "-"); if (seen.has(k)) return false; seen.add(k); return true; }).map((x) => (/\s/.test(x) ? x : x.replace(/-/g, " ")));
  const facts = [
    ["Cost", cost],
    ev.u ? ["Registration", ext(ev.u, `${esc(hostOf(ev.u) || "Register")}`)] : null,
    ev.tr.length ? ["Track", esc(ev.tr.join(", "))] : null,
    tags.length ? ["Tags", esc(tags.join(", "))] : null,
    ev.i.some((x) => x[3] & 2) && ev.tt ? ["Listed as", `“${esc(ev.tt)}”`] : null,
  ].filter(Boolean);
  const inPlan = has(ev.id);
  const single = ev.i.length === 1 && !(ev.i[0][3] & 6);
  const items = ICS ? ICS.eventItems(ev, data, { base: new URL(ROOT || "./", location.href).href, span: extra && extra.spans && extra.spans[ev.id] }) : [];
  bodyEl.dataset.evd = ev.id;
  bodyEl.innerHTML = `<p class="evd-kind label">${esc(KIND[ev.k] || ev.k)}${ev.st === "cancelled" ? ' <span class="badge badge-warn">Cancelled</span>' : ev.st === "changed" ? ' <span class="badge badge-warn">Changed</span>' : ""}</p>
<h2 id="evd-title" tabindex="-1">${esc(ev.t)}</h2>
${whenHtml(ev, t, extra && extra.spans && extra.spans[ev.id])}
<div class="evd-grid"><div class="evd-main">
<p class="ev-where evd-where">${I("pin")}<span>${place}</span></p>
${ev.d ? `<div class="prose evd-desc">${paras(ev.d).map((p) => `<p>${esc(p)}</p>`).join("")}</div>` : ev.d === undefined ? '<p class="unk evd-desc">The description did not load. The official page below has it.</p>' : '<p class="unk evd-desc">Description not listed</p>'}
${people.length ? `<h3 class="sub-h">People</h3><ul class="evd-people">${people.map(([id, p]) => `<li><a href="${ROOT}people/${esc(id)}.html">${mug(id, p)}<span><b>${esc(p.n)}</b>${role(id) || p.t ? `<span>${esc([role(id), p.t].filter(Boolean).join(" · "))}</span>` : ""}</span></a></li>`).join("")}</ul>` : ""}
${(ev.cr || []).filter(([, n]) => n && n.length).map(([r, n]) => `<h3 class="sub-h">${esc(r)}</h3><p class="evd-credits">${esc(n.join(", "))}</p>`).join("")}
<dl class="facts evd-facts">${facts.map(([k, val]) => `<div class="fact"><dt>${k}</dt><dd>${val}</dd></div>`).join("")}</dl>
</div><div class="evd-side">${side}</div></div>
<p class="source-line">${I("info")}<span>Source: ${ext(ev.src, esc(hostOf(ev.src) || ev.src))}</span></p>
<div class="evd-actions"><button class="btn btn-river" type="button" data-evd-star aria-pressed="${inPlan}">${I("star", inPlan ? "i-fill" : "")}<span>${inPlan ? "In My Plan" : "Add to My Plan"}</span></button><button class="btn btn-secondary" type="button" data-evd-ics>${I("download")}Add to calendar (.ics)</button>${single && items.length ? ext(ICS.gcalUrl(items[0]), "Google Calendar", "btn btn-ghost") : ""}<button class="btn btn-secondary" type="button" data-evd-share>${I("share")}Share</button></div>`;
  tick(t);
}

function tick(t) {
  updateStatus(t, bodyEl);
  const st = $(".evd-when", bodyEl)?.dataset.status;
  if (st) bodyEl.dataset.status = st; else delete bodyEl.dataset.status;
}
function syncStar() {
  const b = bodyEl && $("[data-evd-star]", bodyEl);
  if (!b || !openId) return;
  const on = has(openId);
  b.setAttribute("aria-pressed", String(on));
  b.innerHTML = `${I("star", on ? "i-fill" : "")}<span>${on ? "In My Plan" : "Add to My Plan"}</span>`;
}

const urlFor = (id) => { const u = new URL(location.href); if (id) u.searchParams.set("e", id); else u.searchParams.delete("e"); u.hash = ""; return u.pathname + u.search; };
const deepLink = (id) => new URL(`${ROOT}schedule.html?e=${encodeURIComponent(id)}#e-${encodeURIComponent(id)}`, location.href).href;

export async function open(id, { trigger = null, push = true } = {}) {
  if (!modal) return;
  let data, extra = null, text = null;
  try { [data, extra, ICS, text] = await Promise.all([getJSON("events.json"), getJSON("schedule-extra.json").catch(() => null), import("../lib/ics.js").catch(() => null), getJSON("event-text.json").catch(() => null)]); }
  catch { location.href = `${ROOT}schedule.html?e=${encodeURIComponent(id)}#e-${encodeURIComponent(id)}`; return; }
  const found = data.events.find((x) => x.id === id);
  if (!found) return;
  // descriptions live in event-text.json (core/client-data.mjs); undefined = it did not load, null = not listed
  const ev = { ...found, d: text && text.d ? text.d[found.id] || null : found.d };
  cur = { data, ev, span: extra && extra.spans && extra.spans[ev.id] };
  render(data, ev, extra);
  openId = id;
  if (push) { history.pushState({ evd: id }, "", urlFor(id)); pushed = true; } else pushed = false;
  showModal(modal, { trigger, focus: "#evd-title", onClose: () => {
    const wasPushed = pushed; openId = null; pushed = false; cur = null;
    // focus goes back to the trigger: make sure it is on screen (not under the sticky bars)
    if (trigger && document.contains(trigger)) requestAnimationFrame(() => { const r = trigger.getBoundingClientRect(); if (r.top < 140 || r.bottom > innerHeight - 70) trigger.scrollIntoView({ block: "center" }); });
    if (wasPushed && history.state && history.state.evd === id) history.back();
    else if (new URL(location.href).searchParams.has("e")) history.replaceState(history.state, "", urlFor(null) + location.hash);
  } });
}

function calendar() {
  const ics = ICS;
  if (!cur || !ics) return;
  const items = ics.eventItems(cur.ev, cur.data, { base: new URL(ROOT || "./", location.href).href, span: cur.span });
  if (!items.length) return;
  const url = URL.createObjectURL(new Blob([ics.vcalendar(items, { name: cur.ev.t })], { type: "text/calendar;charset=utf-8" }));
  const dl = document.createElement("a");
  dl.href = url; dl.download = ics.icsFilename(cur.ev.t); dl.hidden = true;
  document.body.appendChild(dl); dl.click();
  setTimeout(() => { URL.revokeObjectURL(url); dl.remove(); }, 1500);
  toast(items.length > 1 ? `Calendar file with ${items.length} days downloaded` : "Calendar file downloaded");
}

export function initEventDialog() {
  modal = $("#event-dialog"); if (!modal) return;
  bodyEl = $("[data-evd-body]", modal); kickerEl = $("[data-evd-kicker]", modal);
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-open-event]");
    if (!a || modified(e)) return;
    e.preventDefault();
    open(a.dataset.openEvent, { trigger: a });
  });
  modal.addEventListener("click", (e) => {
    if (!openId) return;
    if (e.target.closest("[data-evd-star]")) { const on = toggle(openId, "e"); syncStar(); toast(on ? "Added to My Plan" : "Removed from My Plan", { link: on ? true : null }); }
    if (e.target.closest("[data-evd-ics]")) calendar();
    if (e.target.closest("[data-evd-share]")) share({ title: $("#evd-title", modal).textContent, url: deepLink(openId) });
  });
  subscribe(syncStar);
  window.addEventListener("popstate", () => {
    const id = new URL(location.href).searchParams.get("e");
    if (!id && openId && current() === modal) { pushed = false; hideModal(); }
    else if (id && id !== openId) open(id, { push: false });
  });
  const id = new URL(location.href).searchParams.get("e");
  if (id) {
    const card = document.getElementById(`e-${id}`);
    open(id, { push: false, trigger: card && card.querySelector("[data-open-event]") });
  }
  onTick((t) => { if (openId) tick(t); }, { immediate: false });
  // engine §4.8: prefetch events.json when idle on pages that can open the dialog, so it opens at once
  if (document.querySelector("[data-open-event]")) idle(() => getJSON("events.json").catch(() => {}));
  // the descriptions (event-text.json) load on the first sign of intent: a pointer or focus on anything that opens the dialog
  const warm = (e) => {
    if (!(e.target instanceof Element) || !e.target.closest("[data-open-event]")) return;
    getJSON("event-text.json").catch(() => {});
    for (const t of ["pointerover", "focusin"]) document.removeEventListener(t, warm, true);
  };
  for (const t of ["pointerover", "focusin"]) document.addEventListener(t, warm, { capture: true, passive: true });
}
