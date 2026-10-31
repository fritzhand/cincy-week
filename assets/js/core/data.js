/* ============================================================
   site/js/core/data.js · OWNER: Agent A (core engine)
   Lazy, memoized fetch of the build's JSON outputs (assets/data/*.json),
   cache-busted with the build's data hash (<html data-v>). Shapes are
   documented in build/core/client-data.mjs and build/core/search.mjs.
   ============================================================ */
import { ROOT, DATA_V } from "./dom.js";

const cache = new Map();
/** getJSON("events.json") → Promise<object>; rejects when unavailable (file://, offline). */
export function getJSON(name) {
  if (!cache.has(name)) {
    const p = fetch(`${ROOT}assets/data/${name}${DATA_V ? `?v=${DATA_V}` : ""}`)
      .then((r) => { if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`); return r.json(); });
    p.catch(() => cache.delete(name));
    cache.set(name, p);
  }
  return cache.get(name);
}
/** Run fn when the browser is idle (or soon). */
export const idle = (fn) => ("requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 2500 }) : setTimeout(fn, 600));
