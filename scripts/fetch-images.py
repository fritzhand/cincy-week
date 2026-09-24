#!/usr/bin/env python3
"""scripts/fetch-images.py · OWNER: Agent F (directory: people, art, partners)

Downloads every image the data points at, once, politely, and writes small optimized copies plus the
manifest the build reads (data/images.json → build/core/images.mjs). Dev-time only: the build never
needs the network or Pillow. Never hotlink (engine spec §4.11).

  python3 scripts/fetch-images.py               # incremental: new or changed URLs only
  python3 scripts/fetch-images.py --force       # re-process every cached original (after a pipeline change)
  python3 scripts/fetch-images.py --retry-failed  # also retry URLs that failed on an earlier run
  python3 scripts/fetch-images.py --offline     # use .cache/img-src only, no network
  python3 scripts/fetch-images.py --events      # also fetch events[].image_url (no page shows them today)

Inputs   people[].headshot_url → p/<id> · orgs[].logo_url → o/<id> · programs[].logo.url → o/prog-<program>
         works[].image_url → w/<id> · (--events) events[].image_url → w/<event id>
Cache    .cache/img-src/<sha1(url)>.<ext> (originals, gitignored) + index.json (url → file, status, error)
Outputs  site/img/p/<id>.webp        320×320 square, face-safe crop (centered at 40% of the height on
                                       portrait photos), q74; and <id>-96.webp (96×96) for 28–44px mugs
         site/img/o/<id>.webp|.svg   logos: baked-in margins trimmed, transparency kept, fit 320×160
                                       (never recolored); SVG logos sanitized (no scripts, handlers,
                                       external references, foreignObject or animation)
         site/img/w/<id>-480.webp    artwork, 480w, and <id>-960.webp (960w) when the source is wider, q72
         data/images.json            { "p/<id>": { file, w, h, bg, src, source_url, sm: {file, w, h} },
                                       "o/<id>": { file, w, h, bg, src, source_url, tone: "light"|"dark" },
                                       "w/<id>": { file, w, h, bg, src, source_url, lg: {file, w, h} } }
         `tone` is the plate a logo needs: "light" (dark ink on the white plate) or "dark" (a light-on-dark
         logo on the black plate). Detected from alpha + luminance; TONE_OVERRIDE below records the few
         checked by eye. `bg` is the average color (a placeholder hint; the build never inlines it).
Politeness  ≤ 4 requests/second overall and ≤ 2 per host, a descriptive User-Agent, the page the image
            appears on as Referer, 3 attempts with backoff on timeouts, 429 and 5xx. Originals are cached,
            so a re-run only fetches new URLs. Failures are recorded and skipped until --retry-failed.
A record whose image is missing or broken simply has no manifest entry: pages fall back to monogram mugs,
text plates and "Photo coming". Orphaned files and entries (ids no longer in the data) are removed.
"""
import argparse
import hashlib
import io
import json
import os
import re
import ssl
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor

try:
    from PIL import Image, ImageChops, ImageOps
except ImportError:  # pragma: no cover
    sys.stderr.write("fetch-images.py needs Pillow with WebP support: pip install pillow\n")
    sys.exit(2)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
IMG = os.path.join(ROOT, "site", "img")
CACHE = os.path.join(ROOT, ".cache", "img-src")
MANIFEST = os.path.join(DATA, "images.json")
PIPELINE = 3  # bump when the processing below changes; outputs made by an older pipeline are redone

UA = "cincy-week-images/1.0 (+https://github.com/fritzhand/cincy-week; dev-time cache of published event images)"
RATE_ALL, RATE_HOST = 0.25, 0.5  # seconds between request starts: ≤ 4/s overall, ≤ 2/s per host
MAX_BYTES = 120 * 1024 * 1024  # one BLINK artwork original is an 81 MB PNG
Image.MAX_IMAGE_PIXELS = 250_000_000

HEAD, HEAD_SM, HEAD_Q = 320, 96, 74
LOGO_BOX, LOGO_UPSCALE = (320, 160), 2.0
WORK_W, WORK_Q, WORK_MAX_RATIO = (480, 960), 72, 1.5  # a very tall image is capped at 1.5 × its width

# Logos whose tone was checked by eye on the partners page (key → plate). Detection handles the rest.
TONE_OVERRIDE = {}
# Headshots whose automatic crop missed the face, checked by eye on a contact sheet of every crop:
# key → (center x, center y, side) as fractions of the width, the height and the shorter edge.
CROP_OVERRIDE = {
    "p/leslie-mooney": (0.51, 0.86, 0.36),       # a wide news photo; the face sits at the bottom edge
    "p/everything-good-studio": (0.19, 0.5, 1.0),  # two portraits side by side; the center falls between them
}


def log(*a):
    print(*a, flush=True)


# ---------------------------------------------------------------- data → jobs
def load(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as f:
        return json.load(f)


def jobs_from_data(with_events):
    jobs = []
    for p in load("people.json"):
        if p.get("headshot_url"):
            jobs.append(("p", p["id"], p["headshot_url"], p.get("source_url")))
    for o in load("orgs.json"):
        if o.get("logo_url"):
            jobs.append(("o", o["id"], o["logo_url"], o.get("source_url")))
    for g in load("programs.json"):
        u = (g.get("logo") or {}).get("url")
        if u:
            jobs.append(("o", "prog-" + g["id"], u, g.get("source_url") or g.get("url")))
    for w in load("works.json"):
        if w.get("image_url"):
            jobs.append(("w", w["id"], w["image_url"], w.get("source_url")))
    if with_events:
        for e in load("events.json"):
            if e.get("image_url"):
                jobs.append(("w", e["id"], e["image_url"], e.get("source_url")))
    return jobs


# ---------------------------------------------------------------- polite download
class Limiter:
    def __init__(self):
        self.lock = threading.Lock()
        self.last_all = 0.0
        self.last_host = {}

    def wait(self, host):
        while True:
            with self.lock:
                now = time.monotonic()
                t = max(self.last_all + RATE_ALL, self.last_host.get(host, 0) + RATE_HOST)
                if now >= t:
                    self.last_all = now
                    self.last_host[host] = now
                    return
                delay = t - now
            time.sleep(delay)


LIMIT = Limiter()


def ssl_ctx():
    for var in ("SSL_CERT_FILE", "REQUESTS_CA_BUNDLE", "CURL_CA_BUNDLE"):
        f = os.environ.get(var)
        if f and os.path.exists(f):
            return ssl.create_default_context(cafile=f)
    return ssl.create_default_context()


CTX = ssl_ctx()


def quote_url(u):
    parts = urllib.parse.urlsplit(u.strip())
    path = urllib.parse.quote(urllib.parse.unquote(parts.path), safe="/%:@!$&'()*+,;=~")
    query = urllib.parse.quote(parts.query, safe="=&%:@!$'()*+,;/?~")
    return urllib.parse.urlunsplit((parts.scheme, parts.netloc, path, query, ""))


def polite_url(url):
    """Wikimedia asks tools to fetch its standard thumbnail sizes, not originals (https://w.wiki/GHai)."""
    m = re.match(r"^https://upload\.wikimedia\.org/wikipedia/(\w+)/([0-9a-f])/([0-9a-f]{2})/([^/?#]+)$", url)
    if m and not m.group(4).lower().endswith(".svg"):
        proj, a, ab, name = m.groups()
        return f"https://upload.wikimedia.org/wikipedia/{proj}/thumb/{a}/{ab}/{name}/500px-{name}"
    return url


def fetch(url, referer):
    """→ (bytes, content_type) or raises RuntimeError(reason)."""
    url = polite_url(url)
    host = urllib.parse.urlsplit(url).netloc
    last = "unknown error"
    for attempt in range(3):
        LIMIT.wait(host)
        headers = {"User-Agent": UA, "Accept": "image/avif,image/webp,image/svg+xml,image/*;q=0.8,*/*;q=0.5"}
        if referer and attempt < 2:
            headers["Referer"] = referer
        req = urllib.request.Request(quote_url(url), headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=30, context=CTX) as r:
                data = r.read(MAX_BYTES + 1)
                if len(data) > MAX_BYTES:
                    raise RuntimeError("larger than 120 MB")
                return data, (r.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        except urllib.error.HTTPError as e:
            last = f"HTTP {e.code}"
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(2 ** attempt * 1.5)
                continue
            if e.code == 403 and attempt == 0:
                continue  # one more try (the last attempt drops the Referer)
            raise RuntimeError(last)
        except (urllib.error.URLError, TimeoutError, ConnectionError, ssl.SSLError) as e:
            last = f"{type(e).__name__}: {getattr(e, 'reason', e)}"
            time.sleep(2 ** attempt)
    raise RuntimeError(last)


def sniff(data, ctype, url):
    head = data[:512].lstrip()
    if head.startswith(b"\xef\xbb\xbf"):
        head = head[3:]
    if b"<svg" in data[:4096].lower() and (head.startswith(b"<?xml") or head.startswith(b"<svg") or head.startswith(b"<!--") or head.startswith(b"<!doctype")):
        return "svg"
    if ctype == "image/svg+xml" or url.lower().split("?")[0].endswith(".svg"):
        if b"<svg" in data.lower():
            return "svg"
    if head[:15].lower().startswith(b"<!doctype html") or head[:5].lower() == b"<html":
        return "html"
    return "raster"


# ---------------------------------------------------------------- cache
def cache_index():
    try:
        with open(os.path.join(CACHE, "index.json"), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def save_json(path, obj):
    txt = json.dumps(obj, indent=2, ensure_ascii=False, sort_keys=True) + "\n"
    try:
        with open(path, encoding="utf-8") as f:
            if f.read() == txt:
                return False
    except OSError:
        pass
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(txt)
    os.replace(tmp, path)
    return True


def get_original(url, referer, idx, args, lock):
    key = hashlib.sha1(url.encode("utf-8")).hexdigest()
    with lock:
        rec = idx.get(url)
    if rec and rec.get("file") and os.path.exists(os.path.join(CACHE, rec["file"])):
        with open(os.path.join(CACHE, rec["file"]), "rb") as f:
            return f.read(), rec.get("kind", "raster"), None
    if rec and rec.get("error") and not args.retry_failed:
        return None, None, rec["error"] + " (earlier run; --retry-failed to try again)"
    if args.offline:
        return None, None, "not cached (offline)"
    try:
        data, ctype = fetch(url, referer)
        kind = sniff(data, ctype, url)
        if kind == "html":
            raise RuntimeError("the URL returns a web page, not an image")
        ext = "svg" if kind == "svg" else "bin"
        name = f"{key}.{ext}"
        with open(os.path.join(CACHE, name), "wb") as f:
            f.write(data)
        with lock:
            idx[url] = {"file": name, "kind": kind, "ctype": ctype, "bytes": len(data), "at": time.strftime("%Y-%m-%d")}
        return data, kind, None
    except RuntimeError as e:
        with lock:
            idx[url] = {"error": str(e), "at": time.strftime("%Y-%m-%d")}
        return None, None, str(e)


# ---------------------------------------------------------------- image helpers
def open_raster(data):
    im = Image.open(io.BytesIO(data))
    try:
        im.seek(0)  # first frame of an animation
    except EOFError:
        pass
    im = ImageOps.exif_transpose(im)
    if im.mode in ("P", "PA"):
        im = im.convert("RGBA")
    elif im.mode in ("LA", "La"):
        im = im.convert("RGBA")
    elif im.mode not in ("RGB", "RGBA"):
        im = im.convert("RGB")
    if im.mode == "RGBA" and im.getchannel("A").getextrema()[0] >= 250:
        im = im.convert("RGB")  # an alpha channel that is fully opaque
    return im


def flat(im, bg=(255, 255, 255)):
    if im.mode != "RGBA":
        return im.convert("RGB")
    base = Image.new("RGB", im.size, bg)
    base.paste(im, mask=im.getchannel("A"))
    return base


def hexcolor(rgb):
    return "#%02x%02x%02x" % tuple(int(c) for c in rgb[:3])


def avg_color(im):
    return hexcolor(flat(im).resize((1, 1), Image.Resampling.BOX).getpixel((0, 0)))


def lum(rgb):
    def ch(c):
        c = c / 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = rgb[:3]
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def save_webp(im, path, q, lossless_try=False):
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=q, method=6, alpha_quality=100 if im.mode == "RGBA" else 90)
    best = buf.getvalue()
    if lossless_try:
        buf2 = io.BytesIO()
        im.save(buf2, "WEBP", lossless=True, method=6, quality=100)
        if len(buf2.getvalue()) < len(best):
            best = buf2.getvalue()
    write_bytes(path, best)


def write_bytes(path, data):
    try:
        with open(path, "rb") as f:
            if f.read() == data:
                return
    except OSError:
        pass
    with open(path, "wb") as f:
        f.write(data)


def rel(path):
    return os.path.relpath(path, os.path.join(ROOT, "site")).replace(os.sep, "/")


# ---------------------------------------------------------------- headshots
def face_safe_square(im, override=None):
    w, h = im.size
    side = min(w, h)
    if override:
        cx, cy, f = override
        side = max(8, int(round(side * f)))
        left = int(round(min(max(cx * w - side / 2, 0), w - side)))
        top = int(round(min(max(cy * h - side / 2, 0), h - side)))
        return im.crop((left, top, left + side, top + side))
    if h > w:  # portrait: faces sit high; center the box at 40% of the height
        top = int(round(min(max(0.40 * h - side / 2, 0), h - side)))
        return im.crop((0, top, side, top + side))
    left = int(round((w - side) / 2))
    return im.crop((left, 0, left + side, side))


def do_person(pid, data):
    im = open_raster(data)
    if im.mode == "RGBA":  # a cut-out: trim transparent padding first so the crop sees the person
        bbox = im.getchannel("A").point(lambda a: 255 if a > 16 else 0).getbbox()
        if bbox and (bbox[2] - bbox[0]) > 8 and (bbox[3] - bbox[1]) > 8:
            im = im.crop(bbox)
    sq = face_safe_square(im, CROP_OVERRIDE.get("p/" + pid))
    side = min(HEAD, sq.size[0])
    big = sq.resize((side, side), Image.Resampling.LANCZOS) if sq.size[0] != side else sq
    small = sq.resize((min(HEAD_SM, side),) * 2, Image.Resampling.LANCZOS)
    os.makedirs(os.path.join(IMG, "p"), exist_ok=True)
    f1, f2 = os.path.join(IMG, "p", f"{pid}.webp"), os.path.join(IMG, "p", f"{pid}-96.webp")
    save_webp(big, f1, HEAD_Q)
    save_webp(small, f2, 72)
    return {"file": rel(f1), "w": big.size[0], "h": big.size[1], "bg": avg_color(big),
            "sm": {"file": rel(f2), "w": small.size[0], "h": small.size[1]}}


# ---------------------------------------------------------------- logos
def trim(im):
    """Trim baked-in margins: transparent padding, or a uniform border color. Never recolors."""
    if im.mode == "RGBA":
        bbox = im.getchannel("A").point(lambda a: 255 if a > 10 else 0).getbbox()
    else:
        w, h = im.size
        corners = [im.getpixel(p) for p in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))]
        bg = max(set(corners), key=corners.count)
        diff = ImageChops.difference(im, Image.new("RGB", im.size, bg)).convert("L")
        bbox = diff.point(lambda v: 255 if v > 28 else 0).getbbox()
    if not bbox or (bbox[2] - bbox[0]) < 4 or (bbox[3] - bbox[1]) < 4:
        return im
    return im.crop(bbox)


def border_rgb(im):
    rgb = flat(im)
    w, h = rgb.size
    px = [rgb.getpixel((x, y)) for x in range(0, w, max(1, w // 20)) for y in (0, h - 1)]
    px += [rgb.getpixel((x, y)) for y in range(0, h, max(1, h // 10)) for x in (0, w - 1)]
    return tuple(sum(c[i] for c in px) / len(px) for i in range(3))


def raster_tone(im):
    """"dark" when the logo is light ink meant for a dark ground, else "light"."""
    if im.mode == "RGBA":
        small = im.copy()
        small.thumbnail((160, 160))
        pixels = small.get_flattened_data() if hasattr(small, "get_flattened_data") else small.getdata()
        px = [p for p in pixels if p[3] > 128]
        if not px:
            return "light"
        light = sum(1 for p in px if lum(p) > 0.72)
        return "dark" if light / len(px) > 0.72 else "light"
    return "dark" if lum(border_rgb(im)) < 0.3 else "light"


def do_logo(oid, data, kind):
    os.makedirs(os.path.join(IMG, "o"), exist_ok=True)
    if kind == "svg":
        svg, w, h, tone = sanitize_svg(data)
        path = os.path.join(IMG, "o", f"{oid}.svg")
        write_bytes(path, svg)
        _drop(os.path.join(IMG, "o", f"{oid}.webp"))
        return {"file": rel(path), "w": w, "h": h, "tone": TONE_OVERRIDE.get("o/" + oid, tone)}
    im = trim(open_raster(data))
    tone = raster_tone(im)
    bw, bh = LOGO_BOX
    s = min(bw / im.size[0], bh / im.size[1], LOGO_UPSCALE)
    size = (max(1, round(im.size[0] * s)), max(1, round(im.size[1] * s)))
    if size != im.size:
        im = im.resize(size, Image.Resampling.LANCZOS)
    path = os.path.join(IMG, "o", f"{oid}.webp")
    save_webp(im, path, 90, lossless_try=True)
    _drop(os.path.join(IMG, "o", f"{oid}.svg"))
    return {"file": rel(path), "w": im.size[0], "h": im.size[1], "bg": avg_color(im), "tone": TONE_OVERRIDE.get("o/" + oid, tone)}


SVG_NS, XLINK_NS = "http://www.w3.org/2000/svg", "http://www.w3.org/1999/xlink"
KEEP_NS = {SVG_NS, XLINK_NS, "http://www.w3.org/XML/1998/namespace"}
DROP_TAGS = {"script", "foreignObject", "iframe", "object", "embed", "handler", "listener", "animate",
             "animateMotion", "animateTransform", "animateColor", "set", "metadata", "a"}
NAMED = {"white": (255, 255, 255), "black": (0, 0, 0), "red": (255, 0, 0), "blue": (0, 0, 255), "green": (0, 128, 0),
         "gray": (128, 128, 128), "grey": (128, 128, 128), "yellow": (255, 255, 0), "orange": (255, 165, 0), "navy": (0, 0, 128)}
ET.register_namespace("", SVG_NS)
ET.register_namespace("xlink", XLINK_NS)


def _local(tag):
    return tag.split("}", 1)[1] if tag.startswith("{") else tag


def _ns(tag):
    return tag[1:].split("}", 1)[0] if tag.startswith("{") else SVG_NS


def _safe_ref(v):
    v = v.strip()
    return v.startswith("#") or re.match(r"^data:image/(png|jpe?g|gif|webp);base64,", v, re.I) is not None


def _clean_css(css):
    css = re.sub(r"@import[^;]*;?", "", css, flags=re.I)
    css = re.sub(r"expression\s*\(", "(", css, flags=re.I)
    return re.sub(r"url\(\s*(['\"]?)(?!#)[^)]*\)", "none", css, flags=re.I)


def parse_color(v):
    v = v.strip().lower()
    m = re.fullmatch(r"#([0-9a-f]{3}|[0-9a-f]{6})", v)
    if m:
        s = m.group(1)
        if len(s) == 3:
            s = "".join(c * 2 for c in s)
        return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))
    m = re.fullmatch(r"rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+).*\)", v)
    if m:
        return tuple(int(x) for x in m.groups())
    return NAMED.get(v)


def sanitize_svg(data):
    txt = data.decode("utf-8", "replace")
    txt = re.sub(r"<!DOCTYPE[^>\[]*(\[[^\]]*\])?\s*>", "", txt, flags=re.I | re.S)
    txt = re.sub(r"<\?xml-stylesheet[^>]*>", "", txt, flags=re.I)
    root = ET.fromstring(txt)
    if _local(root.tag) != "svg":
        raise RuntimeError("not an SVG document")
    colors = []
    rasters = []

    def walk(el):
        for child in list(el):
            t = _local(child.tag) if isinstance(child.tag, str) else ""
            if not isinstance(child.tag, str) or _ns(child.tag) not in KEEP_NS or t in DROP_TAGS:
                el.remove(child)
                continue
            walk(child)
        for k in list(el.attrib):
            v = el.attrib[k]
            name = _local(k)
            ns = _ns(k) if k.startswith("{") else SVG_NS
            if ns not in KEEP_NS or name.lower().startswith("on"):
                del el.attrib[k]
            elif name == "href":
                if not _safe_ref(v):
                    del el.attrib[k]
                elif v.startswith("data:"):
                    rasters.append(v)
            elif name == "style":
                el.attrib[k] = _clean_css(v)
                for m in re.finditer(r"(?:fill|stroke|stop-color)\s*:\s*([^;]+)", v, re.I):
                    colors.append(m.group(1))
            elif name in ("fill", "stroke", "stop-color", "color"):
                colors.append(v)
            elif isinstance(v, str) and re.search(r"url\(\s*['\"]?(?!#)", v, re.I):
                del el.attrib[k]
        if _local(el.tag) == "style" and el.text:
            el.text = _clean_css(el.text)
            colors.extend(m.group(1) for m in re.finditer(r"(?:fill|stroke|stop-color)\s*:\s*([^;}]+)", el.text, re.I))

    walk(root)
    # intrinsic size: viewBox (or width/height), fit into the logo box
    vb = root.attrib.get("viewBox")
    num = lambda s: float(re.match(r"[-+]?[\d.]+", s).group(0)) if s and re.match(r"[-+]?[\d.]+", s) else None
    if vb:
        _, _, vw, vh = [float(x) for x in re.split(r"[\s,]+", vb.strip())[:4]]
    else:
        vw, vh = num(root.attrib.get("width")), num(root.attrib.get("height"))
        if not vw or not vh:
            raise RuntimeError("SVG without a viewBox or size")
        root.attrib["viewBox"] = f"0 0 {vw:g} {vh:g}"
    s = min(LOGO_BOX[0] / vw, LOGO_BOX[1] / vh)
    w, h = max(1, round(vw * s)), max(1, round(vh * s))
    root.attrib["width"], root.attrib["height"] = str(w), str(h)
    root.attrib.pop("x", None)
    root.attrib.pop("y", None)
    out = ET.tostring(root, encoding="unicode")
    out = '<?xml version="1.0" encoding="UTF-8"?>\n' + out + "\n"
    # tone: the colors the logo paints with (unset fill = black); embedded rasters vote too
    rgbs = [c for c in (parse_color(x) for x in colors if x.strip().lower() not in ("none", "transparent", "inherit")) if c]
    if not rgbs and not rasters:
        rgbs = [(0, 0, 0)]
    light = sum(1 for c in rgbs if lum(c) > 0.72)
    tone = "dark" if rgbs and light / len(rgbs) > 0.72 else "light"
    if not rgbs and rasters:
        try:
            import base64
            tone = raster_tone(open_raster(base64.b64decode(rasters[0].split(",", 1)[1])))
        except Exception:  # noqa: BLE001 - an undecodable embedded image just keeps the default
            tone = "light"
    return out.encode("utf-8"), w, h, tone


# ---------------------------------------------------------------- artwork
def do_work(wid, data):
    im = flat(open_raster(data))
    os.makedirs(os.path.join(IMG, "w"), exist_ok=True)
    out = {}
    made = []
    for target in WORK_W:
        box = (target, int(target * WORK_MAX_RATIO))
        s = min(box[0] / im.size[0], box[1] / im.size[1], 1.0)
        size = (max(1, round(im.size[0] * s)), max(1, round(im.size[1] * s)))
        if made and size[0] <= made[-1][1][0] * 1.15:
            _drop(os.path.join(IMG, "w", f"{wid}-{target}.webp"))
            continue  # the source is not meaningfully wider than the smaller variant
        v = im.resize(size, Image.Resampling.LANCZOS) if size != im.size else im
        path = os.path.join(IMG, "w", f"{wid}-{target}.webp")
        save_webp(v, path, WORK_Q)
        made.append((path, v.size))
    (p1, s1) = made[0]
    out = {"file": rel(p1), "w": s1[0], "h": s1[1], "bg": avg_color(im)}
    if len(made) > 1:
        out["lg"] = {"file": rel(made[1][0]), "w": made[1][1][0], "h": made[1][1][1]}
    return out


def _drop(path):
    try:
        os.remove(path)
    except OSError:
        pass


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--force", action="store_true", help="re-process every cached original")
    ap.add_argument("--retry-failed", action="store_true", help="retry URLs that failed on an earlier run")
    ap.add_argument("--offline", action="store_true", help="no network; use the cache only")
    ap.add_argument("--events", action="store_true", help="also fetch events[].image_url")
    ap.add_argument("--only", help="comma-separated keys to (re)process, e.g. p/jane-doe,o/cintrifuse")
    args = ap.parse_args()
    os.makedirs(CACHE, exist_ok=True)

    jobs = jobs_from_data(args.events)
    try:
        with open(MANIFEST, encoding="utf-8") as f:
            manifest = json.load(f)
    except (OSError, ValueError):
        manifest = {}
    state_path = os.path.join(CACHE, "state.json")
    try:
        with open(state_path, encoding="utf-8") as f:
            state = json.load(f)
    except (OSError, ValueError):
        state = {}
    idx = cache_index()
    lock = threading.Lock()
    only = set(args.only.split(",")) if args.only else None

    def up_to_date(key, url):
        e = manifest.get(key)
        if not e or e.get("src") != url or state.get(key) != PIPELINE:
            return False
        files = [e["file"]] + [e[x]["file"] for x in ("sm", "lg") if x in e]
        return all(os.path.exists(os.path.join(ROOT, "site", f)) for f in files)

    todo = [j for j in jobs if (only is None or f"{j[0]}/{j[1]}" in only) and (args.force or only or not up_to_date(f"{j[0]}/{j[1]}", j[2]))]
    log(f"{len(jobs)} image records; {len(todo)} to fetch or process ({len(jobs) - len(todo)} up to date)")
    results, failures = {}, {}

    def work(job):
        kind, rid, url, src = job
        key = f"{kind}/{rid}"
        data, fmt, err = get_original(url, src, idx, args, lock)
        if err:
            return key, None, err
        try:
            if kind == "p":
                if fmt == "svg":
                    raise RuntimeError("an SVG headshot")
                entry = do_person(rid, data)
            elif kind == "o":
                entry = do_logo(rid, data, fmt)
            else:
                if fmt == "svg":
                    raise RuntimeError("an SVG artwork image")
                entry = do_work(rid, data)
        except Exception as e:  # noqa: BLE001 - one broken image must never stop the run
            return key, None, f"could not process: {type(e).__name__}: {e}"
        entry["src"] = url
        if src:
            entry["source_url"] = src
        return key, entry, None

    done = 0
    with ThreadPoolExecutor(max_workers=4) as pool:
        for key, entry, err in pool.map(work, todo):
            done += 1
            if entry:
                results[key] = entry
            else:
                failures[key] = err
            if done % 25 == 0 or done == len(todo):
                log(f"  {done}/{len(todo)} · {len(results)} ok · {len(failures)} failed")
                save_json(os.path.join(CACHE, "index.json"), idx)

    # merge: keep up-to-date entries, add new ones, drop failures and ids no longer in the data
    wanted = {f"{k}/{i}": u for k, i, u, _ in jobs}
    new = {}
    for key, url in wanted.items():
        if key in results:
            new[key] = results[key]
            state[key] = PIPELINE
        elif key not in failures and key in manifest and manifest[key].get("src") == url:
            new[key] = manifest[key]
    for key in list(state):
        if key not in new:
            del state[key]
    # remove orphan files (anything under site/img/{p,o,w} the manifest no longer names). The build tests'
    # fixture (tests/fixtures/mini/images.json) points at a few of these files too: never remove those.
    keep = set()
    try:
        with open(os.path.join(ROOT, "tests", "fixtures", "mini", "images.json"), encoding="utf-8") as f:
            keep.update(e["file"] for e in json.load(f).values() if isinstance(e, dict) and "file" in e)
    except (OSError, ValueError):
        pass
    for e in new.values():
        keep.add(e["file"])
        for x in ("sm", "lg"):
            if x in e:
                keep.add(e[x]["file"])
    removed = 0
    for sub in ("p", "o", "w"):
        d = os.path.join(IMG, sub)
        if not os.path.isdir(d):
            continue
        for f in os.listdir(d):
            if f"img/{sub}/{f}" not in keep:
                os.remove(os.path.join(d, f))
                removed += 1

    changed = save_json(MANIFEST, new)
    save_json(os.path.join(CACHE, "index.json"), idx)
    save_json(state_path, state)
    report = {"failed": failures, "counts": {}}
    for sub in ("p", "o", "w"):
        d = os.path.join(IMG, sub)
        files = os.listdir(d) if os.path.isdir(d) else []
        size = sum(os.path.getsize(os.path.join(d, f)) for f in files)
        report["counts"][sub] = {"entries": sum(1 for k in new if k.startswith(sub + "/")), "files": len(files), "bytes": size}
    save_json(os.path.join(CACHE, "report.json"), report)

    total = sum(c["bytes"] for c in report["counts"].values())
    names = {"p": "headshots", "o": "logos", "w": "artwork"}
    log("")
    for sub, c in report["counts"].items():
        want = sum(1 for k in wanted if k.startswith(sub + "/"))
        log(f"  {names[sub]:<9} {c['entries']:>4} of {want:<4} {c['files']:>4} files  {c['bytes'] / 1048576:6.2f} MB")
    log(f"  total site/img/{{p,o,w}}: {total / 1048576:.2f} MB · manifest {'updated' if changed else 'unchanged'} · {removed} orphan file(s) removed")
    if failures:
        log(f"\n{len(failures)} image(s) unavailable (pages show monograms, text plates or 'Photo coming'):")
        for k, e in sorted(failures.items()):
            log(f"  {k}: {e}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
