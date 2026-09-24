/* ============================================================
   build/core/search.mjs · OWNER: Agent A (core engine)
   Merges every page module's search(ctx) entries into
   docs/assets/data/search.json (engine spec §4.9), adds one "pg" entry per
   nav page, validates entries, and de-duplicates by kind + id.
   Entry: { k, id, t, s?, u, p?, g?, i?, st?, en? } — u is root-relative and
   is checked by the crawler like any link.
   ============================================================ */
import { KINDS } from "../../site/js/lib/search.js";

const KEYS = new Set(["k", "id", "t", "s", "u", "p", "g", "i", "st", "en"]);

export function buildIndex(entriesByModule, pages, fail) {
  const items = [];
  const seen = new Set();
  for (const [mod, entries] of entriesByModule) {
    if (!Array.isArray(entries)) { fail(`build/pages/${mod}.mjs`, "search() must return an array"); continue; }
    for (const e of entries) {
      const where = `build/pages/${mod}.mjs search()`;
      if (!e || typeof e !== "object") { fail(where, "entry is not an object"); continue; }
      for (const k of Object.keys(e)) if (!KEYS.has(k)) fail(where, `entry ${e.id || "?"}: unknown key "${k}"`);
      if (!KINDS[e.k]) fail(where, `entry ${e.id || "?"}: unknown kind "${e.k}"`);
      if (!e.t || typeof e.t !== "string") fail(where, `entry ${e.id || "?"}: needs a title "t"`);
      if (!e.u || typeof e.u !== "string" || /^(\/|https?:)/.test(e.u)) fail(where, `entry ${e.id || "?"}: "u" must be a root-relative URL`);
      const key = `${e.k}:${e.id || e.u}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const clean = {};
      for (const k of KEYS) if (e[k] !== undefined && e[k] !== null && e[k] !== "") clean[k] = e[k];
      items.push(clean);
    }
  }
  const covered = new Set(items.map((e) => e.u));
  for (const p of pages) {
    if (!p.navLabel || covered.has(p.path)) continue;
    items.push({ k: "pg", id: p.slug, t: p.navLabel, s: p.description, u: p.path });
  }
  return { v: 1, items };
}
