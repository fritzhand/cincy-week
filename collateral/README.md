# Launch collateral, September 2026

Social cards announcing [Cincy Week](https://fritzhand.github.io/cincy-week/), generated from the
site by [`build-cards.mjs`](./build-cards.mjs). Post copy and card order are in each folder.

| Folder | What | Post copy |
|---|---|---|
| [`linkedin-2026-09/`](./linkedin-2026-09/) | Eight 1080×1350 cards and `cincy-week-carousel.pdf` (the same eight as a document post) | [`CAPTION.md`](./linkedin-2026-09/CAPTION.md) |
| [`instagram-2026-09/`](./instagram-2026-09/) | Six 1080×1350 carousel cards and three 1080×1920 Stories | [`caption.md`](./instagram-2026-09/caption.md) |
| [`video-2026-09/`](./video-2026-09/) | A 32-second walkthrough on a phone: `cincy-week-walkthrough-9x16.mp4` (Reels, Stories, LinkedIn) and `-4x5.mp4` (feed posts), with poster frames | [`README.md`](./video-2026-09/README.md) |
| [`reel-2026-09/`](./reel-2026-09/) | *The Interchange*, a 22-second Reel made the [/brag](https://github.com/latent-spaces/brag) way, with an original score: `cincy-week-reel-9x16.mp4` and `cover-9x16.jpg` | [`share-copy.txt`](./reel-2026-09/share-copy.txt), [`README.md`](./reel-2026-09/README.md) |

Each folder has an `alt-text.md` written by the build, one entry per image.

## Build

```bash
node build.mjs                                                          # the site first (the cards capture docs/)
NODE_PATH=/opt/node22/lib/node_modules node collateral/build-cards.mjs  # both decks, the PDF, alt text, proofs
NODE_PATH=/opt/node22/lib/node_modules node collateral/build-cards.mjs linkedin    # or instagram
NODE_PATH=/opt/node22/lib/node_modules node collateral/build-cards.mjs captures    # re-capture the site views
```

It needs Playwright (as `scripts/og.mjs` does) and python3 with Pillow (for the 2× → 1× downsample).
It serves `docs/` on a private port and never writes to it. Captures are cached in
`.cache/collateral-shots/`. `proof.png` in each folder (gitignored) shows the deck in a row.

## What the build refuses to write

A card that fails any check is written as `<id>.failed.png` (gitignored) and the build exits 1:

- Newsreader or Public Sans (the site's self-hosted fonts) not loaded.
- Any text under 13 px on the card.
- Any line of text outside the safe frame: 64 px from each side (the 3:4 profile grid crops 34),
  40 px top and bottom; on Stories, clear of the top 250 px and bottom 340 px.
- A box that overflows or leaves the card, or two blocks that overlap.
- A sentence it reads from the site that can't be found any more (the site changed).
- A Thursday Story event that is missing or moved off Oct 8, a Story without all three programs, or a
  `draft-schedule` item other than Art Week's *Exhibitions + Art Market*.

## Where the words come from

Every count is computed from `data/*.json` at build time. Every sentence about the site is read from
the built page it describes:

| On the cards | Read from |
|---|---|
| The headline "Three festivals share one week…" and the dek | `docs/index.html`: the `h1` and `.dek` |
| *The week on one line*, and its two notes | `docs/index.html`: the week line's heading and captions |
| The schedule lede | `docs/schedule.html` `.lede` |
| "67 venues and 75 works on the map", the map lede | `docs/map.html` kicker and `.lede` |
| The My Plan lede | `docs/plan.html` `.lede` |
| The About lede | `docs/about.html` `.lede` |
| The independence line | the site footer |
| *Sources linked on every page* | the home page byline |
| The OpenStreetMap credit | the site footer |
| Program names, dates, day ranges | `data/programs.json` and the nav's program labels |
| Counts (events, people, works, venues, sponsors, places to stay) | `data/*.json` record counts |
| Thursday's timeline (Story 2) | five events in `data/events.json`, by id. Art Week's *Exhibitions + Art Market* (12:00–7:00 PM) comes from the organizer's own schedule page, which is unlisted and says plans change; the site shows it with a draft label. The other four are published |
| The address, the repo, the byline | `site.config.json` |

Written by hand, and nothing else: the folio labels (*The week*, *The programs*, *How it is made*,
*Read it*, *Link in bio*), the kickers (*Four programs, one guide*, *Every day, by time*,
*From Findlay Market to Covington*, *Your week, your way*, *The interchange*,
*What's on now, what's next*), the headlines *N events, one schedule.*,
*Star it. It goes to My Plan.* and *Built from the organizers' own pages.*, the feature lines
beside each phone, "Plus N more happenings around town, from museum shows to concerts and games",
and "When an organizer hasn't published a room, an end time or an address, the guide says so."

## Why the cards look the way they do

- **The site's own system.** Every card uses `tokens.css`, `site.css`, the self-hosted fonts and the
  icon sprite: the Morning edition's newsprint ground, the folio, the nameplate, the river rule and
  the program glyphs (A plum square, S vermilion circle, B cobalt diamond, F silver hexagon).
- **Real screens.** The phones show the built site captured at 390 px wide: The Week on Thursday,
  Oct 8; the map; My Plan with published Thursday events starred; the week line; and the home page's
  "At this hour" view during the week.
- **Independent.** No organizer logos and no one's headshot: the programs appear as the site's
  glyphs and names, and the cover and closing cards carry the site's independence line.
- **Nothing goes stale before the week.** The cards state dates, never "N days to go".
