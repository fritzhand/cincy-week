/* ============================================================
   build/core/images.mjs · OWNER: Agent F (directory: people, art, partners)
   (The path is core/ for import reasons; Agent F owns it.)
   Reads data/images.json, written by scripts/fetch-images.py, and renders <img> with explicit
   dimensions, srcset and lazy loading, or a fallback: a monogram mug (people), a text plate (orgs),
   a halftone "Photo coming" (works). No inline colors: frames take their tint from [data-prog].

   Manifest (per key "p/<id>" | "o/<id>" | "w/<id>"; "o/prog-<program>" holds the official program marks):
     { file: "img/p/<id>.webp", w, h, bg, src, source_url,
       sm?: { file, w, h },   people: the 96px square beside the 320px one
       lg?: { file, w, h },   works: the 960w variant beside the 480w one
       tone?: "light"|"dark" } logos: the plate the logo was made for (dark = light ink on a black plate)

   API (engine spec §4.11, CONTRACTS §4):
     makeImages(db) → { img, has, entry, path, srcset, mug, logo, photo, credit, SIZES }
     img(root, kind, id, { alt, cls, sizes, lazy = true, big = false })
                              → <img src srcset sizes width height loading decoding> | "" (no image)
                                (big: works use the 960w file as src, for dialogs and person pages)
     has(kind, id) · entry(kind, id) → manifest record | null · path(kind, id) → "assets/img/…" | null
     srcset(root, kind, id)   → "…-96.webp 96w, ….webp 320w" | ""
     mug(root, person, { size: ""|"s"|"m"|"l", alt, prog, cls })
                              → span.avatar[data-prog] with the photo, or .avatar.mono.halftone initials
     logo(root, org, { alt }) → <img> | span.plate-text
     photo(root, work, { alt, sizes, big }) → <img> | span.photo-missing ("Photo coming")
     credit(kind, id)         → "BLINK" | "cdn.evbuc.com" | "": where the image was published (a program's
                                name when it came from that program's site, else the page's host)
   ============================================================ */
import { esc, attr, initials, hostOf } from "./util.mjs";
import { PROGRAM_LABELS } from "./components.mjs";

/** `sizes` for each rendered size (CSS px): mugs are 4:5 frames over a square file, so width rules. */
export const SIZES = {
  s: "28px", m: "44px", "": "(min-width: 1100px) 80px, 64px", l: "96px", portrait: "(min-width: 860px) 240px, 120px",
  feature: "(min-width: 560px) 200px, 46vw", work: "(min-width: 1100px) 280px, (min-width: 560px) 33vw, 46vw",
  workBig: "(min-width: 700px) 640px, 100vw",
};

export function makeImages(db) {
  const M = db.images || {};
  const entry = (kind, id) => M[`${kind}/${id}`] || null;
  const has = (kind, id) => !!entry(kind, id);
  /** Site-root-relative URL of an image (the build copies site/img → docs/assets/img). */
  const path = (kind, id) => { const e = entry(kind, id); return e ? `assets/${e.file}` : null; };
  function srcset(root, kind, id) {
    const e = entry(kind, id);
    if (!e) return "";
    const v = [[e.file, e.w]];
    if (e.sm) v.unshift([e.sm.file, e.sm.w]);
    if (e.lg) v.push([e.lg.file, e.lg.w]);
    return v.length > 1 ? v.map(([f, w]) => `${root}assets/${f} ${w}w`).join(", ") : "";
  }
  function img(root, kind, id, { alt = "", cls = "", sizes = "", lazy = true, big = false } = {}) {
    const e = entry(kind, id);
    if (!e) return "";
    const main = big && e.lg ? e.lg : e;
    const set = srcset(root, kind, id);
    const sz = sizes || (kind === "p" ? SIZES[""] : kind === "w" ? SIZES.work : "");
    return `<img${cls ? ` class="${attr(cls)}"` : ""} src="${attr(root + "assets/" + main.file)}"${set && sz ? ` srcset="${attr(set)}" sizes="${attr(sz)}"` : ""} alt="${attr(alt)}" width="${main.w}" height="${main.h}"${lazy ? ' loading="lazy"' : ""} decoding="async">`;
  }
  const firstProg = (p) => (p.programs && p.programs[0]) || "also";
  function mug(root, person, { size = "", alt = "", prog, cls = "" } = {}) {
    const pr = prog || firstProg(person);
    const c = `avatar${size ? " " + size : ""}${cls ? " " + cls : ""}`;
    const i = img(root, "p", person.id, { alt, sizes: SIZES[size] ?? SIZES[""] });
    if (i) return `<span class="${c}" data-prog="${pr}">${i}</span>`;
    return `<span class="${c} mono halftone" data-prog="${pr}"${alt ? ` role="img" aria-label="${attr(alt)}"` : ""}><span aria-hidden="true">${esc(initials(person.name))}</span></span>`;
  }
  function logo(root, org, { alt } = {}) {
    const i = img(root, "o", org.id, { alt: alt ?? `${org.name} logo` });
    return i || `<span class="plate-text">${esc(org.name)}</span>`;
  }
  function photo(root, work, { alt = "", sizes = "", big = false } = {}) {
    const i = img(root, "w", work.id, { alt, sizes, big });
    return i || `<span class="photo-missing"><span class="label">No photo yet</span></span>`;
  }
  /** Who published the image: the program's short name when it came from that program's site, else the host. */
  function credit(kind, id) {
    const e = entry(kind, id);
    if (!e) return "";
    const host = hostOf(e.source_url || e.src || "");
    for (const p of db.programs || []) {
      if (p.url && hostOf(p.url) === host) return PROGRAM_LABELS[p.id]?.short || p.short_name || p.name;
    }
    return host;
  }
  return { img, has, entry, path, srcset, mug, logo, photo, credit, SIZES };
}
