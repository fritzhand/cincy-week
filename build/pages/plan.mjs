/* ============================================================
   build/pages/plan.mjs · OWNER: Agent D (schedule & plan)
   STUB landed by Agent A. My Plan is client-rendered from
   assets/data/events.json + localStorage (cw-plan); the page carries a
   no-JS message and an empty root. Agent D replaces it (conflicts,
   walking gaps, .ics export, share and import; engine spec §4.8).
   ============================================================ */
export function pages(ctx) {
  const { c, h } = ctx;
  return [{
    path: "plan.html", nav: "plan", title: "My Plan", features: ["plan"],
    description: "The events and art you starred, by day, saved only in this browser.",
    body: (root) => `${c.pageHead({ num: 1, kicker: "My Plan", title: "My Plan", lede: "The events and art you starred, by day. Your plan is saved only in this browser: nothing is sent anywhere." })}
<noscript>${c.callout("warn", "<p>My Plan needs JavaScript: it lives in your browser's storage. The Week works without it.</p>")}</noscript>
<div class="plan-root js-only" data-plan-root>${c.emptyState({ title: "Star events to build your plan", body: "Tap the star on any event in The Week, or on a work of art, and it shows up here.", glyph: "star", action: `<a class="btn btn-primary" href="${root}schedule.html">${h.icon("calendar")}Go to The Week</a>` })}</div>
${c.placeholder("Conflicts, walking time between events, calendar export and plan sharing are coming to this page.", "plan")}`,
  }];
}
