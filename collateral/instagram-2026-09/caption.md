# Instagram post and Stories, Cincy Week launch

**Carousel:** `01-cover` to `06-link`, six cards at 1080×1350 (4:5), in filename order. The cover
and every card keep text 64 px from the sides, so nothing is cut in the 3:4 profile grid.
**Stories:** `story-01-week`, `story-02-thursday`, `story-03-link`, 1080×1920, with text kept out of
the top 250 px and bottom 340 px that Instagram's controls cover.

Paste each image's alt text from [`alt-text.md`](./alt-text.md) (advanced settings → Accessibility).

---

## Caption

Cincinnati's first week of October, in one guide.

Cincinnati Art Week, Oct 3–10. StartupCincy Week, Oct 5–8. BLINK, Oct 8–11. The FotoFocus Biennial,
Sep 30–Nov 1. On Thursday, Oct 8, all three run at once.

364 events by day and time, 108 venues on one map, and where to stay and how to get around. Star
what you want to see and it goes to My Plan.

An independent guide, not affiliated with the organizers. Check the official sites before you go.

Link in bio: fritzhand.github.io/cincy-week

#Cincinnati #StartupCincy #FotoFocus #CincinnatiArtWeek #BLINKCincinnati

---

## Short version, for a Story or a repost

Art Week, StartupCincy Week and BLINK in one guide. Oct 3–11. fritzhand.github.io/cincy-week

---

## Posting notes

1. **The link.** Instagram doesn't link from captions. Put `fritzhand.github.io/cincy-week` in the
   bio before posting. On `story-03-link`, add a link sticker in the space below the phone.
2. **Alt text.** Paste each entry from `alt-text.md` into the matching slide.
3. **Hashtags.** #StartupCincy and #FotoFocus come from `data/programs.json`; the others are chosen
   by hand. Swap in each organizer's own tag if they announce one.
4. **Tagging.** Tag the organizers' accounts only if you want to; the guide is independent and the
   cards don't use their logos.
5. **Rebuild before posting.** The phone screens are captures of the built site. After a data
   change, run `node build.mjs`, then `node collateral/build-cards.mjs`.
