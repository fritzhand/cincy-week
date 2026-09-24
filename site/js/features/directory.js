/* ============================================================
   site/js/features/directory.js · OWNER: Agent F (directory) · minimal working version
   landed by Agent A's review so the stub toolbars are never dead controls and search's
   "See all n →" deep links (people.html?q=…, art.html?q=…) land on a filtered list.
   Agent F replaces it with the full engine (engine spec §4.8: chip groups
   [data-filter=key], A–Z, active chips, empty state, URL sync for every key).

   Contract it already honours (server-rendered, works without JS):
     [data-dir]                 a list root; its children with data-q are the items
     input[data-filter-q]       the search field (terms AND-match item data-q, accent-folded)
     select[data-filter="key"]  the item's data-<key> (space-separated) must contain the value
     [data-result-count]        "Showing <b>n</b> of N <noun>" (role=status, aria-live=polite)
   URL: ?q= and each select's key, written with history.replaceState (only non-empty values).
   ============================================================ */
import { norm } from "../lib/search.js";

export function init() {
  const roots = [...document.querySelectorAll("[data-dir]")];
  if (!roots.length) return;
  const input = document.querySelector("input[data-filter-q]");
  const selects = [...document.querySelectorAll("select[data-filter]")];
  const count = document.querySelector("[data-result-count]");
  const items = roots.flatMap((r) => [...r.children].filter((el) => el.dataset.q !== undefined));
  const total = items.length, noun = count ? count.dataset.noun || "" : "";

  // read the URL (validated: select values must be existing options)
  const params = new URLSearchParams(location.search);
  if (input && params.get("q")) input.value = params.get("q").slice(0, 100);
  for (const s of selects) { const v = params.get(s.dataset.filter); if (v && [...s.options].some((o) => o.value === v)) s.value = v; }

  let empty = null;
  function apply(write) {
    const terms = norm(input ? input.value : "").split(/\s+/).filter(Boolean);
    let n = 0;
    for (const el of items) {
      const hay = el.dataset.q || "";
      let ok = terms.every((t) => hay.includes(t));
      for (const s of selects) if (ok && s.value) ok = (el.dataset[s.dataset.filter] || "").split(/\s+/).includes(s.value);
      el.hidden = !ok;
      if (ok) n++;
    }
    if (count) count.innerHTML = `Showing <b>${n}</b> of ${total}${noun ? ` ${noun}` : ""}`;
    if (!n && !empty) {
      empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = `<h3>No matches</h3><p>Try a shorter search or another filter.</p><button class="btn btn-secondary" type="button">Clear filters</button>`;
      empty.querySelector("button").addEventListener("click", () => { if (input) input.value = ""; selects.forEach((s) => { s.value = ""; }); apply(true); if (input) input.focus(); });
      roots[roots.length - 1].after(empty);
    }
    if (empty) empty.hidden = n > 0;
    if (write) {
      const u = new URL(location.href);
      const q = input ? input.value.trim() : "";
      if (q) u.searchParams.set("q", q); else u.searchParams.delete("q");
      for (const s of selects) { if (s.value) u.searchParams.set(s.dataset.filter, s.value); else u.searchParams.delete(s.dataset.filter); }
      try { history.replaceState(history.state, "", u.pathname + u.search + u.hash); } catch { /* file:// */ }
    }
  }
  let t = 0;
  if (input) input.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => apply(true), 150); });
  selects.forEach((s) => s.addEventListener("change", () => apply(true)));
  apply(false);
}
