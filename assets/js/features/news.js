/* site/js/features/news.js · OWNER: Agent G (home, programs & info)
   news.html filters: program chips (?p=, comma-separated, kept in the URL) and a source menu (not in the URL).
   Every card is in the HTML; this only hides and shows them and keeps the count honest. */
export function init(app) {
  const tools = document.querySelector("[data-news-tools]");
  if (!tools) return;
  const cards = [...document.querySelectorAll(".news-card[data-p]")];
  const chips = [...tools.querySelectorAll("[data-news-p]")];
  const src = tools.querySelector("[data-news-src]");
  const count = tools.querySelector("[data-result-count]");
  const clear = tools.querySelector("[data-news-clear]");
  const empty = document.querySelector("[data-news-empty]");
  const valid = new Set(chips.map((b) => b.dataset.newsP));
  const url = new URL(location.href);
  let sel = new Set((url.searchParams.get("p") || "").split(",").filter((p) => valid.has(p)));

  function apply({ push = true } = {}) {
    const s = src ? src.value : "";
    let n = 0;
    for (const card of cards) {
      const ps = card.dataset.p.split(" ").filter(Boolean);
      const ok = (!sel.size || ps.some((p) => sel.has(p))) && (!s || card.dataset.src === s);
      card.hidden = !ok;
      if (ok) n++;
    }
    for (const sec of document.querySelectorAll("#news-now, #news-background")) sec.hidden = !sec.querySelector(".news-card:not([hidden])");
    chips.forEach((b) => b.setAttribute("aria-pressed", sel.has(b.dataset.newsP) ? "true" : "false"));
    if (count) count.innerHTML = `Showing <b>${n}</b> of ${cards.length} stories`;
    if (empty) empty.hidden = n > 0;
    if (clear) clear.hidden = !sel.size && !s;
    if (push) {
      const u = new URL(location.href);
      if (sel.size) u.searchParams.set("p", [...sel].sort().join(",")); else u.searchParams.delete("p");
      try { history.replaceState(history.state, "", u); } catch { /* file:// */ }
    }
  }
  chips.forEach((b) => b.addEventListener("click", () => { const p = b.dataset.newsP; if (sel.has(p)) sel.delete(p); else sel.add(p); apply(); }));
  if (src) src.addEventListener("change", () => apply());
  if (clear) clear.addEventListener("click", () => { sel = new Set(); if (src) src.value = ""; apply(); chips[0]?.focus(); });
  apply({ push: false });
}
