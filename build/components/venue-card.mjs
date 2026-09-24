/* ============================================================
   build/components/venue-card.mjs · OWNER: Agent E (map, venues & visit)

   makeVenueCards(ctx) → {
     venueCard(root, venue, { anchor = true, headingLevel = 3, show = true })
         li.venue#v-{id}[data-prog][data-prog2][data-p][data-h][data-day][data-q][data-ll][data-n] (DESIGN.md §9.7):
         .stall (the map number; "–" dashed when the venue is not on the map), h3 a → the venue page (the whole
         row is stretched to it), .addr, .roles (bullet + program + what it has there), .today (days with events, or
         the honest "not on the map" badge), .acts (walking directions in Apple and Google Maps, "On the map"
         → map.html?focus=venue:<id>), raised above the stretched link. data-ll/data-n only for venues on the map;
         data-day = festival days with a live event there (the venues page's day filter).
     miniMap(root, lat, lng, { prog, n, label, halfWidthM = 350 })
         .mini-map: <svg viewBox="{crop}"><use href="{root}assets/map/basemap.svg#bm"/></svg> + up to three basemap
         labels + one .pin.pin-venue. Plain SVG, works without JS. No coordinates → p.unk "Not on the map: …";
         off the basemap → p.unk "Outside the map area".
     areaMap(root, [{ lat, lng, kind, prog, n }], { label, minHalfM, center, ratio, cls })
         a static crop that fits several points, one pin each (neighborhood and streetcar maps)
     directions(lat, lng, { walk = true })   { apple, google } (walking mode unless walk: false)
     directionsTo(record)             by coordinates (walking inside the map area, mode left open elsewhere), else by
                                      the street address (Google only), else null → { apple|null, google, walk }
     where(record)                    "on" | "off" (outside the basemap) | "none" (no coordinates)
     placeStatus(record)              the honest "not on the map" badge for a record, or ""
     meta                             the projection (lib/geo.js metaOf(data/map.json)): { bbox, home, k, sx, W, H, mPerUnit }
     nearbyOf(lat, lng, meters)       db.nearby plus walking estimates: [{ kind, rec, d, min }]
     walkLabel(meters)                "350 m · about 6 min walk" (an estimate: straight line × 1.3 at 80 m a minute)
     daysOf(venue)                    the festival days with a live event at the venue
   }
   ============================================================ */
import { esc, attr, extLink, plural } from "../core/util.mjs";
import { icon, bullet } from "../core/icons.mjs";
import { metaOf, crop, onMap, METERS_PER_DEG_LAT } from "../../site/js/lib/geo.js";
import { fmtDay } from "../../site/js/lib/time.js";
import { norm } from "../../site/js/lib/search.js";

export function makeVenueCards(ctx) {
  const { db, c } = ctx;
  const meta = metaOf(db.map);

  /** Walking directions by default; { walk: false } leaves the mode to the reader (a venue in another city). */
  const directions = (lat, lng, { walk = true } = {}) => ({
    apple: `https://maps.apple.com/?daddr=${lat},${lng}${walk ? "&dirflg=w" : ""}`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${walk ? "&travelmode=walking" : ""}`,
  });
  /** By coordinates when we have them (walking inside the map area), else by the published street address
   *  (Google Maps geocodes it). → { apple, google, walk } | null */
  function directionsTo(r) {
    if (r.lat != null && r.lng != null) { const walk = onMap(meta, r.lat, r.lng); return { ...directions(r.lat, r.lng, { walk }), walk }; }
    if (!r.address) return null;
    const q = encodeURIComponent([r.address, r.city, r.state].filter(Boolean).join(", "));
    return { apple: null, google: `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=walking`, walk: true };
  }
  const where = (r) => (r.lat == null || r.lng == null ? "none" : onMap(meta, r.lat, r.lng) ? "on" : "off");
  function placeStatus(r) {
    const w = where(r);
    if (w === "on") return "";
    if (w === "off") return c.badge("out", "Outside the map area");
    return c.badge("unconfirmed", r.address ? "Not on the map" : "Address unconfirmed · not on the map");
  }
  const walkLabel = (m) => `${m < 950 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`} · about ${Math.max(1, Math.round((m * 1.3) / 80))} min walk`;
  const nearbyOf = (lat, lng, meters = 500) => db.nearby(lat, lng, meters).map((x) => ({ ...x, min: Math.max(1, Math.round((x.d * 1.3) / 80)) }));

  /** Up to three basemap labels (parks, streets, neighborhoods, the river) inside a crop, clear of the pin and of
   *  each other, so a mini-map says where it is. Positions in percent of the crop. */
  const LABELS = (db.map && db.map.labels) || [];
  const LABEL_PRI = { park: 0, street: 1, hood: 2, water: 3, bridge: 4 };
  function cropLabels(vb, px, py) {
    const [x0, y0, w, h] = vb, out = [];
    const cands = LABELS.filter((l) => LABEL_PRI[l.kind] != null).map((l) => {
      const x = ((l.lng - meta.bbox.w) * meta.k * meta.sx - x0) / w * 100, y = ((meta.bbox.n - l.lat) * meta.sx - y0) / h * 100;
      // extents in percent of a small (240 × 180 px) mini-map, so labels fit wherever the crop is shown
      const len = (l.text.length * (l.kind === "hood" ? 8.4 : 6.6)) / 2, a = ((l.angle || 0) * Math.PI) / 180;
      const half = ((len * Math.abs(Math.cos(a)) + 8 * Math.abs(Math.sin(a))) / 240) * 100 + 3;
      const halfY = ((len * Math.abs(Math.sin(a)) + 8 * Math.abs(Math.cos(a))) / 180) * 100 + 3;
      return { l, x, y, half, halfY };
    }).filter((c) => c.x - c.half > 1 && c.x + c.half < 99 && c.y - c.halfY > 1 && c.y + c.halfY < 99 && Math.hypot(c.x - px, (c.y - py) * 0.75) > 16)
      .sort((a, b) => LABEL_PRI[a.l.kind] - LABEL_PRI[b.l.kind]);
    for (const c of cands) {
      if (out.length >= 3) break;
      if (out.some((o) => Math.abs(o.y - c.y) < o.halfY + c.halfY && Math.abs(o.x - c.x) < o.half + c.half)) continue;
      if (out.some((o) => o.l.text === c.l.text)) continue;
      out.push(c);
    }
    return out.map((c) => `<span class="map-label ${c.l.kind}" style="left: ${c.x.toFixed(1)}%; top: ${c.y.toFixed(1)}%${c.l.angle ? `; --a: ${c.l.angle}deg` : ""}">${esc(c.l.text)}</span>`).join("");
  }

  function miniMap(root, lat, lng, { prog = "also", n = "", label = "", halfWidthM = 350 } = {}) {
    if (lat == null || lng == null) return `<p class="unk mini-map-none">Not on the map: the address is not listed</p>`;
    const cr = meta && crop(lat, lng, meta, { halfWidthM });
    if (!cr) return `<p class="unk mini-map-none">Outside the map area</p>`;
    return `<div class="mini-map"${label ? ` role="img" aria-label="${attr(label)}"` : ""}><svg viewBox="${cr.vb.join(" ")}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><use href="${root}assets/map/basemap.svg#bm"/></svg><span class="mini-labels" aria-hidden="true">${cropLabels(cr.vb, cr.px, cr.py)}</span><span class="pin pin-venue" data-prog="${attr(prog)}" style="left: ${cr.px}%; top: ${cr.py}%"><span>${esc(n)}</span></span></div>`;
  }

  /** A static area map: a crop of the basemap that fits every point (at least `minHalfM` meters each side of
   *  the center), with one pin per point: { lat, lng, kind: "venue"|"stop"|"stay", prog, n }. Plain SVG + spans,
   *  no JS. Points off the basemap are left out; none on it → "". */
  function areaMap(root, points, { label = "", minHalfM = 350, center = null, ratio = 4 / 3, cls = "" } = {}) {
    if (!meta) return "";
    const pts = points.filter((p) => onMap(meta, p.lat, p.lng)).map((p) => ({ ...p, xy: [(p.lng - meta.bbox.w) * meta.k * meta.sx, (meta.bbox.n - p.lat) * meta.sx] }));
    const ctr = center && onMap(meta, center.lat, center.lng) ? [(center.lng - meta.bbox.w) * meta.k * meta.sx, (meta.bbox.n - center.lat) * meta.sx] : null;
    if (!pts.length && !ctr) return "";
    const xs = [...pts.map((p) => p.xy[0]), ...(ctr ? [ctr[0]] : [])], ys = [...pts.map((p) => p.xy[1]), ...(ctr ? [ctr[1]] : [])];
    const minU = (2 * minHalfM) / meta.mPerUnit, pad = 28;
    let x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
    let w = Math.max(x1 - x0, minU), hh = Math.max(y1 - y0, minU / ratio);
    if (w / hh > ratio) hh = w / ratio; else w = hh * ratio;
    w = Math.min(w, meta.W); hh = Math.min(hh, meta.H);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    x0 = Math.min(Math.max(0, cx - w / 2), meta.W - w); y0 = Math.min(Math.max(0, cy - hh / 2), meta.H - hh);
    const pct = (v, a, b) => (((v - a) / b) * 100).toFixed(2);
    const pin = (p) => `<span class="pin pin-${p.kind || "venue"}"${p.prog ? ` data-prog="${attr(p.prog)}"` : ""} style="left: ${pct(p.xy[0], x0, w)}%; top: ${pct(p.xy[1], y0, hh)}%"><span>${p.n != null ? esc(p.n) : ""}</span></span>`;
    return `<div class="mini-map area-map${cls ? " " + cls : ""}" style="--map-ratio: ${w.toFixed(1)} / ${hh.toFixed(1)}"${label ? ` role="img" aria-label="${attr(label)}"` : ""}><svg viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${w.toFixed(1)} ${hh.toFixed(1)}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><use href="${root}assets/map/basemap.svg#bm"/></svg>${pts.map(pin).join("")}</div>`;
  }

  /** Festival days with a live event at the venue (exhibitions count on every day they are open). */
  const daysOf = (v) => [...new Set(v.events.filter((e) => e.live).flatMap((e) => e.instances.map((x) => x.day)))].sort();
  const worksOf = (v) => db.worksByVenue.get(v.id) || [];
  const hubOf = new Map(db.programs.filter((p) => p.hub_venue_id).map((p) => [p.hub_venue_id, p.id]));

  /** One line per program: what the venue has for it ("StartupCincy Week hub · 4 events", "BLINK · 12 works"). */
  function roles(v) {
    return v.programs.map((p) => {
      const ne = v.events.filter((e) => e.live && e.program === p).length, nw = worksOf(v).filter((w) => w.program === p).length;
      const bits = [hubOf.get(v.id) === p ? "hub" : "", ne ? plural(ne, "event") : "", nw ? plural(nw, "work") : ""].filter(Boolean);
      return `<li>${bullet(p)}<span>${esc(c.progName(p))}${bits.length ? ` · ${esc(bits.join(" · ").replace(/^hub · /, "hub, "))}` : ""}</span></li>`;
    }).join("");
  }

  function venueCard(root, v, { anchor = true, headingLevel = 3, show = true } = {}) {
    const prog = v.programs[0] || "also";
    const hood = v.hood ? db.byId.place.get(v.hood) : null;
    const place = hood ? (hood.name.includes("(") ? hood.short_name || hood.name : hood.name) : v.neighborhood || (v.city && v.city !== "Cincinnati" ? [v.city, v.state].filter(Boolean).join(", ") : "");
    const addr = [v.address, place].filter(Boolean).join(" · ");
    const days = daysOf(v);
    const w = where(v);
    const d = directionsTo(v);
    const H = `h${headingLevel}`;
    const q = norm([...(v.aliases || []), v.city, v.kind, v.neighborhood].filter(Boolean).join(" "));
    const acts = [
      d ? `<span class="acts-l">${icon(d.walk ? "walk" : "pin")}${d.walk ? "Walking directions" : "Directions"}</span>${d.apple ? extLink(d.apple, "Apple Maps", "btn btn-secondary btn-sm") : ""}${extLink(d.google, "Google Maps", "btn btn-secondary btn-sm")}` : "",
      show && w === "on" ? `<a class="btn btn-ghost btn-sm" href="${root}map.html?focus=venue:${attr(v.id)}" data-map-focus="venue:${attr(v.id)}">${icon("map")}On the map</a>` : "",
    ].join("");
    return `<li class="venue" data-prog="${prog}"${v.programs[1] ? ` data-prog2="${v.programs[1]}"` : ""}${anchor ? ` id="v-${attr(v.id)}"` : ""} data-p="${attr(v.programs.join(" "))}" data-h="${attr(v.hood || "")}" data-day="${days.join(" ")}" data-q="${attr(q)}"${w === "on" ? ` data-ll="${v.lat},${v.lng}" data-n="${v.stall}"` : ""}>`
      + `<span class="stall${v.stall ? "" : " is-off"}"${v.stall ? ` title="Map number ${v.stall}"` : ""} aria-hidden="true">${v.stall || "–"}</span>`
      + `<${H}><a href="${root}venues/${attr(v.id)}.html">${v.stall ? `<span class="sr-only">${v.stall}. </span>` : ""}${esc(v.name)}</a></${H}>`
      + (addr ? `<p class="addr">${esc(addr)}</p>` : "")
      + (v.programs.length ? `<ul class="roles">${roles(v)}</ul>` : "")
      + (days.length ? `<p class="today"><span>${esc(days.length > 4 ? `${fmtDay(days[0])} to ${fmtDay(days[days.length - 1])}` : days.map(fmtDay).join(" · "))}</span></p>` : "")
      + (w !== "on" ? `<p class="today">${placeStatus(v)}</p>` : "")
      + (acts ? `<div class="acts">${acts}</div>` : "")
      + `</li>`;
  }

  return { venueCard, miniMap, areaMap, directions, directionsTo, where, placeStatus, meta, nearbyOf, walkLabel, daysOf, mPerUnit: meta ? meta.mPerUnit : METERS_PER_DEG_LAT };
}
