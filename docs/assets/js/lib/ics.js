/* ============================================================
   site/js/lib/ics.js · OWNER: Agent D (schedule & plan) · PURE (no DOM)
   STUB landed by Agent A so imports resolve from day one. Contract
   (engine spec §4.8): vcalendar(events, { name }) → iCalendar text with
   CRLF line endings, 75-octet folding, TEXT escaping, UTC "Z" times, one
   VEVENT per day instance. Agent D owns this file and tests/ics.test.mjs.
   ============================================================ */
const pad = (n) => String(n).padStart(2, "0");
export const utc = (epoch) => { const d = new Date(epoch); return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`; };
export const escText = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Fold a content line at 75 octets without splitting a UTF-8 sequence. */
export function fold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = []; let cur = "", n = 0, limit = 75;
  for (const ch of line) {
    const len = enc.encode(ch).length;
    if (n + len > limit) { out.push(cur); cur = ""; n = 0; limit = 74; }
    cur += ch; n += len;
  }
  out.push(cur);
  return out.join("\r\n ");
}

/** events: [{ uid, s, e, title, location?, description?, url?, category?, allDayDate? }] */
export function vcalendar(events, { name = "Cincy Week", stamp = Date.now() } = {}) {
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Cincy Week//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${escText(name)}`];
  for (const ev of events) {
    L.push("BEGIN:VEVENT", `UID:${ev.uid}@fritzhand.github.io`, `DTSTAMP:${utc(stamp)}`);
    if (ev.allDayDate) L.push(`DTSTART;VALUE=DATE:${ev.allDayDate.replace(/-/g, "")}`);
    else L.push(`DTSTART:${utc(ev.s)}`, `DTEND:${utc(ev.e)}`);
    L.push(`SUMMARY:${escText(ev.title)}`);
    if (ev.location) L.push(`LOCATION:${escText(ev.location)}`);
    if (ev.description) L.push(`DESCRIPTION:${escText(ev.description)}`);
    if (ev.url) L.push(`URL:${ev.url}`);
    if (ev.category) L.push(`CATEGORIES:${escText(ev.category)}`);
    L.push("END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.map(fold).join("\r\n") + "\r\n";
}
