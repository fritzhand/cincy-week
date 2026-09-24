/* ============================================================
   build/components/person-card.mjs · OWNER: Agent F (directory)
   Landed by Agent A as a working stub; Agent F owns it.

   makePersonCards(ctx) → {
     personCard(root, person, { prog })  a.person[data-prog] row (DESIGN.md §9.5):
                                         mug, serif name, "Title, Org", footer with bullet + role · count
     avatarStack(root, people, max = 3)  up to three 28×35 mugs
   }
   Directory filter data on each row: data-r (roles), data-p (programs), data-l (A–Z), data-q (search text).
   ============================================================ */
import { esc, attr } from "../core/util.mjs";
import { ROLE_LABEL } from "../core/schema.mjs";
import { norm } from "../../site/js/lib/search.js";

export function makePersonCards(ctx) {
  const { img, h } = ctx;
  const letter = (p) => (norm(p.sort_name || p.name).match(/[a-z]/) || ["#"])[0].toUpperCase();

  function personCard(root, p, { prog } = {}) {
    const pr = prog || p.programs[0] || "also";
    const p2 = p.programs.find((x) => x !== pr);
    const role = ROLE_LABEL[p.roles[0]] || "Participant";
    const n = p.events.length, w = p.works.length;
    const count = n ? `${n} session${n === 1 ? "" : "s"}` : w ? `${w} work${w === 1 ? "" : "s"}` : "";
    const sub = [p.title, p.org].filter(Boolean).join(", ") || p.location || "";
    return `<a class="person" href="${root}people/${attr(p.id)}.html" data-prog="${pr}"${p2 ? ` data-prog2="${p2}"` : ""} data-r="${attr(p.roles.join(" "))}" data-p="${attr(p.programs.join(" "))}" data-l="${letter(p)}" data-q="${attr(norm([p.name, p.title, p.org].filter(Boolean).join(" ")))}">${img.mug(root, p, { prog: pr })}<span class="per-name">${esc(p.name)}</span>${sub ? `<span class="per-role">${esc(sub)}</span>` : ""}<span class="per-foot">${h.bullet(pr)}${p2 ? h.bullet(p2) : ""}<span class="label">${esc([role, count].filter(Boolean).join(" · "))}</span></span></a>`;
  }

  function avatarStack(root, people, max = 3) {
    return `<span class="avatar-stack" aria-hidden="true">${people.slice(0, max).map((p) => img.mug(root, p, { size: "s" })).join("")}</span>`;
  }
  return { personCard, avatarStack, letter };
}
