/* ============================================================
   build/components/org-logo.mjs · OWNER: Agent F (directory: people, art, partners)

   makeOrgLogos(ctx) → {
     orgLogo(root, org, { anchor = true, prog, tier })
       a.plate (3:2, the logo unaltered on the plate it was made for: white, or black when the
       manifest's tone is "dark"; a text plate when there is no logo). Links out to the org's site in
       a new tab (and says so); without a URL it is a span. id="o-{id}" is the search target
       (partners.html#o-{id}); only the first plate of an org on a page carries it.
       Directory data: data-p (the wall's program), data-tier (tier slug), data-q (name).
     logoWall(root, [{ org, role }], seen = new Set(), { prog })
       tiers in the order given (db.orgsByProgram is tier-ordered): p.tier caps label + .plates;
       the first tier is .plates.lg when it holds four logos or fewer. Each tier is a
       [data-dir-group] holding a [data-dir] list, so the directory filter hides empty tiers.
     tierLabel(role) → the verbatim tier, or the relationship as a plural ("Organizers")
   }
   ============================================================ */
import { esc, attr, groupBy, slugify } from "../core/util.mjs";
import { icon } from "../core/icons.mjs";
import { norm } from "../../site/js/lib/search.js";

const PLURAL = { "presenting sponsor": "Presenting sponsors", sponsor: "Sponsors", partner: "Partners", organizer: "Organizers", "founding partner": "Founding partners", "media partner": "Media partners", venue: "Venues", "community partner": "Community partners", funder: "Funders" };

export function makeOrgLogos(ctx) {
  const { img } = ctx;
  const tierLabel = (role) => role.tier || PLURAL[role.relationship] || role.relationship;

  function orgLogo(root, o, { anchor = true, prog = "", tier = "" } = {}) {
    const inner = img.logo(root, o);
    const idAttr = anchor ? ` id="o-${attr(o.id)}"` : "";
    const tone = img.entry("o", o.id)?.tone === "dark" ? ' data-tone="dark"' : "";
    const data = `${prog ? ` data-p="${prog}"` : ""}${tier ? ` data-tier="${attr(tier)}"` : ""} data-q="${attr(norm(o.name))}"`;
    return o.url
      ? `<a class="plate" href="${attr(o.url)}"${idAttr}${tone}${data} target="_blank" rel="noopener">${inner}${icon("ext", "ext")}<span class="sr-only"> (opens in a new tab)</span></a>`
      : `<span class="plate"${idAttr}${tone}${data}>${inner}</span>`;
  }

  function logoWall(root, entries, seen = new Set(), { prog = "" } = {}) {
    const tiers = [...groupBy(entries, (x) => tierLabel(x.role))];
    return tiers.map(([tier, xs], i) => {
      const t = slugify(tier);
      const lg = i === 0 && xs.length <= 4 ? " lg" : "";
      const plates = xs.map((x) => { const a = !seen.has(x.org.id); seen.add(x.org.id); return orgLogo(root, x.org, { anchor: a, prog: prog || x.role.program, tier: t }); }).join("");
      // QA: after the headline tier, a tier of one or two logos is sized to them, so small tiers share a row
      const sm = i > 0 && xs.length <= 2 ? ` n${xs.length}` : "";
      return `<div class="wall-tier${sm}" data-dir-group><p class="tier label">${esc(tier.charAt(0).toUpperCase() + tier.slice(1))}</p><div class="plates${lg}" data-dir>${plates}</div></div>`;
    }).join("");
  }
  return { orgLogo, logoWall, tierLabel };
}
