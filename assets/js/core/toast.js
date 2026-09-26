/* ============================================================
   site/js/core/toast.js · OWNER: Agent A (core engine)
   The ink toast above the dock (role=status): "Added to My Plan · View",
   "Link copied". toast(text, { link: href|true, linkText, ms })
   ============================================================ */
import { $, ROOT } from "./dom.js";

let timer;
export function toast(text, { link = null, linkText = "View", ms = 3200 } = {}) {
  const el = $("[data-toast]");
  if (!el) return;
  const t = $("[data-toast-text]", el), a = $("[data-toast-link]", el);
  if (t) t.textContent = text;
  if (a) {
    a.hidden = !link;
    if (link) { a.textContent = linkText; a.setAttribute("href", link === true ? `${ROOT}plan.html` : link); }
  }
  el.classList.add("show");
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove("show"), ms);
}
