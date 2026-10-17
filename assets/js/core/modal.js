/* ============================================================
   site/js/core/modal.js · OWNER: Agent A (core engine)
   The one modal component (DESIGN.md §9.11): search, the event and work
   dialogs, the filter sheet, share. One modal at a time. While open:
   body.modal-open, inert on topbar, layout, footer and dock, a focus trap,
   Esc and [data-close] close it, and focus returns to the trigger.
   Markup: <div class="modal" id role="dialog" aria-modal="true" data-modal>
             <div class="modal-backdrop" data-close></div><div class="modal-panel">…</div></div>
   API: showModal(el, { trigger, focus, onClose }) · hideModal(restoreFocus = true) · current()
   ============================================================ */
import { $, $$, focusables } from "./dom.js";
import { closeDrawer } from "./drawer.js";

const body = document.body;
let open = null, returnTo = null, onClose = null;
const background = () => [$(".topbar"), $(".layout"), $(".footer"), $(".dock")].filter(Boolean);

export const current = () => open;

export function showModal(m, { trigger = null, focus = null, onClose: cb = null } = {}) {
  if (!m) return;
  if (open && open !== m) hideModal(false);
  closeDrawer(false);
  returnTo = trigger || document.activeElement;
  onClose = cb;
  open = m;
  m.classList.add("open");
  body.classList.add("modal-open");
  background().forEach((el) => { el.inert = true; });
  const panel = $(".modal-panel", m) || m;
  const target = typeof focus === "string" ? $(focus, m) : focus;
  const f = target || focusables(panel)[0];
  if (f) f.focus({ preventScroll: true });
}

export function hideModal(restore = true) {
  if (!open) return;
  const m = open, cb = onClose;
  open = null; onClose = null;
  m.classList.remove("open");
  body.classList.remove("modal-open");
  background().forEach((el) => { el.inert = false; });
  if (cb) cb();
  if (restore && returnTo && document.contains(returnTo)) {
    const t = returnTo;
    t.focus({ preventScroll: true });
    // Closing by Back (popstate) can land on an entry with a #fragment; the browser then moves focus to the
    // fragment target (e.g. #main after the skip link) right after our focus. Take it back next frame.
    requestAnimationFrame(() => {
      const a = document.activeElement;
      if (a !== t && document.contains(t) && (!a || a === document.body || a.id === "main" || a.matches("[tabindex='-1']"))) t.focus({ preventScroll: true });
    });
  }
  returnTo = null;
}

export function initModal() {
  $$("[data-modal]").forEach((m) => {
    m.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) { e.preventDefault(); hideModal(); } });
  });
  document.addEventListener("keydown", (e) => {
    if (!open) return;
    if (e.key === "Escape") { e.preventDefault(); hideModal(); return; }
    if (e.key !== "Tab") return;
    const f = focusables($(".modal-panel", open) || open);
    if (!f.length) { e.preventDefault(); return; }
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && (i === f.length - 1 || i < 0)) { e.preventDefault(); f[0].focus(); }
  });
}
