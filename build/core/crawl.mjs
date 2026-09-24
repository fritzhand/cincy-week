/* ============================================================
   build/core/crawl.mjs · OWNER: Agent A (core engine)
   Post-render checks over the generated HTML in docs.tmp/ (engine spec
   §4.12). Because it reads the output, it covers every page module
   automatically. It fails on:
   - an internal href/src/srcset that does not resolve to a file, a #fragment that
     is not an id on the target page, a query string a page does not accept, or a
     query value that names nothing (paramValues in build/nav.mjs: p=nope, day=…)
   - a url(…) in assets/site.css or assets/tokens.css that does not resolve (fonts)
   - href="#", http:// links, schemes other than https:, mailto:, tel:
   - external links without target="_blank" rel="noopener" and the
     sr-only "(opens in a new tab)"
   - not exactly one <h1>; a duplicate id; a missing <title>, description,
     canonical (indexable pages) or aria-current in the sidebar (nav pages)
   - an <img> without alt, width or height
   - a color literal in a style attribute or an SVG paint attribute
   - a search.json entry whose URL does not resolve; a sitemap that misses a page
   - a 404 page with a relative link
   It warns on size budgets (engine spec §4.13).
   ============================================================ */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, posix } from "node:path";
import { gzipSync } from "node:zlib";

const TAG = /<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>/g;
const ATTR = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const unent = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

export const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(|\b(?:white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|silver|navy|maroon|teal|olive|lime|aqua|fuchsia|brown|gold|beige|tan|coral|crimson|indigo|violet|magenta|cyan)\b/i;

function attrs(s) {
  const o = {};
  let m;
  ATTR.lastIndex = 0;
  while ((m = ATTR.exec(s))) o[m[1].toLowerCase()] = unent(m[2] ?? m[3] ?? m[4] ?? "");
  return o;
}

function walk(dir, base = "") {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f), rel = base ? `${base}/${f}` : f;
    if (statSync(p).isDirectory()) out.push(...walk(p, rel));
    else out.push(rel);
  }
  return out;
}

/** Strip values that are custom-property references before looking for literals: var(--x-white) is fine. */
const colorIn = (v) => COLOR_LITERAL.test(v.replace(/var\(\s*--[\w-]+\s*(?:,[^)]*)?\)/g, "").replace(/--[\w-]+/g, ""));

export function crawl({ out, pages, config, params, values = {}, navSlugs, searchIndex }) {
  const errors = [], warnings = [];
  const fail = (w, m) => errors.push(`${w}: ${m}`);
  const warn = (w, m) => warnings.push(`${w}: ${m}`);
  const files = walk(out);
  const fileSet = new Set(files);
  const htmlFiles = files.filter((f) => f.endsWith(".html"));
  const prefix = config.pathPrefix;

  /* pass 1: ids per page */
  const docs = new Map();
  for (const f of htmlFiles) {
    const raw = readFileSync(join(out, f), "utf8");
    const html = raw.replace(/(<script\b[^>]*>)[\s\S]*?(<\/script>)/gi, "$1$2").replace(/<!--[\s\S]*?-->/g, "");
    const tags = [];
    let m;
    TAG.lastIndex = 0;
    while ((m = TAG.exec(html))) tags.push({ name: m[1].toLowerCase(), a: attrs(m[2] || ""), index: m.index, end: TAG.lastIndex });
    const ids = new Map();
    for (const t of tags) if (t.a.id !== undefined) ids.set(t.a.id, (ids.get(t.a.id) || 0) + 1);
    docs.set(f, { raw, html, tags, ids });
  }

  const pageParams = (slug) => params[slug] || null;
  /** Resolve an internal URL from a page; returns an error message or null. */
  function check(from, url, { isHtmlLink = true } = {}) {
    if (url === "#") return 'href="#" (use a real target or a <button>)';
    if (/^http:/i.test(url)) return /^http:\/\/(localhost|127\.0\.0\.1)/.test(url) ? null : `insecure link ${url}`;
    if (/^(https:|mailto:|tel:)/i.test(url)) return null;
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return `unsupported link scheme in ${url.slice(0, 40)}`;
    let [pathq, frag] = url.split("#");
    let [p, q] = pathq.split("?");
    let target;
    if (!p) target = from;
    else if (p.startsWith("/")) {
      if (!p.startsWith(prefix)) return `absolute link outside ${prefix}: ${url}`;
      target = p.slice(prefix.length) || "index.html";
    } else target = posix.normalize(posix.join(posix.dirname(from), p));
    if (target.endsWith("/")) target += "index.html";
    if (target.startsWith("..")) return `link climbs out of the site: ${url}`;
    if (!fileSet.has(target)) return `broken link ${url} (no file ${target})`;
    if (q !== undefined && target.endsWith(".html")) {
      const slug = target.replace(/\.html$/, "");
      const ok = pageParams(slug);
      if (!ok) return `${target} does not accept a query string (${url})`;
      for (const k of new URLSearchParams(q).keys()) if (!ok.includes(k)) return `unknown parameter "${k}" for ${target} (allowed: ${ok.join(", ")})`;
      const vals = values[slug] || {};
      for (const [k, v] of new URLSearchParams(q)) if (vals[k] && !vals[k](v)) return `bad value "${v}" for "${k}" in ${url} (it names nothing in the data; see paramValues in build/nav.mjs)`;
    }
    if (frag && target.endsWith(".html")) {
      const d = docs.get(target);
      if (d && !d.ids.has(decodeURIComponent(frag))) return `${url}: no id "${frag}" on ${target}`;
    }
    if (frag && target.endsWith(".svg") && isHtmlLink !== null) {
      const svg = readFileSync(join(out, target), "utf8");
      if (!new RegExp(`\\sid="${frag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`).test(svg)) return `${url}: no id "${frag}" in ${target}`;
    }
    return null;
  }

  const pageBySlug = new Map(pages.map((p) => [p.path, p]));
  for (const [f, d] of docs) {
    const page = pageBySlug.get(f);
    const is404 = f === "404.html";
    for (const [id, n] of d.ids) {
      if (n > 1) fail(f, `duplicate id "${id}"`);
    }
    const h1 = (d.html.match(/<h1[\s>]/g) || []).length;
    if (h1 !== 1) fail(f, `has ${h1} <h1> elements (exactly one required)`);
    if (!/<title>[^<]+<\/title>/.test(d.raw)) fail(f, "missing <title>");
    if (!/<meta name="description" content="[^"]+">/.test(d.raw)) fail(f, "missing meta description");
    if (page && !page.noindex && !/<link rel="canonical" href="https:\/\/[^"]+">/.test(d.raw)) fail(f, "missing canonical link");
    if (page && navSlugs.includes(page.slug)) {
      const sb = d.html.slice(d.html.indexOf('<nav class="sidebar"'), d.html.indexOf("</nav>", d.html.indexOf('<nav class="sidebar"')));
      if (!/aria-current="page"/.test(sb)) fail(f, 'no aria-current="page" in the sidebar');
    }
    // anchors: inner text for external links
    const anchorRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/g;
    let am;
    while ((am = anchorRe.exec(d.html))) {
      const a = attrs(am[1]);
      if (a.href && /^https:/i.test(a.href)) {
        if (a.target !== "_blank" || !/\bnoopener\b/.test(a.rel || "")) fail(f, `external link ${a.href} needs target="_blank" rel="noopener"`);
        if (!/\(opens in a new tab\)/.test(am[2])) fail(f, `external link ${a.href} needs the sr-only "(opens in a new tab)"`);
      }
    }
    for (const t of d.tags) {
      const a = t.a;
      for (const [k, v] of Object.entries(a)) {
        if (k === "style" && colorIn(v)) fail(f, `color literal in style="${v.slice(0, 60)}" (use a token via var())`);
        if (["fill", "stroke", "color", "stop-color", "bgcolor", "flood-color", "lighting-color"].includes(k) && v && !/^(none|currentcolor|inherit|transparent)$/i.test(v) && !/^var\(/.test(v) && !/^url\(/.test(v)) fail(f, `hard-coded color ${k}="${v}" on <${t.name}>`);
      }
      if (t.name === "img") {
        if (a.alt === undefined) fail(f, `<img src="${a.src}"> needs alt (empty when the name is adjacent text)`);
        if (!a.width || !a.height) fail(f, `<img src="${a.src}"> needs width and height`);
      }
      const urls = [];
      if (t.name === "a" && a.href !== undefined) urls.push(["href", a.href]);
      if (t.name === "link" && a.href && !/^https:/.test(a.href)) urls.push(["href", a.href]);
      if (["img", "script", "source", "iframe"].includes(t.name) && a.src) urls.push(["src", a.src]);
      if (["img", "source"].includes(t.name) && a.srcset) for (const c of a.srcset.split(",")) { const u = c.trim().split(/\s+/)[0]; if (u) urls.push(["src", u]); }
      if (t.name === "use" && (a.href || a["xlink:href"])) urls.push(["use", a.href || a["xlink:href"]]);
      if (t.name === "form" && a.action) urls.push(["action", a.action]);
      for (const [kind, u] of urls) {
        if (kind === "use" && u.startsWith("#")) { if (!d.ids.has(u.slice(1))) fail(f, `<use href="${u}">: no symbol with that id on the page`); continue; }
        if (kind === "src" && /^https:\/\/www\.googletagmanager\.com\//.test(u)) continue;
        if (is404 && !/^(https:|mailto:|tel:|#)/.test(u) && !u.startsWith(prefix)) fail(f, `404 links must be absolute (start with ${prefix}): ${u}`);
        const err = check(f, u);
        if (err) fail(f, err);
      }
    }
    // budgets (engine §4.12–4.13): raw for every page; gzipped for home, schedule and person pages
    const kb = Buffer.byteLength(d.raw) / 1024;
    const limit = f === "schedule.html" ? 900 : 350;
    if (kb > limit) warn(f, `${kb.toFixed(0)} KB raw (budget ${limit} KB)`);
    const gzLimit = f === "index.html" ? 120 : f === "schedule.html" ? 220 : f.startsWith("people/") ? 25 : 0;
    if (gzLimit) { const gz = gzipSync(d.raw).length / 1024; if (gz > gzLimit) warn(f, `${gz.toFixed(1)} KB gzipped (budget ${gzLimit} KB)`); }
  }

  /* url(…) in the stylesheets (self-hosted fonts, images) must resolve next to the CSS file */
  for (const css of ["assets/site.css", "assets/tokens.css"]) {
    if (!fileSet.has(css)) { fail(css, "missing"); continue; }
    const src = readFileSync(join(out, css), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of src.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
      const u = m[2].trim();
      if (/^(data:|https:|#)/.test(u)) continue;
      const target = posix.normalize(posix.join(posix.dirname(css), u.split(/[?#]/)[0]));
      if (!fileSet.has(target)) fail(css, `url(${u}) does not resolve (no file ${target})`);
    }
  }

  /* search index entries must resolve */
  for (const e of searchIndex.items) {
    const err = check("index.html", e.u);
    if (err) fail(`assets/data/search.json (${e.k} ${e.id || e.t})`, err);
  }
  /* sitemap covers every indexable page */
  if (fileSet.has("sitemap.xml")) {
    const locs = new Set([...readFileSync(join(out, "sitemap.xml"), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
    for (const p of pages) if (!p.noindex && !locs.has(config.siteBase + (p.path === "index.html" ? "" : p.path))) fail("sitemap.xml", `missing ${p.path}`);
  } else fail("sitemap.xml", "missing");

  /* size budgets on data and assets */
  const size = (rel) => (fileSet.has(rel) ? readFileSync(join(out, rel)) : null);
  const budget = (rel, rawKb, gzKb) => {
    const b = size(rel); if (!b) return;
    const raw = b.length / 1024, gz = gzipSync(b).length / 1024;
    if (rawKb && raw > rawKb) warn(rel, `${raw.toFixed(0)} KB raw (budget ${rawKb} KB)`);
    if (gzKb && gz > gzKb) warn(rel, `${gz.toFixed(0)} KB gzipped (budget ${gzKb} KB)`);
  };
  budget("assets/data/events.json", 600, 120);
  budget("assets/data/search.json", 400, 70);
  budget("assets/site.css", null, 45);
  budget("assets/map/basemap.svg", null, 60);
  for (const f of files.filter((x) => /^assets\/js\/features\/[^/]+\.js$/.test(x))) budget(f, null, 20);
  {
    const core = files.filter((x) => x === "assets/js/main.js" || /^assets\/js\/core\/[^/]+\.js$/.test(x)).sort();
    const gz = gzipSync(Buffer.concat(core.map((x) => readFileSync(join(out, x))))).length / 1024;
    if (gz > 30) warn("assets/js/main.js + core/", `${gz.toFixed(1)} KB gzipped (budget 30 KB)`);
  }
  const total = files.reduce((n, f) => n + statSync(join(out, f)).size, 0) / 1024 / 1024;
  if (total > 80) warn("docs/", `${total.toFixed(1)} MB total (budget 80 MB)`);
  return { errors, warnings, files: files.length, totalMb: total };
}

export { existsSync };
