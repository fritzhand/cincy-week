# blink-map · BLINK 2026 folding map → structured data

Source: https://www.blinkcincinnati.com/files/assets/2026blinkfoldingmapmap.pdf. It is one page, 810 × 1584 pt. The PDF title is BLINK_FoldingMap_092326_NEW6, created 2026-09-23 18:17 −04:00 in Adobe Illustrator. A copy is in .cache/blink-map/map.pdf; it is BLINK's file and is not in the repo. www.blinkcincinnati.com fails TLS from this container (certificate mismatch), so everything comes from that copy. TLS verification was never bypassed.

Output: research/blink-map/blink-map-2026.json, written by scripts/extract-blink-map.py. It is deterministic and was extracted 2026-09-24.
- Run: `python3 scripts/extract-blink-map.py [--qa] [--check]`
- --qa renders the QA images into .cache/blink-map/qa/; --check runs every step and assertion and writes nothing.

## Method
1. **KEY.** The script finds each KEY label and the icon drawn left of it, and reads the icon's fill and shape:
   - Projections #a3238f, Murals #0094d9, Light Installations #80ad33, Unique Attractions #ffda00.
   - The two black badges are told apart by shape: the Oasis Station drop (aspect 0.72) and the Official BLINK Merch Shop eye (aspect 1.5).
   - Food & Drinks, Restrooms and Hike Departure are the unnumbered symbols.
   - Every map and list badge is classified against these KEY icons. The same check rejects the black I-75 shields that also carry numbers.
2. **Lists.** 93 list badges (92 numbers; 67 is printed in both The Banks and Covington lists).
   - Each badge takes its zone from the heading above it and its column from its position.
   - Each printed line is assigned to the nearest badge above it in the same zone and column. The script fails if any line has no badge.
   - Bold runs are the title and medium runs the credit. "Title – Artist" lines split at the weight change; the dash is kept in inline_separator. A bold run after a medium run starts a second work (#25).
   - Medium runs starting "at ", "Shows " or "(" go to `detail`, not `credit` (#45, #53, #67, #70).
   - `printed` keeps each line exactly as printed. Only PDF ligatures (ﬁ ﬂ) and runs of spaces are normalized; no line ends in a hyphen.
3. **Pins.** Each map pin is the centre of its badge shape. Every pin's badge category is checked against its list entry. The two disagreements (the map prints 34 on the Oasis Station drop and 35 on the Unique Attractions star) are resolved by swapping within the zone, and the swap is recorded on both entries.
4. **Symbols.**
   - Restroom, food and hike icons are matched on KEY colour, aspect ratio, path type counts and the white figure inside.
   - Hospitality zones are the "HOSPITALITY ZONE" labels plus the yellow shape each marks: an area, a band along Freedom Way, or just the label at the Court St night market.
   - Drone shows are the dotted rings: one over the river ("DRONE SHOWS FRI, SAT, SUN 8 PM & 10 PM") and one beside TQL Stadium (the ceremony's "DRONE SHOW 8:30 PM").
   - Drone viewing is the two #67 badges; the merch shop is badge #45.
   - The opening ceremony is the yellow strip on Central Pkwy (y 278–384), labelled by the "READY. SET. BLINK!" box.
5. **Georeference.** The fit is a moving least squares affine: a weighted local affine at every point, with weights 1/(d²+s²)^α. α and s are chosen by leave-one-out (LOO) error.
   - The map is schematic: straight streets, and a fitted scale of 2.4–3.9 m/pt across the pins (about 4.3 m/pt over the river).
   - A piecewise-affine fit on a Delaunay triangulation was tried; it was no better and cannot extrapolate.
   - **Road centrelines** come from the PDF's black 8.9 pt road strokes, identified by the street labels printed on them and extended over collinear pieces.
   - **Crossings** are matched to OSM (.cache/osm/core.json, 2026-09-24) by the nodes both named ways share on the correct side of the river.
   - A crossing is kept only if OSM's matching nodes agree within 25 m; dual carriageways use the centroid.
   - Crossings printed twice on different lines are ambiguous and dropped.
   - Two crossings are excluded by hand, with reasons in the JSON: Garfield Pl (its two carriageways are drawn as two lines) and McMicken & Main (the map merges it with Liberty & Main).
   - The Roebling bridge's two river-edge crossings on the map are matched to where the OSM bridge meets the OSM water=river boundary.
   - **Pass A** uses streets and the bridge only.
   - **Pass B** adds BLINK online-map coordinates (data/works.json works matched by title or credit, and the 5 Oasis Stations matched by name) that pass A put within 150 m. These are not used: the Lytle Park inset, #25 (two works), location-only matches and the proximity-matched restrooms.
   - **approx_m** = max(15 m, 2.45 × the kernel-weighted RMS of nearby pass-B LOO residuals). The Lytle Park inset pins get at least the inset block's half-diagonal.

## Counts
Per zone and category: see the list above. Summary:
- 92 entries, 93 pins, 32 symbols.
- 93 list badges and 93 map badges.
- Two numbers carry no KEY badge: the "75" I-75 shields.

Zone sponsors are logos, read from the renders; the script checks that a logo is drawn in each spot:

| Zone | Logo | org id |
|---|---|---|
| Findlay Market | Hamilton County | hamilton-county-board-of-county-commissioners |
| OTR | Jacob G. Schmidlapp Trusts · Fifth Third Bank, Trustee | jacob-g-schmidlapp-trusts-fifth-third-bank-trustee |
| Fountain | Fifth Third | fifth-third |
| The Banks | P&G | procter-and-gamble |
| Covington | meet nky | meetnky |
| BLINK at Lytle Park ("with support from") | Western & Southern Financial Group | western-and-southern-financial-group |

## Georeference error

| Measure | n | median | p90 | max |
|---|---:|---:|---:|---:|
| Pass A LOO (α 1.5, s 20 pt) | 126 | 7.2 m | 29.9 m | 91.8 m |
| **Pass A pins vs BLINK online map (independent)** | 68 | **26 m** | **69 m** | **119 m** |
| Pass B LOO, all (α 2, s 40 pt) | 194 | 15.2 m | 43.2 m | 140.4 m |
| Pass B LOO, intersections | 126 | 10.2 m | 30.9 m | 140.4 m |
| Pass B LOO, online points | 68 | 21.2 m | 53.4 m | 120.2 m |
| Restroom symbols vs online restrooms (check only) | 8 | 33.5 m | 78.8 m | 125 m |

No match is off by more than 150 m. approx_m covers 63 of 68 online points; across pins it runs 40–245 m, median 65 m.

By zone:

| Zone | pass A vs online: median | p90 | n | median approx_m |
|---|---:|---:|---:|---:|
| Findlay Market | 26.5 m | 58 m | 12 | 60 m |
| OTR | 23.5 m | 42 m | 10 | 65 m |
| Fountain | 29.5 m | 48 m | 20 | 65 m |
| The Banks | 38.5 m | 87 m | 10 | 85 m |
| Covington | 17 m | 50 m | 17 | 55 m |
| Lytle Park inset | 68.5 m | (max 78 m) | 4 | 110 m |

Largest residuals:
- **West Covington.** 6th & Johnson 71 m (pass A) / 140 m (pass B); 6th & Washington 92/54 m; 5th & Johnson 41/59 m; Pike & Washington 59 m. The map compresses Johnson–Washington (300 m in reality) into 44 pt, while Washington–Madison (137 m) gets 58 pt. #84 Mother of God sits in that block: approx 245 m, and 119 m from its online point in pass A (73 m after the fit).
- **Roebling bridge banks,** 73/75 m. There is no other control point on the river.
- **12th & Sycamore** 68 m, **2nd & Broadway** 59 m, **Central Pkwy & Sycamore** 44 m. These streets bend or jog east of Main, and the map draws them straight.
- **Elm & Freedom Way,** 52 m.
- **Lytle Park inset.** The pins are a decorative 2×2 stack, 60–78 m from their online points.

Covington label check: the upper "8TH ST" line fits 8th St (26 m mean error, vs 95 m as 9th). The lower one fits 9th St (72 m, vs 177 m as 8th), so it is almost certainly a misprint for 9th; neither line is used as a control point.

## Matching to data/works.json (75 BLINK works)
- **69 matched by title or credit** (68 have coordinates; 0H10M1ke's online record has none). All were checked by eye.
- **4 location-only candidates:** #14↔"Payphone" Mural Projection, #29↔Kroger North, #38↔Garfield Place - Lighting (100 m), #42↔Artswave Projection Aronoff Center.
- **2 online works not in the PDF:** Projection by Jason Snell, and Kroger South.
- **PDF entries with no online counterpart:** #5, #7, #25's "Awaken the Art", #63, #85, all 9 Unique Attractions, and #45.
- **Zone difference:** #78 0H10M1ke is in the PDF's Covington list; online it is filed under The Banks, with no coordinates.
- **Oasis Stations:** 5 of 5 matched by name, 23–49 m from the final pins.
- **Restrooms:** 14 PDF symbols against 9 online. 8 pair up by proximity. Online restroom 757 (Court St) has no PDF symbol.

## Verbatim quirks and ambiguities
- Kept as printed:
  - #53 "Immsersive" (sic).
  - Map label "ELM ST PAZA".
  - #68 "FloWeR  PoWeR" (two spaces in the PDF).
  - Map labels "RACE  ST" and "VINE   ST".
  - "Soﬂes" and "Ofﬁcial" are ligatures, written out as plain letters.
  - #78 uses the digits 1 and 0 in the text layer ("L1ght Graff1t1 Make0vers", "0H10M1ke").
- Kept as printed although the online map differs: #10 "Mariela Ajras", #60 "The B!G TV", #65 "Y.e.l.l.e.d", #48 "Dan Shields", #51 "B!gArt".
- #25 has two works under one number. `title`/`credit` hold the first, and `parts` holds both.
- #38's bold line is a company name (credit "4Wall lighting"). #46's bold line is an artist, Tristan Eaton (credit "UC CCM Lighting Design & Technology").
- `credit` is null for #16 and #63 (no credit line) and for the all-bold "Oasis Station: …" titles #22, #28, #35, #43 and #44.
- The 34/35 badge swap is decided by badge shape. It is confirmed by the night-market star sitting on Court St (court-street-plaza).
- Two unlabelled lines east of Vine, between Central Pkwy and 9th, are not used as control points.

## QA (.cache/blink-map/qa/)
- key.png; list-<zone>.png; sponsor-<zone>.png; map-*.png at 3–8×.
- overlay-controls.png: every control point drawn on the map.
- georef-plot.png: the final pins with their approx_m circles over OSM streets, with BLINK's online points and red lines between each pair.
- Every list crop was read and compared with the JSON: each number, title, credit and category.
- Every control point was checked on the overlay.

## Per-point residuals
In the JSON:
- georeference.control_points[].loo_a_m and loo_m
- entries[].pins[].approx_m and m_per_pt
- entries[].online_match[].distance_pass_a_m and distance_final_m
- symbols[].approx_m
=== end REPORT.md ===

## Verification

See data/README.md, section "BLINK official map", for the verification pass (all 92 entries read by eye from 4x renders, positions checked against an inverse georeference, 3 errors fixed in 33 records).
