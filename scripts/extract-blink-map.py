#!/usr/bin/env python3
"""
scripts/extract-blink-map.py · BLINK 2026 folding map (PDF) → research/blink-map/blink-map-2026.json

BLINK published its official 2026 folding map as a one-page PDF (810 × 1584 pt): a schematic street map
with numbered badges on the left, and on the right a KEY and one numbered list per zone. This script
reads that PDF's text layer and vector drawings (pymupdf), so nothing is typed in by hand:

  1. The KEY: each category label and the icon drawn left of it (fill colour + shape). Every badge on the
     map and in the lists is classified against these KEY icons.
  2. The lists: every number badge in the right-hand panel, the zone heading above it, and the printed
     lines next to it. Bold runs are titles, medium runs are credits ("Title – Artist" lines split at the
     weight change). Text is kept as printed; only PDF ligatures (ﬁ ﬂ) and whitespace are normalized.
  3. The map: every number badge drawn on the map (its centre is the pin), plus the unnumbered symbols
     (restrooms, food & drinks, hike departures, hospitality zones, drone-show rings, the opening ceremony).
  4. Georeferencing: the map is schematic (straight streets, uneven scale), so it is fitted with a moving
     least squares transform (a local affine at every point, weighted by distance) from control points:
       - street intersections: road centrelines from the PDF's stroked road paths, identified by the street
         labels printed on them, matched to the same intersection in OpenStreetMap (.cache/osm/core.json,
         nodes shared by both named ways);
       - the Roebling Suspension Bridge's two river-bank crossings (the PDF's river edges ↔ OSM water);
       - pass B only: BLINK's own online-map coordinates for works matched by title or credit
         (data/works.json) and for the Oasis Stations matched by name (research/blink-art/places.json),
         when pass A (streets only) already puts the PDF pin within 150 m of them. Location-only matches,
         the restrooms (matched by proximity) and the Lytle Park inset are checks, never control points.
     Every control point gets a leave-one-out residual, and every pin an approx_m radius (~90%).
  5. Checks (all assert): 92 numbers, each exactly once; every list badge has a KEY category; every map
     badge's category agrees with its list entry (or the disagreement is explained and recorded).

Usage:
  python3 scripts/extract-blink-map.py            write research/blink-map/blink-map-2026.json
  python3 scripts/extract-blink-map.py --qa       also render QA images into .cache/blink-map/qa/
  python3 scripts/extract-blink-map.py --check    run everything, write nothing, print the summary
  python3 scripts/extract-blink-map.py --pdf PATH use another copy of the PDF

Inputs (read only): .cache/blink-map/map.pdf (BLINK's file, never copied into the repo),
.cache/osm/core.json and water.json (the Overpass responses scripts/build-basemap.mjs uses),
data/works.json, data/people.json, research/blink-art/places.json.
Needs: pymupdf (import pymupdf); Pillow only for --qa. Deterministic: same inputs, same bytes out.
OSM data © OpenStreetMap contributors, ODbL 1.0.
"""
import argparse
import json
import math
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict

import pymupdf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF_DEFAULT = os.path.join(ROOT, ".cache", "blink-map", "map.pdf")
QA_DIR = os.path.join(ROOT, ".cache", "blink-map", "qa")
OUT = os.path.join(ROOT, "research", "blink-map", "blink-map-2026.json")
OSM_CORE = os.path.join(ROOT, ".cache", "osm", "core.json")
OSM_WATER = os.path.join(ROOT, ".cache", "osm", "water.json")
WORKS = os.path.join(ROOT, "data", "works.json")
PEOPLE = os.path.join(ROOT, "data", "people.json")
AMENITIES = os.path.join(ROOT, "research", "blink-art", "places.json")

SOURCE_URL = "https://www.blinkcincinnati.com/files/assets/2026blinkfoldingmapmap.pdf"
EXTRACTED = "2026-09-24"
PANEL_X = 540.0          # the white list panel (drawing 0) starts here; the map is left of it
ROAD_RGB = (0.137, 0.123, 0.126)
AGREE_M = 150.0          # pass A pin vs BLINK online map: above this, report and do not use as a control point
LOCATION_MATCH_M = 120.0 # nearest same-category work in the same zone, for entries with no title/credit match

# Zone headings as printed in the panel → the short zone name used in this file, and BLINK's online-map
# zone names (data/works.json `zone`) for the same area.
ZONES = [
    ("FINDLAY MARKET ZONE", "Findlay Market", ["Findlay Market"]),
    ("OTR ZONE", "OTR", ["Over the Rhine"]),
    ("FOUNTAIN ZONE", "Fountain", ["Fountain District", "BLINK at Lytle Park"]),
    ("THE BANKS ZONE", "The Banks", ["The Banks"]),
    ("COVINGTON ZONE", "Covington", ["Covington"]),
]
# The sponsor logos are pictures (raster images or outlined vector art), not text, so their words were read
# off the rendered PDF (see the QA crops). The script checks that a logo is really drawn where each entry says.
ZONE_SPONSORS = {
    "Findlay Market": {"label": "PRESENTED BY", "logo_text": "Hamilton County", "org_id": "hamilton-county-board-of-county-commissioners", "logo": "raster"},
    "OTR": {"label": "PRESENTED BY", "logo_text": "Jacob G. Schmidlapp Trusts · Fifth Third Bank, Trustee", "org_id": "jacob-g-schmidlapp-trusts-fifth-third-bank-trustee", "logo": "vector"},
    "Fountain": {"label": "PRESENTED BY", "logo_text": "Fifth Third", "org_id": "fifth-third", "logo": "vector"},
    "The Banks": {"label": "PRESENTED BY", "logo_text": "P&G", "org_id": "procter-and-gamble", "logo": "raster"},
    "Covington": {"label": "PRESENTED BY", "logo_text": "meet nky", "org_id": "meetnky", "logo": "raster"},
    "BLINK at Lytle Park": {"label": "with support from", "logo_text": "Western & Southern Financial Group", "org_id": "western-and-southern-financial-group", "logo": "raster emblem + vector wordmark"},
}
# Printed spellings worth flagging wherever they occur (kept verbatim in every text field).
SPELLING_QUIRKS = {
    "Immsersive": 'printed "Immsersive" (sic); the venue is The Mercantile Immersive (data/venues.json mercantile-immersive)',
    "PAZA": 'map label "ELM ST PAZA" (sic): Elm Street Plaza',
}
LIGATURES = {"ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl", "­": ""}
# Medium-weight lines that are not a credit (a place, a schedule or a descriptor) go to `detail`.
DETAIL_RE = re.compile(r"^(at |\(|Shows )")
KEY_LABELS = [
    ("Projections", "Projections"), ("Murals", "Murals"), ("Light Installations", "Light"),
    ("Unique Attractions", "Unique"), ("Food & Drinks", "Food & Drinks"), ("Oasis Station", "Oasis Station"),
    ("Restrooms", "Restrooms"), ("Official BLINK Merch Shop", "Official BLINK"), ("Hike Departure", "Hike Departure"),
]
BADGE_CATEGORIES = ["Projections", "Murals", "Light Installations", "Unique Attractions", "Oasis Station", "Official BLINK Merch Shop"]
SYMBOL_KEYS = {"Restrooms": "restroom", "Food & Drinks": "food-drinks", "Hike Departure": "hike-departure"}
WORK_MEDIUM = {"Projections": "projection mapping", "Murals": "mural", "Light Installations": "light installation"}

# ------------------------------------------------------------------ small helpers
def r1(v):
    return round(v + 0.0, 1)


def fix_text(s):
    for k, v in LIGATURES.items():
        s = s.replace(k, v)
    return s


def ws(s):
    return re.sub(r"\s+", " ", s).strip()


def rgb(c):
    return tuple(round(x, 3) for x in c) if c else None


def same_rgb(a, b, tol=0.02):
    return a is not None and b is not None and all(abs(x - y) <= tol for x, y in zip(a, b))


def hexcol(c):
    return "#" + "".join(f"{int(round(x * 255)):02x}" for x in c)


def fold(s):
    s = unicodedata.normalize("NFKD", fix_text(s))
    s = "".join(ch for ch in s if not unicodedata.combining(ch)).casefold()
    return s.replace("&", " and ").replace("!", "i")


def squash(s):
    return re.sub(r"[^a-z0-9]", "", fold(s))


def trigrams(s):
    s = f"  {squash(s)} "
    return {s[i:i + 3] for i in range(len(s) - 2)}


def sim(a, b):
    ta, tb = trigrams(a), trigrams(b)
    return len(ta & tb) / len(ta | tb) if ta and tb else 0.0


def point_in_poly(x, y, poly):
    inside = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def dist_to_poly(x, y, poly):
    best = float("inf")
    for i in range(len(poly)):
        (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % len(poly)]
        dx, dy = x2 - x1, y2 - y1
        L = dx * dx + dy * dy
        t = 0 if L == 0 else max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / L))
        best = min(best, math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)))
    return best


def text_lines(spans):
    """Spans → printed lines (spans whose vertical centres are within 3 pt form a line, read left to right)."""
    rows = []
    for s in sorted(spans, key=lambda s: (s["cy"], s["x0"])):
        if rows and abs(rows[-1][0] - s["cy"]) < 3:
            rows[-1][1].append(s)
        else:
            rows.append([s["cy"], [s]])
    return ws(" ".join("".join(x["text"] for x in sorted(r[1], key=lambda x: x["x0"])) for r in rows))


def quantile(vals, q):
    v = sorted(vals)
    if not v:
        return None
    k = (len(v) - 1) * q
    lo, hi = math.floor(k), math.ceil(k)
    return v[lo] + (v[hi] - v[lo]) * (k - lo)


# ------------------------------------------------------------------ geodesy (local metric frame)
LAT0, LNG0 = 39.1, -84.51
KX = 111320.0 * math.cos(math.radians(LAT0))
KY = 110574.0


def to_m(lat, lng):
    return ((lng - LNG0) * KX, (lat - LAT0) * KY)


def to_ll(e, n):
    return (LAT0 + n / KY, LNG0 + e / KX)


def dist_m(a, b):
    ea, na = to_m(*a)
    eb, nb = to_m(*b)
    return math.hypot(ea - eb, na - nb)


# ------------------------------------------------------------------ linear algebra (no numpy)
def solve3(M, b):
    """Solve a 3×3 system by Gaussian elimination with partial pivoting; None when singular."""
    A = [row[:] + [bv] for row, bv in zip(M, b)]
    for c in range(3):
        p = max(range(c, 3), key=lambda r: abs(A[r][c]))
        if abs(A[p][c]) < 1e-12:
            return None
        A[c], A[p] = A[p], A[c]
        for r in range(3):
            if r != c:
                f = A[r][c] / A[c][c]
                for k in range(c, 4):
                    A[r][k] -= f * A[c][k]
    return [A[i][3] / A[i][i] for i in range(3)]


class MLS:
    """Moving least squares, affine: at a query point, fit x,y → E,N by weighted least squares with
    weights 1 / (d² + s²)^alpha (d in PDF points), then apply that local affine to the point."""

    def __init__(self, pts, alpha, s):
        self.pts = pts  # [(x, y, E, N)]
        self.alpha, self.s2 = alpha, s * s

    def __call__(self, x, y, skip=None):
        M = [[0.0] * 3 for _ in range(3)]
        bE, bN = [0.0] * 3, [0.0] * 3
        for i, (px, py, E, N) in enumerate(self.pts):
            if i == skip:
                continue
            w = 1.0 / ((px - x) ** 2 + (py - y) ** 2 + self.s2) ** self.alpha
            v = (px - x, py - y, 1.0)  # centred on the query for conditioning
            for a in range(3):
                for b in range(3):
                    M[a][b] += w * v[a] * v[b]
                bE[a] += w * v[a] * E
                bN[a] += w * v[a] * N
        cE, cN = solve3(M, bE), solve3(M, bN)
        if cE is None or cN is None:   # degenerate neighbourhood: a tiny ridge on the linear terms
            tr = M[0][0] + M[1][1] + 1e-30
            for a in range(2):
                M[a][a] += 1e-6 * tr
            cE, cN = solve3(M, bE), solve3(M, bN)
        return (cE[2], cN[2])

    def local_scale(self, x, y):
        """Metres per PDF point at (x, y) (geometric mean of the local affine's axes)."""
        e0 = self(x, y)
        ex = self(x + 1, y)
        ey = self(x, y + 1)
        sx = math.hypot(ex[0] - e0[0], ex[1] - e0[1])
        sy = math.hypot(ey[0] - e0[0], ey[1] - e0[1])
        return math.sqrt(sx * sy)

    def loo(self):
        out = []
        for i, (px, py, E, N) in enumerate(self.pts):
            e, n = self(px, py, skip=i)
            out.append(math.hypot(e - E, n - N))
        return out


# ------------------------------------------------------------------ PDF reading
def read_pdf(path):
    doc = pymupdf.open(path)
    if doc.page_count != 1:
        raise SystemExit(f"expected a one-page PDF, got {doc.page_count} pages")
    page = doc[0]
    if [round(v) for v in page.rect] != [0, 0, 810, 1584]:
        raise SystemExit(f"unexpected page size {page.rect}")
    spans = []
    for bi, b in enumerate(page.get_text("dict")["blocks"]):
        for li, l in enumerate(b.get("lines", [])):
            for s in l["spans"]:
                x0, y0, x1, y1 = s["bbox"]
                spans.append({
                    "raw": s["text"], "text": fix_text(s["text"]), "font": s["font"],
                    "weight": s["font"].split("-")[-1], "size": s["size"], "color": s["color"],
                    "x0": x0, "y0": y0, "x1": x1, "y1": y1, "cx": (x0 + x1) / 2, "cy": (y0 + y1) / 2,
                    "dir": tuple(round(v, 3) for v in l["dir"]), "block": bi, "line": li,
                })
    drawings = []
    for i, d in enumerate(page.get_drawings()):
        R = d["rect"]
        drawings.append({
            "i": i, "type": d["type"], "fill": rgb(d.get("fill")), "stroke": rgb(d.get("color")),
            "width": d.get("width") or 0, "items": d["items"], "x0": R.x0, "y0": R.y0, "x1": R.x1, "y1": R.y1,
            "w": R.width, "h": R.height, "cx": (R.x0 + R.x1) / 2, "cy": (R.y0 + R.y1) / 2,
            "sig": "".join(it[0] for it in d["items"]),
        })
    images = [{"xref": im["xref"], "bbox": [r1(v) for v in im["bbox"]]} for im in page.get_image_info(xrefs=True)]
    return doc, page, spans, drawings, images


def subpaths(d):
    """Number of separate sub-paths in a drawing (a new one starts where an item does not continue the last)."""
    n, prev = 0, None
    for it in d["items"]:
        start = it[1] if it[0] != "re" else None
        if start is None or prev is None or abs(start.x - prev.x) > 0.01 or abs(start.y - prev.y) > 0.01:
            n += 1
        prev = it[-1] if it[0] != "re" else None
    return n


def poly_of(d):
    """Vertices of a filled path (curves reduced to their end points)."""
    pts = []
    for it in d["items"]:
        if it[0] == "re":
            R = it[1]
            return [(R.x0, R.y0), (R.x1, R.y0), (R.x1, R.y1), (R.x0, R.y1)]
        for q in (it[1], it[-1]):
            if hasattr(q, "x"):
                p = (q.x, q.y)
                if not pts or math.hypot(pts[-1][0] - p[0], pts[-1][1] - p[1]) > 0.05:
                    pts.append(p)
    return pts


# ------------------------------------------------------------------ 1 · the KEY
def read_key(spans, drawings):
    key = [s for s in spans if s["text"].strip() == "KEY" and s["x0"] > PANEL_X]
    if len(key) != 1:
        raise SystemExit("KEY heading not found")
    heading_y = min(s["y0"] for s in spans if s["x0"] > PANEL_X and s["size"] > 16 and s["text"].strip().endswith("ZONE"))
    region = (PANEL_X, key[0]["y0"] - 12, 810, heading_y - 4)
    out = {}
    for name, first in KEY_LABELS:
        lab = [s for s in spans if region[0] < s["x0"] and region[1] < s["y0"] < region[3] and s["text"].strip() == first.strip()]
        if len(lab) != 1:
            raise SystemExit(f"KEY label {first!r} not found exactly once")
        lab = lab[0]
        # the label's lines: same left edge, stacked under the first line
        col = sorted([s for s in spans if abs(s["x0"] - lab["x0"]) < 1.5 and 0 <= s["y0"] - lab["y0"] < 30 and s["size"] >= 5],
                     key=lambda s: s["y0"])
        block = [col[0]]
        for s in col[1:]:
            if s["y0"] - block[-1]["y1"] < 3:   # the next line of the same label
                block.append(s)
            else:
                break
        ly0, ly1 = min(s["y0"] for s in block), max(s["y1"] for s in block)
        cy = (ly0 + ly1) / 2
        cands = [d for d in drawings if d["fill"] and d["fill"] != (1.0, 1.0, 1.0)
                 and lab["x0"] - 30 < d["x1"] <= lab["x0"] + 1.5 and d["y1"] > ly0 - 4 and d["y0"] < ly1 + 4
                 and d["w"] < 30 and d["h"] < 30]
        if not cands:
            raise SystemExit(f"no KEY icon for {name}")
        # the icon beside the label: nearest vertical centre; a coloured fill before its black outline
        icon = min(cands, key=lambda d: (round(abs(d["cy"] - cy)), same_rgb(d["fill"], ROAD_RGB), -d["w"] * d["h"]))
        out[name] = {"fill": icon["fill"], "aspect": icon["w"] / icon["h"], "w": icon["w"], "h": icon["h"],
                     "types": Counter(icon["sig"]), "n_items": len(icon["items"]), "drawing": icon["i"],
                     "bbox": [r1(icon["x0"]), r1(icon["y0"]), r1(icon["x1"]), r1(icon["y1"])],
                     "label": join_rows([s["text"] for s in block if s["weight"] != "Medium"]),
                     "description": join_rows([s["text"] for s in block if s["weight"] == "Medium"]) or None}
    return out


def classify_badge(d, key):
    """KEY category of a badge shape, or None. Coloured badges are told apart by fill; the black ones (Oasis
    drop, merch eye) by aspect ratio, which also rejects the black interstate shields."""
    if not d["fill"]:
        return None
    for cat in BADGE_CATEGORIES:
        k = key[cat]
        if not same_rgb(d["fill"], k["fill"]):
            continue
        if same_rgb(k["fill"], ROAD_RGB):
            if abs(d["w"] / d["h"] - k["aspect"]) / k["aspect"] <= 0.15:
                return cat
            continue
        return cat
    return None


def badge_under(span, drawings, key):
    """The smallest badge-coloured shape under a number."""
    best = None
    for d in drawings:
        if d["type"] != "f" or d["w"] > 30 or d["h"] > 30:
            continue
        if not (d["x0"] <= span["cx"] <= d["x1"] and d["y0"] <= span["cy"] <= d["y1"]):
            continue
        if not any(same_rgb(d["fill"], key[c]["fill"]) for c in BADGE_CATEGORIES):
            continue
        if best is None or d["w"] * d["h"] < best["w"] * best["h"]:
            best = d
    if best is None:
        return None, None
    return best, classify_badge(best, key)


# ------------------------------------------------------------------ 2 · the lists
def read_lists(spans, drawings, key):
    headings = sorted([s for s in spans if s["x0"] > PANEL_X and s["size"] > 16 and ws(s["text"]).endswith("ZONE")], key=lambda s: s["y0"])
    names = {h: (short, online) for h, short, online in ZONES}
    if sorted(ws(h["text"]) for h in headings) != sorted(names):
        raise SystemExit(f"zone headings differ: {[ws(h['text']) for h in headings]}")
    sections = []
    for i, h in enumerate(headings):
        y1 = headings[i + 1]["y0"] if i + 1 < len(headings) else 1584
        short, online = names[ws(h["text"])]
        sections.append({"heading": ws(h["text"]), "zone": short, "online_zones": online, "y0": h["y0"], "y1": y1,
                         "color": f"#{h['color']:06x}", "heading_bbox": [r1(h["x0"]), r1(h["y0"]), r1(h["x1"]), r1(h["y1"])]})

    def section_of(y):
        for sec in sections:
            if sec["y0"] <= y < sec["y1"]:
                return sec
        return None

    badges, unbadged = [], []
    for s in spans:
        t = s["text"].strip()
        if not re.fullmatch(r"\d{1,2}", t) or s["weight"] != "Heavy" or s["size"] < 7.5:
            continue
        d, cat = badge_under(s, drawings, key)
        rec = {"n": int(t), "span": s, "shape": d, "category": cat, "x": d["cx"] if d else s["cx"], "y": d["cy"] if d else s["cy"]}
        (badges if cat else unbadged).append(rec)
    list_badges = [b for b in badges if b["x"] > PANEL_X]
    map_badges = [b for b in badges if b["x"] < PANEL_X]

    col_split = (PANEL_X + 810) / 2 - 55   # left badges sit near x≈565, right ones near x≈682
    text_split = 634.0                     # left text starts at x≈576, right text at x≈692
    for b in list_badges:
        b["section"] = section_of(b["y"])
        b["column"] = "left" if b["x"] < col_split else "right"
        b["top"] = b["shape"]["y0"]
    # text rows: every non-number span in a section (headings, "PRESENTED BY" and blank spans skipped)
    rows = defaultdict(list)
    for s in spans:
        if s["x0"] < PANEL_X or s["size"] < 6 or s["size"] > 12 or s["weight"] == "Heavy":
            continue
        sec = section_of(s["cy"])
        if sec is None:
            continue
        col = "left" if s["x0"] < text_split else "right"
        rows[(sec["zone"], col, round(s["y0"] * 2) / 2)].append(s)
    # merge rows whose y differs by < 2 pt (spans on one printed line)
    merged = []
    for (zone, col, y), ss in sorted(rows.items(), key=lambda kv: (kv[0][0], kv[0][1], kv[0][2])):
        if merged and merged[-1]["zone"] == zone and merged[-1]["col"] == col and abs(merged[-1]["y"] - y) < 2:
            merged[-1]["spans"] += ss
        else:
            merged.append({"zone": zone, "col": col, "y": y, "spans": list(ss)})
    for r in merged:
        r["spans"].sort(key=lambda s: s["x0"])

    entries_by_badge = defaultdict(list)
    orphans = []
    for r in merged:
        cands = [b for b in list_badges if b["section"]["zone"] == r["zone"] and b["column"] == r["col"] and b["top"] <= r["y"] + 4.0]
        if not cands:
            if ws("".join(s["text"] for s in r["spans"])):
                orphans.append(ws("".join(s["text"] for s in r["spans"])))
            continue
        b = max(cands, key=lambda b: b["top"])
        entries_by_badge[id(b)].append(r)
    if orphans:
        raise SystemExit(f"list text with no badge: {orphans}")
    listings = []
    for b in list_badges:
        rs = sorted(entries_by_badge.get(id(b), []), key=lambda r: r["y"])
        listings.append(parse_listing(b, rs))
    return sections, listings, map_badges, unbadged


def join_rows(parts):
    """Join printed lines: a space between lines, except after a soft or hard hyphen that splits a word."""
    out = ""
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if not out:
            out = p
        elif out.endswith("-") and p[:1].islower():
            out += p          # hyphenated line break: keep the hyphen, no space (none occur in the 2026 PDF)
        elif out.endswith("/"):
            out += p          # a URL broken after a slash (the KEY's "urban-hikers.com/" + "blink-walks")
        else:
            out += " " + p
    return ws(out)


def parse_listing(b, rows):
    printed = [ws("".join(s["text"] for s in r["spans"])) for r in rows]
    printed = [p for p in printed if p]
    raw_lines = ["".join(s["raw"] for s in r["spans"]) for r in rows]
    # split into parts at every bold span that follows a medium span
    parts, cur, last = [], None, None
    for ri, r in enumerate(rows):
        for s in r["spans"]:
            if not s["text"].strip():
                continue
            kind = "T" if s["weight"] in ("Bold", "Heavy") else "C"
            if cur is None or (kind == "T" and last == "C"):
                cur = {"T": defaultdict(str), "C": defaultdict(str)}
                parts.append(cur)
            cur[kind][ri] += s["text"]
            last = kind
    out_parts = []
    for p in parts:
        title = join_rows([p["T"][k] for k in sorted(p["T"])])
        second = join_rows([p["C"][k] for k in sorted(p["C"])])
        sep = None
        m = re.match(r"^([–—-])\s*", second)
        if m:
            sep, second = m.group(1), second[m.end():]
        rec = {"title": title or None, "credit": None, "detail": None}
        if second:
            if DETAIL_RE.match(second):
                rec["detail"] = second
            else:
                rec["credit"] = second
        if sep:
            rec["inline_separator"] = sep
        out_parts.append(rec)
    quirks = []
    for raw in raw_lines:
        if re.search(r"\S  +\S", raw.strip()):
            quirks.append(f'printed with a double space: "{raw.strip()}" (normalized to one space)')
        for lig in ("ﬁ", "ﬂ"):
            if lig in raw:
                quirks.append(f'PDF ligature "{lig}" in "{raw.strip()}" written as plain letters')
    for word, note in SPELLING_QUIRKS.items():
        if any(word in p for p in printed):
            quirks.append(note)
    if len(out_parts) > 1:
        quirks.append(f"{len(out_parts)} works printed under one number")
    return {"n": b["n"], "zone": b["section"]["zone"], "category": b["category"], "column": b["column"],
            "badge": b, "printed": printed, "parts": out_parts, "quirks": quirks}


# ------------------------------------------------------------------ 3 · symbols on the map
def read_symbols(spans, drawings, key):
    out = []
    first_road = min(d["i"] for d in drawings if d["type"] == "s" and same_rgb(d["stroke"], ROAD_RGB) and 8.5 < d["width"] < 9.5)
    for keyname, kind in SYMBOL_KEYS.items():
        k = key[keyname]
        for d in drawings:
            if d["x1"] > PANEL_X or d["type"] != "f" or not same_rgb(d["fill"], k["fill"]):
                continue
            if abs(d["w"] / max(d["h"], 0.01) - k["aspect"]) / k["aspect"] > 0.08:
                continue
            if Counter(d["sig"]) != k["types"] or not (0.8 * k["w"] <= d["w"] <= 1.6 * k["w"]):
                continue
            inner = [e for e in drawings if e["fill"] == (1.0, 1.0, 1.0) and e["i"] > d["i"] and e["i"] <= d["i"] + 12
                     and d["x0"] - 0.5 <= e["x0"] and e["x1"] <= d["x1"] + 0.5 and d["y0"] - 0.5 <= e["y0"] and e["y1"] <= d["y1"] + 0.5]
            if not inner:
                continue
            out.append({"kind": kind, "label": keyname, "x": d["cx"], "y": d["cy"], "drawing": d["i"],
                        "bbox": [r1(d["x0"]), r1(d["y0"]), r1(d["x1"]), r1(d["y1"])]})
    # hospitality zones: the printed words, with the yellow area or street stroke they label
    yellow = key["Unique Attractions"]["fill"]
    labels = []
    map_spans = [s for s in spans if s["x1"] < PANEL_X]
    for s in map_spans:
        t = ws(s["text"])
        if t == "HOSPITALITY ZONE":
            labels.append((s["x0"], s["y0"], s["x1"], s["y1"]))
        elif t == "HOSPITALITY":
            z = [u for u in map_spans if ws(u["text"]) == "ZONE" and abs(u["cx"] - s["cx"]) < 12 and 0 < u["y0"] - s["y0"] < 12]
            if z:
                labels.append((min(s["x0"], z[0]["x0"]), s["y0"], max(s["x1"], z[0]["x1"]), z[0]["y1"]))
    for (x0, y0, x1, y1) in sorted(labels, key=lambda b: (b[1], b[0])):
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        best = None
        for d in drawings:
            if d["x1"] > PANEL_X or not (same_rgb(d["fill"], yellow) or same_rgb(d["stroke"], yellow)):
                continue
            if d["w"] < 25 and d["h"] < 25:     # the star badges
                continue
            if not (d["x0"] - 4 <= cx <= d["x1"] + 4 and d["y0"] - 8 <= cy <= d["y1"] + 8):
                continue
            if best is None or d["w"] * max(d["h"], 1) > best["w"] * max(best["h"], 1):
                best = d
        rec = {"kind": "hospitality-zone", "label": "HOSPITALITY ZONE", "label_bbox": [r1(x0), r1(y0), r1(x1), r1(y1)]}
        on_road = best is not None and best["type"] == "s" and any(
            abs(a[1] - b[1]) < 0.5 and abs(a[1] - best["cy"]) < 1.5 and min(a[0], b[0]) < best["x1"] and max(a[0], b[0]) > best["x0"]
            for (a, b) in road_segments(drawings))
        if on_road:   # a yellow band drawn along a street's centreline
            rec.update({"shape": "street", "x": best["cx"], "y": best["cy"], "line": [[r1(best["x0"]), r1(best["cy"])], [r1(best["x1"]), r1(best["cy"])]]})
        elif best is not None and not (abs(best["x0"] - x0) < 4 and abs(best["x1"] - x1) < 4 and best["h"] < 14):
            rec.update({"shape": "area", "x": best["cx"], "y": best["cy"], "bbox": [r1(best["x0"]), r1(best["y0"]), r1(best["x1"]), r1(best["y1"])]})
        else:
            rec.update({"shape": "label", "x": cx, "y": cy})
        out.append(rec)
    # drone-show rings: dotted ellipses (one path of many dots each) near a "DRONE SHOW" text
    dotted = [d for d in drawings if d["x1"] < PANEL_X and d["type"] == "f" and d["fill"] and len(d["items"]) >= 60
              and 20 <= d["w"] < 70 and 15 <= d["h"] < 30 and max(d["fill"]) - min(d["fill"]) > 0.25   # saturated colours
              and subpaths(d) >= 8]                                                                  # many separate dots
    groups = []
    for d in sorted(dotted, key=lambda d: d["i"]):
        for g in groups:
            if d["x0"] < g[2] + 20 and d["x1"] > g[0] - 20 and d["y0"] < g[3] + 20 and d["y1"] > g[1] - 20:
                g[0], g[1], g[2], g[3] = min(g[0], d["x0"]), min(g[1], d["y0"]), max(g[2], d["x1"]), max(g[3], d["y1"])
                g[4].append(d["i"])
                break
        else:
            groups.append([d["x0"], d["y0"], d["x1"], d["y1"], [d["i"]]])
    for g in groups:
        cx, cy = (g[0] + g[2]) / 2, (g[1] + g[3]) / 2
        texts = [s for s in map_spans if "DRONE SHOW" in s["text"]]
        t = min(texts, key=lambda s: math.hypot(s["cx"] - cx, s["cy"] - cy))
        if t["text"].strip() == "DRONE SHOW 8:30 PM":   # the last line of the opening-ceremony box
            label = "DRONE SHOW 8:30 PM"
        else:
            label = text_lines([s for s in map_spans if s["block"] == t["block"] or (s["block"] == t["block"] + 1 and abs(s["cx"] - t["cx"]) < 40)])
        out.append({"kind": "drone-show", "label": label, "x": cx, "y": cy, "bbox": [r1(g[0]), r1(g[1]), r1(g[2]), r1(g[3])],
                    "label_distance_pt": r1(math.hypot(t["cx"] - cx, t["cy"] - cy))})
    # the opening ceremony: the yellow strip drawn on Central Parkway, labelled by the READY. SET. BLINK! box
    ready = [s for s in map_spans if ws(s["text"]) == "READY. SET."]
    if len(ready) != 1:
        raise SystemExit("READY. SET. BLINK! label not found")
    box = [d for d in drawings if d["x1"] < PANEL_X and same_rgb(d["fill"], yellow) and d["x0"] <= ready[0]["cx"] <= d["x1"] and d["y0"] <= ready[0]["cy"] <= d["y1"]
           and not (d["h"] > 4 * d["w"])]   # the label box, not the strip it sits on
    box = min(box, key=lambda d: d["w"] * d["h"])
    label = text_lines([s for s in map_spans if box["x0"] <= s["cx"] <= box["x1"] and box["y0"] <= s["cy"] <= box["y1"]])
    strip = [d for d in drawings if d["x1"] < PANEL_X and same_rgb(d["fill"], yellow) and d["h"] > 4 * d["w"] and d["w"] < 12]
    if len(strip) != 1:
        raise SystemExit("opening-ceremony strip not found")
    st = strip[0]
    out.append({"kind": "opening-ceremony", "label": label, "x": st["cx"], "y": st["cy"],
                "line": [[r1(st["cx"]), r1(st["y0"])], [r1(st["cx"]), r1(st["y1"])]],
                "label_bbox": [r1(box["x0"]), r1(box["y0"]), r1(box["x1"]), r1(box["y1"])]})
    return out, first_road


# ------------------------------------------------------------------ 4 · georeferencing
def road_segments(drawings):
    segs = []
    for d in drawings:
        if d["type"] != "s" or not same_rgb(d["stroke"], ROAD_RGB) or not (8.5 < d["width"] < 9.5):
            continue
        for it in d["items"]:
            if it[0] == "l":
                a, b = it[1], it[2]
                if math.hypot(b.x - a.x, b.y - a.y) > 0.5:
                    segs.append(((a.x, a.y), (b.x, b.y)))
    return segs


def unit(dx, dy):
    L = math.hypot(dx, dy)
    return (dx / L, dy / L)


def chain_for_label(lab, segs):
    """The straight road under a street label, extended over collinear pieces (gaps up to 20 pt)."""
    dx, dy = lab["dir"]
    if dx < 0 or (dx == 0 and dy < 0):
        dx, dy = -dx, -dy
    best = None
    for (a, b) in segs:
        u = unit(b[0] - a[0], b[1] - a[1])
        if abs(u[0] * dy - u[1] * dx) > 0.12:
            continue
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        t = (lab["cx"] - a[0]) * u[0] + (lab["cy"] - a[1]) * u[1]
        perp = abs((lab["cx"] - a[0]) * u[1] - (lab["cy"] - a[1]) * u[0])
        if perp < 4.0 and -0.05 * L - 2 <= t <= 1.05 * L + 2:
            if best is None or perp < best[0]:
                best = (perp, a, b)
    if best is None:
        return None
    _, a, b = best
    u = unit(b[0] - a[0], b[1] - a[1])
    if u[0] < 0 or (abs(u[0]) < 1e-9 and u[1] < 0):
        u = (-u[0], -u[1])
    p0 = a

    def on_line(p):
        return abs((p[0] - p0[0]) * u[1] - (p[1] - p0[1]) * u[0]) < 1.5

    def tt(p):
        return (p[0] - p0[0]) * u[0] + (p[1] - p0[1]) * u[1]

    col = []
    for (c, d) in segs:
        if on_line(c) and on_line(d):
            t1, t2 = sorted((tt(c), tt(d)))
            col.append((t1, t2))
    col.sort()
    t_lab = tt((lab["cx"], lab["cy"]))
    # grow the interval that contains the label
    lo = hi = None
    for t1, t2 in col:
        if t1 - 2 <= t_lab <= t2 + 2:
            lo, hi = (t1, t2) if lo is None else (min(lo, t1), max(hi, t2))
    if lo is None:
        lo, hi = tt(a), tt(b)
        lo, hi = min(lo, hi), max(lo, hi)
    changed = True
    while changed:
        changed = False
        for t1, t2 in col:
            if t1 <= hi + 20 and t2 >= lo - 20 and (t1 < lo or t2 > hi):
                lo, hi = min(lo, t1), max(hi, t2)
                changed = True
    return {"p0": p0, "u": u, "lo": lo, "hi": hi}


def intersect_chains(A, B, tol=3.0):
    (ax, ay), (ux, uy) = A["p0"], A["u"]
    (bx, by), (vx, vy) = B["p0"], B["u"]
    den = ux * vy - uy * vx
    if abs(den) < math.sin(math.radians(20)):
        return None
    s = ((bx - ax) * vy - (by - ay) * vx) / den
    r = ((bx - ax) * uy - (by - ay) * ux) / den
    if A["lo"] - tol <= s <= A["hi"] + tol and B["lo"] - tol <= r <= B["hi"] + tol:
        return (ax + s * ux, ay + s * uy)
    return None


STREET_RE = re.compile(r"^(.+) (ST|AVE|PKWY|BLVD|DR|PL|WAY)$")
SUFFIX = {"ST": "Street", "AVE": "Avenue", "PKWY": "Parkway", "BLVD": "Boulevard", "DR": "Drive", "PL": "Place", "WAY": "Way"}


def street_labels(spans):
    out = []
    for s in spans:
        if s["x1"] > PANEL_X or s["color"] != 0xFFFFFF or s["weight"] != "Bold" or not (8.0 <= s["size"] <= 9.0):
            continue
        t = ws(s["text"])
        if STREET_RE.match(t) or t == "BROADWAY":
            out.append(dict(s, name="BROADWAY" if t == "BROADWAY ST" else t, printed=t))   # the map prints both spellings
    return out


class OSM:
    def __init__(self, path):
        d = json.load(open(path))
        self.ways = [e for e in d["elements"] if e["type"] == "way" and "name" in e.get("tags", {})]
        self.node = {}
        self.byname = defaultdict(list)
        for w in self.ways:
            for nid, g in zip(w["nodes"], w["geometry"]):
                self.node[nid] = (g["lat"], g["lon"])
            self.byname[w["tags"]["name"]].append(w)
        self.lower = defaultdict(list)
        for n in self.byname:
            self.lower[n.casefold()].append(n)
        self.timestamp = d.get("osm3s", {}).get("timestamp_osm_base")

    def names_for(self, label):
        if label in ("BROADWAY", "BROADWAY ST"):
            base = "broadway street"
        else:
            m = STREET_RE.match(label)
            base = (m.group(1) + " " + SUFFIX[m.group(2)]).casefold()
        out = []
        for b in (base, "west " + base, "east " + base):
            out += self.lower.get(b, [])
        return sorted(set(out))

    def nodes(self, names, box):
        s = set()
        for n in names:
            for w in self.byname.get(n, []):
                for nid in w["nodes"]:
                    la, lo = self.node[nid]
                    if box[0] <= la <= box[1] and box[2] <= lo <= box[3]:
                        s.add(nid)
        return s

    def crossing(self, A, B, box):
        shared = sorted(self.nodes(A, box) & self.nodes(B, box))
        if not shared:
            return None
        pts = [self.node[n] for n in shared]
        la = sum(p[0] for p in pts) / len(pts)
        lo = sum(p[1] for p in pts) / len(pts)
        return {"lat": la, "lng": lo, "nodes": len(pts), "spread_m": max(dist_m((la, lo), p) for p in pts)}


# Intersections the map draws in a way that no single OSM point matches (None = any cross street).
EXCLUDE_INTERSECTIONS = {
    ("GARFIELD PL", None): "Garfield Place is two carriageways around Piatt Park; the map draws both (y≈620 and y≈633), so the OSM centroid between them matches neither line",
    ("McMICKEN AVE", "MAIN ST"): "the map joins McMicken Ave, Liberty St and Main St at one point; in OSM McMicken meets Main 50 m north of Liberty",
}
OHIO_BOX = (39.093, 39.13, -84.54, -84.49)
KY_BOX = (39.07, 39.093, -84.53, -84.49)


def river_polygon(spans, drawings):
    ohio = [s for s in spans if ws(s["text"]) == "OHIO" and s["x1"] < PANEL_X]
    if len(ohio) != 1:
        raise SystemExit("OHIO RIVER label not found")
    o = ohio[0]
    grey = [d for d in drawings if d["type"] == "f" and d["x0"] - 1 <= o["cx"] <= d["x1"] + 1 and d["y0"] <= o["cy"] <= d["y1"]
            and d["fill"] != (1.0, 1.0, 1.0) and d["w"] > 300]
    return max(grey, key=lambda d: d["w"] * d["h"])


def bridge_bank_points(spans, drawings, segs, labels, water_path, osm):
    """The Roebling Suspension Bridge crosses the river edges drawn on the map; OSM gives where the bridge
    crosses the real river banks. Two control points."""
    lab = [l for l in (dict(s, name=ws(s["text"])) for s in spans) if l["name"] == "ROEBLING SUSPENSION BRIDGE"]
    if len(lab) != 1:
        return [], "Roebling bridge label not found"
    ch = chain_for_label(lab[0], segs)
    x = ch["p0"][0]
    river = river_polygon(spans, drawings)
    ys = []
    for it in river["items"]:
        if it[0] != "l":
            continue
        a, b = it[1], it[2]
        if abs(a.y - b.y) < 0.5 and min(a.x, b.x) <= x <= max(a.x, b.x):
            ys.append(a.y)
    ys = sorted(set(round(y, 2) for y in ys))
    if len(ys) != 2:
        return [], f"river edges at the bridge: {ys}"
    # OSM: the longest bridge=yes way of the Roebling bridge, extended, against water=river boundaries
    br = [w for w in osm.byname.get("John A. Roebling Suspension Bridge", []) if w["tags"].get("bridge") == "yes"]
    if not br:
        return [], "OSM Roebling bridge not found"
    w = max(br, key=lambda w: dist_m((w["geometry"][0]["lat"], w["geometry"][0]["lon"]), (w["geometry"][-1]["lat"], w["geometry"][-1]["lon"])))
    a = (w["geometry"][0]["lat"], w["geometry"][0]["lon"])
    b = (w["geometry"][-1]["lat"], w["geometry"][-1]["lon"])
    A = to_m(a[0] + (a[0] - b[0]) * 0.3, a[1] + (a[1] - b[1]) * 0.3)
    B = to_m(b[0] + (b[0] - a[0]) * 0.3, b[1] + (b[1] - a[1]) * 0.3)
    wd = json.load(open(water_path))
    edges = []

    def add(geom):
        for p, q in zip(geom, geom[1:]):
            edges.append((to_m(p["lat"], p["lon"]), to_m(q["lat"], q["lon"])))
    for e in wd["elements"]:
        if e.get("tags", {}).get("water") != "river":
            continue
        if e["type"] == "way":
            add(e["geometry"])
        else:
            for m in e.get("members", []):
                if m.get("geometry"):
                    add(m["geometry"])
    hits = []
    for (p, q) in edges:
        den = (A[0] - B[0]) * (p[1] - q[1]) - (A[1] - B[1]) * (p[0] - q[0])
        if abs(den) < 1e-9:
            continue
        t = ((A[0] - p[0]) * (p[1] - q[1]) - (A[1] - p[1]) * (p[0] - q[0])) / den
        u = -((A[0] - B[0]) * (A[1] - p[1]) - (A[1] - B[1]) * (A[0] - p[0])) / den
        if 0 <= t <= 1 and 0 <= u <= 1:
            hits.append(to_ll(A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1])))
    if len(hits) != 2:
        return [], f"OSM bridge/river crossings: {len(hits)}"
    north, south = max(hits), min(hits)
    return [
        {"id": "roebling-bridge-ohio-bank", "kind": "bridge-bank", "label": "Roebling Suspension Bridge × Ohio River north bank",
         "x": x, "y": ys[0], "lat": north[0], "lng": north[1], "source": "OSM way %d × OSM water=river" % w["id"]},
        {"id": "roebling-bridge-kentucky-bank", "kind": "bridge-bank", "label": "Roebling Suspension Bridge × Ohio River south bank",
         "x": x, "y": ys[1], "lat": south[0], "lng": south[1], "source": "OSM way %d × OSM water=river" % w["id"]},
    ], None


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", fold(s)).strip("-")


def intersection_controls(spans, drawings, osm, river_top, river_bottom):
    segs = road_segments(drawings)
    labels = street_labels(spans)
    for l in labels:
        l["chain"] = chain_for_label(l, segs)
    labels = [l for l in labels if l["chain"]]
    byname = defaultdict(list)
    for l in labels:
        byname[l["name"]].append(l)
    names = sorted(byname)
    found, ambiguous, skipped = [], [], []
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            pts = []
            for la in byname[a]:
                for lb in byname[b]:
                    p = intersect_chains(la["chain"], lb["chain"])
                    if p:
                        pts.append(p)
            if not pts:
                continue
            spread = max(math.hypot(p[0] - q[0], p[1] - q[1]) for p in pts for q in pts)
            if spread > 3:
                ambiguous.append({"streets": [a, b], "points": [[r1(p[0]), r1(p[1])] for p in pts]})
                continue
            x, y = sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)
            if river_top - 5 <= y <= river_bottom + 5:
                continue
            box = OHIO_BOX if y < river_top else KY_BOX
            A, B = osm.names_for(a), osm.names_for(b)
            if not A or not B:
                skipped.append({"streets": [a, b], "x": r1(x), "y": r1(y), "why": "street name not in OSM"})
                continue
            c = osm.crossing(A, B, box)
            if c is None:
                skipped.append({"streets": [a, b], "x": r1(x), "y": r1(y), "why": "no shared OSM node"})
                continue
            if c["spread_m"] > 25:
                skipped.append({"streets": [a, b], "x": r1(x), "y": r1(y), "why": f"OSM crossing spread {c['spread_m']:.0f} m (a jog)"})
                continue
            found.append({"id": f"{slug(a)}--{slug(b)}", "kind": "intersection", "label": f"{a} & {b}", "streets": [a, b],
                          "x": x, "y": y, "lat": c["lat"], "lng": c["lng"], "osm_nodes": c["nodes"], "osm_spread_m": round(c["spread_m"], 1),
                          "side": "OH" if box is OHIO_BOX else "KY", "source": "OSM nodes shared by: " + " / ".join(A) + " × " + " / ".join(B)})
    # curated exclusions, each with its reason (checked against the QA overlay)
    kept = []
    for c in found:
        why = next((r for (a, b), r in EXCLUDE_INTERSECTIONS.items() if a in c["streets"] and (b is None or b in c["streets"])), None)
        if why:
            skipped.append({"streets": c["streets"], "x": r1(c["x"]), "y": r1(c["y"]), "why": why})
        else:
            kept.append(c)
    # one control point per place: crossings the map draws within 6 pt of each other that OSM puts at the same
    # node (Findlay St, Vine St and McMicken Ave meet at one node; RiverCenter Blvd and 2nd St share a line)
    dedup = []
    for c in kept:
        twin = next((d for d in dedup if math.hypot(c["x"] - d["x"], c["y"] - d["y"]) < 6 and dist_m((c["lat"], c["lng"]), (d["lat"], d["lng"])) < 5), None)
        if twin is None:
            dedup.append(dict(c, merged=[c["label"]]))
            continue
        k = len(twin["merged"])
        twin["x"] = (twin["x"] * k + c["x"]) / (k + 1)
        twin["y"] = (twin["y"] * k + c["y"]) / (k + 1)
        twin["merged"].append(c["label"])
        twin["label"] = " = ".join(twin["merged"])
    for d in dedup:
        if len(d["merged"]) == 1:
            d.pop("merged")
    return dedup, ambiguous, skipped, segs, labels


def fit(controls, grid=None):
    pts = [(c["x"], c["y"]) + to_m(c["lat"], c["lng"]) for c in controls]
    best = None
    for alpha in (grid or {}).get("alpha", [1.0, 1.5, 2.0, 2.5, 3.0]):
        for s in (grid or {}).get("s", [5.0, 10.0, 20.0, 40.0]):
            m = MLS(pts, alpha, s)
            loo = m.loo()
            score = (round(sum(loo) / len(loo), 6), round(quantile(loo, 0.9), 6))
            if best is None or score < best[0]:
                best = (score, alpha, s, m, loo)
    _, alpha, s, m, loo = best
    return m, loo, {"alpha": alpha, "s_pt": s}


def predict(m, x, y):
    e, n = m(x, y)
    return to_ll(e, n)


# ------------------------------------------------------------------ 5 · BLINK's online map
def load_online():
    works = [w for w in json.load(open(WORKS)) if w.get("program") == "blink"]
    people = {p["id"]: p["name"] for p in json.load(open(PEOPLE))}
    for w in works:
        names = [people.get(a, a) for a in w.get("artists") or []]
        if w.get("artist_text"):
            names.append(w["artist_text"])
        m = re.search(r"\bby (.+)$", w["title"])
        if m:
            names.append(m.group(1))
        w["_names"] = names
    places = json.load(open(AMENITIES))
    amen = [p for p in places if p.get("kind") == "accessibility" and p.get("lat") is not None]
    return works, amen


TITLE_STOPWORDS = {"the", "a", "an", "of", "and", "by", "mural", "projection", "lighting", "show", "experience", "installation"}


def token_overlap(a, b):
    """Shared distinctive title words over the shorter title's word count, counted only when two or more words
    are shared ("Insane 51 Mural - Illuminated" ~ "Insane 51- cool lighting"; "The B!G TV" ~ "B!g TV")."""
    ta = {w for w in re.split(r"[^a-z0-9]+", fold(a)) if w and w not in TITLE_STOPWORDS}
    tb = {w for w in re.split(r"[^a-z0-9]+", fold(b)) if w and w not in TITLE_STOPWORDS}
    shared = ta & tb
    return len(shared) / min(len(ta), len(tb)) if len(shared) >= 2 else 0.0


def text_score(entry_part, category, work):
    """0..2: title similarity (trigram Jaccard) + the share of the online work's credited names that the
    printed credit contains. A PDF title "Mural" is compared as "Mural by <credit>"."""
    if WORK_MEDIUM.get(category) != work["medium"]:
        return 0.0
    t, c = entry_part["title"] or "", entry_part["credit"] or ""
    s_title = sim("mural by " + c, work["title"]) if fold(t).strip() == "mural" else max(sim(t, work["title"]), token_overlap(t, work["title"]))
    cq = squash(c)
    names = [n for n in work["_names"] if len(squash(n)) >= 3]
    found = 0
    for n in names:
        nq = squash(n)
        if cq and (nq in cq or cq in nq or sim(n, c) >= 0.6 or any(sim(n, piece) >= 0.6 for piece in re.split(r",| X | and ", c))):
            found += 1
    s_credit = found / len(names) if names else 0.0
    return s_title + s_credit


# ------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--pdf", default=PDF_DEFAULT)
    ap.add_argument("--qa", action="store_true", help="render QA images into .cache/blink-map/qa/")
    ap.add_argument("--check", action="store_true", help="write nothing, print the summary")
    args = ap.parse_args()
    if not os.path.exists(args.pdf):
        raise SystemExit(f"PDF not found: {args.pdf} (download {SOURCE_URL} to .cache/blink-map/map.pdf)")
    doc, page, spans, drawings, images = read_pdf(args.pdf)
    meta = doc.metadata

    # 1 · KEY
    key = read_key(spans, drawings)
    # 2 · lists + map badges
    sections, listings, map_badges, unbadged = read_lists(spans, drawings, key)

    # merge listings by number (67 is printed in two zone lists)
    by_n = defaultdict(list)
    for l in listings:
        by_n[l["n"]].append(l)
    ns = sorted(by_n)
    if ns != list(range(1, 93)):
        raise SystemExit(f"list numbers are not 1..92: missing {sorted(set(range(1, 93)) - set(ns))}, extra {sorted(set(ns) - set(range(1, 93)))}")
    repeated = {n: [l["zone"] for l in ls] for n, ls in by_n.items() if len(ls) > 1}
    for n, ls in by_n.items():
        if len(ls) > 1:
            first = ls[0]
            for other in ls[1:]:
                if other["printed"] != first["printed"] or other["category"] != first["category"]:
                    raise SystemExit(f"number {n} is listed twice with different text")

    # 3 · pins: map badges by printed number; a category that disagrees with the list is resolved by swapping
    # with another pin in the same zone whose badge matches (the map prints 34 and 35 on each other's badge)
    pins_by_n = defaultdict(list)
    for b in map_badges:
        pins_by_n[b["n"]].append(b)
    assign = {n: [] for n in ns}
    mismatched = []
    for n in ns:
        cat = by_n[n][0]["category"]
        for p in pins_by_n.get(n, []):
            if p["category"] == cat:
                assign[n].append((p, None))
            else:
                mismatched.append((n, p))
    swaps = []
    used = set()
    for n, p in mismatched:
        cat = by_n[n][0]["category"]
        partner = [(m, q) for (m, q) in mismatched if m != n and id(q) not in used and q["category"] == cat
                   and by_n[m][0]["category"] == p["category"] and by_n[m][0]["zone"] == by_n[n][0]["zone"]]
        if len(partner) != 1:
            raise SystemExit(f"map badge {n} is a {p['category']} but list entry {n} is a {cat}, and no unique swap partner")
        m, q = partner[0]
        used.add(id(q))
        assign[n].append((q, f"the map prints {m} on this {q['category']} badge; the list gives {n} to the {cat} entry and {m} to the {p['category']} entry, so the badge shapes decide"))
        swaps.append((n, m))

    # 4 · symbols
    symbols, first_road = read_symbols(spans, drawings, key)

    # zone polygons on the map (drawn under the roads, in the zone heading colours)
    road_idx = sorted(d["i"] for d in drawings if d["type"] == "s" and same_rgb(d["stroke"], ROAD_RGB) and 8.5 < d["width"] < 9.5)
    road_median = road_idx[len(road_idx) // 2]   # the zone blocks are drawn under the roads, the zone tiles above
    zone_polys = []
    for sec in sections:
        col = tuple(int(sec["color"][i:i + 2], 16) / 255 for i in (1, 3, 5))
        for d in drawings:
            if d["i"] < road_median and d["type"] == "f" and d["x1"] < PANEL_X and same_rgb(d["fill"], col, 0.01) and d["w"] * d["h"] > 1500:
                zone_polys.append((sec["zone"], poly_of(d), d))
    lytle = [s for s in spans if ws(s["text"]) == "Lytle Park" and s["x1"] < PANEL_X]
    lytle_block = None
    if lytle:
        L = lytle[0]
        cands = [d for (z, poly, d) in zone_polys if z == "Fountain" and d["y0"] > L["y1"] and abs(d["cx"] - L["cx"]) < 60]
        lytle_block = min(cands, key=lambda d: d["y0"] - L["y1"]) if cands else None

    def zone_on_map(x, y):
        inside = [z for (z, poly, d) in zone_polys if point_in_poly(x, y, poly)]
        if inside:
            return inside[0], 0.0
        z, poly, d = min(zone_polys, key=lambda zp: dist_to_poly(x, y, zp[1]))
        dd = dist_to_poly(x, y, poly)
        return (z, round(dd, 1)) if dd <= 40 else (None, round(dd, 1))

    def in_lytle(x, y):
        d = lytle_block
        return d is not None and d["x0"] - 2 <= x <= d["x1"] + 2 and d["y0"] - 2 <= y <= d["y1"] + 2

    # 5 · georeference, pass A: streets and the bridge only
    osm = OSM(OSM_CORE)
    river = river_polygon(spans, drawings)
    river_edges = sorted(set(round(it[1].y, 2) for it in river["items"] if it[0] == "l" and abs(it[1].y - it[2].y) < 0.5 and abs(it[1].x - it[2].x) > 100))
    river_top, river_bottom = river_edges[0], river_edges[1]
    inter, ambiguous, skipped, segs, labels = intersection_controls(spans, drawings, osm, river_top, river_bottom)
    bridge, bridge_err = bridge_bank_points(spans, drawings, segs, labels, OSM_WATER, osm)
    base_controls = inter + bridge
    mA, looA, paramsA = fit(base_controls)
    for c, e in zip(base_controls, looA):
        c["loo_a_m"] = round(e, 1)

    # check: the two Covington lines labelled "8TH ST" (one is presumably 9th Street)
    cov8 = [l for l in labels if l["name"] == "8TH ST" and l["cy"] > river_bottom]
    label_checks = []
    for l in sorted(cov8, key=lambda l: l["cy"]):
        res = {}
        for street in ("8th", "9th"):
            errs = []
            for ns_name in ("WASHINGTON ST", "MADISON AVE", "SCOTT BLVD", "GREENUP ST", "GARRARD ST"):
                nsl = [m for m in labels if m["name"] == ns_name and m["cy"] > river_bottom]
                if not nsl:
                    continue
                p = intersect_chains(l["chain"], nsl[0]["chain"])
                c = osm.crossing(osm.names_for(f"{street.upper()} ST"), osm.names_for(ns_name), KY_BOX)
                if p and c:
                    errs.append(dist_m(predict(mA, *p), (c["lat"], c["lng"])))
            res[street] = (round(sum(errs) / len(errs), 1) if errs else None, len(errs))
        label_checks.append({"label": "8TH ST", "y": r1(l["cy"]), "mean_error_if_8th_m": res["8th"][0], "mean_error_if_9th_m": res["9th"][0],
                             "crossings_compared": {"8th": res["8th"][1], "9th": res["9th"][1]},
                             "about": "pass A position of this line's crossings with Washington, Madison, Scott, Greenup and Garrard vs OSM 8th or 9th Street"})

    # entries (one per number)
    works, amen = load_online()
    entries = []
    for n in ns:
        L = by_n[n][0]
        e = {"n": n, "zone": L["zone"], "category": L["category"], "title": L["parts"][0]["title"], "credit": L["parts"][0]["credit"]}
        if L["parts"][0]["detail"]:
            e["detail"] = L["parts"][0]["detail"]
        if len(L["parts"]) > 1:
            e["parts"] = L["parts"]
        elif L["parts"][0].get("inline_separator"):
            e["inline_separator"] = L["parts"][0]["inline_separator"]
        e["printed"] = L["printed"]
        e["listed_in"] = [{"zone": l["zone"], "column": l["column"], "badge_xy": [r1(l["badge"]["x"]), r1(l["badge"]["y"])]} for l in by_n[n]]
        pins = []
        for p, why in assign[n]:
            pin = {"x": r1(p["x"]), "y": r1(p["y"]), "printed_n": p["n"], "badge": p["category"]}
            if why:
                pin["matched_by"] = why
            z, dz = zone_on_map(p["x"], p["y"])
            pin["zone_on_map"] = "BLINK at Lytle Park" if in_lytle(p["x"], p["y"]) else z
            if in_lytle(p["x"], p["y"]):
                pin["inset"] = "BLINK at Lytle Park"
            pins.append(pin)
        pins.sort(key=lambda p: (p["y"], p["x"]))
        e["pins"] = pins
        if not pins:
            e["pin_note"] = "no badge with this number on the map"
        if n in repeated:
            e["quirks_listed_twice"] = repeated[n]
        e["quirks"] = sorted(set(q for l in by_n[n] for q in l["quirks"]))
        entries.append(e)
    E = {e["n"]: e for e in entries}
    for n, m in swaps:
        E[n]["quirks"].append(f"the map badge for this entry is printed \"{m}\" (numbers {min(n, m)} and {max(n, m)} are swapped on the map)")
    for n, zones in repeated.items():
        E[n]["quirks"].append("listed in two zone lists (" + " and ".join(zones) + ") with the same text; one pin in each zone")
        E[n].pop("quirks_listed_twice", None)
    for e in entries:
        e["area"] = "BLINK at Lytle Park" if e["pins"] and all(p.get("inset") for p in e["pins"]) else None

    # 6 · match entries to BLINK's online map works (title/credit first, then location for the rest)
    for e in entries:
        for p in e["pins"]:
            la, lo = predict(mA, p["x"], p["y"])
            p["_a"] = (la, lo)
    cands = []
    for e in entries:
        if e["category"] not in WORK_MEDIUM:
            continue
        for part_i, part in enumerate(e.get("parts") or [{"title": e["title"], "credit": e["credit"]}]):
            for w in works:
                s = text_score(part, e["category"], w)
                if s >= 0.5:
                    cands.append((round(s, 4), e["n"], part_i, w["id"]))
    cands.sort(key=lambda c: (-c[0], c[1], c[3]))
    matched_e, matched_w = defaultdict(list), {}
    for s, n, part_i, wid in cands:
        if wid in matched_w or any(pi == part_i for (_, pi, _) in matched_e[n]):
            continue
        matched_w[wid] = n
        matched_e[n].append((wid, part_i, {"method": "title/credit", "score": s}))
    W = {w["id"]: w for w in works}
    zone_online = {z: online for _, z, online in ZONES}
    # location stage: a remaining entry and a remaining work of the same category in the same zone, mutually nearest
    left_e = [e for e in entries if e["category"] in WORK_MEDIUM and not matched_e[e["n"]] and e["pins"]]
    left_w = [w for w in works if w["id"] not in matched_w and w.get("lat") is not None]
    pairs = []
    for e in left_e:
        for w in left_w:
            if WORK_MEDIUM[e["category"]] != w["medium"] or w["zone"] not in zone_online[e["zone"]]:
                continue
            d = min(dist_m(p["_a"], (w["lat"], w["lng"])) for p in e["pins"])
            if d <= LOCATION_MATCH_M:
                pairs.append((round(d, 3), e["n"], w["id"]))
    pairs.sort()
    for d, n, wid in pairs:
        if wid in matched_w or matched_e[n]:
            continue
        matched_w[wid] = n
        matched_e[n].append((wid, 0, {"method": "location", "distance_a_m": round(d)}))

    disagreements = []
    for e in entries:
        ms = []
        for wid, part_i, how in matched_e[e["n"]]:
            w = W[wid]
            m = {"work_id": wid, "online_title": w["title"], "online_zone": w["zone"], "method": how["method"]}
            if len(e.get("parts") or []) > 1:
                m["part"] = part_i
            if w.get("lat") is None:
                m["online_lat"] = m["online_lng"] = None
                m["note"] = "BLINK's online map gives no coordinates for this work"
            else:
                m["online_lat"], m["online_lng"] = w["lat"], w["lng"]
                d = min(dist_m(p["_a"], (w["lat"], w["lng"])) for p in e["pins"]) if e["pins"] else None
                m["distance_pass_a_m"] = round(d) if d is not None else None
                if d is not None and d > AGREE_M:
                    disagreements.append({"n": e["n"], "work_id": wid, "distance_m": round(d), "method": how["method"]})
            if w["zone"] not in zone_online[e["zone"]]:
                m["zone_differs"] = f"the PDF lists this under {e['zone']}; BLINK's online map puts it in {w['zone']}"
            ms.append(m)
        e["online_match"] = ms
    unmatched_works = []
    for w in works:
        if w["id"] in matched_w:
            continue
        rec = {"work_id": w["id"], "title": w["title"], "zone": w["zone"], "medium": w["medium"]}
        if w.get("lat") is not None:
            near = min(((dist_m(p["_a"], (w["lat"], w["lng"])), e["n"]) for e in entries for p in e["pins"]), default=None)
            rec["nearest_pin"] = {"n": near[1], "distance_m": round(near[0])}
        unmatched_works.append(rec)

    # amenities: Oasis Stations by name, restrooms by nearest symbol (one to one)
    amen_matches = []
    oasis = [a for a in amen if a.get("category") == "Oasis Station" or a["name"].startswith("Oasis Station")]
    for e in entries:
        if e["category"] != "Oasis Station":
            continue
        best = max(oasis, key=lambda a: sim(e["title"].replace("Oasis Station:", ""), re.sub(r"^Oasis Station - |\(.*\)", "", a["name"])))
        d = dist_m(e["pins"][0]["_a"], (best["lat"], best["lng"])) if e["pins"] else None
        e["online_match"] = [{"place_id": best["id"], "online_title": best["name"], "online_lat": best["lat"], "online_lng": best["lng"],
                              "method": "title", "distance_pass_a_m": round(d) if d is not None else None}]
        amen_matches.append(("entry", e["n"], best, d))
    rest_syms = [s for s in symbols if s["kind"] == "restroom"]
    for s in rest_syms:
        s["_a"] = predict(mA, s["x"], s["y"])
    rest_online = [a for a in amen if a.get("amenity_type") == "restroom" and not a["name"].startswith("Oasis")]
    rp = sorted((round(dist_m(s["_a"], (a["lat"], a["lng"])), 3), si, a["id"]) for si, s in enumerate(rest_syms) for a in rest_online)
    used_s, used_a = set(), set()
    for d, si, aid in rp:
        if si in used_s or aid in used_a or d > AGREE_M:
            continue
        used_s.add(si)
        used_a.add(aid)
        a = next(x for x in rest_online if x["id"] == aid)
        rest_syms[si]["online_match"] = {"place_id": aid, "online_lat": a["lat"], "online_lng": a["lng"], "details": a.get("details"), "distance_pass_a_m": round(d)}
        amen_matches.append(("symbol", si, a, d))
    unmatched_restrooms = [a["id"] for a in rest_online if a["id"] not in used_a]

    # 7 · pass B: add BLINK's online coordinates where pass A agrees (title/credit matches only; not the inset)
    extra = []
    for e in entries:
        if len(e["pins"]) != 1 or e["pins"][0].get("inset"):
            continue
        p = e["pins"][0]
        for m in e.get("online_match", []):
            if m.get("online_lat") is None or m["method"] == "location" or (m.get("distance_pass_a_m") or 0) > AGREE_M:
                continue
            if len(e.get("parts") or []) > 1:
                continue
            extra.append({"id": f"online-{m.get('work_id') or m.get('place_id')}", "kind": "online-map",
                          "label": f"#{e['n']} {e['title']} ↔ {m['online_title']}", "x": p["x"], "y": p["y"],
                          "lat": m["online_lat"], "lng": m["online_lng"], "source": "BLINK online map (data/works.json or research/blink-art/places.json)"})
    # (restroom symbols are matched to BLINK's online restrooms by proximity only, so, like location-only work
    # matches, they are a check on the result and never a control point)
    controls = base_controls + extra
    mB, looB, paramsB = fit(controls)
    for c, e in zip(controls, looB):
        c["loo_m"] = round(e, 1)

    # approx_m: a local error from the leave-one-out residuals of nearby control points (same kernel),
    # scaled so that it covers ~90% of the pass-B residuals of the online-map control points.
    kernel_pts = [(c["x"], c["y"], c["loo_m"]) for c in controls]

    def local_err(x, y, skip_xy=None):
        num = den = 0.0
        for (px, py, e) in kernel_pts:
            if skip_xy and abs(px - skip_xy[0]) < 0.01 and abs(py - skip_xy[1]) < 0.01:
                continue
            w = 1.0 / ((px - x) ** 2 + (py - y) ** 2 + paramsB["s_pt"] ** 2) ** paramsB["alpha"]
            num += w * e * e
            den += w
        return math.sqrt(num / den)

    online_cps = [c for c in controls if c["kind"] == "online-map"]
    ratios = sorted(c["loo_m"] / max(local_err(c["x"], c["y"], (c["x"], c["y"])), 1.0) for c in online_cps)
    k90 = quantile(ratios, 0.9) if ratios else 2.0
    FLOOR = 15.0

    def approx(x, y, inset=False, skip_xy=None):
        a = max(FLOOR, k90 * local_err(x, y, skip_xy))
        if inset and lytle_block is not None:
            # the inset stacks four badges in one park-sized block: at least the block's half-diagonal
            half = 0.5 * math.hypot(lytle_block["w"], lytle_block["h"]) * mB.local_scale(lytle_block["cx"], lytle_block["cy"])
            a = max(a, half)
        return int(math.ceil(a / 5.0) * 5)

    coverage = sum(1 for c in online_cps if c["loo_m"] <= approx(c["x"], c["y"], skip_xy=(c["x"], c["y"]))) if online_cps else 0
    for e in entries:
        for p in e["pins"]:
            la, lo = predict(mB, p["x"], p["y"])
            p["lat"], p["lng"] = round(la, 6), round(lo, 6)
            p["approx_m"] = approx(p["x"], p["y"], bool(p.get("inset")))
            p["m_per_pt"] = round(mB.local_scale(p["x"], p["y"]), 2)
            p.pop("_a", None)
        for m in e.get("online_match", []):
            if m.get("online_lat") is not None and e["pins"]:
                m["distance_final_m"] = round(min(dist_m((p["lat"], p["lng"]), (m["online_lat"], m["online_lng"])) for p in e["pins"]))

    # symbols: add the numbered ones (drone viewing = 67, merch = 45), then georeference all
    for n, kind in ((67, "drone-viewing"), (45, "merch-shop")):
        for p in E[n]["pins"]:
            symbols.append({"kind": kind, "label": E[n]["title"], "entry": n, "x": p["x"], "y": p["y"]})
    out_symbols = []
    for s in symbols:
        la, lo = predict(mB, s["x"], s["y"])
        rec = {"kind": s["kind"], "label": s["label"]}
        if "entry" in s:
            rec["entry"] = s["entry"]
        rec.update({"x": r1(s["x"]), "y": r1(s["y"]), "lat": round(la, 6), "lng": round(lo, 6), "approx_m": approx(s["x"], s["y"])})
        z, dz = zone_on_map(s["x"], s["y"])
        rec["zone_on_map"] = z
        for k in ("shape", "bbox", "label_bbox"):
            if k in s:
                rec[k] = s[k]
        if "line" in s:
            rec["line"] = [{"x": x, "y": y, "lat": round(predict(mB, x, y)[0], 6), "lng": round(predict(mB, x, y)[1], 6)} for x, y in s["line"]]
        if s.get("online_match"):
            m = dict(s["online_match"])
            m["distance_final_m"] = round(dist_m((la, lo), (m["online_lat"], m["online_lng"])))
            rec["online_match"] = m
        if s["kind"] == "drone-show":
            rec["label_distance_pt"] = s["label_distance_pt"]
        out_symbols.append(rec)
    kind_order = ["opening-ceremony", "drone-show", "drone-viewing", "hospitality-zone", "merch-shop", "restroom", "food-drinks", "hike-departure"]
    out_symbols.sort(key=lambda s: (kind_order.index(s["kind"]), s["y"], s["x"]))

    # zones
    zones_out = []
    for sec in sections:
        nums = sorted(set(l["n"] for l in listings if l["zone"] == sec["zone"]))
        sp = dict(ZONE_SPONSORS[sec["zone"]])
        pb = [s for s in spans if ws(s["text"]) == "PRESENTED BY" and sec["y0"] - 6 <= s["y0"] <= sec["y0"] + 12 and s["x0"] > PANEL_X]
        if not pb:
            raise SystemExit(f"PRESENTED BY missing for {sec['zone']}")
        pbs = pb[0]
        logo_box = (pbs["x0"] - 50, pbs["y1"], 810, pbs["y1"] + 30)
        imgs = [im for im in images if im["bbox"][0] < logo_box[2] and im["bbox"][2] > logo_box[0] and im["bbox"][1] < logo_box[3] and im["bbox"][3] > logo_box[1]]
        vec = [d for d in drawings if d["fill"] and d["fill"] != (1.0, 1.0, 1.0) and logo_box[0] <= d["x0"] and d["x1"] <= logo_box[2] and logo_box[1] - 12 <= d["y0"] and d["y1"] <= logo_box[3]]
        if not imgs and not vec:
            raise SystemExit(f"no logo drawn after PRESENTED BY for {sec['zone']}")
        sp["logo_drawn_as"] = "raster image" if imgs else "vector paths"
        zones_out.append({"zone": sec["zone"], "heading": sec["heading"], "color": sec["color"], "numbers": nums,
                          "online_map_zones": sec["online_zones"], "sponsor": sp, "heading_bbox": sec["heading_bbox"]})
    if lytle_block is not None:
        sup = [s for s in spans if ws(s["text"]) == "with support from" and s["x1"] < PANEL_X]
        imgs = [im for im in images if lytle_block["x0"] - 20 <= im["bbox"][0] <= lytle_block["x1"] and lytle_block["y0"] - 30 <= im["bbox"][1] <= lytle_block["y0"]]
        sp = dict(ZONE_SPONSORS["BLINK at Lytle Park"])
        sp["logo_drawn_as"] = "raster emblem + vector wordmark" if imgs else "vector paths"
        if not sup:
            raise SystemExit("'with support from' missing at Lytle Park")
        zones_out.append({"zone": "BLINK at Lytle Park", "heading": "BLINK at Lytle Park", "part_of": "Fountain",
                          "color": zones_out[[z["zone"] for z in zones_out].index("Fountain")]["color"],
                          "numbers": sorted(e["n"] for e in entries if e["area"] == "BLINK at Lytle Park"),
                          "online_map_zones": ["BLINK at Lytle Park"], "sponsor": sp,
                          "inset_block": [r1(lytle_block["x0"]), r1(lytle_block["y0"]), r1(lytle_block["x1"]), r1(lytle_block["y1"])]})
    zone_sponsors = {z["zone"]: z["sponsor"] for z in zones_out}

    # tidy entries
    for e in entries:
        if e["area"] is None:
            e.pop("area")
        if not e["quirks"]:
            e.pop("quirks")
        if not e.get("online_match"):
            e.pop("online_match", None)

    # summaries
    by_zone = Counter(e["zone"] for e in entries)
    by_cat = Counter(e["category"] for e in entries)
    by_zone_cat = defaultdict(Counter)
    for e in entries:
        by_zone_cat[e["zone"]][e["category"]] += 1
    stats = lambda v: {"n": len(v), "median_m": round(quantile(v, 0.5), 1), "p90_m": round(quantile(v, 0.9), 1), "max_m": round(max(v), 1)} if v else {"n": 0}
    val_a = [m["distance_pass_a_m"] for e in entries for m in e.get("online_match", []) if m.get("distance_pass_a_m") is not None and "work_id" in m and m["method"] != "location"]
    val_a_all = [m["distance_pass_a_m"] for e in entries for m in e.get("online_match", []) if m.get("distance_pass_a_m") is not None]
    by_zone_stats = {}
    for z in [z for _, z, _ in ZONES] + ["BLINK at Lytle Park"]:
        va = [m["distance_pass_a_m"] for e in entries for m in e.get("online_match", [])
              if (e.get("area") == z or (e["zone"] == z and e.get("area") is None)) and m.get("distance_pass_a_m") is not None and m["method"] != "location"]
        lb = [c["loo_m"] for c in controls if c["kind"] == "online-map" and any(
              ("#%d " % e["n"]) in c["label"] and (e.get("area") == z or (e["zone"] == z and e.get("area") is None)) for e in entries)]
        by_zone_stats[z] = {"pass_a_vs_online": stats(va), "pass_b_loo_online_controls": stats(lb),
                            "approx_m_median": quantile([p["approx_m"] for e in entries for p in e["pins"] if (e.get("area") == z or (e["zone"] == z and e.get("area") is None))], 0.5)}
    georef = {
        "method": "moving least squares, affine (a weighted local affine fit at every point); weights 1/(d² + s²)^alpha with d in PDF points; alpha and s chosen by leave-one-out on each control set",
        "frame": f"local equirectangular metres about {LAT0}, {LNG0}",
        "osm_timestamp": osm.timestamp,
        "pass_a": {"about": "street intersections and the bridge banks only (independent of BLINK's online map)", "params": paramsA,
                   "controls": len(base_controls), "loo": stats(looA)},
        "pass_b": {"about": "pass A plus BLINK online-map coordinates that pass A put within %d m" % AGREE_M, "params": paramsB,
                   "controls": len(controls), "loo": stats(looB), "loo_intersections": stats([c["loo_m"] for c in controls if c["kind"] != "online-map"]),
                   "loo_online_map": stats([c["loo_m"] for c in controls if c["kind"] == "online-map"])},
        "validation_pass_a_vs_online_map": {"about": "pass A pin vs BLINK's online-map coordinates, works matched by title or credit (independent check)",
                                            **stats(val_a), "all_matches_incl_location_and_oasis": stats(val_a_all)},
        "approx_m": {"about": "per pin: max(%d, k × kernel-weighted RMS of nearby leave-one-out residuals); k = the 90th percentile ratio on the online-map control points; the Lytle Park inset pins get at least the inset block's half-diagonal" % FLOOR,
                     "k": round(k90, 3), "floor_m": FLOOR, "coverage_online_map": f"{coverage} of {len(online_cps)} online-map control points have a pass-B leave-one-out residual within approx_m"},
        "by_zone": by_zone_stats,
        "restroom_symbols_vs_online_map": {"about": "restroom symbols matched to BLINK's online restrooms by proximity (one to one, ≤ %d m); a check only, never a control point" % AGREE_M,
                                           **stats([s["online_match"]["distance_pass_a_m"] for s in rest_syms if s.get("online_match")]),
                                           "unmatched_online_restrooms": unmatched_restrooms},
        "disagreements_over_150m": disagreements,
        "label_checks": label_checks,
        "bridge": bridge_err or "ok",
        "skipped_intersections": skipped,
        "ambiguous_intersections": ambiguous,
        "control_points": [{k: (r1(v) if k in ("x", "y") else round(v, 6) if k in ("lat", "lng") else v) for k, v in c.items()} for c in controls],
    }

    notes = [
        "Numbers, titles, credits and categories come from the PDF's text layer and vector drawings; nothing was typed in by hand except the zone sponsor names, which are logos (pictures) and were read off the rendered PDF.",
        "title = the bold run next to the badge, credit = the medium-weight run under it (or after the dash on a 'Title – Artist' line). Medium runs that name a place, a schedule or a descriptor (starting 'at ', 'Shows ' or '(') are kept in `detail` instead of `credit`.",
        "printed = the entry's lines exactly as printed, after writing the PDF ligatures ﬁ/ﬂ as plain letters and collapsing runs of spaces. No line in this edition ends in a hyphen.",
        "Categories are the KEY's names. Each badge is classified by its shape's fill colour against the KEY icons; the two black badges (Oasis Station drop, merch-shop eye) by their aspect ratio. Map and list badges agree for every number except the 34/35 swap noted on those entries.",
        "Pins are the centres of the badge shapes on the map (x, y in PDF points, origin top left, page 810 × 1584). The map is schematic: badges sit next to what they mark, streets are straightened and the scale changes across the map (m_per_pt).",
        "lat/lng come from the pass-B transform. approx_m is a ~90% radius for the pin's real location; for works that BLINK's online map also places, prefer the online coordinates in online_match (online_lat/online_lng).",
        "Entry 67 (Drone Show Viewing Area) is printed in The Banks list and in the Covington list; it is one entry with two pins (Smale Riverfront Park and Covington Landing). Its zone is the first list it appears in.",
        "Entries 55-58 are printed in the Fountain Zone list; on the map they sit in the 'BLINK at Lytle Park' inset block, so they carry area 'BLINK at Lytle Park'.",
        "Symbol kind 'drone-show' (not in the KEY) marks the dotted rings where the drone shows fly: over the river (Fri-Sun) and next to TQL Stadium (the opening-ceremony drone show). 'drone-viewing' marks the two badges numbered 67.",
        "Map street labels printed with extra spaces ('RACE  ST', 'VINE   ST') are normalized. The lower of the two Covington lines labelled '8TH ST' fits 9th Street (see georeference.label_checks) and is not used as a control point; neither is the upper one, since the two labels make both ambiguous.",
    ]
    out = {
        "source_url": SOURCE_URL,
        "extracted": EXTRACTED,
        "pdf": {"title": meta.get("title"), "creator": meta.get("creator"), "created": meta.get("creationDate"), "modified": meta.get("modDate"),
                "page_pt": [810, 1584], "copy": ".cache/blink-map/map.pdf (not in the repo)"},
        "key": [{"category": k, "label": v["label"], "description": v["description"], "icon_fill": hexcol(v["fill"]), "icon_bbox": v["bbox"]} for k, v in key.items()],
        "counts": {"entries": len(entries), "by_zone": dict(by_zone), "by_category": dict(by_cat),
                   "by_zone_and_category": {z: dict(c) for z, c in by_zone_cat.items()},
                   "pins": sum(len(e["pins"]) for e in entries), "entries_without_pin": [e["n"] for e in entries if not e["pins"]],
                   "list_badges": len(listings), "map_badges": len(map_badges),
                   "numbers_without_a_badge": [{"text": u["span"]["text"].strip(), "x": r1(u["span"]["cx"]), "y": r1(u["span"]["cy"]),
                                                "why": "interstate shield (not a KEY badge)"} for u in sorted(unbadged, key=lambda u: (u["span"]["cy"], u["span"]["cx"]))],
                   "symbols": dict(Counter(s["kind"] for s in out_symbols)),
                   "online_map": {"works_on_online_map": len(works), "matched_title_credit": sum(1 for e in entries for m in e.get("online_match", []) if m.get("method") == "title/credit"),
                                  "matched_location_only": sum(1 for e in entries for m in e.get("online_match", []) if m.get("method") == "location"),
                                  "unmatched_online_works": len(unmatched_works), "unmatched_online_restrooms": unmatched_restrooms}},
        "zones": zones_out,
        "zone_sponsors": zone_sponsors,
        "entries": entries,
        "symbols": out_symbols,
        "unmatched_online_works": unmatched_works,
        "georeference": georef,
        "notes": notes,
    }
    # hard checks
    assert len(entries) == 92 and [e["n"] for e in entries] == list(range(1, 93))
    assert len(listings) == 92 + sum(len(v) - 1 for v in repeated.values()), "a list badge was missed"
    assert all(e["pins"] for e in entries), "a list number has no badge on the map"
    assert sum(len(e["pins"]) for e in entries) == len(map_badges), "a map badge was not assigned"
    assert all(e["category"] in BADGE_CATEGORIES for e in entries)
    assert all(e["title"] for e in entries)

    text = json.dumps(out, ensure_ascii=False, indent=1) + "\n"
    if not args.check:
        os.makedirs(os.path.dirname(OUT), exist_ok=True)
        with open(OUT, "w", encoding="utf-8") as f:
            f.write(text)
    # console summary
    print(f"entries {len(entries)} · pins {out['counts']['pins']} · symbols {dict(Counter(s['kind'] for s in out_symbols))}")
    for z in zones_out:
        print(f"  {z['zone']:22s} {len(z['numbers']):3d}  {dict(by_zone_cat[z['zone']]) if z['zone'] in by_zone_cat else 'inset: ' + str(z['numbers'])}")
    print(f"  by category: {dict(by_cat)}")
    print(f"pass A: {len(base_controls)} controls, alpha={paramsA['alpha']} s={paramsA['s_pt']}, LOO median {quantile(looA, .5):.1f} m, p90 {quantile(looA, .9):.1f} m, max {max(looA):.1f} m")
    print(f"pass B: {len(controls)} controls, alpha={paramsB['alpha']} s={paramsB['s_pt']}, LOO median {quantile(looB, .5):.1f} m, p90 {quantile(looB, .9):.1f} m, max {max(looB):.1f} m")
    if val_a:
        print(f"validation (pass A vs online map, {len(val_a)} works): median {quantile(val_a, .5):.0f} m, p90 {quantile(val_a, .9):.0f} m, max {max(val_a):.0f} m")
    print(f"disagreements > {AGREE_M:.0f} m: {disagreements}")
    print(f"approx_m k={k90:.2f}, coverage {coverage}/{len(online_cps)}")
    print(("checked, nothing written" if args.check else f"wrote {os.path.relpath(OUT, ROOT)} ({len(text.encode()):,} bytes)"))
    if args.qa:
        render_qa(page, out, controls, osm, segs, labels)


# ------------------------------------------------------------------ QA renders (--qa)
def render_qa(page, out, controls, osm, segs, labels):
    from PIL import Image, ImageDraw
    os.makedirs(QA_DIR, exist_ok=True)

    def crop(name, rect, zoom):
        pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=pymupdf.Rect(*rect))
        pix.save(os.path.join(QA_DIR, name))
    crop("key.png", (550, 30, 805, 110), 5)
    for z in out["zones"]:   # the sponsor logos (pictures, read by eye)
        if z["zone"] == "BLINK at Lytle Park":
            b = z["inset_block"]
            crop("sponsor-blink-at-lytle-park.png", (b[0] - 15, b[1] - 52, b[2] + 10, b[1] + 2), 8)
        else:
            hb = z["heading_bbox"]
            crop(f"sponsor-{slug(z['zone'])}.png", (hb[2] + 5, hb[1] - 5, 805, hb[3] + 12), 8)
    for z in out["zones"]:
        if z["zone"] == "BLINK at Lytle Park":
            b = z["inset_block"]
            crop("map-lytle-inset.png", (b[0] - 20, b[1] - 60, b[2] + 10, b[3] + 5), 8)
            continue
        hb = z["heading_bbox"]
        ys = [l["badge_xy"][1] for e in out["entries"] for l in e["listed_in"] if l["zone"] == z["zone"]]
        crop(f"list-{slug(z['zone'])}.png", (550, hb[1] - 8, 805, max(ys) + 22), 4)
    for name, rect in (("map-findlay-otr", (20, 120, 360, 540)), ("map-fountain", (50, 520, 560, 870)),
                       ("map-banks", (60, 860, 460, 1170)), ("map-covington", (60, 1110, 480, 1490))):
        crop(name + ".png", rect, 3)
    # overlay: control points (red crosses) and pins (numbers) on the map
    zoom = 2.5
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=pymupdf.Rect(0, 60, 545, 1584))
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    dr = ImageDraw.Draw(img)
    P = lambda x, y: ((x - 0) * zoom, (y - 60) * zoom)
    for c in controls:
        x, y = P(c["x"], c["y"])
        col = (220, 0, 0) if c["kind"] != "online-map" else (0, 140, 255)
        dr.line([x - 7, y, x + 7, y], fill=col, width=3)
        dr.line([x, y - 7, x, y + 7], fill=col, width=3)
    for s in out["symbols"]:
        x, y = P(s["x"], s["y"])
        dr.ellipse([x - 9, y - 9, x + 9, y + 9], outline=(255, 120, 0), width=3)
    img.save(os.path.join(QA_DIR, "overlay-controls.png"))
    # georeference plot: OSM roads, predicted pins, BLINK online-map positions
    S = 1.2  # px per metre
    E0, N0 = to_m(39.1185, -84.5245)
    E1, N1 = to_m(39.0800, -84.5015)
    Wpx, Hpx = int((E1 - E0) * S), int((N0 - N1) * S)
    im = Image.new("RGB", (Wpx, Hpx), (255, 255, 255))
    d = ImageDraw.Draw(im)
    T = lambda la, lo: ((to_m(la, lo)[0] - E0) * S, (N0 - to_m(la, lo)[1]) * S)
    for w in osm.ways:
        hw = w["tags"].get("highway")
        if hw not in ("primary", "secondary", "tertiary", "residential", "unclassified", "pedestrian", "trunk"):
            continue
        pts = [T(g["lat"], g["lon"]) for g in w["geometry"]]
        if all(p[0] < 0 or p[0] > Wpx or p[1] < 0 or p[1] > Hpx for p in pts):
            continue
        d.line(pts, fill=(200, 200, 200), width=2)
    for c in controls:
        x, y = T(c["lat"], c["lng"])
        d.line([x - 4, y, x + 4, y], fill=(220, 0, 0), width=1)
        d.line([x, y - 4, x, y + 4], fill=(220, 0, 0), width=1)
    colors = {"Projections": (163, 35, 143), "Murals": (0, 148, 217), "Light Installations": (128, 173, 51), "Unique Attractions": (230, 180, 0),
              "Oasis Station": (0, 0, 0), "Official BLINK Merch Shop": (80, 80, 80)}
    for e in out["entries"]:
        for p in e["pins"]:
            x, y = T(p["lat"], p["lng"])
            for m in e.get("online_match", []):
                if m.get("online_lat") is not None:
                    ox, oy = T(m["online_lat"], m["online_lng"])
                    d.line([x, y, ox, oy], fill=(255, 0, 0), width=1)
                    d.rectangle([ox - 2, oy - 2, ox + 2, oy + 2], fill=(0, 0, 0))
            r = p["approx_m"] * S
            d.ellipse([x - r, y - r, x + r, y + r], outline=(230, 230, 230))
            d.ellipse([x - 5, y - 5, x + 5, y + 5], fill=colors[e["category"]])
            d.text((x + 6, y - 6), str(e["n"]), fill=(0, 0, 0))
    for s in out["symbols"]:
        x, y = T(s["lat"], s["lng"])
        d.rectangle([x - 3, y - 3, x + 3, y + 3], outline=(255, 120, 0))
    im.save(os.path.join(QA_DIR, "georef-plot.png"))
    print(f"QA images in {os.path.relpath(QA_DIR, ROOT)}/")


if __name__ == "__main__":
    main()
