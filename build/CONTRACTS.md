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
  `{ id, kind: "venue"|"work"|"facility"|"stay"|"stop"|"food", lat, lng, prog, prog2?, n?, label, live?, mn?, ic? }`. Today it is
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
  `{ id, x, p, t, k, kg, v, r, lt, pp, pr, c, f, u, src, st, fe, tg, tr, tt, ht, wk, cr, i: [[day, s, e, flags]] }`.
  The flags are 1 endUnknown, 2 timeUnknown, 4 allDay, 8 ongoing and 16 lateNight. The descriptions live in
  **`assets/data/event-text.json`** `{ v, d: { eventId: text } }`, loaded on first use (see the Changelog).
- **`assets/data/works.json`** is `{ v: 1, works: [{ id, x, p, t, a, at, m, c, z, v, lt, ll, ht, sp, d, i, src, mn, ak, as, am }], people: { id: { n } } }`.
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
| map.html | `layers` (`venues art facilities stays transit food`) · `p` · `day` · `focus=venue:<id>\|work:<id>\|stay:<id>\|facility:<place id>` |
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

## Changelog

Additive changes to A-owned files made by domain agents (smallest possible, nothing renamed or removed).

- **2026-09-24 · C (data)** `build/core/schema.mjs`:
  - `events.credits: [{ role, names: [] }]` (optional). Plain-text credit lines for people **without** a person
    record (the ~590 name-only FotoFocus artists, jurors, advisors). `role` is the source's own label when it has one
    ("Artists", "Juror", "Advisors", "Visual Artists", "Filmmakers"), else a plural ("Artists", "Curators",
    "Speakers"). A name is never in both `people` and `credits` of the same event. Render as text; search should index
    the names (D: add them to the event's search `g` and the card's `data-q`).
  - `stays.room_block.status` (optional text, e.g. "Closed: block full (checked Sep 24, 2026)").
  - `stays.booking_portal: { program, url, label }` (optional): the hotel is listed on a program's hotel booking
    portal (BLINK's Visit Cincy portal). It is **not** a room block: no code, no rate.
  - `facts.source` (publication name) and `facts.quote` (the verbatim sentence the fact rests on), both optional.
- **2026-09-24 · C (data)** `build/core/client-data.mjs`: events.json events gain `cr: [[role, [names]]]` (the
  event's `credits`), so the event dialog can show them.
- **2026-09-24 · D (schedule & plan)** no A-owned file changed. New interfaces other agents may use:
  - `ctx.cards.eventCard(root, x, { …, compact })`: `compact: true` drops the people strip and tags (the schedule's
    band). Passing an event **record** with several day instances now spans it automatically (`data-inst` +
    `data-days`), so person, venue and program pages show the right live state for exhibitions and BLINK nights.
    `data-q` now holds only words the card does not print (credits, extra people, orgs, extra tags); filters add
    the card's visible text. `data-h` / `data-v` are omitted when empty. `ctx.cards.whenText(instance)` → plain text.
  - `assets/data/schedule-extra.json` (from `build/pages/schedule.mjs`): `{ v, venues: { id: { mm, d: { apple,
    google } } }, spans: { eventId: [firstDate, lastDate] } }`. `mm` is Agent E's mini-map HTML with the root
    written as `{R}`; `spans` are the full runs of multi-day items (events.json only lists days inside the window).
  - `site/js/lib/agenda.js` (pure, `tests/agenda.test.mjs`): `festivalToday`, `defaultDay`, `inWhen`,
    `conflicts` / `conflictText`, `walkGap` / `gapText`, `dur`. `site/js/lib/ics.js` adds `eventItems(ev,
    eventsJson, { base, span })`, `gcalUrl`, `icsFilename`.
  - Event search entries (`k: "ev"`) now use `u: "schedule.html?e=<id>"` (the palette needs JS, and with JS `?e=`
    opens the dialog over the card) and carry `st`/`en` only when hours are listed, so an exhibition with no
    hours never shows under "Now and next".
- **2026-09-24 · F (directory & images)** no A-owned file changed. New interfaces other agents may use:
  - `data/images.json` (from `scripts/fetch-images.py`, 405 images): `p/<id>` = a 320×320 face-safe square plus
    `sm: { file, w, h }` (96×96); `w/<id>` = the 480w file plus `lg` (960w) when the source is wider; `o/<id>` =
    webp (transparency kept) or sanitized SVG, with `tone: "light"|"dark"` (the plate it needs); `o/prog-<program>`
    = the official program marks. `ctx.img` adds `srcset(root, kind, id)`, `credit(kind, id)` ("BLINK" when the
    image came from a program's own site, else the host), `SIZES` and `img(…, { big })` (a work's 960w file as
    `src`); `img.mug()` now writes `srcset`/`sizes` for its size. The fixture's image files are never pruned.
  - `ctx.cards`: `personFeature(root, person, { prog })` (the 4:5 featured mug for home and program pages),
    `personCard(root, person, { prog, id })`, `personLetter`, `personSortKey`, `roleLine(person)` ("Speaker ·
    2 sessions"), `workFull(root, work, { headingLevel, bioShown })` (a work in full: the artist's page),
    `workMedium`, `workGlyph`, `workArtists`, `zoneKey`, `tierLabel(role)`. `logoWall(root, entries, seen,
    { prog })` wraps each tier in `div.wall-tier[data-dir-group]` > `.plates[data-dir]` (plates carry `data-p`,
    `data-tier`, `data-q`); `workCard` adds `data-c`, `data-h`, `data-ll` and an `anchor` option.
  - `site/js/features/directory.js` is the full engine; its markup contract is in the headers of
    `build/pages/_directory.mjs` (F's helper: `searchField`, `filterGroup`, `azNav`, `dirStatus`, `dirEmpty`,
    `viewToggle`) and `site/js/lib/directory.js` (pure, `tests/directory.test.mjs`). The first version's contract
    (`[data-dir]`, `input[data-filter-q]`, `select[data-filter]`, `[data-result-count]`) still works; a list whose
    children have no `data-q` is matched on their text. Class prefix `.dir-*` (F, `60-directory.css`).
  - `assets/data/art-extra.json` (from `build/pages/art.mjs`, fetched by the work dialog): `{ v, works: { id: { im:
    [[src, w, h], [src960, w, h]?] | null, cr, ab?, so?, mm?, d? } }, people: { id: { i, t } }, venues: { id: { n,
    st, h } }, programs: { id: { n, dates } } }` (`mm` = E's mini-map with the root as `{R}`).
  - The art page's Grid/Map toggle appears by itself once `site/js/features/map.js` no longer carries the stub
    marker "STUB landed by Agent A"; it calls `mountMap(el, { pins, fit, onSelect })` with `kind: "work"` pins.
  - New partial `site/css/62-art.css` (art sections, the work dialog's `.wd-*`); the dialog body still reuses D's
    `.evd` layout classes.
- **2026-09-24 · G (home, programs & info)** no A-owned file changed (this entry only). New files in G's lane and
  interfaces other agents may use:
  - `site/js/lib/week.js` (pure, `tests/week.test.mjs`): `laneRun(lane, date, weekStart, weekEnd)` →
    `start|mid|end|only|thru|null`, `interchangeDays`, `runNote` (" (opening night)"), `programLine` (the day's
    screen-reader program list, the same words as D's day tabs) and `daySummary` (the week line's phone summary).
  - `site/js/lib/athour.js` (pure, `tests/athour.test.mjs`): `items(eventsJson)`, `atThisHour(items, now)` →
    `{ today, now, open, onView, next, tonight, … }`, `firstUp`, `countdown`, `kicker`, `hoursText`, `rel`. It reuses
    D's `festivalToday` from `lib/agenda.js`.
  - `site/js/features/news.js` (news.html filters: `?p=` chips + a source menu) next to `features/{home,faq}.js`.
  - `build/pages/news.mjs` also exports `newsCard(ctx, root, item, { anchor, level })` (`article.news-card`, styled in
    `85-news.css`) and `latestNews(db, n, { programs })` (this and last year's stories, background items left out).
    `build/pages/home.mjs` exports `weekLanes(ctx)` and `HOME_FACTS` (the facts.json ids shown as stat tiles).
  - Program pages carry section ids `#about #tickets #days #schedule #people #works #venues #sponsors #faq #news
    #sources`; `details.faq` (question + verbatim answer + source line) is styled in `86-faq.css` for any page.
  - `data/news.json` items added by `scripts/fetch-cincy-news.py` have `summary: null`, `kind: "news"`, a `gnId` and
    `date_source: "google-news-pubdate"`; curated items are never changed. News search entries (`k: "nw"`) now leave
    out background items (`kind: "history"`), which stay on news.html.
- **2026-09-24 · E (map, venues & visit)** one A-owned file changed, additively:
  - `build/core/load.mjs`: `venue.stall` now numbers only the venues **on the basemap** (inside `data/map.json`
    `bbox.core`; without a map.json, every venue with coordinates, as before). A venue in Dayton or Columbus has
    coordinates but no pin, so it gets no number and prints the dashed "–" stall. Nothing else in the loader changed.
  - `data/map.json` (from `scripts/build-basemap.mjs`, which now works from the cached Overpass responses in
    `.cache/osm/` and re-fetches only with `--fetch`): `bbox.core` is the basemap (39.075–39.135 N, 84.545–84.48 W:
    OTR to Covington and Newport, the West End to Mount Adams), `bbox.home` the frame maps open on;
    `projection: { lat0, k, sx, scale (= sx), viewBox: [1000, 1190], mPerUnit }`; `labels: [{ text, lat, lng,
    kind: hood|water|state|park|bridge|street, minZoom, angle?, id? }]`; `transit: { name, stops: [{ ref, name, lat,
    lng }] }`. `lib/geo.js metaOf(map.json)` gives `{ bbox, home, k, sx, W, H, mPerUnit }`, the shape `project()`
    takes (`ctx.cards.meta` is the same object). The basemap's line widths are `calc(w * var(--mw, 1))`, so mini-maps
    render unchanged.
  - `site/js/lib/geo.js` adds `unproject`, `metaOf`, `onMap`, `crop` (mini-map viewBox), `compass`, `cluster`,
    `fitScale`, `clampView` and `METERS_PER_DEG_LAT` (tests in `tests/geo.test.mjs`).
  - `ctx.cards` adds `areaMap(root, points, { label, minHalfM, center, ratio, cls })` (a static crop with several pins),
    `directionsTo(record)`, `where(record)`, `placeStatus(record)`, `nearbyOf(lat, lng, m)`, `walkLabel(m)`,
    `daysOf(venue)`; `miniMap` now carries up to three basemap labels; `directions(lat, lng, { walk })`.
  - `site/js/features/map.js` `mountMap(el, { pins, fit, focus, onSelect, onList, onClear, onHover, wheel, title,
    nearMe })` → `{ update, select(id, { zoom }), highlight, fit, home, locate, destroy }`. `onSelect` is only ever
    called with a real pin id; a cluster that zooming cannot split calls `onList(ids)` (without it, a card in the map
    lists them). Embedded maps (schedule, art, stay) need Ctrl/⌘ + wheel to zoom so the page still scrolls.
  - `assets/data/map-meta.json` (from `build/pages/map.mjs`): `{ v, bbox, projection, labels, transit, attribution }`,
    fetched once by every interactive map. `map.html` lists every place on it as `li.map-li[data-id="<kind>:<id>"]`.
- **2026-09-24 · QA (data-accuracy audit)** one A-owned file changed, plus copy-only edits the audit required in page
  modules (claims the data does not support). Nothing renamed or removed; `npm test` green.
  - `site/js/lib/time.js` `fmtDateRange`: a run that crosses into another year **on or after its start month** (a year or
    more) now names both years (`"Aug 28, 2026–Aug 13, 2027"`, `"Oct 17, 2024–Oct 31, 2026"`); it printed `"Aug 28–13"`.
    Every other output is unchanged (`"Oct 3–10"`, `"Sep 30–Nov 1"`, `"Oct 2–Feb 7"`). Test: `tests/qa-data.test.mjs`.
  - Copy (owners please keep): `home.mjs` (dek and meta description say "published", not "every … of the first week of
    October in Cincinnati"; the stay door says "places to stay": 5 of the 140 stays are short-term rentals; the people stat
    reads "speakers, artists, curators and organizers"), `about.mjs` ("places to stay"), `schedule.mjs` (description and
    lede: "The published sessions, shows and parties"), `map.mjs` (description no longer says every place is on one map:
    38 venues are off it), `venues.mjs` ("Every venue in this guide, … where published"), `visit.mjs` (stay page and
    neighborhood chips say "places to stay"/"hotels and rentals"; the description drops "near the week's venues", since
    portal hotels spread across the region).
  - Data (C's script, `QA_*` tables in `scripts/merge-research.mjs`, logged in data/README.md "QA audit"): new tag
    `approximate-time` on `blink-2026-10-08-flip-the-switch` (D: print "About 7:00 PM" when an event carries it);
    NO GRID slots' `location_text` reads "NO GRID Location #2 (venue not named by the organizers)"; person
    `bailey-elderberry` is now `bailey-elder` (F: no image entry existed); people `brandon-hill`, `isaiah-armstrong`,
    `daniel-iroh` removed and `andrea-sabugo` is FotoFocus-only (now a plain credit); `also_sources` now carries the page a
    bio was taken from (`bio_source_url` in the research).
- **2026-09-24 · QA (UX, visual & accessibility)** A-owned files changed additively (nothing renamed or removed; `npm test`
  green, tests in `tests/qa-ux.test.mjs`); the full list of fixes is in `.cache/qa-ux.md`.
  - `site/js/lib/text.js` adds `roomText(venueName, room)`: the part of a room worth printing after its venue name ("" when
    the venue name already holds it; "East Court Street" for "Court Street Plaza, East Court Street"). Used by D's card and
    dialog and G's program rows.
  - `site/js/lib/search.js`: `search()` hits carry `exact` (title equals the query); `group()` moves the exact hit's group to
    the front ("Findlay Market" lists the venue first). Without an exact match the order is unchanged.
  - `build/core/components.mjs`: `facts()` gives a value longer than 110 characters `.fact.fact-wide` (two tiles wide);
    `emptyState({ level })` (default 3) so an empty state right under the h1 is an h2 (My Plan).
  - `build/core/shell.mjs`: the sidebar program sub-line is `<span>` segments (`.nav-sub > span` is nowrap), so it wraps
    between segments ("7–11 PM"), never inside one. `build/core/seo.mjs`: the 404 copy uses a typographic apostrophe.
  - CSS: `00-base` (`p.unk, div.unk` are block-level flex: two unknowns never share a line), `10-shell` (nav-sub segments),
    `20-content` (`.fact dd` wraps long emails; `.fact-wide`; `.empty-state h2`).
  - New interfaces other agents may use: `eventCard(root, x, { here: venueId })` (D's card: on that venue's own page the
    card prints only the room, or "Room not listed", never a link to itself; E's venue pages pass it);
    `art-extra.json` works gain `zv` (the zone venue whose mini-map the work dialog shows when the work has no spot of
    its own, labeled as the zone); `site/js/features/progdays.js` (program pages: opens today's folded day during the
    week and a `#<program>-d-<date>` target); `lib/athour.js` items carry `ab` for events tagged `approximate-time`
    ("About 7:00 PM", also on cards, rows, the dialog and My Plan).
- **2026-09-24 · A (integration pass, everyone landed)** A owns the tree from here on (see CLAUDE.md, "Maintaining the site
  during the week"). Changes, tested in `tests/integration.test.mjs`:
  - **`assets/data/event-text.json`** (new, `build/core/client-data.mjs`): `{ v, d: { eventId: description } }`. The `d` key
    **left** `events.json` (136 → 56 KB gzipped; the idle prefetch on every page with event links is now 80 KB lighter). The
    event dialog loads it with events.json on open (and warms it on the first pointer or focus on a `[data-open-event]`);
    My Plan's .ics export loads it before `eventItems()`. A failed load prints "The description did not load", never
    "Description not listed". `lib/ics.js eventItems(ev)` still reads `ev.d`: callers attach it. This is the one removal in
    the contract; every reader is updated.
  - `build/core/crawl.mjs` budgets: `schedule.html` raw 900 → 1300 KB (it server-renders all 364 events for the no-JS list;
    the gzipped 220 KB budget is what travels); `event-text.json` ≤ 110 KB gzipped.
  - `build/core/schema.mjs`: `programs.tickets[].details` (the organizer's own words, shown in the "Details" column);
    `notes` stays unrendered. `build/pages/program.mjs` (G) prints `details`, no longer `notes`.
  - `build/pages/schedule.mjs` (D) `schedule-extra.json` `spans`: the published `date`–`end_date` run, widened only by
    listed occurrences (Jack-O-Lantern Glow reads Oct 2–31, not Oct 2–18). `site/js/core/event-dialog.js` (D): when hours
    differ by day, the headline names the day its state word is about ("Thu, Oct 8: 5:30–10:00 PM ET") and every listed
    day follows (the first day's hours used to read as every day's).
  - `scripts/merge-research.mjs` (C): refuses to run without all eight research slice folders (it used to write empty
    data/ files); the research default is `.cache/research/` (gitignored, not in the repo); reverse-geocode seed hits are
    cached, so `.cache/geocode.json` alone reproduces the output; new tables `QA_TICKET_RESEARCH_NOTES`, `QA_FAQ_TOPIC`,
    `QA_VENUE_NAME` (logged under "QA audit" in data/README.md). `scripts/fetch-cincy-news.py` (G) sorts like the merge
    (date desc, then title), so running one after the other no longer reshuffles `data/news.json`.
  - `site/css/20-content.css`: on phones a stacked `table.data` hides an empty `td` (no label with nothing after it).
- **2026-09-24 · maintenance (BLINK's official folding map)** additive only; nothing renamed or removed; `npm test` green
  (`tests/blink-map.test.mjs`). Source: https://www.blinkcincinnati.com/files/assets/2026blinkfoldingmapmap.pdf, extracted by
  `scripts/extract-blink-map.py` into `research/blink-map/blink-map-2026.json` and applied by `scripts/apply-blink-map.mjs`
  (idempotent; `--check` writes nothing).
  - `build/core/schema.mjs`: `works.map_no` (int, the number printed on the program's own map; two works may share one),
    `works.aliases` (other published titles, e.g. BLINK's online-map title when the printed one differs; searchable, shown as
    "Also listed as"), `works.also_sources` (urls); `approx_m` (int, meters) on `works`, `venues` and `places`: the coordinates
    are an estimate read off a schematic map, and pages say "Approximate position (about ±N m)". Places: new kind `facility`
    with `facility` (`FACILITY_KINDS`: `oasis-station restroom merch-shop hospitality-zone hike-departure drone-viewing`;
    `FACILITY_LABEL`, `FACILITY_ICON`), `program`, `zone`, `map_no`, `also_sources`. `programs.maps: [{ label, url, as_of }]`
    (the organizers' own published maps).
  - `build/core/load.mjs`: a `facility` place needs `facility` and only a facility may have one; `places.program` is checked;
    `map_no` and `approx_m` must be ≥ 1; `approx_m` needs coordinates.
  - `build/core/client-data.mjs`: `works.json` works gain `mn` (map_no|null), `ak` (aliases), `as` (also_sources), `am`
    (approx_m|null). `art-extra.json` programs gain `s` (short name) and `map: [label, url]`.
  - `build/nav.mjs`: map.html `layers` accepts `facilities`; `focus` accepts `facility:<place id>`.
  - `build/core/icons.mjs`: icons `wc drop bag eye spark` (facility glyphs; `spark` marks BLINK's "Unique Attractions").
  - `build/core/crawl.mjs`: `search.json` gzip budget 70 → 76 KB (13 works and 13 facilities more; loaded on first search).
  - Components: `cards.byLine(work)` (the printed credit `artist_text` when set, else the linked people) and
    `cards.mapNo(work)` ("BLINK map No. 29"); the work card adds `p.wk-no > span.mapno`; `workMedium` of an `other` work with a
    category is the category ("Unique Attraction"). The work dialog shows `.wd-mapno` (the number and a link to the map),
    "Also listed as", "Approximate position", and every source. `.mapno` is styled in `62-art.css`.
  - Pages: art.html orders each program's works by its map (zone by zone, then number) and credits the map; program pages
    get the "Official map" fact and, when the program has a map, the `#official-map` section (only what the printed map shows:
    zones with their number ranges and numbered works, the facilities that cite the map, the source); getting-around.html gets `#blink-facilities` (every facility once, grouped `#fac-<facility>`);
    map.html gets the Facilities layer (`li.map-li[data-kind="facility"][data-layer="facilities"][data-ic][data-fl]`,
    `data-mn` on numbered works and facilities, `.pin-facility`, `.mk-facility`, `.lg-facility` in `50-map.css`); venue pages
    list nearby BLINK facilities. `mountMap` pins accept `kind: "facility"`, `ic` (glyph) and `mn` (read out in the label).
- **2026-09-25 · maintenance (Brand Fusion, a sixth program)** additive only; nothing renamed or removed; `npm test` green
  (new: `tests/home.test.mjs` "Brand Fusion: a lane on the week line…"). Source: https://brandfusioncincy.com/ (home,
  /know-before-you-go, /submit-challenges, /submit-nominations), recorded in `research/brand-fusion/brand-fusion-2026.json`.
  - `build/core/icons.mjs`: `PROGRAM_IDS` gains `brandfusion` (after `blink`); `BULLETS.brandfusion` = octagon, letters "BF"
    (the only two-letter bullet; `tight` sets its letter-spacing); `SHAPES.octagon`.
  - `site/css/tokens.css`: `--shape-octagon`, `--prog-brandfusion-{letter,shape}` and the five inks in the light, dark and
    prefers-dark blocks (olive; ink on paper ≥ 6:1, white on fill 5.4:1). `00-base.css`: the scope rule, `data-prog2`,
    `.prog-dot` octagon. `50-map.css`: `.pin-work` octagon; the cluster ring takes `--x` (Brand Fusion's share) between
    BLINK and FotoFocus (`PROG_KEY` in `map.js` and the `program.mjs` share map: `brandfusion: "x"`).
  - `build/nav.mjs`: `PROGRAM_PAGES` entry `brand-fusion` (after BLINK) with `festival: false`: a program page may say it
    is not one of the week's festivals. `home.mjs` `weekLanes()` lanes carry `festival`; the interchange, the "N festivals"
    headline and the day summaries count festival lanes only (every lane is still drawn).
  - `build/core/schema.mjs`: `programs.participants: [{ label, names[], note, as_of, source_url }]` (who takes part, as the
    organizers list them); `stays.room_block.label` (the program's own word when it is not a published block, e.g.
    "recommended hotel") and `stays.room_block.source_url`.
  - Program pages: when no ticket has a `price`, "How to take part" (`#tickets`, columns How / Details, the contact email)
    replaces "Tickets and passes" and the Admission fact reads "No public tickets listed · N ways to take part";
    `participants` become a `#participants` section (`ul.prog-names`, styled in `31-program.css`) and their names join the
    program's search keywords. Home program cards leave out zero counts and add "N participating brands";
    `.prog-cards` columns are at least 300px (five cards: 3 + 2).
  - stay.html: a labeled `room_block` reads "<Program> <label>", its button "Book with the organizers' link", with the
    block's own source; the section is "Program room blocks and hotels" when one is labeled. `schedule.mjs` `TICKS` and
    `BAND_PROG`, `home.mjs` and `athour.js` `FEST` list `brandfusion` (ranked after the festivals).
