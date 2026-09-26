/* ============================================================
   site/js/lib/ics.js · OWNER: Agent D (schedule & plan) · PURE (no DOM)
   iCalendar (RFC 5545) for "Add to calendar" and the My Plan export
   (engine spec §4.8). Imported by the event dialog and features/plan.js
   (lazily), and by tests/ics.test.mjs.

   vcalendar(items, { name, stamp, domain }) → text with CRLF line endings, lines folded at
   75 octets (UTF-8 safe), TEXT values escaped (\ ; , newline), times in UTC "Z" (no VTIMEZONE:
   calendar apps show local time). One VEVENT per item. An item is
     { uid, title, s, e?, allDay?: { start, end }, allDayDate?, location?, geo?: [lat, lng],
       description?, url?, category?, cancelled?, transparent? }
   - s / e are epoch ms. e null or undefined = end time not listed: DTEND is left out rather
     than invented (RFC 5545 §3.6.1: the event then ends when it starts) and the description says so.
   - allDay { start, end } (ISO dates, end inclusive) gives VALUE=DATE with an exclusive DTEND;
     allDayDate "YYYY-MM-DD" is the one-day shorthand.
   gcalUrl(item) → a Google Calendar "render" link for the same item (widely used, not formally
   documented, so the .ics download stays the primary action).
   ============================================================ */
const pad = (n) => String(n).padStart(2, "0");

/** epoch ms → "20261008T230000Z" */
export const utc = (epoch) => { const d = new Date(epoch); return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`; };

/** "2026-10-08" → "20261008" */
export const ymd = (iso) => iso.replace(/-/g, "");

/** The day after an ISO date (DTEND of an all-day span is exclusive). */
export function nextDay(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** TEXT escaping (RFC 5545 §3.3.11): backslash, semicolon, comma and newlines; other control characters dropped. */
export const escText = (s) => String(s ?? "")
  .replace(/\r\n?/g, "\n")
  .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
  .replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

const enc = new TextEncoder();
/** Fold a content line at 75 octets without splitting a UTF-8 sequence (continuation lines start with one space). */
export function fold(line) {
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = "", n = 0, limit = 75;
  for (const ch of line) {
    const len = enc.encode(ch).length;
    if (n + len > limit) { out.push(cur); cur = ""; n = 0; limit = 74; }
    cur += ch; n += len;
  }
  out.push(cur);
  return out.join("\r\n ");
}

/** A URI value: no escaping, but never a line break or a space. */
const uri = (u) => String(u).replace(/[\r\n\s]+/g, "");

export function vevent(ev, { stamp = Date.now(), domain = "fritzhand.github.io" } = {}) {
  const L = ["BEGIN:VEVENT", `UID:${String(ev.uid).replace(/[^\w.@-]/g, "-")}@${domain}`, `DTSTAMP:${utc(stamp)}`];
  const span = ev.allDay || (ev.allDayDate ? { start: ev.allDayDate, end: ev.allDayDate } : null);
  if (span) {
    L.push(`DTSTART;VALUE=DATE:${ymd(span.start)}`, `DTEND;VALUE=DATE:${ymd(nextDay(span.end || span.start))}`);
  } else {
    L.push(`DTSTART:${utc(ev.s)}`);
    if (ev.e != null && ev.e > ev.s) L.push(`DTEND:${utc(ev.e)}`);
  }
  L.push(`SUMMARY:${escText(ev.title)}`);
  if (ev.location) L.push(`LOCATION:${escText(ev.location)}`);
  if (Array.isArray(ev.geo) && ev.geo.length === 2 && ev.geo.every((x) => typeof x === "number" && isFinite(x))) L.push(`GEO:${ev.geo[0]};${ev.geo[1]}`);
  if (ev.description) L.push(`DESCRIPTION:${escText(ev.description)}`);
  if (ev.url) L.push(`URL:${uri(ev.url)}`);
  if (ev.category) L.push(`CATEGORIES:${escText(ev.category)}`);
  if (ev.cancelled) L.push("STATUS:CANCELLED");
  if (ev.transparent || span) L.push("TRANSP:TRANSPARENT");
  L.push("END:VEVENT");
  return L;
}

export function vcalendar(items, { name = "Cincy Week", stamp = Date.now(), domain = "fritzhand.github.io" } = {}) {
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Cincy Week//Cincy Week guide//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${escText(name)}`];
  for (const ev of items) L.push(...vevent(ev, { stamp, domain }));
  L.push("END:VCALENDAR");
  return L.map(fold).join("\r\n") + "\r\n";
}

/** Google Calendar template link for one item (zero-length when the end time is not listed). */
export function gcalUrl(ev) {
  const span = ev.allDay || (ev.allDayDate ? { start: ev.allDayDate, end: ev.allDayDate } : null);
  const dates = span ? `${ymd(span.start)}/${ymd(nextDay(span.end || span.start))}` : `${utc(ev.s)}/${utc(ev.e != null && ev.e > ev.s ? ev.e : ev.s)}`;
  const q = new URLSearchParams({ action: "TEMPLATE", text: ev.title || "", dates });
  if (ev.description) q.set("details", ev.description);
  if (ev.location) q.set("location", ev.location);
  return `https://calendar.google.com/calendar/render?${q}`;
}

/** "Ready. Set. BLINK!" → "ready-set-blink.ics" */
export function icsFilename(title, fallback = "cincy-week") {
  const s = String(title || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");
  return `${s || fallback}.ics`;
}

/** One assets/data/events.json event → vcalendar() items.
 *  data = the events.json object (venues, programs); base = the absolute site root ("https://…/cincy-week/");
 *  span = [firstDate, lastDate] of a multi-day item's full run (assets/data/schedule-extra.json).
 *  A timed event gives one item per festival-day instance (end left out when not listed); a multi-day or
 *  single-day item without listed hours gives one all-day span. Flags: 1 endUnknown · 2 timeUnknown · 4 allDay. */
export function eventItems(ev, data, { base = "", maxDesc = 600, span = null } = {}) {
  const v = ev.v && data.venues ? data.venues[ev.v] : null;
  const location = v ? [v.n, v.a].filter(Boolean).join(", ") : ev.lt || "";
  const link = `${base}schedule.html?e=${ev.id}#e-${ev.id}`;
  const desc = String(ev.d || "").replace(/\s+/g, " ").trim();
  const short = desc.length > maxDesc ? `${desc.slice(0, desc.lastIndexOf(" ", maxDesc) > maxDesc * 0.6 ? desc.lastIndexOf(" ", maxDesc) : maxDesc).replace(/[\s,.;:–—-]+$/, "")}…` : desc;
  const prog = data.programs && data.programs[ev.p] ? data.programs[ev.p].n : ev.p;
  const common = { title: ev.t, location, geo: v && v.ll ? v.ll : null, url: link, category: prog, cancelled: ev.st === "cancelled" };
  const text = (extra) => [short, extra, ev.src ? `Official page: ${ev.src}` : "", `Cincy Week: ${link}`].filter(Boolean).join("\n\n");
  const inst = ev.i || [];
  if (!inst.length) return [];
  const noHours = inst.every(([, , , f]) => f & 6);
  if (noHours) {
    // a long run (an exhibition) becomes one all-day span over its full dates when they are known
    const [first, last] = span || [inst[0][0], inst[inst.length - 1][0]];
    return [{ ...common, uid: ev.id, allDay: { start: first, end: last }, description: text(inst[0][3] & 2 ? `Hours not listed${ev.ht ? `: ${ev.ht}` : ""}.` : "") }];
  }
  return inst.filter(([, , , f]) => !(f & 6)).map(([day, s, e, f]) => ({
    ...common, uid: inst.length > 1 ? `${ev.id}-${day}` : ev.id, s, e: f & 1 ? null : e,
    description: text(f & 1 ? "End time not listed." : ""),
  }));
}
