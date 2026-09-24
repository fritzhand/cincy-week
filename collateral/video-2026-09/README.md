# Walkthrough video, September 2026

A 32-second, silent walkthrough of Cincy Week on a phone, made by
[`../build-video.mjs`](../build-video.mjs).

| File | Size | Use it for |
|---|---|---|
| `cincy-week-walkthrough-9x16.mp4` | 1080×1920, 30 fps, H.264 | Instagram Reels and Stories, LinkedIn video, TikTok |
| `cincy-week-walkthrough-4x5.mp4` | 1080×1350, 30 fps, H.264 | Instagram and LinkedIn feed posts |
| `poster-9x16.jpg`, `poster-4x5.jpg` | the frame at 3.5 s | a cover image where a platform asks for one |

## What happens, second by second

| Time | On the phone | Caption |
|---|---|---|
| 0–1.5 | The nameplate and the dates; the phone rises | *Art Week, StartupCincy Week and BLINK in one guide.* |
| 2.5–5 | The home page scrolls to *At this hour* | *What's on now, and what's next.* |
| 5–7 | Down to the week line; a tap on Thursday | *The week on one line.* |
| 7–10.5 | The Week on Thursday; the BLINK filter; scroll to the drone show | *364 events, by day and time.* |
| 10.5–14.5 | The event opens; *Add to My Plan*; the toast; close | *Star what you want to see; it goes to My Plan.* |
| 14.5–19.5 | Map from the dock; a tap on a cluster zooms in; a tap on a pin opens it | *67 venues and 75 works on the map.* |
| 19.5–24.5 | Search from the dock; "Findlay Market" typed; the venue page | *Search sessions, people, art and places.* |
| 24.5–28.8 | My Plan from the dock: the export button, then Thursday's starred events with their overlaps flagged | *The events and art you starred, by day.* |
| 28.8–32 | The phone leaves; the nameplate, the address, the four programs, the independence line | none |

Everything on the phone is the real site from `docs/`, running live. The browser's clock is set to
Thursday, Oct 8, 2026, 7:30 PM Eastern (BLINK's opening night), so the site shows its during-the-week
states; the phone's status bar reads 7:30 to match. Captions are the site's own words (the tagline, the
week line's heading, the schedule lede, the map kicker, the search placeholder, the My Plan lede) and
one count from `data/`; *What's on now, and what's next.* is the only hand-written line. My Plan starts
with three published Thursday events (Student Pitch Competition, the Ready. Set. BLINK! Opening
Ceremony, Flip the Switch); the drone show is added on camera.

## Posting notes

- **No sound.** Add music in the app if you want it (Instagram's and LinkedIn's libraries are licensed
  for use there); the video is made to read with the sound off.
- **Reels.** Instagram's caption and buttons cover the bottom of a 9:16 video, where the phone's dock
  is; the video's captions sit at the top, clear of them. For a feed post, use the 4:5 cut.
- **Caption.** The copy in [`../instagram-2026-09/caption.md`](../instagram-2026-09/caption.md) and
  [`../linkedin-2026-09/CAPTION.md`](../linkedin-2026-09/CAPTION.md) fits the video too.
- **Rebuild after data changes.** `node build.mjs`, then
  `NODE_PATH=/opt/node22/lib/node_modules node collateral/build-video.mjs` (about 10 minutes for both
  cuts; `stills 9x16 3,11,18` renders review PNGs instead). It needs an ffmpeg with libx264:
  `pip install imageio-ffmpeg` provides one, or set `FFMPEG=/path/to/ffmpeg`.
