# The Interchange: a 22-second Reel, September 2026

A launch Reel for Cincy Week made the [/brag](https://github.com/latent-spaces/brag) way (its lean
`/brag-slim` rules): a hook in the first second, big type, the product doing its job, a punchline, and
its own soundtrack. Made by [`../build-reel.mjs`](../build-reel.mjs).

| File | What | Use it for |
|---|---|---|
| `cincy-week-reel-9x16.mp4` | 1080×1920, 30 fps, 22.0 s, H.264 High + AAC 48 kHz stereo, −14 LUFS | Instagram Reels, TikTok, YouTube Shorts, LinkedIn video, Stories |
| `cover-9x16.jpg` | the frame at 2.4 s (also baked in as frame 0, so every platform's thumbnail shows it) | the Reels cover |
| `share-copy.txt` | the caption | the post |
| `brag-plan.md` | the storyboard: every position, line, source and sound, with the reading-time table | editing it |

## The idea

Cincy Week draws the week as a transit map: each program is a line, each day a station, and on Thursday,
Oct 8, three lines meet in a white capsule, the interchange. That drawing is also the site's logo. The
Reel plays it straight: three lines drop down the screen and a capsule slams across them ("Three
festivals. One Thursday."), the camera pulls back to the whole week with the site's tagline as the key,
Thursday's timetable runs (Art Week at noon, StartupCincy at 2:15, BLINK's drone show at 8:30, and the
screen flips to the site's Night edition when BLINK starts), the real site counts Thursday's 31 events
and a tap stars the drone show, and then the capsule slams again, this time onto the logo, over
Cincinnati's motto from the site's footer: *Juncta juvant: things joined together help.*

| Time | Scene |
|---|---|
| 0.0–2.5 | Masthead (logo, Oct 3–11, 2026, Cincinnati & Northern Kentucky); "Three festivals." / "One Thursday."; lines A and S drop, the capsule slams on THU 8, B launches |
| 2.5–6.5 | Pull-back to the whole week line (all five lanes, Sat 3–Sun 11); the tagline as the program key: "Art Week, / StartupCincy Week / and BLINK / in one guide" |
| 6.5–12.5 | Thursday, Oct 8: 12:00 PM Exhibitions + Art Market (draft schedule), 2:15 PM Student Pitch Competition, 8:30 PM BLINK "First Sight" Drone Show; night falls at 8.5 s |
| 12.5–16.0 | The real site on a phone (The Week, Thursday, Night edition): the scroll counts to 31, a tap on the drone show's star, the site's own "Added to My Plan" toast |
| 16.0–18.5 | The stripes drop into the logo's square, the capsule slams: "Juncta juvant: things joined together help." |
| 18.5–22.0 | The end card: logo, dates, river rule, the five program bullets, fritzhand.github.io/cincy-week, "Independent guide, not affiliated with the organizers." |

## Where every word comes from

Nothing on screen is typed into the script by hand except the two hook lines, which condense the home
page's headline ("Three festivals share one week, and on Thursday all three run at once."). The rest is
read at render time, and the render stops if the site has changed:

- the masthead date and region, the "Interchange" label and Thursday's count: `docs/index.html`;
- the tagline and the address: `site.config.json`;
- the three stops' times and titles: `data/events.json` (the render fails if one moves, is cancelled or
  changed, or if the Art Week stop loses its draft-schedule tag);
- the program runs: `data/programs.json` (the render fails if a date changes);
- the count "31 events on Thu, Oct 8": the live page, checked four ways (the result line, the day tab,
  the cards on the page, the home page's week line);
- the motto, its label and the independence line: the site footer;
- the toast: the site's own, from a real click on a real star.

## Sound

An original score, computed note by note in [`../lib/synth.mjs`](../lib/synth.mjs) and
[`../lib/reel-score.mjs`](../lib/reel-score.mjs): no samples, no licensed tracks. 120 BPM in D major
(B minor for the Night edition), written to the picture. Each line is a note (A = D, S = F#, B = A), the
capsule is the D major chord (at 0.5 s and again at 16.5 s), night falls on a B minor pad at 8.5 s, and
the end card resolves on D6/9, all five lines. The effects (station ticks, the tap, the whooshes) are
pitched in D and share the music's room. Mixed to −14 LUFS with a −1.5 dBTP ceiling. It also reads with
the sound off.

## Posting notes

- **Cover.** Upload `cover-9x16.jpg` as the Reel's cover. Its text sits in the middle 3:4, so the profile
  grid's crop keeps the logo, the dates, the headline and the interchange.
- **Instagram's overlays** cover the top ~220 px, the bottom ~420 px and a column on the right. Every line
  meant to be read sits inside x 64–940, y 250–1480 (the render checks this on every frame).
- **Music.** The soundtrack is original, so it can stay; if you'd rather use a track from Instagram's
  library, lower the original audio in the editor.
- **Caption.** `share-copy.txt`. Put fritzhand.github.io/cincy-week in the bio; Reels captions don't link.

## Rebuild

```bash
node build.mjs                                                            # the site first
NODE_PATH=/opt/node22/lib/node_modules node collateral/build-reel.mjs     # frames, score, mux (about 2 minutes)
NODE_PATH=/opt/node22/lib/node_modules node collateral/build-reel.mjs stills 2.4,8.8,15   # review PNGs
NODE_PATH=/opt/node22/lib/node_modules node collateral/build-reel.mjs audio               # the score alone
node collateral/lib/review-tools.mjs sheet collateral/reel-2026-09/cincy-week-reel-9x16.mp4 sheet.png 2 8
```

Every frame is a pure function of time. The site's clock is installed and paused at Thu, Oct 1, 2026,
9:41 AM Eastern and advanced one frame per frame, so the site's timers (the toast's 3.2 s) run on the video's time. The per-frame audit
(reading time and safe zone for every line) is written to `.cache/reel/audit.txt`, and the render stops
if a line fails.
