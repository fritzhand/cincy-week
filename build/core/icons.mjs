/* ============================================================
   build/core/icons.mjs · OWNER: Agent A (core engine)
   The inline SVG sprite every page carries once (DESIGN.md §7):
   - stroke icons   #i-<name>   24 grid, 2px, round caps; color = currentColor
   - program bullets #b-<prog>  letter + shape + ink, painted only through
                                custom properties (they theme inside <use>)
   - the wordmark   #wm         outlined "Cincy Week", fill = currentColor
   Use icon(name) and bullet(prog) in markup; never paste raw SVG paths.
   To add an icon: add it to ICONS (the build fails on an unknown name).
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M16.2 16.2 21 21"/>',
  star: '<path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M20 14.6A8 8 0 0 1 9.4 4a7.6 7.6 0 1 0 10.6 10.6z"/>',
  home: '<path d="M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="1"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  map: '<path d="M9 4.5 3.5 6.5v13l5.5-2 6 2 5.5-2v-13l-5.5 2z"/><path d="M9 4.5v13M15 6.5v13"/>',
  pin: '<path d="M12 21s-6.5-5.9-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15.1 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  users: '<circle cx="9" cy="8.5" r="3.3"/><path d="M3 20c.6-3.4 3-5.3 6-5.3s5.4 1.9 6 5.3M15.5 5.3a3.3 3.3 0 0 1 0 6.4M17.5 14.9c1.9.6 3 2.3 3.4 5.1"/>',
  light: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.9 10.6c.6.6.9 1.3.9 2.2V16h6v-.2c0-.9.3-1.6.9-2.2A6 6 0 0 0 12 3z"/>',
  brush: '<path d="M14.5 4.5l5 5-7.8 7.8-5-5z"/><path d="M6.7 12.3 4.5 14.5c-1.3 1.3-.9 3.4-2 4.5 2.7.9 5.3.2 6.6-1.1l2.1-2.1"/>',
  projector: '<rect x="3" y="7.5" width="12" height="9" rx="1"/><path d="M15 10.5l6-3v9l-6-3"/>',
  plates: '<rect x="3.5" y="5" width="7.5" height="6" rx=".5"/><rect x="13" y="5" width="7.5" height="6" rx=".5"/><rect x="3.5" y="13" width="7.5" height="6" rx=".5"/><rect x="13" y="13" width="7.5" height="6" rx=".5"/>',
  bed: '<path d="M3 19V6.5M3 15.5h18V19M21 15.5v-3.2a3 3 0 0 0-3-3h-7v6.2"/><circle cx="7" cy="11.5" r="1.8"/>',
  tram: '<rect x="5.5" y="3.5" width="13" height="13" rx="2"/><path d="M5.5 10h13M8.5 20.5l2-4M15.5 20.5l-2-4"/><path d="M9 13.3h.01M15 13.3h.01"/>',
  hood: '<path d="M12 15.5s-4.5-4.1-4.5-7.8a4.5 4.5 0 0 1 9 0c0 3.7-4.5 7.8-4.5 7.8z"/><path d="M8 18.5c-2.6.4-4.5 1.1-4.5 1.8 0 1 3.8 1.7 8.5 1.7s8.5-.7 8.5-1.7c0-.7-1.9-1.4-4.5-1.8"/>',
  utensils: '<path d="M6.5 3v7.5M4.5 3v4.5a2 2 0 0 0 4 0V3M6.5 10.5V21M17.5 21V3.2c-2 .9-3.5 3.4-3.5 7.3h3.5"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01"/>',
  news: '<path d="M4 5h12.5v14.5a1 1 0 0 1-1 1"/><path d="M16.5 9H20v10a1.5 1.5 0 0 1-3 0M4 5v15.5h11.5M7 9h6.5M7 12.5h6.5M7 16h4"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8h.01"/>',
  "chev-r": '<path d="M9.5 6l6 6-6 6"/>',
  "chev-d": '<path d="M6 9.5l6 6 6-6"/>',
  "arrow-r": '<path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5"/>',
  "arrow-up": '<path d="M12 19V5M6.5 10.5 12 5l5.5 5.5"/>',
  ext: '<path d="M14 4h6v6M20 4l-8.5 8.5M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  sliders: '<path d="M4 7h9M17.5 7H20M4 17h3M11.5 17H20"/><circle cx="15.2" cy="7" r="2.2"/><circle cx="9.2" cy="17" r="2.2"/>',
  share: '<path d="M12 3.5v11M7.5 8 12 3.5 16.5 8M5 12.5v6.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6.5"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14"/>',
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  minus: '<path d="M5.5 12h13"/>',
  locate: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22"/>',
  warn: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.2h.01"/>',
  walk: '<circle cx="13.5" cy="4.5" r="1.7"/><path d="M10 21l2.3-6.2 2.7 2.7V21M8.5 12.5l1.8-4.3 3.4 1.2 1.8 2.8h2.5M12.8 14.3 11 8.6"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5"/><rect x="13.5" y="4" width="6.5" height="6.5"/><rect x="4" y="13.5" width="6.5" height="6.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  github: '<path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>',
  wc: '<circle cx="7" cy="4.8" r="1.9"/><circle cx="17" cy="4.8" r="1.9"/><path d="M5 9h4l-.5 5.5h-3zM7 14.5V21M17 9l-3 7h6zM17 16v5"/>',
  spark: '<path d="M12 2.8l2.1 6.1 6.1 2.1-6.1 2.1-2.1 6.1-2.1-6.1-6.1-2.1 6.1-2.1z"/>',
  drop: '<path d="M12 3.2c3.3 4.2 5.8 7.4 5.8 10.4a5.8 5.8 0 0 1-11.6 0c0-3 2.5-6.2 5.8-10.4z"/>',
  bag: '<path d="M5.2 8.2h13.6l-1.1 12.3H6.3z"/><path d="M8.8 10.5V7a3.2 3.2 0 0 1 6.4 0v3.5"/>',
  eye: '<path d="M2.5 12s3.6-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.6 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
};

/** The five program ids (a closed set) and their bullet geometry: letter + shape (DESIGN.md §3.2). */
export const PROGRAM_IDS = ["caw", "scw", "blink", "fotofocus", "also"];
const SHAPES = {
  square: '<rect x="1.25" y="1.25" width="21.5" height="21.5" rx="2" style="fill:var(--prog-P);stroke:var(--prog-P-edge);stroke-width:1.5"/>',
  circle: '<circle cx="12" cy="12" r="10.75" style="fill:var(--prog-P);stroke:var(--prog-P-edge);stroke-width:1.5"/>',
  diamond: '<path d="M12 .6 23.4 12 12 23.4.6 12z" style="fill:var(--prog-P);stroke:var(--prog-P-edge);stroke-width:1.5;stroke-linejoin:round"/>',
  hexagon: '<path d="M6.2 1.6h11.6L23.3 12l-5.5 10.4H6.2L.7 12z" style="fill:var(--prog-P);stroke:var(--prog-P-edge);stroke-width:1.6;stroke-linejoin:round"/>',
};
export const BULLETS = {
  caw: { shape: "square", letter: "A" },
  scw: { shape: "circle", letter: "S" },
  blink: { shape: "diamond", letter: "B" },
  fotofocus: { shape: "hexagon", letter: "F" },
  also: { shape: "hexagon", letter: "&amp;", italic: true },
};
const bulletSymbol = (id, { shape, letter, italic }) =>
  `<symbol id="b-${id}" viewBox="0 0 24 24">${SHAPES[shape].replace(/P/g, id)}<text x="12" y="${italic ? 16.6 : 16.3}" text-anchor="middle" style="fill:var(--prog-${id}-on);font-family:${italic ? "var(--font-display)" : "var(--font-body)"};font-size:${italic ? 14 : 12}px;font-weight:${italic ? 600 : 760};font-style:${italic ? "italic" : "normal"}">${letter}</text></symbol>`;

const PARTS = JSON.parse(readFileSync(join(ROOT, "site", "img", "brand", "parts.json"), "utf8"));
export const WORDMARK_VIEWBOX = PARTS.wordmark.viewBox;
export const RIVER = PARTS.rule;               // { d, tick, tx }
export const DOWNTOWN_T = PARTS.downtownT;     // 0..1 along the river rule

/** <svg class="i …"><use href="#i-name"/></svg>; unknown names throw (caught by the build as an error). */
export function icon(name, cls = "") {
  if (!ICONS[name]) throw new Error(`unknown icon "${name}"`);
  return `<svg class="i${cls ? " " + cls : ""}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;
}
/** Program bullet: size "" (24), "lg" (32), "xl" (44). Decorative: always next to the program name. */
export function bullet(prog, size = "") {
  if (!BULLETS[prog]) throw new Error(`unknown program "${prog}"`);
  return `<svg class="bullet${size ? " " + size : ""}" aria-hidden="true" focusable="false"><use href="#b-${prog}"/></svg>`;
}
/** The outlined wordmark. With label: role=img "Cincy Week"; without: decorative. */
const [, , WM_W, WM_H] = WORDMARK_VIEWBOX.split(/\s+/).map(Number);
export function wordmark(cls, label = true) {
  return `<svg class="${cls}" viewBox="0 0 ${WM_W} ${WM_H}" ${label ? 'role="img" aria-label="Cincy Week"' : 'aria-hidden="true"'} focusable="false"><use href="#wm" width="${WM_W}" height="${WM_H}"/></svg>`;
}
/** The river rule (DESIGN.md §4.3): the Ohio's real centerline, 4px river green; optional downtown tick. */
export function riverRule(cls = "rr", tick = false) {
  return `<svg class="${cls}" viewBox="0 0 1200 44" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path class="rr-line" d="${RIVER.d}" vector-effect="non-scaling-stroke"/>${tick ? `<path class="rr-tick" d="${RIVER.tick}" vector-effect="non-scaling-stroke"/>` : ""}</svg>`;
}

/** The sprite, emitted once per page right after <body>. */
export function sprite() {
  return `<svg class="sprite" width="0" height="0" aria-hidden="true" focusable="false"><defs>`
    + Object.entries(ICONS).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join("")
    + Object.entries(BULLETS).map(([k, v]) => bulletSymbol(k, v)).join("")
    + `<symbol id="wm" viewBox="${WORDMARK_VIEWBOX}"><g fill="currentColor">${PARTS.wordmark.paths}</g></symbol>`
    + `</defs></svg>`;
}
