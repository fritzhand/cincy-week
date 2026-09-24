# blink-art

12 corrections, touching about 150 records. All fixes were made in scripts/blink-art.py and the parser was re-run; no JSON was hand-edited.

Final counts: works 75, people 102, events 30, venues 13, places 32, assets 34. The pre-verification outputs are backed up in raw/blink-art/verify/pre_verify_outputs/.

# REPORT.md (Verification section; the orchestrator should save it, since the harness blocked the file write)

## Verification

### Checks run (evidence in raw/blink-art/verify/)

1. **Counts re-derived independently: all match.**
   - The raw /map data has 88 points: 32 light installations, 27 projections, 15 murals, 9 restrooms and 5 Oasis Stations.
   - The listing has 87 cards: 86 are on the map, plus 0H10M1ke, which is only in the listing. That gives 75 works and 14 amenities.
   - The artist index has 80 ids.
   - The release lists 92 artists; the one extra `*` is the footnote.
   - A zone × medium table I built independently matches works.json exactly:

     | Zone | Light | Projection | Mural |
     |---|---|---|---|
     | Findlay Market | 2 | 2 | 9 |
     | Over the Rhine | 4 | 4 | 0 |
     | Fountain District | 7 | 14 | 0 |
     | BLINK at Lytle Park | 4 | 0 | 0 |
     | The Banks | 11 | 0 | 0 |
     | Covington | 5 | 7 | 6 |

   - Zone and category filter membership agrees with the map.
2. **Live drift since the capture.**
   - /map, the Art and Artists listing and the artist index are unchanged: same ids, and the artist index is byte-identical.
   - The only change: the 5 Oasis Stations now use the icon `rest-here`. I re-captured the map; the old copy is page_map.capture-0400.html.
   - Seven time-sensitive pages have unchanged text, and the newsroom has no post after 2026-06-08.
3. **Spot-check of 16 works and 11 artists against freshly fetched live pages.** I compared title, BLINK id, category, credited artists, verbatim description, header image, name, location, bio and photo, using BeautifulSoup rather than the extractor's regexes. 0 errors.
   - A full pass over all 81 artwork pages and 80 artist pages also found 0 mismatches in descriptions, bios, credits or locations.
4. **Artist ↔ work links cross-checked both ways.** They are consistent. The only differences are the documented inferences: 3 empty artist pages, two matches made from the artwork title, and the UC News link for the CCM team.
5. **Image and asset URLs.**
   - The first pass had probed only 41 image URLs. I probed all 500 renditions through the www host: 454 exist and 46 return 404.
   - I then requested all 154 image and asset URLs on their published hosts (url_check.json). 152 returned 200/206.
     - The Inka Kendzia original timed out, then returned 200 on retry.
     - newport-zone2.svg returns 404. I removed it (see correction 12).
6. **Schema.** Ids are unique kebab-case; enums, YYYY-MM-DD dates, HH:MM times and https source URLs all conform. There are no "" or TBA placeholders and no references to missing records. No 2022–2025 data appears outside notes, except Crescendo, which is flagged.
7. **Unvisited pages.** sitemap.xml is a 2024 snapshot, so I collected navigation links from the live pages. That found one page the extractor never visited: /turn-the-lights-on-coloring-contest. Every location id and artwork path referenced anywhere in the raw HTML is present in works.json or places.json.

### Corrections

1. **SnellBeast is Jason Snell.** snellbeast.com, the link BLINK's 2026 release gives for SnellBeast, reads "Hello! I'm Jason Snell…".
   - I removed the separate `jason-snell` person and credited "Projection by Jason Snell" to `snellbeast`, with `also_known_as` set.
   - Evidence: raw/blink-art/snellbeast_com.html.
2. **Broken icon URL.** The Oasis Stations map icon `images/icons/map/oasis-stations.svg` returns 404; the real file is `rest-here.svg`. All 5 map icons are now read from the /map legend, using the CDN URLs the site references.
3. **Places kind.** `kind: "restroom"` is not in the schema. The 14 amenity records are now `accessibility`, with `amenity_type` set to "restroom" or "oasis station". This matches the blink-info slice.
4. **Id format.** `blink-garfield-place--lighting` is now `blink-garfield-place-lighting`; all work ids now go through slugify.
5. **Artwork images (42 works).** image_url now points to the uploaded original. The earlier choice, the 1600x1200 `header` rendition, is an upscaled 4:3 crop whenever the upload is smaller. For example, header/ngp7564.jpg is a blurry upscale of a 350x350 file. Every rendition stays in image_variants with its measured size and an `upscaled_from_original` flag.
6. **Headshots (69 people).** Same rule. Black Art Speaks' 2048x1365 original is now measured: the probe retries with up to 4 MB when the size isn't in the first 128 KB.
7. **Crescendo gallery.** It now uses the originals (8000x5333 and 4032x6048) instead of 1200px detail crops, with `detail_url` kept.
8. **New event:** Turn The Lights On Coloring Contest.
   - Runs 2026-08-31 09:00 to 2026-09-25 17:00, presented by First Financial Bank.
   - The winner helps start BLINK at the Oct 8 Opening Ceremony.
9. **New person:** Rob Warnick. The contest page reads "Special Thanks to artist Rob Warnick".
10. **Three new assets:** the contest header art, the coloring-sheet image and the First Financial Bank logo.
11. **Zone colors.** The 2026 zone icons use OTR #f4475d, Findlay #fc6e58, Fountain #175ae2, Banks #00c8aa and Covington #60d9fc, which match the printed 2026 map. BLINK's map data has stale values instead (e.g. Covington #ee49f9). I added the icon colors as `zone_icon_color` and saved the icons in raw/blink-art/zone_icons/.
12. **Smaller fixes.**
    - The Cov Craft title had been reworded. It now uses the source text "Fall Cov Craft-Covington's Curated Makers Market".
    - Court Street Plaza gets zip 45202 from its source address.
    - I removed the Newport zone icon (it returns 404, and Newport is not part of 2026).
    - _stats.json now records the release's 49 new vs 43 returning artists, and the conflict with its stated 47/46.

### Remaining gaps

See the gaps list: unpublished 2026 artwork statements, images, credits, live entertainment and sponsors; incomplete maps; no artwork addresses; tiny originals; a slow CDN; possible overlap with the blink-info slice.

### Rerun

`python3 scripts/blink-art.py` rebuilds everything from raw. New helper scripts: blink-art-imgprobe2.py, blink-art-verify-spot.py and blink-art-verify-urls.py.

## Gaps

- REPORT.md was not written. The harness refused the Write call with 'Subagents should return findings as text, not write report files'. The full report, including the Verification section, is in this summary. The orchestrator should save it as research/blink-art/REPORT.md.
- BLINK has not yet published most of its 2026 content (checked 2026-09-24):
- Only Crescendo, a record carried over from 2024 and flagged, has a real artwork statement. 42 works carry the artist's bio instead (description_is_artist_bio). 32 works have no description, and 32 have no image because BLINK's image filename is empty.
- Ten works have no artist credit: B!g TV, Crescendo, Artswave Projection Aronoff Center, "Payphone" Mural Projection, Kroger North, Kroger South, Tobacco Alley Mural, Insane 51- cool lighting, OneNKY Center and Garfield Place - Lighting. Nothing published links them to the 12 release-only names. Web search was unavailable in this pass (session budget exhausted), and the local news captures are paywall teasers or 2022/2024 articles.
- The live entertainment page is empty: no stages, performers or set times. The Opening Ceremony names no performers, and the Asianati Night Market lists Thursday as 'To Be Announced'.
- No artwork has a sponsor. The only zone sponsor is on the zone map: Western & Southern supports BLINK at Lytle Park. The full event map and individual zone maps are 'coming soon'. The /map data has only 9 restrooms and 5 Oasis Stations: no first aid, info booths, food, parking or transit.
- No street addresses are published for artworks, so location_text is null. nearest_address_osm is an OpenStreetMap reverse geocode of BLINK's coordinates. 0H10M1ke has no coordinates.
- The release's own numbers conflict. Its list flags 49 of 92 artists as new with '*', but its 'By the Numbers' says 47 new and 46 returning, which adds up to 93. new_to_blink_2026 follows the asterisks.
- Some uploaded originals are small, 204–600 px (e.g. inka-kendzia is 204x247). image_url and headshot_url now point to the true original. The larger header/detail versions are only upscales; they stay in the variants and are flagged upscaled_from_original.
- The CDN (blinkcincinnati.b-cdn.net) takes about 20 s through the proxy when a file isn't cached, and sometimes resets the connection. The same paths are served fast at https://www.blinkcincinnati.com/files/... Use that host when downloading images in bulk.
- The zone_color values in BLINK's map data are stale and don't match the printed 2026 zone map. Use the new zone_icon_color field for 2026 design work.
- Possible overlap with the blink-info slice: it has a summary 'Restrooms' accessibility place and may repeat Opening Ceremony and drone show facts. Dedupe these when merging.
- Restroom 759 reads 'Part & Court' in BLINK's data. I kept the text verbatim.

## Files

- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/blink-art/works.json (75)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/blink-art/people.json (102)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/blink-art/events.json (30)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/blink-art/venues.json (13)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/blink-art/places.json (32)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/blink-art/assets.json (34)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/blink-art/_stats.json (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/blink-art.py (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/blink-art-imgprobe2.py (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/blink-art-verify-spot.py (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/blink-art-verify-urls.py (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/raw/blink-art/verify/url_check.json (154)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/raw/blink-art/image_probe.json (500)

## QA audit (2026-09-24, data-accuracy auditor)

- mercantile-immersive had no address; the venue's own contact page gives "120 E 4th St, Cincinnati, OH 45202" (added in
  `scripts/merge-research.mjs` `QA_VENUE_FIX`, geocoded house-level by the merge).
- blink-2026-10-08-flip-the-switch: BLINK says "approximately 7:00 p.m."; the merge adds the tag `approximate-time`.
- Checked and kept: all 74 mapped work points equal the live /map data (0 moved); drone-show start and end times come from the
  official "Add to Calendar" ICS files; nightly hours, Ready. Set. BLINK!, Asianati hours and performances, Cov Craft, Harper
  Alive and Run the Night match the live pages.
