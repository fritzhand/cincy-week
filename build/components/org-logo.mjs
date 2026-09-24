/* ============================================================
   build/components/org-logo.mjs · OWNER: Agent F (directory)
   Landed by Agent A as a working stub; Agent F owns it.

   makeOrgLogos(ctx) → {
     orgLogo(root, org)        a.plate (3:2, white plate, logo unaltered) or .plate-text fallback;
                               links out to the org's site; id="o-{id}" is the search target
     logoWall(root, entries)   entries = [{ org, role }] (db.orgsByProgram) → tiers → .plates
   }
   ============================================================ */
import { esc, attr, groupBy } from "../core/util.mjs";

export function makeOrgLogos(ctx) {
  const { img } = ctx;
  function orgLogo(root, o, { anchor = true } = {}) {
    const inner = img.logo(root, o);
    const idAttr = anchor ? ` id="o-${attr(o.id)}"` : "";
    const tone = img.entry("o", o.id)?.tone === "dark" ? ' data-tone="dark"' : "";
    return o.url
      ? `<a class="plate" href="${attr(o.url)}"${idAttr}${tone} target="_blank" rel="noopener">${inner}<span class="sr-only">${esc(o.name)} (opens in a new tab)</span></a>`
      : `<span class="plate"${idAttr}${tone}>${inner}</span>`;
  }
  function logoWall(root, entries, seen = new Set()) {
    const tiers = groupBy(entries, (x) => x.role.tier || x.role.relationship);
    return [...tiers].map(([tier, xs]) => `<p class="tier label">${esc(tier.charAt(0).toUpperCase() + tier.slice(1))}</p><div class="plates">${xs.map((x) => { const a = !seen.has(x.org.id); seen.add(x.org.id); return orgLogo(root, x.org, { anchor: a }); }).join("")}</div>`).join("");
  }
  return { orgLogo, logoWall };
}
