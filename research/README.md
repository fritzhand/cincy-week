# research/ — the frozen research snapshot (Sep 24, 2026)

What `scripts/merge-research.mjs` merged into `data/`. Kept for provenance, not for editing: after Sep 24, 2026
`data/*.json` is the source of truth and is corrected by hand (see CLAUDE.md, "Maintaining the site during the week").

- `SCHEMA.md` — the shared record shapes and ground rules every research agent followed (never invent a fact; every
  record carries `source_url`; descriptions and bios verbatim; unknowns are `null`).
- One folder per slice, each extracted from the organizers' own pages and then checked by a separate verification
  pass (`REPORT-*.md` in each folder records counts, corrections and known gaps):
  `scw-agenda`, `scw-info` (StartupCincy Week), `blink-art`, `blink-info` (BLINK), `caw` (Cincinnati Art Week and
  Cincy Nice), `also` (FotoFocus Biennial and other dated happenings), `news` (coverage and cited facts),
  `stay-move` (hotels, transit, neighborhoods, food and drink).
- `geocode.json` — the Nominatim (OpenStreetMap) lookup cache, so `node scripts/merge-research.mjs --offline`
  reproduces `data/` byte for byte.

Paths inside the reports point at the research session's scratch folders and the raw page captures (about 640 MB),
which were not kept.

`brand-fusion/` was added on Sep 25, 2026: `brand-fusion-2026.json`, what was read from https://brandfusioncincy.com/ (home,
/know-before-you-go, /submit-challenges, /submit-nominations; robots.txt disallows the logged-in areas, which were not read),
verbatim: the about text, agenda, sponsors and co-hosts, FAQ and the 39 confirmed brands. It was applied to `data/` once, by
hand-maintenance rules (see `data/README.md`, "Brand Fusion").

`blink-map/` was added after the snapshot (Sep 24, 2026): `blink-map-2026.json`, BLINK's official 2026 folding map (the PDF at
https://www.blinkcincinnati.com/files/assets/2026blinkfoldingmapmap.pdf; the file itself stays in `.cache/blink-map/`) extracted
by `scripts/extract-blink-map.py`: the 92 numbered entries as printed, their pins with georeferenced coordinates and an
approximate radius, the KEY's facility symbols, zone sponsors and the match to BLINK's online map. `scripts/apply-blink-map.mjs`
applied it to `data/` by hand-maintenance rules (it is not part of the merge). A second, independent verification pass
(every entry re-read off the PDF, every position projected back onto it) is summarized in `data/README.md`, "BLINK official
map".
