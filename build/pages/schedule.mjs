/* ============================================================
   build/pages/schedule.mjs · OWNER: Agent D (schedule & plan)
   STUB landed by Agent A: every event card, server-rendered and grouped by
   festival day, so deep links (schedule.html?e=<id>#e-<id>) resolve. Agent D
   replaces it with "The Week": day strip, filters + sheet, slots, the NOW
   line, the ongoing band and the event dialog (engine spec §4.8, DESIGN §9.4).
   ============================================================ */
import { stubPage } from "./_stub.mjs";

export function pages(ctx) {
  const { db, cards, h } = ctx;
  const shown = db.instances.filter((x) => x.ev.live || x.ev.status === "cancelled");
  // multi-day and hours-not-listed items once, in their own band; timed sessions by festival day
  const ongoing = db.events.filter((e) => (e.live || e.status === "cancelled") && e.instances.some((x) => x.ongoing));
  const timed = shown.filter((x) => !x.ongoing);
  return [stubPage(ctx, {
    slug: "schedule", title: "The Week", num: 1, kicker: "The Week",
    lede: `Every session, show and party from ${h.fmtDateRange(ctx.config.week.start, ctx.config.week.end)}, day by day. Star what you want to see; it goes to My Plan.`,
    what: "Day tabs, filters by program, kind, time and neighborhood, a list and a map view, and live status are coming to this page.",
    owner: "schedule", features: ["schedule"],
    body: (root) => `<p class="result-count" role="status" aria-live="polite" data-result-count><b>${db.counts.events}</b> events in the guide</p>
${ongoing.length ? `<h2 class="sub-h">All week and ongoing</h2><div class="grid">${ongoing.map((e) => cards.eventCard(root, e, { span: true })).join("")}</div>` : ""}
${cards.eventList(root, timed, { groupBy: "day", headingLevel: 2 })}`,
  })];
}

/** Search entries: one per event (engine spec §4.9). */
export function search(ctx) {
  const { db, h } = ctx;
  return db.events.filter((e) => e.live).map((e) => {
    const x = e.instances[0];
    const when = x ? [h.fmtDay(x.day), x.start && !x.timeUnknown ? h.fmtTime(x.start) : null].filter(Boolean).join(" · ") : "";
    const people = (e.people || []).map((p) => db.byId.person.get(p)?.name).filter(Boolean);
    return {
      k: "ev", id: e.id, t: e.title, s: [when, e.venue?.name || e.location_text].filter(Boolean).join(" · "),
      u: `schedule.html?e=${e.id}#e-${e.id}`, p: e.program, g: [e.kind, ...(e.tags || []), ...(e.tracks || []), ...people].join(" "),
      st: x?.s, en: x?.e,
    };
  });
}
