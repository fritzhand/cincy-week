/* ============================================================
   site/js/core/clock.js · OWNER: Agent A (core engine)
   The client clock. now() is Date.now(), unless QA passed ?now=YYYY-MM-DDTHH:MM
   (New York wall time) on localhost or with localStorage cw-debug=1: the boot
   script validated it and stored the instant in <html data-now>; the clock
   then runs forward from there, so screenshots of "during" states work in
   September. onTick(fn) fires every 60 s, pauses while the tab is hidden and
   fires at once when it comes back.
   ============================================================ */
import { html } from "./dom.js";
import { nyParts as nyPartsLib } from "../lib/time.js";

const fixed = Number(html.getAttribute("data-now")) || 0;
const bootReal = Date.now();
export const now = () => (fixed ? fixed + (Date.now() - bootReal) : Date.now());
export const isSimulated = () => !!fixed;
export const nyParts = (t = now()) => nyPartsLib(t);
export const phase = () => html.getAttribute("data-phase") || "before";

const subs = new Set();
let timer = null;
function tick() { const t = now(); subs.forEach((fn) => { try { fn(t); } catch (e) { console.error(e); } }); }
function start() { if (!timer) timer = setInterval(tick, 60000); }
function stop() { clearInterval(timer); timer = null; }
export function onTick(fn, { immediate = true } = {}) {
  subs.add(fn);
  if (immediate) fn(now());
  if (!document.hidden) start();
  return () => subs.delete(fn);
}
document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); else { tick(); start(); } });
