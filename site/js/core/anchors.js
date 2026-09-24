/* ============================================================
   site/js/core/anchors.js · OWNER: Agent A (core engine)
   Heading links (QS): a click on .h-anchor copies the section's URL,
   updates the hash without a jump, and scrolls to the section.
   ============================================================ */
import { $$, motionOK } from "./dom.js";
import { copyText } from "./share.js";
import { toast } from "./toast.js";

export function initAnchors() {
  $$(".h-anchor").forEach((a) => a.addEventListener("click", async (e) => {
    e.preventDefault();
    const id = a.getAttribute("href").slice(1);
    const url = `${location.href.split("#")[0]}#${id}`;
    try { history.replaceState(history.state, "", `#${id}`); } catch { /* file:// */ }
    const target = document.getElementById(decodeURIComponent(id));
    if (target) target.scrollIntoView({ behavior: motionOK() ? "smooth" : "auto", block: "start" });
    if (await copyText(url)) toast("Link to this section copied");
  }));
}
