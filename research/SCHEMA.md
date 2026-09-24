# Cincy Week research schema (shared by every research agent)

Project: **Cincy Week** (repo `fritzhand/cincy-week`), a static GitHub Pages guide that combines the
overlapping Cincinnati events of early October 2026 in one place:

| id | Program | Dates (2026) | Site | Organizer |
|---|---|---|---|---|
| `caw` | Cincinnati Art Week | Oct 3–10 | https://cincinnatiartweek.com/ | Cincy Nice (https://www.cincynice.com/) with No Standing |
| `scw` | StartupCincy Week (10th year) | Oct 5–8 | https://startupcincyweek.com/ (vFairs) | StartupCincy / Cintrifuse |
| `blink` | BLINK Cincinnati, a festival of light & art | Oct 8–11 | https://www.blinkcincinnati.com/ | BLINK (Cincinnati Regional Chamber, ArtsWave, Haile Foundation, AGAR, …) |
| `also` | Anything else verifiable in Cincinnati Oct 3–11 2026 (e.g. FotoFocus Biennial 2026) | | | |

Today is 2026-09-24. The site will be the combined resource for visitors: events, schedules, venues,
speakers, artists, curators, sponsors, where to stay, how to get around, and news.

Directories (absolute):
- `S=/tmp/claude-0/-home-user/2c073cdf-a360-5298-a94c-59bd6e1e86ef/scratchpad`
- `S/raw/<slice>/`      raw captures (HTML, JSON API responses) you relied on — keep them
- `S/scripts/`          re-runnable parsers (`<slice>.py` / `<slice>.mjs`) that turn raw → JSON
- `S/research/<slice>/` your JSON outputs (one folder per slice, file names below)

## Ground rules

1. **Never invent a fact.** Every record carries `source_url`. Unknown → `null` (not "TBA", not a guess).
2. Keep descriptions and bios **verbatim** from the source (normalize whitespace only; keep paragraph
   breaks as `\n\n`). Do not paraphrase source text. Put any note of your own in `notes`.
3. Dates `YYYY-MM-DD`; times 24-hour `HH:MM` local (America/New_York). Keep the original string too
   when parsing was lossy (`time_text`).
4. Image URLs: absolute, the **largest original** you can find (we will download and resize later).
5. Prefer writing a deterministic parser script over hand-copying. Save raw first, parse second.
6. Be polite to servers: ≤ 2 requests/second, reuse captures instead of refetching.
7. Do not touch any git repo under /home/user.
8. `id` fields: lowercase kebab slugs, stable (derived from names), unique within the file.

## Tools that work in this container

- `curl` (HTTPS proxy is preconfigured; if TLS/proxy issues, read /root/.ccr/README.md).
- Node 22 with a global Playwright: `NODE_PATH=/opt/node22/lib/node_modules node x.mjs` using
  `const { chromium } = require('playwright')` (CJS) or `createRequire`. Chromium is at
  /opt/pw-browsers (do not run `playwright install`). Use it for JS-rendered pages and to discover
  XHR/fetch API endpoints (listen to `page.on('response')` and save JSON bodies).
- `python3` (you may `pip install beautifulsoup4 lxml` if you want them).
- WebSearch / WebFetch tools (load via ToolSearch `select:WebSearch,WebFetch`).
- Nominatim geocoding works: `https://nominatim.openstreetmap.org/search?format=json&q=...` with a
  `User-Agent: cincy-week-research` header, ≤ 1 request/second.

## Shapes (use the files that apply to your slice; omit files you have nothing for)

`program.json` — one object describing the program:
```json
{ "id": "scw", "name": "", "short_name": "", "tagline": "", "dates": {"start": "2026-10-05", "end": "2026-10-08"},
  "description": "", "organizers": [{"name": "", "url": ""}], "url": "", "tickets": [{"name": "", "price": "", "url": "", "notes": ""}],
  "daily_themes": [{"date": "", "theme": "", "highlights": [""]}], "hours": "", "hashtags": [""], "social": {"instagram": "", "x": "", "facebook": "", "linkedin": "", "tiktok": ""},
  "contact": {"email": "", "phone": ""}, "history": [{"year": 2017, "fact": "", "source_url": ""}], "stats": [{"label": "", "value": "", "source_url": ""}],
  "logo": {"url": "", "format": "svg|png", "on": "light|dark"}, "brand": {"colors": [""], "fonts": [""]}, "source_url": "" }
```

`events.json` — sessions, exhibitions, performances, parties, workshops (anything with a time/place):
```json
[{ "id": "", "program": "scw", "title": "", "kind": "keynote|panel|workshop|fireside|networking|party|pitch|exhibition|installation|performance|talk|tour|market|other",
   "date": "2026-10-05", "end_date": null, "start": "08:30", "end": "09:30", "time_text": "", "all_day": false,
   "venue_id": "", "room": "", "description": "", "tracks": [""], "tags": [""], "people": ["person-id"],
   "cost": "", "registration_url": "", "image_url": "", "source_url": "" }]
```

`people.json` — speakers, artists, curators, performers, moderators, organizers, judges:
```json
[{ "id": "", "name": "", "roles": ["speaker|artist|curator|performer|moderator|organizer|judge|host|founder"],
   "programs": ["scw"], "title": "", "org": "", "bio": "", "headshot_url": "", "location": "",
   "links": {"website": "", "instagram": "", "linkedin": "", "x": ""}, "source_url": "" }]
```

`works.json` — artworks/installations (mostly BLINK; also Art Week exhibitions):
```json
[{ "id": "", "program": "blink", "title": "", "artists": ["person-id"], "medium": "projection mapping|mural|sculpture|interactive|light installation|drone show|performance|other",
   "zone": "", "venue_id": "", "location_text": "", "lat": null, "lng": null, "description": "", "image_url": "", "sponsor": "", "source_url": "" }]
```

`venues.json`:
```json
[{ "id": "", "name": "", "address": "", "city": "Cincinnati", "state": "OH", "zip": "", "neighborhood": "",
   "lat": null, "lng": null, "programs": ["scw"], "kind": "venue|zone|gallery|studio|hotel|park|street|other", "url": "", "notes": "", "source_url": "" }]
```

`orgs.json` — sponsors, partners, presenters, organizers, venues-as-brands:
```json
[{ "id": "", "name": "", "programs": ["blink"], "relationship": "presenting sponsor|sponsor|partner|organizer|founding partner|media partner|venue|community partner",
   "tier": "", "logo_url": "", "url": "", "source_url": "" }]
```

`stays.json` — hotels and lodging (room blocks especially):
```json
[{ "id": "", "name": "", "address": "", "neighborhood": "", "lat": null, "lng": null, "url": "",
   "room_block": {"program": "scw", "group_code": "", "rate": "", "dates": "", "deadline": "", "booking_url": ""},
   "notes": "", "source_url": "" }]
```

`faqs.json`: `[{ "program": "blink", "q": "", "a": "", "source_url": "" }]`

`news.json`: `[{ "id": "", "title": "", "source": "", "date": "2026-09-01", "url": "", "programs": ["blink"], "summary": "", "image_url": "" }]`
(`summary` is the one field you may write yourself: one or two neutral, factual sentences drawn from the article.)

`places.json` — neighborhoods, transit, parking, food & drink near venues:
```json
[{ "id": "", "kind": "neighborhood|transit|parking|airport|food|drink|landmark|accessibility|tip", "name": "", "summary": "", "details": "", "address": "",
   "lat": null, "lng": null, "url": "", "source_url": "" }]
```

`assets.json` — logos, key art, brand files you found (for the design team):
```json
[{ "program": "", "kind": "logo|wordmark|key-art|photo|favicon|pattern|font", "url": "", "format": "", "notes": "", "source_url": "" }]
```

`REPORT.md` — what you covered, counts, what you could not get and why, and exact gaps.
