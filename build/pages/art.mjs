/* ============================================================
   build/pages/art.mjs · OWNER: Agent F (directory: people, art, partners)
   art.html: every artwork and installation, server-rendered in program sections (works without JS),
   filtered on the client by program, medium and zone (+ ?h= neighborhood and ?c= category deep
   links) and search; ?w=<id> opens the work dialog (site/js/core/work-dialog.js). Works have no
   pages: the artist's page (people.mjs) carries each work in full.
   The Grid/Map toggle appears only once Agent E's features/map.js is real (it is a stub until then).
   Data output assets/data/art-extra.json (for the work dialog, fetched lazily):
     { v, works: { id: { im: [[src, w, h], [src960, w, h]?] | null, cr: credit, ab: 1 (the text is the
       artist's biography), so: sponsor org id, mm: mini-map HTML with the root as {R}, d: { apple, google } } },
       people: { id: { i: 96px mug path | null, t: "Title, Org" | location | null } },
       venues: { id: { n, st, h } }, programs: { id: { n, dates } } }
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sortBy, groupBy, esc, attr, slugify } from "../core/util.mjs";
import { PROGRAM_IDS } from "../core/schema.mjs";
import { isArtistBio } from "../components/work-card.mjs";
import { searchField, filterGroup, dirStatus, dirEmpty, viewToggle } from "./_directory.mjs";

const count0 = (ws) => { const m = new Map(); for (const w of ws) m.set(w.program, (m.get(w.program) || 0) + 1); return m; };

/** features/map.js is Agent E's; until it lands it is a no-op stub, and the art map view stays hidden. */
function mapReady() {
  try { return !/STUB landed by Agent A/.test(readFileSync(fileURLToPath(new URL("../../site/js/features/map.js", import.meta.url)), "utf8")); }
  catch { return false; }
}

export function pages(ctx) {
  const { db, c, h, cards } = ctx;
  // the program with the most works first (BLINK's 75 photographed installations lead), then program order
  const perProg = count0(db.works);
  const works = sortBy(db.works, (w) => -perProg.get(w.program), (w) => PROGRAM_IDS.indexOf(w.program), (w) => w.title.toLowerCase());
  const byProg = groupBy(works, (w) => w.program);
  const count = (f) => { const m = new Map(); for (const w of works) for (const k of [].concat(f(w)).filter(Boolean)) m.set(k, (m.get(k) || 0) + 1); return m; };

  const progOpts = [...byProg.keys()].map((p) => ({ v: p, label: c.progName(p, true), prog: p, count: byProg.get(p).length }));
  const medOpts = sortBy([...count((w) => w.medium)], ([, n]) => -n).map(([m, n]) => ({ v: m, label: cards.workMedium({ medium: m }), count: n }));
  // zones: one chip per spelling-insensitive zone, labeled with its most common spelling
  const zoneSpell = new Map();
  for (const w of works) if (w.zone) { const k = cards.zoneKey(w); const s = zoneSpell.get(k) || new Map(); s.set(w.zone, (s.get(w.zone) || 0) + 1); zoneSpell.set(k, s); }
  const zoneOpts = sortBy([...count((w) => cards.zoneKey(w))], ([, n]) => -n).map(([z, n]) => ({ v: z, label: sortBy([...zoneSpell.get(z)], ([, k]) => -k)[0][0], count: n }));
  const hoodOpts = [...count((w) => (w.venue_id ? db.byId.venue.get(w.venue_id)?.hood : null))].map(([id, n]) => ({ v: id, label: db.byId.place.get(id)?.name || id, count: n }));
  const catOpts = [...count((w) => (w.category ? slugify(w.category) : null))].map(([v, n]) => ({ v, label: works.find((w) => w.category && slugify(w.category) === v).category, count: n }));
  const withPhoto = works.filter((w) => ctx.img.has("w", w.id)).length;
  const blink = db.byId.program.get("blink");
  const map = mapReady();

  const lede = `Artworks and installations from ${h.listJoin([...byProg.keys()].map((p) => c.progName(p)))}, with who made each one and where to find it.`;
  // BLINK's own words for when its works are on (a quote with its source, never our paraphrase)
  const note = (p) => (p === "blink" && blink && blink.hours ? `<p class="art-note">BLINK lists its hours as “${esc(blink.hours)}”. <span class="faint">Source: ${h.extLink(blink.source_url || blink.url, esc(h.hostOf(blink.source_url || blink.url)))}</span></p>` : "");
  return [{
    path: "art.html", nav: "art", title: "Art & installations", features: ["directory"],
    description: `The ${works.length} artworks and installations of BLINK and Cincinnati Art Week: projection mapping, light installations and murals, with their artists and locations.`,
    body: (root) => `${c.pageHead({ num: 3, kicker: `Directory · ${works.length} works`, title: "Art & installations", lede })}
<div class="dir-tools js-only" data-dir-tools>
${searchField("Search art", "Search by title, artist or zone")}
${progOpts.length > 1 ? filterGroup({ key: "p", label: "Program", options: progOpts }) : ""}
${filterGroup({ key: "m", label: "Medium", options: medOpts, sep: "|" })}
${filterGroup({ key: "z", label: "Zone", options: zoneOpts })}
${filterGroup({ key: "h", label: "Neighborhood", options: hoodOpts, hidden: true })}
${filterGroup({ key: "c", label: "Category", options: catOpts, hidden: true })}
${map ? viewToggle([{ v: "grid", label: "Grid", icon: "grid", pressed: true }, { v: "map", label: "Map", icon: "map" }]) : ""}
</div>
${dirStatus(works.length, "works")}
${map ? `<div class="art-map" data-dir-map hidden></div>` : ""}
${[...byProg].map(([p, xs]) => `<section class="art-group" data-dir-group data-prog="${p}" aria-labelledby="art-${p}"><h2 class="art-head" id="art-${p}">${h.bullet(p, "lg")}<span>${esc(c.progName(p))}</span><span class="label faint" data-dir-count data-one="work" data-many="works">${xs.length} ${xs.length === 1 ? "work" : "works"}</span></h2>${note(p)}<div class="works" data-dir>${xs.map((w) => cards.workCard(root, w)).join("")}</div></section>`).join("\n")}
${dirEmpty(c, { title: "No works match these filters", glyph: "light" })}
<p class="source-line">${h.icon("info")}<span>Titles, artists, locations and descriptions are as each program publishes them; ${withPhoto} of ${works.length} works have a published image. Open a work for its details and source.</span></p>`,
  }];
}

export function data(ctx) {
  const { db, img, cards, c } = ctx;
  const works = {}, people = {}, venues = {};
  for (const w of db.works) {
    const e = img.entry("w", w.id);
    const im = e ? [[`assets/${e.file}`, e.w, e.h], ...(e.lg ? [[`assets/${e.lg.file}`, e.lg.w, e.lg.h]] : [])] : null;
    const x = { im, cr: e ? img.credit("w", w.id) : null };
    if (isArtistBio(w)) x.ab = 1;
    if (w.sponsor_org_id && db.byId.org.has(w.sponsor_org_id)) x.so = w.sponsor_org_id;
    if (w.lat != null) {
      x.mm = cards.miniMap("{R}", w.lat, w.lng, { prog: w.program, n: "", label: `Map of where to find ${w.title}` });
      x.d = cards.directions(w.lat, w.lng);
    }
    works[w.id] = x;
    for (const a of w.artists || []) {
      const p = db.byId.person.get(a);
      if (!p || people[a]) continue;
      const pe = img.entry("p", a);
      people[a] = { i: pe ? `assets/${(pe.sm || pe).file}` : null, t: [p.title, p.org].filter(Boolean).join(", ") || p.location || null };
    }
    if (w.venue_id && !venues[w.venue_id]) {
      const v = db.byId.venue.get(w.venue_id);
      if (v) venues[v.id] = { n: v.name, st: v.stall || null, h: v.hood ? db.byId.place.get(v.hood)?.name || null : v.neighborhood || null };
    }
  }
  const programs = Object.fromEntries(db.programs.map((p) => [p.id, { n: c.progName(p.id), dates: p.dates ? [p.dates.start, p.dates.end] : null }]));
  return { "assets/data/art-extra.json": { v: 1, works, people, venues, programs } };
}

export function search(ctx) {
  const { db, cards } = ctx;
  return db.works.map((w) => {
    const by = cards.workArtists(w).join(", ") || w.artist_text || "";
    return { k: "wo", id: w.id, t: w.title, s: [by, w.zone || w.location_text].filter(Boolean).join(" · "), u: `art.html?w=${w.id}`, p: w.program, g: [w.medium, w.category, w.zone, w.sponsor].filter(Boolean).join(" ") };
  });
}
