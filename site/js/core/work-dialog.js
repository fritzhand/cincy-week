/* ============================================================
   site/js/core/work-dialog.js · OWNER: Agent F (directory)
   Landed by Agent A as a working stub; Agent F owns it. Contract
   (engine spec §4.8): open(id, { trigger, push }) renders a work from
   assets/data/works.json into #work-dialog and sets ?w=<id> (Back closes);
   a click on [data-open-work] opens it; ?w= on load opens it.
   Still to come from Agent F: the photo, mini-map, star, share.
   ============================================================ */
import { $, ROOT, esc, modified } from "./dom.js";
import { getJSON } from "./data.js";
import { showModal, hideModal, current } from "./modal.js";
import { paras } from "../lib/text.js";
import { refreshStars } from "./plan-store.js";

let modal, bodyEl, kickerEl, openId = null, pushed = false;
const urlFor = (id) => { const u = new URL(location.href); if (id) u.searchParams.set("w", id); else u.searchParams.delete("w"); u.hash = ""; return u.pathname + u.search; };

export async function open(id, { trigger = null, push = true } = {}) {
  if (!modal) return;
  let data;
  try { data = await getJSON("works.json"); } catch { return; }
  const w = data.works.find((x) => x.id === id);
  if (!w) return;
  kickerEl.innerHTML = `<span class="prog-badge" data-prog="${esc(w.p)}"><svg class="bullet" aria-hidden="true"><use href="#b-${esc(w.p)}"/></svg>${esc(w.m)}</span>`;
  const by = w.a.map((a) => data.people[a]?.n).filter(Boolean).join(", ") || w.at || "";
  bodyEl.innerHTML = `<h2 id="wd-title" tabindex="-1">${esc(w.t)}</h2>${by ? `<p class="lede">${w.a.length ? w.a.map((a) => `<a href="${ROOT}people/${esc(a)}.html">${esc(data.people[a]?.n || a)}</a>`).join(", ") : esc(by)}</p>` : ""}
${w.z ? `<p class="ev-where"><svg class="i" aria-hidden="true"><use href="#i-pin"/></svg><span>${esc(w.z)}</span></p>` : ""}
${w.d ? `<div class="prose">${paras(w.d).map((p) => `<p>${esc(p)}</p>`).join("")}</div>` : '<p class="unk">Description not published</p>'}
<p class="source-line"><svg class="i" aria-hidden="true"><use href="#i-info"/></svg><span>Source: <a href="${esc(w.src)}" target="_blank" rel="noopener">${esc(new URL(w.src).hostname.replace(/^www\./, ""))}<span class="sr-only"> (opens in a new tab)</span></a></span></p>
<div class="evd-actions"><button class="btn btn-river" type="button" data-star="${esc(w.id)}" data-star-kind="w" aria-pressed="false" aria-label="Add “${esc(w.t)}” to My Plan">Star this work</button></div>`;
  refreshStars();
  openId = id;
  if (push) { history.pushState({ wd: id }, "", urlFor(id)); pushed = true; } else pushed = false;
  showModal(modal, { trigger, focus: "#wd-title", onClose: () => {
    const was = pushed; openId = null; pushed = false;
    if (was && history.state && history.state.wd === id) history.back();
    else if (new URL(location.href).searchParams.has("w")) history.replaceState(history.state, "", urlFor(null));
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
  window.addEventListener("popstate", () => {
    const id = new URL(location.href).searchParams.get("w");
    if (!id && openId && current() === modal) { pushed = false; hideModal(); }
    else if (id && id !== openId) open(id, { push: false });
  });
  const id = new URL(location.href).searchParams.get("w");
  if (id) open(id, { push: false });
}
