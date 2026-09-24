/* ============================================================
   site/js/core/work-dialog.js · OWNER: Agent F (directory: people, art, partners)
   (under core/ because every page hosts #work-dialog; engine spec §4.8, DESIGN.md §9.11)
     open(id, { trigger, push })  fetch assets/data/works.json + art-extra.json once, render the work
                                  into #work-dialog, set ?w=<id> with pushState (Back closes it) and
                                  focus the title
     initWorkDialog()             a click on [data-open-work] opens it (modifier clicks keep the link);
                                  ?w= on load opens it; popstate syncs; idle prefetch on pages with works
   The dialog: program, medium, title, the image (never filtered; its credit) or "Photo coming",
   artists (mugs → person pages), where (zone, venue page with its stall number, location), hours when
   listed, the verbatim description (labeled when the organizers publish the artist's biography in its
   place), sponsor (→ partners wall), a mini-map with walking directions and "On the map", the source,
   and actions: Add to My Plan, Share. Unknowns are printed as unknowns.
   ============================================================ */
import { $, ROOT, esc, modified } from "./dom.js";
import { getJSON, idle } from "./data.js";
import { showModal, hideModal, current } from "./modal.js";
import { has, toggle, subscribe } from "./plan-store.js";
import { share } from "./share.js";
import { toast } from "./toast.js";
import { paras, initials, hostOf } from "../lib/text.js";

let modal, bodyEl, kickerEl, openId = null, pushed = false;
const I = (n, cls = "") => `<svg class="i${cls ? " " + cls : ""}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const ext = (href, html, cls = "") => `<a${cls ? ` class="${cls}"` : ""} href="${esc(href)}" target="_blank" rel="noopener">${html}<span class="sr-only"> (opens in a new tab)</span></a>`;
const GLYPH = { "projection mapping": "projector", mural: "brush", painting: "brush", "light installation": "light", "drone show": "light", photography: "projector" };
const medium = (m) => (m === "other" ? "Artwork" : m.charAt(0).toUpperCase() + m.slice(1));
const listJoin = (a) => (a.length < 3 ? a.join(" and ") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);

function render(data, x, w) {
  const prog = (x.programs && x.programs[w.p]) || { n: w.p };
  kickerEl.innerHTML = `<span class="prog-badge" data-prog="${esc(w.p)}"><svg class="bullet" aria-hidden="true"><use href="#b-${esc(w.p)}"/></svg>${esc(prog.n)}</span>`;
  const e = (x.works && x.works[w.id]) || {};
  const im = e.im;
  const media = im
    ? `<figure class="wd-media"><img src="${esc(ROOT + im[0][0])}"${im[1] ? ` srcset="${esc(ROOT + im[0][0])} ${im[0][1]}w, ${esc(ROOT + im[1][0])} ${im[1][1]}w" sizes="(min-width: 760px) 700px, 100vw"` : ""} width="${im[0][1]}" height="${im[0][2]}" alt="" decoding="async"><figcaption class="credit label">${e.cr ? `Photo via ${esc(e.cr)}` : ""}</figcaption></figure>`
    : `<div class="wd-media photo halftone" data-prog="${esc(w.p)}"><span class="photo-missing">${I(GLYPH[w.m] || "brush")}<span class="label">No photo yet</span></span></div>`;
  const people = w.a.map((id) => [id, data.people[id], x.people && x.people[id]]).filter(([, p]) => p);
  const mug = (id, p, px) => (px && px.i
    ? `<span class="avatar m" data-prog="${esc(w.p)}"><img src="${esc(ROOT + px.i)}" alt="" width="96" height="96" loading="lazy" decoding="async"></span>`
    : `<span class="avatar m mono halftone" data-prog="${esc(w.p)}"><span aria-hidden="true">${esc(initials(p.n))}</span></span>`);
  const v = w.v && x.venues ? x.venues[w.v] : null;
  const whereBits = [
    w.z && !(v && v.n.toLowerCase() === w.z.toLowerCase()) ? esc(w.z) : "",
    v ? `${v.st ? `<span class="wd-stall" aria-hidden="true">${esc(v.st)}</span>` : ""}<a href="${ROOT}venues/${esc(w.v)}.html">${esc(v.n)}</a>` : "",
    w.lt && (!v || w.lt !== v.n) ? esc(w.lt) : "",
  ].filter(Boolean);
  const where = whereBits.length ? whereBits.join(" · ") : '<span class="unk">Location not listed</span>';
  // QA: a work without its own spot shows its zone's map (art-extra `zv`), labeled as the zone, never as the spot
  const zone = !w.ll && e.zv && e.mm;
  const side = w.ll || zone
    ? `${e.mm ? e.mm.replace(/\{R\}/g, ROOT) : ""}${zone ? `<p class="faint wd-zone-note">The map shows ${esc(v ? v.n : "its zone")}; the exact spot is not published.</p>` : ""}<p class="evd-dir">${e.d ? `${ext(e.d.apple, `${I("walk")}Apple Maps`, "btn btn-secondary btn-sm")}${ext(e.d.google, `${I("walk")}Google Maps`, "btn btn-secondary btn-sm")}` : ""}<a class="btn btn-secondary btn-sm" href="${ROOT}map.html?focus=${zone ? `venue:${encodeURIComponent(e.zv)}` : `work:${encodeURIComponent(w.id)}`}">${I("map")}On the map</a></p>`
    : '<p class="unk">Not on the map: the address is not listed</p>';
  const text = w.d
    ? `${e.ab ? '<h3 class="sub-h">About the artist, as published for this work</h3>' : ""}<div class="prose evd-desc">${paras(w.d).map((p) => `<p>${esc(p)}</p>`).join("")}</div>`
    : '<p class="unk evd-desc">Description not published by the organizers</p>';
  const facts = [
    w.ht ? ["Hours", esc(w.ht)] : null,
    w.sp ? ["Sponsor", e.so ? `<a href="${ROOT}partners.html#o-${esc(e.so)}">${esc(w.sp)}</a>` : esc(w.sp)] : null,
    w.c && w.c.toLowerCase() !== `${w.m}s` ? ["Listed under", esc(w.c)] : null,
  ].filter(Boolean);
  const inPlan = has(w.id);
  bodyEl.dataset.wd = w.id;
  bodyEl.innerHTML = `${media}
<p class="evd-kind label">${I(GLYPH[w.m] || "brush")}${esc(medium(w.m))}</p>
<h2 id="wd-title" tabindex="-1">${esc(w.t)}</h2>
${people.length ? `<p class="wd-by">${esc(listJoin(people.map(([, p]) => p.n)))}</p>` : w.at ? `<p class="wd-by">${esc(w.at)}</p>` : '<p class="wd-by unk">Artist not listed</p>'}
<div class="evd-grid"><div class="evd-main">
<p class="ev-where evd-where">${I("pin")}<span>${where}</span></p>
${text}
${people.length ? `<h3 class="sub-h">${people.length === 1 ? "Artist" : "Artists"}</h3><ul class="evd-people">${people.map(([id, p, px]) => `<li><a href="${ROOT}people/${esc(id)}.html">${mug(id, p, px)}<span><b>${esc(p.n)}</b>${px && px.t ? `<span>${esc(px.t)}</span>` : ""}</span></a></li>`).join("")}</ul>` : ""}
${facts.length ? `<dl class="facts evd-facts">${facts.map(([k, val]) => `<div class="fact"><dt>${k}</dt><dd>${val}</dd></div>`).join("")}</dl>` : ""}
</div><div class="evd-side">${side}</div></div>
<p class="source-line">${I("info")}<span>Source: ${ext(w.src, esc(hostOf(w.src) || w.src))}</span></p>
<div class="evd-actions"><button class="btn btn-river" type="button" data-wd-star aria-pressed="${inPlan}">${I("star", inPlan ? "i-fill" : "")}<span>${inPlan ? "In My Plan" : "Add to My Plan"}</span></button><button class="btn btn-secondary" type="button" data-wd-share>${I("share")}Share</button></div>`;
}

function syncStar() {
  const b = bodyEl && $("[data-wd-star]", bodyEl);
  if (!b || !openId) return;
  const on = has(openId);
  b.setAttribute("aria-pressed", String(on));
  b.innerHTML = `${I("star", on ? "i-fill" : "")}<span>${on ? "In My Plan" : "Add to My Plan"}</span>`;
}

const urlFor = (id) => { const u = new URL(location.href); if (id) u.searchParams.set("w", id); else u.searchParams.delete("w"); u.hash = ""; return u.pathname + u.search; };
const deepLink = (id) => new URL(`${ROOT}art.html?w=${encodeURIComponent(id)}`, location.href).href;

export async function open(id, { trigger = null, push = true } = {}) {
  if (!modal) return;
  let data, extra;
  try { [data, extra] = await Promise.all([getJSON("works.json"), getJSON("art-extra.json").catch(() => ({}))]); }
  catch {
    // offline or file://: fall back to the card (art.html) the link points at
    if (trigger && trigger.getAttribute("href")) location.href = trigger.href;
    return;
  }
  const w = data.works.find((x) => x.id === id);
  if (!w) return;
  render(data, extra || {}, w);
  openId = id;
  if (push) { history.pushState({ wd: id }, "", urlFor(id)); pushed = true; } else pushed = false;
  showModal(modal, { trigger, focus: "#wd-title", onClose: () => {
    const was = pushed; openId = null; pushed = false;
    if (trigger && document.contains(trigger)) requestAnimationFrame(() => { const r = trigger.getBoundingClientRect(); if (r.top < 120 || r.bottom > innerHeight - 70) trigger.scrollIntoView({ block: "center" }); });
    if (was && history.state && history.state.wd === id) history.back();
    else if (new URL(location.href).searchParams.has("w")) history.replaceState(history.state, "", urlFor(null) + location.hash);
  } });
}

export function initWorkDialog() {
  modal = $("#work-dialog"); if (!modal) return;
  bodyEl = $("[data-wd-body]", modal); kickerEl = $("[data-wd-kicker]", modal);
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-open-work]");
    if (!a || modified(e)) return;
    e.preventDefault();
    open(a.dataset.openWork, { trigger: a });
  });
  modal.addEventListener("click", (e) => {
    if (!openId) return;
    if (e.target.closest("[data-wd-star]")) { const on = toggle(openId, "w"); syncStar(); toast(on ? "Added to My Plan" : "Removed from My Plan", { link: on ? true : null }); }
    if (e.target.closest("[data-wd-share]")) share({ title: $("#wd-title", modal).textContent, url: deepLink(openId) });
  });
  subscribe(syncStar);
  window.addEventListener("popstate", () => {
    const id = new URL(location.href).searchParams.get("w");
    if (!id && openId && current() === modal) { pushed = false; hideModal(); }
    else if (id && id !== openId) open(id, { push: false });
  });
  const id = new URL(location.href).searchParams.get("w");
  if (id) {
    const card = document.getElementById(`w-${id}`);
    open(id, { push: false, trigger: card && card.querySelector("[data-open-work]") });
  }
  if (document.querySelector("[data-open-work]")) idle(() => { getJSON("works.json").catch(() => {}); getJSON("art-extra.json").catch(() => {}); });
}
