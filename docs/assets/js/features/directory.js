/* ============================================================
   site/js/features/directory.js · OWNER: Agent F (directory: people, art, partners)
   The filter engine for server-rendered lists (engine spec §4.8). Every item is already in the
   HTML, so a reader without JS sees the full list; this only hides and shows items, keeps the
   URL in sync (history.replaceState, only non-default values) and says how many match.
   Used by people.html, art.html and partners.html; any page may use it (venues, eat-drink, faq).

   Markup it reads (build/pages/_directory.mjs writes it):
     [data-dir]                    lists; their children with data-q are the items (a list whose
                                   children have no data-q uses every child, matched on its text)
     [data-dir-group]              sections and tiers: hidden when none of their items is visible;
                                   a [data-dir-count data-one data-many] inside shows its visible count
     input[data-filter-q]          search: every term must appear in the item's data-q + its text
     [data-filter-group="key"]     chips: button[data-value][aria-pressed]; values in a group OR, groups
                                   AND; the item's data-<key> lists its values (split on spaces, or on
                                   the group's data-sep); data-single = one value; [hidden] = URL-only
     nav[data-az]                  A–Z, a[data-value] (key data-key, default "l"): one letter at a time
     select[data-filter="key"]     the first version's selects (still honored)
     [data-result-count]           "Showing <b>n</b> of N <noun>" (role=status, polite)
     [data-active-chips]           a removable chip per active filter, then "Clear all"
     [data-dir-empty]              shown when nothing matches; [data-dir-clear] clears everything
     [data-dir-views] button[data-view] + [data-dir-map]   Grid/Map (?view=map): the map shows the
                                   visible items that carry data-ll="lat,lng" (features/map.js mountMap)
   URL keys: q, every group key (comma-separated), the A–Z key, every select key, view.
   Pure matching lives in lib/directory.js (unit-tested in tests/directory.test.mjs).
   ============================================================ */
import { norm } from "../lib/search.js";
import { splitVals, matchItem, facetCounts, parseState, writeState } from "../lib/directory.js";

const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const I = (n) => `<svg class="i" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function init(app) {
  const roots = $$("[data-dir]");
  if (!roots.length) return;
  const itemEls = roots.flatMap((r) => { const k = [...r.children]; const q = k.filter((el) => el.dataset.q !== undefined); return q.length ? q : k; });
  const input = document.querySelector("input[data-filter-q]");
  const count = document.querySelector("[data-result-count]");
  const activeEl = document.querySelector("[data-active-chips]");
  const emptyEl = document.querySelector("[data-dir-empty]");
  const groupEls = $$("[data-dir-group]");
  let groups = [];
  const noun = count ? count.dataset.noun || "" : "";

  // filter definitions: chip groups, the A–Z index and selects share one shape
  const filters = [];
  for (const el of $$("[data-filter-group]")) {
    const chips = $$("button[data-value]", el);
    filters.push({ key: el.dataset.filterGroup, sep: el.dataset.sep || "", single: el.hasAttribute("data-single"), el, chips, kind: "chips",
      label: (el.querySelector(".dir-glabel") || {}).textContent || el.dataset.filterGroup,
      names: new Map(chips.map((b) => [b.dataset.value, (b.querySelector("span:not(.n):not(.sr-only)") || b).textContent.trim()])) });
  }
  const az = document.querySelector("nav[data-az]");
  if (az) {
    const chips = $$("a[data-value]", az);
    filters.push({ key: az.dataset.key || "l", sep: "", single: true, el: az, chips, kind: "az", label: "Letter", names: new Map(chips.map((a) => [a.dataset.value, a.dataset.value === "#" ? "Numbers and symbols" : a.dataset.value])) });
  }
  for (const s of $$("select[data-filter]")) {
    filters.push({ key: s.dataset.filter, sep: "", single: true, el: s, chips: [], kind: "select", label: (s.options[0] && s.options[0].textContent.replace(/: all$/, "")) || s.dataset.filter,
      names: new Map([...s.options].filter((o) => o.value).map((o) => [o.value, o.textContent])) });
  }
  const keys = filters.map((f) => f.key);

  // items: precomputed haystack and value sets
  const items = itemEls.map((el) => ({
    el,
    hay: norm(`${el.dataset.q || ""} ${el.textContent || ""}`),
    vals: Object.fromEntries(filters.map((f) => [f.key, splitVals(el.getAttribute(`data-${f.key}`), f.sep)])),
    ll: el.dataset.ll ? el.dataset.ll.split(",").map(Number) : null,
  }));

  groups = groupEls.map((el) => ({ el, items: items.filter((it) => el.contains(it.el)), count: (() => { const c = el.querySelector("[data-dir-count]"); return c && c.dataset.one ? c : null; })() }));

  // state from the URL, checked against the values the page offers
  const allowed = Object.fromEntries(filters.map((f) => [f.key, new Set(f.names.keys())]));
  let state = parseState(location.search, { keys, allowed, single: new Set(filters.filter((f) => f.single).map((f) => f.key)) });
  if (input) input.value = state.q;

  // views (Grid/Map), when the page offers them
  const views = document.querySelector("[data-dir-views]");
  const mapBox = document.querySelector("[data-dir-map]");
  let view = views && new URLSearchParams(location.search).get("view") === "map" && mapBox ? "map" : "grid";
  let map = null;

  function apply(write) {
    const terms = norm(state.q).split(/\s+/).filter(Boolean);
    const spec = { terms, sel: state.sel, keys };
    let n = 0;
    for (const it of items) { const ok = matchItem(it, spec); it.el.hidden = !ok; if (ok) n++; }
    // chip state and facet counts (each group counted under every other active filter)
    const counts = facetCounts(items, spec);
    for (const f of filters) {
      const on = state.sel[f.key] || new Set();
      if (f.kind === "select") { f.el.value = [...on][0] || ""; continue; }
      for (const ch of f.chips) {
        const v = ch.dataset.value, k = (counts[f.key] && counts[f.key].get(v)) || 0;
        if (f.kind === "az") {
          if (on.has(v)) ch.setAttribute("aria-current", "true"); else ch.removeAttribute("aria-current");
          if (!ch.hasAttribute("href")) continue;                 // no name under this letter at all
          if (k || on.has(v)) ch.removeAttribute("aria-disabled"); else ch.setAttribute("aria-disabled", "true");
          ch.setAttribute("aria-label", `${f.names.get(v)}: ${k} ${k === 1 ? "match" : "matches"}${on.has(v) ? ", selected" : ""}`);
        } else {
          ch.setAttribute("aria-pressed", on.has(v) ? "true" : "false");
          const nEl = ch.querySelector(".n");
          if (nEl) nEl.textContent = String(k);
          ch.classList.toggle("is-zero", !k && !on.has(v));
        }
      }
    }
    for (const g of groups) {
      const m = g.items.filter((it) => !it.el.hidden).length;
      g.el.hidden = !m;
      if (g.count) g.count.textContent = `${m} ${m === 1 ? g.count.dataset.one : g.count.dataset.many}`;
    }
    if (count) count.innerHTML = `Showing <b>${n}</b> of ${items.length}${noun ? ` ${escHtml(noun)}` : ""}`;
    if (emptyEl) emptyEl.hidden = n > 0;
    renderActive();
    if (map) map.update(pins());
    if (write) writeUrl();
  }

  function writeUrl() {
    const u = new URL(location.href);
    writeState(u.searchParams, state, keys);
    if (views) { if (view === "map") u.searchParams.set("view", "map"); else u.searchParams.delete("view"); }
    try { history.replaceState(history.state, "", u.pathname + u.search + u.hash); } catch { /* file:// or sandboxed */ }
  }

  function renderActive() {
    if (!activeEl) return;
    const chips = [];
    if (state.q.trim()) chips.push({ key: "q", v: "", text: `“${state.q.trim()}”`, label: `search “${state.q.trim()}”` });
    for (const f of filters) for (const v of state.sel[f.key] || []) chips.push({ key: f.key, v, text: `${f.names.get(v) || v}`, label: `${f.label}: ${f.names.get(v) || v}` });
    activeEl.hidden = !chips.length;
    activeEl.innerHTML = chips.length
      ? `<span class="label faint">Filters</span>${chips.map((c) => `<button class="chip chip-x" type="button" data-rm-key="${escHtml(c.key)}" data-rm-v="${escHtml(c.v)}" aria-label="Remove filter ${escHtml(c.label)}"><span>${escHtml(c.text)}</span>${I("x").replace('class="i"', 'class="i x"')}</button>`).join("")}<button class="btn btn-ghost btn-sm" type="button" data-dir-clear>Clear all</button>`
      : "";
  }

  function set(key, v, on) {
    const f = filters.find((x) => x.key === key);
    const cur = new Set(state.sel[key] || []);
    if (f && f.single) cur.clear();
    if (on) cur.add(v); else cur.delete(v);
    state = { ...state, sel: { ...state.sel, [key]: cur } };
  }
  function clearAll() {
    state = { q: "", sel: {} };
    if (input) input.value = "";
    apply(true);
  }

  // events
  let t = 0;
  if (input) {
    input.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { state = { ...state, q: input.value.slice(0, 100) }; apply(true); }, 150); });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); clearTimeout(t); state = { ...state, q: input.value.slice(0, 100) }; apply(true); } });
  }
  for (const f of filters) {
    if (f.kind === "select") { f.el.addEventListener("change", () => { set(f.key, f.el.value, !!f.el.value); if (!f.el.value) state.sel[f.key] = new Set(); apply(true); }); continue; }
    f.el.addEventListener("click", (e) => {
      const ch = e.target.closest("[data-value]");
      if (!ch || !f.el.contains(ch)) return;
      if (f.kind === "az") {
        e.preventDefault();
        if (ch.getAttribute("aria-disabled") === "true") return;
        const was = (state.sel[f.key] || new Set()).has(ch.dataset.value);
        set(f.key, ch.dataset.value, !was);
        apply(true);
        if (count && count.getBoundingClientRect().top < 0) count.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        return;
      }
      const was = ch.getAttribute("aria-pressed") === "true";
      set(f.key, ch.dataset.value, !was);
      apply(true);
    });
  }
  document.addEventListener("click", (e) => {
    const rm = e.target.closest("[data-rm-key]");
    if (rm) {
      const idx = $$("[data-rm-key]", activeEl).indexOf(rm);
      if (rm.dataset.rmKey === "q") { state = { ...state, q: "" }; if (input) input.value = ""; }
      else set(rm.dataset.rmKey, rm.dataset.rmV, false);
      apply(true);
      const rest = $$("[data-rm-key]", activeEl);
      (rest[Math.min(idx, rest.length - 1)] || input || document.body).focus?.();
      return;
    }
    if (e.target.closest("[data-dir-clear]")) { clearAll(); if (input) input.focus(); }
  });

  // Grid/Map
  function pins() {
    return items.filter((it) => !it.el.hidden && it.ll).map((it) => ({
      id: (it.el.id || "").replace(/^w-/, ""), kind: "work", lat: it.ll[0], lng: it.ll[1], prog: it.el.dataset.p || it.el.dataset.prog,
      label: ((it.el.querySelector("h2,h3,h4,.per-name") || {}).textContent || "").trim(),
      mn: ((it.el.querySelector(".mapno") || {}).textContent || "").trim(),   // "BLINK map No. 29": read out with the pin, shown on its card
    }));
  }
  async function setView(v, write) {
    view = v;
    if (views) for (const b of $$("button[data-view]", views)) b.setAttribute("aria-pressed", b.dataset.view === v ? "true" : "false");
    if (!mapBox) return;
    mapBox.hidden = v !== "map";
    if (v === "map" && !map) {
      try {
        const m = await import("./map.js");
        map = m.mountMap(mapBox, { pins: pins(), fit: true, onSelect: (id) => app.openWork(id) });
      } catch { mapBox.hidden = true; }
    }
    if (write) writeUrl();
  }
  if (views) views.addEventListener("click", (e) => { const b = e.target.closest("button[data-view]"); if (b) setView(b.dataset.view, true); });

  apply(false);
  if (view === "map") setView("map", false);
}
