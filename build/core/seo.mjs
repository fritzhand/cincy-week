/* ============================================================
   build/core/seo.mjs · OWNER: Agent A (core engine)
   JSON-LD builders, sitemap, robots and the 404 page.
   JSON-LD only states facts from data; unknown fields are left out.
   ============================================================ */
import { esc } from "./util.mjs";
import { icon } from "./icons.mjs";
import { nyToEpoch, isoLocal } from "./time.mjs";

const clean = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v === null || v === "" || (Array.isArray(v) && !v.length) ? undefined : v)));

/** Umbrella festival Event for a program page. */
export function programLd(config, prog, { url, venue } = {}) {
  return clean({
    "@context": "https://schema.org", "@type": "Festival", name: prog.name, description: prog.description ? prog.description.split("\n\n")[0] : null,
    startDate: prog.dates?.start, endDate: prog.dates?.end, url, sameAs: prog.url ? [prog.url] : null,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode", eventStatus: "https://schema.org/EventScheduled",
    location: venue ? placeLd(venue) : { "@type": "Place", name: "Cincinnati, Ohio", address: { "@type": "PostalAddress", addressLocality: "Cincinnati", addressRegion: "OH", addressCountry: "US" } },
    organizer: (prog.organizers || []).map((o) => clean({ "@type": "Organization", name: o.name, url: o.url })),
  });
}
/** Person page. */
export function personLd(p, { url, image } = {}) {
  return clean({ "@context": "https://schema.org", "@type": "Person", name: p.name, jobTitle: p.title, worksFor: p.org ? { "@type": "Organization", name: p.org } : null, description: p.bio ? p.bio.split("\n\n")[0] : null, url, image, sameAs: Object.values(p.links || {}).filter(Boolean) });
}
/** Venue page. */
export function placeLd(v, { url } = {}) {
  return clean({
    "@context": url ? "https://schema.org" : null, "@type": "Place", name: v.name, url,
    address: v.address ? clean({ "@type": "PostalAddress", streetAddress: v.address, addressLocality: v.city, addressRegion: v.state, postalCode: v.zip, addressCountry: "US" }) : null,
    geo: v.lat != null ? { "@type": "GeoCoordinates", latitude: v.lat, longitude: v.lng } : null,
  });
}
/** One dated event (for lists that want Event markup). */
export function eventLd(ev, inst, { url } = {}) {
  return clean({
    "@context": "https://schema.org", "@type": "Event", name: ev.title, url,
    startDate: inst.timeUnknown || inst.allDay ? inst.date : isoLocal(inst.s), endDate: inst.endUnknown || inst.timeUnknown || inst.allDay ? null : isoLocal(inst.e),
    location: ev.venue ? placeLd(ev.venue) : ev.location_text ? { "@type": "Place", name: ev.location_text } : null,
    eventStatus: ev.status === "cancelled" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
  });
}
export { nyToEpoch };

export function sitemap(siteBase, pages) {
  const urls = pages.filter((p) => !p.noindex).map((p) => `<url><loc>${esc(siteBase + (p.path === "index.html" ? "" : p.path))}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}
export const robots = (siteBase) => `User-agent: *\nAllow: /\nSitemap: ${siteBase}sitemap.xml\n`;

/** 404: "This stop isn't on the line" (DESIGN.md §9.14). root = pathPrefix, so every link is absolute. */
export function notFoundPage() {
  return {
    path: "404.html", slug: "404", nav: "", title: "Page not found", noindex: true, crumbs: [], pagenav: null,
    description: "That page isn't in the guide. Search it, or go to The Week.",
    body: (root) => `<div class="nf">
<p class="kicker label"><span>404 · Page not found</span></p>
<div class="nf-line" aria-hidden="true"><b></b><i></i><b></b><i class="gap"></i><b class="missing"></b><i class="gap"></i><b></b><i></i></div>
<h1>This stop isn't on the line.</h1>
<p class="lede">The page may have moved, or the link has a typo. Search the guide, or pick up the line from The Week.</p>
<div class="btn-row spaced"><button class="btn btn-primary" type="button" data-search-open>${icon("search")}Search the guide</button><a class="btn btn-secondary" href="${root}schedule.html">${icon("calendar")}The Week</a><a class="btn btn-secondary" href="${root}index.html">${icon("home")}Overview</a></div>
</div>`,
  };
}
