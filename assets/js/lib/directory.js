/* ============================================================
   site/js/lib/directory.js · OWNER: Agent F (directory: people, art, partners)
   Pure logic for features/directory.js (no DOM), unit-tested in tests/directory.test.mjs.
     splitVals(attr, sep)                 "speaker artist" → Set{speaker, artist}; sep "|" for values with spaces
     matchItem(item, spec, skipKey)       item = { hay, vals: { key: Set } }; spec = { terms, sel: { key: Set }, keys }
                                          → every term is in hay, and for each key with a selection the item
                                          holds one of the selected values (skipKey is left out: facet counts)
     facetCounts(items, spec)             → { key: Map(value → items matching every other filter) }
     parseState(search, { keys, allowed, single })  → { q, sel: { key: Set } } from a query string;
                                          values are comma-separated and must be in allowed[key]
     writeState(params, state, keys)      writes q and each key (sorted, comma-joined); drops empty ones
   ============================================================ */

export function splitVals(attr, sep = "") {
  if (attr == null || attr === "") return new Set();
  const parts = sep ? String(attr).split(sep) : String(attr).split(/\s+/);
  return new Set(parts.map((x) => x.trim()).filter(Boolean));
}

export function matchItem(item, spec, skipKey = null) {
  const { terms = [], sel = {}, keys = Object.keys(sel) } = spec;
  for (const t of terms) if (!item.hay.includes(t)) return false;
  for (const k of keys) {
    if (k === skipKey) continue;
    const want = sel[k];
    if (!want || !want.size) continue;
    const have = item.vals[k] || new Set();
    let hit = false;
    for (const v of want) if (have.has(v)) { hit = true; break; }
    if (!hit) return false;
  }
  return true;
}

export function facetCounts(items, spec) {
  const out = {};
  for (const k of spec.keys || Object.keys(spec.sel || {})) {
    const m = new Map();
    for (const it of items) {
      if (!matchItem(it, spec, k)) continue;
      for (const v of it.vals[k] || []) m.set(v, (m.get(v) || 0) + 1);
    }
    out[k] = m;
  }
  return out;
}

export function parseState(search, { keys = [], allowed = {}, single = new Set() } = {}) {
  const p = new URLSearchParams(search || "");
  const q = (p.get("q") || "").slice(0, 100);
  const sel = {};
  for (const k of keys) {
    const raw = p.get(k);
    if (!raw) continue;
    const ok = raw.split(",").map((x) => x.trim()).filter((x) => x && (!allowed[k] || allowed[k].has(x)));
    if (!ok.length) continue;
    sel[k] = new Set(single.has(k) ? ok.slice(0, 1) : ok);
  }
  return { q, sel };
}

export function writeState(params, state, keys = []) {
  const q = (state.q || "").trim();
  if (q) params.set("q", q); else params.delete("q");
  for (const k of keys) {
    const v = [...(state.sel[k] || [])].sort();
    if (v.length) params.set(k, v.join(",")); else params.delete(k);
  }
  return params;
}
