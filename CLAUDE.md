# CLAUDE.md — operating manual for Cincy Week

## What this is

**Cincy Week** (https://fritzhand.github.io/cincy-week/) is an independent, source-linked guide to the first
week of October 2026 in Cincinnati: **Cincinnati Art Week** (Oct 3–10), **StartupCincy Week** (Oct 5–8),
**BLINK** (Oct 8–11), the **FotoFocus Biennial** (Sep 30–Nov 1) and other verified happenings. It is a
zero-dependency static site: `data/*.json` → `node build.mjs` → `docs/` (GitHub Pages).

The shell and UX come from `fritzhand/startup-india-guide` (SIG: grouped icon sidebar, rail, drawer, ⌘K,
TOC, footer), hardened with `fritzhand/quickstart` (QS: fail-before-write, crawler, focus traps, lazy
search). The visual system is **"Interchange"**: a city paper's special section routed like a transit map
(each program is a line, each day a station, Thursday Oct 8 the interchange). Owner: Jeremy Fritzhand.

**Status (Sep 24, 2026): built, audited and integrated.** Seven agents built it in parallel lanes (A engine, B design,
C data, D schedule, E map, F directory, G home and programs), then two QA passes (data accuracy, UX) and an
integration pass. From here the site is in **maintenance mode**: one maintainer at a time owns the whole tree, and
most work is correcting or adding records in `data/*.json`. Start with "Maintaining the site during the week" below.

## The rules that never bend

1. **Never invent a fact.** No invented time, room, price, address, person, quote, count or claim. Every
   record in `data/` carries a `source_url` (the build fails without it). Unknown is `null`, never "TBA",
   "TBD", "N/A" or a guess; pages print unknowns as unknowns ("Room not listed", "end time not listed",
   "Address unconfirmed · not on the map"). Estimates (walking times) are labeled as estimates.
2. **Descriptions and bios are verbatim** from the source (whitespace normalized, paragraphs as `\n\n`).
   Plain text only: no HTML tags, no entities (`&amp;`, `&#8217;`, `&nbsp;` fail the build).
3. **https only.** `http://` fails the build. External links open in a new tab and say so.
4. **Color literals live only in `site/css/tokens.css`.** No `#hex`, `rgb()`, named colors in partials or
   in generated `style=""`. Program color marks program identity only (DESIGN §3.2).
5. **Nothing under 12px; touch targets ≥ 44px on phones; every state is a word, never color alone.**
6. **`docs/` is generated.** Never hand-edit it. Run `node build.mjs` and commit `docs/` with your change.
7. **Never rename an id.** Event, work, person and venue ids are in URLs (`?e=`, `people/<id>.html`), in
   shared My Plan links (5-character codes derived from the id) and in readers' saved plans. Cancel instead of
   deleting; add instead of renaming. `build/core/*` contracts are only extended (the Changelog at the end of
   `build/CONTRACTS.md` records every change, including the one removal: `d` moved to `event-text.json`).

## Maintaining the site during the week

### The loop (every change, however small)

1. **Find the record.** The id is in the page URL: `schedule.html?e=<event id>`, `people/<id>.html`,
   `venues/<id>.html`, `art.html?w=<work id>`, `partners.html#o-<org id>`. Then `grep -n '"id": "<id>"' data/*.json`.
2. **Check the fact at its source** (the organizer's page, not a repost). No source, no change.
3. **Edit `data/<file>.json`.** Keep `source_url` pointing at the page that now states the fact. Record why in the
   record's `notes` (never rendered), e.g. `"notes": "2026-10-06: start 18:00 → 18:30 per the BLINK schedule page"`.
4. **Build and read every line:** `node build.mjs`. Errors name `data/<file>.json#<id>.<field>`; fix them and
   rebuild. `docs/` is only replaced when there are no errors. Warnings are listed (grouped); a new one is worth reading.
5. **Test:** `npm test` (about 30 s).
6. **Look:** `npm run dev`, open the page you changed at http://localhost:8000/cincy-week/ (add
   `?now=2026-10-08T19:30` for the during-the-week states), or run the audit:
   `NODE_PATH=<global node_modules> node scripts/shots.mjs --pages schedule,index` (overflow, text under 12px, targets
   under 44px, console errors; PNGs in `.cache/shots/`).
7. **Commit `data/` and `docs/` together** on `main` (the `test.yml` check fails when `docs/` was not rebuilt).
   Publishing follows from the push (see Deploy).

`data/*.json` is the source of truth now. The research it was merged from is a frozen snapshot in `research/` (see
"Regenerating data/" below), kept for provenance: never try to fix a record by re-running the merge.

### Correct an event (time, date, room, venue, price)

Fields (`build/core/schema.mjs` → `events`): `date` `YYYY-MM-DD`; `start`/`end` `HH:MM`, 24-hour New York time
(`end: null` when the source gives none: pages say "end time not listed"; an end before the start means after
midnight and must be ≤ 06:00); `room`; `venue_id` (an id in `venues.json`) or `location_text`; `cost` (the source's
words) and `is_free` (`true`/`false`/`null`, never inferred from `cost`); `registration_url`; `time_text` (the source's
own wording when it is vague). An approximate time gets the tag `approximate-time` in `tags`: pages print "About 7:00 PM".
- **Several days:** `date` + `end_date` (a run: an exhibition, a nightly show). When hours differ by day or days are
  skipped, list them in `occurrences: [{ date, start, end }]` (only days inside `dataWindow` in `site.config.json`,
  Sep 26–Oct 18). `hours_text` holds opening hours the source gives as prose ("Tue–Sun 11–5").
- **Cancelled:** `"status": "cancelled"`. Do not delete the record: the card and dialog say "Cancelled", it leaves
  the counts, "Now" and the live pill, and saved plans and links keep working.
- **Changed at short notice:** update the fields and set `"status": "changed"` (a "Changed" badge) for the rest of the day.

### Add an event

Append a record to `data/events.json` (order does not matter; the build sorts):
```json
{
  "id": "blink-2026-10-09-example-talk",
  "program": "blink", "title": "Exact title from the source", "kind": "talk",
  "date": "2026-10-09", "start": "18:00", "end": null,
  "venue_id": "court-street-plaza", "room": null, "location_text": null,
  "description": "Verbatim from the source; paragraphs separated by a blank line (\n\n).",
  "people": ["person-id"], "people_roles": { "person-id": "Moderator" },
  "cost": null, "is_free": true, "registration_url": null,
  "tags": [], "source_url": "https://www.blinkcincinnati.com/…"
}
```
- `id`: lowercase, hyphens, **starts with its program** (`caw- scw- blink- fotofocus- also-`), unique across
  `events.json` and `works.json`. `kind` is one of `keynote panel workshop fireside networking party pitch exhibition
  installation performance talk tour market screening other`.
- People without a person record go in `credits: [{ "role": "Artists", "names": ["…"] }]` (plain text, searchable).
- `featured: true` only when the organizer features it: it feeds the home page's highlights and day summaries.

### Add or correct a person

`data/people.json`: `id` (the name, slugified), `name`, `roles` (`speaker artist curator performer moderator organizer
judge host founder panelist facilitator mentor`), `programs`, `title`, `org`, `bio` (verbatim), `headshot_url` (the
image on the organizer's page), `location`, `links` (`website instagram linkedin x …`), `source_url`, `also_sources`
(other pages the bio or photo came from). Roles and programs are merged with what their events and works imply, so
linking is done from the event: add the person's id to `events[].people` (and a role label in `people_roles`) or to
`works[].artists`. A person with no event, work or bio gets a "people with nothing to show" warning.
- **Headshot:** set `headshot_url`, then `python3 scripts/fetch-images.py` (Pillow needed; incremental; writes
  `site/img/p/<id>.webp` + `data/images.json`), then build. Check the crop on the person page.
- **Remove a person:** delete the record and every reference to the id (the build lists each dangling one).
- **Takedown request** (a photo or bio someone wants removed): set `headshot_url` (or `bio`) to `null`, run
  `python3 scripts/fetch-images.py --offline` (drops the manifest entry and the file), build, commit. Same for
  `orgs[].logo_url` and `works[].image_url`.

### Add a sponsor or partner

`data/orgs.json`: `id`, `name`, `roles: [{ "program": "blink", "relationship": "sponsor", "tier": "the program's own
tier label", "tier_rank": 1 }]` (`relationship`: `presenting sponsor sponsor partner organizer founding partner media
partner venue community partner funder`; `tier_rank` 1 is the top tier and orders the wall), `logo_url`, `url`,
`source_url`. Then `python3 scripts/fetch-images.py` for the logo. If a logo lands on the wrong plate (dark ink on
black), add its id to `TONE_OVERRIDE` in `scripts/fetch-images.py` and re-run with `--force`.

### Add or fix a venue

`data/venues.json`: `id`, `name`, `kind` (`venue zone gallery studio museum hotel park street bar restaurant outdoor
other`), `address`, `city`, `state`, `zip`, `hood` (a `places.json` id with `kind: "neighborhood"`) or free-text
`neighborhood` (resolved through `aliases.json`), `lat`/`lng` (both or neither; take them from OpenStreetMap),
`url`, `accessibility`, `source_url`. **Append new venues at the end:** map pin numbers are assigned in file order
to venues on the basemap, so inserting one in the middle renumbers the pins after it. A venue without coordinates
prints "Address unconfirmed · not on the map" and gets a warning; that is correct when the organizers give no place.

### Other records

- **Where to stay** (`stays.json`): `room_block` only for a published block (`group_code`, `rate`, `deadline`,
  `booking_url`, `status`, e.g. "Closed: block full (checked Oct 2, 2026)"); `booking_portal` for BLINK's portal hotels.
- **FAQ** (`faqs.json`): `q` and `a` verbatim, `topic` = the source's own heading. **Facts** (`facts.json`): `label`,
  `value`, `as_of`, `source`, `quote` (the sentence it rests on). The home stat tiles use the ids in `HOME_FACTS`
  (`build/pages/home.mjs`).
- **Program pages** (`programs.json`): `tickets[].details` is shown (the organizer's words); `tickets[].notes` never is.

### News

`refresh-news.yml` runs `scripts/fetch-cincy-news.py` on a schedule (daily in September, every 6 hours Oct 1–12,
daily to Oct 31), rebuilds, commits `data/news.json` + `docs/` and deploys. By hand: `python3 scripts/fetch-cincy-news.py`
(`--dry-run` to preview), then build. Only allowlisted outlets and headlines that name a program get in (the
allowlist and queries are at the top of the script). A curated item is added by hand to `data/news.json` (`id`,
`title`, `source`, `date`, `url`, `programs`, `summary`: one factual line of our own or `null`, `kind`); the fetcher never
changes curated items, and both writers keep the file sorted newest first, then by title.

### Images

`python3 scripts/fetch-images.py` downloads what `headshot_url`, `logo_url`, `programs[].logo.url` and
`works[].image_url` point at, once, and writes small WebP/SVG copies to `site/img/{p,o,w}/` and the manifest
`data/images.json`. Flags: `--retry-failed` (earlier failures), `--force` (reprocess cached originals),
`--offline` (no network), `--only p/<id>,o/<id>` (just those). Originals are cached in `.cache/img-src/` (gitignored,
262 MB); without that cache a `--force` run re-downloads. Never hotlink; the build fails on a manifest file that does not exist.

### The clock, the week and the phases

`site.config.json` holds `week` (Oct 3–11), `dataWindow` (Sep 26–Oct 18) and the time zone. Before Oct 3 the home
page counts down; during the week it shows "At this hour" and the live pill; after Oct 12 05:00 ET it switches to
the "after" state. Nothing needs rebuilding for these: the client reads the clock. Test any moment with
`?now=2026-10-08T19:30` on localhost (or after `localStorage.setItem("cw-debug","1")` on the live site).

### Regenerating data/ (rarely; read this first)

`scripts/merge-research.mjs` merged the eight research slices into `data/` once. The research is kept in the repo as
a frozen Sep 24, 2026 snapshot in `research/` (one folder per slice, each with its JSON, parser reports and
`SCHEMA.md` at the top, plus the Nominatim cache `research/geocode.json`), so every record's provenance survives.
`node scripts/merge-research.mjs --offline` reproduces today's `data/` byte for byte from it. Re-running it
**replaces data/** and loses every hand edit made since, so after Sep 24 correct records by hand as above and never
re-run the merge to fix a record. If a regeneration is ever needed, run it, then `git diff data/` and re-apply the
hand edits (their `notes` say what and why). Its judgment calls are named tables (`QA_*`, `PERSON_MERGES` …) logged in
`data/README.md`. The raw page captures behind the research (about 640 MB) were not kept.

### What lives in .cache/ (gitignored, never committed)

`geocode.json` (Nominatim cache for new lookups when `research/geocode.json` is absent), `img-src/` (image originals), `osm/`
(Overpass responses for `scripts/build-basemap.mjs`), `shots/` (audit screenshots), `out-*/` (private builds). None
of it is needed to build the site; each is needed only to re-run the script that made it.

## Commands

```sh
node build.mjs                      # build → docs/ (exits 1, listing every problem, and leaves docs/ untouched on failure)
npm test                            # node --test tests/*.test.mjs (unit tests + fixture builds + BROKEN mutations)
npm run dev                         # build, then serve docs/ at http://localhost:8000/ and /cincy-week/
NODE_PATH=/opt/node22/lib/node_modules node scripts/shots.mjs [--pages a,b] [--now 2026-10-08T16:40] [--states] [--full]
NODE_PATH=/opt/node22/lib/node_modules node scripts/og.mjs && node build.mjs    # social cards (site/og*.png)

python3 scripts/fetch-cincy-news.py [--dry-run]    # news → data/news.json (then build)
python3 scripts/fetch-images.py [--retry-failed]    # images → site/img + data/images.json (then build)
node scripts/merge-research.mjs --check             # validate a regeneration without writing (reads research/)

# a private build next to docs/ (for trying something without touching docs/, or two people at once)
CW_OUT=.cache/out-me node build.mjs
CW_OUT=.cache/out-me PORT=8124 node scripts/serve.mjs         # http://localhost:8124/cincy-week/
CW_OUT=.cache/out-me NODE_PATH=/opt/node22/lib/node_modules node scripts/shots.mjs --pages schedule --states
```
**`build/CONTRACTS.md` is the exact API reference** (page modules, `ctx`, `db`, components, markup, client
`app`, JSON outputs, deep-link values, tests). Read it before coding a domain module.
Pages use ES modules: open them over http (`npm run dev`), not `file://`. QA the "during the week" states
with `?now=2026-10-08T16:40` (New York time); it works on localhost, or anywhere with
`localStorage.setItem("cw-debug","1")`. `?theme=light|dark` forces an edition.

## How the site is built

```
site.config.json        siteName, siteTagline, siteBase, pathPrefix (/cincy-week/), repo, author, timezone,
                        week {start,end}, dataWindow {start,end}, analyticsId (empty = no analytics)
data/*.json             the single source of truth (shapes below; data/README.md = provenance and merge log)
build.mjs               orchestrator: config → load+validate → tokens/CSS lint → page modules → render into
                        docs.tmp/ → crawl → atomic swap to docs/
build/nav.mjs           the navigation: NAV (5 numbered sections), PROGRAM_PAGES, DOCK, PARAMS (accepted query keys)
build/core/*.mjs        engine (A): util icons load schema time components shell images seo search crawl write client-data
build/components/*.mjs  entity renderers (event, person, venue, work, org) — owned by domain agents
build/pages/*.mjs       one module per page family; files starting with "_" are helpers, not modules
site/css/tokens.css     the only file with color/font literals (fonts: site/fonts, self-hosted, OFL)
site/css/NN-*.css       partials, concatenated in lexical order → docs/assets/site.css
site/js/main.js         client entry (module): core init + dynamic import of site/js/features/<name>.js
site/js/core/*.js       client runtime; site/js/lib/*.js pure libraries shared with the build and node:test
site/img/{brand,p,o,w}  brand files and downloaded images (data/images.json is the manifest)
site/map/basemap.svg    token-themed OSM basemap (<g id="bm">), used by maps and mini-maps via <use>
tests/                  node:test suites + tests/fixtures/mini (the fixture every build test uses)
docs/                   GENERATED — what Pages serves (docs/assets holds css, js, fonts, img, map, data/*.json)
```

## Who built what (and who maintains it now)

Since the integration pass (Sep 24) the **maintainer owns every file**; there are no lanes to respect. The table
records where each part came from, so you know whose header comments and tests describe it. Every file's header
names its original owner.

| Built by | Files |
|---|---|
| **A · Core engine** (and the integrator) | `build.mjs`, `build/nav.mjs`, `build/core/*` (except the two below), `build/pages/_stub.mjs`, `site/js/main.js`, `site/js/core/*` (except the two below), `site/js/lib/{time,filters,search,share,text}.js`, `site/css/{00-base,10-shell,20-content,80-dialogs,90-pages,99-print}.css`, `scripts/{serve,shots}.mjs`, `tests/build.test.mjs`, `tests/helpers.mjs`, `tests/{time,filters,search,share,integration}.test.mjs`, `tests/fixtures/mini/*`, `build/CONTRACTS.md`, `.github/workflows/*`, `package.json`, `CLAUDE.md`, `README.md`, `.github/screenshots/*`, `.gitignore` |
| **B · Design system** | `site/css/tokens.css`, `site/fonts/*`, `site/favicon.svg`, `site/img/brand/*`, `scripts/og.mjs`, `site/og*.png` |
| **C · Data** | `scripts/merge-research.mjs`, `scripts/merge-lib.mjs`, `data/*.json` except `images.json`, `map.json`, `news.json`; `data/aliases.json`; `data/README.md`; `tests/data.test.mjs` |
| **D · Schedule & plan** | `build/pages/{schedule,plan}.mjs`, `build/components/event-card.mjs`, `site/js/features/{schedule,plan}.js`, `site/js/core/event-dialog.js`*, `site/js/lib/{ics,agenda}.js`, `site/css/{40-schedule,41-plan,81-event-dialog}.css`, `tests/{ics,agenda,schedule}.test.mjs` |
| **E · Map, venues & visit** | `scripts/build-basemap.mjs`, `site/map/*`, `data/map.json`, `site/js/lib/geo.js`, `site/js/features/map.js`, `build/components/venue-card.mjs`, `build/pages/{map,venues,visit}.mjs`, `site/css/{50-map,51-venues,70-visit}.css`, `tests/geo.test.mjs` |
| **F · Directory** | `scripts/fetch-images.py`, `site/img/{p,o,w}/`, `data/images.json`, `build/core/images.mjs`*, `build/components/{person-card,work-card,org-logo}.mjs`, `build/pages/{people,art,partners,_directory}.mjs`, `site/js/features/directory.js`, `site/js/lib/directory.js`, `site/js/core/work-dialog.js`*, `site/css/{60-directory,61-person,62-art}.css`, `tests/directory.test.mjs` |
| **G · Home, programs & info** | `build/pages/{home,program,news,faq,about}.mjs`, `site/js/features/{home,faq,news,progdays}.js`, `site/js/lib/{week,athour}.js`, `scripts/fetch-cincy-news.py`, `data/news.json`, `site/css/{30-home,31-program,85-news,86-faq}.css`, `tests/{home,week,athour}.test.mjs` |
| **QA passes** | `tests/qa-data.test.mjs` (data-accuracy audit), `tests/qa-ux.test.mjs` (UX audit); their write-ups are `.cache/qa-data.md` and `.cache/qa-ux.md` (local only) |

\* lives under `core/` for path reasons. The CSS partials keep the design's numbering (00…99) and are concatenated
in name order; a new partial is `NN-name.css`. Tokens (colors, fonts, sizes) only ever change in `tokens.css`.

## Contracts (code against these)

The summary below is kept short; `build/CONTRACTS.md` has every signature and markup contract.

### Page modules — `build/pages/<name>.mjs`
```js
export function pages(ctx) {            // required; may return many pages (detail pages)
  return [{ path: "schedule.html",      // flat "x.html", or "people/<id>.html" / "venues/<id>.html"
            nav: "schedule",            // which sidebar/dock item is aria-current (detail pages: their parent)
            title, description,         // plain text; <title> = "title · Cincy Week"
            body: (root) => html,       // root = "" or "../" (404: pathPrefix); prefix every internal URL
            toc: [[id, label]],         // optional: TOC rail (≥1280px) + collapsed list (≥5 items)
            crumbs: [[label, href|null]], // optional; default Overview / <nav label>; [] for none
            pagenav: { prev, next } | null, // optional; default prev/next in NAV order for nav pages
            features: ["schedule"],     // client modules to load: site/js/features/<name>.js (must exist)
            head: "<link …>",           // optional extra <head> HTML
            modals: (root) => html,     // optional dialogs/sheets, rendered outside .layout (inert-safe)
            jsonld: {…}, og: "og-blink.png", noindex: false, pageClass: "" }];
}
export function search(ctx) { return [/* { k, id, t, s, u, p, g, i, st, en } */]; }   // optional
export function data(ctx) { return { "assets/data/<name>.json": obj }; }             // optional JSON outputs
```
Every page renders its own page head (`c.pageHead`, the page's only `<h1>`) and body; the shell adds the
topbar, sidebar, crumbs, TOC, prev/next, footer, dock, toast, search palette, `#event-dialog`, `#work-dialog`.

### `ctx` (the same object for every module)
```js
ctx = {
  config,                       // site.config.json
  db,                           // build/core/load.mjs (see "Data" below)
  h: { esc, attr, paras (text → <p>), slugify, hostOf, extLink(href, html, cls), plural, listJoin, truncate,
       initials, sortBy, groupBy, hash8, HTML_IN_TEXT,
       icon(name, cls), bullet(prog, "lg"|"xl"), wordmark(cls), riverRule(cls, tick),
       fmtDay, fmtDayLong, fmtDate, fmtTime, fmtRange, fmtDateRange, fmtDowRange, isoLocal, url(root, path) },
  c: { crumbs(root, items), pageHead({ kicker, num, title, titleHtml, lede, dek, chips, prog, cls }),
       facts(root, [[label, valueHtml]]), section({ id, title, kicker, num, icon, more:{href,label}, body, anchor, root }),
       callout(tone ""|"tip"|"warn"|"org", html, { flag, prog, cite }), chip(label, href, { count, pressed, prog, root }),
       progBadge(id), progDot(id), progName(id, short), PROGRAM_LABELS, starButton(id, title, { kind: "e"|"w", cls }),
       badge(kind, text), emptyState({ title, body, action, glyph, prog }), toolbar(spec), resultCount(n, total, noun),
       pagenav(root, prev, next), toc(items), tocMobile(items), keylinks(root, [{href,label}]),
       sourceLine([urls], { label, note }), placeholder(what, owner), secNum(n), avatar(root, person, size) },
  img: { img(root, kind, id, opts), has, entry, path(kind, id), mug(root, person, { size, alt, prog }),
         logo(root, org), photo(root, work) },            // kind: "p" person · "o" org · "w" work
  cards: { eventCard(root, evOrInstance, { anchor, headingLevel, span }), eventRow(root, instance),
           eventList(root, instances, { groupBy: "day"|"none", headingLevel }),
           personCard(root, person), avatarStack(root, people, max), venueCard(root, venue),
           miniMap(root, lat, lng, { prog, n, label }), directions(lat, lng), workCard(root, work),
           orgLogo(root, org), logoWall(root, entries) },
  map: { miniMap }, seo: { programLd, personLd, placeLd, eventLd }, time: lib/time.js,
  fail(where, msg), warn(where, msg, group?), buildDate, nav: { NAV, NAV_SLUGS, PROGRAM_PAGES },
}
```

### Data (`db`, built by `build/core/load.mjs`)
Arrays: `programs events people works venues orgs stays places faqs news facts`; objects: `aliases images map`.
Indexes: `byId.{program,event,person,work,venue,org,place,stay,faq,news}` (Maps), `instances` (every
event-day, sorted by start), `eventsByDay` (festival day → instances), `eventsByPerson`, `eventsByVenue`,
`eventsByProgram`, `eventsByHood`, `worksByPerson`, `worksByVenue`, `orgsByProgram` (tier-ordered
`[{ org, role }]`), `venuesByHood`, `peopleByRole`, `placesByKind`, `days` (`[{ date, inWeek, before, after,
count }]`), `week`, `phaseInstants { weekStart, weekEnd }`, `code(id)`, `codeToId`, `nearby(lat, lng, m)`, `counts`.
Derived fields on records: `event.kg` (kind group: talks, hands-on, social, art, pitch, other),
`event.instances`, `event.day`, `event.venue`, `event.hood`, `event.live`; `person.roles/programs`
(merged with events and works), `person.events`, `person.works`; `venue.programs` (derived), `venue.stall`
(1…n for venues with coordinates, in data order), `venue.events`.
An **instance** is `{ id, ev, date, day, s, e, start, end, lateNight, endUnknown, timeUnknown, allDay, ongoing }`
(`s`/`e` epoch ms; a missing end is start + 60 min, flagged; 00:00–04:59 starts belong to the previous
festival day; multi-day items expand to one instance per day inside `dataWindow`).

### Client (`site/js/main.js` → `init(app)` in every feature)
`app = { root, page, now(), onTick(fn), phase(), data(name), store, plan: { has, toggle, add, replace,
clear, list, count, subscribe, refresh }, modal: { show(el, { trigger, focus, onClose }), hide(), current() },
toast(text, { link, ms }), status: { update(now, root), statusOf }, share({ title, text, url }), copyText,
openEvent(id), openWork(id), openSearch(trigger, q) }`.
- `assets/data/events.json` / `event-text.json` (descriptions, loaded on first dialog open or .ics export) /
  `works.json` shapes: header of `build/core/client-data.mjs`.
- `assets/data/search.json`: `{ v: 1, items: [{ k, id, t, s, u, p, g, i, st, en }] }`; kinds `ev pe wo ve pr pg or fq pl st nw`.
- Storage keys (`cw-theme cw-rail cw-plan cw-prefs cw-seen-shared cw-debug`): header of `site/js/core/store.js`.
- Live state: any element with `data-s`/`data-e` gets `data-status` (upcoming | soon | live | started | past) and a
  word in its `[data-status]` label every minute; `data-end-unknown="1"` never claims "Now".
- Stars: any `button[data-star="<id>"]` (`data-star-kind="w"` for works) is wired, labeled and counted.
- Dialogs: any `[data-open-event="<id>"]` / `[data-open-work="<id>"]` opens the dialog (links keep their deep-link href).
- Pure libs (`site/js/lib/`): `time` (nyToEpoch, nyParts, expand, status, fmt*), `filters` (parse/serialize/matches
  for URL state), `search` (norm, prepare, search, group, mark), `share` (code, planHash, decode), `text`; `geo` (E), `ics` (D).

### Markup and CSS vocabulary
Shared classes (A, `20-content.css`): `.page-head .kicker .lede .dek .crumbs .oxford .sec-num .section .sec-head
.sub-h .prose .facts .fact .source-line .callout .tone-{tip,warn,org} .btn .btn-{primary,secondary,ghost,river,sm}
.btn-row .star .badge .badge-{live,soon,started,past,free,plan,warn,out,unconfirmed} .chip .chip-row .card .grid
.grid-2 .grid-3 .stretched .toolbar .field .select .view-toggle .result-count .empty-state .az .table-wrap
table.data .toc .toc-mobile .pagenav .avatar(.s .m .l .mono) .avatar-stack .count .count-pill .sr-only .label
.tnum .muted .faint .unk .i .bullet .prog-badge .prog-dot .prog-u .halftone .h-anchor .spaced .h-card .js-only
.tonight` (the 74px time-first list used by home, venue, person and program pages).
Program scope: `[data-prog="caw|scw|blink|fotofocus|also"]` (or `article.ev[data-p]`) sets
`--ink-fill --ink-text --ink-on --ink-tint --ink-edge`; components read only those. Domain prefixes:
`.ev-* .evd-* .dt-* .slot-* .wk-* .nn-* .plan-* .map-* .pin-* .mini-map .venue .stall .vp-* .stay .person
.per-* .dp-* .work .wall-* .plate .home-* .prog-* .news-* .faq-*`. Token names: see `tokens.css` (DESIGN §3, §12).
Program bullets: `<svg class="bullet"><use href="#b-caw"/></svg>` (via `h.bullet`); icons: `h.icon(name)` (the
sprite is inline once per page; unknown icon names fail the build).

### Where things go (per domain)
- CSS: the partial that styles that part (table above); tokens only. A new color or size is a new token in `tokens.css`
  (light and dark blocks both).
- Client JS: `site/js/features/<name>.js` exporting `init(app)`, listed in your page's `features`; pure logic in
  `site/js/lib/<name>.js` with a `tests/<name>.test.mjs`.
- Build: your `build/pages/*.mjs` and `build/components/*.mjs`. Deep links must use the params in `PARAMS`
  (`build/nav.mjs`) with values that exist (`paramValues`: `p=` a program, `e=` an event, `day=` a day…);
  a new param is a one-line addition there. `k=` takes kind groups or single kinds (cards carry `data-k`).
- Tests: `tests/<area>.test.mjs` using `tests/helpers.mjs` (build tests run on a copy with `tests/fixtures/mini` as
  data, so they never touch `data/` or `docs/`). Tests that read the real `data/` skip when it is not the merged data.

## Data rules (for anyone adding or correcting a record)

Shapes: engine spec §4.3, enforced field by field in `build/core/schema.mjs` (unknown keys fail, listing
the allowed ones; `notes` is allowed everywhere and never rendered). Highlights:
- ids `^[a-z0-9][a-z0-9-]*$`, unique per file; **event and work ids start with their program** (`scw-…`,
  `blink-…`) and are unique across both files (shared URL space).
- Program ids are a closed set: `caw scw blink fotofocus also`. `programs[].slug` must be a
  `PROGRAM_PAGES` slug (`also` has `slug: null`: it lives on the FotoFocus & more page).
- Dates `YYYY-MM-DD` inside `dataWindow` (a multi-day item must overlap it); times `HH:MM`, New York wall
  clock; `end < start` only for after-midnight ends ≤ 06:00; `all_day` has no times; a missing `start` means
  hours not listed. `is_free` is explicit (true/false/null) — never inferred from `cost`.
- `venue_id` or `location_text` on every event; `venue.hood`/`stay.hood`/`place.hood` are `places.json` ids
  with `kind: "neighborhood"` (spelling variants go in `aliases.json`, normalized keys).
- Coordinates: both or neither; outside 38.4–40.4 N, 85.2–82.4 W fails (swapped/mistyped), outside the map
  region warns ("not on the map").
- Images: never hotlink. `scripts/fetch-images.py` (F) downloads into `site/img/` and writes `data/images.json`.

**Adding data:** edit or regenerate `data/*.json`, run `node build.mjs`, read every error (they name
`data/<file>.json#<id>.<field>`), fix at the source, rebuild, commit `data/` and `docs/` together.

## What the build rejects (fails, lists everything, never writes docs/)
Config errors; missing/invalid JSON; unknown keys; missing required fields; wrong types or enums;
duplicate ids; dangling references (program, venue, person, work, org, hood, program pages); dates outside
the window; suspicious times; placeholder strings (also "Speaker TBA" inside short text; a warning inside
long verbatim prose); HTML or entities in text; values of the wrong type (reported, never a crash); `http:` or malformed URLs;
coordinates outside the region; share-code collisions; missing image files; missing program tokens,
theme-color or dark block in tokens.css; color literals or text under 12px in CSS partials; a nav page with
no producer, two producers, or an orphan page; a feature without a JS file; and, crawling the output:
broken links/anchors/srcset/query keys, query values that name nothing (`?p=nope`, an unknown `?e=`),
`url(…)` in the CSS that does not resolve (fonts), `href="#"`, external links without the new-tab note, ≠ 1 `<h1>`, duplicate
ids, missing title/description/canonical/aria-current, `<img>` without alt/width/height, inline color,
unresolvable search entries, an incomplete sitemap, relative links on 404. It **warns** (grouped) on thin
records, venues with events but no coordinates, images not downloaded yet, and size budgets.

## Tone and voice
Plain American English, second person, short sentences, no marketing language, no emoji. Headlines state
the news; kickers are a section plus a fact. Times: `9:00 AM`, `4:00–9:00 PM` (one AM/PM when shared),
`About 7:00 PM`; dates `Oct 3–10`, `Thu, Oct 8`; relative `in 20 min`, `Started 40 min ago`. Quote
organizers' taglines in quotation marks with a source; never use one as our headline. Name the official
source on every page.

## Deploy
`docs/` is committed on `main`. Either Settings → Pages → Deploy from a branch → `main` → `/docs`, or
`.github/workflows/deploy-pages.yml` publishes `docs/` to `gh-pages` on every push touching `docs/**`
(then serve `gh-pages` / root). `refresh-news.yml` rebuilds with fresh news on a schedule and deploys itself.
`test.yml` runs the build and `npm test` on every push (except to gh-pages) and pull request, and fails when
`docs/` has new, changed or deleted files that were not committed (about.html's date excepted).
