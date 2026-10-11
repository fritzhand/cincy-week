/* ============================================================
   site/js/lib/share.js · OWNER: Agent A (core engine) · PURE (no DOM)
   Short, stable codes for shared plans: plan.html#p=<code>,<code>[;w=<code>,…]
   code(id) = FNV-1a 32-bit of the id, base36, 5 characters. The build
   computes every event and work code and fails on a collision.
   ============================================================ */
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (const ch of new TextEncoder().encode(String(str))) {
    h ^= ch;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
const SPACE = 36 ** 5;
/** "scw-opening-keynote" → a 5-character base36 code */
export const code = (id) => (fnv1a(id) % SPACE).toString(36).padStart(5, "0");
export const CODE_RE = /^[0-9a-z]{5}$/;

/** ids → "code,code" (sorted for stable links) */
export const encode = (ids) => [...new Set(ids.map(code))].sort().join(",");

/** { e: [eventIds], w: [workIds] } → "p=…;w=…" (the part after "#") */
export function planHash({ e = [], w = [] } = {}) {
  const parts = [];
  if (e.length) parts.push(`p=${encode(e)}`);
  if (w.length) parts.push(`w=${encode(w)}`);
  return parts.join(";");
}

/** "#p=abcde,fghij;w=klmno" → { e: [...ids], w: [...ids], unknown: n }.
 *  codeToId: Map or object from code to id (built from the events and works JSON). Unknown codes are ignored. */
export function decode(hash, codeToId) {
  const get = (c) => (codeToId instanceof Map ? codeToId.get(c) : codeToId[c]);
  const out = { e: [], w: [], unknown: 0 };
  const h = String(hash || "").replace(/^#/, "");
  for (const part of h.split(";")) {
    const m = /^(p|w)=(.*)$/.exec(part.trim());
    if (!m) continue;
    for (const c of m[2].split(",")) {
      const cc = c.trim().toLowerCase();
      if (!CODE_RE.test(cc)) { if (cc) out.unknown++; continue; }
      const id = get(cc);
      if (!id) { out.unknown++; continue; }
      const list = m[1] === "p" ? out.e : out.w;
      if (!list.includes(id)) list.push(id);
    }
  }
  return out;
}

/** Build { code → id } and report collisions: [[code, idA, idB]] */
export function codeTable(ids) {
  const map = new Map(), collisions = [];
  for (const id of ids) {
    const c = code(id);
    if (map.has(c) && map.get(c) !== id) collisions.push([c, map.get(c), id]);
    else map.set(c, id);
  }
  return { map, collisions };
}
