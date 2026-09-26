# Brag Plan: Cincy Week ("The Interchange", final)

Winner by total score: **The Interchange** (22.5; two of the three judges' written verdicts also chose it). It is rebuilt here
with the judges' grafts and with every defect they listed fixed (see "Defects fixed" at the end). The biggest change is that
the lines now run **vertically**, as the site's own phone week line does. At that orientation, the hook's three lines and
capsule are the Cincy Week mark (site/img/brand/mark.svg: three vertical stripes under a horizontal capsule). That makes the
punchline a plain visual callback, with no rotation for a stranger to decode.

## What is this app?
Cincy Week (fritzhand.github.io/cincy-week) is an independent guide to Cincinnati's first week of October 2026. It lists the
published sessions, shows and venues of Cincinnati Art Week, StartupCincy Week and BLINK (plus the FotoFocus Biennial and Brand
Fusion) by day and time, with sources linked on every page. It is drawn as a transit map: each program is a line and each day a
station. On Thursday, Oct 8, all three festivals run at once, and the map calls that day the Interchange.

## The angle
We play the site's own metaphor straight. Three colored lines drop down the screen and a white capsule slams across them on
Thursday. That shape is the site's week line, and it is also the site's logo. The Reel names the lines, reads Thursday's
timetable, proves it on the live site, then brings the capsule back as the logo, with Cincinnati's own motto from the site's
footer: "Juncta juvant: things joined together help."

## Hook (first 2-3 seconds)
Frame 1 already shows the masthead: the Cincy Week lockup, "OCT 3–11, 2026" and "CINCINNATI & NORTHERN KENTUCKY". The words
"Three festivals." slam in. A plum line and a vermilion line drop down the lower half, each led by its program bullet. At 0.5 s,
on the first downbeat, a white ink-outlined capsule slams shut across them at the THU 8 station, and "One Thursday." slams in
with a capsule outline tracing around "Thursday". A cobalt line launches down out of the capsule. It reads muted within half a
second (color, speed, a mechanical snap). It poses a small question (which three? why Thursday?) that the next shot answers.
Nothing else in the Reels feed looks like it.

## Key moments (the middle)
- **The week on one line (S2).** The camera pulls back from the capsule and shows the whole week as a poster-scale week line:
  nine day stations from SAT 3 to SUN 11 and five lanes in the site's order. The site's own tagline lands as the program key,
  one bullet per row: "Art Week," / "StartupCincy Week" / "and BLINK" / "in one guide". A stranger learns what the thing is by 3.2 s.
- **Thursday's timetable (S3).** Three real Thursday stops, one per festival and in time order: 12:00 PM Exhibitions + Art Market
  (DRAFT SCHEDULE), 2:15 PM Student Pitch Competition, and 8:30 PM BLINK "First Sight" Drone Show. When BLINK's stop lands, the
  whole frame hard-cuts from the Morning edition to the Night edition. Night falls when BLINK starts.
- **The real site (S4).** A phone rises showing the real The Week on Thursday. It scrolls through Thursday's 31 timed cards while
  a caption counts up to "31 events on Thu, Oct 8". It lands on the drone show, a real tap fills its star, and the site's own
  toast "Added to My Plan · View" rises. The camera pushes in until the toast reads at 40 px.

## Outro / punchline
The ground cuts back to newsprint. Three stripes drop into a rounded square and, on the same chord as the hook, the capsule slams
across them: the hook's interchange is the Cincy Week mark. Above it is "CINCINNATI'S CITY MOTTO", then "Juncta juvant:" /
"things joined together help." The mark shrinks into the lockup and the end card builds around the motto: OCT 3–11, 2026, the
river rule, the five program bullets, fritzhand.github.io/cincy-week and "Independent guide, not affiliated with the organizers."

## User flow worth showing
Entry → key action → result, all on the real site (docs/, live in the phone, one clock for every frame):
1. **Entry:** The Week on Thursday (schedule.html?day=2026-10-08, Night edition). The THU 8 day tab is selected, and under it is
   the header "Thursday, October 8 · 31 events".
2. **Key action:** scroll Thursday's 31 cards to the last one, the 8:30–9:00 PM drone show, and tap its star (a real click on
   `button[data-star="blink-2026-10-08-drone-show-2030"]`).
3. **Result:** the star fills and the real toast "Added to My Plan · View" appears, pushed in to a readable size.

S2 and S3 also show the product: they are the site's own components (the home page's week line and The Week's time-first list),
redrawn at poster scale from the same data because the real ones would be 13 px on a phone.

## Tone
- Preset: default (punchy, clean), with brag-style hard cuts.
- Creative direction: "a transit authority's service notice printed as a city paper's special section."
- Interpretation: the tone is calm, confident and a little dry, and the lines and cuts do the showing off. Type slams in fast
  (0.15–0.2 s, scale 1.12→1 on --ease-out) and then holds dead still. Cuts land on beats. The only grounds are the site's two
  editions, and there are no crossfades. There are no gradients, glows or SaaS words. Program ink appears only on program
  identity (lines, bullets, stripes), and river green only on the river rule and the URL.

## Format: vertical — 1080x1920, 30 fps
## Duration: 22.0 s (660 frames)

## Visual identity (from the project: site/css/tokens.css, exact values)
| Role | Morning edition (light, S1–S3 until 8.5 s, S5–S6) | Night edition (dark, S3 from 8.5 s, S4) |
|---|---|---|
| Ground `--bg` | #f5ecdf | #1f1d19 |
| Surface `--surface` (capsule fill, station fill) | #fffbf4 | #282521 |
| Text `--text`, rules `--rule-ink` | #1c1a17 | #f3eee4 |
| Muted text `--text-muted` | #4d463c | #cdc5b6 |
| Hairline `--border` | #dbcdb8 | #403b33 |
| River green `--accent` (river rule, URL underline) | #1c6b56 | #6cc7a4 |
| Link `--link` (URL text) | #135240 | #8fd8bc |
| A · Art Week `--prog-caw` / letter `-on` | #75295c / #ffffff | #c98aa8 / #1f1d19 |
| S · StartupCincy `--prog-scw` / `-on` | #c23b24 / #ffffff | #fc6a45 / #1f1d19 |
| B · BLINK `--prog-blink` / `-on` | #2747c6 / #ffffff | #86a4fc / #1f1d19 |
| BF · Brand Fusion `--prog-brandfusion` / `-on` | #66700a / #ffffff | #b7c24a / #1f1d19 |
| F · FotoFocus `--prog-fotofocus` / `-on` / `-edge` | #c6cacd / #1c1a17 / #50575e | #e1e4e6 / #1f1d19 / #8b9197 |
| Headline weight `--wght-head` | 640 | 620 (re-weight in the same frame as the flip) |

- Display font: **Newsreader** (roman 400–700, italic 400–600), self-hosted (site/fonts → docs/assets/fonts). Use tabular
  figures (`font-variant-numeric: tabular-nums`) for every time and count.
- Body font: **Public Sans** (300–800). Labels are the site's caps style: Public Sans 650, uppercase, tracking 0.085em.
- Easing: `--ease-out` cubic-bezier(0.16, 1, 0.3, 1) for entrances; ease-in-out for camera moves.
- Strongest visual element: the week line (lanes, open-circle stations, bar termini, and Thursday's white ink-outlined
  capsule) and the mark that is drawn from it. Real files: site/img/brand/{mark,logo,wordmark,river-rule}.svg and the bullet
  sprite from build/core/icons.mjs (A square, S circle, B diamond, BF octagon, F hexagon).

## Share copy (draft)
Three festivals share Cincinnati's first week of October, and on Thursday, Oct 8, Art Week, StartupCincy Week and BLINK all run
at once. Cincy Week puts their published sessions, shows and venues in one independent guide, by day, with sources linked on
every page. Star what you want to see: fritzhand.github.io/cincy-week
(Final text in share-copy.txt. An optional variant can use the owner's line, "I'm from Cincinnati and can't be there, so I built
this for my hometown's big week," as its first sentence. It is true, but it is not needed.)

## Audio direction
- Role: dense rhythmic layer in the middle, with intentional near-silence at 15.5–16.0 before the callback.
- Music: an original synthesized score (collateral/lib/synth.mjs voices; no samples, no licensed tracks). 120 BPM, 4/4, D major,
  moving to B minor for the Night section.
- Music treatment: one 0.5 s pickup, then 2 s bars. It is sparse in the hook (sub, glides, the slam chord), builds with an
  arpeggio as the lines are named, and the groove drops on the Thursday cut (6.5). The pad opens when night falls (8.5), the
  groove carries the phone, the drums drop out at 15.5, the hook chord returns at 16.5, and it resolves on D6/9 at 18.5, fading
  to silence by 21.8 s for a clean loop.
- Music cue guidance: the score is written to the picture, so no cue detection is needed. Strong cues are at **0.5 s, 8.5 s and
  16.5 s**. Beat-grid windows for sequential reveals are 2.625–3.0 (the tagline rows on 16ths), 6.5 / 7.5 / 8.5 (the three stops,
  one per two beats) and 19.0–19.24 (five bullet pops).
- Audio-reactive treatment: none, apart from one breath. After the night flip the B bullet on stop 3 scales ±2 % with the pad
  (texture; the text never moves).
- SFX posture: moderate, motion-matched and pitched in D. Every effect sits 6–10 dB under the music on the same room reverb, and
  nothing is harsh above 8 kHz. Repeated ticks stay in the background.
- Audio-coupled moments: each line is a note (A = D, S = F#, B = A) and the capsule is the D-major chord. The five-line end
  chord adds BF = E and F = B (D6/9). Other coupled moments: station ticks, stop chimes, the switch click at the night flip, the
  scroll tick-roll landing on a ding at 31, the star tap and "added" motif, and the three plucks as the stripes drop.
- Restraint rule: no cymbal crashes, no risers longer than 0.5 s, no per-card ticks during the scroll (use one soft roll), and no
  sound on text entrances except where listed. Every idea must also read muted.

## Music spec (the grid every cut sits on)
- 120 BPM, 4/4, D major (Night section Bm). The pickup runs 0.0–0.5; the downbeat of bar *n* is at 0.5 + 2(*n*−1) s.
- Bars and harmony: bar 1 (0.5) D · bar 2 (2.5) D · bar 3 (4.5) G | A (half bars) · bar 4 (6.5) D · bar 5 (8.5) Bm · bar 6 (10.5)
  G · bar 7 (12.5) A · bar 8 (14.5) D · bar 9 (16.5) D, no drums · bar 10 (18.5) D6/9 · bar 11 (20.5) D6/9, sustained and fading.

| Time | Grid | Picture | Sound |
|---|---|---|---|
| 0.00 | pickup | S1: lines drop, "Three festivals." | sub D1 swell; A glide lands D4, S glide lands F#4 (0.45); station ticks D5 (~0.2), F#5 (~0.37) |
| **0.50** | **bar 1** | **capsule slams, "One Thursday."** | **ACCENT 1: felt thump + struck D major (D2 sub, D3 F#3 A3), bell attack, 1.5 s room tail** |
| 0.55 | | B launches | bright A4 pluck (completes the triad); A5 ticks at the Fri/Sat stations |
| 1.5, 2.0 | beats 3, 4 | hold | heartbeat sub |
| 2.50 | bar 2 | pull-back to S2 | soft pitched whoosh; B3+E4 pad shimmer as BF and F draw |
| 2.625–3.0 | 16ths | tagline rows | plucks D4, F#4, A4, D5 (the octave lands on "in one guide") |
| 4.5 / 5.5 | bar 3 | hold | felt-piano G, then A; shaker 16ths very low |
| 6.0–6.5 | | push-in | 0.5 s filtered riser |
| **6.50** | **bar 4** | hard cut to S3; stop 1 | groove drops: soft kick 1&3, rim 2&4, brushed hats 8ths, round bass; stop chime D5 |
| 7.50 | bar 4 beat 3 | stop 2 | chime F#5 |
| **8.50** | **bar 5** | **stop 3 + Night edition** | **ACCENT 2: chime A5 + switch click (tuned) + sub drop + warm pad, low-pass opening over 1 s; harmony to Bm** |
| 12.30 | | S3 stops exit | quiet paper swish |
| 12.50 | bar 7 | phone rises | low air whoosh |
| 12.70–13.50 | | scroll + count-up | soft rising filtered tick-roll (one texture, not per card) |
| 13.50 | bar 7 beat 3 | count lands on 31 | A5 ding |
| 13.75 | | star tap | wood click + "added" motif D5→A5 (13.75, 13.875) |
| 13.80–14.25 | | push-in | pad swell |
| 15.50 | bar 8 beat 3 | hold | drums and bass drop out; pad tail only |
| 16.00 | bar 8 beat 4 (pickup) | hard cut to S5; stripes drop | plucks D4, F#4, A4 (16.0, 16.125, 16.25), the hook's pickup mirrored |
| **16.50** | **bar 9** | **capsule slams on the mark; "Juncta juvant:"** | **ACCENT 3: the S1 chord again (thump + struck D major), 2 s tail, no drums** |
| 16.75–17.5 | 8ths | translation word by word | felt plucks A4, F#4, E4, D4 stepping down to the tonic |
| 18.50 | bar 10 | mark → lockup (S6) | resolve: felt e-piano D6/9 (D3 A3 D4 F#4 B4 E5) |
| 19.0–19.24 | | five bullets pop | plucks D4 F#4 A4 B4 E5; a soft high shimmer on the river-rule draw (18.9–19.3) |
| 20.5–21.8 | bar 11 | still hold | pad sustain, fading to silence by 21.8; 21.8–22.0 silent for the loop |

- Instruments (synth.mjs names): `keys` (felt/FM e-piano), `pluck` (marimba-like stations, stops, rows), `bell` (the struck
  capsule chord's attack), `thump` (the slams), `bass` (round sine, from bar 4), `kick`/`clap` used as rim/`hat`/`shaker`
  (brushed, filtered), `pad` (warm detuned saw behind a low-pass, the Night edition), `tick`/`tap`/`key` (station ticks, the tap,
  the switch click), `whoosh` and `riser` (short, filtered, in D).
- Mix: −14 LUFS integrated, −1 dBTP ceiling, one shared room. The kick ducks the pad lightly, and SFX sit 6–10 dB under the bed.

## World geometry (so the S1→S2 pull-back is a pure camera move)
The week line is one drawing (the "world"), defined in S2 screen coordinates. S1 shows the same world at 2× about Thursday's
capsule: **S1 point = (560 + 2·(x − 348), 1160 + 2·(y − 1216))**. Only these change between the two: the world clip (S1 clips the
world to y ≥ 780; the clip opens to the full frame during the pull-back), the BF and F lanes (drawn during the pull-back) and
the bullets (see S1).
- Day rows (S2 y, pitch 72): Sat 3 856 · Sun 4 928 · Mon 5 1000 · Tue 6 1072 · Wed 7 1144 · **Thu 8 1216** · Fri 9 1288 ·
  Sat 10 1360 · Sun 11 1432. (S1 y: Tue 872, Wed 1016, **Thu 1160**, Fri 1304, Sat 10 1448.)
- Lanes (S2 x, pitch 48, 12 px wide; S1: 24 px wide): A 300, S 348, B 396, BF 444, F 492. (S1 x: A 464, S 560, B 656; BF 752
  and F 848 are not drawn in S1.) The lane order is the site's (A S B BF F).
- Runs (programs.json, drawn exactly as the site's week line): A from a terminus bar at Sat 3 to a bar at Sat 10. S from a bar at
  Mon 5 into the capsule. B from the capsule to a bar at Sun 11. BF from a bar at Tue 6 to a bar at Wed 7. F is the site's cased
  silver line (#c6cacd, 2 px #50575e edges, 16 px wide in total) running from y 836 to 1470 with no termini (Sep 30–Nov 1).
- Terminus bars: 28×6 in S2 (56×12 in S1), lane ink. Stations are open circles 26 px across with a 6 px stroke (52 px and 12 px
  in S1), filled `--surface`, stroked with the lane ink (F uses #50575e). They sit on every day a lane runs except its termini and
  Thursday on A, S and B.
- Capsule (horizontal, spanning the A, S and B lanes only, never BF or F): S2 x 274–422, y 1178–1254, 6 px stroke `--text`,
  `--surface` fill. In S1 this becomes x 412–708, y 1084–1236 with a 12 px stroke.
- Day labels (world, site style: DOW caps and then the numeral): DOW in Public Sans 650 caps 24 px `--text-muted`, right-aligned to
  x 213; numeral in Newsreader 640 at 44 px, left-aligned at x 218. In S1 these become DOW 48 px right-aligned to x 290 and the
  numeral at 88 px from x 300 (for example "THU" at x 174–290 and "8" at x 300–344). The Thursday label is `--text`; the others
  are `--text-muted`.

---

## Storyboard

### Scene 1 — Hook: three lines, one capsule — 0.0–2.5 s (2.5 s) · Morning edition
**Layout.** Ground `--bg` #f5ecdf, full bleed.
- Masthead (the "running head"; it stays fixed and settled from frame 1 through 6.35 s):
  - Lockup (site/img/brand/logo.svg, mark plus outlined wordmark, 64 px tall, 319 px wide) at x 64, y 290–354.
  - "OCT 3–11, 2026" (Public Sans 650 caps, 40 px, 0.085em, `--text-muted`, 321 px wide) right-aligned to x 940, at y 302–349.
  - Double rule across x 64–1016: 4 px `--rule-ink` at y 376 and 1 px at y 384.
  - "CINCINNATI & NORTHERN KENTUCKY" (same label style, 870 px wide) at x 64–934, y 400–447.
- Headline (Newsreader 640, 112 px, `--text`, left at x 64):
  - "Three festivals." at y 484–613 (726 px wide).
  - "One Thursday." at y 614–743 (714 px wide).
  - "Thursday" (x 263–730) sits inside a capsule outline: 8 px `--text` stroke, `--surface` fill behind the glyphs, fully
    rounded, at x 243–750, y 626–734.
- The world (clipped to y ≥ 780): lanes A (x 464) and S (x 560) at 24 px; the capsule at x 412–708, y 1084–1236; B (x 656) from
  the capsule down past the frame bottom; A continuing from the capsule to its Sat 10 terminus bar at y 1448.
  - Stations (52 px): A and S at Tue (872) and Wed (1016); A and B at Fri (1304); B at Sat 10 (1448).
  - Day labels TUE 6, WED 7, THU 8, FRI 9 and SAT 10, with **THU 8** in `--text` at y ~1105–1215. SAT 10 sits at y 1420–1476
    (texture).
- Nothing readable goes right of x 940. The B line runs off the bottom at x 656, clear of the right-hand button column.

**Copy (verbatim, with sources).**
- "Cincy Week": the lockup (site/img/brand/logo.svg; site.config.json siteName).
- "OCT 3–11, 2026" and "CINCINNATI & NORTHERN KENTUCKY": the home masthead folio in docs/index.html ("Oct 3–11, 2026",
  "Cincinnati & Northern Kentucky"), set in caps.
- "Three festivals." and "One Thursday.": hand-written lines condensing the home h1 ("Three festivals share one week, and on
  Thursday all three run at once."). They are true per data/programs.json: caw Oct 3–10, scw Oct 5–8 and blink Oct 8–11 all
  include 2026-10-08.
- "THU 8": the week line's Thursday station (docs/index.html: "Thu" / "8").

**Product material.** The site's phone week line (build/pages/home.mjs .wk, site/css/30-home.css) at 2× scale, in real inks.
The real logo.svg. The bullets come from the icons.mjs sprite.

**Sequential / interaction and motion.**
- Frame 1 (0.033): the masthead is settled. "Three festivals." begins its slam (0.03–0.20, opacity 0→1, scale 1.12→1, origin
  left).
- 0.03–0.50: the A and S lines draw downward from y 780 to the capsule's centre (y 1160) on ease-out. Their bullets (72 px, the
  sprite's A square and S circle) ride the line heads. Stations and day labels pop as the heads pass (scale 0→1.1→1, 0.12 s):
  TUE at ~0.2 s, WED at ~0.37 s.
- **0.50: the capsule slams** (scale 1.3→1 with a 2-frame overshoot). A 4 px shake runs for 3 frames on the world layer only; text
  never shakes. The capsule covers both bullets (they vanish under it). At the same instant "One Thursday." slams (0.50–0.68) and
  THU 8 pops.
- 0.55–0.80: the capsule outline traces around "Thursday" (stroke reveal).
- 0.55–1.00: B launches out of the capsule's underside with its diamond bullet riding the head, off the bottom of the frame by 1.0.
  At the same time A continues from the capsule to its Sat 10 bar (0.55–0.85). FRI 9 and SAT 10 pop with their stations.
- 1.00–2.50: dead still, with no push-in, so the cover frame is at scale 1.00.
- Out: at 2.50–2.65 the two headline lines and the "Thursday" outline lift 24 px and fade. The masthead stays.

**Transition mood:** clean and continuous. The camera pulls back into S2 (the next scene begins at 2.5).
**Audio intent:** a sparse, confident pickup and one satisfying snap. **Audio-coupled idea:** each line glides to its note (A→D4,
S→F#4); the capsule slam is the D-major chord; B's launch adds A4 to complete it. **Music:** sub pulse, no drums.

### Scene 2 — The week on one line — 2.5–6.5 s (4.0 s) · Morning edition
**Layout.**
- The masthead is unchanged (y 290–447).
- Tagline as the program key (Newsreader 640, 72 px, `--text`). Bullets are 64 px at x 64–128, and text starts at x 152:
  - [A bullet] "Art Week," at y 480–564
  - [S bullet] "StartupCincy Week" at y 564–648 (605 px wide → x 152–757)
  - [B bullet] "and BLINK" at y 648–732
  - "in one guide" at y 732–816 (no bullet, aligned to the text at x 152)
- The week line (the world at 1×, defined above), across y 836–1470:
  - All nine day rows and labels, SAT 3 to SUN 11.
  - A, S and B with their stations and termini.
  - BF: a short olive segment, Tue 6 to Wed 7.
  - F: the cased silver line running the full height.
  - The capsule at the Thursday row on A, S and B only.
  - "INTERCHANGE" (Public Sans 650 caps, 32 px, 0.085em, `--text`, 272 px wide) at x 528–800, y 1198–1235, beside the capsule.
- BF and F get no key row: they are visibly secondary, which keeps "three festivals" honest while showing that the other two
  programs exist.
- All text sits inside x 64–940 and y 290–1470.

**Copy (verbatim, with sources).**
- "Art Week," / "StartupCincy Week" / "and BLINK" / "in one guide": site.config.json siteTagline "Art Week, StartupCincy Week and
  BLINK in one guide" (also the <title> of every page), split over four rows. No punctuation is added.
- "INTERCHANGE": the week line's Thursday label (docs/index.html .wk-x "Interchange").
- Texture (day labels): docs/index.html week line "Sat 3 … Sun 11". The runs come from data/programs.json dates (caw 10-03…10-10,
  scw 10-05…10-08, blink 10-08…10-11, brandfusion 10-06…10-07, fotofocus 09-30…11-01).

**Product material.** The home page's "The week on one line" (docs/index.html section.wk), redrawn at poster scale from the same
data and in the same lane order. The capsule sits on the festival lanes only, as on the site. The tagline is the site's own.

**Sequential / interaction and motion.**
- 2.50–3.00: the camera pulls back (ease-in-out) from the S1 view to the S2 view. This is a pure camera move on the world, as
  defined above. The clip opens upward, so the termini above appear.
- 2.60–2.95: BF and F draw in top to bottom.
- Key rows land on 16ths (reveal fast, then hold the whole set):
  - 2.625: A bullet pops, and "Art Week," slides in 20 px from the left (0.15 s).
  - 2.75: S bullet and "StartupCincy Week".
  - 2.875: B bullet and "and BLINK".
  - 3.00: "in one guide".
  - The whole sentence is settled by 3.15.
- 3.00–3.15: "INTERCHANGE" fades in.
- 3.15–6.35: dead still (3.2 s of full-sentence hold).
- 6.35–6.50: a fast push-in (scale 1→3, ease-in) centred on the Thursday capsule (348, 1216), with the masthead and key carried
  in the push. At 6.50 there is a hard cut to S3.

**Transition mood:** a hard cut on the downbeat, led by the push into the capsule. **Audio intent:** a build, with lift and
naming. **Audio-coupled idea:** a four-note arpeggio on the rows (D4, F#4, A4, D5), then the riser into the push. **Music:** felt
piano D → G | A, no drums yet.

### Scene 3 — Thursday, Oct 8: three stops, night falls — 6.5–12.5 s (6.0 s) · Morning → Night at 8.5
**Layout.**
- Station sign (top; this is where the push-in landed):
  - "THU" (Public Sans 650 caps, 40 px, `--text-muted`) at x 64–161, y 322–369.
  - "8" (Newsreader, 112 px, `--text`) at x 176–232, y 280–409.
  - To their right, the interchange drawn small: the capsule (240×100, 10 px `--text` stroke, `--surface` fill) at x 300–540,
    y 300–400. Three 20 px stubs in the lane inks pass through it: A at x 348 from y 250 to 450, S at x 420 from y 250 into the
    capsule, and B at x 492 from the capsule to y 450.
- Time rail: 4 px `--rule-ink` at x 150 from y 440 to 1280, with a 40×6 terminus bar at 1280.
- Stops: each has an 80 px bullet centred on the rail. Text starts at x 230. Times are Newsreader at 72 px (tnum) with "PM" in
  Public Sans 650 caps at 40 px. Titles are Public Sans 650 at 52 px.

| Stop | Bullet (centre y) | Time line | Title | Extra |
|---|---|---|---|---|
| 1 | A (520) | "12:00 PM", y 470–553 | "Exhibitions + Art Market", x 230–796, y 562–621 | "DRAFT SCHEDULE" (40 px caps, `--text-muted`, x 230–645), y 634–681 |
| 2 | S (800) | "2:15 PM", y 750–833 | "Student Pitch Competition", x 230–822, y 842–901 | |
| 3 | B (1040) | "8:30 PM", y 990–1073 | 'BLINK "First Sight"' (x 230–704), y 1082–1141 / "Drone Show", y 1150–1209 | |

- Everything sits inside x 64–822 and y 250–1280. The right-hand column and the caption zone are empty.

**The Night flip at 8.50, in one frame.**
- Ground #1f1d19; text #f3eee4; muted text #cdc5b6; rail and capsule stroke #f3eee4; capsule fill #282521.
- Bullets and stubs switch to Night inks: #c98aa8, #fc6a45 and #86a4fc, with #1f1d19 letters.
- Newsreader switches from 640 to 620.
- No nudge or shake: the text stays settled across the flip.

**Copy (verbatim, with sources).**
- Stop 1: data/events.json#caw-10-08-exhibitions-art-market, start 12:00 and title "Exhibitions + Art Market". "DRAFT SCHEDULE"
  is the site's own label for this card (docs/schedule.html prints "BLINK BEGINS · draft schedule"; tag draft-schedule; the
  source is Art Week's unlisted draft page). Only the "draft schedule" half is used: "BLINK BEGINS" is dropped because under a
  plum A stop it reads as a BLINK claim.
- Stop 2: data/events.json#scw-student-pitch-competition, start 14:15 (end null) and title "Student Pitch Competition".
- Stop 3: data/events.json#blink-2026-10-08-drone-show-2030, start 20:30 (end 21:00) and title 'BLINK "First Sight" Drone Show'
  verbatim, with straight quotes.
- Sign: "THU" / "8" is the week line's Thursday station (docs/index.html).

**Product material.** The Week's time-first list style (the slot heads "12:00 PM" and so on, and the program bullets) at poster
scale. Thursday's real published events, one per festival, in time order (which is also lane order). The two real theme palettes
come from tokens.css.

**Sequential / interaction and motion.**
- **6.50: hard cut on the downbeat.** The sign, rail and stop 1 are already composed (stop 1's bullet pops 0→1.15→1 in 0.12 s;
  its text is static from the cut).
- 7.50: stop 2 lands (the bullet pops and the text wipes out from the rail, 0.2 s).
- **8.50: stop 3 lands, and the whole frame flips to the Night edition.**
- 8.70–12.30: the full timetable holds. Only stop 3's B bullet breathes (±2 %, texture).
- 12.30–12.50: the stops slide up 40 px and fade (staggered 0.05 s, top first), then the sign. The ground stays Night. Old content
  leaves before the phone arrives (no crossfade).

**Transition mood:** a staggered exit into the same Night ground. **Audio intent:** the groove arrives, and night falls warm, not
spooky. **Audio-coupled idea:** stop chimes D5 / F#5 / A5 (the triad again), and the switch click plus the pad opening on the
flip. **Music:** groove D → Bm → G.

### Scene 4 — Proof: the real site, star the drone show — 12.5–16.0 s (3.5 s) · Night edition
**Layout.**
- Caption band: an opaque `--bg` #1f1d19 from y 0 to 540, with a 2 px `--border` #403b33 hairline at y 540. The phone slides
  under it during the push-in.
  - Count numeral: Newsreader 620, 160 px, tnum, `--text`, right-aligned in a two-digit box at x 64–224, y 300–485.
  - "events on Thu, Oct 8": Public Sans 650, 56 px, `--text`, x 248–740, on the numeral's baseline (box y 400–464).
- Phone: the reel-stage iPhone drawing (collateral/lib/reel-stage.mjs PHONE, a 390×710 css viewport) at stage scale 0.82, so one
  site css px renders as 1.64 output px. The body is at x 195–885 with its top at y 560, and the viewport spans x 220–860,
  y 667–1832. The status bar reads "9:41".
- Push-in: a camera scale of 1.00→1.75 about the output point **(559, 2109)**. This maps viewport (34, 634) to output (64, 1406),
  so one site css px becomes 2.87 px. After the push:
  - The drone card spans y 734–1185.
  - Its title 'BLINK "First Sight" Drone Show' (18 css px → 52 px) sits at x 64–888, y ~883–949.
  - The real toast (14 css px → 40 px, box x 248–807, y 1234–1406) sits above the Reels caption zone.
  - The "8:30 PM" slot head sits at y ~628–685.
  - The filled star icon ends up at x 899–1025, y 743–869. It is an icon, above the button column.

**Copy (verbatim, with sources).**
- "31 events on Thu, Oct 8": the live result count on docs/schedule.html. At the chosen clock it prints "31 events on Thu, Oct 8,
  plus 80 all day and all night" (site/js/features/schedule.js), and the caption uses its first clause. The numeral **must be read
  from `[data-result-count] b` on the rendered frame**. It must also equal the THU 8 tab count ("31") and the day header ("Thursday,
  October 8 · 31 events"), and the number of `.slot-cards article.ev[data-day="2026-10-08"]` (31). Fail the render on any mismatch.
- "Added to My Plan · View": the site's own toast, rendered live (site/js/core/plan-store.js toast with a link; default link text
  "View" in site/js/core/toast.js). On a 390 px phone it wraps as "Added to My / Plan | View", which is fine and real.
- Texture from the live page: The Week's day strip (TUE 6 … SUN 11 with THU 8 selected and its A S B F ticks), the card
  "8:30–9:00 PM · BLINK · PERFORMANCE · TQL Stadium · Room not listed · FREE · DRONE SHOW", and the dock's Plan badge "1".

**Product material (live, not redrawn).**
- docs/schedule.html?day=2026-10-08&theme=dark runs in the phone's iframe at 390×710 css with reduced motion.
- The browser clock is installed with ctx.clock.install at **2026-10-01 09:41:00 EDT (13:41:00Z)**, before the week, and
  advanced one frame per frame. Never use `?now=`: it prints "Test clock". The pre-week clock means no "Now" or "Earlier today"
  states, no stale countdown, and all 31 timed cards listed (verified).
- The plan starts empty. Nothing is typed.
- One real tap: a click on `button[data-star="blink-2026-10-08-drone-show-2030"]`, which fills the star (aria-pressed=true) and
  raises the toast.
- Under reduced motion the toast's CSS transition does not play, so the stage drives its rise inline per frame (opacity 0→1,
  translateY 12→0 css px over 0.2 s) and removes the inline style afterward. The toast's own 3.2 s timer runs on the installed
  clock and would dismiss it at 17.0 s, after the cut.

**Sequential / interaction and motion.**
- 12.50–12.80: the phone rises from below (ease-out). The page is already at scrollY 1033: the sticky day strip with THU 8, and
  the header "Thursday, October 8 · 31 events" right under it.
- 12.60–12.70: the caption fades up, with the numeral at 1.
- 12.70–13.50: a real eased scroll (ease-in-out) from scrollY 1033 to **8046**, which puts the drone card at viewport y 400–557,
  just above the toast's slot (574–634). The 31 cards flip past like a departure board.
  - The numeral is round(1 + 30·e(p)), where e(p) is the scroll's own easing, and lands on 31 exactly as the scroll settles (13.50).
  - Avatar stacks with headshots (for example Student Pitch Competition and The Next Wave of Venture) only blur past. No hold and
    no still lands on them.
- 13.75: a touch ripple (reel-stage TAP_JS) on the star, at its pre-push centre (790, 1364). The real click fires and the star fills.
- 13.80–14.00: the toast rises (stage-driven).
- 13.80–14.25: the camera pushes in to 1.75 (ease-in-out). The phone's top slides under the caption band.
- 14.25–16.00: hold. Only the site's own state is on screen.
- **16.00: hard cut.**

**Transition mood:** hard cut, edition flip back to Morning. **Audio intent:** momentum, then a small, satisfying "done". **Audio-
coupled idea:** the tick-roll under the scroll lands on an A5 ding at 31, then the tap click and the "added" motif D5→A5; the
drums drop out at 15.5. **Music:** groove A → D.

### Scene 5 — Punchline: the interchange is the logo — 16.0–18.5 s (2.5 s) · Morning edition
**Layout.**
- Ground `--bg` #f5ecdf.
- The mark (site/img/brand/mark.svg drawn at 400×400, scale 6.25) at x 340–740, y 290–690: #fffbf4 rounded square, 3 units ×
  6.25 ≈ 19 px ink border, stripes #75295c, #c23b24 and #2747c6, and the ink-outlined capsule.
- "CINCINNATI'S CITY MOTTO": Public Sans 650 caps, 40 px, 0.085em, `--text-muted`, centred (626 px wide → x 227–853), y 760–807.
- "Juncta juvant:": Newsreader italic 600, 128 px, `--text`, centred (772 px wide → x 154–926), y 830–977.
- "things joined together help.": Newsreader 640, 64 px, `--text`, centred (746 px wide → x 167–913), y 995–1069.

**Copy (verbatim, with sources).**
- "Juncta juvant: things joined together help.": docs/index.html footer p.motto (build/core/shell.mjs), verbatim, split over two
  lines.
- "CINCINNATI'S CITY MOTTO": docs/index.html footer p.motto-note "Cincinnati's city motto, and the idea behind this guide: …",
  first three words, in caps.

**Product material.** The site's real mark, animated from its own parts (three stripe rects and the capsule rect). It is the S1
drawing, upright and boxed. Its orientation is identical because the phone week line is vertical, like the mark.

**Sequential / interaction and motion.**
- **16.00: hard cut on the pickup.** The empty rounded square is present.
- 16.00–16.25: the three stripes drop in from above, clipped by the square (staggered by 16ths: A, then S, then B), and the label
  prints (opacity, 0.15 s).
- **16.50: the capsule slams** across the stripes (scale 1.3→1, the same 2-frame overshoot and 4 px shake as S1, applied to the
  mark only). "Juncta juvant:" slams at the same instant (scale 1.1→1, 0.15 s).
- 16.75, 17.00, 17.25, 17.50: "things", "joined", "together" and "help." set one by one. Each drops 18 px and stops dead in 70 ms.
- 17.60–18.50: hold. The motto block will not move again.

**Transition mood:** continuous into S6 (nothing leaves; the mark travels). **Audio intent:** a dead stop, then recognition.
**Audio-coupled idea:** three plucks as the stripes drop, the hook's chord on the slam, and descending plucks on the four words.
**Music:** no drums, open pad.

### Scene 6 — End card — 18.5–22.0 s (3.5 s) · Morning edition
**Layout of the final frame (it is also the loop's last frame).**
- Lockup (logo.svg at 120 px tall, 598 px wide) at x 241–839, y 290–410. Its mark is the S5 mark, shrunk.
- "OCT 3–11, 2026": Public Sans 650 caps, 40 px, `--text-muted`, centred (x 380–701), y 440–487.
- River rule: site/img/brand/river-rule.svg, 600×44, stroke `--accent` #1c6b56, at x 240–840, y 515–559 (texture).
- Five bullets: 72 px each with 28 px gaps (x 304–776, y 598–670). They are A #75295c square, S #c23b24 circle, B #2747c6
  diamond, BF #66700a octagon (white "BF") and F #c6cacd hexagon (#1c1a17 "F", edge #50575e) (texture).
- Motto block, unchanged from S5 (y 760–1069).
- "fritzhand.github.io/cincy-week": Public Sans 650, 52 px, `--link` #135240, 4 px underline in `--accent` #1c6b56, centred
  (679 px wide → x 200–879), y 1150–1209.
- "Independent guide, not affiliated" / "with the organizers.": Public Sans 400, 40 px, `--text-muted`, centred (521 and 316 px),
  y 1260–1307 and 1312–1359.
- Everything sits inside x 154–926 and y 290–1359.

**Copy (verbatim, with sources).**
- "Cincy Week": logo.svg (site.config.json siteName).
- "OCT 3–11, 2026": the docs/index.html folio (site.config.json week 2026-10-03…2026-10-11).
- "fritzhand.github.io/cincy-week": site.config.json siteBase with https:// and the trailing slash dropped.
- "Independent guide, not affiliated with the organizers.": docs/index.html .footer-base, first sentence, verbatim.
- Bullets (texture): build/core/icons.mjs BULLETS.

**Product material.** The real lockup, river rule and bullet sprite, plus the site's own address and independence line.

**Sequential / interaction and motion.**
- **18.50 (downbeat):** the mark shrinks 400→120 and travels to the lockup's mark position (18.50–18.90, ease-in-out). The
  wordmark wipes in left to right beside it (18.70–18.95).
- 18.90–19.05: the date fades up 12 px.
- 18.90–19.30: the river rule draws west to east.
- 19.00–19.24: the five bullets pop left to right (0.06 s stagger).
- 19.10–19.25: the URL fades up and its underline draws.
- 19.30–19.45: the independence line fades up.
- 19.45–22.00: still hold. There is no exit, so the last frame is a clean poster and the loop cuts back to S1's newsprint.

**Transition mood:** clean (loop). **Audio intent:** resolve and rest. **Audio-coupled idea:** the D6/9 chord ("all five lines")
and five bullet plucks. **Music:** e-piano and pad, fading to silence by 21.8.

**Music mood for this video:** upbeat, warm, precise.
**Audio summary:** a pulse and one struck chord for the hook, an arpeggio as the lines are named, the groove on Thursday, the
pad opening as night falls, a departure-board roll and a ding for the real site, a dead stop, the hook's chord again under the
logo, and a D6/9 resolve into silence.

---

## Reading-time table
Rule: text is counted from when it is fully on screen and settled. The requirement is max(floor, 0.3 s × words), with a floor of
0.8 s for 1–3 words and 1.2 s for longer lines. A clock time ("12:00 PM") counts as 2 words, "&" and "+" as none, and the URL as
3. "Secondary" lines pass on their own but are not needed for the story.

| Scene | Line | Words | Settled (s) | Settled for | Required | Pass |
|---|---|---|---|---|---|---|
| S1–S2 | Lockup "Cincy Week" | 2 | 0.03–6.35 | 6.32 | 0.8 | yes |
| S1–S2 | "OCT 3–11, 2026" | 3 | 0.03–6.35 | 6.32 | 0.9 | yes |
| S1–S2 | "CINCINNATI & NORTHERN KENTUCKY" | 3 | 0.03–6.35 | 6.32 | 0.9 | yes |
| S1 | "Three festivals. / One Thursday." | 4 | 0.68–2.50 | 1.82 | 1.2 | yes |
| S1 | "THU 8" (secondary) | 2 | 0.62–2.50 | 1.88 | 0.8 | yes |
| S2 | "Art Week, / StartupCincy Week / and BLINK / in one guide" (whole sentence) | 9 | 3.15–6.35 | 3.20 | 2.7 | yes |
| S2 | "INTERCHANGE" (secondary) | 1 | 3.15–6.35 | 3.20 | 0.8 | yes |
| S3 | "12:00 PM · Exhibitions + Art Market · DRAFT SCHEDULE" | 7 | 6.62–12.30 | 5.68 | 2.1 | yes |
| S3 | "2:15 PM · Student Pitch Competition" | 5 | 7.70–12.30 | 4.60 | 1.5 | yes |
| S3 | '8:30 PM · BLINK "First Sight" Drone Show' | 7 | 8.70–12.30 | 3.60 | 2.1 | yes |
| S3 | "THU 8" sign (secondary) | 2 | 6.50–12.30 | 5.80 | 0.8 | yes |
| S4 | "31 events on Thu, Oct 8" (numeral final) | 6 | 13.50–15.97 | 2.47 | 1.8 | yes |
| S4 | Toast "Added to My Plan · View" | 5 | 14.25–15.97 | 1.72 | 1.5 | yes |
| S4 | Card title 'BLINK "First Sight" Drone Show' (secondary, 52 px) | 5 | 14.25–15.97 | 1.72 | 1.5 | yes |
| S5–S6 | "CINCINNATI'S CITY MOTTO" | 3 | 16.15–22.00 | 5.85 | 0.9 | yes |
| S5–S6 | "Juncta juvant:" | 2 | 16.65–22.00 | 5.35 | 0.8 | yes |
| S5–S6 | "things joined together help." | 4 | 17.60–22.00 | 4.40 | 1.2 | yes |
| S6 | Lockup wordmark "Cincy Week" | 2 | 18.95–22.00 | 3.05 | 0.8 | yes |
| S6 | "OCT 3–11, 2026" | 3 | 19.05–22.00 | 2.95 | 0.9 | yes |
| S6 | "fritzhand.github.io/cincy-week" | 3 | 19.25–22.00 | 2.75 | 0.9 | yes |
| S6 | "Independent guide, not affiliated with the organizers." | 7 | 19.45–22.00 | 2.55 | 2.1 | yes |

**Scene load** (reading everything in order, one line after another):
- **S1+S2:** 4.8 s of reads (the lockup counts as a logo already seen, so it is left out) in 6.3 s of exposure. This passes.
  Counting the lockup too gives 5.6 s, which still passes.
- **S3:** 5.7 s of reads. They start at the 6.5 cut and finish at 12.2, before the exit at 12.3. This passes.
- **S4:** the caption's words are readable while the numeral counts (12.65–14.45), and the toast is read 14.45–15.95. This passes.
- **S5–S6:** the label, motto, translation, lockup, date and URL are read by 21.65, before 22.0. This passes.
- **The one line that does not fit the in-order read:** the independence line would finish at 23.75, past the 22.0 s end. Treat
  it as fine print. It passes its own time (2.55 s against 2.1 s), and the share copy says "independent guide". **Do not speed
  anything up to fix this.** If review wants it inside the in-order read, drop the five-bullet row and the river rule (texture)
  and bring the independence line in at 19.0.

The renderer's audit (reel-stage AUDIT_JS) should carry `data-read` on every must-read and secondary line above, using the word
counts shown. The whole S2 tagline is one element with `data-read="9"`.

## Safe-zone note
- Everything to be read sits inside **x 64–940, y 250–1480**. The widest lines, measured with the site's fonts in Chromium:
  - "CINCINNATI & NORTHERN KENTUCKY": 870 px → x 64–934
  - "Three festivals.": 726 px
  - "StartupCincy Week" at 72 px: 605 px → x 152–757
  - "Student Pitch Competition": 592 px → x 230–822
  - "Juncta juvant:": 772 px → x 154–926
  - URL: 679 px
  - Toast after the push: x 248–807
- Texture that may cross the lines:
  - B's line running off the bottom in S1 (x 656).
  - The F line's ends.
  - In S4 before the push: the phone body and page below y 1480.
  - In S4 after the push: the card's border past x 940 and the filled star icon at x 899–1025 (y 743–869, above the button
    column), plus the site's to-top button.
- Nothing readable sits in the right-hand button column (x > 940, y > 1050). The Reels header (y < 220) is empty in every scene.

## Cover frame
**Frame at t = 2.40 s** (S1, fully settled, scale 1.00, nothing in flight). Export it as brag.jpg and bake it in as frame 0,
replacing frame 0 rather than adding one.
- What it shows, top to bottom:
  - The Cincy Week lockup, "OCT 3–11, 2026" and "CINCINNATI & NORTHERN KENTUCKY" (y 290–447).
  - "Three festivals." and "One Thursday." at 112 px, with Thursday in its capsule (y 484–743).
  - The plum, vermilion and cobalt lines meeting at the white capsule, labelled THU 8 (y 780–1476).
- Why: it names the product, the place and the dates. Its headline is a question the video answers. Its graphic, three inks
  under one white capsule, is the site's own mark drawn large and the most distinctive shape in the brand. At grid size (about ⅓)
  the headline is still about 37 px.
- **It survives the centre 3:4 crop** (y 240–1680): all of its content lies in y 290–1476, and all key text is inside the ideal
  y 300–1500 except the lockup's top 10 px. It also survives a 4:5 feed crop (y 285–1635).
- The jump from frame 0 to frame 1 is a one-frame reset (the lines retract, the masthead stays). That is acceptable under brag's
  poster rule.
- Alternate (informational) cover: S2 at 6.20 s. It shows the masthead, the tagline key and the whole week line, all in y 290–1470.

## Render-time reads and assertions (fail the render on any mismatch)
Read every site sentence and count from docs/ or data/ at render time, the way build-video.mjs's `read()` does. Never hand-set them.
- config.siteTagline and siteBase.
- docs/index.html: folio "Oct 3–11, 2026" and "Cincinnati & Northern Kentucky"; week-line label "Interchange"; the Thursday row
  "Interchange: all three run · BLINK opens · 31 events" (asserts 31); footer p.motto, p.motto-note and the first sentence of
  .footer-base.
- data/events.json: for the three stops, the start, title and tags. Assert that caw-10-08-exhibitions-art-market still carries
  draft-schedule and that none of the three is `status: "cancelled"` or "changed". If one changes, swap or drop the stop; never
  keep stale copy.
- Live DOM in the phone: `[data-result-count] b`, the THU 8 tab count and the number of `.slot-cards` cards on Thursday must all
  equal the numeral's final value. The toast text must be "Added to My Plan" plus "View". The drone card must be the last
  Thursday card.
- Fonts loaded (document.fonts.ready) before each capture. The stage must be a pure function of frame time.

## Verified facts (re-checked Sep 26 against data/ and docs/)
- Programs (data/programs.json):
  - caw Oct 3–10
  - scw Oct 5–8
  - blink Oct 8–11
  - brandfusion Oct 6–7
  - fotofocus Sep 30–Nov 1
  - Bullets (icons.mjs): A square, S circle, B diamond, BF octagon, F hexagon.
  - Lane order on the site: A S B BF F. The capsule covers A, S and B only.
- Thursday's events:
  - Exhibitions + Art Market: 12:00–19:00, tag draft-schedule. The card prints "12:00–7:00 PM" and "BLINK BEGINS · draft schedule".
  - Student Pitch Competition: 14:15, end null ("end time not listed").
  - BLINK "First Sight" Drone Show: 20:30–21:00, TQL Stadium, Free. The card prints "8:30–9:00 PM · TQL Stadium · Room not listed
    · FREE · DRONE SHOW". It is Thursday's last timed card, at page y 8446 on a 390 px phone.
- Counts:
  - The Week on Thursday at the chosen clock: "31 events on Thu, Oct 8, plus 80 all day and all night". The THU 8 tab reads 31,
    and there are 31 `.slot-cards` cards.
  - Home week line per day, Oct 3–11: 23 / 16 / 41 / 35 / 62 / 31 / 13 / 20 / 11.
  - **Do not use the brief's stale "36" or its 25/18/45/37/64/39/26/25/11.**
- mark.svg: three vertical stripes (#75295c, #c23b24, #2747c6) under a horizontal #fffbf4 capsule with a #1c1a17 outline, in a
  rounded square.
- Toast on a 390 px phone: box x 98–293, y 574–634 css, 14 px, wrapped over two lines.

## Defects fixed (judge → fix)
- **The stranger lens: "guide" appeared only at ~19 s, and the first 2 s never said what it is.**
  - The site's tagline is now the S2 key: "in one guide" at 3.0 s.
  - The masthead shows the name, the dates and "Cincinnati & Northern Kentucky" from frame 1 and on the cover.
  - The end card restates the dates and the URL, and "guide" is in its last line.
- **"INTERCHANGE" and "Change here for all three." as jargon.** "Change here" is cut. INTERCHANGE is now a secondary label beside
  the capsule, and S1 labels Thursday "THU 8".
- **The punchline was an insider's delight.** The lines are now vertical, so the hook's drawing is the mark's exact orientation.
  S5 repeats the S1 motion (lines drop, capsule slams, same chord), and S6 turns the mark into the lockup next to "Cincy Week".
- **"BLINK BEGINS" on an Art Week stop.** It is dropped; "DRAFT SCHEDULE" stays.
- **The folio dropped Northern Kentucky.** It is restored ("CINCINNATI & NORTHERN KENTUCKY", 870 px, fits).
- **Night weight.** Newsreader goes 640→620 in the same frame as the flip, and S4 uses 620.
- **The count was trimmed and hand-set.** It is now read live from `[data-result-count] b` and cross-checked three ways, with the
  render failing on mismatch.
- **Headshots.** Avatar stacks only blur past during the scroll; the camera lands on the drone card, which has no people.
- **`?now=` shows "Test clock".** The clock is installed at a pre-week minute instead, with no during-the-week states.
- **Overflow of the "BLINK BEGINS · DRAFT SCHEDULE" tag (770 px).** It is now "DRAFT SCHEDULE", 415 px.
- **The toast was under 40 px and fell into the caption zone.** The push is now 1.75× on a 1.64× phone (2.87 px per css px), about
  (559, 2109), landing the toast at y 1234–1406 with 40 px text and the card just above it. The stage drives the toast's rise.
- **Reading load in S2 and S3.**
  - S2 now has one sentence (the tagline) plus texture.
  - S3 dropped the headline and gained 0.5 s (6.0 s).
  - Both pass the per-line and in-order checks.
- **Cover taken mid-push.** S1 now holds dead still, and the cover is at 2.40 s at scale 1.00.
- **S1→S2 geometry mismatch.** There is now one world, defined once; S1 is exactly 2× S2, so the pull-back is a pure camera move.
- **Beat grid.** A 0.5 s pickup; every accent (0.5, 8.5, 16.5) is on a bar line, and every cut is on a bar line or a pickup beat
  (2.5, 6.5, 12.5 bars; 16.0 pickup).
- **The motto was split 680 px around the mark.** It is now one stacked block under the mark that never moves again.
- **S5/S6 timing conflict.** The motto no longer exits; the mark alone travels at 18.5.
- **The phone could slide over the caption.** An opaque caption band now runs y 0–540.
- **The 4-frame nudge on the night flip broke the settled time.** It is removed.
- **The end card had no date or city.** "OCT 3–11, 2026" and "CINCINNATI'S CITY MOTTO" are now on it.
- **Grafts from the other concepts:**
  - Tagline as the key, and the end-card date line (At This Hour).
  - Hard cuts only between the two real grounds, words set one by one on the beat, and the opaque caption band with the push-in
    engineering (Special Section).
  - Clock install and reading overlay text from the live DOM (At This Hour).
  - The assert-at-render discipline (Too Many Tabs).
