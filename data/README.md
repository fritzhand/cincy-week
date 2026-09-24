# data/ — PROVISIONAL

**This folder currently holds a small provisional sample, not the guide's real dataset.** It is a copy of
`tests/fixtures/mini/`: 5 programs, 13 events, 12 people, 12 venues, 2 works, 4 orgs, 2 stays, 7 places,
4 FAQs, 3 news items, 2 facts, and 9 images. Every record is a real record from the research slices
(Cincinnati Art Week, StartupCincy Week, BLINK, FotoFocus and "also" sources), reshaped to the engine's
schema, and every one keeps its `source_url`. The small liberties taken are all listed here:

- `programs.json`: display names were shortened ("StartupCincy Week 2026" → "StartupCincy Week" with
  `edition: "2026"`; "FotoFocus Biennial 2026: The Long View" → "FotoFocus Biennial", edition
  "2026: The Long View"); `also` has no description.
- `blink-nightly` merges BLINK's four identical nightly records into one Oct 8–11 multi-day event
  (7:00–11:00 PM daily), with the location text taken from BLINK's FAQ ("30+ city blocks from Findlay
  Market in Cincinnati to Covington").
- Two venues had no neighborhood in the research; it was set from their published street addresses
  (Contemporary Arts Center: Downtown; National Underground Railroad Freedom Center: The Banks).
- `is_free: true` is set only where the source says free (the BLINK nights; the Beltways session, whose
  cost reads "Free (approval required)"); everything else is `null`. `featured: true` on four events is an
  editorial placeholder for the home page.
- `images.json` and `site/img/{p,o,w}` are the design system's specimen crops of the source images.
- `map.json` is derived from the design system's provisional basemap metadata.

**Agent C** replaces this folder with the merged dataset (`scripts/merge-research.mjs`). Keep this file
updated with anything in `data/` that is not a straight copy of a source. The rules are in `CLAUDE.md`
("Data rules"); `node build.mjs` enforces them.
