/* ============================================================
   site/js/core/share.js · OWNER: Agent A (core engine)
   share({ title, text, url }): the Web Share API when the device has it,
   otherwise copy the link (QS copyText with its textarea fallback) and
   say so in a toast. Returns "shared" | "copied" | "failed".
   ============================================================ */
import { toast } from "./toast.js";

export async function copyText(text) {
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch { /* fall through */ }
  const ta = document.createElement("textarea");
  ta.value = text; ta.setAttribute("readonly", "");
  ta.style.position = "fixed"; ta.style.top = "-1000px"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { ok = false; }
  ta.remove();
  return ok;
}

export async function share({ title = document.title, text = "", url = location.href } = {}) {
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return "shared"; }
    catch (e) { if (e && e.name === "AbortError") return "failed"; }
  }
  if (await copyText(url)) { toast("Link copied"); return "copied"; }
  toast("Couldn't copy the link. Copy it from the address bar.");
  return "failed";
}
