# scw-info

I built the StartupCincy Week 2026 data layer for everything except the session agenda. `scripts/scw-info.py` rebuilds all 12 JSON files offline from the saved captures in `raw/scw-info/` and `raw/scw/scw.html`. Supporting scripts: `scw-info-hotels.mjs`, `scw-info-geocode.py`, `scw-info-orgurls.py`. I did not touch any git repo. REPORT.md was not written because the harness blocked it; the report is below and in the gaps list.

**program.json** (1 record)
- **Dates and theme:** Oct 5–8, 2026, 'TEN YEARS OF BOLD BETS', the 10th annual edition. Daily themes from 'Week at a Glance': Mon Kick-off, Tue Capital, Wed Growth, Thu Students, each with its highlights plus Soapbox's description of the day.
- **Hub:** Union Hall, 1311 Vine St. The FAQ says every attendee checks in there each day.
- **Tickets** (parsed from the registration page, all on sale until Oct 10):
  - $50: Startup Founder or Employee, Entrepreneur or Small Business Owner, General Ecosystem
  - $250: Corporate
  - $300: Venture Capital Investor. Only this ticket gets the free 'Liquidity Event (Investor Happy Hour) Oct 6 5:00pm' add-on.
  - $0: Student. Includes the Student Summit on Oct 8.
  - Every ticket can add the Cintrifuse Annual Meeting (Oct 6, 8:30) for free.
- **Student Pitch Competition:** the first one, on Oct 8. From the application form: undergraduates only, teams of up to 4, applications close Sep 30, teams told by Oct 2, pitch in person at Union Hall. The prize is a 'Golden Ticket' into Builder Fellows for Summer 2027, which the homepage describes as a $10,000 non-dilutive grant.
- **Who it is for:** six audiences, read from the image cards.
- **Other fields:**
  - features: Networking, VentureHaus, Startup Clubhouse, Top Tier Content
  - policies: food, virtual, accessibility, cost assistance
  - contacts: info@startupcincy.com, and kate@cintrifuse.com for sponsorship
  - StartupCincy social accounts
  - 2026 sponsorship tiers: $25K, $10K, $5K, $2.5K, $1.5K
  - 12 history facts, 2016 FounderCon to 2026, with sources
  - 26 stats
  - brand colors from the vFairs CSS: red #EB4840, navy #0B2734, blue #3C80BD, aqua #63BEDC and others. Fonts: Knockout 27 Junior Bantamwt, Knockout, Montserrat, Nunito Sans. startupcincy.com's own colors and fonts are included too.

**orgs.json** (46 records)
- All 43 sponsors on the 2026 partners page, by tier: Title 3, Presenting 15, Partner 9, Advocate 9, Community 7. Also StartupCincy as organizer, vFairs as the event platform, and the AGM sponsor lockup (JobsOhio Ventures + P&G).
- The logos have no alt text and several file names are wrong, so I identified each one by looking at the image. Examples: the 'achievers' file is Cintrifuse, 'book-amp-street' is Cincinnati Children's, an unnamed file is FBT Gibbons, 'svb-copy' is Paycor.
- Official URLs were checked by fetching each site. Ids match the scw-agenda slice (the `agenda_org_id` field links them).

**Other org files**
- orgs_2025.json (44): the 2025 sponsor list, kept as history.
- ecosystem_orgs.json (51): the StartupCincy coalition partners. These are not 2026 week sponsors.

**stays.json** (2 records, both blocks now closed)
- **Kinley Cincinnati Downtown, a Tribute Portfolio Hotel**, 636 Race St, Marriott code CVGTX. Group code SUC, $209/night, Oct 4–9, book by Sep 4. The Marriott page now shows the block as full.
- **Cincinnati's Fidelity Hotel**, 210 E 6th St, SynXis hotel 98848. Group code CINTRIFUSEOCT. The booking engine now says the group cutoff has passed.

**venues.json** (7 records, geocoded except one): Union Hall, Beer Hall at Union Hall (seats 200), Somerhaus (2025 Clubhouse), Mercer Commons Garage, Washington Park Garage, 14th & Vine 3CDC parking, and The Marketer Collaborative.

**faqs.json** (31): 10 from the SCW site, 15 About-StartupCincy, 6 Startup Fellows.

**assets.json** (41): SCW 2026 and 2025 logos, favicon, SUCW26 '10' social graphic, the 'Ten Years of Bold Bets' og image, audience cards, photos, font files, StartupCincy and Cintrifuse marks.

**events.json** (4): only items not in the agenda, each marked `in_agenda: false`: the Liquidity Event, VentureHaus, the Startup Clubhouse, and the RedHawk Founders & Funders satellite event on Oct 5.

**agenda_enrichment.json** (2): adds Union Hall as the venue for the AGM and the Student Pitch Competition, which the agenda slice has without a venue, plus the AGM speakers and the pitch deadline and prize.

**news.json** (9): articles from 2018 to 2026.

**resources.json** (12): Dealroom, Resource Compass, Job Board, Slack, Ecosystem Passport and the other StartupCincy resources.

**Discrepancies recorded, not resolved**
- startupcincy.com's 2026 sponsorship page says 'October 6-9'; every other source says Oct 5–8.
- The AGM ends at 10:00 per cintrifuse.com and 10:30 per the registration add-on.
- The FAQ refers to 'The McKinley Hotel'; the site's hotel card is the Kinley.
- The Washington Park Garage address differs between sources (1230 vs 1310 Elm St).
- The size of the first week in 2017 differs between sources (4,500 attendances vs about 100 people).
- The homepage still contains hidden 2025 content ('OCT 6-9, 2025'). I used it only as history.

## Gaps

- REPORT.md was not written. The harness blocks subagents from writing report .md files, so the report is in this summary and these gaps instead.
- Pitch Competition page /en/pitch-competition returns 404 and its nav link is commented out. There is no 2026 open (non-student) pitch competition page. The $200K Connetic Ventures competition was 2025, and no source names its winner.
- Speakers page /en/speakers-page is empty (the 'Founders On Stage:' heading has nothing under it). Speakers and headshots belong to the scw-agenda slice. The 'Content' nav dropdown is hidden and contains only 'Full Agenda'.
- No 2026 source gives the location or hours of the Startup Clubhouse or VentureHaus. Somerhaus (1415 Republic St) hosted the Clubhouse in 2025; this is not confirmed for 2026.
- Liquidity Event (VC add-on, Oct 6 5:00pm) has no published venue or description. The Friends & Founders dinner is a sponsor-only benefit with no date.
- Fidelity Hotel block (code CINTRIFUSEOCT): rate, block dates and cutoff date are not public. Only the link's pre-filled Oct 4–6 dates are known. SynXis returned AfterGroupCutoffDate on 2026-09-24. The Kinley block (code SUC, $209/night, Oct 4–9) had a book-by date of 2026-09-04 and is now full or closed.
- The FAQ promises 'recommendations for nearby Airbnbs' and names 'The McKinley Hotel'. The site shows no Airbnb list; its hotel card is the Kinley.
- No daily hours are published for 2026.
- History: no sources found for the 2018–2020 editions. The 2021 facts come only from a search summary of startupcincyweek.sched.com, which is behind a Cloudflare challenge; they are marked verified:false. 2017 attendance conflicts: WCPO counted 4,500 attendances, while Abby Grimm (Soapbox 2026) recalls about 100 people.
- Date discrepancy: startupcincy.com's 2026 sponsorship page says 'October 6-9, 2026'; every other source says Oct 5–8. AGM end time is 10:00 per cintrifuse.com and 10:30 per the registration add-on.
- Washington Park Garage address: the SCW FAQ says 1230 Elm St, the StartupCincy Awards Luma page says 1310 Elm St.
- The SCW site footer social icons all link to '#'. StartupCincy accounts from startupcincy.com are used instead. There is no event-specific 2026 hashtag; only #StartupCincy.
- The Organizations directory link (resources.startupcincy.com/organizations) returns 404, and the ESO directory page loads with JavaScript and was not scraped. Coalition partner logos came from /our-partners instead (ecosystem_orgs.json, 51 records).
- No official URL for sponsor 'Kernel': kernel.sh and kernel.ai are different companies and neither mentions Cincinnati. Automated checks were blocked for Kroger, PNC, Insperity and Saint Ursula; their well-known domains are used and each record's url_check says so.
- No sponsor logo is published as SVG. The largest originals are the vFairs 2134x2134 PNGs, square with padding. The Knockout fonts on the SCW site are commercial (Hoefler&Co) and need a license check before reuse.
- The 14th & Vine 3CDC Public Parking (1429 Vine St) record is not geocoded. It comes from the Awards Luma page, not the SCW FAQ.

## Files

- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-info/program.json (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-info/orgs.json (46)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-info/orgs_2025.json (44)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-info/ecosystem_orgs.json (51)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-info/venues.json (7)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-info/stays.json (2)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-info/faqs.json (31)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-info/assets.json (41)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-info/events.json (4)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-info/agenda_enrichment.json (2)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-info/news.json (9)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-info/resources.json (12)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/scw-info.py (1)
