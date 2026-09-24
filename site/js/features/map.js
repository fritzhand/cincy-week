/* ============================================================
   site/js/features/map.js · OWNER: Agent E (map, venues & visit)
   The interactive map (engine spec §4.10, DESIGN.md §9.7): the token-themed OSM basemap inlined from
   assets/map/basemap.svg, labels and HTML pin buttons positioned by lib/geo.js, pan and zoom (drag, wheel,
   pinch, double-click/tap, + − fit buttons, arrow keys / + − 0 when the map has focus), 44px clustering
   with a program-share ring, the edge chip for what lies outside the view, "Near me" (never stored).

   mountMap(el, { pins, fit, focus, onSelect, onList, onClear, onHover, wheel, title, nearMe }) → { update(pins), select(id, opts),
     highlight(id), fit(), home(), locate(), destroy(), el }
     el      an empty container (a .map-box is built in it) or a .map-box the build rendered (map.html)
     pins    [{ id, kind: "venue"|"work"|"stay"|"stop"|"food", lat, lng, prog, prog2?, n?, label, live?, meta?, href?, h? }]
     fit     true: open on the pins; else the home frame (data/map.json bbox.home)
     focus   a pin id to open on, zoomed in and selected
     onSelect(id, pin, { keyboard })   called on a pin; without it a small card in the map shows the pin
     onList(ids, { keyboard })         called on a cluster that zooming cannot split; without it the card lists them
     onClear()                         called when the selection is cleared (Esc, the card's close button)
   init(app): map.html (layers, program and day filters, side panel / bottom sheet, list sync, ?layers ?p ?day
   ?focus), venues.html (List/Map, ?view=map, pins follow the directory filters) and stay.html (hotels).
   Nothing here is the only path to anything: every pin is also a list item in the page's HTML.
   ============================================================ */
import { project, metaOf, onMap, cluster, clampView, fitScale } from "../lib/geo.js";
import { esc } from "../lib/text.js";
import { nyParts, fmtTime, fmtDay, fmtDayLong } from "../lib/time.js";

const DOC = document.documentElement;
const ROOT = DOC.dataset.root || "";
const V = DOC.dataset.v || "";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const I = (n, cls = "") => `<svg class="i${cls ? " " + cls : ""}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const MAX_S = 6;             // px per basemap unit at the closest zoom (≈ 1 px per meter)
const Z1 = 0.36;             // px per unit that counts as zoom level 1 for label minZoom (a phone showing the whole map)
const KIND_ORDER = { venue: 0, work: 1, stay: 2, stop: 3, food: 4 };
const KIND_WORD = { venue: ["venue", "venues"], work: ["artwork", "artworks"], stay: ["place to stay", "places to stay"], stop: ["transit stop", "transit stops"], food: ["place to eat or drink", "places to eat or drink"] };
const LABEL_RANK = { hood: 0, water: 1, state: 2, park: 3, bridge: 4, street: 5 };
const PROG_KEY = { caw: "a", scw: "s", blink: "b", fotofocus: "f", also: "f" };
const cwApp = () => window.cw || null;
const toast = (t) => { const a = cwApp(); if (a && a.toast) a.toast(t, { ms: 4000 }); };
const directions = (lat, lng) => ({ apple: `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=w`, google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking` });
const ext = (href, html, cls) => `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener">${html}<span class="sr-only"> (opens in a new tab)</span></a>`;
const plural = (n, [one, many]) => `${n} ${n === 1 ? one : many}`;

/* ---------- shared, memoized loads ---------- */
let metaP = null, svgP = null;
function loadMeta() {
  if (!metaP) metaP = fetch(`${ROOT}assets/data/map-meta.json${V ? `?v=${V}` : ""}`).then((r) => { if (!r.ok) throw new Error(`map-meta ${r.status}`); return r.json(); }).then((m) => ({ raw: m, meta: metaOf(m) }));
  metaP.catch(() => { metaP = null; });
  return metaP;
}
function loadSvg() {
  // the same URL the mini-maps' <use href> points at, so the browser fetches the file once
  if (!svgP) svgP = fetch(`${ROOT}assets/map/basemap.svg`).then((r) => { if (!r.ok) throw new Error(`basemap ${r.status}`); return r.text(); });
  svgP.catch(() => { svgP = null; });
  return svgP;
}

/* ============================================================ mountMap ============================================================ */
export function mountMap(el, opts = {}) {
  let box = el.classList && el.classList.contains("map-box") ? el : el.querySelector(".map-box");
  if (!box) {
    el.innerHTML = `<div class="map-box"><div class="map-bar"><p class="label">${esc(opts.title || "Map")}</p>${opts.nearMe === false ? "" : `<button class="btn btn-secondary btn-sm" type="button" data-near-me>${I("locate")}Near me</button>`}</div><div class="map-view" data-map-view></div><div class="map-legend" data-own-legend><span data-lk="venue" hidden><i class="lg-station"></i>Venue, numbered as in the list</span><span data-lk="work" hidden><i class="lg-work"></i>Artwork</span><span data-lk="stay" hidden><i class="lg-stay"></i>Place to stay</span><span><i class="lg-cluster"></i>Several places: tap to zoom</span><span><i class="lg-tram"></i>Connector streetcar</span><a class="map-attrib" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors<span class="sr-only"> (opens in a new tab)</span></a></div></div>`;
    box = el.querySelector(".map-box");
  }
  const view = $(".map-view", box);
  const S = { pins: [], byId: new Map(), els: new Map(), sel: null, hi: null, you: null, v: null, vw: 0, vh: 0, ready: false, meta: null, labels: [], placed: [], init: true };
  let pending = opts.pins || [];
  const ac = new AbortController();
  const on = (t, ev, fn, o = {}) => t.addEventListener(ev, fn, { signal: ac.signal, ...o });

  view.classList.add("is-loading");
  view.setAttribute("role", "group");
  view.setAttribute("aria-roledescription", "map");
  view.tabIndex = 0;
  view.setAttribute("aria-label", `${opts.title || "Map"}. Arrow keys pan, plus and minus zoom, 0 shows the whole area. Every place on the map is also in the list on this page.`);

  const api = {
    el: box,
    update(pins) { pending = pins || []; if (S.ready) setPins(pending); },
    select(id, o = {}) { const p = S.byId.get(id); if (!p) return false; choose(p, { ...o, fromApi: true }); return true; },
    highlight(id) { S.hi = id || null; paintHi(); },
    fit() { if (S.ready) fitTo(S.pins.length ? S.pins : null); },
    home() { if (S.ready) goHome(); },
    locate,
    destroy() { ac.abort(); ro && ro.disconnect(); view.innerHTML = ""; },
    get view() { return S.v; },
  };

  let ro = null;
  Promise.all([loadMeta(), loadSvg()]).then(([m, svgText]) => {
    if (ac.signal.aborted) return;
    S.meta = m.meta;
    if (!S.meta) throw new Error("no projection");
    S.labels = (m.raw.labels || []).map((l) => ({ ...l, xy: project(l.lat, l.lng, S.meta), rank: LABEL_RANK[l.kind] ?? 9 })).sort((a, b) => a.rank - b.rank);
    S.hoodName = new Map((m.raw.labels || []).filter((l) => l.kind === "hood" && l.id).map((l) => [l.id, l.text]));
    build(svgText);
    S.ready = true;
    setPins(pending);
    view.classList.remove("is-loading");
    ro = new ResizeObserver(() => {
      const r = view.getBoundingClientRect();
      if (Math.abs(r.width - S.vw) < 0.5 && Math.abs(r.height - S.vh) < 0.5) return;
      S.vw = r.width; S.vh = r.height;
      if (S.init) setPins(pending); else { S.v = clamp(S.v); render(true); }
    });
    ro.observe(view);
  }).catch((e) => {
    console.error("[cw] map", e);
    view.classList.remove("is-loading");
    view.insertAdjacentHTML("beforeend", `<p class="map-fail unk">The map could not load. Every place is in the list on this page.</p>`);
  });

  /* ---------- DOM ---------- */
  let svg, labelsEl, pinsEl, edgeBtn, card, hint;
  function build(svgText) {
    const g = new DOMParser().parseFromString(svgText, "image/svg+xml").getElementById("bm");
    view.textContent = "";
    view.insertAdjacentHTML("beforeend", `<svg class="map-base" preserveAspectRatio="none" aria-hidden="true" focusable="false"></svg><div class="map-labels" aria-hidden="true"></div><div class="map-pins"></div>
<div class="map-zoom"><button type="button" data-zoom="in" aria-label="Zoom in">${I("plus")}</button><button type="button" data-zoom="out" aria-label="Zoom out">${I("minus")}</button><button type="button" data-zoom="fit" aria-label="Show the whole area">${I("fit")}</button></div>
<button class="map-edge" type="button" hidden></button><p class="map-hint" hidden></p><div class="map-card" role="region" aria-label="Selected place" hidden></div>`);
    svg = $(".map-base", view); labelsEl = $(".map-labels", view); pinsEl = $(".map-pins", view);
    edgeBtn = $(".map-edge", view); card = $(".map-card", view); hint = $(".map-hint", view);
    if (g) { g.removeAttribute("id"); svg.appendChild(document.importNode(g, true)); }
    const r = view.getBoundingClientRect(); S.vw = r.width; S.vh = r.height;
    wire();
  }

  /* ---------- the view: center (units), s (px per unit) ---------- */
  const clamp = (v) => clampView(v, Math.max(1, S.vw), Math.max(1, S.vh), S.meta, MAX_S);
  const unitsBox = (pts) => { const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
  function fitBox(b, pad = 44, maxS = 2.6) {
    const s = Math.min(maxS, fitScale(b, S.vw, S.vh, pad));
    S.v = clamp({ cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2, s });
  }
  function homeBox() { const h = S.meta.home; const [x0, y0] = project(h.n, h.w, S.meta), [x1, y1] = project(h.s, h.e, S.meta); return [x0, y0, x1, y1]; }
  function goHome(anim = true) { const t = S.v; fitBox(homeBox(), 0, MAX_S); if (anim && t) animateFrom(t); else render(true); }
  function fitTo(pins, anim = true) {
    const t = S.v;
    if (!pins || !pins.length) fitBox(homeBox(), 0, MAX_S); else fitBox(unitsBox(pins), 56, pins.length === 1 ? 2.4 : 2.6);
    if (anim && t) animateFrom(t); else render(true);
  }
  function zoomAt(f, px = S.vw / 2, py = S.vh / 2, anim = false) {
    const t = S.v, v = S.v;
    const ux = v.cx + (px - S.vw / 2) / v.s, uy = v.cy + (py - S.vh / 2) / v.s;
    const s = Math.min(MAX_S, v.s * f);
    S.v = clamp({ s, cx: ux - (px - S.vw / 2) / s, cy: uy - (py - S.vh / 2) / s });
    if (anim) animateFrom(t); else render(true);
  }
  let animId = 0;
  function animateFrom(from) {
    const to = S.v, id = ++animId;
    if (still() || !from) { render(true); return; }
    const t0 = performance.now(), D = 180;
    const step = (t) => {
      if (id !== animId) return;
      const k = Math.min(1, (t - t0) / D), e = 1 - (1 - k) ** 3;
      S.v = { cx: from.cx + (to.cx - from.cx) * e, cy: from.cy + (to.cy - from.cy) * e, s: from.s * (to.s / from.s) ** e };
      if (k < 1) { render(false); requestAnimationFrame(step); } else { S.v = to; render(true); }
    };
    requestAnimationFrame(step);
  }

  /* ---------- pins ---------- */
  function setPins(pins) {
    const prevEmpty = !S.pins.length;
    S.pins = pins.filter((p) => onMap(S.meta, p.lat, p.lng)).map((p) => { const [x, y] = project(p.lat, p.lng, S.meta); return { ...p, x, y }; })
      .sort((a, b) => (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9) || (a.n || 999) - (b.n || 999));
    S.byId = new Map(S.pins.map((p) => [p.id, p]));
    for (const p of S.pins) { p.el = pinEl(p, S.els.get(p.id)); S.els.set(p.id, p.el); }
    const kinds = new Set(S.pins.map((p) => p.kind));
    for (const l of $$("[data-own-legend] [data-lk]", box)) l.hidden = !kinds.has(l.dataset.lk);
    if (S.sel && !S.byId.has(S.sel)) { S.sel = null; if (card) card.hidden = true; }
    if (S.vw < 10 || S.vh < 10) return;                 // not laid out yet (hidden): the ResizeObserver calls back
    if (S.init) {
      S.init = false;
      const f = opts.focus && S.byId.get(opts.focus);
      if (f) { S.v = clamp({ cx: f.x, cy: f.y, s: Math.max(2.4, fitScale(homeBox(), S.vw, S.vh, 0)) }); S.sel = f.id; if (!opts.onSelect) showCard(f); }
      else if (opts.fit && S.pins.length) fitBox(unitsBox(S.pins), 56, S.pins.length === 1 ? 2.4 : 2.6);
      else fitBox(homeBox(), 0, MAX_S);
    } else if (opts.fit && prevEmpty && S.pins.length) fitBox(unitsBox(S.pins), 56, 2.6);
    render(true);
  }
  /** A pin button (reused across updates so focus and hover survive filtering). */
  function pinEl(p, b) {
    if (!b) { b = document.createElement("button"); b.type = "button"; }
    b.className = `pin pin-${p.kind}${p.live ? " is-live" : ""}`;
    if (p.prog) b.dataset.prog = p.prog; else delete b.dataset.prog;
    if (p.prog2) b.dataset.prog2 = p.prog2; else delete b.dataset.prog2;
    b.dataset.pin = p.id;
    b.setAttribute("aria-pressed", String(S.sel === p.id));
    b.setAttribute("aria-label", `${p.n ? `${p.n}. ` : ""}${p.label}${p.live ? ", something on now" : ""}`);
    const inner = p.kind === "venue" ? `<span>${esc(p.n || "")}</span>` : p.kind === "stay" ? `<span>${I("bed")}</span>` : "<span></span>";
    if (b.innerHTML !== inner) b.innerHTML = inner;
    return b;
  }

  /* ---------- render: viewBox, labels, pins and clusters ---------- */
  let raf = 0;
  const queue = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(false); }); };
  function render(full) {
    if (!S.ready || !S.v) return;
    const v = S.v, w = S.vw / v.s, h = S.vh / v.s, x0 = v.cx - w / 2, y0 = v.cy - h / 2;
    svg.setAttribute("viewBox", `${x0.toFixed(2)} ${y0.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`);
    const sx = (x) => (x - x0) * v.s, sy = (y) => (y - y0) * v.s;
    if (full) {
      view.dataset.lod = v.s < 0.5 ? "0" : v.s < 1.2 ? "1" : "2";
      view.style.setProperty("--mw", v.s < 0.5 ? ".7" : v.s < 0.9 ? ".85" : v.s < 1.8 ? "1" : "1.25");
      layoutPins(sx, sy);
      layoutLabels(sx, sy, v);
      edge(x0, y0, w, h);
    } else {
      for (const l of S.shownLabels || []) { l.el.style.left = `${sx(l.xy[0])}px`; l.el.style.top = `${sy(l.xy[1]) + l.dy}px`; }
      for (const p of S.placed) { p.el.style.left = `${sx(p.x)}px`; p.el.style.top = `${sy(p.y)}px`; }
    }
    if (S.you) { S.you.el.style.left = `${sx(S.you.x)}px`; S.you.el.style.top = `${sy(S.you.y)}px`; }
  }
  function layoutLabels(sx, sy, v) {
    const z = v.s / Z1, shown = [];
    // pins win: a label slides up or down to clear them (area names), or stays hidden (streets)
    const boxes = S.placed.map((p) => { const x = sx(p.x), y = sy(p.y), r = p.cluster ? 20 : 16; return [x - r, y - r, x + r, y + r]; });
    // QA: the controls drawn over the map count as obstacles too, so no label hides under the zoom buttons or the edge chip
    const vr = view.getBoundingClientRect();
    for (const c of view.querySelectorAll(".map-zoom, .map-edge:not([hidden])")) { const b = c.getBoundingClientRect(); if (b.width) boxes.push([b.left - vr.left - 4, b.top - vr.top - 4, b.right - vr.left + 4, b.bottom - vr.top + 4]); }
    const hit = (r) => boxes.some((b) => r[0] < b[2] && r[2] > b[0] && r[1] < b[3] && r[3] > b[1]);
    labelsEl.textContent = "";
    for (const l of S.labels) {
      if (l.minZoom > z + 1e-9) continue;
      const x0 = sx(l.xy[0]), y0 = sy(l.xy[1]);
      if (x0 < -60 || y0 < -20 || x0 > S.vw + 60 || y0 > S.vh + 20) continue;
      const wpx = l.text.length * (l.kind === "hood" || l.kind === "state" ? 8.4 : 6.6) + 10, hpx = 18;
      const a = ((l.angle || 0) * Math.PI) / 180, bw = Math.abs(wpx * Math.cos(a)) + Math.abs(hpx * Math.sin(a)), bh = Math.abs(wpx * Math.sin(a)) + Math.abs(hpx * Math.cos(a));
      let r = null, x = x0, y = y0;
      for (const dy of l.kind === "street" || l.kind === "bridge" ? [0] : [0, -24, 24, -46, 46]) {
        const c = [x0 - bw / 2, y0 + dy - bh / 2, x0 + bw / 2, y0 + dy + bh / 2];
        if (c[0] < 4 || c[2] > S.vw - 4 || c[1] < 4 || c[3] > S.vh - 4 || hit(c)) continue;
        r = c; y = y0 + dy; break;
      }
      if (!r) continue;
      boxes.push(r);
      const e = document.createElement("span");
      e.className = `map-label ${l.kind}`;
      e.textContent = l.text;
      if (l.angle) e.style.setProperty("--a", `${l.angle}deg`);
      e.style.left = `${x}px`; e.style.top = `${y}px`;
      labelsEl.appendChild(e);
      shown.push({ ...l, el: e, dy: y - y0 });
    }
    S.shownLabels = shown;
  }
  function layoutPins(sx, sy) {
    const M = 30, pts = [];
    for (const p of S.pins) {
      const x = sx(p.x), y = sy(p.y);
      if (x < -M || y < -M || x > S.vw + M || y > S.vh + M) continue;
      pts.push({ p, x, y });
    }
    // the selected pin stays on its own, above any cluster it sits in
    const sel = pts.find((q) => q.p.id === S.sel);
    const groups = cluster(pts.filter((q) => q !== sel), 44);
    if (sel) groups.push({ x: sel.x, y: sel.y, members: [sel] });
    const keep = new Set(), placed = [];
    for (const g of groups) {
      if (g.members.length === 1) { const p = g.members[0].p; keep.add(p.el); placed.push(p); continue; }
      const ms = g.members.map((m) => m.p);
      const cnt = { a: 0, s: 0, b: 0, f: 0, o: 0 };
      for (const m of ms) cnt[PROG_KEY[m.prog] || "o"]++;
      const el = document.createElement("button");
      el.type = "button";
      el.className = `pin pin-cluster${ms.some((m) => m.live) ? " is-live" : ""}${ms.some((m) => m.id === S.hi) ? " is-hi" : ""}`;
      for (const k in cnt) el.style.setProperty(`--${k}`, cnt[k]);
      const kinds = Object.entries(ms.reduce((a, m) => ((a[m.kind] = (a[m.kind] || 0) + 1), a), {})).map(([k, n]) => plural(n, KIND_WORD[k] || ["place", "places"]));
      el.setAttribute("aria-label", `${ms.length} places here: ${kinds.join(", ")}. ${canSplit(ms) ? "Zoom in to see them" : "List them"}`);
      el.innerHTML = `<span>${ms.length}</span>`;
      el._members = ms;
      const c = { el, x: ms.reduce((a, m) => a + m.x, 0) / ms.length, y: ms.reduce((a, m) => a + m.y, 0) / ms.length, cluster: true };
      placed.push(c);
      keep.add(el);
    }
    // swap the pin layer's children (reuse pin buttons; clusters are rebuilt)
    const had = document.activeElement && pinsEl.contains(document.activeElement) ? document.activeElement : null;
    for (const ch of [...pinsEl.children]) if (!keep.has(ch)) ch.remove();
    for (const p of placed) { p.el.style.left = `${sx(p.x)}px`; p.el.style.top = `${sy(p.y)}px`; if (p.el.parentNode !== pinsEl) pinsEl.appendChild(p.el); }
    if (S.you) pinsEl.appendChild(S.you.el);
    S.placed = placed;
    if (S.focusAfter) {
      // after a keyboard zoom into a cluster, focus goes to its first place (or the smaller cluster holding it)
      const id = S.focusAfter, p = S.byId.get(id);
      const target = p && p.el.isConnected ? p.el : (placed.find((c) => c.cluster && c.el._members.some((m) => m.id === id)) || {}).el;
      if (target) { S.focusAfter = null; target.focus({ preventScroll: true }); }
    } else if (had && !had.isConnected) view.focus({ preventScroll: true });
    paintHi();
  }
  const canSplit = (ms) => { const b = unitsBox(ms); return S.v.s < MAX_S - 1e-6 && Math.max(b[2] - b[0], b[3] - b[1]) * MAX_S > 30; };
  function paintHi() {
    if (!S.ready) return;
    for (const p of S.pins) { p.el.classList.toggle("is-hi", p.id === S.hi); p.el.setAttribute("aria-pressed", String(p.id === S.sel)); }
    for (const c of S.placed) if (c.cluster) c.el.classList.toggle("is-hi", c.el._members.some((m) => m.id === S.hi));
  }

  /* ---------- the edge chip: what lies beyond the frame, counted, one tap away ---------- */
  let edgeGroup = null;
  function edge(x0, y0, w, h) {
    const off = S.pins.filter((p) => p.x < x0 || p.x > x0 + w || p.y < y0 || p.y > y0 + h);
    if (!off.length) { edgeBtn.hidden = true; edgeGroup = null; return; }
    const dir4 = (p) => { const dx = p.x - S.v.cx, dy = p.y - S.v.cy; return Math.abs(dy) > Math.abs(dx) ? (dy > 0 ? "south" : "north") : dx > 0 ? "east" : "west"; };
    const by = new Map();
    for (const p of off) { const d = dir4(p); if (!by.has(d)) by.set(d, []); by.get(d).push(p); }
    const [dir, ps] = [...by].sort((a, b) => b[1].length - a[1].length)[0];
    const hoods = new Map(); for (const p of ps) if (p.h) hoods.set(p.h, (hoods.get(p.h) || 0) + 1);
    const top = [...hoods].sort((a, b) => b[1] - a[1])[0];
    const where = top && top[1] >= ps.length / 2 ? S.hoodName.get(top[0]) || "" : "";
    const kinds = new Set(ps.map((p) => p.kind)), progs = new Set(ps.map((p) => p.prog));
    const noun = kinds.size === 1 ? (ps[0].kind === "work" && progs.size === 1 && ps[0].prog === "blink" ? ["BLINK work", "BLINK works"] : KIND_WORD[ps[0].kind]) : ["place", "places"];
    const more = off.length - ps.length;
    edgeGroup = ps;
    edgeBtn.innerHTML = `${I("arrow-r", `dir-${dir}`)}<span>${where ? `${esc(where)}: ` : ""}${esc(plural(ps.length, noun))} to the ${dir}${more ? ` · ${more} more elsewhere` : ""}</span>`;
    edgeBtn.setAttribute("aria-label", `Show ${plural(ps.length, noun)} to the ${dir}${where ? `, in ${where}` : ""}`);
    edgeBtn.classList.toggle("at-top", dir === "north");
    edgeBtn.hidden = false;
  }

  /* ---------- selection ---------- */
  function choose(p, { keyboard = false, zoom = false, fromApi = false } = {}) {
    S.sel = p.id;
    if (zoom || fromApi) {
      const t = S.v;
      S.v = clamp({ cx: p.x, cy: p.y, s: zoom ? Math.max(S.v.s, 2.4) : S.v.s });
      animateFrom(t);
    } else render(true);
    paintHi();
    if (opts.onSelect && !fromApi) { card.hidden = true; opts.onSelect(p.id, p, { keyboard }); }
    else if (!opts.onSelect) showCard(p, keyboard);
  }
  function showCard(p, focus = false) {
    const d = directions(p.lat, p.lng);
    card.innerHTML = `<button class="map-card-x" type="button" aria-label="Close">${I("x")}</button><p class="label faint">${esc(p.n ? `No. ${p.n}` : (KIND_WORD[p.kind] || ["Place"])[0])}</p><h3 tabindex="-1">${esc(p.label)}</h3>${p.meta ? `<p class="muted">${esc(p.meta)}</p>` : ""}<p class="btn-row">${p.href ? `<a class="btn btn-secondary btn-sm" href="${esc(p.href)}">Open${I("arrow-r")}</a>` : ""}${ext(d.apple, "Apple Maps", "btn btn-ghost btn-sm")}${ext(d.google, "Google Maps", "btn btn-ghost btn-sm")}</p>`;
    card.hidden = false;
    if (focus) $("h3", card).focus();
  }
  function clearSel() { S.sel = null; if (card) card.hidden = true; paintHi(); if (opts.onClear) opts.onClear(); }

  /* ---------- "Near me": asked for, used once, never stored ---------- */
  function locate() {
    if (!navigator.geolocation) { toast("This browser can't share your location."); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      if (!onMap(S.meta, lat, lng)) { toast("You're outside the map area."); return; }
      const [x, y] = project(lat, lng, S.meta);
      if (!S.you) { const e = document.createElement("span"); e.className = "pin pin-you"; e.setAttribute("role", "img"); e.setAttribute("aria-label", "You are here"); e.innerHTML = "<span></span>"; S.you = { el: e }; pinsEl.appendChild(e); }
      S.you.x = x; S.you.y = y;
      const t = S.v; S.v = clamp({ cx: x, cy: y, s: Math.max(S.v.s, 2.4) }); animateFrom(t);
      toast("Showing where you are. Your location stays on this device.");
    }, () => toast("Your location is not available."), { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  }

  /* ---------- input ---------- */
  function wire() {
    on(box, "click", (e) => {
      const z = e.target.closest("[data-zoom]");
      if (z) { const k = z.dataset.zoom; if (k === "fit") fitTo(opts.fit && S.pins.length ? S.pins : null); else zoomAt(k === "in" ? 1.8 : 1 / 1.8, S.vw / 2, S.vh / 2, true); return; }
      if (e.target.closest("[data-near-me]")) { locate(); return; }
      if (e.target.closest(".map-card-x")) { clearSel(); view.focus({ preventScroll: true }); return; }
      if (e.target.closest(".map-edge")) { if (edgeGroup) fitTo(edgeGroup); return; }
      const pb = e.target.closest("button.pin");
      if (!pb || !view.contains(pb)) return;
      if (moved) { e.preventDefault(); return; }
      const kb = e.detail === 0;
      if (pb.classList.contains("pin-cluster")) {
        const ms = pb._members;
        if (canSplit(ms)) { if (kb) S.focusAfter = ms[0].id; fitTo(ms); }
        else if (opts.onList) opts.onList(ms.map((m) => m.id), { keyboard: kb });
        else { card.innerHTML = `<button class="map-card-x" type="button" aria-label="Close">${I("x")}</button><p class="label faint">${ms.length} places here</p><ul class="map-card-list">${ms.map((m) => `<li><button type="button" data-pick="${esc(m.id)}">${m.n ? `<b>${esc(m.n)}</b> ` : ""}${esc(m.label)}</button></li>`).join("")}</ul>`; card.hidden = false; if (kb) $("[data-pick]", card).focus(); }
        return;
      }
      const p = S.byId.get(pb.dataset.pin);
      if (p) choose(p, { keyboard: kb });
    });
    on(box, "click", (e) => { const pk = e.target.closest("[data-pick]"); if (pk) { const p = S.byId.get(pk.dataset.pick); if (p) choose(p, { keyboard: e.detail === 0, zoom: true }); } });
    on(pinsEl, "pointerover", (e) => { const pb = e.target.closest("button.pin"); if (pb && opts.onHover) opts.onHover(pb.dataset.pin || null); });
    on(pinsEl, "pointerout", (e) => { if (opts.onHover && !pinsEl.contains(e.relatedTarget)) opts.onHover(null); });
    on(pinsEl, "focusin", (e) => { const pb = e.target.closest("button.pin"); if (pb && opts.onHover) opts.onHover(pb.dataset.pin || null); });
    on(view, "keydown", (e) => {
      if (e.key === "Escape" && (S.sel || !card.hidden)) { clearSel(); return; }
      if (e.target !== view) return;
      const step = 80 / S.v.s;
      const k = e.key;
      if (k === "ArrowLeft" || k === "ArrowRight" || k === "ArrowUp" || k === "ArrowDown") {
        const t = S.v;
        S.v = clamp({ ...S.v, cx: S.v.cx + (k === "ArrowLeft" ? -step : k === "ArrowRight" ? step : 0), cy: S.v.cy + (k === "ArrowUp" ? -step : k === "ArrowDown" ? step : 0) });
        animateFrom(t);
      } else if (k === "+" || k === "=") zoomAt(1.6, S.vw / 2, S.vh / 2, true);
      else if (k === "-" || k === "_") zoomAt(1 / 1.6, S.vw / 2, S.vh / 2, true);
      else if (k === "0") fitTo(opts.fit && S.pins.length ? S.pins : null);
      else return;
      e.preventDefault();
    });
    // wheel: on the map page always; embedded maps want Ctrl/⌘ so the page still scrolls
    let hintT = 0;
    on(view, "wheel", (e) => {
      if (opts.wheel !== "always" && !(e.ctrlKey || e.metaKey)) {
        hint.textContent = `Hold ${/mac/i.test(navigator.platform) ? "⌘" : "Ctrl"} and scroll to zoom the map`;
        hint.hidden = false; clearTimeout(hintT); hintT = setTimeout(() => { hint.hidden = true; }, 1400);
        return;
      }
      e.preventDefault();
      const r = view.getBoundingClientRect();
      zoomAt(Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * 0.006), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    // drag and pinch (pointer events; the map claims the gesture: touch-action none)
    const ptrs = new Map();
    let moved = false, start = null, pinch = null, lastTap = 0, lastTapXY = null, lastType = "mouse";
    // double-click zooms with a mouse; touch has its own double-tap below (some browsers also send dblclick)
    on(view, "dblclick", (e) => { if (lastType === "touch" || e.target.closest("button")) return; const r = view.getBoundingClientRect(); zoomAt(2, e.clientX - r.left, e.clientY - r.top, true); });
    on(view, "pointerdown", (e) => {
      lastType = e.pointerType;
      if (e.target.closest(".map-zoom, .map-edge, .map-card, .map-hint")) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) { moved = false; start = { x: e.clientX, y: e.clientY, v: { ...S.v } }; }
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, v: { ...S.v } }; moved = true; }
    });
    on(view, "pointermove", (e) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const r = view.getBoundingClientRect();
      if (ptrs.size >= 2 && pinch) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const s = Math.min(MAX_S, pinch.v.s * (d / Math.max(1, pinch.d)));
        const ux = pinch.v.cx + (pinch.mx - r.left - S.vw / 2) / pinch.v.s, uy = pinch.v.cy + (pinch.my - r.top - S.vh / 2) / pinch.v.s;
        S.v = clamp({ s, cx: ux - (mx - r.left - S.vw / 2) / s, cy: uy - (my - r.top - S.vh / 2) / s });
        queue();
        return;
      }
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < 5) return;
      if (!moved) { moved = true; try { view.setPointerCapture(e.pointerId); } catch { /* gone */ } view.classList.add("is-dragging"); }
      S.v = clamp({ s: start.v.s, cx: start.v.cx - dx / start.v.s, cy: start.v.cy - dy / start.v.s });
      queue();
    });
    const end = (e) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (ptrs.size === 1 && pinch) { const [a] = [...ptrs.values()]; pinch = null; start = { x: a.x, y: a.y, v: { ...S.v } }; return; }
      if (ptrs.size) return;
      pinch = null;
      view.classList.remove("is-dragging");
      if (moved) { render(true); setTimeout(() => { moved = false; }, 0); }
      else if (e.pointerType === "touch" && !e.target.closest("button")) {
        const t = performance.now();
        if (t - lastTap < 320 && lastTapXY && Math.hypot(e.clientX - lastTapXY.x, e.clientY - lastTapXY.y) < 30) { const r = view.getBoundingClientRect(); zoomAt(2, e.clientX - r.left, e.clientY - r.top, true); lastTap = 0; }
        else { lastTap = t; lastTapXY = { x: e.clientX, y: e.clientY }; }
      }
      start = null;
    };
    on(view, "pointerup", end);
    on(view, "pointercancel", end);
  }
  return api;
}

/* ============================================================ pages ============================================================ */
export function init(app) {
  if ($("[data-map-page]")) mapPage(app);
  if ($("[data-venue-map]")) venuesPage(app);
  if ($("[data-stay-map]")) stayPage(app);
}

/* ---------- map.html ---------- */
const DEFAULT_LAYERS = ["venues", "art"];
function mapPage(app) {
  const page = $("[data-map-page]");
  const box = $("[data-map-box]", page), list = $("[data-map-list]", page), panel = $("[data-map-panel]", page);
  const countEl = $("[data-map-count]", page);
  const items = $$("li.map-li[data-id]", list).map((el) => {
    const [lat, lng] = el.dataset.ll.split(",").map(Number);
    const a = $("a.t", el);
    return { el, id: el.dataset.id, kind: el.dataset.kind, layer: el.dataset.layer, lat, lng, p: (el.dataset.p || "").split(" ").filter(Boolean), days: (el.dataset.day || "").split(" ").filter(Boolean), h: el.dataset.h || "", n: el.dataset.n || "", label: a ? a.textContent.replace(/^\d+\.\s*/, "").trim() : "", meta: ($(".m", el) || {}).textContent || "", href: a ? a.getAttribute("href") : "" };
  });
  const byId = new Map(items.map((x) => [x.id, x]));
  const layerBtns = $$("button[data-layer]", page), progBtns = $$("[data-mp]", page), daySel = $("[data-md]", page);
  const LAYERS = layerBtns.map((b) => b.dataset.layer), PROGS = progBtns.map((b) => b.dataset.mp), DAYS = daySel ? [...daySel.options].map((o) => o.value).filter(Boolean) : [];
  const progName = new Map(progBtns.map((b) => [b.dataset.mp, ($("span", b) || b).textContent.trim()]));

  // state from the URL, checked against what the page offers
  const q = new URLSearchParams(location.search);
  const listOf = (k, ok) => (q.get(k) || "").split(",").filter((x) => ok.includes(x));
  const st = { layers: q.has("layers") ? listOf("layers", LAYERS) : DEFAULT_LAYERS.filter((l) => LAYERS.includes(l)), p: listOf("p", PROGS), day: DAYS.includes(q.get("day")) ? q.get("day") : "", focus: byId.has(q.get("focus") || "") ? q.get("focus") : null, sel: null };
  if (st.focus && !st.layers.includes(byId.get(st.focus).layer)) st.layers.push(byId.get(st.focus).layer);

  let evData = null, live = new Set();
  const visible = (x) => st.layers.includes(x.layer)
    && (!st.p.length || !x.p.length || x.p.some((p) => st.p.includes(p)) || (x.kind !== "venue" && x.kind !== "work"))
    && (!st.day || (x.kind !== "venue" && x.kind !== "work") || x.days.includes(st.day));
  const pinOf = (x) => ({ id: x.id, kind: x.kind, lat: x.lat, lng: x.lng, prog: x.p[0] || (x.kind === "venue" ? "also" : ""), prog2: x.kind === "venue" ? x.p[1] : undefined, n: x.n, label: x.label, meta: x.meta, href: x.href, h: x.h, live: live.has(x.id) });

  const map = mountMap(box, {
    pins: [], focus: st.focus, wheel: "always", title: "Map of Over-the-Rhine, downtown, The Banks and the Kentucky riverfront",
    onSelect: (id, pin, o) => select(id, o),
    onList: (ids, o) => showMany(ids, o),
    onClear: () => closePanel(false),
    onHover: (id) => { for (const x of items) x.el.classList.toggle("is-hi", x.id === id); },
  });

  function apply(write = true) {
    for (const b of layerBtns) b.setAttribute("aria-pressed", String(st.layers.includes(b.dataset.layer)));
    for (const b of progBtns) b.setAttribute("aria-pressed", String(st.p.includes(b.dataset.mp)));
    if (daySel) daySel.value = st.day;
    const note = $("[data-day-note]", page); if (note) note.hidden = !st.day;
    let n = 0;
    for (const x of items) { const ok = visible(x); x.el.hidden = !ok; if (ok) n++; }
    for (const sec of $$("[data-layer-sec]", list)) {
      const shown = $$("li.map-li:not([hidden])", sec).length;
      sec.hidden = !shown;
      const c = $("[data-sec-count]", sec); if (c) c.textContent = String(shown);
    }
    for (const l of $$("[data-lg]", page)) l.hidden = !st.layers.includes(l.dataset.lg);
    countEl.innerHTML = `Showing <b>${n}</b> ${n === 1 ? "place" : "places"}${st.day ? ` on ${esc(fmtDay(st.day))}` : ""}`;
    map.update(items.filter(visible).map(pinOf));
    if (st.sel && !visible(byId.get(st.sel))) closePanel(false);
    if (write) writeUrl();
  }
  function writeUrl() {
    const u = new URL(location.href);
    const set = (k, v) => (v ? u.searchParams.set(k, v) : u.searchParams.delete(k));
    const dl = LAYERS.filter((l) => st.layers.includes(l)).join(",");
    if (dl === DEFAULT_LAYERS.join(",")) u.searchParams.delete("layers"); else u.searchParams.set("layers", dl);
    set("p", [...st.p].sort().join(","));
    set("day", st.day);
    const f = st.sel && /^(venue|work|stay):/.test(st.sel) ? st.sel : "";
    set("focus", f);
    try { history.replaceState(history.state, "", u.pathname + u.search + u.hash); } catch { /* sandboxed */ }
  }

  /* the panel: a side panel on wide screens, a bottom sheet on phones */
  let returnTo = null;
  function select(id, { keyboard = false } = {}) {
    const x = byId.get(id);
    if (!x) return;
    st.sel = id;
    returnTo = keyboard ? document.activeElement : null;
    for (const y of items) y.el.classList.toggle("is-sel", y.id === id);
    renderPanel(x);
    openPanel(keyboard);
    writeUrl();
  }
  function openPanel(focus) {
    panel.hidden = false;
    page.classList.add("has-sel");
    requestAnimationFrame(() => panel.classList.add("is-open"));
    if (focus) { const t = $("[data-panel-title]", panel); if (t) t.focus({ preventScroll: true }); }
  }
  function closePanel(restore = true) {
    st.sel = null;
    for (const y of items) y.el.classList.remove("is-sel");
    panel.classList.remove("is-open", "is-full");
    panel.hidden = true;
    page.classList.remove("has-sel");
    writeUrl();
    if (restore && returnTo && returnTo.isConnected) returnTo.focus({ preventScroll: true });
    returnTo = null;
  }
  function showMany(ids, { keyboard } = {}) {
    const xs = ids.map((i) => byId.get(i)).filter(Boolean);
    st.sel = null;
    panel.innerHTML = `${panelHead(`${xs.length} places here`, "Several places share this spot")}<ul class="map-panel-list">${xs.map((x) => `<li><button type="button" data-pick-item="${esc(x.id)}">${x.n ? `<b class="tnum">${esc(x.n)}</b> ` : ""}${esc(x.label)}<span class="faint">${esc(x.meta)}</span></button></li>`).join("")}</ul>`;
    returnTo = keyboard ? document.activeElement : null;
    openPanel(keyboard);
  }
  const panelHead = (kicker, title, n = "") => `<div class="map-panel-top"><button class="map-panel-grip" type="button" data-panel-grow aria-expanded="false" aria-label="Expand">${I("chev-d")}</button><button class="map-panel-x" type="button" data-panel-close aria-label="Close">${I("x")}</button></div><p class="label faint">${esc(kicker)}</p><h2 tabindex="-1" data-panel-title>${n ? `<span class="stall s" aria-hidden="true">${esc(n)}</span>` : ""}${esc(title)}</h2>`;
  const KLABEL = { venue: "Venue", work: "Artwork", stay: "Place to stay", stop: "Getting around", food: "Food and drink" };
  function renderPanel(x) {
    const d = directions(x.lat, x.lng);
    const extra = x.kind === "venue" ? `<div data-panel-events><p class="faint">Loading what's on here…</p></div>` : x.kind === "work" ? `<p class="btn-row"><button class="btn btn-secondary btn-sm" type="button" data-open-work="${esc(x.id.split(":")[1])}">${I("info")}Details and photo</button><button class="star" type="button" data-star="${esc(x.id.split(":")[1])}" data-star-kind="w" aria-pressed="false" aria-label="Add “${esc(x.label)}” to My Plan">${I("star")}</button></p>` : "";
    panel.innerHTML = `${panelHead(`${KLABEL[x.kind] || "Place"}${x.kind === "venue" && x.p.length ? ` · ${x.p.map((p) => progName.get(p) || (evData && evData.programs[p] ? evData.programs[p].s : p)).join(", ")}` : ""}`, x.label, x.kind === "venue" ? x.n : "")}
${x.meta ? `<p class="muted map-panel-meta">${esc(x.meta)}</p>` : ""}${extra}
<p class="btn-row map-panel-acts"><span class="acts-l">${I("walk")}Walk</span>${ext(d.apple, "Apple Maps", "btn btn-secondary btn-sm")}${ext(d.google, "Google Maps", "btn btn-secondary btn-sm")}${x.href && x.kind !== "work" ? `<a class="btn btn-ghost btn-sm" href="${esc(x.href)}">${x.kind === "venue" ? "Venue page" : "Details"}${I("arrow-r")}</a>` : ""}</p>`;
    if (x.kind === "work") app.plan.refresh();
    if (x.kind === "venue") venueEvents(x);
  }
  async function venueEvents(x) {
    const box = $("[data-panel-events]", panel);
    try { evData = evData || (await app.data("events.json")); } catch { if (box) box.innerHTML = `<p class="faint"><a href="${esc(x.href)}">See what's on at the venue page</a></p>`; return; }
    if (!box || st.sel !== x.id) return;
    const vid = x.id.split(":")[1], now = app.now(), today = nyParts(now).date;
    const inst = [];
    for (const e of evData.events) if (e.v === vid && e.st !== "cancelled") for (const [day, s, en, f] of e.i) inst.push({ e, day, s, en, f });
    inst.sort((a, b) => a.s - b.s);
    const dayWanted = st.day || (inst.some((i) => i.day === today) ? today : "");
    let pick = dayWanted ? inst.filter((i) => i.day === dayWanted) : inst.filter((i) => i.en > now);
    const seen = new Set(); pick = pick.filter((i) => (seen.has(i.e.id) ? false : seen.add(i.e.id)));
    const head = dayWanted ? (dayWanted === today ? "Today" : fmtDayLong(dayWanted)) : "Coming up";
    const row = (i) => {
      const timed = !(i.f & 2) && !(i.f & 4);
      const [hm, ap] = timed ? fmtTime(nyParts(i.s).hhmm).split(" ") : ["", ""];
      return `<li data-s="${i.s}" data-e="${i.en}"${i.f & 1 ? ' data-end-unknown="1"' : ""}${i.f & 2 ? ' data-time-unknown="1"' : ""}><a href="${ROOT}schedule.html?e=${esc(i.e.id)}#e-${esc(i.e.id)}" data-open-event="${esc(i.e.id)}"><time>${hm ? `${esc(hm)}<small>${esc(ap)}</small>` : `<small>${i.f & 4 ? "All day" : "Time not listed"}</small>`}</time><svg class="bullet" aria-hidden="true"><use href="#b-${esc(i.e.p)}"/></svg><span><span class="t">${esc(i.e.t)}</span><span class="w">${esc(dayWanted ? evData.programs[i.e.p]?.s || "" : fmtDay(i.day))} <span data-status></span></span></span></a></li>`;
    };
    const total = new Set(inst.map((i) => i.e.id)).size;
    box.innerHTML = pick.length
      ? `<h3 class="map-panel-h">${esc(head)}</h3><ol class="tonight map-panel-events">${pick.slice(0, 6).map(row).join("")}</ol>${total > Math.min(6, pick.length) ? `<p class="map-panel-more"><a href="${esc(x.href)}">All ${total} events at this venue${I("arrow-r")}</a></p>` : ""}`
      : `<p class="faint">${inst.length ? (dayWanted ? `Nothing listed here on ${esc(fmtDay(dayWanted))}.` : "Nothing more is listed here.") : "No events are listed here."}</p>`;
    app.status.update(now, box);
  }

  /* events: controls, list ↔ map, panel */
  page.addEventListener("click", (e) => {
    const lb = e.target.closest("button[data-layer]");
    if (lb) { const l = lb.dataset.layer; st.layers = st.layers.includes(l) ? st.layers.filter((x) => x !== l) : [...st.layers, l]; apply(); return; }
    const pb = e.target.closest("[data-mp]");
    if (pb) { const p = pb.dataset.mp; st.p = st.p.includes(p) ? st.p.filter((x) => x !== p) : [...st.p, p]; apply(); return; }
    const sh = e.target.closest("[data-map-show]");
    if (sh) {
      const id = sh.dataset.mapShow;
      setView("map");
      if (map.select(id, { zoom: true })) { select(id, { keyboard: e.detail === 0 }); if (box.getBoundingClientRect().top < 0 || box.getBoundingClientRect().bottom > innerHeight) box.scrollIntoView({ block: "start", behavior: still() ? "auto" : "smooth" }); }
      return;
    }
    const pick = e.target.closest("[data-pick-item]");
    if (pick) { const id = pick.dataset.pickItem; if (map.select(id, { zoom: true })) select(id, { keyboard: e.detail === 0 }); return; }
    if (e.target.closest("[data-panel-close]")) { closePanel(); return; }
    const grow = e.target.closest("[data-panel-grow]");
    if (grow) { const full = panel.classList.toggle("is-full"); grow.setAttribute("aria-expanded", String(full)); grow.setAttribute("aria-label", full ? "Collapse" : "Expand"); return; }
    const vb = e.target.closest("[data-map-views] [data-view]");
    if (vb) { setView(vb.dataset.view); return; }
    if (e.target.closest("[data-near-me]")) return; // handled by the map
  });
  panel.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); closePanel(); } });
  if (daySel) daySel.addEventListener("change", () => { st.day = DAYS.includes(daySel.value) ? daySel.value : ""; apply(); });
  list.addEventListener("pointerover", (e) => { const li = e.target.closest("li.map-li[data-id]"); map.highlight(li ? li.dataset.id : null); });
  list.addEventListener("pointerleave", () => map.highlight(null));
  list.addEventListener("focusin", (e) => { const li = e.target.closest("li.map-li[data-id]"); map.highlight(li ? li.dataset.id : null); });
  function setView(v) {
    page.classList.toggle("is-list", v === "list");
    for (const b of $$("[data-map-views] [data-view]", page)) b.setAttribute("aria-pressed", String(b.dataset.view === v));
  }

  // live rings: a venue with something on now (hours listed, end known or not)
  async function liveNow() {
    try { evData = evData || (await app.data("events.json")); } catch { return; }
    const now = app.now(), next = new Set();
    for (const e of evData.events) if (e.v && e.st !== "cancelled") for (const [, s, en, f] of e.i) if (!(f & 2) && !(f & 4) && s <= now && now < en) next.add(`venue:${e.v}`);
    const changed = next.size !== live.size || [...next].some((x) => !live.has(x));
    live = next;
    if (changed) apply(false);
  }
  apply(false);
  if (st.focus) {
    select(st.focus, {});
    // on phones the map sits below the filters: bring it into view under the sheet
    if (matchMedia("(max-width: 1099px)").matches) requestAnimationFrame(() => box.scrollIntoView({ block: "start" }));
  }
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 800));
  idle(() => { liveNow(); app.onTick(liveNow, { immediate: false }); });
}

/* ---------- venues.html: List/Map; pins follow the directory filters ---------- */
function venuesPage(app) {
  const holder = $("[data-venue-map]"), layout = $("[data-venue-layout]"), listEl = $("[data-venue-list]");
  const toggle = $("[data-venue-views]");
  const wide = matchMedia("(min-width: 1100px)");
  let view = new URLSearchParams(location.search).get("view") === "map" ? "map" : "list";
  let map = null, hiRow = null;
  const rows = () => $$("li.venue[data-ll]", listEl).filter((li) => !li.hidden && !li.closest("[hidden]"));
  const pins = () => rows().map((li) => { const [lat, lng] = li.dataset.ll.split(",").map(Number); const a = $("h3 a", li); return { id: li.id.replace(/^v-/, ""), kind: "venue", lat, lng, prog: li.dataset.prog, prog2: li.dataset.prog2, n: li.dataset.n, label: a.textContent.replace(/^\d+\.\s*/, "").trim(), meta: ($(".addr", li) || {}).textContent || "", href: a.getAttribute("href"), h: li.dataset.h }; });
  function ensure() {
    if (map) return;
    map = mountMap(holder, { pins: pins(), fit: false, title: "Venues on the map", onHover: (id) => { if (hiRow) hiRow.classList.remove("is-hi"); hiRow = id ? document.getElementById(`v-${id}`) : null; if (hiRow) hiRow.classList.add("is-hi"); } });
  }
  function setView(v, write) {
    view = v;
    layout.classList.toggle("is-map", v === "map");
    if (toggle) for (const b of $$("[data-view]", toggle)) b.setAttribute("aria-pressed", String(b.dataset.view === v));
    if (v === "map" || wide.matches) ensure();
    if (write) { const u = new URL(location.href); if (v === "map") u.searchParams.set("view", "map"); else u.searchParams.delete("view"); try { history.replaceState(history.state, "", u.pathname + u.search + u.hash); } catch { /* sandboxed */ } }
  }
  if (toggle) toggle.addEventListener("click", (e) => { const b = e.target.closest("[data-view]"); if (b) setView(b.dataset.view, true); });
  wide.addEventListener("change", () => { if (wide.matches) ensure(); });
  // the directory engine hides rows; follow it
  let t = 0;
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => map && map.update(pins()), 60); }).observe(listEl, { attributes: true, attributeFilter: ["hidden"], subtree: true });
  listEl.addEventListener("pointerover", (e) => { const li = e.target.closest("li.venue"); if (map) map.highlight(li ? li.id.replace(/^v-/, "") : null); });
  listEl.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-map-focus]");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    e.preventDefault();
    const id = a.dataset.mapFocus.split(":")[1];
    setView("map", true);
    setTimeout(() => { if (map) map.select(id, { zoom: true }); holder.scrollIntoView({ block: "nearest", behavior: still() ? "auto" : "smooth" }); }, 50);
  });
  setView(view, false);
}

/* ---------- stay.html: every hotel on the map ---------- */
function stayPage() {
  const holder = $("[data-stay-map]");
  const pins = $$(".stay[data-ll]").map((a) => { const [lat, lng] = a.dataset.ll.split(",").map(Number); return { id: a.id, kind: "stay", lat, lng, prog: a.dataset.prog || "", label: a.dataset.name, meta: ($(".addr", a) || {}).textContent || "", href: `#${a.id}` }; });
  if (!pins.length) { holder.closest("section").hidden = true; return; }
  const go = () => mountMap(holder, { pins, fit: false, title: "Places to stay" });
  if ("IntersectionObserver" in window) { const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); go(); } }, { rootMargin: "300px" }); io.observe(holder); } else go();
}
