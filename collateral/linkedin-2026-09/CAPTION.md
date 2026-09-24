# LinkedIn post, Cincy Week launch

Eight cards at 1080×1350 (4:5), numbered in reading order. Upload them as a multi-image post
(LinkedIn keeps filename order), or post `cincy-week-carousel.pdf` as a document (eight pages,
same order, vector text). Paste each image's alt text from [`alt-text.md`](./alt-text.md).

Every number below is counted from `data/` by the build (see the table at the end). If the data
changes, rebuild the cards and update the numbers here to match `alt-text.md`.

---

## Caption, full version

Cincinnati's first week of October is a lot. Cincinnati Art Week runs Oct 3–10, StartupCincy Week
Oct 5–8 and BLINK Oct 8–11, with the FotoFocus Biennial from Sep 30 to Nov 1. Each has its own site,
schedule and map. I put them in one place.

Cincy Week is an independent guide to the week: 364 events by day and time, 373 speakers, artists
and curators, 79 works of art, 108 venues on one map, and where to stay and how to get around. Star
what you want to see and it goes to My Plan, which flags overlaps and exports to your calendar.

fritzhand.github.io/cincy-week

Everything in it comes from the organizers' own public pages, and every page links to its sources.
Where an organizer hasn't published something yet, like a room or an end time, the guide says so
instead of guessing. It isn't affiliated with any of the organizers, so check the official sites
before you go.

If you're speaking, showing work or organizing that week and something is wrong or missing, send me
the link to the official page.

It's open source, and it runs on the same engine as my startup-india-guide. Fork it for your own
city's big week.

github.com/fritzhand/cincy-week

#Cincinnati #StartupCincy #FotoFocus #OpenSource

---

## Caption, short version

Cincinnati's first week of October, in one guide: Cincinnati Art Week (Oct 3–10), StartupCincy
Week (Oct 5–8), BLINK (Oct 8–11) and the FotoFocus Biennial. On Thursday, Oct 8, all three run at
once.

364 events, 108 venues on one map, and a plan you can build and export to your calendar. Built from
the organizers' own pages, with sources linked on every page. Independent, not affiliated with the
organizers.

fritzhand.github.io/cincy-week

---

## First comment (optional)

How it's made: the events, people, venues and sponsors come from the organizers' public pages
(startupcincyweek.com, blinkcincinnati.com, cincinnatiartweek.com, fotofocus.org and the venues'
own sites), each record with its source link. Map data © OpenStreetMap contributors (ODbL). The code
and the data are on GitHub: github.com/fritzhand/cincy-week

---

## Card order

| # | File | Carries |
|---|---|---|
| 01 | `01-cover.png` | The nameplate, the river rule, the home page headline and dek, the four programs with their dates, the independence line |
| 02 | `02-week.png` | *The week on one line*: the site's week line on a phone, Thursday Oct 8 as the interchange |
| 03 | `03-programs.png` | The site tagline, the four programs with dates and counts, plus the other happenings |
| 04 | `04-schedule.png` | *364 events, one schedule*: The Week on a phone, on Thursday Oct 8 |
| 05 | `05-map.png` | The map page's own kicker and lede, the map on a phone |
| 06 | `06-my-plan.png` | My Plan on a phone with published Thursday events starred |
| 07 | `07-sources.png` | How it is made: the About page's lede and six counts |
| 08 | `08-read-it.png` | The address, the repo, the independence line, the byline |

## Where the caption's claims come from

| In the caption | Source |
|---|---|
| Program names and dates | `data/programs.json` `dates`; the cards read the same fields |
| 364 events, 373 people, 79 works of art, 108 venues | Record counts of `data/events.json`, `people.json`, `works.json`, `venues.json` (card 07) |
| On Thursday, Oct 8, all three run at once | The home page headline (card 01) |
| Star what you want to see and it goes to My Plan | The Week's lede (card 04) |
| Flags overlaps, exports to your calendar | My Plan (`plan.html`): conflicts and the calendar export (card 06) |
| From the organizers' own public pages; not affiliated | The About page's lede and the site footer (cards 07, 08) |
| Sources linked on every page | The home page byline |
| Says so instead of guessing | The site prints "Room not listed", "end time not listed" (CLAUDE.md rule 1) |
| Same engine as startup-india-guide | README: the shell and UX come from `fritzhand/startup-india-guide` |
| #StartupCincy, #FotoFocus | `data/programs.json` `hashtags`; #Cincinnati and #OpenSource are chosen by hand |
