# stay-move

I made 12 corrections: 104 existing records were fixed and 28 missing records were added. Nothing was removed.

**Verification**

1. **Reproducibility:** I re-ran scripts/stay-move.py into a scratch folder. All five outputs came out byte-identical to the originals; the build.log line saying "141 places" was left over from an earlier run.

2. **Counts, re-derived from the sources:**
   - **Visit Cincy (VC) lodging API:** Downtown 18 (17 kept, plus the Marriott that is still under construction), Covington 13, Newport-area 6. A new query covering every lodging subcategory in every region returned 176 listings.
   - **BLINK hotel portal:** 128 hotels; all 25 within walking range were already in stays.json.
   - **3CDC parking:** 17 unique garages and lots on the live page, with rates identical to the capture.
   - **Streetcar:** all 18 station names match the official map legend in order (I viewed the map image) and the 18 OpenStreetMap stops.
   - **Red Bike:** 79 stations in the live feed, 79 captured, 79 in the JSON.
   - **Result:** one real miss. The extractor's Downtown query used only the "Hotels" subcategory, which skipped REST ("Luxury & Boutique") and the Symphony Hotel's own VC listing.

3. **Spot-checks (25+ records, field by field, against live pages):**
   - **Hotels:** the room blocks for Kinley and Fidelity (rate 20900 cents, code SUC, "BOOK BY SEP 04", AfterGroupCutoffDate); addresses and phones on the official sites of 21c, Hotel Covington, North by Hotel Covington, Pickle Factory, Symphony and Kinley.
   - **Transit and access:** fares, BLINK passes and park-and-ride details for Metro, TANK and BCRTA; Metro Access and TANK RAMP; Red Bike pricing and its BLINK PDF; CVG directions, rideshare and ADA operators; the TANK 2X timetable (03:41 first, 02:11 last, 24 minutes); streetcar hours, fare and operator.
   - **Parking, tips and descriptions:** three 3CDC garages; Findlay and Banks parking; the Bengals, FC Cincinnati, DORA, 21+ plaza and Covington-closure tips; every landmark and food blurb.
   - **Neighborhood facts:** 1871, 1855, 1867, 1795, the Italianate architecture, the National Register listing and the 43-bell carillon.
   - **Coordinates:** every Nominatim point matched its house number.
   - **Links:** all 251 cited URLs were requested; the failures are brand-site 403s and three dead sites.
   - **Tools:** a new quote checker verified 166 quoted fragments; the 7 it still flags were confirmed by hand as formatting artifacts.

4. **Schema** (new scripts/stay-move-verify-schema.py): ids unique and kebab-case, required keys present, no empty strings or "TBA", valid kinds, coordinates inside the region. The one 2025 mention is a deliberate note.

**The 12 corrections**
1. Great American Ball Park had lost its street number; it now reads "100 Joe Nuxhall Way … 45202-4109".
2. ZIPs were missing on 28 stays and 48 places. They now come from each VC listing page, which also restores suite numbers such as 617 Vine Suite A and Suite B.
3. The Hyatt phone was bare digits ("15133544070"); it is now formatted.
4. The Smale hub address had an unsourced ZIP. It now uses The Banks' own footer address, and VC's 4 Beech Lane 45208 carries a caution note.
5. The Radisson check said "HTTP 403", but that site actually drops the connection; corrected.
6. The e-scooter note repeated an unverified search snippet; removed.
7. 24 records quoted pages they did not cite: 17 3CDC garages, BLINK parking, MainStrasse, Red Bike, CVG, the FC Cincinnati tip, and two Findlay records. Citations added.
8. The Pickle Factory phone comes from VC, not the official site; now noted.
9. The Symphony Hotel gained its VC listing as a source and a note on the 1871/1873 founding-year conflict.
10. REST added.
11. Eleven places named on the VC pages were added:
    - Landmarks: Brady Music Center, Paycor Stadium, Mercantile Library, St. Mary's Cathedral Basilica.
    - Food and drink: Tokyo Kitty, Juniper's, KungFood Chu's, Olla, Revival, Wenzel, Pensive.
12. The Banks' official Shop + Dine directory had never been visited. I captured its 19 detail pages and wrote a parser (scripts/stay-move-banks.py). That added 16 places with verbatim descriptions, hours, phones and geocoded addresses. Holy Grail and Lager House got the official hours, and DORA was skipped because it is already a tip.

**Final state**
- stays.json 35
- places.json 166: food 33, drink 29, landmark 25, transit 33, parking 24, neighborhood 9, tip 7, accessibility 5, airport 1
- venues.json 7
- walking.json 21 pairs (unchanged)
- redbike_stations.json 79

The parser re-runs cleanly from raw/stay-move. Live re-fetches and the before-and-after backups are in raw/stay-move/_verify/.

## Gaps

- REPORT.md was not written. No slice has one: writing .md report files is disallowed in this harness, and the extractor's attempt was refused too. The full report, including the Verification section, is in the summary field and in these gaps.
- Room blocks (unchanged, re-verified from raw XHR):
- Kinley (Marriott code SUC, $209.00, Oct 4-9, book by Sep 4) is closed/full.
- Fidelity (SynXis hotel 98848, group CINTRIFUSEOCT) shows AfterGroupCutoffDate; no rate is published.
- BLINK and CAW have no room block.
- The SCW FAQ promises 'recommendations for nearby airbnbs' and names 'The McKinley Hotel'. The Plan Your Visit capture shows only the Kinley and Fidelity cards, and no Airbnb links.
- Hotel pages that cannot be read by script:
- Hilton, Hyatt, IHG and Extended Stay return 403.
- choicehotels.com (the Radisson) drops the connection.
- Marriott pages return 403 to GET but 200 to HEAD, so Marriott existence rests on the HEAD redirect.
- REST's official site (iresteasy.com) fails TLS with curl and returns 503 via a fetch service, so REST rests on its Visit Cincy listing only.
- Lodging completeness now rests on three sources:
- The full Visit Cincy lodging API: 176 listings, all regions, all lodging subcategories.
- The BLINK Visit Cincy portal: 128 hotels.
- StartupCincy Week (SCW).
WebSearch was exhausted (200 of 200), so non-Visit-Cincy OTR lodging could not be searched further.
Deliberately excluded by distance:
- SpringHill Suites Midtown (610 Eden Park Dr): 1.40 km from CAW HQ.
- Fairfield Uptown: 1.42 km from Findlay Market.
- Hotel Celare: 1.62 km.
- Comfort Suites/MainStay (2347 Reading Rd): 1.68 km.
- Holiday Inn Express Bellevue: 1.16 km from Newport on the Levee.
Also excluded: Marriott Cincinnati Downtown (444 Plum St, under construction) and Home2 Suites Downtown (opening late 2026, unconfirmed).
- Smale Riverfront Park: no official street address could be read (mysmaleriverfrontpark.org returns 403). Visit Cincy's '4 Beech Lane, Cincinnati, OH 45208' does not geocode to the riverfront. It is kept with a caution note, and the hub now uses The Banks' footer address, 'Freedom Way, Cincinnati, OH 45202'.
- Still not found:
- Any official extended Connector hours during BLINK.
- A list of city-owned garages.
- Downtown rideshare zones for BLINK.
- Per-garage addresses in Covington and Newport.
- Greyhound and Megabus stops.
- Amtrak Cardinal days and times (amtrak.com unreachable; the Visit Cincy 'three days a week' is the only source).
- No coordinates, because no street number is published:
- parking-3cdc-findlay-lot
- parking-findlay-market-lots
- parking-findlay-garage
- parking-clay-wade-bailey-park-and-ride
- 3 overview pointer records (parking-blink-overview, parking-covington-and-newport, parking-downtown-otr-overview)
- Discrepancies for editors:
- Streetcar frequency: 15 min (city) vs 20-25 min (Visit Cincy).
- Visit Cincy is out of date: TANK to CVG '$1.50' (TANK says $2), and Red Bike '$10 / 60-minute rides' (Red Bike says $12 Two-Hour Pass).
- BCRTA hours: 5:30-11pm (BLINK page) vs 4:30pm-midnight (Metro, Sept 23, 2026).
- Central Riverfront Garage operator: SP+ (The Banks FAQ) vs Ace Parking (Banks Public Partnership).
- Symphony Hotel: 'Est. 1871' on the official site vs 'An 1873 Boutique Hotel' on Visit Cincy.
- Street Corner Market: ZIP 45208 as printed on the directory page.
- BetMGM: the directory text still says Tom's Watch Bar is 'coming summer 2025'. This is kept as a flagged note; it is the only 2025 mention and is intentional.
- Fishbowl: the directory URL slug still reads 'coming-soon'.
- Drone show name: 'Dimensions of Wonder' vs 'Mystic Eye' (blink-art).
- Sites unreachable on 2026-09-24 (the url fields are kept as published by the source): blinkerstavern.com (503), authenticwaffle.com (timeout), amtrak.com (reset).
- walking.json minutes are straight-line lower bounds at 4.8 km/h, not official times. CVG publishes no drive time.
- Flags for other slices (carried forward):
- Findlay Market BLINK events: Indoor BLINK Experience at Coughlin Commons, Silent Disco Oct 9-10, Tasting Tours.
- News: Metro BLINK release (Sept 23); Covington closures release (Sept 14).

## Files

- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/stay-move/stays.json (35)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/stay-move/places.json (166)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/stay-move/venues.json (7)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/stay-move/walking.json (21)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/stay-move/redbike_stations.json (79)
