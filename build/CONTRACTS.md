# Cincy Week: contracts for parallel agents

This is the reference that agents **C** (data), **D** (schedule and plan), **E** (map, venues and visit),
**F** (directory and images) and **G** (home, programs and info) code against. It was checked against the
landed engine (A) on 2026-09-24. `CLAUDE.md` is the operating manual: rules, ownership and data rules.
This file gives the exact APIs. When the code and this file disagree, the code wins. Report the mismatch.

Contracts are **only extended, never renamed**. Changes to `build/core/*`, `build/nav.mjs`,
`site/js/main.js`, `site/js/core/*` (except the dialog files) and the A partials go through A. Token
changes go through B.

---

## 1. Working in parallel without collisions

| Do | Don't |
|---|---|
| Build into your own folder: `CW_OUT=.cache/out-d node build.mjs` | Run a plain `node build.mjs` while other agents work: it rewrites the shared `docs/` |
| Serve it: `CW_OUT=.cache/out-d PORT=8124 node scripts/serve.mjs` → `http://localhost:8124/cincy-week/` | Share a port or an output folder with another agent |
| Shoot it: `CW_OUT=.cache/out-d NODE_PATH=/opt/node22/lib/node_modules node scripts/shots.mjs --pages schedule,plan --states` | Write screenshots into `.cache/shots/` (that is the integrator's) |
| Run `npm test` at any time. Every build test runs in its own temp copy | Edit `tests/build.test.mjs` or `tests/fixtures/mini/*`. Add `tests/<yours>.test.mjs` with `tests/helpers.mjs` instead |
| Edit only the files you own (section 2) | Edit a stub you don't own, even to fix it. Say what you need in your report |

- `CW_OUT` is resolved against the repo root. `.cache/` is gitignored, so use `.cache/out-<agent>`. The
  build refuses a `CW_OUT` that points at the sources (`site/`, `build/`, `data/`, `tests/`, `scripts/` or the
  root). It writes `<CW_OUT>.tmp/`, crawls it, then swaps it into `<CW_OUT>/`, so a failed build never
  touches your last good output.
- The integrator (A) runs the plain `node build.mjs` and commits `docs/`. Nobody else commits `docs/`.
- To test the "during the week" states, add `?now=2026-10-08T20:15` (New York wall time, on localhost
  only, or anywhere after `localStorage.setItem("cw-debug","1")`). Add `?theme=light|dark` to force an
  edition. `shots.mjs` takes `--now` and shoots both editions by default.

## 2. Who owns what (as landed)

| Agent | Build | Client | CSS partial(s) | Other |
|---|---|---|---|---|
| **A** core | `build.mjs`, `build/nav.mjs`, `build/core/*` (not images.mjs), `build/pages/_stub.mjs`, `build/CONTRACTS.md` | `site/js/main.js`, `site/js/core/*` (not the two dialog files), `site/js/lib/{time,filters,search,share,text}.js` | `00-base 10-shell 20-content 80-dialogs 90-pages 99-print` | `scripts/{serve,shots}.mjs`, `tests/{build,time,filters,search,share}.test.mjs`, `tests/helpers.mjs`, `tests/fixtures/mini/*`, workflows, `package.json`, `CLAUDE.md`, `README.md` |
| **B** design | none | none | `tokens.css` | `site/fonts/*`, `site/favicon.svg`, `site/img/brand/*`, `scripts/og.mjs`, `site/og*.png` |
| **C** data | none | none | none | `data/*.json` except `images.json`, `map.json`, `news.json`; `data/README.md`; `scripts/merge-research.mjs` (to create) |
| **D** schedule, plan | `pages/{schedule,plan}.mjs`, `components/event-card.mjs` | `features/{schedule,plan}.js`, `core/event-dialog.js`, `lib/ics.js` | `40-schedule 41-plan 81-event-dialog` | `tests/ics.test.mjs` (to create) |
| **E** map, venues, visit | `pages/{map,venues,visit}.mjs`, `components/venue-card.mjs` | `features/map.js`, `lib/geo.js` | `50-map 51-venues 70-visit` | `scripts/build-basemap.mjs`, `site/map/*`, `data/map.json`, `tests/geo.test.mjs` (to create) |
| **F** directory, images | `pages/{people,art,partners}.mjs`, `components/{person-card,work-card,org-logo}.mjs`, `core/images.mjs` | `features/directory.js`, `core/work-dialog.js` | `60-directory 61-person` (+ `62-*`, `63-*` if needed) | `scripts/fetch-images.py`, `site/img/{p,o,w}/`, `data/images.json` |
| **G** home, programs, info | `pages/{home,program,news,faq,about}.mjs` | `features/{home,faq}.js` | `30-home 31-program 85-news 86-faq` | `scripts/fetch-cincy-news.py` (to create), `data/news.json` |

Every stub file starts with a header naming its owner and its contract. Replace your stubs wholesale. The
build fails if a nav page loses its producer (section 3), so keep producing every page your module produces
today.

**Stubs that exit 2 until their owner lands them:** `scripts/build-basemap.mjs` (E) and
`scripts/fetch-images.py` (F). `refresh-news.yml` skips cleanly until `scripts/fetch-cincy-news.py` (G)
exists.

## 3. Page modules: `build/pages/<name>.mjs`

The build imports every `build/pages/*.mjs` whose name doesn't start with `_`, in name order.

```js
export function pages(ctx) {                  // required; returns an array (may be many detail pages)
  return [{
    path: "schedule.html",                    // "x.html" (a nav slug) or "people/<id>.html" / "venues/<id>.html"
    nav: "schedule",                          // sidebar + dock item marked aria-current (detail pages: the parent)
    title: "The Week",                        // plain text; <title> = "The Week · Cincy Week"
    description: "…",                         // plain text, required; meta description + og:description
    body: (root) => html,                     // root = "" (top level), "../" (detail) or "/cincy-week/" (404)
    toc: [["id", "Label"], …],                // optional: TOC rail ≥ 1280px (≥ 2 items), collapsed list (≥ 5)
    crumbs: [["Overview", "index.html"], ["People", "people.html"], ["Name", null]], // optional; [] = none
    pagenav: { prev: { href, label }, next } | null,  // optional; default = neighbors in NAV order
    features: ["schedule"],                   // client modules: site/js/features/<name>.js must exist
    head: "<link …>",                         // optional extra <head> HTML
    modals: (root) => html,                   // optional dialogs/sheets rendered after the dock (inert-safe)
    jsonld: {…}, og: "og-blink.png",          // optional; og must be a file site/og*.png
    noindex: false, pageClass: "",            // noindex drops canonical + sitemap entry
  }];
}
export function search(ctx) { return [ /* section 9 entries */ ]; }                 // optional
export function data(ctx) { return { "assets/data/<name>.json": anyJson }; }        // optional, fetched by app.data("<name>.json")
```

- **The page renders its own head** with `ctx.c.pageHead({…})` (or its own markup) and exactly one `<h1>`.
  The shell adds everything else: topbar, sidebar, crumbs, TOC, prev/next, footer, dock, toast, the search
  palette, `#event-dialog` and `#work-dialog`.
- **Every internal URL is `root + path`.** Don't use a leading `/` except on the 404 page (its `root` is
  already `pathPrefix`).
- **Page paths:** the nav slugs are in `build/nav.mjs` (`NAV_SLUGS`): `index schedule map plan art-week
  startupcincy-week blink fotofocus people art venues partners stay getting-around neighborhoods eat-drink
  faq news about`. The detail folders are `people/` and `venues/` only. Any other path fails the build as an
  orphan page. A new top-level page needs a line in `NAV` (ask A).
- **Data outputs** (`data(ctx)`): the keys must be unique across modules. `assets/data/events.json`,
  `works.json` and `search.json` are reserved by the core (section 8). Name yours after your domain, for
  example `assets/data/map-pins.json`. They are cache-busted and fetched lazily with `app.data(name)`.
- `ctx.fail(where, msg)` makes the build fail, and `ctx.warn(where, msg, group?)` adds a warning. Name the
  record as `data/<file>.json#<id>.<field>`. Warnings that share a `group` are collapsed into one line.

## 4. `ctx`: the same object for every module

```js
ctx.config  // site.config.json: siteName, siteTagline, siteBase, pathPrefix, repo, author{name,github,linkedin},
            //   timezone "America/New_York", week{start,end} (2026-10-03..11), dataWindow{start,end}, analyticsId
ctx.db      // section 5
ctx.h = {   // helpers (strings in, strings out)
  esc(s), attr(s),                       // HTML escaping (5 chars); every data string must pass through one
  paras(text) → "<p>…</p>…",             // plain text with \n\n paragraphs → escaped paragraphs
  slugify, hostOf(url) → "blinkcincinnati.com", truncate(s, n), initials(name), aliasKey(s),
  extLink(href, innerHtml, cls?)         // external link: target=_blank rel=noopener + sr-only "(opens in a new tab)"
  plural(n, "event"), listJoin(["a","b","c"]) → "a, b and c", sortBy(arr, ...keyFns) (stable), groupBy(arr, keyFn) → Map,
  hash8, clone, HTML_IN_TEXT, PLACEHOLDER, PLACEHOLDER_WORD,
  icon(name, cls?)                       // <svg class="i"><use href="#i-name"/></svg>; unknown name → build error
  bullet(prog, ""|"lg"|"xl")             // program bullet (24/32/44px), decorative: always next to the name
  wordmark(cls, label = true), riverRule(cls, tick = false),
  fmtDay("2026-10-08") → "Thu, Oct 8", fmtDayLong → "Thursday, October 8", fmtDate → "Oct 8",
  fmtTime("19:30") → "7:30 PM", fmtRange("16:00","21:00") → "4:00–9:00 PM", fmtDateRange(a, b) → "Oct 3–10",
  fmtDowRange(a, b) → "Sat–Sat", isoLocal(epoch) → "2026-10-05T09:00-04:00", url(root, path),
}
ctx.c = {   // shared components (build/core/components.mjs); markup follows DESIGN.md §9
  crumbs(root, [[label, href|null]…]),
  pageHead({ kicker, num (1–5 section numeral), prog (program bullet instead), title, titleHtml, lede, dek, chips, cls, after }),
  facts(root, [[label, valueHtml]…], { label }),          // empty values are dropped
  section({ id, title, kicker, num, icon, more: { href, label }, body, anchor, cls, root }),   // <section> under an Oxford rule; h2#<id>-h
  callout(tone "" | "tip" | "warn" | "org", html, { flag, prog, cite }),   // "org" = "From the organizers": quote + named source
  chip(label, href|null, { count, pressed, prog, root, attrs, check }),     // link chip, or toggle button (aria-pressed)
  progBadge(id, { short = true }), progDot(id), progName(id, short), PROGRAM_LABELS, programIds,
  starButton(id, title, { kind: "e" | "w", cls }),       // the only star markup: the client wires it
  badge(kind, text),     // kind: live soon started past free plan warn out unconfirmed | ""
  emptyState({ title, body, action (html), glyph (icon), prog, attrs }),
  toolbar({ search: { label, placeholder }, selects: [{ name, label, options: [[v, l]] }], views: [{ v, label, icon, pressed }] }),   // .js-only
  resultCount(n, total, noun),                             // p.result-count[role=status][data-result-count][data-noun]
  pagenav(root, prev, next), toc(items), tocMobile(items), keylinks(root, [{ href, label }]),
  sourceLine([urls], { label, note }), placeholder(what, owner), secNum(n),
  avatar(root, person, size ""|"s"|"m"|"l", opts),       // = img.mug (engine §5.2 name)
}
ctx.img = {  // build/core/images.mjs (F); manifest data/images.json, files under site/img → docs/assets/img
  img(root, kind "p"|"o"|"w", id, { alt, cls, sizes, lazy = true }) → <img …> | "" (no image),
  has(kind, id), entry(kind, id) → { file, w, h, bg, src, source_url, tone? }, path(kind, id) → "assets/img/…" | null,
  mug(root, person, { size, alt, prog, cls }) → .avatar[data-prog] with the photo, or .avatar.mono.halftone initials,
  logo(root, org, { alt }) → <img> | .plate-text,  photo(root, work, { alt }) → <img> | .photo-missing,
}
ctx.cards = { …section 6 }            ctx.map = { miniMap }            ctx.seo = { programLd, personLd, placeLd, eventLd }
ctx.time    // site/js/lib/time.js (the same code the client runs): nyToEpoch, nyParts, expand, festivalDay, bucket,
            //   status, relTime, fmt*, addDays, dateRange, daysBetween, weekday, BUCKETS, STATUS_LABEL, MIN/HOUR/DAY
ctx.fail(where, msg)   ctx.warn(where, msg, group?)   ctx.buildDate ("Thursday, September 24, 2026"; about.html only)
ctx.nav = { NAV, NAV_SLUGS, PROGRAM_PAGES }
```

## 5. `db`: the validated, indexed data (`build/core/load.mjs`)

Page modules only ever see valid data. The build stops, listing every data, token and CSS error, before
any page module runs.

- **Arrays:** `programs events people works venues orgs stays places faqs news facts`, each in data order.
  The record shapes are in engine §4.3 and are enforced field by field in `build/core/schema.mjs`.
- **Objects:** `aliases`, `images` (the manifest) and `map`. `map` holds `{ bbox: { core: {s,n,w,e} },
  projection: { k, sx, viewBox: [W, H] }, labels, transit, attribution, osm_timestamp }`. E owns it and may
  extend it with `region` and `lat0`.
- **`byId`:** `.program .event .person .work .venue .org .place .stay .faq .news` (Maps).
- **`instances`:** every event-day, sorted by `s`. The shape is
  `{ id, ev, date, day, s, e, start, end, lateNight, endUnknown, timeUnknown, allDay, ongoing }`.
  - `s` and `e` are epoch ms from New York wall-clock time, with a two-pass, DST-safe offset.
  - `day` is the festival day. A start from 00:00 to 04:59 belongs to the day before (`lateNight`).
  - A missing `end` means `s + 60 min`, with `endUnknown`. The UI says "end time not listed" and never "Now".
  - A missing `start` means `timeUnknown`, which spans the whole day. The UI says "Hours not listed" and
    shows no state word.
  - `all_day` gives `allDay`, from 00:00 to 24:00.
  - `ongoing` is true for multi-day, all-day and hours-not-listed items. The schedule shows these in its
    "All day and all night" band.
  - Multi-day events (`end_date`, `occurrences`) expand to one instance per day inside `dataWindow`, and
    anything outside it is clipped.
- **Maps:** `eventsByDay` (festival day to live instances), `eventsByPerson`, `eventsByVenue`,
  `eventsByProgram`, `eventsByHood` (id to live events, by first start), `worksByPerson`, `worksByVenue`,
  `orgsByProgram` (program to `[{ org, role }]`, ordered by `tier_rank` then name), `venuesByHood`
  (hood id or "" to venues), `peopleByRole`, `placesByKind`.
- **Other fields:**
  - `days`: `[{ date, inWeek, before, after, count }]`. It covers the nine week days plus any other day that
    has a timed event inside the window.
  - `week`: the nine ISO dates.
  - `phaseInstants`: `{ weekStart: Oct 3 00:00 ET, weekEnd: Oct 12 05:00 ET }`.
  - `code(id)`: the five-character share code. `codeToId` is a Map. A code collision fails the build.
  - `nearby(lat, lng, meters = 500)`: `[{ kind: "venue"|"place"|"stay", rec, d }]`.
  - `counts`: `{ events (live), people, venues, works, orgs, programs }`.
- **Fields the loader adds to records:**
  - Events get `kg` (the kind group: `talks hands-on social art pitch other`), `instances`, `day` (the
    first festival day), `venue` (the record or null), `hood`, and `live` (true unless cancelled).
  - People get `roles` and `programs`, merged with what their events and works imply, plus `events` and
    `works`.
  - Venues get `programs` (derived and merged), `stall` (1…n for venues with coordinates, in data order,
    and the same number as the map pin) and `events`.
- **Aliases, resolved at build time, where the stored value always wins:**
  - A venue with `hood: null` and a free-text `neighborhood` gets its `hood` from the neighborhood's id,
    name or short name, or from `aliases.json` `hoods`. If none match, you get a grouped warning.
  - An event or work with `venue_id: null` and a `location_text` gets its `venue_id` when the text matches a
    venue's name, one of its `aliases[]`, or `aliases.json` `venues`.
  - Keys are compared through `aliasKey()`: lowercase, `&` becomes "and", punctuation is stripped and spaces
    are collapsed.
- **Geo rule:** coordinates outside 38.4–40.4 N, 85.2–82.4 W fail as mistyped. Coordinates outside the map
  region (38.9–39.4 N, 84.9–84.2 W) only warn with "not on the map". FotoFocus reaches Dayton and Columbus.

## 6. Components (`ctx.cards`): domain renderers, one owner each

| Function (owner) | Markup contract other agents rely on |
|---|---|
| `eventCard(root, eventOrInstance, { anchor = true, headingLevel = 3, span = false })` (D) | `<article class="ev" id="e-{id}" data-ev data-p data-kg data-k data-day data-s data-e [data-inst] [data-end-unknown] [data-time-unknown] data-t data-h data-v data-free data-q [data-cancelled]>` holding `.ev-when` (`<time datetime>` and `.ev-status[data-status]`), `.ev-body` (`.ev-meta` with the program badge and kind, `.ev-title a[href="{root}schedule.html?e={id}#e-{id}"][data-open-event]`, `.ev-where`, `.ev-people`, `.ev-tags`, `details.ev-more`) and `button.star[data-star]`. Only one card per page may carry `id="e-{id}"` (`anchor: false` elsewhere). `span: true` gives one card for a multi-day item, with `data-inst="s:e,…"`. |
| `eventRow(root, instance)` (D) | `<li><a href="…?e=…" data-open-event><time>7:00<small>PM</small></time>{bullet}<span><span class="t">Title</span><span class="w">Thu, Oct 8 · Venue</span></span></a></li>`, used inside `<ol class="tonight">` (shared CSS, section 7) |
| `eventList(root, instances, { groupBy: "day"\|"none", headingLevel })` (D) | day `h{n}.sub-h` + `.grid` of cards |
| `personCard(root, person, { prog })` (F) | `a.person[data-prog][data-prog2][data-r][data-p][data-l][data-q]` (a directory item) |
| `avatarStack(root, people, max = 3)` (F) | `span.avatar-stack` of `.avatar.s` |
| `venueCard(root, venue)` (E) | `li.venue#v-{id}[data-prog][data-p][data-h]` with `.stall` (the number, or "–"), `h3 a` to the venue page, `.addr`, `.roles` and `.acts` (walking directions) |
| `miniMap(root, lat, lng, { prog, n, label })` (E) | `.mini-map` with `<svg viewBox=crop><use href="{root}assets/map/basemap.svg#bm"/></svg>` and one `.pin.pin-venue`. It is plain SVG and needs no JS. Out of range or no coordinates gives `<p class="unk">`. |
| `directions(lat, lng)` (E) | `{ apple, google }`, walking-mode URLs |
| `workCard(root, work, { headingLevel })` (F) | `article.work#w-{id}[data-prog][data-p][data-m][data-z][data-q]` with the photo or halftone, `.wk-kicker`, `h3 a[href="{root}art.html?w={id}"][data-open-work]` and `.star.floating[data-star-kind="w"]` |
| `orgLogo(root, org, { anchor })`, `logoWall(root, [{ org, role }], seenSet)` (F) | `a.plate#o-{id}` (the search target `partners.html#o-{id}`) inside `.plates`, under `p.tier` |

To add a component, export it from your `build/components/*.mjs` factory. `build.mjs` merges every factory
into `ctx.cards`. A new component file needs one import line in `build.mjs` (ask A).

## 7. Markup and CSS

- **Partials:** `site/css/NN-name.css` are concatenated in name order into `assets/site.css`. `tokens.css`
  is served separately, with a generated no-JS copy of the Night edition. The lint fails on:
  - a color literal (`#hex`, `rgb()`, `hsl()`, `oklch()` or a named color) outside `tokens.css`
  - a `font-size` under 12px or 0.75rem
  - a partial name that doesn't follow the pattern

  It warns on a `var(--x)` that is never defined. Stay inside your own files and your number range.
- **Shared classes (A, `20-content.css`)** are listed in `CLAUDE.md`, plus `.tonight`. `.tonight` is the
  74px time-first list, shared by home, venue, person and program pages and styled only in `20-content.css`.
- **Program scope:** `[data-prog="caw|scw|blink|fotofocus|also"]`, or `article.ev[data-p]`, sets
  `--ink-fill`, `--ink-text`, `--ink-on`, `--ink-tint` and `--ink-edge`. Adding `data-prog2` sets
  `--ink-fill-2`. Components read only these variables. A program's color is for its identity only
  (DESIGN.md §3.2).
- **Domain prefixes:**
  - D: `.ev-*`, `.evd-*`, `.dt-*`, `.slot-*`, `.sched-*`, `.plan-*`
  - E: `.map-*`, `.pin-*`, `.mini-map`, `.venue`, `.stall`, `.vp-*`, `.byday`, `.stay`, `.walk`, `.hood`
  - F: `.person`, `.per-*`, `.dp-*`, `.work`, `.wk-kicker`, `.wall-*`, `.plate(s)`, `.tier`
  - G: `.home-*`, `.mast`, `.lead`, `.ear`, `.nn-*`, `.wk-*` (the week line), `.prog-*`, `.stats`, `.door`,
    `.ticker`, `.news-*`, `.faq-*`
- **Cross-owner class dependencies to keep stable:**
  - The work dialog stub (F) renders `.evd`, `.evd-actions`, `.ev-where` and `.source-line`, styled in D's
    `81-event-dialog.css` and `40-schedule.css`. D must not rename them. F may switch to its own `.wd-*`
    classes.
  - `.avatar` and `.avatar-stack` live in `20-content.css` (A).
- **Sprite:** the shell inlines one sprite per page. It holds the icons (`#i-<name>`: the list is `ICONS`
  in `build/core/icons.mjs`), the program bullets (`#b-caw` … `#b-also`) and the wordmark (`#wm`). Client
  code references them with `<svg class="i" aria-hidden="true"><use href="#i-star"/></svg>`.
- **No-JS:** `<html>` starts as `.no-js`, and the boot script swaps it to `.js`. `.js-only`, stars, the
  search buttons, the plan card and the plan button are hidden without JS. On phones without JS, the sidebar
  follows the page. Every list must be server-rendered. `.js .ev-more { display: none }`.
- **Contrast and targets:** targets are 44px on touch and text is 12px or larger. State is always a word
  as well as a color: "Now", "In 20 min", "Started", "Ended", "not listed".

## 8. Client runtime

`site/js/main.js` (an ES module) boots the core modules, then imports each name in
`<body data-features="…">` from `./features/<name>.js` and calls `init(app)`.

```js
app = {
  root, page,                      // "" | "../" ; <html data-page> ("schedule", "people/jane-doe")
  now(), onTick(fn) → unsubscribe, // epoch ms (honours ?now=); fn(now) every 60 s + on tab focus
  phase(),                         // "before" | "during" | "after" (set before paint by the boot script)
  data(name),                      // Promise<json> of assets/data/<name> (memoized, cache-busted); rejects offline/file://
  store,                           // { get(k, fallback), set(k, v), del(k), blocked } — keys start with cw-
  plan,                            // { has(id), toggle(id, "e"|"w") → on, add(ids, kind), replace({e,w}), clear(), list() → {e,w}, count(), subscribe(fn), refresh() }
  modal,                           // { show(el, { trigger, focus, onClose }), hide(restoreFocus = true), current() }
  toast(text, { link: href|true, linkText, ms }),
  status,                          // { update(now, rootEl), statusOf(s, e, now, endUnknown) }
  share({ title, text, url }) → "shared"|"copied"|"failed", copyText(text) → bool,
  openEvent(id, { trigger, push }), openWork(id, { trigger, push }), openSearch(trigger, q),
}
```

- **Feature module:** `export function init(app) {}` in `site/js/features/<name>.js`. List the name in your
  page's `features` (the build fails on a missing file). Features may import `../lib/*.js` and `./other.js`.
  Don't import `../core/*`: use `app`.
- **`features/map.js` (E)** also exports `mountMap(el, { pins, layers, focus, fit, onSelect, list })`,
  which returns `{ update(pins), select(id), highlight(id), fit(), destroy() }`. A pin is
  `{ id, kind: "venue"|"work"|"stay"|"stop"|"food", lat, lng, prog, prog2?, n?, label, live? }`. Today it is
  a no-op stub. D's List/Map view imports it with `import("./map.js")`.
- **`features/directory.js` (F)** already filters `[data-dir]` children by `input[data-filter-q]` and
  `select[data-filter=key]`. It keeps `?q=` and the select keys in the URL and updates `[data-result-count]`.
  F extends it into the full engine (engine §4.8).
- **Wired everywhere by the core, so don't re-implement it:**
  - Any `[data-s][data-e]` element, or a multi-day one with `data-inst`, gets `data-status` (`upcoming soon
    live started past`) and a word in its child `[data-status]`. This runs every minute. Live `.ev` cards
    also get a `.ev-progress` bar. `data-end-unknown="1"` never says "Now", and `data-time-unknown="1"` gets
    no state.
  - Any `button[data-star="<id>"]` (`data-star-kind="w"` for works) is toggled, labeled, counted and
    toasted. `[data-plan-count]` badges update, including across tabs.
  - Any `[data-open-event="<id>"]` or `[data-open-work="<id>"]` opens the dialog. It pushes `?e=` or `?w=`,
    Back closes it, focus returns to the trigger, and `?e=`/`?w=` on load opens it.
  - Search opens with `[data-search-open]`, ⌘K, Ctrl K or `/`.
  - The topbar Live pill.
- **Modals:** use the one modal component. The markup is
  `<div class="modal [sheet]" id role="dialog" aria-modal="true" aria-labelledby data-modal><div class="modal-backdrop" data-close></div><div class="modal-panel">…</div></div>`.
  Emit it through your page's `modals` and open it with `app.modal.show`. You get the focus trap, `inert`
  on the rest of the page, Esc and focus return.
- **`assets/data/events.json`** (core, `build/core/client-data.mjs`) is
  `{ v: 1, tz, week, phase, programs: { id: { n, s } }, venues: { id: { n, a, h, ll, st } }, people: { id: { n, t, i } }, events: [...] }`.
  Each event is
  `{ id, x, p, t, k, kg, d, v, r, lt, pp, pr, c, f, u, src, st, fe, tg, tr, tt, ht, wk, i: [[day, s, e, flags]] }`.
  The flags are 1 endUnknown, 2 timeUnknown, 4 allDay, 8 ongoing and 16 lateNight.
- **`assets/data/works.json`** is `{ v: 1, works: [{ id, x, p, t, a, at, m, c, z, v, lt, ll, ht, sp, d, i, src }], people: { id: { n } } }`.
- **`assets/data/search.json`** is `{ v: 1, items: [...] }` (section 9).
- **Storage keys** are listed in `site/js/core/store.js`: `cw-theme`, `cw-rail`,
  `cw-plan {v,e,w,t}`, `cw-prefs {scheduleView, hidePast, mapLayers}`, `cw-seen-shared` and `cw-debug`.
  New keys start with `cw-`. `localStorage` is only for per-reader conveniences.
- **Pure libraries** in `site/js/lib/` have no DOM, are imported by both the build and the client, and each
  has a `tests/<lib>.test.mjs`.
  - `time`: see `ctx.time`.
  - `filters`: `parse(search, schema)`, `serialize(state, schema)` (drops defaults, sorts lists),
    `matches(item, state, schema)`, `activeCount`, `defaults`.
  - `search`: `norm`, `terms`, `prepare`, `score`, `search`, `group`, `mark`, `KINDS`, `SEE_ALL`.
  - `share`: `code`, `encode`, `planHash({e,w}) → "p=…;w=…"`, `decode(hash, codeToId)`, `codeTable`.
  - `text`: `esc`, `paras`, `parasHtml`, `initials`, `truncate`, `hostOf`, `slugify`, `aliasKey`.
  - `geo` (E): `haversine`, `walkMinutes` (estimate), `project(lat, lng, meta)`, `bboxContains`.
  - `ics` (D): `vcalendar(events, { name, stamp })`, `fold`, `escText`, `utc`.

## 9. Deep links and search entries

Query keys per page are listed in `PARAMS` in `build/nav.mjs`, and their values in `paramValues(db)` in the
same file. The crawler fails any internal link, or any search entry `u`, that has:
- an unknown key
- a value that names nothing, such as `p=nope`, an `e=` or `w=` id that isn't in the data, or a `day` that
  isn't in `db.days`

The client re-validates everything it reads from the URL. Only non-default values are written, with
`history.replaceState`. Opening a dialog uses `pushState`.

| Page | Keys (values) |
|---|---|
| schedule.html | `day` (ISO date in `db.days` \| `all`) · `p` (program ids, comma-separated) · `k` (kind groups `talks hands-on social art pitch other` **or** single kinds such as `performance`; a kind narrows within its group, matched on the card's `data-k`) · `t` (`morning afternoon evening late`) · `h` (neighborhood ids) · `v` (venue id) · `free=1` · `q` · `past=0\|1` · `star=1` · `view=list\|map` · `when=now\|next\|tonight` · `e` (event id) |
| people.html | `q` · `r` (roles) · `p` · `l` (`A`–`Z`, `#`) |
| art.html | `q` · `p` · `m` (mediums) · `c` · `z` · `h` · `view=grid\|map` · `w` (work id) |
| venues.html | `q` · `p` · `h` · `day` · `view=list\|map` |
| map.html | `layers` (`venues art stays transit food`) · `p` · `day` · `focus=venue:<id>\|work:<id>\|stay:<id>` |
| partners.html | `p` · `tier` · faq.html `p` `q` · news.html `p` · eat-drink.html `h` |
| plan.html | hash only: `#p=<code>,…;w=<code>,…` |

A **search entry** is `{ k, id, t, s?, u, p?, g?, i?, st?, en? }`.
- `k` is one of:
  - `ev` event
  - `pe` person
  - `wo` work
  - `ve` venue
  - `pr` program
  - `pg` page
  - `or` org
  - `fq` faq
  - `pl` place
  - `st` stay
  - `nw` news
- `u` is root-relative (for example `schedule.html?e=<id>#e-<id>`, `people/<id>.html` or
  `partners.html#o-<id>`) and must resolve, including its `#id`.
- `p` is a program id, and `g` holds extra keywords.
- `i` is an image path from `img.path(...)`.
- `st` and `en` are event epochs, which drive "happening soon".

The core adds one `pg` entry per nav page. Entries are de-duplicated by `k` and `id`.

## 10. Tests

- `npm test` runs `node --test tests/*.test.mjs`. Every build test copies the repo into a temp folder with
  `tests/fixtures/mini` as `data/`, so tests are safe to run in parallel.
- Put your own tests in `tests/<domain>.test.mjs` and use `tests/helpers.mjs`:
  - `copyRepo`, `build(dir, env)`, `read`, `write`, `json` and `cleanup`
  - `editData(file, fn)(dir)`, which mutates the copy's data. Don't edit the fixture.
  - `edit(file, fn)(dir)`, `extraPage(body)`, `hashTree`, `fx(file)`, `REPO` and `CONFIG`
- A pure library gets a unit test file.
- The fixture holds 5 programs, 13 events, 12 people, 12 venues, 2 works, 4 orgs, 2 stays, 7 places,
  4 FAQs, 3 news items and 2 facts. If you need a record the fixture lacks, add it in your test with
  `editData`, or ask A to extend the fixture.
- `tests/build.test.mjs` (A) covers:
  - every page and asset
  - the crawler
  - the search index
  - the sitemap
  - the 404 page
  - the event-card contract
  - a double build that must be byte-identical
  - a failed build that leaves `docs/` untouched
  - `CW_OUT`
  - the BROKEN table: 36 mutations that must each fail with a named message and write nothing

## 11. What the build checks for you

Everything in `CLAUDE.md` under "What the build rejects", plus:
- query values (section 9)
- `srcset` URLs
- `url(…)` in `assets/site.css` and `assets/tokens.css`, which covers the self-hosted fonts
- placeholder words inside text: "Speaker TBA" fails, while inside long verbatim prose it only warns
- wrong-typed values, which are reported as errors instead of crashing the loader

Run the build and read every line it prints. Each error names `data/<file>.json#<id>.<field>`,
`build/pages/<module> → <path>` or `site/css/<file>:<line>`.
