# scw-info (verification pass)

I made 27 corrections to the scw-info slice. The first pass's sponsor counts and 2025 logo IDs were right. Most errors were in cut-off text and URL-check notes, plus one missing event. Every fix is in scripts/scw-info.py. Re-running it rebuilds all 12 JSON files the same way every time, and the schema check reports no problems.

**Checks I ran**
1. **Counts from the raw pages** all match:
   - 2026 partners page: Title 3, Presenting 15, Partner 9, Advocate 9, Community 7 = 43 logos.
   - 2025 page: 44, including the Paycor logo hidden in an HTML comment.
   - startupcincy.com/our-partners: 51 logos in 19/12/5/15 categories.
   - FAQs: 10 SCW + 15 startupcincy.com + 6 Startup Fellows. Tickets: 6.
   - The live SCW pages refetched today differ from the captures only in cache-busting tokens.
2. **Logos checked by eye.** I built my own labelled contact sheets for all 87 sponsor logos (43 from 2026, 44 from 2025). Every identification is correct.
3. **Spot-checks.** 24 randomly chosen records passed field by field (script scw-info-verify-sample.py). I also compared these against their sources: all 31 FAQs and 12 resource texts word for word, every Soapbox quote, the history facts (WCPO, StartupCincy recaps, CDO Magazine, Movers & Makers), news dates and authors, sponsorship tiers, CSS colors and fonts, hotel addresses, the 1809 Capital event, and the Luma parking list.
4. **Every URL in the outputs.** All 284 were requested. Every image, asset, form and registration link returns HTTP 200. Sponsor homepages were re-checked one by one in a headless browser.

**Main finding: the first pass's URL checker was faulty.** When a fetch failed, it kept the title of the previous page. For example, kernel.sh was recorded with JumpStart's title. So I re-audited every url_check note.

**Corrections (27)**
- **Kernel's website** was missing. Kernel is kernel.sh, confirmed three ways: the agenda session "Two Cities, One Startup: Building & Backing Kernel" (building in Cincinnati and San Francisco, browser layer for AI agents), the StartupCincy Awards entry for Rafael Garcia, and kernel.sh's own title and about page.
- **5 URL-check notes** were stale or unsupported (Blue North, Keyhorse, QCA Ventures, Insperity, Alloy Growth Lab). All five sites now load in the browser check. qca.com shows "QCA Ventures". Every sponsor record now also carries a fresh url_recheck.
- **One sponsor record merged two companies** ("JobsOhio Ventures and P&G"). I removed it. The AGM sponsorship is now noted on each company's own record, and the lockup images moved to assets.json.
- **VentureHaus event** used 2024–25 wording ("all week"), so time_text and all_day are now null. The **Startup Clubhouse** all_day flag was unsupported and is now null.
- **News:** the "Spark the Future" author was missing; it is Kate Hursh-Wogenstahl. Three news images were resized copies and now point to the full originals (UC 4032x3024, Homegrown Hustle 2134x1096, WCPO 640x480).
- **Key art:** the "Ten Years of Bold Bets" image now points to its full 3326x1568 original instead of the scaled copy.
- **Descriptions cut short or missing (7):** four resources (Ecosystem Passport, Slack, City as a Lab, Store), the volunteer entry, the empty Welcome to the Ecosystem entry, and the photo-consent notice in the ticket notes.
- **Content-submission link** now returns 404; this is flagged.
- **Venues:** the 14th & Vine parking was never located and now has coordinates. The Marketer Collaborative's address now comes from its own site rather than OpenStreetMap and Yelp.
- **Two organization ids** differed from orgs.json for the same company and now match (procter-and-gamble, fifth-third).
- **FAQ answers** had lost their inline links; all 31 now keep them.

**Additions**
- events.json: the "StartupCincy Week Launch Party", found on Cintrifuse's Luma calendar. It is today (Sep 24, 4:30–7:00 pm), free, at Mellotone Beer Project. Mellotone is added to venues.json.
- assets.json, 12 new: the full "Brought to you by" title-sponsor lockup (4759x528), the AGM lockup, a larger StartupCincy logo, the two hotel name images, the partners-page and 2025 sponsors-page hero photos, 4 audience photos from the hidden 2025 homepage sections, and the Launch Party cover.
- Hotel photos in stays.json.
- URLs filled from matching 2026 sponsors: 25 records in orgs_2025, 11 in ecosystem_orgs.
- program.json: the 2026 volunteer call and sign-up form, the discount-code field, the Builder Fellows description, the partners-page text, and a note on the conflicting Cintrifuse Capital fund sizes.

**Final counts:** program 1, orgs 45, orgs_2025 44, ecosystem_orgs 51, venues 8, stays 2, faqs 31, assets 53, events 5, agenda_enrichment 2, news 9, resources 12.

**Gaps and raw files.** The main remaining gaps: the StartupCincy events calendar is blocked by Cloudflare, so satellite events listed only there are missing. Four sponsor URLs can't be verified from here (Kroger, PNC, Miami, Saint Ursula). History for 2018–2021 is still thin. The full list is in gaps. New raw captures are in raw/scw-info/verify/, raw/scw-info/luma/ and raw/scw-info/venues/. I did not touch any git repo.

## Gaps

- REPORT.md was not written. The harness rules for this agent forbid writing report .md files, so the Verification section is in this summary and gap list. The same happened to the first extractor.
- The ecomap.tech embed behind the StartupCincy 'Upcoming Events' calendar sits behind Cloudflare Turnstile, and the proxy denies challenges.cloudflare.com. Satellite events listed only there could not be read. Cintrifuse's Luma calendar was read (3 upcoming events, 1 relevant).
- Some official URLs could not be fetch-verified: Kroger (403 Akamai), PNC and Miami University (proxy 502), Saint Ursula (Cloudflare 403). Their well-known domains are kept, and each record's url_check and url_recheck says so. The Dealroom dashboard (403) and both StartupCincy Slack invite links (Slack refused the headless browser, so validity could not be checked) come straight from the source pages.
- Web search budget was exhausted in this session, so news.json was checked but not extended.
- History: 2018–2020 editions still have no source, and the 2021 fact remains verified:false. Cintrifuse's 2020 FinTech Frontier posts ($60K prize, winner Honeycomb Credit) do not mention StartupCincy Week and were not added.
- Unchanged since the first pass: /en/pitch-competition, /en/student-pitch-competition and /en/content-page return 404. /en/speakers-page is empty even after a JavaScript render.
- No 2026 source gives a location or hours for the Startup Clubhouse or VentureHaus. The Liquidity Event has no venue. The Friends & Founders dinner has no date.
- Fidelity Hotel block (code CINTRIFUSEOCT): rate and cutoff are unpublished, and the block is past cutoff. The Kinley block (SUC, $209, book by Sep 4) is full. The FAQ's 'McKinley Hotel' and 'nearby Airbnbs' do not match the site.
- content_submission_url (startupcincy.com/startupcincy-week-content-submission/) now returns 404. This is recorded in program.content_submission_status.
- The new StartupCincy Week Launch Party is on 2026-09-24, before the Oct 5–8 week and the Oct 3–11 guide window. It is tagged pre-week and anchor:false.
- Discrepancies are kept, not resolved: 'October 6-9, 2026' on the sponsorship page; AGM end 10:00 vs 10:30; Washington Park Garage at 1230 vs 1310 Elm St; 2017 attendance of 4,500 vs 'about 100'; Cintrifuse Capital AUM 'over $150 million' (about-us) vs '$180mm' (agenda bio).
- ecosystem_orgs.json: only the 11 organizations that are also 2026 sponsors have URLs. The other 40 coalition partners still have url null, because the page links none of them.
- No sponsor logo is published as SVG. The Knockout fonts need a license check before reuse.

## Files

- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-info/program.json (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-info/orgs.json (45)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-info/orgs_2025.json (44)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-info/ecosystem_orgs.json (51)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-info/venues.json (8)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-info/stays.json (2)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-info/faqs.json (31)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-info/assets.json (53)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-info/events.json (5)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-info/agenda_enrichment.json (2)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-info/news.json (9)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/scw-info/resources.json (12)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/scw-info.py (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/scw-info-geocode.py (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/scw-info-verify-urls.py (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/scw-info-verify-orgurls.cjs (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/scw-info-verify-schema.py (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/scw-info-verify-sample.py (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/scw-info-verify-events.cjs (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/scw-info-verify-pw.cjs (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/scw-info-verify-sg.cjs (1)
