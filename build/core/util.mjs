/* ============================================================
   build/core/util.mjs · OWNER: Agent A (core engine)
   Small, pure helpers for the build: escaping, paragraphs, slugs, hosts,
   plain-text checks, stable sorting, hashing. No imports from page modules.
   ============================================================ */
import { createHash } from "node:crypto";
import { esc, paras as parasText, hostOf, slugify, aliasKey, initials, truncate } from "../../site/js/lib/text.js";

export { esc, hostOf, slugify, aliasKey, initials, truncate };
/** attribute-safe (same escaping as esc; kept separate for readability at call sites) */
export const attr = esc;
/** plain text with "\n\n" paragraphs → escaped <p>…</p> HTML */
export const paras = (text) => parasText(text).map((p) => `<p>${esc(p)}</p>`).join("\n");

/** An HTML tag or an HTML entity inside a plain-text field (scrapes often carry &amp; &#8217; &nbsp; <br>). */
export const HTML_IN_TEXT = /<\/?[a-zA-Z][^>]*>|&(?:[a-zA-Z][a-zA-Z0-9]{1,31}|#\d{1,7}|#x[0-9a-fA-F]{1,6});/;
/** Placeholder strings that must be null instead. */
export const PLACEHOLDER = /^(?:tba|tbd|n\/?a|none|null|undefined|coming soon|to be announced|to be determined|lorem\b.*)$/i;
export const PLACEHOLDER_WORD = /\b(?:TBA|TBD|TBC|lorem ipsum)\b/i;

/** Stable sort by a key function (or several), ties keep input order. */
export function sortBy(arr, ...keys) {
  return arr.map((v, i) => [v, i]).sort(([a, ia], [b, ib]) => {
    for (const k of keys) {
      const x = k(a), y = k(b);
      if (x < y) return -1;
      if (x > y) return 1;
    }
    return ia - ib;
  }).map(([v]) => v);
}

/** Group an array into a Map by key (insertion order kept). */
export function groupBy(arr, key) {
  const m = new Map();
  for (const x of arr) { const k = key(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
  return m;
}

/** 8-hex content hash for cache busting (?v=…). */
export const hash8 = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 8);

/** "1 event" / "2 events" */
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Join a list in prose: ["a","b","c"] → "a, b and c" */
export function listJoin(items, word = "and") {
  const a = items.filter(Boolean);
  if (a.length < 2) return a.join("");
  return `${a.slice(0, -1).join(", ")} ${word} ${a[a.length - 1]}`;
}

/** An external link that opens in a new tab and says so (the crawler requires both). */
export function extLink(href, html, cls = "") {
  return `<a${cls ? ` class="${cls}"` : ""} href="${attr(href)}" target="_blank" rel="noopener">${html}<span class="sr-only"> (opens in a new tab)</span></a>`;
}

/** Deep-freeze-free shallow clone for records handed to modules. */
export const clone = (o) => JSON.parse(JSON.stringify(o));
