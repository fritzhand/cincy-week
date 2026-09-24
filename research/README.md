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
