/* ============================================================
   site/js/core/status.js · OWNER: Agent A (core engine)
   Live state for anything rendered with data-s / data-e (epoch ms): sets
   data-status (upcoming | soon | live | started | past) and a visible word
   in its [data-status] label, never color alone (DESIGN.md §9.4):
   "In 20 min", "Now", "Started" (no end time listed), "Ended". Live cards
   get a progress bar with an aria-label ("40 of 300 minutes elapsed").
   Elements with data-end-unknown="1" never claim "Now"; data-time-unknown="1" gets no state. Multi-day cards carry
   data-inst="s:e,s:e,…" and follow the current (or next) day's hours.
   ============================================================ */
import { $$ } from "./dom.js";
import { status as statusOf, MIN } from "../lib/time.js";

export { statusOf };
export function label(st, s, now) {
  if (st === "soon") return `In ${Math.max(1, Math.round((s - now) / MIN))} min`;
  if (st === "live") return "Now";
  if (st === "started") return "Started";
  if (st === "past") return "Ended";
  return "";
}

/** Update every [data-s][data-e] element under root. */
export function updateStatus(now, root = document) {
  for (const el of $$("[data-s][data-e]", root)) {
    if (el.dataset.timeUnknown === "1") continue; // hours not listed: no state is better than a guessed one
    let s = Number(el.dataset.s), e = Number(el.dataset.e);
    if (el.dataset.inst) { // multi-day items: follow the current (or next) day's hours
      const pairs = el.dataset.inst.split(",").map((x) => x.split(":").map(Number));
      const cur = pairs.find(([, pe]) => pe > now) || pairs[pairs.length - 1];
      [s, e] = cur;
    }
    if (!s || !e) continue;
    const st = statusOf(s, e, now, el.dataset.endUnknown === "1");
    if (el.dataset.status !== st) el.dataset.status = st;
    const lab = el.querySelector("[data-status]:not([data-s])");
    if (lab) lab.textContent = label(st, s, now);
    let bar = el.querySelector(":scope > .ev-progress");
    if (st === "live" && el.classList.contains("ev")) {
      const total = Math.round((e - s) / MIN), done = Math.min(total, Math.round((now - s) / MIN));
      if (!bar) { bar = document.createElement("span"); bar.className = "ev-progress"; bar.setAttribute("role", "img"); bar.appendChild(document.createElement("i")); el.appendChild(bar); }
      bar.setAttribute("aria-label", `${done} of ${total} minutes elapsed`);
      bar.firstChild.style.setProperty("--p", `${Math.round((done / total) * 100)}%`);
    } else if (bar) bar.remove();
  }
}
