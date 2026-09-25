/* tests/schedule.test.mjs · OWNER: Agent D · The Week, the event card, My Plan (build output on the mini fixture) */
import { test } from "node:test";
import assert from "node:assert/strict";
import { copyRepo, build, read, json, editData, cleanup, fx } from "./helpers.mjs";

let dir, sched, plan;
test("setup: the fixture builds", () => {
  dir = copyRepo();
  const r = build(dir);
  assert.equal(r.status, 0, r.stderr);
  sched = read(dir, "docs/schedule.html");
  plan = read(dir, "docs/plan.html");
});

test("every event appears once, as a card, with the contract attributes", () => {
  for (const e of fx("events")) {
    const n = (sched.match(new RegExp(`<article class="ev"[^>]* data-ev="${e.id}"`, "g")) || []).length;
    assert.equal(n, 1, `${e.id} appears ${n} times`);
  }
  // the multi-day BLINK run sits in the band, follows each night's hours and lists its days
  const band = sched.slice(sched.indexOf("data-ongoing"), sched.indexOf('class="sched-day"'));
  const blink = band.match(/<article class="ev" id="e-blink-nightly"[^>]*>/)[0];
  assert.match(blink, /data-inst="\d+:\d+(,\d+:\d+){3}"/);
  assert.match(blink, /data-days="2026-10-08 2026-10-09 2026-10-10 2026-10-11"/);
  // an exhibition with no hours: no invented state, printed as unknown
  const ff = band.match(/<article class="ev" id="e-fotofocus-exh-[^"]*"[^>]*>[\s\S]*?<\/article>/)[0];
  assert.match(ff, /data-time-unknown="1"/);
  assert.match(ff, /Hours not listed/);
  // a session with no end time says so
  const kick = sched.match(/<article class="ev" id="e-scw-sucw-2026-kickoff"[\s\S]*?<\/article>/)[0];
  assert.match(kick, /data-end-unknown="1"/);
  assert.match(kick, /end time not listed/);
  assert.match(kick, /<details class="ev-more"><summary>Details<\/summary>/, "the no-JS body");
});

test("day strip: a tab per day plus All, five ticks in order, names that say the day, count and programs", () => {
  const tabs = [...sched.matchAll(/<a class="daytab[^"]*" id="dt-([^"]+)" href="#[^"]+" data-day="[^"]+"[^>]*aria-label="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
  assert.ok(tabs.length >= 10, `${tabs.length} tabs`);
  assert.equal(tabs[tabs.length - 1][1], "all");
  const thu = tabs.find((t) => t[1] === "2026-10-08");
  assert.match(thu[2], /^Thursday, October 8, \d+ events?\. Cincinnati Art Week, StartupCincy Week \(last day\), BLINK \(opening night\), FotoFocus Biennial$/);
  assert.equal((thu[3].match(/<i data-prog="(caw|scw|blink|fotofocus)"><\/i>/g) || []).join(""), '<i data-prog="caw"></i><i data-prog="scw"></i><i data-prog="blink"></i><i data-prog="fotofocus"></i>');
  const sat = tabs.find((t) => t[1] === "2026-10-03");
  assert.match(sat[3], /<i data-prog="caw"><\/i><i><\/i><i><\/i><i><\/i><i data-prog="fotofocus"><\/i>/, "an absent program keeps its place");
  // without JS the tabs are links to the day sections
  for (const t of tabs.slice(0, -1)) assert.ok(sched.includes(`id="d-${t[1]}"`), `section d-${t[1]}`);
  assert.match(sched, /<p class="tick-legend"/);
});

test("filters: program chips, the sheet with kinds, times, switches and a live count", () => {
  assert.match(sched, /<div class="filter-row js-only">/);
  assert.match(sched, /data-sf="p" data-v="fotofocus,also"/, "FotoFocus & more covers both programs");
  assert.match(sched, /role="status" aria-live="polite" data-result-count/);
  assert.match(sched, /<div class="modal sheet" id="sched-filters" role="dialog" aria-modal="true" aria-labelledby="sched-filters-h" data-modal>/);
  for (const k of ["star", "past", "free"]) assert.match(sched, new RegExp(`role="switch" aria-checked="false" data-sf-switch="${k}"`));
  for (const t of ["morning", "afternoon", "evening", "late"]) assert.match(sched, new RegExp(`data-sf="t" data-v="${t}"`));
  assert.match(sched, /data-sf="when" data-v="now"/);
  const meta = JSON.parse(sched.match(/<script type="application\/json" data-sched-meta>([\s\S]*?)<\/script>/)[1]);
  assert.equal(meta.week.start, "2026-10-03");
  assert.ok(meta.kinds.performance && meta.groups.talks);
});

test("the dialog's extra data: full spans of multi-day items and mini-maps for venues", () => {
  const x = json(dir, "docs/assets/data/schedule-extra.json");
  assert.equal(x.v, 1);
  assert.deepEqual(x.spans["blink-nightly"], ["2026-10-08", "2026-10-11"]);
  assert.deepEqual(x.spans["fotofocus-exh-witness-to-the-journey-matt-herron-and-the-mississippi-delta1965"], ["2026-09-04", "2026-11-08"], "the full run, not the window");
  const withLL = fx("venues").filter((v) => v.lat != null && fx("events").some((e) => e.venue_id === v.id));
  assert.ok(withLL.length);
  for (const v of withLL) {
    assert.ok(x.venues[v.id], `venue ${v.id}`);
    assert.match(x.venues[v.id].d.google, /^https:\/\/www\.google\.com\/maps\/dir\//);
  }
});

test("My Plan: a no-JS message, an empty state with highlights, and the client root", () => {
  assert.match(plan, /<noscript>[\s\S]*My Plan needs JavaScript[\s\S]*<\/noscript>/);
  assert.match(plan, /<div class="plan js-only" data-plan>/);
  assert.match(plan, /Star events to build your plan/);
  assert.match(plan, /data-plan-ics[\s\S]*data-plan-share[\s\S]*data-plan-clear/);
});

test("teardown", () => cleanup(dir));

test("a cancelled event stays listed, struck and labeled; an after-midnight start sits under the night before", () => {
  const d = copyRepo();
  try {
    editData("events", (a) => {
      a.find((e) => e.id === "blink-2026-10-08-drone-show-2030").status = "cancelled";
      const late = a.find((e) => e.id === "blink-2026-10-09-drone-show-2200");
      late.date = "2026-10-10"; late.start = "00:30"; late.end = "01:00";
    })(d);
    const r = build(d);
    assert.equal(r.status, 0, r.stderr);
    const s = read(d, "docs/schedule.html");
    const c = s.match(/<article class="ev" id="e-blink-2026-10-08-drone-show-2030"[^>]*>[\s\S]*?<\/article>/)[0];
    assert.match(c, /data-cancelled="1"/);
    assert.match(c, /badge-warn">Cancelled/);
    const late = s.match(/<article class="ev" id="e-blink-2026-10-09-drone-show-2200"[^>]*>[\s\S]*?<\/article>/)[0];
    assert.match(late, /data-day="2026-10-09"/, "a 12:30 AM start on Oct 10 belongs to Friday night");
    assert.match(late, /after midnight/);
    const fri = s.slice(s.indexOf('id="d-2026-10-09"'), s.indexOf('id="d-2026-10-10"'));
    assert.ok(fri.includes('id="e-blink-2026-10-09-drone-show-2200"'), "listed in Friday's section");
  } finally { cleanup(d); }
});

test("a multi-day event passed as a record elsewhere (a person page) follows each day's hours", () => {
  const d = copyRepo();
  try {
    editData("events", (a) => { a.find((e) => e.id === "blink-nightly").people = ["abby-grimm"]; })(d);
    const r = build(d);
    assert.equal(r.status, 0, r.stderr);
    const p = read(d, "docs/people/abby-grimm.html");
    const card = p.match(/<article class="ev"[^>]* data-ev="blink-nightly"[^>]*>/);
    assert.ok(card, "the person page lists the BLINK run");
    assert.match(card[0], /data-inst="\d+:\d+(,\d+:\d+){3}"/);
  } finally { cleanup(d); }
});
