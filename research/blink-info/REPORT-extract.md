# blink-info

I made 28 corrections to the blink-info slice. All of them are in the parser (scripts/blink-info.py), which exits 0, gives the same output on repeat runs, and still checks every quoted snippet against the saved sources.

## Verification

### 1. Counts re-derived from the sources
All matched the JSON:
- **FAQs:** 76 accordion items across /faqs (47), Ready. Set. BLINK! (9), Accessibility (14) and Resources (6) reduce to 46 unique Q&As. That matches faqs.json.
- **Sponsors:** 64 logo slots in 21 tiers. meetNKY and Western & Southern each appear twice, which gives 62 unique orgs. Every name was checked by eye against contact sheets of the logos, and every tier matched.
- **Hotels:** a fresh fetch of the Visit Cincy portal returned the same 128 hotel IDs. Name, phone, lat/lng and address matched for all 128. One hotel's image had changed on the live portal.
- **Murals:** 6, 18, 16 and 16 per year from the live mural pages (56 total). All fields matched for every mural.
- **Newsroom:** 9 releases, no pagination.

### 2. Live re-fetch and spot checks
- 41 BLINK pages fetched again: the text is identical to the first-pass captures.
- Every 2022 and 2024 impact-report statistic was checked in context in the PDF text.
- 14 random places and FAQ records and 8 news records were checked field by field.
- All 652 URLs were checked with an HTTP status script. Transient connection resets were retried. Real problems were fixed; blocked sites are listed in the gaps.

### 3. Pages and content the first pass missed
- The Event Guide detail pages for the drone show and the Asianati Night Market.
- The Press Room's embedded PhotoShelter gallery of 25 photos. The first pass reported that no press photos existed.
- The 2026 key art: 4 recolored-skyline illustrations, one-eyed mascot banners, zone tiles and a JPG of the 2026 zone map.
- The ArtsWave Pass offer on the ArtsWave app page.
- The Cincy A&E calendar and Visit Cincy visitor-guide links on Plan Your Visit.
- The Haile Foundation footer logo.

### 4. Schema checks
- IDs are unique kebab-case in every file, and dates and times are in the right format.
- Two conflicts with the rule against mixing past editions into 2026 files are now flagged: past partners in orgs.json have a status_2026 field, and the omitted 2024 Newport drop-off is noted.

## What changed
- **program.json**
  - Drone shows now cite BLINK's own Drone Show page.
  - Asianati Night Market was missing on Oct 9-10; Harper Alive was missing on Oct 10-11.
  - The opening drone show now has BLINK's page as source, its time text and an .ics link.
  - History is sorted by year.
  - A combined hotel statistic was split in two, and "Earnings (2024)" is now "Total earnings (2024)".
  - Added: 5 missing 2024 report figures, the ArtsWave Pass ticket, and brand.zone_colors (Findlay #f26d5a, OTR #f04d5e, Fountain #3d61ad, Banks #00b6b2, Covington #6dcff2).
- **orgs.json**
  - Every org has status_2026. ArtWorks, Cincy Nice, ish and TriHealth are flagged as not current.
  - Urban Hikers now has its logo URL.
  - The Western & Southern record notes that it supports BLINK at Lytle Park.
- **places.json**
  - Source notes added: the Covington EDC coordinates, the BCRTA text (quoted from Metro's release), and the 9 accessible drop-off points.
  - One tip record added for Cincy A&E and the visitor guide.
- **news.json**
  - One summary said "fifth" and "free", which the release does not; both removed.
  - Fixed a space in the Covington image URL and a site-name suffix in a title.
- **faqs.json:** the FAQ link that now returns 404 is flagged.
- **assets.json** (114 → 197): added 83 entries (57 page images, 25 press photos and the Haile footer logo), and the hero mp4 is now 'video'.
- **stays.json:** image_url is now the 2000 px version (1000 px for one hotel), up from 350 px, with the portal's original kept as image_url_portal. room_block.dates is in ISO format, and the portal capture was refreshed.

## Where things are
- New scripts: scripts/blink-info-verify-urls.py, blink-info-verify-assets.py and blink-info-stays-imgprobe.py.
- Fresh captures are in raw/blink-info/verify_live/. The new static pages, the PhotoShelter JSON, stays_img_probe.json and assets/extra/ are also under raw/blink-info/.
- The pre-fix JSON files are in verify/blink-info-before/.

## Gaps

- REPORT.md was not written. My subagent instructions forbid report .md files, and the first pass was refused for the same reason. The Verification section is in this summary instead.
- Still missing from any source: a bag, drone, weather or cooler policy, and a hashtag (hashtags stays []). I could not search the web to check hashtags because the session's web search budget was used up, and Instagram needs a login.
- Still 'Coming Soon' on the BLINK site as of 2026-09-24: Cincinnati (Ohio) street closures, the full 2026 event map, the individual zone maps and a 2026 accessibility map. The 2026 overview zone map does exist (PDF and JPG) and is now in assets.
- LAZ reserved-parking location names and prices were not captured (the widget returns 403). The Visit Cincy hotel portal publishes no group code, rate or deadline, so room_block rate, group_code and deadline stay null.
- Not captured: the volunteer shift list (timecounts.app renders client-side) and the original Enquirer article (only the Yahoo republication).
- The 25 Press Room photos are from BLINK 2019, going by their file names. Public previews max out at 1440 px; the originals (about 8000 px) need permission from the Chamber.
- The 2026 zone colors in program.brand.zone_colors were sampled from a JPEG, so they are approximate.
- Zone and landmark lat/lng values are Nominatim points, not BLINK polygons. The Covington EDC point is the Covington zone point (flagged). Findlay Market North Garage is still not geocoded.
- Schema deviations: assets use kind 'video' (7 entries), which SCHEMA.md does not list. PDFs, including maps and impact reports, are labeled 'key-art' because the schema has no document kind.
- These links fail from here but are still correct: bankatfirst.com, lazparking.com and monsterenergy.com return 403 (bot walls); cincinnati.com returns 402 (paywall); ishfestival.org fails the TLS handshake; kroger.com has an HTTP/2 error; YouTube returns 429 (rate limit). The Jotform newsletter URL is a POST form action, so it returns 404 on GET. The hero mp4 returns 403 without a blinkcincinnati.com Referer.
- Sources disagree on Asianati dates: Local 12 says Oct 8-10, while BLINK and FOX19 say Oct 8-11. The data follows BLINK. Earlier disagreements are still kept side by side with notes: blocks (30+, 35+, 40+ or 60), BCRTA hours and cash, and the Metro phone number.
- Left out on purpose: 7 JPGs of the 2024 accessibility map (they duplicate the linked 2024 PDF), and the FAQ's Newport drop-off at 1 Levee Way (a 2024 zone; noted on each drop-off record).

## Files

- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/blink-info/program.json (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/blink-info/faqs.json (46)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/blink-info/orgs.json (77)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/blink-info/places.json (53)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/blink-info/news.json (33)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/blink-info/stays.json (128)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/blink-info/assets.json (197)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/blink-info/people.json (4)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/blink-info/history_murals.json (56)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/blink-info/legacy_food_vendors.json (31)
