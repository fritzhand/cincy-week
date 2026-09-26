/* ============================================================
   site/js/features/progdays.js · OWNER: QA (added in the UX pass; program pages, G's lane)
   Long program schedules fold each day into <details class="prog-day" data-day> (build/pages/program.mjs).
   During the week this opens today's festival day; a #<program>-d-<date> link opens its day. Nothing else:
   the days stay closed or open as the reader leaves them.
   ============================================================ */
import { festivalToday } from "../lib/agenda.js";

export function init(app) {
  const days = [...document.querySelectorAll("details.prog-day[data-day]")];
  if (!days.length) return;
  const openHash = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    const d = id && document.getElementById(id);
    if (d && d.matches("details.prog-day")) d.open = true;
  };
  if (app.phase() === "during") {
    const today = festivalToday(app.now());
    for (const d of days) if (d.dataset.day === today) d.open = true;
  }
  openHash();
  addEventListener("hashchange", openHash);
}
