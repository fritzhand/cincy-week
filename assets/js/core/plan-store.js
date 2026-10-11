/* ============================================================
   site/js/core/plan-store.js · OWNER: Agent A (core engine)
   My Plan: starred events and works in localStorage (cw-plan).
     has(id) · toggle(id, kind = "e") · add(ids, kind) · clear() · list() → { e, w } · subscribe(fn)
   A delegated click handler drives every [data-star] button (aria-pressed,
   the aria-label names the item). Every [data-plan-count] badge, the sidebar
   My Plan card ("Next: Thu 5:00 PM · …") and the dock badge update on every
   change, including changes made in another tab (storage event).
   ============================================================ */
import { $, $$, esc } from "./dom.js";
import { store } from "./store.js";
import { toast } from "./toast.js";
import { getJSON } from "./data.js";
import { now } from "./clock.js";
import { nyParts, fmtTime, dowShort } from "../lib/time.js";

const KEY = "cw-plan";
let plan = read();
const subs = new Set();
let warned = false;

function read() {
  const v = store.get(KEY, null);
  const ok = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === "string" && /^[a-z0-9][a-z0-9-]*$/.test(x)) : []);
  return { v: 1, e: ok(v && v.e), w: ok(v && v.w), t: (v && v.t) || 0 };
}
function save() {
  plan.t = Date.now();
  const ok = store.set(KEY, plan);
  if (!ok && !warned) { warned = true; toast("Your browser is blocking storage, so stars last for this visit only.", { ms: 5000 }); }
  emit();
}
function emit() { subs.forEach((fn) => { try { fn(list()); } catch (e) { console.error(e); } }); render(); }

export const list = () => ({ e: [...plan.e], w: [...plan.w] });
export const has = (id) => plan.e.includes(id) || plan.w.includes(id);
export const count = () => plan.e.length + plan.w.length;
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
export function toggle(id, kind = "e") {
  const arr = kind === "w" ? plan.w : plan.e;
  const i = arr.indexOf(id);
  if (i > -1) arr.splice(i, 1); else arr.push(id);
  save();
  return i < 0;
}
export function add(ids, kind = "e") { const arr = kind === "w" ? plan.w : plan.e; for (const id of ids) if (!arr.includes(id)) arr.push(id); save(); }
export function replace({ e = [], w = [] }) { plan.e = [...e]; plan.w = [...w]; save(); }
export function clear() { plan.e = []; plan.w = []; save(); }

/* ---------- rendering: stars, counts, the sidebar card ---------- */
function render() {
  for (const b of $$("[data-star]")) {
    const on = has(b.dataset.star);
    b.setAttribute("aria-pressed", String(on));
    const name = (b.getAttribute("aria-label") || "").replace(/^(Add |Remove )/, "").replace(/ (to|from) My Plan$/, "");
    b.setAttribute("aria-label", `${on ? "Remove" : "Add"} ${name} ${on ? "from" : "to"} My Plan`);
  }
  const n = count();
  for (const el of $$("[data-plan-count]")) { el.textContent = String(n); el.hidden = n === 0; }
  const card = $("[data-plan-card]");
  if (card) {
    card.classList.toggle("is-empty", n === 0);
    const title = $("[data-plan-card-title]", card), next = $("[data-plan-card-next]", card);
    if (title) title.textContent = n ? `${n} in My Plan` : "My Plan";
    if (next && !n) next.textContent = "Star events to build your plan";
    if (next && n) nextUp().then((x) => {
      if (!x) { next.textContent = plan.e.length ? "Nothing else coming up in your plan" : `${plan.w.length} work${plan.w.length === 1 ? "" : "s"} of art to see`; return; }
      // flags: 2 hours not listed, 4 all day: never print a made-up "12:00 AM"
      const when = x.f & 4 ? "all day" : x.f & 2 ? "hours not listed" : fmtTime(nyParts(x.s).hhmm);
      next.innerHTML = `Next: <b class="tnum">${esc(dowShort(x.day))} ${esc(when)}</b> · ${esc(x.t)}`;
    }).catch(() => { next.textContent = `${n} starred`; });
  }
}
/** The next starred event instance that has not ended: { t, day, s, e, f (flags) } | null */
async function nextUp() {
  if (!plan.e.length) return null;
  const data = await getJSON("events.json");
  const t = now();
  let best = null;
  for (const ev of data.events) {
    if (!plan.e.includes(ev.id)) continue;
    if (ev.st === "cancelled") continue;
    for (const [day, s, e, f] of ev.i) if (e > t && (!best || s < best.s)) best = { t: ev.t, day, s, e, f };
  }
  return best;
}

export const refreshStars = () => render();
export function initPlan() {
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-star]");
    if (!b) return;
    e.preventDefault();
    const on = toggle(b.dataset.star, b.dataset.starKind === "w" ? "w" : "e");
    toast(on ? "Added to My Plan" : "Removed from My Plan", { link: on ? true : null });
  });
  window.addEventListener("storage", (e) => { if (e.key === KEY) { plan = read(); emit(); } });
  render();
}
