/* ============================================================
   build/pages/people.mjs · OWNER: Agent F (directory: people, art, partners)
   STUB landed by Agent A: the people directory (server-rendered rows) and
   one page per person (people/<id>.html) with portrait, roles, bio, their
   events and works, and sources. Agent F owns this file (filters, A–Z,
   featured mugs; engine spec §4.5, DESIGN §9.5 and §9.13).
   ============================================================ */
import { sortBy } from "../core/util.mjs";
import { ROLE_LABEL } from "../core/schema.mjs";

export function pages(ctx) {
  const { db, c, h, cards, img, config, seo } = ctx;
  const { esc } = h;
  const people = sortBy(db.people, (p) => (p.sort_name || p.name.split(" ").slice(-1)[0]).toLowerCase(), (p) => p.name.toLowerCase());
  const list = {
    path: "people.html", nav: "people", title: "People", features: ["directory"],
    description: `The ${people.length} speakers, artists, curators and organizers of the week, with their sessions and works.`,
    body: (root) => `${c.pageHead({ num: 3, kicker: "Directory", title: "People", lede: "Speakers, artists, curators, performers and organizers across the week's programs. Each has a page with their sessions and works." })}
${c.toolbar({ search: { label: "Search people", placeholder: "Search by name or organization" } })}
${c.resultCount(people.length, people.length, "people")}
<div class="people" data-dir>${people.map((p) => cards.personCard(root, p)).join("")}</div>
${c.placeholder("Filters by role and program and an A–Z index are coming to this page.", "directory")}`,
  };
  const detail = db.people.map((p) => {
    const prog = p.programs[0] || "also";
    const roles = p.roles.map((r) => ROLE_LABEL[r] || r).join(" · ");
    const sub = [p.title, p.org].filter(Boolean).join(", ");
    const hasImg = img.has("p", p.id);
    const links = Object.entries(p.links || {}).filter(([, u]) => u).map(([k, u]) => ({ href: u, label: k === "x" ? "X" : k.charAt(0).toUpperCase() + k.slice(1) }));
    return {
      path: `people/${p.id}.html`, nav: "people", title: p.name,
      description: h.truncate([p.name, sub, roles].filter(Boolean).join(" · ") + (p.bio ? `. ${p.bio}` : ""), 155),
      crumbs: [["Overview", "index.html"], ["People", "people.html"], [p.name, null]],
      jsonld: seo.personLd(p, { url: `${config.siteBase}people/${p.id}.html` }),
      body: (root) => `<div class="dp" data-prog="${prog}">
<div class="dp-portrait">${hasImg ? `<div class="photo">${img.img(root, "p", p.id, { alt: `Portrait of ${p.name}`, lazy: false })}</div>` : `<div class="photo halftone" aria-hidden="true"><span class="mono">${esc(h.initials(p.name))}</span></div>`}</div>
<div class="dp-main">
<p class="dp-roles">${p.programs.map((x) => c.progBadge(x)).join("")}<span class="label faint">${esc(roles)}</span></p>
<h1>${esc(p.name)}</h1>
${sub ? `<p class="lede">${esc(sub)}</p>` : ""}${p.location ? `<p class="byline">${esc(p.location)}</p>` : ""}
${p.bio ? `<div class="prose dp-bio">${h.paras(p.bio)}</div>` : `<p class="unk dp-bio">Bio not published by the organizers</p>`}
${c.keylinks(root, links)}
${p.events.length ? `<h2 class="sub-h">Sessions</h2><div class="dp-list">${p.events.map((e) => cards.eventCard(root, e, { anchor: false })).join("")}</div>` : ""}
${p.works.length ? `<h2 class="sub-h">Works</h2><div class="works">${p.works.map((w) => cards.workCard(root, w)).join("")}</div>` : ""}
${c.sourceLine([p.source_url, ...(p.also_sources || [])])}
</div>
</div>`,
    };
  });
  return [list, ...detail];
}

export function search(ctx) {
  const { db, img } = ctx;
  return db.people.map((p) => ({
    k: "pe", id: p.id, t: p.name, s: [ROLE_LABEL[p.roles[0]], [p.title, p.org].filter(Boolean).join(", ")].filter(Boolean).join(" · "),
    u: `people/${p.id}.html`, p: p.programs[0], g: [p.org, p.title, p.location, ...p.roles].filter(Boolean).join(" "),
    i: img.path("p", p.id),
  }));
}
