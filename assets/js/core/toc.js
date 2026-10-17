/* ============================================================
   site/js/core/toc.js · OWNER: Agent A (core engine)
   TOC rail scroll-spy (≥ 1280px): the last section heading that has
   scrolled under the topbar gets aria-current="true" (the river marker).
   Also the back-to-top button (after 700px; respects reduced motion).
   ============================================================ */
import { $, $$, motionOK } from "./dom.js";

export function initToc() {
  const links = $$(".toc a");
  if (links.length) {
    const byId = new Map(links.map((a) => [decodeURIComponent(a.getAttribute("href").slice(1)), a]));
    const heads = [...byId.keys()].map((id) => document.getElementById(id)).filter(Boolean);
    let ticking = false;
    const update = () => {
      ticking = false;
      let cur = null;
      for (const h of heads) { if (h.getBoundingClientRect().top <= 140) cur = h; else break; }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = heads[heads.length - 1] || cur;
      links.forEach((a) => { if (cur && a === byId.get(cur.id)) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
    };
    window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }
  $$(".toc-mobile a").forEach((a) => a.addEventListener("click", () => { const d = a.closest("details"); if (d) d.open = false; }));

  const top = $("[data-to-top]");
  if (top) {
    const onScroll = () => top.classList.toggle("show", window.scrollY > 700);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    top.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: motionOK() ? "smooth" : "auto" });
      const main = $("#main"); if (main) main.focus({ preventScroll: true });
    });
  }
}
