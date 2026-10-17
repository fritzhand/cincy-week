/* ============================================================
   site/js/core/store.js · OWNER: Agent A (core engine)
   Every storage access goes through here, wrapped in try/catch: private
   windows and blocked storage must never break a page. When storage is
   blocked, values live in memory for this page view (store.blocked = true).

   Keys (all prefixed cw-):
     cw-theme        "light" | "dark"                      theme.js (boot script reads it)
     cw-rail         "1" when the desktop rail is collapsed drawer.js (boot script reads it)
     cw-plan         { v: 1, e: [event ids], w: [work ids], t: updated epoch }   plan-store.js
     cw-prefs        { scheduleView: "list"|"map", hidePast: bool, mapLayers: [...] }  features (per-reader conveniences)
     cw-seen-shared  the last imported share hash (plan.js), so a shared link does not re-prompt
     cw-debug        "1" enables ?now= on the live site (QA only)
   ============================================================ */
const mem = new Map();
let blocked = false;

export const raw = {
  get(k) { try { const v = localStorage.getItem(k); return v === null && mem.has(k) ? mem.get(k) : v; } catch { blocked = true; return mem.has(k) ? mem.get(k) : null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { blocked = true; mem.set(k, v); return false; } },
  del(k) { mem.delete(k); try { localStorage.removeItem(k); } catch { blocked = true; } },
};

export const store = {
  get(k, fallback = null) { const v = raw.get(k); if (v == null) return fallback; try { const p = JSON.parse(v); return p ?? fallback; } catch { return fallback; } },
  set(k, v) { return raw.set(k, JSON.stringify(v)); },
  del: raw.del,
  get blocked() { return blocked; },
};
