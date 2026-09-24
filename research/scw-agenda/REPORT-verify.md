# scw-agenda (verification pass)

I made 10 corrections. The first pass's core data was accurate: no session, speaker, title, organization, bio, headshot, time or topic value was wrong. The fixes fill fields it had left null or missed, all from official sources, plus one dropped link. Every change is made in `scripts/scw-agenda.py` (re-run, not hand-edited), and each new fact is checked against a saved raw capture at run time (`proof_ok`); the parser reports 0 problems.

**Corrections**
1. **Cintrifuse Annual Meeting end time:** set to 10:30. The first pass said only Beltways had an end time, but the SCW registration form offers the add-on "Cintrifuse Annual Meeting | Oct 6 at 8:30-10:30am" on all 6 ticket types. Notes also quote the host page's "8:30 – 10am".
2. **Cintrifuse Annual Meeting venue:** set to `union-hall`, from cintrifuse.com ("Union Hall 1311 Vine Street, Cincinnati OH 45202").
3. **Cintrifuse Annual Meeting cost and registration:** now a free add-on to any SCW ticket, with `registration_url` set to the registration form and the tag `registration-add-on`.
4. **New speaker, Guy Persaud:** "President of Habitat Care, P&G; Cintrifuse Board Chair", listed as a Key Speaker on cintrifuse.com but not in the SCW speaker list. Linked to the Annual Meeting; people.json goes from 151 to 152.
5. **Student Pitch Competition venue:** set to `union-hall`. The application form linked from the SCW homepage says "you must pitch in person at Union Hall".
6. **Washington Park address:** was null, now 1230 Elm St 45202, from washingtonpark.org.
7. **Cincinnati Art Week HQ address:** was null, now 1417 Main St 45202, geocoded to 39.111849, -84.51262. The organizer's page reads "1417 Main St. Cincinnati Art Week Temporary HQ + Art Market", and CityBeat calls it the "new headquarters". 1600 Race St is a different place (the Welcome Center). Added `same_as: caw-art-market-hq-1417-main`.
8. **The Transept address:** now sourced from the venue's own site ("1205 Elm St, Cincinnati, OH 45202") instead of OpenStreetMap only.
9. **Zach Bahorik's website link:** his bio is only the URL https://fbtgibbons.com/people/zachary-d-bahorik/, which the parser dropped. The parser now keeps any full URL in a bio as `links.website`.
10. **Ticket add-ons:** `_tickets.json` had none. Each ticket now has `package_id` and `add_ons`: the Cintrifuse Annual Meeting on all 6 tickets, and the Liquidity Event (Investor Happy Hour, Oct 6 5:00pm) on the investor ticket.

I also added an `other_sources` list to every event, filled for 4 events, so provenance beyond `source_url` is kept.

**Verification checks**
- **Freshness:** re-fetched the live agenda page, the API endpoint, the registration form and the homepage. The agenda page differs from the capture only in a countdown number; the API file is byte-identical.
- **Counts, re-derived with my own regex and lxml, not the parser's code:**
  - 116 unique `agenda-row` ids in the API, the same 116 in the default API capture, and 225 landing rows.
  - Day tabs hold 39, 24, 36 and 14 rows; adding the 3 sessions that appear only under "Sessions by Topic" gives 40, 24, 37 and 15, matching events.json.
  - 179 speaker slots in the API; after removing the Eric Rose duplicate, 178 match the JSON.
  - 148 unique speaker names on the landing page equal the 148 in the API; 97 sessions have speakers.
  - All 15 topic tabs map to `tracks` exactly (0 mismatches).
- **Field-by-field check of every record:** `scripts/scw-agenda-verify.py` compares all 225 rows, all 116 events and all 148 listed people with the saved and the live page (title, time text, description, speakers, title/org, bio, headshot, links in both directions). 0 mismatches.
- **Random spot check:** 15 events and 15 people against the live page, all correct; saved in `raw/scw-agenda/verify/spotcheck.txt`.
- **Images and links:**
  - All 139 headshot URLs answer a 1-byte range request with 206 and an image type.
  - Where the two templates give different headshot URLs, the files are identical, and sampled sizes (183 to 1819 px) show these are the uploaded originals.
  - All 9 source and registration URLs return 200.
- **Places the first pass hadn't looked:** the registration add-ons (found), the host pages (found), all inline scripts, the hidden 2025 wrapper, vFairs detail URLs, the sitemap, the speakers page, homepage names, and descriptions for unlinked speakers or places (none beyond the 3 already added; Tisha Livingston is a history mention, not a speaker).
- **Schema:** ids are unique kebab-case; dates are 2026-10-05 to 2026-10-08; times are HH:MM; no empty strings, TBA values or 2024/2025 data; every person and venue reference resolves.
- **Determinism:** two consecutive runs produce identical files.

**Final state:** 116 events (Oct 5: 40, Oct 6: 24, Oct 7: 37, Oct 8: 15). 10 events now have a venue and 2 have an end time. 152 people, 6 venues (all with an address and coordinates), 18 orgs, 6 ticket types with add-ons.

New raw captures are in `raw/scw-agenda/`:
- `cintrifuse-annual-meeting-2026.html`
- `airtable-student-pitch-form.txt`
- `scw-home-2026-09-24.html`
- `washingtonpark-org.html`
- `cincynice-founding-circle-rsvp.html`
- `transept-webfetch.txt`

Live re-fetches, the headshot re-check and the pre-fix copy of the outputs are in `raw/scw-agenda/verify/`.

## Gaps

- REPORT.md was not written. My operating rules forbid report .md files from subagents, and the first pass hit the same block. The Verification section is in the summary below; _stats.json holds all counts, and scripts/scw-agenda-verify.py re-runs the independent check.
- The Cintrifuse Annual Meeting end time conflicts between sources. The SCW registration form's add-on says 'Oct 6 at 8:30-10:30am'; the host page cintrifuse.com says '8:30 – 10am'. events.json uses 10:30 (the program's own site) and quotes both in notes. scw-info/agenda_enrichment.json chose 10:00, so the merge step must pick one.
- End times are still missing for 114 of 116 sessions. Only Beltways (13:00, from Luma) and the Cintrifuse Annual Meeting (10:30, from the registration form) have one. I found no end or duration data in the landing page, both vFairs API templates, the inline scripts (webinarKeywords is all null, customFields is empty), the FAQ, or the homepage.
- 106 of 116 sessions still have venue_id null. The vFairs location slot is an unfilled {LOCATION_CLASS} template in all 225 rows, and neither the agenda text nor any host page names a place for them. The FAQ only says attendees check in daily at Union Hall before going to sessions 'at other locations'. 10 sessions now have a venue (the first pass had 8).
- Guy Persaud (added from cintrifuse.com) has no bio or headshot; the host page has no photos. Also unchanged: 9 speakers show the generic avatar, 2 have no bio, and the 3 description-only speakers have no bio or headshot.
- The Transept's official site returns HTTP 403 to curl, so its address comes from a WebFetch read, saved as raw/scw-agenda/transept-webfetch.txt, rather than an HTML capture. It matches OpenStreetMap.
- Not captured here, left to other slices: sponsor logos (scw-info/orgs.json has them from the partners page); the investor-only add-on 'Liquidity Event (Investor Happy Hour) | Oct 6 at 5:00pm', which is not on the agenda and is recorded in _tickets.json add_ons with event_id null (scw-info/events.json has it); and the Annual Meeting sponsors on cintrifuse.com.
- Still unavailable (re-checked): /en/speakers-page has only the heading 'Founders On Stage:'. Per-session vFairs URLs (/en/webinar/<id>, /en/session/<id>, /en/webinar-detail) and /sitemap.xml return 404. No agenda-context JSON or filter UI exists on the page. No session images, no moderator or judge labels, no keynote label.
- The 2025 remnants excluded by the first pass are confirmed: a hidden eventScheduleRow block wraps the 2026 agenda with 'StartupCincy Week 2025 is packed...' text; the homepage has an 'OCT 6-9, 2025' block and a hidden 2025 'Event Overview'. All 116 sessions are dated 2026-10-05 to 2026-10-08. Some 2026 headshot file names contain '2025SUCWHeadshotsByRhineMedia'; these are only file names.

## Files

- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-agenda/events.json (116)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-agenda/people.json (152)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-agenda/venues.json (6)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-agenda/orgs.json (18)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-agenda/_tickets.json (6)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-agenda/_stats.json (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/scw-agenda.py (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/scw-agenda-geocode.py (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/scw-agenda-verify.py (1)
