/* ============================================================
   build/components/person-card.mjs · OWNER: Agent F (directory: people, art, partners)

   makePersonCards(ctx) → {
     personCard(root, person, { prog, id })  a.person directory row (DESIGN.md §9.5): the 64×80 mug
                                        (80×100 at ≥ 1100px) with a 4px program foot, the serif name,
                                        "Title, Org" (or the location), and a footer with the bullet(s)
                                        and "Speaker · 2 sessions" in the program's text ink. The whole
                                        row is the link to people/<id>.html.
     personFeature(root, person, { prog })  a.person-feature: the 4:5 featured mug (home, program pages)
     avatarStack(root, people, max = 3)     up to three 28×35 mugs (decorative; names sit beside them)
     personLetter(person)                   "A"…"Z" or "#": the A–Z index key (sort name, else the name)
     personSortKey(person)                  the directory order (sort name, else the name, accent-folded)
     roleLine(person)                       plain text "Speaker · Judge · 2 sessions"
   }
   Directory filter data on each row (site/js/features/directory.js, engine §4.8):
     data-r  roles (space-separated)          data-p  programs (space-separated)
     data-l  A–Z letter                        data-q  normalized name, title, org, location, work titles
     data-prog / data-prog2  program scope (second program → second bullet)
   ============================================================ */
import { esc, attr } from "../core/util.mjs";
import { ROLE_LABEL } from "../core/schema.mjs";
import { norm } from "../../site/js/lib/search.js";

export function makePersonCards(ctx) {
  const { img, h } = ctx;
  const personSortKey = (p) => norm(p.sort_name || p.name).replace(/^[^a-z0-9]+/, "");
  const personLetter = (p) => { const ch = personSortKey(p).charAt(0); return /[a-z]/.test(ch) ? ch.toUpperCase() : "#"; };
  const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;

  /** Plain text: up to two roles, then what they do this week ("2 sessions", "1 work"). */
  function roleLine(p) {
    const roles = p.roles.slice(0, 2).map((r) => ROLE_LABEL[r] || r);
    const n = p.events.length, w = p.works.length;
    const noun = n && p.events.every((e) => e.program === "scw") ? "session" : "event";
    const counts = [n ? plural(n, noun) : "", w ? plural(w, "work") : ""].filter(Boolean);
    return [...(roles.length ? roles : ["Participant"]), ...counts].join(" · ");
  }
  const subLine = (p) => [p.title, p.org].filter(Boolean).join(", ") || p.location || "";
  const progs = (p, prog) => {
    const pr = prog || p.programs[0] || "also";
    return [pr, p.programs.find((x) => x !== pr) || null];
  };

  function personCard(root, p, { prog, id } = {}) {
    const [pr, p2] = progs(p, prog);
    const sub = subLine(p);
    const q = norm([p.name, p.sort_name, p.title, p.org, p.location, ...p.works.map((w) => w.title)].filter(Boolean).join(" "));
    return `<a class="person" href="${root}people/${attr(p.id)}.html"${id ? ` id="${attr(id)}"` : ""} data-prog="${pr}"${p2 ? ` data-prog2="${p2}"` : ""} data-r="${attr(p.roles.join(" "))}" data-p="${attr(p.programs.join(" "))}" data-l="${personLetter(p)}" data-q="${attr(q)}">${img.mug(root, p, { prog: pr })}<span class="per-name">${esc(p.name)}</span>${sub ? `<span class="per-role">${esc(sub)}</span>` : ""}<span class="per-foot">${h.bullet(pr)}${p2 ? h.bullet(p2) : ""}<span class="label">${esc(roleLine(p))}</span></span></a>`;
  }

  function personFeature(root, p, { prog } = {}) {
    const [pr] = progs(p, prog);
    const photo = img.has("p", p.id)
      ? `<span class="photo">${img.img(root, "p", p.id, { sizes: img.SIZES.feature })}${h.bullet(pr)}</span>`
      : `<span class="photo halftone"><span class="mono" aria-hidden="true">${esc(h.initials(p.name))}</span>${h.bullet(pr)}</span>`;
    const sub = subLine(p);
    return `<a class="person-feature" href="${root}people/${attr(p.id)}.html" data-prog="${pr}">${photo}<span class="per-name">${esc(p.name)}</span>${sub ? `<span class="per-role">${esc(sub)}</span>` : ""}<span class="per-foot">${esc(roleLine(p))}</span></a>`;
  }

  function avatarStack(root, people, max = 3) {
    return `<span class="avatar-stack" aria-hidden="true">${people.slice(0, max).map((p) => img.mug(root, p, { size: "s" })).join("")}</span>`;
  }
  return { personCard, personFeature, avatarStack, personLetter, personSortKey, roleLine, letter: personLetter };
}
