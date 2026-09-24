/* ============================================================
   site/js/core/dock.js · OWNER: Agent A (core engine)
   The phone dock (Week · Map · Plan · Search). CSS hides it while the
   drawer or a modal is open; this hides it while the on-screen keyboard
   is up (visualViewport shrinks), via body.kb-open.
   ============================================================ */
export function initDock() {
  const vv = window.visualViewport;
  if (!vv) return;
  const check = () => {
    const typing = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    document.body.classList.toggle("kb-open", typing && window.innerHeight - vv.height > 150);
  };
  vv.addEventListener("resize", check);
  document.addEventListener("focusin", check);
  document.addEventListener("focusout", () => setTimeout(check, 50));
}
