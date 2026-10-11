/* ============================================================
   site/js/lib/search.js · OWNER: Agent A (core engine) · PURE (no DOM)
   Scoring and grouping for the ⌘K palette (engine spec §4.9).

   Index entries (docs/assets/data/search.json → items[]):
     { k: kind, id, t: title, s: subline, u: url (root-relative), p?: program,
       g?: extra keywords, i?: image, st?/en?: event instants (epoch ms) }
   kinds: ev event · pe person · wo work · ve venue · pr program · pg page ·
          or org · fq faq · pl place · st stay · nw news

   Scoring = QS multi-term AND over t s g (accent-folded) + AIM word-prefix
   boost + a phrase bonus + a "happening soon" boost for events.
   ============================================================ */

/** Accent-insensitive, lowercase: "Café" → "cafe" */
export const norm = (s) => String(s ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\u2019\u2018]/g, "'");
export const terms = (q) => norm(q).split(/[\s,]+/).map((t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")).filter(Boolean);

export const KINDS = {
  ev: "Events", pe: "People", wo: "Art", ve: "Venues", pr: "Programs and pages", pg: "Programs and pages",
  or: "Partners", fq: "FAQ", pl: "Places and stays", st: "Places and stays", nw: "News",
};
export const GROUP_ORDER = ["Events", "People", "Art", "Venues", "Programs and pages", "Partners", "FAQ", "Places and stays", "News"];
/** Where "See all n →" goes for a group (root-relative; the query is appended as ?q=). */
export const SEE_ALL = { Events: "schedule.html", People: "people.html", Art: "art.html", Venues: "venues.html", FAQ: "faq.html" };

/** Add normalized fields once (_t, _s, _g, _w = title words). */
export function prepare(items) {
  return items.map((e) => {
    const _t = norm(e.t);
    return { ...e, _t, _s: norm(e.s), _g: norm(e.g), _w: _t.split(/[^\p{L}\p{N}']+/u).filter(Boolean) };
  });
}

const wordPrefix = (words, t) => words.some((w) => w.startsWith(t));

/** Score one prepared entry; -1 when some term is missing (AND). */
export function score(e, ts, phrase, now = 0) {
  if (!ts.length) return -1;
  let total = 0;
  for (const t of ts) {
    let s = 0;
    if (e._t.startsWith(t)) s += 40;
    else if (wordPrefix(e._w, t)) s += 30;
    else if (e._t.includes(t)) s += 20;
    if (e._s.includes(t)) s += 8;
    if (e._g.includes(t)) s += 4;
    if (!s) return -1;
    total += s;
  }
  if (phrase.length > 1) {
    if (e._t === phrase) total += 100;
    else if (e._t.startsWith(phrase)) total += 60;
    else if (e._t.includes(phrase)) total += 30;
  }
  if (e.k === "pe" || e.k === "pr") total += 3;
  if (now && e.k === "ev" && e.st && e.en) {
    if (now >= e.st && now < e.en) total += 25;
    else if (e.st > now && e.st - now < 3 * 3600e3) total += 15;
    else if (e.en < now) total -= 5;
  }
  return total;
}

/** Search prepared items; returns hits sorted by score (ties: title). */
export function search(items, q, { now = 0, limit = 200 } = {}) {
  const ts = terms(q), phrase = norm(q).trim();
  const hits = [];
  for (const e of items) {
    const s = score(e, ts, phrase, now);
    if (s >= 0) hits.push({ e, s });
  }
  hits.sort((a, b) => b.s - a.s || (a.e.t < b.e.t ? -1 : a.e.t > b.e.t ? 1 : 0));
  return hits.slice(0, limit).map((h) => ({ ...h.e, score: h.s, exact: phrase.length > 1 && h.e._t === phrase }));
}

/** Group hits by kind label in GROUP_ORDER, at most `per` per group; `total` keeps the full count. */
export function group(hits, per = 5) {
  const by = new Map();
  for (const h of hits) {
    const g = KINDS[h.k] || "Programs and pages";
    if (!by.has(g)) by.set(g, []);
    by.get(g).push(h);
  }
  // QA: when the best hit's title is exactly the query ("Findlay Market", "Memorial Hall"), its group leads, so the
  // place, person or program asked for is the first result instead of sitting under the events that mention it
  const lead = hits[0] && hits[0].exact ? (KINDS[hits[0].k] || "Programs and pages") : null;
  const order = lead ? [lead, ...GROUP_ORDER.filter((g) => g !== lead)] : GROUP_ORDER;
  return order.filter((g) => by.has(g)).map((g) => ({ label: g, total: by.get(g).length, items: by.get(g).slice(0, per) }));
}

/** Wrap matches of the query terms in <mark> (input must be plain text; output is escaped HTML). */
export function mark(text, q, esc) {
  const ts = terms(q).filter((t) => t.length > 1).sort((a, b) => b.length - a.length);
  const src = String(text ?? "");
  if (!ts.length) return esc(src);
  const n = norm(src);
  if (n.length !== src.length) return esc(src);        // folding changed the length: skip marking rather than misplace it
  const spans = [];
  for (const t of ts) { let i = 0; while ((i = n.indexOf(t, i)) > -1) { spans.push([i, i + t.length]); i += t.length; } }
  spans.sort((a, b) => a[0] - b[0]);
  let out = "", at = 0;
  for (const [a, b] of spans) { if (a < at) continue; out += esc(src.slice(at, a)) + "<mark>" + esc(src.slice(a, b)) + "</mark>"; at = b; }
  return out + esc(src.slice(at));
}
