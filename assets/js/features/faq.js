/* ============================================================
   site/js/features/faq.js · OWNER: Agent G (home, programs & info)
   faq.html: filter by program chips (?p=, comma-separated) and a search box (?q=), both kept
   in the URL with replaceState; a live count; matching answers open while you search (up to 12);
   a #<faq id> in the URL opens that question and scrolls to it. Every question is in the HTML.
   ============================================================ */
import { norm } from "../lib/search.js";

export function init() {
  const tools = document.querySelector("[data-faq-tools]");
  const items = [...document.querySelectorAll("details.faq[data-q]")];
  openTarget();
  window.addEventListener("hashchange", openTarget);
  if (!tools || !items.length) return;
  const input = tools.querySelector("[data-faq-q]");
  const chips = [...tools.querySelectorAll("[data-faq-p]")];
  const count = tools.querySelector("[data-result-count]");
  const clear = tools.querySelector("[data-faq-clear]");
  const empty = document.querySelector("[data-faq-empty]");
  const valid = new Set(chips.map((b) => b.dataset.faqP));
  const url = new URL(location.href);
  let sel = new Set((url.searchParams.get("p") || "").split(",").filter((p) => valid.has(p)));
  if (input) input.value = (url.searchParams.get("q") || "").slice(0, 80);
  let opened = new Set();

  function apply() {
    const terms = norm(input ? input.value : "").split(/\s+/).filter(Boolean);
    let n = 0;
    const hits = [];
    for (const d of items) {
      const ok = (!sel.size || sel.has(d.dataset.p)) && terms.every((t) => d.dataset.q.includes(t));
      d.hidden = !ok;
      if (ok) { n++; hits.push(d); }
    }
    // open what the search found (a handful), close what we opened before
    for (const d of opened) if (!hits.includes(d) || !terms.length) d.open = false;
    opened = new Set();
    if (terms.length && hits.length <= 12) for (const d of hits) if (!d.open) { d.open = true; opened.add(d); }
    for (const list of document.querySelectorAll("[data-faq-list]")) {
      list.hidden = !list.querySelector("details.faq:not([hidden])");
      const h = list.previousElementSibling;
      if (h && h.classList.contains("faq-topic")) h.hidden = list.hidden;
    }
    for (const g of document.querySelectorAll("[data-faq-group]")) g.hidden = !g.querySelector("details.faq:not([hidden])");
    chips.forEach((b) => b.setAttribute("aria-pressed", sel.has(b.dataset.faqP) ? "true" : "false"));
    if (count) count.innerHTML = `Showing <b>${n}</b> of ${items.length} questions`;
    if (empty) empty.hidden = n > 0;
    if (clear) clear.hidden = !sel.size && !terms.length;
    const u = new URL(location.href);
    if (sel.size) u.searchParams.set("p", [...sel].sort().join(",")); else u.searchParams.delete("p");
    if (input && input.value.trim()) u.searchParams.set("q", input.value.trim()); else u.searchParams.delete("q");
    try { history.replaceState(history.state, "", u); } catch { /* file:// */ }
  }
  chips.forEach((b) => b.addEventListener("click", () => { const p = b.dataset.faqP; if (sel.has(p)) sel.delete(p); else sel.add(p); apply(); }));
  let t = 0;
  if (input) input.addEventListener("input", () => { clearTimeout(t); t = setTimeout(apply, 120); });
  if (clear) clear.addEventListener("click", () => { sel = new Set(); if (input) input.value = ""; apply(); (input || chips[0])?.focus(); });
  if (sel.size || (input && input.value)) apply();
}

function openTarget() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) return;
  const d = document.getElementById(id);
  if (d && d.matches("details.faq")) {
    d.hidden = false;
    d.open = true;
    d.scrollIntoView({ block: "start" });
  }
}
