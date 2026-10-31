/* ============================================================
   site/js/core/search.js · OWNER: Agent A (core engine)
   The ⌘K palette (engine spec §4.9, DESIGN.md §9.11). The index
   (assets/data/search.json) is fetched on first open, and prefetched when
   idle on the schedule, people and art pages. Results are grouped (Events,
   People, Art, Venues, Programs and pages, …), up to 5 per group, with a
   "See all" row into the directory. The empty query shows Now and next and
   Tonight during the week, then the programs and pages.
   Keyboard + ARIA (QS): combobox input, listbox, aria-activedescendant,
   aria-selected, a live "n results" status, ⌘K / Ctrl+K toggles, "/" opens.
   ============================================================ */
import { $, $$, ROOT, PAGE, IS_MAC, esc, modified } from "./dom.js";
import { getJSON, idle } from "./data.js";
import { showModal, hideModal, current } from "./modal.js";
import { now, phase } from "./clock.js";
import { prepare, search, group, mark, SEE_ALL, norm } from "../lib/search.js";
import { status as statusOf, nyParts } from "../lib/time.js";

let modal, input, list, statusEl, items = null, failed = false, sel = -1;

function load() {
  return getJSON("search.json").then((d) => { items = prepare(d.items || []); }).catch(() => { failed = true; });
}

const lead = (h) => (h.i && h.k === "pe")
  ? `<span class="avatar s"><img src="${esc(ROOT + h.i)}" alt="" width="26" height="33" loading="lazy"></span>`
  : (h.i && h.k === "or") ? `<span class="sr-logo"><img src="${esc(ROOT + h.i)}" alt="" width="34" height="20" loading="lazy"></span>`
  : (h.p ? `<svg class="bullet" aria-hidden="true"><use href="#b-${esc(h.p)}"/></svg>`
    : `<svg class="i" aria-hidden="true"><use href="#i-${h.k === "pg" ? "info" : h.k === "fq" ? "help" : h.k === "nw" ? "news" : h.k === "st" ? "bed" : "pin"}"/></svg>`);

function hitHtml(h, q, n) {
  return `<a class="sr-hit" role="option" id="sr-hit-${n}" aria-selected="false" href="${esc(ROOT + h.u)}">${lead(h)}<span><span class="t">${mark(h.t, q, esc)}</span>${h.s ? `<span class="m">${esc(h.s)}</span>` : ""}</span><svg class="i" aria-hidden="true"><use href="#i-arrow-r"/></svg></a>`;
}

function render() {
  const q = input.value.trim();
  sel = -1;
  input.removeAttribute("aria-activedescendant");
  if (failed) { list.innerHTML = `<p class="sr-group">Search needs the site to be served over http(s). The sidebar reaches every page.</p>`; statusEl.textContent = ""; return; }
  if (!items) { list.innerHTML = `<p class="sr-group">Loading…</p>`; return; }
  let groups, n = 0, html = "";
  if (!q) {
    const t = now();
    // during the week (engine §4.9): Now and next (live, or starting within 2 h), then Tonight (today from 5 PM)
    const during = phase() === "during";
    const soon = during ? items.filter((x) => x.k === "ev" && x.st && x.en && (statusOf(x.st, x.en, t) === "live" || (x.st > t && x.st - t < 2 * 3600e3))).sort((a, b) => a.st - b.st).slice(0, 6) : [];
    const today = nyParts(t).date, shown = new Set(soon);
    const tonight = during ? items.filter((x) => x.k === "ev" && x.st > t && !shown.has(x) && nyParts(x.st).date === today && nyParts(x.st).minutes >= 17 * 60).sort((a, b) => a.st - b.st).slice(0, 5) : [];
    groups = [];
    if (soon.length) groups.push({ label: "Now and next", items: soon, total: soon.length });
    if (tonight.length) groups.push({ label: "Tonight", items: tonight, total: tonight.length });
    groups.push({ label: "Programs and pages", items: items.filter((x) => x.k === "pr" || x.k === "pg").slice(0, 12), total: 0 });
  } else {
    groups = group(search(items, q, { now: phase() === "during" ? now() : 0 }), 5);
  }
  for (const g of groups) {
    html += `<p class="sr-group label" role="presentation"><span>${esc(g.label)}</span>${g.total > g.items.length ? `<span class="tnum">${g.total}</span>` : ""}</p>`;
    for (const h of g.items) html += hitHtml(h, q, n++);
    if (q && g.total > g.items.length && SEE_ALL[g.label]) html += `<a class="sr-all" href="${esc(`${ROOT}${SEE_ALL[g.label]}?q=${encodeURIComponent(q)}`)}">See all ${g.total}<svg class="i" aria-hidden="true"><use href="#i-arrow-r"/></svg></a>`;
  }
  list.innerHTML = n ? html : `<p class="sr-group">No results for “${esc(q)}”. Try a program, a venue or a last name.</p>`;
  statusEl.textContent = q ? `${groups.reduce((a, g) => a + g.total, 0)} results` : "";
}

function move(d) {
  const hits = $$(".sr-hit", list);
  if (!hits.length) return;
  sel = sel < 0 ? (d > 0 ? 0 : hits.length - 1) : (sel + d + hits.length) % hits.length;
  hits.forEach((h, i) => h.setAttribute("aria-selected", String(i === sel)));
  hits[sel].scrollIntoView({ block: "nearest" });
  input.setAttribute("aria-activedescendant", hits[sel].id);
}

export function openSearch(trigger, q = "") {
  if (!modal) return;
  input.value = q;
  render();
  showModal(modal, { trigger, focus: input });
  if (!items && !failed) load().then(() => { if (current() === modal) render(); });
}

export function initSearch() {
  modal = $("#search"); input = $("[data-search-input]"); list = $("[data-search-results]"); statusEl = $("[data-search-status]");
  $$("[data-k-hint]").forEach((k) => { k.textContent = IS_MAC ? "⌘K" : "Ctrl K"; });
  if (!modal || !input) return;
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-search-open]"); if (b) { e.preventDefault(); openSearch(b); } });
  input.addEventListener("input", render);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Enter") { const hits = $$(".sr-hit", list); const h = hits[sel >= 0 ? sel : 0]; if (h) { e.preventDefault(); h.click(); } }
  });
  list.addEventListener("click", (e) => { const a = e.target.closest("a"); if (a && !modified(e)) hideModal(false); });
  const typing = (el) => el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key || "").toLowerCase() === "k") {
      e.preventDefault();
      if (current() === modal) hideModal(); else openSearch(null);
    } else if (e.key === "/" && !current() && !typing(document.activeElement)) {
      e.preventDefault(); openSearch(null);
    }
  });
  if (["schedule", "people", "art"].includes(PAGE)) idle(load);
}
export { norm };
