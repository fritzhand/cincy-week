# also

I made 95 corrections: 95 existing records fixed in place (60 events, 31 people, 2 programs, 1 venue, 1 org). I also merged 4 duplicate person variants into their people records and added 53 records (7 events, 33 people, 3 venues, 4 orgs, 2 assets), and fixed 1 pipeline bug (the geocoder cached Nominatim 429 errors permanently; it now retries with backoff and never caches a failure). Everything was re-run from the parsers (also_fotofocus.py, then also.py); two consecutive runs give byte-identical output. Final counts: events 189 (122 fotofocus including 75 exhibitions, 67 also; 170 overlap Oct 3–11), people 712, venues 83 (all geocoded), orgs 34, assets 20, faqs 18, programs 2. A pre-verification backup is in research/_backup_also_pre_verify/.

## Verification

**1. Counts re-derived from the sources**
- **Exhibitions: 75, confirmed.** The Art page has 75 distinct exhibition slugs, matching exh_urls. The map JSON has 65 venues, and the Artists page lists 65 Biennial Venues.
- **Events: 46 in the window, confirmed.** A live Tribe Events REST query for Sep 30–Oct 11 returns 46 events, equal to ev_urls (42 public plus 4 private). Title, date, start and end time, and venue match for every public event. Each iCal export is capped at 30 events, but the feeds overlap, so the window is still complete.
- **People on the FotoFocus pages, confirmed.** 20 participant rows with 20 headshots; 639 names in the Artists list container.
- **Sponsors and FAQs, confirmed.** Sponsors 3 + 4; FAQs 13 + 5, with no questions missing.
- **CAM: no result cap.** The 24 results could have been a page limit, but separate sub-range queries for Oct 3–5 and Oct 9–11 return 8 and 7, matching the full capture.
- **CAC and Cincinnati Arts, confirmed.** The CAC October calendar has 22 links, 9 of them in the window, all captured. The Cincinnati Arts listing has 24 events; every in-window one is covered, and the Music Hall tour showings fall outside the window.
- **UC football: claim now sourced.** The earlier "away at Arizona Oct 3" had no source in raw/. A render of the gobearcats.com schedule confirms Oct 3 at Arizona and no game on Oct 10.
- **River Roots: excluded.** The USS Nightmare page's "October 8 – 12" River Roots item has no year and matches the 2025 festival, so it is stale.

**2. Spot-check of 24 records against live pages** (5 exhibitions, 4 FotoFocus events, 6 also events, 3 participants, 3 artists, 3 venues)
- All FotoFocus records re-parsed identically from the live pages.
- Errors found and fixed:
  - **CMC Jurassic World:** the price list and banner image were missing.
  - **CAM programs:** listing blurbs only, with no end time, cost or registration, full description or detail image. The same gap affected all 12 CAM programs; all 12 detail pages are now captured and parsed.
  - **Unfolding Stories projection mapping (4 events):** they sat at the Oxford gallery. The event text says the site is MUCCE, 1300 Vine St, Cincinnati, during BLINK. There is a new MUCCE venue, a 'blink-related' tag and a note.
  - **Aronoff Indigenous Peoples' Day series:** end time 13:00, from the page's runtime note.
- The review also found the CSO records' time_text was the literal string 'Details' (5 records), and 3 CSO descriptions included festival cross-promotion, critic quotes and biography links. Both are fixed.
- Images: all 294 image, logo and headshot URLs return HTTP 200 (raw/also/verify/url_status.json).

**3. Categories and records the extractor missed**
- **Exhibition credit lines.** Labeled lines other than "Artists" were ignored ("Visual Artists", "Juror(s)", "Student Curators", "Course Faculty", "Advisors"). They are now structured `credits` with the right roles (judge, curator, organizer). This fixed 11 wrong 'artist' roles and created 5 missing people (Marcus Jackson, Annie Dell'Aria, Jordan Fenton, Ashley Goos, Raye Griffin).
- **Unlinked names: 22 down to 7.**
  - Accent-insensitive matching linked Alice Guy-Blaché.
  - An alias linked Oscar Micheaux.
  - Matching against related-event listings (excluding the Spotlight Weekend blurbs) linked 11 Unorthodocs filmmakers.
  - Two probable spelling variants were merged, flagged as unconfirmed.
- **Speakers named only on event pages:** Cécile Fromont, Jamie Schorsch, Tyler Spohn.
- **FotoFocus brand.** Colors and fonts are now filled from the theme CSS: #000, #fff, #b01d1e, greys #707070 / #989898 / #efefef, and #f0f0f0 for the 2026 pages; fonts franklin-gothic-urw, letter-gothic-std and neue-haas-grotesk. Two Adobe Fonts assets were added.
- **New 'also' events:**
  - CAC exhibitions Leonard Harmon: People of the Good River, and the Indigenous Peoples' Day Convergence exhibition (both from Oct 9), with 12 artists and Leonard 'Lenny' Harmon (artist and curator, with bio). This replaces the earlier 'lenny-harmon' record.
  - Indigenous Peoples' Day Show at Heart of Northside, Oct 10, 8–10pm, confirmed by the venue's calendar; the venue address comes from its contact page.
  - Brady Music Center: Freya Skye (Oct 3, sold out) and Robin Trower (Oct 7); address from the pages' JSON-LD.
  - Memorial Hall: Holly Bowling, Oct 4.
  - Cincy Bookstore Crawl, Oct 2–4.
- **Heritage Bank Center:** https source URL, doors and start times, ticket link, image, and 3 more performers.
- **Image backfill:** 17 more event images from event-specific og:image tags (14 records gained an image only; 3 more got one alongside other fixes), including the original-size Mary Poppins upload.

**4. Schema conformance** (scripts/also-verify-schema.py)
- IDs are unique kebab-case, dates and times are well-formed, and no end precedes its start.
- Every event date falls in 2026 or 2027, so no 2024/2025 dates are mixed in.
- All person and venue references resolve, and every venue has coordinates.
- 8 empty image_caption strings are now null, and one Eventbrite link now uses https.
- The only remaining flag is intentional: the Bookstore Crawl has a null venue because it spans multiple bookstores.

## Gaps

- REPORT.md was not written. My operating rules forbid writing report .md files, and no other slice has one either. The full report, including the Verification section, is in this summary.
- 7 of the 639 names on the FotoFocus Artists and Participants page are still not linked to an exhibition: Alison Brady, Amy Schuessler, Ashia Hilliman, Bubly Barna, Daisy Money, M. Katherine Hurley and Vivienne Yan. They may be Unorthodocs Shorts filmmakers, but the Shorts event page (raw/also/verify/ev_unorthodocs-shorts-2.html) names no directors. They are kept with roles ['artist'] and a note.
- Two merges are probable but not confirmed by any source, and both are flagged in notes: 'Larry Winston Collins' (artists page) was merged into Larry Collins (Unfolding Stories), and 'Ray Griffin' into Raye Griffin (Untwined/Interwoven student curator).
- The 4 FotoFocus patron-only Private Events are still excluded (the Tribe API confirms they exist on Oct 2–3): Welcome Brunch, Private Gallery Tour, Private Reception, Private Dinner.
- Not reachable, or reachable without a dated official page, so not included: Factory 52 House of Cards Carnivale (403 even in a real browser); MegaCorp Pavilion (TLS reset); Essex Studios Art Walk, Oct 2–3 (site connection reset, and the only other link is Instagram); Newport Aquarium, Know Theatre, Second Sunday on Main, MainStrasse (as before).
- Left out as outside Cincinnati/NKY, or as minor suburban fall events, although Tour de Cincinnati lists them: Ohio Sauerkraut Festival (Waynesville, Oct 10–11), Operation Pumpkin (Hamilton, Oct 9–11), Sharon Woods Haunted Village, Kings Island, the Wyoming Fall Festival and similar. Also not added: USS Nightmare's regular haunt season (its only in-window item, a 'River Roots' tour on Oct 8–12, is a stale 2025 listing) and Cincinnati Vintage Fest (Oct 10 at Heart of Northside, calendar entry only, no detail page captured).
- 12 'also' events still have no image because the page has only a generic site image or none: Taft exhibitions (2), Taft Fall Jazz (2), Kusama, KHAC, 3 Playhouse festival readings, Bengals game, the Indigenous Peoples' Day show, Bookstore Crawl.
- Performance-level dates and times for Heist, Talk and Dracula are still missing (the sites use JS calendars). Robin Trower's price is not printed on the venue page (Ticketmaster only).
- The Cincy Bookstore Crawl page gives 'October 2nd–4th' with no year. The year 2026 comes from Tour de Cincinnati's October 2026 list, and venue_id is null (27 stores; route pages not parsed).
- Source-access notes. FotoFocus robots.txt disallows /wp-json/ and /wp-content/themes/ for '*' but allows everything for 'anthropic-ai'. I made one verification request to the Tribe events API (Chrome user agent) and one theme-CSS fetch as 'anthropic-ai' (brand tokens). The Mary Poppins JR. image was verified through a browser page context, because curl gets a 403 bot block.
- The FotoFocus logo is still only an inline SVG (raw/also/fotofocus_logo_inline.svg). Its assets.json url is the site root, not an image file.

## Files

- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/also/programs.json (2)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/also/events.json (189)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/also/people.json (712)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/also/venues.json (83)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/also/orgs.json (34)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/also/assets.json (20)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/also/faqs.json (18)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/also/_ff_parsed.json (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/also/_stats.json (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/also_fotofocus.py (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/also_other.py (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/also.py (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/also-verify-schema.py (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/also-verify-urls.py (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/also-verify-render.cjs (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/also-verify-cam.cjs (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/also-verify-imgpw.cjs (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/raw/also/verify/url_status.json (294)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/raw/also/cam/detail (12)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/_backup_also_pre_verify (9)

## QA audit (2026-09-24, data-accuracy auditor)

Corrected downstream in `scripts/merge-research.mjs` (tables `QA_OPENING`, `QA_OCCURRENCES`); the JSON here is unchanged:
- Four exhibitions had `date: null` and were dated with the capture day, which pages printed as the opening ("Sep 24–Oct 8").
  Published openings: also-cac-sarah-rodriguez-homespun 2026-07-08 (CAC page dated "July 08, 2026"),
  also-cac-softlab-gravity-s-rainbow 2024-10-17 (CAC page; Movers & Makers 2024-10-07), also-cam-gifts-from-japan 2026-06-22
  (Rotation 1 "June 22-August 24, 2026", CAM text via asiaweekny.com), also-cmc-lego-jurassic-world-the-exhibition 2026-05-22
  (CMC press release of May 19, 2026).
- also-zoo-jack-olantern-glow: one 17:30–22:00 range for Oct 2–31 put it on the closed Mondays (Oct 5, 12) and ran Tue/Wed to
  10 PM; now dated occurrences (Tue/Wed to 21:00).
- also-tct-mary-poppins-jr: 19:00 was applied to Oct 10 and 11 (real: Oct 10 2:00 and 5:00 PM, Oct 11 2:00 PM); now occurrences
  through Oct 18, run to Oct 25.
- also-findlay-blink-10-08: Oct 10–11 are 9:00 AM–4:00 PM (each Findlay page's startDate/endDate), not 12:30–11:30 PM.
- Checked and kept: also-cam-mind-body-art-10-08 is Oct 8 per CAM's calendar (the page says "First Thursday", but the rendered
  calendar lists nothing on Oct 1 and "Mind Body Art October 8, 2026 at 6:00 PM").
