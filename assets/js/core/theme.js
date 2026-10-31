/* ============================================================
   site/js/core/theme.js · OWNER: Agent A (core engine)
   Morning (light) and Night (dark) editions. The boot script in <head>
   already set <html data-theme> before paint; this wires the toggle,
   keeps both theme-color metas in sync, and follows the system setting
   until the reader picks an edition.
   ============================================================ */
import { $, $$, html } from "./dom.js";
import { raw } from "./store.js";

function sync() {
  const dark = html.getAttribute("data-theme") === "dark";
  $$("[data-theme-toggle]").forEach((b) => {
    b.setAttribute("aria-label", dark ? "Switch to the Morning edition" : "Switch to the Night edition");
  });
  const c = getComputedStyle(html).getPropertyValue("--theme-color").trim();
  if (c) $$('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", c));
}
export function setTheme(t, save = true) {
  html.setAttribute("data-theme", t);
  if (save) raw.set("cw-theme", t);
  sync();
}
export function initTheme() {
  $$("[data-theme-toggle]").forEach((b) => b.addEventListener("click", () => setTheme(html.getAttribute("data-theme") === "dark" ? "light" : "dark")));
  if (window.matchMedia) {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onSys = () => { const saved = raw.get("cw-theme"); if (saved !== "light" && saved !== "dark") setTheme(mq.matches ? "dark" : "light", false); };
    mq.addEventListener ? mq.addEventListener("change", onSys) : mq.addListener && mq.addListener(onSys);
  }
  if (raw.get("cw-theme")) sync(); else { const b = $("[data-theme-toggle]"); if (b) sync(); }
}
