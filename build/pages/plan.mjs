/* ============================================================
   build/pages/plan.mjs · OWNER: Agent D (schedule & plan)
   My Plan (engine spec §4.8, DESIGN.md §9.10). The plan lives in this browser (localStorage
   cw-plan), so the page is client-rendered by features/plan.js from assets/data/events.json and
   works.json: starred events by festival day, overlaps with their length, walking-gap estimates
   between consecutive places, the art to see, .ics export, a share link (plan.html#p=<codes>;w=<codes>)
   and an import view for shared links. The server renders the frame, the empty state with
   suggested highlights, and a no-JS message.
   ============================================================ */
export function pages(ctx) {
  const { c, h, db, cards } = ctx;
  const { icon } = h;
  // suggested highlights for an empty plan: the editors' featured events, soonest first
  const featured = db.events.filter((e) => e.live && e.featured && e.instances.length).sort((a, b) => a.instances[0].s - b.instances[0].s).slice(0, 6);
  const highlights = (root) => (featured.length ? `<h2 class="sub-h">Suggested highlights</h2><ol class="tonight">${featured.map((e) => cards.eventRow(root, e.instances[0])).join("")}</ol>` : "");
  return [{
    path: "plan.html", nav: "plan", title: "My Plan", features: ["plan"],
    description: "The events and art you starred, by day, with overlaps, walking time between places, calendar export and a share link. Saved only in this browser.",
    body: (root) => `${c.pageHead({ num: 1, kicker: "My Plan", title: "My Plan", lede: "The events and art you starred, by day. Your plan is saved only in this browser: nothing is sent anywhere." })}
<noscript>${c.callout("warn", `<p>My Plan needs JavaScript: it lives in your browser's storage. <a href="${root}schedule.html">The Week</a> works without it, with every event and its details.</p>`)}</noscript>
<div class="plan js-only" data-plan>
<div data-plan-shared hidden></div>
<div class="plan-bar" data-plan-actions hidden>
<div class="btn-row"><button class="btn btn-primary" type="button" data-plan-ics>${icon("download")}Export to calendar (.ics)</button><button class="btn btn-secondary" type="button" data-plan-share>${icon("share")}Share this plan</button><button class="btn btn-ghost" type="button" data-plan-clear>Clear plan</button></div>
<div class="plan-confirm" data-plan-confirm hidden role="group" aria-labelledby="plan-confirm-t"><p id="plan-confirm-t"></p><div class="btn-row"><button class="btn btn-primary" type="button" data-plan-clear-yes>Remove all</button><button class="btn btn-secondary" type="button" data-plan-clear-no>Keep my plan</button></div></div>
<p class="result-count" role="status" aria-live="polite" data-plan-summary></p>
</div>
<div data-plan-list></div>
<div data-plan-empty>${c.emptyState({ title: "Star events to build your plan", body: "Tap the star on any event in The Week, or on a work of art, and it shows up here, by day, with overlaps and walking times.", glyph: "star", action: `<a class="btn btn-primary" href="${root}schedule.html">${icon("calendar")}Go to The Week</a>` })}
${highlights(root)}</div>
<p class="plan-loading unk" data-plan-loading hidden>Loading your plan</p>
</div>`,
  }];
}
