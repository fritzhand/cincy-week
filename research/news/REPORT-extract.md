# news

46 corrections (in 17 news records and 24 facts), plus 42 missing articles and 11 new facts added. news.json now has 201 articles (129 from 2025-2026), facts.json has 99 facts, and both rebuild from the scripts with 0 problems, 0 dropped facts and 0 schema errors.

## Verification

**1. Reproducibility and re-derived counts.** Rerunning news-build.py and news-facts.py reproduced the delivered files byte for byte (159 and 88). I then re-extracted the headline, publish date and canonical link of every record from the raw HTML with my own parser.
- Two dates were wrong. Both Tour de Cincinnati pages were dated 2026-09-22 because the first `<time>` tag on the page belongs to a "related posts" widget. The WordPress REST API gives the real dates: 2026-07-28 (BLINK guide, updated 2026-09-20) and 2026-09-15 (Dates to Know).
- Il Giornale dell'Arte's URL now redirects from /Articolo/ to /Mostre/.

**2. Live URL check.** I checked all 311 article and image URLs with curl, then rechecked the blocked ones in Chromium.
- 6 BLINK newsroom images returned 404 (/files/news/full/). They now point to /files/news/page/, the same image uncropped.
- 2 Covington image URLs contained raw spaces; they are now encoded.
- 6 images used http:// and are now https://.
- After the fixes, every article URL (201) and image URL (198) returns 200.

**3. Spot-check.** I compared 18 random records field by field against the live pages in Chromium: title, date, source, image and URL. All matched apart from the image and URL defects above. One summary said "longtime" where the page says "since 2013", and I corrected it. An automated check of every number and proper name in all 201 summaries against the article text found no unsupported claims; the remaining flags are word forms such as "Fifth" vs "5th".

**4. Facts.** The first pass checked that each quote appears on its page, but not that the quote supports the fact. My check found 17 facts whose numbers were missing from their quote (quotes cut short, one truncated mid-word, one garbled as "A rtsWave" by a drop-cap), plus 4 overstated wordings:
- "took place" for an event that was only scheduled
- "is launching" where the article says "helping launch"
- "presented by", which no source supports
- "ranged" for a figure the article gives as a typical range

I extended the quotes with more verbatim text, joining separate passages with " … ", and news-facts.py now verifies every passage. I reworded the overstated facts. Four facts citing the undated 2024 BLINK Impact Report PDF had the date "2025-07", which breaks the date format; they now have date null and a note.

**5. Coverage.** Sources searched:
- Google News and Bing News RSS
- Sitemaps for WLWT, CityBeat, Cincinnati Magazine, Soapbox, LINK nky, WCPO and WVXU
- Covington's news listing
- Cincinnati Magazine tag pages, loaded in Chromium

This found 42 original articles that were missing. Most came from outlets the first pass had searched (the first pass had captured about 30 of them and then silently left them out):
- **11 from 2025-2026:**
  - WLWT: the June 8 artist announcement, the block party, two on Run the Night, and Mooney's appointment
  - City of Covington: its parking, TANK and rideshare guide
  - Local 12: the Sept. 4 segment
  - Cincinnati Magazine: the StartupCincy Week 2025 feature and the Matt Black / FotoFocus lecture
  - CityBeat: the FotoFocus founder's award and the Al Ghussein mural
- **3 StartupCincy Week history pieces** (2017, 2019)
- **28 BLINK and FotoFocus history pieces** from 2017-2024 (attendance, transit, installations)

The 11 new facts come from these articles, for example BLINK's 10th year, Run the Night's start time and place, TANK Park & Ride on Oct. 9-10, and StartupCincy Week 2025 at 1,000-1,500 attendees with about 40% from outside Cincinnati.

**6. Schema.** IDs are unique kebab-case, dates are YYYY-MM-DD, records are sorted newest first, program tags are valid, image URLs are https only and no HTML entities remain. The extra fields (author, kind, notes, date_source) are kept.

**Script changes (fixes are made in the scripts, not by editing the JSON):**
- **news-build.py:** a fix_image() step (BLINK path, http to https, spaces encoded); per-entry date overrides and final_url; and a guard that rejects dates taken from a bare `<time>` tag unless an override is given.
- **news_curate.py:** the 2 date overrides, the Il Giornale final_url, the summary fix and the 42 new entries.
- **news-facts.py:** multi-passage quotes, text matching that tolerates drop-caps, the PDF date fix, the fact corrections and the 11 new facts.
- **New scripts:** news-verify-discover.py (RSS search) and news-verify-sitemaps.py (sitemap crawler). news-verify-gndecode.py (Google News link decoder) is also saved but did not work.

The evidence is in raw/news/verify/ and verify_news/ (the original outputs are saved as *.orig).

## Gaps

- I did not write REPORT.md. Subagent policy forbids writing report .md files, and the first pass's Write attempt was rejected the same way. The Verification section is in this summary instead.
- WebSearch is exhausted for the session (200 of 200 used). For discovery I used Google News and Bing News RSS instead (50 queries, 1,265 items), plus outlet sitemaps and listing pages.
- The Cincinnati Business Courier (bizjournals) is still blocked. These known stories could not be opened:
- 2026-04-23 "Here's who's being honored at the inaugural StartupCincy Awards"
- 2025-09-11 "StartupCincy Week returns in October. Here's what's new for 2025"
- 2026-05-29 FotoFocus HQ opening
- 2025-07-08 "Cincinnati Chamber announces Blink 2026 festival dates"
- 2025-06-20 "Cincinnati Chamber selects new leader for massive Blink festival"
- 2026-05-20 ArtsWave campaign results
- Axios Cincinnati is still blocked, for example 2026-09-09 on the streetcar's 10 years and 2026-09-10 on ArtsWave Flow.
- The Enquirer sitemap could not be read: curl gets a 402, and the browser request is refused with "Blocked by egress policy". Enquirer coverage therefore still depends on the first pass's site search, so some Enquirer pieces may be missing.
- Some sitemaps gave nothing usable: FOX19's Arc index returned 0 URLs, Local 12 publishes none, and Spectrum's lists no articles. Decoding Google News links also failed. As a result, these stories surfaced in Google News but have no resolvable URL:
- Spectrum News 2025-07-09 "BLINK announces 2026 dates, puts out call for artists to apply"
- WKRC 2025-06-22 "New leader named for Blink"
- WKEF (Dayton) 2025-07-08 "Dates for next BLINK festival announced"
- City of Covington 2026-09-15 "How to Access Covington During BLINK"
- City of Covington 2026-09-14 "BLINK 2026: Experience BLINK in Covington"
- WCPO 2026-09-18 "Come Have Coffee with Leslie Mooney" (probably an event listing)
- Art Week and StartupCincy Week coverage is still thin. Articles dated 2025-2026: Art Week 6, StartupCincy Week 10, BLINK 79, FotoFocus 42, week as a whole 20. No 2026 StartupCincy keynote announcement and no winner of the 2025 $200K pitch competition appear in any source I could open.
- Tour de Cincinnati pages carry no article date in their markup. Their dates now come from the site's WordPress REST API (saved raw). Its "Fall in Cincinnati 2026" guide stays excluded because it doesn't list the week's events.
- One UC News article shows two publish dates: 2026-08-08 (the visible date, kept) and 2026-06-16 (in its WebPage JSON-LD; the URL path is /2026/06/).
- New disagreements between sources, in addition to the first pass's list:
- BLINK 2024 applicants: 944 from 65 countries (WVXU) vs more than 950 (Cincinnati Magazine). Both facts are kept and the notes cross-reference them.
- 2017 Startup Week: nearly 100 events (WCPO) vs 50 sessions (Soapbox). Both kept with notes.
- Aperture gives the Biennial as Oct. 1-31; the official dates are Sept. 30-Oct. 31.
- Several hosts block curl but load in a browser:
- Movers & Makers (202)
- NKyTribune (403)
- The Enquirer (402)
- The Columbus Dispatch (402)
- Cincinnati Magazine (bunny.net challenge; some images 403)
- Indianapolis Monthly (403)

All their article and image URLs return 200 in Chromium. The step that downloads images needs a browser user agent or Playwright.
- BLINK newsroom images top out at about 695 px. The og:image path (/files/news/full/) returns 404; the build now uses /files/news/page/, which is the uncropped version.
- Some 2024 coverage found in the sitemaps was not added, because the history section is already deep:
- CityBeat BLINK pieces migrated from 2017-2024
- WVXU BLINK pieces from 2024
- WLWT's per-installation BLINK 2024 posts

## Files

- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/news/news.json (201)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/research/news/facts.json (99)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/raw/news/meta.json (271)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/news_curate.py (201)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/news-build.py (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/news-facts.py (99)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/news-fetch.py (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/news-verify-discover.py (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/news-verify-sitemaps.py (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/scripts/news-verify-gndecode.py (1)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/raw/news/verify/rss/_items.json (1265)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/raw/news/verify/tourdecincinnati_wp_posts.json (2)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/verify_news/url_status.json (311)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/verify_news/pw_status2.json (71)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/verify_news/sample_live.json (18)
- /tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad/verify_news/sumcheck.py (1)
