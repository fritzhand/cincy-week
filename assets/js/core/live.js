/* ============================================================
   site/js/core/live.js · OWNER: Agent A (core engine)
   The topbar Live pill ("● Live now · 3"): shown only during the week and
   only when something is live, linking to schedule.html?when=now. Counts
   events whose listed hours include now (not "hours not listed" items).
   events.json is fetched on idle, only during the week.
   ============================================================ */
import { $ } from "./dom.js";
import { getJSON, idle } from "./data.js";
import { onTick, phase } from "./clock.js";

export function initLive() {
  const pill = $("[data-live-pill]");
  if (!pill || phase() !== "during") return;
  idle(() => getJSON("events.json").then((data) => {
    onTick((t) => {
      let n = 0;
      for (const ev of data.events) {
        if (ev.st === "cancelled") continue;
        if (ev.i.some(([, s, e, f]) => !(f & 1) && !(f & 2) && !(f & 4) && t >= s && t < e)) n++;
      }
      pill.hidden = n === 0;
      const txt = $("[data-live-text]", pill);
      if (txt) txt.textContent = `Live now · ${n}`;
    });
  }).catch(() => {}));
}
