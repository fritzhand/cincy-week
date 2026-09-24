/* ============================================================
   site/js/lib/filters.js · OWNER: Agent A (core engine) · PURE (no DOM)
   Filter state ⇄ URL query string, and matching against card data.

   A schema describes the params of one page (engine spec §4.6):
     { key: { type: "list"|"one"|"bool"|"text", values?: [..] | (v) => bool,
              default?, field?: "item property", max?: n } }
   - parse(search, schema)    → state. Unknown keys and invalid values are dropped
                                (the AIM parseVenueZone pattern: never trust a URL).
   - serialize(state, schema) → "?k=v&…" with defaults omitted, list values sorted,
                                keys in schema order, so equal states give equal URLs.
   - matches(item, state, schema) → does a card's data match every active filter?
   ============================================================ */
import { norm } from "./search.js";

const valid = (spec, v) => {
  if (!spec.values) return true;
  return typeof spec.values === "function" ? !!spec.values(v) : spec.values.includes(v);
};
const dflt = (spec) => {
  if (spec.default !== undefined) return Array.isArray(spec.default) ? [...spec.default] : spec.default;
  return spec.type === "list" ? [] : spec.type === "bool" ? false : spec.type === "text" ? "" : null;
};

export function defaults(schema) {
  const s = {};
  for (const [k, spec] of Object.entries(schema)) s[k] = dflt(spec);
  return s;
}

export function parse(search, schema) {
  const q = new URLSearchParams(typeof search === "string" ? search.replace(/^\?/, "") : search || "");
  const state = defaults(schema);
  for (const [k, spec] of Object.entries(schema)) {
    if (!q.has(k)) continue;
    const raw = q.get(k) ?? "";
    if (spec.type === "list") {
      const vals = [...new Set(raw.split(",").map((v) => v.trim()).filter(Boolean))].filter((v) => valid(spec, v));
      state[k] = vals.sort();
    } else if (spec.type === "bool") {
      if (raw === "1" || raw === "true") state[k] = true;
      else if (raw === "0" || raw === "false") state[k] = false;
    } else if (spec.type === "text") {
      state[k] = raw.trim().slice(0, spec.max || 100);
    } else {
      if (raw && valid(spec, raw)) state[k] = raw;
    }
  }
  return state;
}

const same = (a, b) => (Array.isArray(a) && Array.isArray(b) ? a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]) : a === b);

export function serialize(state, schema) {
  const out = [];
  for (const [k, spec] of Object.entries(schema)) {
    let v = state[k];
    if (v === undefined || v === null || same(v, dflt(spec))) continue;
    if (spec.type === "list") {
      if (!Array.isArray(v) || !v.length) continue;
      out.push(`${k}=${[...new Set(v)].sort().map(encodeURIComponent).join(",")}`);
    } else if (spec.type === "bool") {
      out.push(`${k}=${v ? 1 : 0}`);
    } else if (spec.type === "text") {
      v = String(v).trim();
      if (v) out.push(`${k}=${encodeURIComponent(v)}`);
    } else {
      out.push(`${k}=${encodeURIComponent(v)}`);
    }
  }
  return out.length ? `?${out.join("&")}` : "";
}

/** Count active (non-default) filters, optionally only some keys. */
export function activeCount(state, schema, keys = Object.keys(schema)) {
  let n = 0;
  for (const k of keys) {
    const spec = schema[k]; if (!spec) continue;
    const v = state[k];
    if (spec.type === "list") n += Array.isArray(v) ? v.length : 0;
    else if (!same(v, dflt(spec)) && v !== "" && v != null) n += 1;
  }
  return n;
}

/** item: plain object of card data, e.g. { p: "scw", kg: "talks", h: "otr", free: true, q: "normalized text" }.
 *  A list filter matches when the item's value (string or array) shares any selected value; a text filter
 *  matches when every term occurs in item.q (or the spec's field); a bool filter requires a truthy field. */
export function matches(item, state, schema) {
  for (const [k, spec] of Object.entries(schema)) {
    if (spec.match === false) continue;
    const v = state[k];
    const field = spec.field || k;
    const have = item[field];
    if (typeof spec.test === "function") { if (!spec.test(item, v, state)) return false; continue; }
    if (spec.type === "list") {
      if (!v || !v.length) continue;
      const hv = Array.isArray(have) ? have : have == null ? [] : [have];
      if (!hv.some((x) => v.includes(String(x)))) return false;
    } else if (spec.type === "bool") {
      if (v && !same(v, dflt(spec)) && !have) return false;
    } else if (spec.type === "text") {
      if (!v) continue;
      const hay = norm(have ?? item.q ?? "");
      if (!norm(v).split(/\s+/).filter(Boolean).every((t) => hay.includes(t))) return false;
    } else if (v != null && !same(v, dflt(spec)) && String(have) !== String(v)) {
      return false;
    }
  }
  return true;
}
