/* ============================================================
   build/pages/program.mjs · OWNER: Agent G (home, programs & info)
   STUB landed by Agent A: one page per PROGRAM_PAGES entry (nav.mjs), from
   data/programs.json: program head (bullet + plate-underlined name), facts,
   the organizers' description, daily themes, the program's events, and
   sources. Agent G owns this file (people strip, works, venue mini-map,
   sponsors wall, FAQs, news; engine spec §4.5, DESIGN §9.13).
   ============================================================ */
import { PROGRAM_PAGES } from "../nav.mjs";

export function pages(ctx) {
  const { db, c, h, cards, config, seo } = ctx;
  const { esc } = h;
  return PROGRAM_PAGES.map((pp) => {
    const progs = pp.programs.map((id) => db.byId.program.get(id)).filter(Boolean);
    const p = progs[0];
    if (!p) return null;
    const hub = p.hub_venue_id ? db.byId.venue.get(p.hub_venue_id) : null;
    const insts = db.instances.filter((x) => pp.programs.includes(x.ev.program) && (x.ev.live || x.ev.status === "cancelled"));
    const seen = new Set();
    const firstOnly = insts.filter((x) => (seen.has(x.id) ? false : seen.add(x.id)));
    const toc = [["about", "About"], ...(p.daily_themes?.length ? [["days", "Day by day"]] : []), ["events", "Events"], ["sources", "Sources"]];
    return {
      path: `${pp.slug}.html`, nav: pp.slug, title: pp.label, toc, features: [], og: `og-${p.id}.png`,
      description: h.truncate(`${pp.label}, ${h.fmtDateRange(p.dates.start, p.dates.end)}: ${(p.description || p.tagline || "").split("\n\n")[0]}`, 155),
      jsonld: seo.programLd(config, p, { url: `${config.siteBase}${pp.slug}.html`, venue: hub }),
      body: (root) => `${c.pageHead({ prog: p.id, kicker: `Program · ${h.fmtDateRange(p.dates.start, p.dates.end)}`, title: pp.label, titleHtml: `<span class="prog-u">${esc(pp.label)}</span>` })}
${p.tagline ? c.callout("org", `“${esc(p.tagline)}”`, { prog: p.id, cite: `Source: ${h.extLink(p.source_url, esc(h.hostOf(p.source_url)))}` }) : ""}
${c.facts(root, [
  ["Dates", esc(h.fmtDateRange(p.dates.start, p.dates.end))],
  ["Hours", p.hours ? esc(p.hours) : null],
  ["Hub", hub ? `<a href="${root}venues/${hub.id}.html">${esc(hub.name)}</a>` : null],
  ["Organizers", (p.organizers || []).length ? esc(h.listJoin(p.organizers.map((o) => o.name))) : null],
  ["Official site", p.url ? h.extLink(p.url, esc(h.hostOf(p.url))) : null],
])}
${c.section({ id: "about", title: "About", anchor: true, body: p.description ? `<div class="prose">${h.paras(p.description)}</div>` : `<p class="unk">Description not published yet</p>` })}
${p.daily_themes?.length ? c.section({ id: "days", title: "Day by day", anchor: true, body: `<ol class="themes">${p.daily_themes.map((t) => `<li><time datetime="${t.date}">${esc(h.fmtDay(t.date).split(", ")[1])}<small>${esc(h.fmtDay(t.date).split(",")[0])}</small></time><div><b>${esc(t.theme)}</b>${t.highlights?.length ? `<p>${esc(t.highlights.join(" · "))}</p>` : ""}</div></li>`).join("")}</ol>` }) : ""}
${c.section({ id: "events", title: "Events", anchor: true, more: { href: `schedule.html?p=${pp.programs.join(",")}`, label: "Full schedule" }, root, body: firstOnly.length ? `<div class="grid">${firstOnly.map((x) => cards.eventCard(root, x, { anchor: false })).join("")}</div>` : c.emptyState({ title: "No events listed yet", body: "Events appear here as the organizers publish them.", glyph: "calendar", prog: p.id }) })}
${c.placeholder("People, works, the venue map, sponsors, FAQs and news for this program are coming to this page.", "programs")}
${c.section({ id: "sources", title: "Sources", body: c.sourceLine(progs.map((x) => x.source_url)) })}`,
    };
  }).filter(Boolean);
}

export function search(ctx) {
  const { db, h } = ctx;
  return PROGRAM_PAGES.map((pp) => {
    const p = db.byId.program.get(pp.programs[0]);
    return p ? { k: "pr", id: pp.slug, t: pp.label, s: h.fmtDateRange(p.dates.start, p.dates.end), u: `${pp.slug}.html`, p: p.id, g: [p.name, p.short_name, p.tagline].filter(Boolean).join(" ") } : null;
  }).filter(Boolean);
}
