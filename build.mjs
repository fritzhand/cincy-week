#!/usr/bin/env node
/* ============================================================
   build.mjs · OWNER: Agent A (core engine)
   data/*.json + site/ + build/ → docs/ (GitHub Pages serves main → /docs,
   or the gh-pages branch via .github/workflows/deploy-pages.yml).

   Zero dependencies. Node ≥ 18.   Usage: node build.mjs
   CW_OUT=<dir> node build.mjs builds into <dir> (and <dir>.tmp) instead of docs/, so agents
   working in parallel never write the shared docs/ (see build/CONTRACTS.md).
   1. load + validate config and data (build/core/load.mjs, schema.mjs)
   2. check tokens.css and the CSS partials (build/core/write.mjs)
   3. run every page module in build/pages (pages, search, data)
   4. stop here, listing every problem, if anything failed (docs/ untouched)
   5. render into docs.tmp/ (build/core/shell.mjs), crawl it (crawl.mjs)
   6. swap docs.tmp/ → docs/ atomically
   docs/ is GENERATED: never hand-edit it.
   ============================================================ */
import { readFileSync, readdirSync, existsSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as U from "./build/core/util.mjs";
import * as I from "./build/core/icons.mjs";
import * as C from "./build/core/components.mjs";
import * as T from "./build/core/time.mjs";
import * as SEO from "./build/core/seo.mjs";
import { load, validateConfig } from "./build/core/load.mjs";
import { makeShell } from "./build/core/shell.mjs";
import { makeImages } from "./build/core/images.mjs";
import { buildIndex } from "./build/core/search.mjs";
import { crawl } from "./build/core/crawl.mjs";
import { readTokens, buildCss, makeOut, copyAssets, hashDir, swap } from "./build/core/write.mjs";
import { clientData } from "./build/core/client-data.mjs";
import { NAV_SLUGS, NAV, PROGRAM_PAGES, DETAIL_FOLDERS, PARAMS, paramValues } from "./build/nav.mjs";
import { makeEventCards } from "./build/components/event-card.mjs";
import { makePersonCards } from "./build/components/person-card.mjs";
import { makeVenueCards } from "./build/components/venue-card.mjs";
import { makeWorkCards } from "./build/components/work-card.mjs";
import { makeOrgLogos } from "./build/components/org-logo.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = join(ROOT, "site");
const OUT = process.env.CW_OUT ? resolve(ROOT, process.env.CW_OUT) : join(ROOT, "docs"), TMP = `${OUT}.tmp`;
if (process.env.CW_OUT && (OUT === ROOT || [SITE, join(ROOT, "build"), join(ROOT, "data"), join(ROOT, "tests"), join(ROOT, "scripts")].some((d) => OUT === d || OUT.startsWith(d + "/")))) {
  console.error(`✗ CW_OUT=${process.env.CW_OUT} would overwrite the sources: use a directory like .cache/out-<you>`);
  process.exit(1);
}
const errors = [], warnings = [], groups = new Map();
const fail = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg, group) => { if (!group) return warnings.push(`${where}: ${msg}`); if (!groups.has(group)) groups.set(group, []); groups.get(group).push(where); };
function stop() {
  console.error(`\n✗ BUILD FAILED — ${errors.length} error(s):\n`);
  for (const e of errors) console.error(`  • ${e}`);
  rmSync(TMP, { recursive: true, force: true });
  process.exit(1);
}

/* 1. config + data */
let config = {};
try { config = JSON.parse(readFileSync(join(ROOT, "site.config.json"), "utf8")); } catch (e) { fail("site.config.json", `invalid JSON: ${e.message}`); stop(); }
validateConfig(config, fail);
if (errors.length) stop();
let db;
try { db = load({ dataDir: join(ROOT, "data"), siteDir: SITE, config, fail, warn }); }
catch (e) { fail("build/core/load.mjs", errors.length ? `stopped early (${e.message}): fix the data errors above first` : e.stack || e.message); stop(); }
for (const p of db.programs) if (p.slug && !PROGRAM_PAGES.some((x) => x.slug === p.slug)) fail(`data/programs.json#${p.id}.slug`, `"${p.slug}" is not a program page in build/nav.mjs (PROGRAM_PAGES)`);
for (const pp of PROGRAM_PAGES) if (!db.byId.program.get(pp.programs[0])) warn("build/nav.mjs", `program page ${pp.slug} has no program record "${pp.programs[0]}"`);
for (const f of ["people", "venues"]) for (const r of db[f]) if (r.id === "index") fail(`data/${f}.json#index`, `id "index" would shadow ${f}.html`);

/* 2. tokens + CSS */
const tokens = readTokens(SITE, db.programs.map((p) => p.id), fail);
const css = buildCss(SITE, fail, warn);
if (errors.length) stop(); // data, tokens and CSS first: page modules only ever see valid data
const featureFiles = new Set(existsSync(join(SITE, "js", "features")) ? readdirSync(join(SITE, "js", "features")).filter((f) => f.endsWith(".js")).map((f) => f.slice(0, -3)) : []);

/* 3. page modules */
const images = makeImages(db);
const buildDate = T.fmtDayLong(T.nyParts(process.env.SOURCE_DATE_EPOCH ? Number(process.env.SOURCE_DATE_EPOCH) * 1000 : Date.now()).date) + `, ${new Date(process.env.SOURCE_DATE_EPOCH ? Number(process.env.SOURCE_DATE_EPOCH) * 1000 : Date.now()).getUTCFullYear()}`;
const ctx = {
  config, db, fail, warn, buildDate, nav: { NAV, NAV_SLUGS, PROGRAM_PAGES },
  h: { ...U, icon: I.icon, bullet: I.bullet, wordmark: I.wordmark, riverRule: I.riverRule, fmtDay: T.fmtDay, fmtDayLong: T.fmtDayLong, fmtDate: T.fmtDate, fmtTime: T.fmtTime, fmtRange: T.fmtRange, fmtDateRange: T.fmtDateRange, fmtDowRange: T.fmtDowRange, isoLocal: T.isoLocal, url: (root, p) => root + p },
  c: { ...C, avatar: (root, person, size = "", opts = {}) => images.mug(root, person, { size, ...opts }) }, img: images, seo: SEO, time: T,
};
ctx.cards = {};
Object.assign(ctx.cards, makeEventCards(ctx), makePersonCards(ctx), makeVenueCards(ctx), makeWorkCards(ctx), makeOrgLogos(ctx));
ctx.map = { miniMap: ctx.cards.miniMap };

const modules = readdirSync(join(ROOT, "build", "pages")).filter((f) => f.endsWith(".mjs") && !f.startsWith("_")).sort();
const pages = [], searchEntries = [], dataOut = { ...clientData(db, images) };
const producedBy = new Map();
for (const f of modules) {
  const name = f.slice(0, -4);
  let mod;
  try { mod = await import(pathToFileURL(join(ROOT, "build", "pages", f)).href); } catch (e) { fail(`build/pages/${f}`, `failed to load: ${e.stack || e.message}`); continue; }
  if (typeof mod.pages !== "function") { fail(`build/pages/${f}`, "must export pages(ctx)"); continue; }
  try {
    for (const p of mod.pages(ctx) || []) {
      const where = `build/pages/${f} → ${p?.path}`;
      if (!p || typeof p.path !== "string" || !/^([a-z0-9-]+\/)?[a-z0-9][a-z0-9-]*\.html$/.test(p.path)) { fail(`build/pages/${f}`, `bad page path ${JSON.stringify(p?.path)}`); continue; }
      if (producedBy.has(p.path)) { fail(where, `also produced by build/pages/${producedBy.get(p.path)}`); continue; }
      producedBy.set(p.path, f);
      const slug = p.path.replace(/\.html$/, "");
      const folder = slug.includes("/") ? slug.split("/")[0] : null;
      if (!NAV_SLUGS.includes(slug) && !(folder && DETAIL_FOLDERS[folder])) fail(where, "is neither a nav page (build/nav.mjs) nor a detail page (people/, venues/): an orphan page");
      if (!p.title || !p.description) fail(where, "needs a title and a description");
      if (U.HTML_IN_TEXT.test(`${p.title} ${p.description}`)) fail(where, "title and description are plain text");
      for (const feat of p.features || []) if (!featureFiles.has(feat)) fail(where, `feature "${feat}" has no site/js/features/${feat}.js`);
      pages.push({ ...p, slug, root: folder ? "../" : "", navLabel: NAV_SLUGS.includes(slug) ? (NAV.flatMap((g) => g.items || []).find((i) => i.slug === slug)?.label || PROGRAM_PAGES.find((x) => x.slug === slug)?.label) : null });
    }
    if (typeof mod.search === "function") searchEntries.push([name, mod.search(ctx)]);
    if (typeof mod.data === "function") for (const [k, v] of Object.entries(mod.data(ctx) || {})) { if (dataOut[k]) fail(`build/pages/${f}`, `data output ${k} is already written`); else dataOut[k] = v; }
  } catch (e) { fail(`build/pages/${f}`, e.stack || e.message); }
}
for (const s of NAV_SLUGS) if (!producedBy.has(`${s}.html`)) fail("build/nav.mjs", `nav page ${s}.html is not produced by any page module`);
const nf = SEO.notFoundPage();
pages.push({ ...nf, root: config.pathPrefix });
if (errors.length) stop();

/* 4. render into docs.tmp/ */
const searchIndex = buildIndex(searchEntries, pages, fail);
if (errors.length) stop();
const out = makeOut(TMP);
const dataJson = Object.fromEntries(Object.entries({ ...dataOut, "assets/data/search.json": searchIndex }).map(([k, v]) => [k, JSON.stringify(v)]));
const hashes = { tokens: U.hash8(tokens.out), css: U.hash8(css), js: hashDir(join(SITE, "js")), data: U.hash8(Object.values(dataJson).join("")) };
const ogFiles = copyAssets(out, SITE);
const shell = makeShell({ config, db, tokens, hashes, hasOg: ogFiles.has("og.png"), ogFiles });
for (const p of pages) {
  try { out.write(p.path, shell(p)); } catch (e) { fail(`build/pages/${producedBy.get(p.path) || "core"} → ${p.path}`, e.stack || e.message); }
}
if (errors.length) stop();
for (const [k, v] of Object.entries(dataJson)) out.write(k, v);
out.write("assets/tokens.css", tokens.out);
out.write("assets/site.css", css);
out.write(".nojekyll", "");
out.write("robots.txt", SEO.robots(config.siteBase));
out.write("sitemap.xml", SEO.sitemap(config.siteBase, pages));

/* 5. crawl the output */
const report = crawl({ out: TMP, pages, config, params: PARAMS, values: paramValues(db), navSlugs: NAV_SLUGS, searchIndex });
for (const e of report.errors) errors.push(e);
for (const w of report.warnings) warnings.push(w);
if (errors.length) stop();

/* 6. swap + report */
swap(TMP, OUT);
for (const [g, where] of groups) warnings.push(`${where.length} × ${g}: ${where.slice(0, 3).join(", ")}${where.length > 3 ? ", …" : ""}`);
if (warnings.length) { console.warn(`\n⚠ ${warnings.length} warning(s):`); for (const w of warnings) console.warn(`  • ${w}`); }
console.log(`\n✓ built ${pages.length} pages → ${process.env.CW_OUT ? OUT.replace(ROOT + "/", "") + "/" : "docs/"} (${db.counts.events} events, ${db.counts.people} people, ${db.counts.venues} venues, ${db.counts.works} works; ${report.files} files, ${report.totalMb.toFixed(1)} MB)`);
