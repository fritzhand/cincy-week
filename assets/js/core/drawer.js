/* ============================================================
   site/js/core/drawer.js · OWNER: Agent A (core engine)
   One button, two jobs (SIG): at ≥ 1024px the nav toggle collapses the
   desktop rail (remembered in cw-rail); below that it opens the sidebar
   as a drawer. QS upgrades: scroll lock without a jump, inert main /
   footer / dock, focus moves into the drawer and loops between the toggle
   and the drawer links, Esc / scrim / a link closes it, focus returns to
   the toggle, and it closes itself when the window grows past 1024px.
   ============================================================ */
import { $, $$, html, focusables } from "./dom.js";
import { raw } from "./store.js";

const body = document.body;
let toggle, sidebar, scrim, desktop;
const isOpen = () => body.classList.contains("nav-open");
const background = () => [$("#main"), $(".footer"), $(".dock")].filter(Boolean);

function sync() {
  if (!toggle) return;
  if (desktop.matches) {
    const collapsed = html.classList.contains("rail-collapsed");
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute("aria-label", collapsed ? "Show navigation" : "Collapse navigation");
  } else {
    toggle.setAttribute("aria-expanded", String(isOpen()));
    toggle.setAttribute("aria-label", isOpen() ? "Close navigation" : "Open navigation");
  }
}

export function openDrawer() {
  if (isOpen() || desktop.matches) return;
  const y = window.scrollY || 0;
  body.dataset.lockY = String(y);
  body.style.top = `-${y}px`;
  body.classList.add("nav-open");
  background().forEach((el) => { el.inert = true; });
  sync();
  const cur = $('.nav-link[aria-current="page"]', sidebar) || focusables(sidebar)[0];
  if (cur) setTimeout(() => cur.focus({ preventScroll: false }), 40);
}

export function closeDrawer(returnFocus = true) {
  if (!isOpen()) return;
  body.classList.remove("nav-open");
  const y = parseInt(body.dataset.lockY || "0", 10);
  body.style.top = "";
  background().forEach((el) => { el.inert = false; });
  // restore instantly, then again next frame to win over scroll anchoring (SIG)
  window.scrollTo({ top: y, left: 0, behavior: "instant" });
  requestAnimationFrame(() => window.scrollTo({ top: y, left: 0, behavior: "instant" }));
  sync();
  if (returnFocus && toggle) toggle.focus({ preventScroll: true });
}

export function initDrawer() {
  toggle = $("[data-nav-toggle]"); sidebar = $("#sidebar"); scrim = $("[data-scrim]");
  desktop = window.matchMedia ? matchMedia("(min-width: 1024px)") : { matches: true, addEventListener() {} };
  if (!toggle || !sidebar) return;
  toggle.addEventListener("click", () => {
    if (desktop.matches) {
      const collapsed = html.classList.toggle("rail-collapsed");
      raw.set("cw-rail", collapsed ? "1" : "0");
      sync();
    } else if (isOpen()) closeDrawer(); else openDrawer();
  });
  if (scrim) scrim.addEventListener("click", () => closeDrawer());
  sidebar.addEventListener("click", (e) => { if (e.target.closest("a[href]") && isOpen()) closeDrawer(false); });
  document.addEventListener("keydown", (e) => {
    if (!isOpen()) return;
    if (e.key === "Escape") { e.preventDefault(); closeDrawer(); return; }
    if (e.key !== "Tab") return;
    // the toggle and the drawer links are not DOM neighbors, so move focus ourselves
    const f = [toggle, ...focusables(sidebar)];
    const i = f.indexOf(document.activeElement);
    e.preventDefault();
    f[i < 0 ? (e.shiftKey ? f.length - 1 : 0) : (i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
  });
  const onChange = () => { if (desktop.matches) closeDrawer(false); sync(); };
  desktop.addEventListener ? desktop.addEventListener("change", onChange) : desktop.addListener && desktop.addListener(onChange);
  sync();
  // keep the current page visible in the sidebar: open its <details>, scroll it into view
  const cur = $('.nav-link[aria-current="page"]', sidebar);
  if (cur) {
    for (let el = cur.parentElement; el && el !== sidebar; el = el.parentElement) if (el.tagName === "DETAILS") el.open = true;
    const top = cur.offsetTop, h = sidebar.clientHeight;
    if (top > h - 80) sidebar.scrollTop = top - h / 2;
  }
}

export const drawerIsOpen = isOpen;
export { $$ };
