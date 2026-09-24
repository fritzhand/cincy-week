# scw-agenda

Built the full StartupCincy Week 2026 (Oct 5-8) agenda and speaker data from https://startupcincyweek.com/en/agenda-page and a vFairs JSON endpoint I found by reading the site's script. `python3 scripts/scw-agenda.py` rebuilds everything from local captures; `scripts/scw-agenda-geocode.py` is the only step that makes network requests (Nominatim, cached). REPORT.md could not be written because the harness refuses report files from subagents, so its content is below and in the gaps; `_stats.json` holds every count.

**How the data was built**
- The fresh fetch matches the earlier capture except for a CSS cache-buster and a countdown number.
- The endpoint (`/en/get-agenda-html-based-on-timezone`, also `/en/get-agenda-html-based-on-visitor-filters`) returns the same 116 sessions in a second template that carries the vFairs session id on every row.
- All 225 landing rows (113 in the Day 1-4 tabs, 112 in the 15 topic tabs) matched exactly one session id. Date, time, title, descriptions, bios and headshots agree between the two templates; the consistency check reports no problems.
- 3 sessions appear only under 'Sessions by Topic': SPEED COACHING (Oct 5), Lab to License (Oct 7) and Founder Tools (Oct 8). The page's own script copies them into the day tabs in the browser. They are included with `day_tab: null`.
- Runs are deterministic, and all 139 headshot URLs return 200.

**Counts**
- events.json has 116 sessions: Oct 5: 40, Oct 6: 24, Oct 7: 37, Oct 8: 15. First starts are 08:30, 08:30, 09:00 and 09:00; last starts are 16:30, 17:00, 16:30 and 16:00.
- Topics (from the 'Sessions by Topic' view) are in `tracks`: Small Business 15, Venture Capital 12, Student 12, AI 11, Founder Journey 11, Marketing & Creative 9, Funding 7, Social 6, Startup Ops 6, Food Founder 4, City Building 4, University Tools 4, HardTech 4, Health & Life Sciences 4, Arts & Culture 3. Four sessions sit under two topics; 8 have none.
- Kinds: talk 47, panel 28, workshop 19, networking 12, other 5, pitch 3, fireside 1, party 1. They come from ordered rules on each session's own words; the rule used for each event is in `_stats.json`.
- people.json has 151 people: 148 unique listed speakers, deduped by name with their sessions merged, plus 3 named only in a description. There are 181 speaker slots; 21 people speak in 2-3 sessions. Each speaker's title and org are the same everywhere. Bios are verbatim; 139 people have an original headshot.
- venues.json has the 6 places the agenda text names, geocoded where an address was found.
- orgs.json has the 18 companies named as a session presenter or sponsor.
- _tickets.json has the 6 ticket types from the registration form, as a hand-off for the program slice.

**Main gaps**
- The source gives no end time for 115 of 116 sessions. The only one (Beltways, 12:00-13:00) comes from its Luma page.
- The per-session location slot is an unfilled template in every row. Only 8 events name a place in their own text; the rest have `venue_id: null`, since the FAQ says attendees check in daily at Union Hall before going to sessions at other locations.
- The Cincinnati Art Week HQ address is unresolved: two press sources give different addresses (1417 Main St and 1600 Race St).

**Hand-offs for other slices**
- stays: the Plan Your Visit menu has two hotel cards. One (image alt 'Kinley Cincinnati') has a Marriott group link; the other ('Fidelity Hotel') has a SynXis link with `group=CINTRIFUSEOCT`, arrive Oct 4, depart Oct 6. The FAQ also mentions 'The McKinley Hotel' and nearby Airbnbs.
- places: the FAQ gives parking at Mercer Commons Garage (1310 Vine St) and Washington Park Garage (1230 Elm St), with no validation.
- program: the site's hero says '110+ Sessions' and '75+ Speakers', and the homepage still carries 2025 blocks below the 2026 content.

**Files**
- Outputs: /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-agenda/
- Raw captures: /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/raw/scw-agenda/
- Parser: /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/scw-agenda.py
- Geocoder: /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/scw-agenda-geocode.py

## Gaps

- REPORT.md was not written: the harness refuses report files from subagents. Its full content is in this summary and the gaps below; _stats.json holds every count, the kind rule used per event, and the consistency-check result (problems: []).
- End times: the source gives none for 115 of 116 sessions. Neither the landing template nor the vFairs API template has an end time or duration. The only end time is Beltways (12:00-13:00), from its linked Luma page (https://luma.com/nf6e83vn), which also says 'free, approval required'. Some descriptions state a length (30-min Ten Year Vision, hour-long VC Primer, 45-min Ideation to Validation, 40-min Anyone Can Code, three 25-min rounds of SPEED COACHING); these stay in the description text and are not turned into an end value.
- Per-session venue and room: the vFairs location slot is an unfilled template in all 225 rows (<div class="session-location {LOCATION_CLASS}"> holding only a hidden icon), and the API template has no location field. venue_id is set only for the 8 events whose own text names a place: Union Hall/Beer Hall (both kickoffs), Washington Park (Community Lunch), First Financial Center at 525 Elm St (Beltways; address from Luma), The Transept (10 Year Anniversary Party), Imagination Alley at 1319 Vine St (Soft Launch; address from 3CDC), and Cincinnati Art Week HQ (both 'Out of Office' walks). The other 108 have venue_id null plus a note: the FAQ says attendees check in daily at Union Hall (1311 Vine St) before going to sessions 'at other locations'.
- Cincinnati Art Week HQ address is unresolved. CityBeat (Aug 4 2026) reports a 'new headquarters at 1417 Main St.'; Cincinnati Magazine (Sep 23 2026) says 'Begin at the Welcome Center at 1600 Race St., the main hub for the week.' Address and lat/lng are null until the caw slice confirms which one it is. The source text itself reads 'Cincinnat Art Week HQ' (sic).
- Washington Park has no street address in OpenStreetMap, so its address is null (coordinates are set). The Transept's address (1205 Elm St) is from OpenStreetMap, not from the SCW site.
- Per-session registration and cost: the page has no add-to-calendar, ICS or per-session registration data. registration_url is set only where the description links one (the Beltways Luma page and the Get Unstuck Google Form); cost is null per session. Sessions are covered by the SCW ticket; _tickets.json lists the types from /en/registration-form: $50 general admission (4 types), $250 Corporate, $300 Investor, $0 Student.
- No session images exist (image_url is null). The word 'moderator' never appears on the page, so no one has the moderator role. No session is labeled a keynote.
- Speakers: 9 show only the site's generic avatar, so headshot_url is null (Adam Tucker, Andrew Caprariello, Ann Thompson, Ben Wolber, Broder Schmidt, Jake Smierciak, Peter Schmidt, Scott Edsall, Tammie Scott). Brendon Cull and Chase Dawson have no bio. The 3 speakers named only in descriptions (Andrew Deye/JobsOhio, Bryan McCleary/CincyTech, Kameron Seabrook/Obai) have no bio or headshot. 18 sessions list no speaker at all.
- /en/speakers-page shows only the heading 'Founders On Stage:' with no list. No Featured Founders page exists (the hero's counter is commented out). /en/speakers, /en/content, /en/content-page, /en/featured-founders, /en/agenda, /en/sessions and /en/webinars all return 404. vFairs virtual-hall session pages need a login and were not attempted.
- Playwright could not load the site: Chromium fails with net::ERR_CERT_AUTHORITY_INVALID behind the container proxy, even with the proxy set explicitly. I did not change trust settings. The XHR endpoints were found by reading agenda_timezone.js and fetched with curl: /en/get-agenda-html-based-on-timezone and /en/get-agenda-html-based-on-visitor-filters return the same agendaHTML. The page is server-rendered, so nothing is missing.
- No SCW 2026 session other than Beltways turned up on Luma, Eventbrite or startupcincy.com. The events widget on startupcincy.com is loaded by script, and its startupcincy-week- page still shows 2025 content.
- 2025 remnants, all excluded; every one of the 116 sessions is dated Oct 5-8 2026. Agenda page: hero photo file sucw2025previewbyrhinemedia-084.jpg; a hidden 'Event schedule' row reading 'StartupCincy Week 2025 is packed...'; some 2026 headshots reuse files named 2025SUCWHeadshotsByRhineMedia_*. Homepage (for the program slice): a 2025 block 'OCT 6-9, 2025 / Union Hall' and a 2025 'Event Overview' dated Mon Oct 6 to Thu Oct 9 sit below the current 2026 'Week at a Glance' (Oct 5 Kick-off, Oct 6 Capital, Oct 7 Growth, Oct 8 Students).
- Source quirks kept as-is, with notes: 'AI & IP' starts at 4:01 pm; the name 'jeremy jarrett' is lowercase; Aftab Pureval's bio is cut off mid-sentence; Denise Dunlap's bio contains her email addresses; the title says 'Thompson Hines' but the sponsor line says 'Thompson Hine'; the API template lists Eric Rose twice (deduped); Jeff Harris's designation differs between the two templates. One correction: Austin Zani's org field shows an email address, so org is set to 'Pay Theory', taken from his bio.

## Files

- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-agenda/events.json (116)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-agenda/people.json (151)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-agenda/venues.json (6)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-agenda/orgs.json (18)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-agenda/_tickets.json (6)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-agenda/_stats.json (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/scw-agenda.py (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/scw-agenda-geocode.py (1)
