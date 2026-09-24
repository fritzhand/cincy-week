/* ============================================================
   build/pages/about.mjs · OWNER: Agent G (home, programs & info)
   about.html: what the guide is (independent, not affiliated with the organizers), how it is
   made (sources, research and verification passes, verbatim text, unknowns counted from the
   data, update cadence), sources per program, images and rights, corrections and takedowns
   (#corrections: the footer links here), credits (OpenStreetMap ODbL, fonts, author) and
   "Last built" — the only volatile line in the site (ctx.buildDate).
   ============================================================ */
import { PROGRAM_PAGES } from "../nav.mjs";

const UNLISTED = "Location not listed";

export function pages(ctx) {
  const { db, c, h, config, buildDate } = ctx;
  const { esc, icon, bullet } = h;
  const P = db.byId.program;
  const live = db.events.filter((e) => e.live);
  const author = config.author || {};
  const issues = `${config.repo}/issues`;

  /* ---------- what is in the guide ---------- */
  const progLine = PROGRAM_PAGES.map((pp) => P.get(pp.programs[0])).filter(Boolean)
    .map((p) => `${c.progName(p.id)} (${h.fmtDateRange(p.dates.start, p.dates.end)})`);
  const counts = [
    [db.counts.events, "events and exhibitions"], [db.counts.people, "people"], [db.counts.venues, "venues"], [db.counts.works, "works of art"],
    [db.orgs.length, "sponsors and partners"], [db.stays.length, "places to stay"], [db.faqs.length, "questions and answers"], [db.news.length, "news stories"],
  ];

  /* ---------- unknowns, counted from the data ---------- */
  const unknowns = [
    ["Events whose end time is not listed", live.filter((e) => e.instances.some((x) => x.endUnknown)).length, "“end time not listed”; never shown as “Now”"],
    ["Events whose hours are not listed", live.filter((e) => e.instances.some((x) => x.timeUnknown)).length, "“Hours not listed”; no live state"],
    ["Events whose location is not listed", live.filter((e) => !e.venue && (!e.location_text || e.location_text === UNLISTED)).length, "“Location not listed”"],
    ["Events without a published description", live.filter((e) => !e.description).length, "“Description not listed”"],
    ["Events whose price is not stated as free or paid", live.filter((e) => e.is_free === null || e.is_free === undefined).length, "no Free tag; the cost line shows what was published"],
    ["Venues without a published address", db.venues.filter((v) => v.lat == null).length, "“Address unconfirmed · not on the map”"],
    ["Works without a description", db.works.filter((w) => !w.description).length, "“Description not listed”"],
    ["Works without a photo", db.works.filter((w) => !ctx.img.has("w", w.id)).length, "“Photo coming”"],
    ["People without a published bio", db.people.filter((p) => !p.bio).length, "no bio section"],
    ["People without a headshot", db.people.filter((p) => !ctx.img.has("p", p.id)).length, "initials instead of a photo"],
  ].filter(([, n]) => n > 0);

  /* ---------- sources per program ---------- */
  const hostOf = h.hostOf;
  const tally = (recs) => {
    const m = new Map();
    for (const r of recs) { const u = r?.source_url; const k = u && hostOf(u); if (!k) continue; if (!m.has(k)) m.set(k, { url: u, n: 0 }); m.get(k).n++; }
    return [...m].sort((a, b) => b[1].n - a[1].n || (a[0] < b[0] ? -1 : 1));
  };
  const progSources = PROGRAM_PAGES.map((pp) => {
    const ids = pp.programs.filter((id) => P.get(id));
    const recs = [
      ...ids.map((id) => P.get(id)), ...db.events.filter((e) => ids.includes(e.program)), ...db.works.filter((w) => ids.includes(w.program)),
      ...db.people.filter((x) => x.programs.some((p) => ids.includes(p))), ...db.faqs.filter((f) => ids.includes(f.program)),
      ...ids.flatMap((id) => (db.orgsByProgram.get(id) || []).map((x) => x.org)), ...db.facts.filter((f) => ids.includes(f.program)),
    ];
    return { pp, p: P.get(pp.programs[0]), rows: tally(recs) };
  });
  const visit = tally([...db.stays, ...db.places, ...db.venues]);
  const newsHosts = tally(db.news.map((n) => ({ source_url: n.url })));
  const hostList = (rows, max = 14) => `<ul class="about-hosts">${rows.slice(0, max).map(([host, s]) => `<li>${h.extLink(s.url, esc(host))}<span class="faint tnum">${esc(h.plural(s.n, "record"))}</span></li>`).join("")}</ul>${rows.length > max ? `<p class="about-more faint">${esc(`and ${rows.length - max} more ${rows.length - max === 1 ? "site" : "sites"}, each linked from its records`)}</p>` : ""}`;

  /* ---------- images ---------- */
  const imgs = { p: 0, o: 0, w: 0 };
  for (const k of Object.keys(db.images || {})) { const t = k.split("/")[0]; if (t in imgs) imgs[t]++; }

  const toc = [["what", "What this is"], ["method", "How it is made"], ["unknowns", "What the sources don't say"], ["sources", "Sources"], ["images", "Images and rights"], ["corrections", "Corrections and takedowns"], ["credits", "Credits"]];
  const officials = db.programs.filter((p) => p.url);
  return [{
    path: "about.html", nav: "about", title: "About & sources", toc,
    description: "What Cincy Week is, how it is made, where every fact comes from, and how to ask for a correction or a takedown.",
    body: (root) => `${c.pageHead({ num: 5, kicker: "Reference", title: "About & sources", lede: "An independent guide to the first week of October in Cincinnati, built from the programs' own public pages. It is not affiliated with any of the organizers." })}
${c.section({ id: "what", title: "What this is", anchor: true, body: `<div class="prose">
<p>${esc(config.siteName)} puts ${esc(h.listJoin(progLine))} in one place, with other happenings of the week that the guide could verify: the schedule, the people, the art, the venues, where to stay and how to get around.</p>
<p><b>It is an independent guide.</b> It is not produced, endorsed or paid for by any of the organizers, and it does not sell tickets. Programs change: always check the official sites before you go.</p>
</div>
<ul class="about-officials">${officials.map((p) => `<li>${bullet(p.id)}<span>${esc(c.progName(p.id))}</span>${h.extLink(p.url, `${esc(hostOf(p.url))}${icon("ext")}`)}</li>`).join("")}</ul>
<ul class="about-counts">${counts.map(([n, l]) => `<li><b class="tnum">${n}</b> ${esc(l)}</li>`).join("")}</ul>` })}
${c.section({ id: "method", title: "How it is made", anchor: true, body: `<div class="prose">
<p><b>From public pages.</b> Every record comes from a public page: the programs' sites, schedules and press pages, venue and museum sites, the transit agencies, and news coverage. Every record keeps the link to its source, and the guide shows it next to the record.</p>
<p><b>Researched, then checked.</b> The data was gathered in research passes, one per program or topic, and checked in separate verification passes: counts were re-derived from the sources, samples of records were re-checked against the live pages, and gaps were listed instead of filled. Records from two sources are merged only on an exact match or with written evidence.</p>
<p><b>In the organizers' words.</b> Descriptions, bios and answers are quoted as published. Headings, the week line's day summaries and the one-line news summaries are the guide's.</p>
<p><b>Unknowns stay unknown.</b> When a time, room, price or address is not published, the guide says “not listed” instead of guessing. Walking times are straight-line estimates and are labeled as estimates. Times are Eastern Time; “Now” and “In 20 min” are worked out on your device.</p>
<p><b>Checked on every build.</b> The site is rebuilt from its data files, and the build stops if a record has no source link, a non-secure link, a placeholder such as “TBA”, a time that cannot be right, or an internal link that leads nowhere.</p>
<p><b>Updates.</b> News is refreshed automatically: daily in September, every six hours from October 1 to 12, then daily for the rest of October. Program data is updated when the research is re-run against the organizers' pages. The date of the last build is at the bottom of this page.</p>
</div>` })}
${c.section({ id: "unknowns", title: "What the sources don't say", kicker: "Counted from the guide's data", anchor: true, body: `<div class="table-wrap"><table class="data about-unk"><thead><tr><th scope="col">Not published</th><th scope="col" class="tnum">Records</th><th scope="col">What the guide shows</th></tr></thead><tbody>${unknowns.map(([l, n, w]) => `<tr><th scope="row" data-label="Not published">${esc(l)}</th><td data-label="Records" class="tnum">${n}</td><td data-label="Shown as">${esc(w)}</td></tr>`).join("")}</tbody></table></div>
<p class="about-note">These gaps close as the organizers publish more. If you know the answer from an official page, ${h.extLink(issues, "send the link")}.</p>` })}
${c.section({ id: "sources", title: "Sources", kicker: "Sites the guide's records come from", anchor: true, body: `${progSources.map(({ pp, p, rows }) => `<div class="about-src" data-prog="${p ? p.id : "also"}"><h3>${bullet(p ? p.id : "also")}<a href="${root}${pp.slug}.html">${esc(pp.label)}</a></h3>${p?.url ? `<p class="about-official">Official site: ${h.extLink(p.url, esc(hostOf(p.url)))}</p>` : ""}${hostList(rows)}</div>`).join("")}
<div class="about-src"><h3>${icon("tram")}<span>Venues, hotels and getting around</span></h3>${hostList(visit)}</div>
<div class="about-src"><h3>${icon("news")}<a href="${root}news.html">News</a></h3>${hostList(newsHosts)}</div>` })}
${c.section({ id: "images", title: "Images and rights", anchor: true, body: `<div class="prose">
<p>The guide shows ${esc(h.listJoin([imgs.p ? h.plural(imgs.p, "portrait") : "", imgs.o ? h.plural(imgs.o, "logo") : "", imgs.w ? h.plural(imgs.w, "artwork photo") : ""].filter(Boolean)))}, downloaded from the organizers' and participants' public pages, resized, and stored with the guide rather than loaded from other sites. Logos appear unaltered on a plain plate; artwork is never filtered or cropped into shapes. Each image stays the property of its owner and appears only to identify a person, a sponsor or a work in this non-commercial guide.</p>
<p>If an image is yours and you want it changed or removed, ask through the corrections link below.</p>
</div>` })}
${c.section({ id: "corrections", title: "Corrections and takedowns", anchor: true, body: `<div class="prose">
<p>Something wrong, out of date, or missing? Is a photo, a bio or a listing yours, and you want it changed or removed? ${h.extLink(issues, "Open an issue on GitHub")} with:</p>
<ul><li>the page link on this guide,</li><li>what is wrong, or what you want removed,</li><li>for a correction, the official page that shows the right information.</li></ul>
<p>Corrections are made in the data files, and the change appears when the site is next rebuilt.</p>
</div>
<p class="btn-row">${h.extLink(`${issues}/new`, `${icon("github")}Report a correction`, "btn btn-primary")}${h.extLink(config.repo, `${icon("github")}Source on GitHub`, "btn btn-secondary")}</p>` })}
${c.section({ id: "credits", title: "Credits", anchor: true, body: `<div class="prose">
<p><b>Map data</b> ${h.extLink("https://www.openstreetmap.org/copyright", "© OpenStreetMap contributors")}, available under the ${h.extLink("https://opendatacommons.org/licenses/odbl/", "Open Database License (ODbL)")}. The basemap is drawn from it for this guide.</p>
<p><b>Type:</b> Newsreader (Production Type) and Public Sans (USWDS), both under the SIL Open Font License 1.1, served with the site.</p>
<p><b>Design:</b> “Interchange”, a city paper's special section routed like a transit map: each program is a line, each day a station, and Thursday, October 8 the interchange. The river under the nameplate is the Ohio, drawn from OpenStreetMap.</p>
<p><b>Built and maintained by ${esc(author.name || "")}.</b> ${[author.github ? h.extLink(author.github, "GitHub") : "", author.linkedin ? h.extLink(author.linkedin, "LinkedIn") : ""].filter(Boolean).join(" · ")}. The code is open: ${h.extLink(config.repo, esc(config.repo.replace(/^https:\/\//, "")))}.</p>
</div>
<p class="about-built label tnum">Last built ${esc(buildDate)}</p>` })}`,
  }];
}
