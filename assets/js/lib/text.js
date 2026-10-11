/* ============================================================
   site/js/lib/text.js · OWNER: Agent A (core engine) · PURE (no DOM)
   Plain-text helpers shared by the build and the client.
   ============================================================ */
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
/** HTML-escape text and attribute values */
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

/** Split plain text into paragraphs on blank lines (data stores paragraphs separated by "\n\n"). */
export const paras = (text) => String(text ?? "").split(/\r?\n\s*\r?\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);

/** Paragraphs as escaped HTML: <p>…</p><p>…</p> */
export const parasHtml = (text) => paras(text).map((p) => `<p>${esc(p)}</p>`).join("");

const PARTICLES = new Set(["de", "da", "del", "der", "van", "von", "la", "le", "di", "du", "st", "jr", "sr", "ii", "iii", "iv", "phd", "md"]);
/** Monogram initials: "Jeremy Fritzhand" → "JF", "Ludwig van Beethoven" → "LB", "Madonna" → "M" */
export function initials(name) {
  const words = String(name ?? "").replace(/[“”"()]/g, " ").split(/[\s\-]+/).map((w) => w.replace(/[.,]/g, "")).filter(Boolean);
  const main = words.filter((w, i) => i === 0 || !PARTICLES.has(w.toLowerCase()));
  if (!main.length) return "?";
  const first = main[0], last = main.length > 1 ? main[main.length - 1] : "";
  const pick = (w) => (w.match(/\p{L}|\p{N}/u) || ["?"])[0].toUpperCase();
  return pick(first) + (last ? pick(last) : "");
}

/** Truncate on a word boundary: truncate("A long sentence here", 12) → "A long…" */
export function truncate(s, n) {
  const str = String(s ?? "").replace(/\s+/g, " ").trim();
  if (str.length <= n) return str;
  const cut = str.slice(0, n + 1);
  const i = cut.lastIndexOf(" ");
  return (i > n * 0.3 ? cut.slice(0, i) : str.slice(0, n)).replace(/[\s,.;:–—-]+$/, "") + "…";
}

/** URL host without "www.": "https://www.blinkcincinnati.com/faqs" → "blinkcincinnati.com" */
export function hostOf(url) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } }

/** Kebab slug: "Over-the-Rhine & Pendleton" → "over-the-rhine-and-pendleton" */
export const slugify = (s) => norm0(s).replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const norm0 = (s) => String(s ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Normalized key for alias lookups: lowercase, & → and, punctuation stripped, spaces collapsed. */
export const aliasKey = (s) => norm0(s).replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();

/** The part of an event's room worth printing after its venue's name (QA, additive). A room the venue name already
 *  holds prints nothing ("Central Parkway between …" under "Ready. Set. BLINK! footprint: Central Parkway between …");
 *  a room that repeats the venue name first prints only the rest, verbatim ("Court Street Plaza, East Court Street"
 *  → "East Court Street"). Anything else is returned unchanged. Words are compared without case or accents. */
export function roomText(venueName, room) {
  const r = String(room ?? "").trim();
  if (!r) return "";
  const toks = (s) => [...String(s ?? "").matchAll(/[\p{L}\p{N}]+/gu)].map((m) => ({ w: norm0(m[0]), end: m.index + m[0].length }));
  const vt = toks(venueName).map((t) => t.w), rt = toks(r);
  if (!vt.length || !rt.length) return r;
  const rw = rt.map((t) => t.w);
  for (let i = 0; i + rw.length <= vt.length; i++) if (rw.every((w, j) => vt[i + j] === w)) return "";
  if (rw.length > vt.length && vt.every((w, j) => rw[j] === w)) {
    const rest = r.slice(rt[vt.length - 1].end);
    if (!/^\s*[,;:·–—(-]/.test(rest)) return r;   // "Hall of Mirrors" is a room name, not "Hall" + a note
    return rest.replace(/^[\s,;:·–—-]+/, "").replace(/^\((.*)\)$/, "$1").trim();
  }
  return r;
}
