# caw

I made 24 corrections and additions to the Art Week data: 9 fixed wrong or unsupported values and 15 filled missing ones. Final counts: program 1, events 34, people 20, venues 8, orgs 15, faqs 12, assets 41 (was 40), opportunities 8, works 4, news 9 (was 8), stays 1. All fixes went into the parser (`scripts/caw.py`), which I re-ran; I did not hand-edit any JSON. The schema checker passes with 0 problems, and 58 of 59 image URLs load.

## Verification

**1. Counts, re-derived from the sources.** Every count matched:
- **Schedule:** 22 items across 8 days, found with my own regex on the live Cargo page. Adding the NO GRID event, its 9 agenda slots, the Happy Hour series and the Founding Circle gives 34 events.
- **FAQs:** 12. **Opportunity cards:** 6, plus 2 forms, so 8.
- **Sponsors:** 6 logos placed on the page, 7 in its media library. The Fifth Third and ArtsWave logo is one image, so it makes 2 org records.
- **Team:** 8 names.
- **Media:** all 25 image files referenced on the site's pages are in assets.json.
- **Draft artists page:** the "Brandon Hill" card really does repeat 8 times.
- **Eventbrite:** the 6 NO GRID speakers and each headshot are matched correctly.

**2. Spot checks against the live sources.** I checked all 22 schedule events, the 10 NO GRID records, 20 people, 8 venue geocodes, 15 org logos (by looking at them), 12 FAQs, 8 opportunities, the news dates and bylines, the asset dimensions and the 8 sponsorship packages. I also re-fetched the site, deck, Eventbrite pages and organizer sitemaps; none had changed.

**Wrong or unsupported values fixed:**
1. Javarri Lewis had a LinkedIn link that appears in no source. Removed.
2. Tiffany Cooper had a LinkedIn link that appears in no source. Removed.
3. Destinee Thomas's personal Instagram was actually the Cincy Nice account. Removed.
4. Megyn Norbut's personal Instagram was actually the No Standing account. Removed.
5. The Model Group link (www.modelgroup.net) fails its security certificate. Changed to https://modelgroup.net/.
6. The CityBeat team photo was noted "Credit not printed". Its caption does credit Andrea Sabugo ("Photo by Andrea Sabugo, provided by Cincy Nice"). Fixed there and on the two copies of the same photo on the Art Week site.
7. Gee Horton's photo said "check license". The Commons page shows it is CC0 (public domain, no credit needed), and that it is an at-work studio photo rather than a posed portrait. Recorded.
8. The Documentation + Storytelling role showed no pay, but its card says "a handful of paid assignments". Filled in.
9. 11 quotes used straight quote marks where the source has curly ones. The parser now copies the source's exact characters; nothing else changed.

**3. Missing data added:**
- **Links:** Javarri Lewis's Instagram and TikTok, Evan Verrilli's Instagram, Jason Snell's X account, and Gee Horton's Instagram, LinkedIn and X.
- **Photos:**
  - Destinee and William Thomas: the shared co-founders photo from Cincy Nice's "Our Team" section, flagged as a group photo.
  - Tiffany Cooper: a portrait from her own About page. It has no caption; it sits above her signed quote.
  - Jason Snell: a real photograph alongside his illustrated avatar, credited "Photo by Andrew Higley for UC Magazine".
- **Site file library:** Cargo's file library turned up one photo never used on the site: CINCYARTWEEK0007.tif, a 58 MB ladder-and-flowers still life. Added to assets.
- **News:** Visit Cincy's Sep 23 October roundup, which had been captured but not used.
- **Event details:**
  - NO GRID: Eventbrite lists parking as not available and a 240-minute duration.
  - Happy Hour: the word "Address" in its description is an unfilled placeholder in the source. Noted.
- **FAQs:** the links inside two answers are now kept.
- **Quote:** a second Destinee Thomas quote from Cincinnati Magazine ("connective tissue").

**Categories I looked for that turned up nothing new:** Cargo's page API (walking every page), about 110 more guessed page URLs, the Cincy Nice Eventbrite organizer page, and all 205 CityBeat posts since Aug 1.

**4. Schema.** The new checker covers id format and uniqueness, date and time formats, allowed values, links between records, stray 2024 or 2025 dates and placeholder text. All pass.

**5. Files.** New inputs are saved in `raw/caw/verify/`. The two new check scripts are `scripts/caw-verify-schema.py` and `scripts/caw-verify-urls.py`. The remaining gaps are listed separately.

## Gaps

- REPORT.md was not written. This subagent's harness forbids writing report .md files, which also stopped the first pass. The Verification section that would have been appended is in the summary field instead.
- The full '30+ artists' list, the exhibition-to-artist-to-storefront mapping, curators by exhibition and the Art Walk routes are still not public. On 2026-09-24 about 06:45 UTC I re-checked and nothing had changed: the live Cargo state of all 24 pages, the sitemap, the sponsorship deck text, the Eventbrite organizer page (only NO GRID is listed), the NO GRID event (lineup, agenda and times), the CityBeat and Cincinnati Magazine tag pages, Threads, and the Cincy Nice and No Standing sitemaps.
- Storefront gallery addresses and the interactive map are not published. The FAQ still says 'will be announced soon'.
- The Cargo page sort order has two unexplained slots (21 and 22) inside the Explore set, between 'explore' (20) and 'schedule' (23). The API's next/prev walk does not reach them, and 110 more URL probes all returned 404. They are most likely deleted drafts, but I cannot rule out hidden pages.
- The day-by-day schedule and hours still come only from the unlisted draft /schedule page and are tagged 'draft-schedule'. Unresolved conflicts, kept side by side in the notes: NO GRID times (Eventbrite 16:00-20:00, its description 4-7PM, draft schedule 6-9 PM) and daily hours (draft schedule, the artist form's '12-8p', and the Gallery Host form's Oct 6 4-7PM).
- Instagram @cincinnatiartweek is still unreadable: the API returns 401 'require_login', and the profile /embed/ page loads its posts client-side. Artist announcements posted only on Instagram may be missing.
- The web-search budget was already used up when this pass began. Instead I fetched sources directly. I scanned every CityBeat post from 2026-08-01 to 2026-09-24 through its WordPress API (205 posts; the only Art Week article is the Aug 4 piece). Cincinnati Magazine's WordPress API is behind a bot wall; its tag page lists only the Sep 23 article. The WCPO and WVXU search pages render in JavaScript, and Soapbox has no API. I did not re-check the Enquirer or the Business Courier.
- Still no headshot for Megyn Norbut, Candra Reeves, Chas Wiederhold, Daniel Iroh, Bailey Elderberry, Andrea Sabugo, Evan Verrilli, Brandon Hill or Isaiah Armstrong; Mz. Icar is an anonymous collective. Destinee and William Thomas share one uncaptioned photo of the two co-founders (flagged headshot_is_group). Tiffany Cooper's headshot is an uncaptioned portrait on her own About page.
- The Gee Horton image is CC0 (read from its Commons file page), but upload.wikimedia.org returns HTTP 429 to this container, so the other 58 image URLs are verified by fetch and this one only through its Commons page.
- Candra Reeves still has no bio. Group-4.png (the green 'LMS' wordmark in the footer media library, not placed on any page) is still unidentified. Bailey Elderberry's display name still comes only from the Instagram handle.

## Files

- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/caw/program.json (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/caw/events.json (34)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/caw/people.json (20)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/caw/venues.json (8)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/caw/orgs.json (15)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/caw/faqs.json (12)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/caw/assets.json (41)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/caw/opportunities.json (8)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/caw/works.json (4)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/caw/news.json (9)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/caw/stays.json (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/caw.py (0)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/caw-verify-schema.py (0)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/caw-verify-urls.py (0)

## QA audit (2026-09-24, data-accuracy auditor)

Corrected downstream in `scripts/merge-research.mjs` (tables `QA_PERSON_FIX`, `QA_PERSON_DROP`, `QA_LOCATION_LABEL`):
- bailey-elderberry: the name "Bailey Elderberry" was built from the handle @baileyelderberry. The artist is **Bailey Elder**
  (bailey-elder.com, "Info - Bailey Elder", links instagram.com/baileyelderberry; "I am an artist living in Ludlow, Kentucky").
- brandon-hill, isaiah-armstrong, daniel-iroh are dropped: their only 2026 evidence is the unlisted /artists template (the
  "Brandon Hill" card repeats 8 times; Daniel's image is the placeholder "YOUR-DANIEL-IMAGE-URL").
- andrea-sabugo is not a CAW participant (photo credits only); she stays a FotoFocus "Cultural Ties" artist.
- NO GRID slots at "Location #2/#3" now read "NO GRID Location #2 (venue not named by the organizers)".
- Bios taken from another page (`bio_source_url`) are now listed as sources on the person page.
- Checked and kept: the NO GRID event time 4–8 PM is Eventbrite's startDate/endDate; the description ("4:00-7:00PM") and the
  draft schedule ("6-9 PM") disagree and the conflict stays in notes.
