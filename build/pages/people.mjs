/* ============================================================
   build/pages/people.mjs · OWNER: Agent F (directory: people, art, partners)
   people.html: every person, server-rendered (works without JS), filtered on the client by
   role, program, A–Z and search (site/js/features/directory.js; ?q= ?r= ?p= ?l=).
   people/<id>.html: one page per person (engine spec §4.5, DESIGN §9.13): portrait or monogram,
   name, title · org, program and role badges, the verbatim bio, links, their events (Agent D's
   cards, with stars), their works in full (works have no pages of their own), the venues they
   appear at, and every source. JSON-LD Person.
   ============================================================ */
import { sortBy, esc, attr } from "../core/util.mjs";
import { ROLE_LABEL, PROGRAM_IDS } from "../core/schema.mjs";
import { searchField, filterGroup, azNav, dirStatus, dirEmpty } from "./_directory.mjs";

const ROLE_PLURAL = { speaker: "Speakers", artist: "Artists", curator: "Curators", performer: "Performers", moderator: "Moderators", organizer: "Organizers", judge: "Judges", host: "Hosts", founder: "Founders", panelist: "Panelists", facilitator: "Facilitators", mentor: "Mentors" };
const LINK_LABEL = { website: "Website", instagram: "Instagram", linkedin: "LinkedIn", x: "X", facebook: "Facebook", tiktok: "TikTok", youtube: "YouTube", bluesky: "Bluesky", threads: "Threads" };

export function pages(ctx) {
  const { db, c, h, cards, img, config, seo } = ctx;
  const people = sortBy(db.people, (p) => cards.personSortKey(p));

  /* ---------- people.html ---------- */
  const anchors = new Map();
  for (const p of people) { const L = cards.personLetter(p); if (!anchors.has(L)) anchors.set(L, `l-${L === "#" ? "num" : L.toLowerCase()}`); }
  const roleOpts = sortBy([...db.peopleByRole], ([, xs]) => -xs.length).map(([r, xs]) => ({ v: r, label: ROLE_PLURAL[r] || ROLE_LABEL[r] || r, count: xs.length }));
  const progOpts = PROGRAM_IDS.filter((p) => db.people.some((x) => x.programs.includes(p))).map((p) => ({ v: p, label: c.progName(p, true), prog: p, count: db.people.filter((x) => x.programs.includes(p)).length }));
  const withPhoto = db.people.filter((p) => img.has("p", p.id)).length;
  const list = {
    path: "people.html", nav: "people", title: "People", features: ["directory"],
    description: `The ${people.length} speakers, artists, curators, performers and organizers of the week, with their sessions, works and sources.`,
    body: (root) => {
      const seen = new Set();
      const rows = people.map((p) => { const L = cards.personLetter(p); const id = seen.has(L) ? "" : anchors.get(L); seen.add(L); return cards.personCard(root, p, { id }); }).join("");
      return `${c.pageHead({ num: 3, kicker: `Directory · ${people.length} people`, title: "People", lede: "Speakers, artists, curators, performers and organizers across the week's programs, as each program lists them. Every name opens a page with their sessions, works and sources." })}
<div class="dir-tools js-only" data-dir-tools>
${searchField("Search people", "Search by name, organization or work")}
${filterGroup({ key: "r", label: "Role", options: roleOpts })}
${filterGroup({ key: "p", label: "Program", options: progOpts })}
</div>
${azNav(anchors)}
${dirStatus(people.length, "people")}
<div class="people" data-dir>${rows}</div>
${dirEmpty(c, { title: "No one matches these filters" })}
<p class="source-line">${h.icon("info")}<span>Names, titles and bios are as each program publishes them; ${withPhoto} of ${people.length} have a published headshot. Each page names its source.</span></p>`;
    },
  };

  /* ---------- people/<id>.html ---------- */
  const detail = db.people.map((p) => {
    const prog = p.programs[0] || "also";
    const roles = p.roles.map((r) => ROLE_LABEL[r] || r).join(" · ");
    const sub = [p.title, p.org].filter(Boolean).join(", ");
    const hasImg = img.has("p", p.id);
    const links = Object.entries(p.links || {}).filter(([, u]) => u).map(([k, u]) => ({ href: u, label: LINK_LABEL[k] || k.charAt(0).toUpperCase() + k.slice(1) }));
    const events = p.events;
    // venues they appear at: their events' venues, then their works' venues (data order, no repeats)
    const vIds = [...new Set([...events.map((e) => e.venue_id), ...p.works.map((w) => w.venue_id)].filter(Boolean))];
    const venues = vIds.map((id) => db.byId.venue.get(id)).filter(Boolean);
    const roleAt = (e) => (e.people_roles && e.people_roles[p.id]) || "";
    const eventsHtml = (root) => events.map((e) => {
      const r = roleAt(e);
      return `${r ? `<div class="per-ev"><p class="per-evrole label">As ${esc(r)}</p>` : ""}${cards.eventCard(root, e, { anchor: false })}${r ? "</div>" : ""}`;
    }).join("");
    const image = hasImg ? `${config.siteBase}${img.path("p", p.id)}` : undefined;
    const meta = [p.location, p.pronouns].filter(Boolean).join(" · ");
    return {
      path: `people/${p.id}.html`, nav: "people", title: p.name,
      description: h.truncate([p.name, sub, roles].filter(Boolean).join(" · ") + (p.bio ? `. ${p.bio}` : ""), 155),
      crumbs: [["Overview", "index.html"], ["People", "people.html"], [p.name, null]],
      jsonld: seo.personLd(p, { url: `${config.siteBase}people/${p.id}.html`, image }),
      pagenav: null,
      body: (root) => `<div class="dp" data-prog="${prog}">
<div class="dp-portrait">${hasImg
  ? `<div class="photo">${img.img(root, "p", p.id, { alt: `Portrait of ${p.name}`, lazy: false, sizes: img.SIZES.portrait })}</div><p class="credit label">Photo via ${esc(img.credit("p", p.id))}</p>`
  : `<div class="photo halftone"><span class="mono" aria-hidden="true">${esc(h.initials(p.name))}</span></div><p class="credit label">No photo published</p>`}</div>
<header class="dp-head">
<p class="dp-roles">${p.programs.map((x) => c.progBadge(x)).join("")}<span class="label muted">${esc(roles || "Participant")}</span></p>
<h1>${esc(p.name)}</h1>
${sub ? `<p class="lede">${esc(sub)}</p>` : ""}${meta ? `<p class="byline">${esc(meta)}</p>` : ""}
</header>
<div class="dp-main">
${p.bio ? `<div class="prose dp-bio">${h.paras(p.bio)}</div>` : `<p class="unk dp-bio">Bio not published by the organizers</p>`}
${links.length ? `<p class="keylinks dp-links">${links.map((l) => h.extLink(l.href, `${esc(l.label)}${h.icon("ext")}`, "btn btn-secondary btn-sm")).join("")}</p>` : ""}
${events.length ? `<h2 class="sub-h" id="events">${events.length === 1 ? "Event" : `Events · ${events.length}`}</h2><div class="grid dp-list">${eventsHtml(root)}</div>` : ""}
${p.works.length ? `<h2 class="sub-h" id="works">${p.works.length === 1 ? "Work" : `Works · ${p.works.length}`}</h2><div class="dp-works">${p.works.map((w) => cards.workFull(root, w, { bioShown: p.bio })).join("")}</div>` : ""}
${venues.length ? `<h2 class="sub-h" id="venues">${venues.length === 1 ? "Where" : "Where to find them"}</h2><ul class="per-venues">${venues.map((v) => {
  const hood0 = v.hood ? db.byId.place.get(v.hood)?.name : v.neighborhood;
  const hood = hood0 && hood0 !== v.name ? hood0 : "";
  return `<li><a href="${root}venues/${attr(v.id)}.html"><span class="per-stall${v.stall ? "" : " is-off"}" aria-hidden="true">${v.stall || "–"}</span><span><b>${esc(v.name)}</b>${hood || v.address ? `<span>${esc([v.address, hood].filter(Boolean).join(" · "))}</span>` : ""}</span></a></li>`;
}).join("")}</ul>` : ""}
${!events.length && !p.works.length ? `<p class="unk">No sessions or works listed for this person yet</p>` : ""}
${c.sourceLine([p.source_url, ...(p.also_sources || [])])}
<p class="dp-back"><a class="btn btn-ghost" href="${root}people.html">${h.icon("users")}All people</a></p>
</div>
</div>`,
    };
  });
  return [list, ...detail];
}

export function search(ctx) {
  const { db, img } = ctx;
  return db.people.map((p) => {
    const sub = [p.title, p.org].filter(Boolean).join(", ");
    const e = img.entry("p", p.id);
    // g holds only what s does not already say (the index stays inside its budget)
    const g = [...p.roles.slice(1).map((r) => ROLE_LABEL[r] || r), sub && p.location ? p.location : ""].filter(Boolean).join(" ");
    return {
      k: "pe", id: p.id, t: p.name, s: [ROLE_LABEL[p.roles[0]], sub || p.location].filter(Boolean).join(" · "),
      u: `people/${p.id}.html`, p: p.programs[0], ...(g ? { g } : {}), ...(e ? { i: `assets/${(e.sm || e).file}` } : {}),
    };
  });
}
