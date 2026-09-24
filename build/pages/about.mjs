/* ============================================================
   build/pages/about.mjs · OWNER: Agent G (home, programs & info)
   STUB landed by Agent A: what this is, method, sources per program,
   corrections (#corrections: the footer links here), credits, the OSM
   attribution and the only volatile line in the site ("Last built").
   Agent G owns this file.
   ============================================================ */
import { hostOf } from "../core/util.mjs";

export function pages(ctx) {
  const { db, c, h, config, buildDate } = ctx;
  const { esc } = h;
  const toc = [["what", "What this is"], ["method", "How it is made"], ["sources", "Sources"], ["corrections", "Corrections and takedowns"], ["credits", "Credits"]];
  const sources = new Map();
  for (const f of ["programs", "events", "people", "venues", "works", "orgs", "stays", "places", "faqs"]) for (const r of db[f]) if (r.source_url) { const k = hostOf(r.source_url); sources.set(k, (sources.get(k) || 0) + 1); }
  const top = [...sources].sort((a, b) => b[1] - a[1]);
  return [{
    path: "about.html", nav: "about", title: "About & sources", toc,
    description: "What Cincy Week is, how it is made, where every fact comes from, and how to ask for a correction.",
    body: (root) => `${c.pageHead({ num: 5, kicker: "Reference", title: "About & sources", lede: "An independent guide to the first week of October in Cincinnati, built from the programs' own public sites. It is not affiliated with any of the organizers." })}
${c.section({ id: "what", title: "What this is", anchor: true, body: `<div class="prose"><p>${esc(config.siteName)} puts Cincinnati Art Week, StartupCincy Week, BLINK and the FotoFocus Biennial in one place: the schedule, the people, the art, the venues and the practical details of getting around.</p></div>` })}
${c.section({ id: "method", title: "How it is made", anchor: true, body: `<div class="prose"><p>Every record in the guide comes from a public page, and every record links to it. Descriptions and bios are quoted as published. When something is not published, the guide says so ("not listed") instead of guessing.</p><p>Times are Eastern Time. Walking times are estimates from straight-line distance and are labeled as estimates.</p></div>` })}
${c.section({ id: "sources", title: "Sources", anchor: true, body: `<ul class="prose">${top.map(([host, n]) => `<li>${esc(host)}: ${n} record${n === 1 ? "" : "s"}</li>`).join("")}</ul>${c.sourceLine(db.programs.map((p) => p.url || p.source_url), { label: "Official site" })}` })}
${c.section({ id: "corrections", title: "Corrections and takedowns", anchor: true, body: `<div class="prose"><p>Something wrong, out of date, or yours and you want it removed? ${h.extLink(`${config.repo}/issues`, "Open an issue on GitHub")} with the page link, and it will be fixed in the next build.</p></div>` })}
${c.section({ id: "credits", title: "Credits", anchor: true, body: `<div class="prose"><p>Portraits, logos and artwork images courtesy of the program organizers, from their public event sites; to request a change or removal, open an issue.</p><p>Map data ${h.extLink("https://www.openstreetmap.org/copyright", "© OpenStreetMap contributors")}, available under the Open Database License.</p><p>Type: Newsreader (Production Type) and Public Sans (USWDS), both under the SIL Open Font License 1.1.</p></div>` })}
<p class="byline">Last built ${esc(buildDate)}.</p>`,
  }];
}
