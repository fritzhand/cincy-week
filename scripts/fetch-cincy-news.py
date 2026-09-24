#!/usr/bin/env python3
"""
scripts/fetch-cincy-news.py · OWNER: Agent G (home, programs & info)

Fetch VETTED news coverage of the week (Cincinnati Art Week, StartupCincy Week, BLINK,
the FotoFocus Biennial) and merge it into data/news.json for news.html, the home ticker
and the program pages. Ported from fritzhand/startup-india-guide scripts/fetch-india-news.py.

Trust model (same as SIG): Google News RSS gives DISCOVERY, an ALLOWLIST of outlets gives
VETTING, and a program KEYWORD in the headline gives RELEVANCE. Anything off the list, or
not about one of the programs, is dropped. Every headline links to its publisher.

Pipeline:
  1. Query Google News RSS (US edition) for each program query (recent items only).
  2. Keep items whose <source> (or publisher domain) is allowlisted, and whose headline
     names a program; tag the item with those programs.
  3. Resolve each Google News redirect to the publisher URL (batchexecute), INCREMENTALLY:
     items already in data/news.json are never re-resolved (keyed by gnId and by URL).
  4. Merge into data/news.json: every existing (curated) item is kept as it is; new items
     are added when their URL (normalized) and headline are new. Newest first.

Rules the build enforces (build/core/schema.mjs), applied here so a refresh never breaks it:
  plain text only (HTML entities unescaped, tags stripped), https links only, no placeholder
  words ("TBA"), ids ^[a-z0-9][a-z0-9-]*$ and unique. Fetched items carry summary: null: the
  one-line summaries on the site are the guide's own, written for curated items only.

Never crashes offline: a failed query is skipped; if nothing could be fetched, data/news.json
is left untouched and the script exits 0 (the refresh workflow then has nothing to commit).

Stdlib only (urllib + xml + zoneinfo), so it runs in CI with no pip install.
  python3 scripts/fetch-cincy-news.py            # fetch + merge
  python3 scripts/fetch-cincy-news.py --dry-run  # fetch, print what would change, write nothing
  python3 scripts/fetch-cincy-news.py --offline  # no network: normalize + re-sort the file only
"""
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path
from xml.etree import ElementTree as ET

try:
    from zoneinfo import ZoneInfo
    NY = ZoneInfo("America/New_York")
except Exception:  # pragma: no cover - very old Pythons
    NY = timezone(timedelta(hours=-4))

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "news.json"

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
GN = "https://news.google.com/rss/search?hl=en-US&gl=US&ceid=US:en&q="
RECENCY = "when:60d"      # Google News recency window appended to each query
PER_QUERY_CAP = 25        # at most this many allowlisted items per query
MAX_NEW = 60              # at most this many new items per run
MAX_AGE_DAYS = 120        # ignore anything older than this
TIMEOUT = 20

# ── Queries (relevance) ───────────────────────────────────────────────────────
QUERIES = [
    '"StartupCincy Week"',
    '"StartupCincy" OR "Startup Cincy"',
    'Cintrifuse startup Cincinnati',
    '"BLINK" Cincinnati light festival',
    '"BLINK 2026" OR "BLINK Cincinnati"',
    '"Cincinnati Art Week"',
    '"Cincy Nice" art',
    '"FotoFocus"',
    '"FotoFocus Biennial" OR "The Long View" FotoFocus',
]

# ── Relevance: a program keyword must appear in the headline (lowercase "contains") ──
KEYWORDS = {
    "scw": ["startupcincy", "startup cincy", "cintrifuse"],
    "blink": ["blink"],
    "caw": ["cincinnati art week", "cincy art week", "cincy nice"],
    "fotofocus": ["fotofocus"],
}
# "blink" is also an ordinary word: keep it only when capitalized as the festival's name ("BLINK", "Blink")
# and not one of the usual other meanings.
BLINK_NOT = re.compile(r"blink of an eye|blink-182|blink (camera|doorbell|fitness|health|charging)", re.I)

# ── Allowlist (vetting): label, substrings of the GN <source> text, publisher domains ──
# Labels match the source names already used in data/news.json so the source menu stays tidy.
ALLOWLIST = [
    ("The Cincinnati Enquirer", ["cincinnati enquirer", "cincinnati.com"], ["cincinnati.com"]),
    ("WCPO 9", ["wcpo"], ["wcpo.com"]),
    ("WLWT", ["wlwt"], ["wlwt.com"]),
    ("WKRC Local 12", ["local 12", "wkrc", "local12"], ["local12.com"]),
    ("FOX19 NOW (WXIX)", ["fox19", "fox 19", "wxix"], ["fox19.com"]),
    ("WVXU", ["wvxu"], ["wvxu.org"]),
    ("Cincinnati CityBeat", ["citybeat"], ["citybeat.com"]),
    ("Cincinnati Magazine", ["cincinnati magazine"], ["cincinnatimagazine.com"]),
    ("Soapbox Cincinnati", ["soapbox"], ["soapboxmedia.com"]),
    ("Movers & Makers", ["movers & makers", "movers and makers", "moversmakers"], ["moversmakers.org"]),
    ("Cincinnati Business Courier", ["business courier", "bizjournals"], ["bizjournals.com"]),
    ("Axios Cincinnati", ["axios"], ["axios.com"]),
    ("LINK nky", ["link nky", "linknky"], ["linknky.com"]),
    ("NKyTribune", ["nkytribune", "northern kentucky tribune"], ["nkytribune.com"]),
    ("The River City News", ["river city news"], ["rcnky.com"]),
    ("Cincinnati Herald", ["cincinnati herald"], ["thecincinnatiherald.com"]),
    ("Spectrum News 1", ["spectrum news"], ["spectrumnews1.com"]),
    ("Dayton Daily News", ["dayton daily news"], ["daytondailynews.com"]),
    ("The Columbus Dispatch", ["columbus dispatch"], ["dispatch.com"]),
    ("University of Cincinnati News", ["university of cincinnati"], ["uc.edu"]),
    ("Aperture", ["aperture"], ["aperture.org"]),
    ("Hyperallergic", ["hyperallergic"], ["hyperallergic.com"]),
    ("ARTnews", ["artnews"], ["artnews.com"]),
    ("BLINK Newsroom", ["blink cincinnati", "blinkcincinnati"], ["blinkcincinnati.com"]),
    ("FotoFocus", ["fotofocus"], ["fotofocus.org"]),
    ("StartupCincy", ["startupcincy"], ["startupcincy.com", "startupcincyweek.com"]),
    ("Cintrifuse", ["cintrifuse"], ["cintrifuse.com"]),
    ("Visit Cincy", ["visit cincy", "visitcincy"], ["visitcincy.com"]),
    ("City of Covington", ["covingtonky.gov", "city of covington"], ["covingtonky.gov"]),
    ("Cincinnati Metro", ["go-metro", "cincinnati metro"], ["go-metro.com"]),
]
# listings and calendars are not stories
SKIP_TITLE = re.compile(r"^(cincinnati enquirer events|events? calendar)\b|\bthings to do this weekend\b", re.I)

PLACEHOLDER_WORD = re.compile(r"\b(?:TBA|TBD|TBC|lorem ipsum)\b", re.I)
HTML_IN_TEXT = re.compile(r"</?[a-zA-Z][^>]*>|&(?:[a-zA-Z][a-zA-Z0-9]{1,31}|#\d{1,7}|#x[0-9a-fA-F]{1,6});")
TRACKING = re.compile(r"^(utm_|fbclid$|gclid$|mc_|ocid$|cmpid$)")


def log(*a):
    print(*a, file=sys.stderr)


def fetch(url, timeout=TIMEOUT, data=None, headers=None):
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "ignore")


def plain(s):
    """Plain text: unescape entities (twice: feeds double-escape), strip tags, collapse spaces."""
    s = html.unescape(html.unescape(s or ""))
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def slug(s, n=60):
    s = re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")
    return s[:n].strip("-")


def norm_title(t):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", (t or "").lower())).strip()


def norm_url(u):
    """Compare URLs without scheme case, www., tracking parameters, fragments or a trailing slash."""
    try:
        p = urllib.parse.urlsplit((u or "").strip())
    except ValueError:
        return u or ""
    host = p.netloc.lower().removeprefix("www.")
    q = urllib.parse.urlencode([(k, v) for k, v in urllib.parse.parse_qsl(p.query, keep_blank_values=True) if not TRACKING.match(k)])
    path = p.path.rstrip("/") or "/"
    return f"{host}{path}{'?' + q if q else ''}"


def host_of(u):
    try:
        return urllib.parse.urlsplit(u).netloc.lower().removeprefix("www.")
    except ValueError:
        return ""


def match_source(source_text, source_url=""):
    s, h = (source_text or "").lower(), host_of(source_url)
    for label, needles, domains in ALLOWLIST:
        if any(n in s for n in needles) or any(h == d or h.endswith("." + d) for d in domains):
            return label
    return None


def programs_in(title):
    t = title.lower()
    out = [p for p, words in KEYWORDS.items() if any(w in t for w in words)]
    if "blink" in out and (BLINK_NOT.search(title) or not re.search(r"\bBLINK\b|\bBlink\b", title)):
        out.remove("blink")
    return out


def parse_pubdate(s):
    for fmt in ("%a, %d %b %Y %H:%M:%S %Z", "%a, %d %b %Y %H:%M:%S %z"):
        try:
            dt = datetime.strptime((s or "").strip(), fmt)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def gn_article_id(link):
    m = re.search(r"/articles/([^?]+)", link or "")
    return m.group(1) if m else None


def resolve_url(article_id):
    """Resolve a Google News article id to the publisher URL via batchexecute. '' on failure."""
    try:
        page = fetch(f"https://news.google.com/rss/articles/{article_id}")
        sig = re.search(r'data-n-a-sg="([^"]+)"', page)
        ts = re.search(r'data-n-a-ts="([^"]+)"', page)
        if not (sig and ts):
            return ""
        inner = json.dumps([
            "garturlreq",
            [["X", "X", ["X", "X"], None, None, 1, 1, "US:en", None, 1, None, None, None, None, None, 0, 1],
             "X", "X", 1, [1, 1, 1], 1, 1, None, 0, 0, None, 0],
            article_id, ts.group(1), sig.group(1),
        ])
        body = "f.req=" + urllib.parse.quote(json.dumps([[["Fbv4je", inner, None, "generic"]]]))
        resp = fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute", data=body.encode(),
                     headers={"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"})
        m = re.search(r'(https?://(?!news\.google)[^"\\]+)', resp)
        return m.group(1) if m else ""
    except Exception:
        return ""


def load_existing():
    if not OUT.exists():
        return []
    try:
        data = json.loads(OUT.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except Exception as e:
        log(f"  ! {OUT.relative_to(ROOT)} could not be read ({e}); leaving it alone")
        sys.exit(0)


def sort_items(items):
    return sorted(items, key=lambda x: x.get("date") or "", reverse=True)  # stable: ties keep their order


def main():
    args = set(sys.argv[1:])
    offline, dry = "--offline" in args, "--dry-run" in args
    existing = load_existing()
    if offline:
        out = sort_items(existing)
        if out != existing and not dry:
            OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        log(f"offline: {len(out)} items kept, nothing fetched")
        return 0

    have_urls = {norm_url(x.get("url")) for x in existing}
    have_titles = {norm_title(x.get("title")) for x in existing}
    have_gn = {x.get("gnId") for x in existing if x.get("gnId")}
    ids = {x.get("id") for x in existing}
    cutoff = datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)

    candidates, ok_queries = {}, 0
    for q in QUERIES:
        url = GN + urllib.parse.quote(f"{q} {RECENCY}")
        try:
            root = ET.fromstring(fetch(url))
            ok_queries += 1
        except Exception as e:
            log(f"  ! query failed ({type(e).__name__}): {q}")
            continue
        kept = 0
        for it in root.findall(".//item"):
            if kept >= PER_QUERY_CAP:
                break
            src_el = it.find("source")
            src_text = src_el.text if src_el is not None else ""
            src_url = src_el.get("url") if src_el is not None else ""
            label = match_source(src_text, src_url)
            if not label:
                continue
            title = plain(it.findtext("title"))
            if src_text and title.endswith(f" - {src_text.strip()}"):
                title = title[: -len(src_text.strip()) - 3].strip()
            progs = programs_in(title)
            dt = parse_pubdate(it.findtext("pubDate"))
            gid = gn_article_id(it.findtext("link"))
            if not (title and progs and dt and gid) or dt < cutoff:
                continue
            if PLACEHOLDER_WORD.search(title) or HTML_IN_TEXT.search(title) or SKIP_TITLE.search(title):
                continue
            if gid in have_gn or norm_title(title) in have_titles:
                continue
            key = norm_title(title)
            if key in candidates:
                candidates[key]["programs"] = sorted(set(candidates[key]["programs"]) | set(progs))
                continue
            candidates[key] = {"title": title, "source": label, "dt": dt, "gnId": gid, "programs": progs}
            kept += 1
        time.sleep(0.5)

    if not ok_queries:
        log("offline or Google News unreachable: data/news.json left untouched")
        return 0

    added = []
    for c in sorted(candidates.values(), key=lambda x: x["dt"], reverse=True)[:MAX_NEW]:
        url = resolve_url(c["gnId"])
        time.sleep(0.4)
        if not url.startswith("https://"):
            continue  # unresolved or not https: the site links publishers over https only
        if norm_url(url) in have_urls:
            continue
        date = c["dt"].astimezone(NY).date().isoformat()
        base = slug(f"{slug(c['source'], 30)}-{date}-{slug(c['title'], 60)}", 90)
        nid, n = base, 2
        while nid in ids:
            nid, n = f"{base}-{n}", n + 1
        item = {
            "id": nid, "title": c["title"], "source": c["source"], "sourceTier": None, "date": date, "url": url,
            "programs": [p for p in ["caw", "scw", "blink", "fotofocus", "also"] if p in c["programs"]],
            "summary": None, "tags": [], "gnId": c["gnId"], "image_url": None, "author": None,
            "kind": "news", "date_source": "google-news-pubdate",
        }
        ids.add(nid)
        have_urls.add(norm_url(url))
        added.append(item)

    for a in added:
        log(f"  + {a['date']} {a['source']}: {a['title']}")
    if not added:
        log(f"{ok_queries}/{len(QUERIES)} queries answered; no new stories")
        return 0
    if dry:
        log(f"dry run: {len(added)} new stories would be added")
        return 0
    OUT.write_text(json.dumps(sort_items(existing + added), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    log(f"{len(added)} new stories added → {OUT.relative_to(ROOT)} ({len(existing) + len(added)} total)")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
    except Exception as e:  # never break the refresh workflow: report and leave the file as it is
        log(f"fetch-cincy-news: unexpected error, data/news.json left untouched ({type(e).__name__}: {e})")
        sys.exit(0)
