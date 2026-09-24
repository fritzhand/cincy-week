/* ============================================================
   site/js/core/event-dialog.js · OWNER: Agent D (schedule & plan)
   Landed by Agent A as a working stub (the path is core/ because every page
   hosts the dialog; Agent D owns it). Contract (engine spec §4.8):
     open(id, { trigger, push })  fetch assets/data/events.json once, render into
                                  #event-dialog, set ?e=<id> with pushState (Back closes it),
                                  focus the title
     initEventDialog()            a click on [data-open-event] opens the dialog (modifier
                                  clicks keep the link); ?e= on load opens it; popstate syncs
   Still to come from Agent D: mini-map, add to calendar (.ics + Google), more at this venue.
   ============================================================ */
import { $, ROOT, esc, modified } from "./dom.js";
import { getJSON, idle } from "./data.js";
import { showModal, hideModal, current } from "./modal.js";
import { now, onTick } from "./clock.js";
import { has, toggle } from "./plan-store.js";
import { share } from "./share.js";
import { updateStatus } from "./status.js";
import { nyParts, fmtDay, fmtTime, fmtRange } from "../lib/time.js";
import { paras } from "../lib/text.js";

let modal, bodyEl, kickerEl, openId = null, pushed = false;

function whenText(day, s, e, f) {
  if (f & 4) return "All day";
  if (f & 2) return "Hours not listed";
  const a = nyParts(s).hhmm, b = nyParts(e).hhmm;
  return f & 1 ? `${fmtTime(a)} · end time not listed` : fmtRange(a, b);
}

function render(data, ev) {
  const t = now();
  const inst = ev.i.find(([, , e]) => e > t) || ev.i[0];
  const v = ev.v ? data.venues[ev.v] : null;
  const prog = data.programs[ev.p] || { n: ev.p, s: ev.p };
  kickerEl.innerHTML = `<span class="prog-badge" data-prog="${esc(ev.p)}"><svg class="bullet" aria-hidden="true"><use href="#b-${esc(ev.p)}"/></svg>${esc(prog.s)}</span>`;
  const people = ev.pp.map((id) => [id, data.people[id]]).filter(([, p]) => p);
  const inPlan = has(ev.id);
  bodyEl.dataset.evd = ev.id;
  bodyEl.innerHTML = `<h2 id="evd-title" tabindex="-1">${esc(ev.t)}</h2>
<p class="evd-when" ${inst ? `data-s="${inst[1]}" data-e="${inst[2]}"${inst[3] & 1 ? ' data-end-unknown="1"' : ""}${inst[3] & 6 ? ' data-time-unknown="1"' : ""}` : ""}>${inst ? `${esc(fmtDay(inst[0]))} · ${esc(whenText(...inst))} <span class="faint">ET</span>` : ""}<span class="ev-status" data-status></span></p>
<div class="evd-grid"><div>
<p class="ev-where"><svg class="i" aria-hidden="true"><use href="#i-pin"/></svg><span>${v ? `<a href="${ROOT}venues/${esc(ev.v)}.html">${esc(v.n)}</a>${v.a ? ` · ${esc(v.a)}` : ""}` : ev.lt ? esc(ev.lt) : '<span class="unk">Place not listed</span>'}${ev.r ? ` · ${esc(ev.r)}` : ""}</span></p>
${ev.d ? `<div class="prose">${paras(ev.d).map((p) => `<p>${esc(p)}</p>`).join("")}</div>` : '<p class="unk">Description not listed on the official agenda</p>'}
${ev.c ? `<p><b>Cost:</b> ${esc(ev.c)}</p>` : ""}
${people.length ? `<h3 class="sub-h">People</h3><ul class="evd-people">${people.map(([id, p]) => `<li><a href="${ROOT}people/${esc(id)}.html">${p.i ? `<span class="avatar m"><img src="${esc(ROOT + p.i)}" alt="" width="44" height="55" loading="lazy"></span>` : ""}<span><b>${esc(p.n)}</b>${p.t ? `<span>${esc(p.t)}</span>` : ""}</span></a></li>`).join("")}</ul>` : ""}
</div><div>${v && v.ll ? `<p><a class="btn btn-secondary btn-sm" href="https://www.google.com/maps/dir/?api=1&amp;destination=${v.ll[0]},${v.ll[1]}&amp;travelmode=walking" target="_blank" rel="noopener"><svg class="i" aria-hidden="true"><use href="#i-walk"/></svg>Walking directions<span class="sr-only"> (opens in a new tab)</span></a></p>` : '<p class="unk">Not on the map: the address is not listed</p>'}</div></div>
<p class="source-line"><svg class="i" aria-hidden="true"><use href="#i-info"/></svg><span>Source: <a href="${esc(ev.src)}" target="_blank" rel="noopener">${esc(new URL(ev.src).hostname.replace(/^www\./, ""))}<span class="sr-only"> (opens in a new tab)</span></a></span></p>
<div class="evd-actions"><button class="btn btn-river" type="button" data-evd-star aria-pressed="${inPlan}">${inPlan ? "In My Plan" : "Add to My Plan"}</button>${ev.u ? `<a class="btn btn-secondary" href="${esc(ev.u)}" target="_blank" rel="noopener">Register<span class="sr-only"> (opens in a new tab)</span></a>` : ""}<button class="btn btn-secondary" type="button" data-evd-share><svg class="i" aria-hidden="true"><use href="#i-share"/></svg>Share</button></div>`;
  updateStatus(t, bodyEl);
  const st = $(".evd-when", bodyEl)?.dataset.status;
  if (st) bodyEl.dataset.status = st;
}

const urlFor = (id) => { const u = new URL(location.href); if (id) u.searchParams.set("e", id); else u.searchParams.delete("e"); u.hash = ""; return u.pathname + u.search; };

export async function open(id, { trigger = null, push = true } = {}) {
  if (!modal) return;
  let data;
  try { data = await getJSON("events.json"); } catch { location.href = `${ROOT}schedule.html?e=${encodeURIComponent(id)}#e-${encodeURIComponent(id)}`; return; }
  const ev = data.events.find((x) => x.id === id);
  if (!ev) return;
  render(data, ev);
  openId = id;
  if (push) { history.pushState({ evd: id }, "", urlFor(id)); pushed = true; } else pushed = false;
  showModal(modal, { trigger, focus: "#evd-title", onClose: () => {
    const wasPushed = pushed; openId = null; pushed = false;
    if (wasPushed && history.state && history.state.evd === id) history.back();
    else if (new URL(location.href).searchParams.has("e")) history.replaceState(history.state, "", urlFor(null) + location.hash);
  } });
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
    if (e.target.closest("[data-evd-star]") && openId) {
      const on = toggle(openId, "e");
      const b = e.target.closest("[data-evd-star]");
      b.textContent = on ? "In My Plan" : "Add to My Plan"; b.setAttribute("aria-pressed", String(on));
    }
    if (e.target.closest("[data-evd-share]") && openId) share({ title: $("#evd-title", modal).textContent, url: new URL(`${ROOT}schedule.html?e=${openId}#e-${openId}`, location.href).href });
  });
  window.addEventListener("popstate", () => {
    const id = new URL(location.href).searchParams.get("e");
    if (!id && openId && current() === modal) { pushed = false; hideModal(); }
    else if (id && id !== openId) open(id, { push: false });
  });
  const id = new URL(location.href).searchParams.get("e");
  if (id) {
    const card = document.getElementById(`e-${id}`);
    if (card) { card.classList.add("is-hit"); card.scrollIntoView({ block: "center" }); }
    open(id, { push: false, trigger: card && card.querySelector("[data-open-event]") });
  }
  onTick((t) => { if (openId) updateStatus(t, bodyEl); }, { immediate: false });
  // engine §4.8: prefetch events.json when idle on pages that can open the dialog, so it opens at once
  if (document.querySelector("[data-open-event]")) idle(() => getJSON("events.json").catch(() => {}));
}
