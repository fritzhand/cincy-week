/* ============================================================
   build/pages/_directory.mjs · OWNER: Agent F (directory: people, art, partners)
   Helper (not a page module): the filter-bar markup that site/js/features/directory.js drives.
   Everything here is .js-only except the A–Z index, whose letters are plain anchors without JS
   (they jump to the first name under each letter) and filters with JS (?l=A).

   Markup contract (directory.js, engine §4.8):
     [data-dir]                     a list; its children with data-q are the items
     [data-dir-group]               hidden when it holds no visible item (sections, tiers)
     input[data-filter-q]           search (terms AND-match the item's data-q, accent-folded)
     [data-filter-group="key"]      chips: button[data-value] toggles (aria-pressed); several values in a
                                    group match any of them; groups combine with AND. The item's data-<key>
                                    lists its values, split on spaces, or on data-sep ("|") when values
                                    hold spaces. data-single = one value at a time. [hidden] groups are
                                    URL-only filters (deep links), shown as active chips.
     nav[data-az]                   A–Z: a[data-value] (key from data-key, default "l")
     select[data-filter="key"]      (kept from the first version) the item's data-<key> contains the value
     [data-result-count]            "Showing <b>n</b> of N <noun>"
     [data-active-chips]            removable chips for every active filter, then "Clear all"
     [data-dir-empty]               shown when nothing matches; [data-dir-clear] inside clears everything
     [data-dir-views] button[data-view]  Grid/Map toggle (?view=); [data-dir-map] is the map's box
   ============================================================ */
import { esc, attr } from "../core/util.mjs";
import { icon, bullet } from "../core/icons.mjs";

/** A search field (the toolbar's own markup, so every directory looks the same). */
export const searchField = (label, placeholder) =>
  `<label class="field dir-search">${icon("search")}<span class="sr-only">${esc(label)}</span><input type="search" name="q" placeholder="${attr(placeholder)}" autocomplete="off" enterkeyhint="search" data-filter-q></label>`;

/** A chip group: options = [{ v, label, count, prog }]. */
export function filterGroup({ key, label, options, hidden = false, sep = "", single = false, id = "" }) {
  const gid = id || `fg-${key}`;
  const chips = options.map((o) => `<button class="chip" type="button" data-value="${attr(o.v)}" aria-pressed="false"${o.prog ? ` data-prog="${o.prog}"` : ""}>${o.prog ? bullet(o.prog) : ""}<span>${esc(o.label)}</span>${o.count != null ? ` <span class="n">${o.count}</span>` : ""}${icon("check", "ck")}</button>`).join("");
  return `<div class="dir-group" role="group" aria-labelledby="${gid}" data-filter-group="${attr(key)}"${sep ? ` data-sep="${attr(sep)}"` : ""}${single ? " data-single" : ""}${hidden ? " hidden" : ""}><span class="dir-glabel label" id="${gid}">${esc(label)}</span><div class="dir-chips">${chips}</div></div>`;
}

/** A–Z index: letters with no item are disabled. `anchors` maps a letter to the id of its first item. */
export function azNav(anchors, { key = "l", label = "Jump to letter" } = {}) {
  const letters = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];                  // names starting with a digit sort first
  return `<nav class="az dir-az" aria-label="${attr(label)}" data-az data-key="${attr(key)}">${letters.map((L) => anchors.has(L)
    ? `<a href="#${attr(anchors.get(L))}" data-value="${attr(L)}">${L === "#" ? '<span aria-hidden="true">#</span><span class="sr-only">Numbers and symbols</span>' : L}</a>`
    : `<a aria-disabled="true" data-value="${attr(L)}">${L === "#" ? '<span aria-hidden="true">#</span><span class="sr-only">Numbers and symbols</span>' : L}</a>`).join("")}</nav>`;
}

/** The status line: live count + active filter chips. */
export const dirStatus = (n, noun) => `<div class="dir-status"><p class="result-count" role="status" aria-live="polite" data-result-count data-noun="${attr(noun)}">Showing <b>${n}</b> of ${n} ${esc(noun)}</p><div class="dir-active chip-row" data-active-chips hidden></div></div>`;

/** The empty state, hidden until nothing matches. */
export function dirEmpty(c, { title = "Nothing matches these filters", body = "Try a shorter search, or clear a filter.", glyph = "search" } = {}) {
  return c.emptyState({ title, body, glyph, attrs: "data-dir-empty hidden", action: `<button class="btn btn-secondary" type="button" data-dir-clear>${icon("x")}Clear all filters</button>` });
}

/** Grid/Map view toggle (only when the map engine is real). */
export const viewToggle = (views) => `<span class="view-toggle" role="group" aria-label="View" data-dir-views>${views.map((x) => `<button type="button" data-view="${attr(x.v)}" aria-pressed="${x.pressed ? "true" : "false"}">${x.icon ? icon(x.icon) : ""}${esc(x.label)}</button>`).join("")}</span>`;
