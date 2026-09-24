/* ============================================================
   build/core/components.mjs · OWNER: Agent A (core engine)
   Shared, data-agnostic page pieces (engine spec §5.2 `ctx.c`). Every
   function returns an HTML string and takes `root` first when it links.
   Markup follows DESIGN.md §9 and the class vocabulary in 20-content.css.
   Domain renderers (event, person, venue, work, org cards) live in
   build/components/* and are owned by the domain agents.
   ============================================================ */
import { esc, attr, extLink, hostOf } from "./util.mjs";
import { icon, bullet, BULLETS } from "./icons.mjs";

/** Display names for program marks. `name` is the full name, `short` goes in badges and chips. */
export const PROGRAM_LABELS = {
  caw: { name: "Cincinnati Art Week", short: "Art Week" },
  scw: { name: "StartupCincy Week", short: "StartupCincy" },
  blink: { name: "BLINK", short: "BLINK" },
  fotofocus: { name: "FotoFocus Biennial", short: "FotoFocus" },
  also: { name: "More happenings", short: "More" },
};
export const progName = (id, short = false) => (PROGRAM_LABELS[id] ? PROGRAM_LABELS[id][short ? "short" : "name"] : id);

/** Breadcrumbs: [[label, href|null], …]; the last item is the current page. */
export function crumbs(root, items) {
  if (!items || !items.length) return "";
  return `<nav class="crumbs" aria-label="Breadcrumb">${items.map(([t, h], i) => (h && i < items.length - 1
    ? `<a href="${attr(root + h)}">${esc(t)}</a>`
    : `<span aria-current="page">${esc(t)}</span>`)).join('<span class="sep" aria-hidden="true">/</span>')}</nav>`;
}

/** Section numeral (1–5): numbers mean sections, letters mean programs. */
export const secNum = (n) => (n ? `<span class="sec-num" aria-hidden="true">${esc(n)}</span>` : "");

/** Page head: kicker (with section numeral or program bullet), the page's only <h1>, lede or dek, chips.
 *  { kicker, num, title, titleHtml, lede, dek, chips, prog, cls, after } */
export function pageHead({ kicker = "", num = null, title, titleHtml = "", lede = "", dek = "", chips = "", prog = null, cls = "", after = "" }) {
  const k = kicker || num ? `<p class="kicker label">${prog ? bullet(prog, "lg") : secNum(num)}<span>${esc(kicker)}</span></p>` : "";
  return `<header class="page-head${prog ? " prog-head" : ""}${cls ? " " + cls : ""}"${prog ? ` data-prog="${prog}"` : ""}>
${k}<h1>${titleHtml || esc(title)}</h1>
${lede ? `<p class="lede">${esc(lede)}</p>` : ""}${dek ? `<p class="dek">${esc(dek)}</p>` : ""}${chips ? `<div class="head-chips">${chips}</div>` : ""}${after}
</header>`;
}

/** "At a glance" facts box: rows = [[label, valueHtml]] (values are HTML: escape text yourself). */
export function facts(root, rows, { label = "At a glance" } = {}) {
  const r = rows.filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (!r.length) return "";
  return `<dl class="facts" aria-label="${attr(label)}">${r.map(([k, v]) => `<div class="fact"><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join("")}</dl>`;
}

/** A section under an Oxford rule: { id, title, kicker, num, icon, more: { href, label }, body, anchor, root }
 *  (engine §5.2 names { id, title, icon, body }; `icon` is an icons.mjs name shown before the title). */
export function section({ id, title, kicker = "", num = null, icon: ic = null, more = null, body = "", anchor = false, cls = "", root = "" }) {
  const hid = `${id}-h`;
  return `<section class="section${cls ? " " + cls : ""}" id="${attr(id)}" aria-labelledby="${hid}">
<div class="sec-head oxford">${kicker || num ? `<p class="sec-kicker label">${secNum(num)}${esc(kicker)}</p>` : ""}<h2 id="${hid}">${ic ? icon(ic, "sec-icon") : ""}${esc(title)}${anchor ? ` <a class="h-anchor" href="#${attr(id)}" aria-label="Link to this section">#</a>` : ""}</h2>${more ? `<a class="more" href="${attr(root + more.href)}">${esc(more.label)}${icon("arrow-r")}</a>` : ""}</div>
${body}
</section>`;
}

const CALLOUT = { "": ["Good to know", "info"], tip: ["From the desk", "info"], warn: ["Heads up", "warn"], org: ["From the organizers", "news"] };
/** Callout (a boxed sidebar with a flag): tone "" | "tip" | "warn" | "org"; html is trusted HTML.
 *  tone "org" needs { prog, cite } and quotes the organizers' own words. */
export function callout(tone, html, { flag, prog = null, cite = "" } = {}) {
  const [f, ic] = CALLOUT[tone] || CALLOUT[""];
  return `<aside class="callout${tone ? " tone-" + tone : ""}"${prog ? ` data-prog="${prog}"` : ""}><span class="flag label">${icon(ic)}${esc(flag || f)}</span>${tone === "org" ? `<blockquote>${html}</blockquote>${cite ? `<cite>${cite}</cite>` : ""}` : html}</aside>`;
}

/** A chip: a link when href is given, else a toggle button ({ pressed }). */
export function chip(label, href, { count = null, pressed = null, prog = null, root = "", attrs = "", check = true } = {}) {
  const inner = `${prog ? bullet(prog) : ""}<span>${esc(label)}</span>${count !== null ? `<span class="n">${esc(count)}</span>` : ""}${check && pressed !== null ? icon("check", "ck") : ""}`;
  const p = prog ? ` data-prog="${prog}"` : "";
  if (href) return `<a class="chip" href="${attr(root + href)}"${p}${attrs ? " " + attrs : ""}>${inner}</a>`;
  return `<button class="chip" type="button"${p}${pressed !== null ? ` aria-pressed="${pressed ? "true" : "false"}"` : ""}${attrs ? " " + attrs : ""}>${inner}</button>`;
}

/** Program badge: bullet + short program name in its text ink (engine contract .prog-badge[data-prog]). */
export const progBadge = (id, { short = true } = {}) => `<span class="prog-badge" data-prog="${id}">${bullet(id)}${esc(progName(id, short))}</span>`;
/** Program dot: the shape alone. Always next to the program's name. */
export const progDot = (id) => `<span class="prog-dot" data-prog="${id}" aria-hidden="true"></span>`;

/** Star button (engine contract): 44px, the label names the item. kind "e" (event) or "w" (work). */
export function starButton(id, title, { kind = "e", cls = "" } = {}) {
  return `<button class="star${cls ? " " + cls : ""}" type="button" data-star="${attr(id)}"${kind === "w" ? ' data-star-kind="w"' : ""} aria-pressed="false" aria-label="Add “${attr(title)}” to My Plan">${icon("star")}</button>`;
}

/** State badge: kind live | soon | started | past | free | plan | warn | out | unconfirmed | "" */
export const badge = (kind, text) => `<span class="badge${kind ? " badge-" + kind : ""}">${esc(text)}</span>`;

/** Empty state: a dashed sheet with a halftone glyph, a title, one line of help and an action (HTML). */
export function emptyState({ title, body = "", action = "", glyph = "search", prog = null, attrs = "" }) {
  return `<div class="empty-state"${prog ? ` data-prog="${prog}"` : ""}${attrs ? " " + attrs : ""}><span class="halftone" aria-hidden="true">${icon(glyph)}</span><h3>${esc(title)}</h3>${body ? `<p>${esc(body)}</p>` : ""}${action}</div>`;
}

/** Filter toolbar (JS-only controls; hidden without JS). spec = { search: { label, placeholder }, selects: [{ name, label, options: [[v, l]] }], views: [{ v, label, icon, pressed }] } */
export function toolbar(spec = {}) {
  const s = spec.search ? `<label class="field">${icon("search")}<span class="sr-only">${esc(spec.search.label || "Search")}</span><input type="search" name="q" placeholder="${attr(spec.search.placeholder || "Search")}" autocomplete="off" data-filter-q></label>` : "";
  const sel = (spec.selects || []).map((x) => `<label><span class="sr-only">${esc(x.label)}</span><select class="select" name="${attr(x.name)}" data-filter="${attr(x.name)}"><option value="">${esc(x.label)}: all</option>${x.options.map(([v, l]) => `<option value="${attr(v)}">${esc(l)}</option>`).join("")}</select></label>`).join("");
  const v = spec.views ? `<span class="view-toggle" role="group" aria-label="View">${spec.views.map((x) => `<button type="button" data-view="${attr(x.v)}" aria-pressed="${x.pressed ? "true" : "false"}">${x.icon ? icon(x.icon) : ""}${esc(x.label)}</button>`).join("")}</span>` : "";
  return `<div class="toolbar js-only">${s}${sel}${v}</div>`;
}
/** Live result count: "Showing <b>n</b> of N" (updated by JS; the server writes the full count). */
export const resultCount = (n, total, noun = "") => `<p class="result-count" role="status" aria-live="polite" data-result-count${noun ? ` data-noun="${attr(noun)}"` : ""}>Showing <b>${n}</b> of ${total}${noun ? " " + esc(noun) : ""}</p>`;

/** Previous / Next: prev and next are { href, label } or null. */
export function pagenav(root, prev, next) {
  if (!prev && !next) return "";
  const a = (x, cls, word) => (x ? `<a class="${cls}" href="${attr(root + x.href)}"><span class="label">${word}</span><strong>${esc(x.label)}</strong></a>` : "<span></span>");
  return `<nav class="pagenav" aria-label="Previous and next page">${a(prev, "prev", "Previous")}${a(next, "next", "Next")}</nav>`;
}

/** TOC rail (≥ 1280px) from [[id, label]]; the shell places it. */
export function toc(items) {
  if (!items || items.length < 2) return "";
  return `<aside class="toc" aria-label="On this page"><span class="label">On this page</span>${items.map(([id, l]) => `<a href="#${attr(id)}">${esc(l)}</a>`).join("")}</aside>`;
}
/** Collapsed "On this page" for narrow screens (long pages only). */
export function tocMobile(items) {
  if (!items || items.length < 5) return "";
  return `<details class="toc-mobile"><summary>${icon("list")}<span>On this page</span>${icon("chev-d", "chev")}</summary><ul>${items.map(([id, l]) => `<li><a href="#${attr(id)}">${esc(l)}</a></li>`).join("")}</ul></details>`;
}

/** External key links as secondary buttons: [{ href, label }]. */
export function keylinks(root, links) {
  const l = links.filter((x) => x && x.href);
  if (!l.length) return "";
  return `<p class="keylinks">${l.map((x) => extLink(x.href, `${esc(x.label || hostOf(x.href))}${icon("ext")}`, "btn btn-secondary btn-sm")).join("")}</p>`;
}

/** Source line that closes every fact-heavy block: urls = [url…] (deduped, shown by host). */
export function sourceLine(urls, { label = "Source", note = "" } = {}) {
  const u = [...new Set(urls.filter(Boolean))];
  if (!u.length) return "";
  return `<p class="source-line">${icon("info")}<span>${esc(label)}${u.length > 1 ? "s" : ""}: ${u.map((x) => extLink(x, esc(hostOf(x) || x))).join(" · ")}</span>${note ? `<span>${esc(note)}</span>` : ""}</p>`;
}

/** The honest placeholder every stub page shows until its owner lands it. */
export function placeholder(what, owner) {
  return callout("", `<p>${esc(what)}</p><p class="faint">This part of the guide is being built${owner ? ` (${esc(owner)})` : ""}. Everything shown here comes from the data files, with its source linked.</p>`, { flag: "Being built" });
}

export const programIds = Object.keys(BULLETS);
