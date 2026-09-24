# Cincy Week

**One guide to the first week of October 2026 in Cincinnati:** Cincinnati Art Week (Oct 3–10),
StartupCincy Week (Oct 5–8), BLINK (Oct 8–11), the FotoFocus Biennial (Sep 30–Nov 1) and other
verified happenings, with every session, person, artwork and venue linked to its source.

Live at **https://fritzhand.github.io/cincy-week/** (once published).

> Status: engine and design system in place; content pages are landing module by module. Pages that are
> still being built say so. The data in `data/` is a small provisional sample (see `data/README.md`).

## What's in it

- **The Week**: every event by day, with live status during the week ("Now", "In 20 min", "Ended").
- **My Plan**: star events and artworks; your plan stays in your browser (no account, nothing sent).
- **Map**: a custom OpenStreetMap basemap that follows the light and dark editions and works offline once loaded.
- **Directory**: people, art and installations, venues, sponsors and partners.
- **Visit**: where to stay (program room blocks), getting around, neighborhoods, eat and drink, FAQ.
- **Search** everything with ⌘K / Ctrl K or `/`.

## Run it locally

Requires Node 18 or newer. No npm install: the build has zero dependencies.

```sh
npm run dev        # builds docs/ and serves it at http://localhost:8000/ (and /cincy-week/)
npm test           # unit tests, fixture builds and "broken data" checks
```

Open the site over http (the dev server), not as a file: the pages use JavaScript modules.

Working on one part of the site while others work on theirs? Build into a private folder so nobody's
`docs/` gets overwritten: `CW_OUT=.cache/out-me node build.mjs`, then `CW_OUT=.cache/out-me node scripts/serve.mjs`.
The module contracts are in `build/CONTRACTS.md`.

To see the "during the week" states before October, add `?now=2026-10-08T19:30` (New York time) to any
local URL. Screenshots for review: `NODE_PATH=<global node_modules> node scripts/shots.mjs` (needs Playwright).

## How it works

`data/*.json` holds every fact, each with a `source_url`. `node build.mjs` validates it (and stops, listing
every problem, if anything is wrong), renders every page into `docs/`, checks every link in the output,
and only then replaces `docs/`. GitHub Pages serves `docs/`. See **CLAUDE.md** for the full operating
manual: data rules, file ownership, contracts and validations.

```
data/            content (JSON)             build/      the build (Node, no dependencies)
site/            CSS, JS, fonts, images     scripts/    dev tools (server, screenshots, social cards)
tests/           node:test suites           docs/       the generated site (do not edit)
```

## Publish

Settings → Pages → Deploy from a branch → `main` → `/docs` → Save. Or use `.github/workflows/deploy-pages.yml`,
which copies `docs/` to a `gh-pages` branch on every push (then serve `gh-pages` / root).

## Credits and corrections

An independent guide, not affiliated with the organizers; always check the official sites. Descriptions,
portraits, logos and artwork images come from the programs' public sites and are credited to them. Map data
© OpenStreetMap contributors (ODbL). Type: Newsreader and Public Sans (SIL Open Font License 1.1).
Something wrong, or yours and you want it removed? Open an issue.

Built and maintained by [Jeremy Fritzhand](https://github.com/fritzhand). MIT license for the code.
