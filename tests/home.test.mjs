/* tests/home.test.mjs · OWNER: Agent G · home, program pages, news, FAQ and about (fixture builds) */
import { test } from "node:test";
import assert from "node:assert/strict";
import { copyRepo, build, read, editData, cleanup, fx } from "./helpers.mjs";

let dir, home, blink, caw, ff, news, faq, about;
test("setup: the fixture builds", () => {
  dir = copyRepo();
  const r = build(dir);
  assert.equal(r.status, 0, r.stderr);
  home = read(dir, "docs/index.html");
  blink = read(dir, "docs/blink.html");
  caw = read(dir, "docs/art-week.html");
  ff = read(dir, "docs/fotofocus.html");
  news = read(dir, "docs/news.html");
  faq = read(dir, "docs/faq.html");
  about = read(dir, "docs/about.html");
});
test.after(() => dir && cleanup(dir));

test("home: the week line is one list of nine day links with lanes in A S B F order and Thursday as the interchange", () => {
  const days = [...home.matchAll(/<li class="wk-day( is-interchange)?" data-date="([^"]+)">\s*<a class="wk-link" href="schedule\.html\?day=\2">([\s\S]*?)<\/a>\s*<span class="wk-lanes" aria-hidden="true">([\s\S]*?)<\/span>(?:<span class="wk-x)?/g)];
  assert.equal(days.length, 9);
  assert.deepEqual(days.map((d) => d[2]), ["2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);
  assert.deepEqual(days.filter((d) => d[1]).map((d) => d[2]), ["2026-10-08"], "one interchange");
  const thu = days.find((d) => d[2] === "2026-10-08");
  assert.match(thu[3], /<span class="sr-only">, Thursday, October 8<span data-wk-today hidden> \(today\)<\/span>: Cincinnati Art Week, StartupCincy Week \(last day\), BLINK \(opening night\), FotoFocus Biennial\. Interchange day<\/span>/);
  assert.match(thu[3], /<b>Interchange: all three run<\/b> · <b>BLINK opens<\/b>/, "the phone summary is computed");
  assert.deepEqual([...thu[4].matchAll(/<i data-prog="(\w+)"(?: data-run="(\w+)")?>/g)].map((m) => `${m[1]}:${m[2] || ""}`), ["caw:mid", "scw:end", "blink:start", "fotofocus:thru"]);
  const sat = home.match(/<li class="wk-day" data-date="2026-10-03">[\s\S]*?<\/li>/)[0];
  assert.match(sat, /<i data-prog="caw" data-run="start"><\/i><i data-prog="scw"><\/i><i data-prog="blink"><\/i><i data-prog="fotofocus" data-run="thru"><span class="wk-off l">‹ Sep 30<\/span><\/i>/, "an absent program keeps its lane; FotoFocus runs off the edge");
  assert.match(home, /<b class="wk-today" hidden>Today · <\/b>/, "today is marked by the client, never guessed by the build");
  assert.match(home, /<ul class="wk-key" aria-label="Programs, in lane order">/);
});

test("home: phase blocks, the ticker, program cards, sourced fact tiles, highlights, doors, news", () => {
  for (const ph of ["before", "during", "after"]) assert.match(home, new RegExp(`<div data-show="${ph}" data-ear="${ph}">`));
  assert.match(home, /<h1>Three festivals share one week, and on Thursday all three run at once\.<\/h1>/);
  assert.match(home, /<div class="nn-group"><p class="nn-label label">First up<\/p><div data-first-up><a class="nn-item" href="schedule\.html\?e=/, "First up is in the HTML without JS");
  assert.match(home, /<div class="countdown" data-countdown hidden>/, "the countdown needs the clock: hidden until the client fills it");
  assert.match(home, /<div class="ticker">[\s\S]*?<a class="ticker-item" href="https:\/\/www\.cincinnati\.com\/[^"]+" target="_blank" rel="noopener">/);
  assert.equal((home.match(/<article class="prog-card" data-prog="/g) || []).length, 4);
  assert.match(home, /<article class="prog-card" data-prog="scw">[\s\S]*?<span class="nw">Union Hall, OTR<\/span>/);
  assert.match(home, /<article class="prog-card" data-prog="blink">[\s\S]*?<span class="nw">7:00–11:00 PM<\/span>/);
  assert.doesNotMatch(home, /class="stats stats-facts"/, "only the curated fact ids become tiles (the fixture has none)");
  assert.match(home, /<section class="section" id="highlights"/);
  assert.equal((home.match(/<a class="door" href="/g) || []).length, 4);
  assert.match(home, /<section class="section" id="news"[\s\S]*?<article class="news-card" data-p="blink"/);
  const meta = JSON.parse(home.match(/<script type="application\/json" data-home-meta>([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(meta.interchange, ["2026-10-08"]);
  assert.deepEqual(meta.first, { name: "Art Week", date: "2026-10-03" });
});

test("program pages: identity head, organizers' quote with source, facts, schedule rows with stars, sources, JSON-LD", () => {
  assert.match(blink, /<header class="page-head prog-head" data-prog="blink">/);
  assert.match(blink, /<h1><span class="prog-u">BLINK<\/span><\/h1>/);
  assert.match(blink, /<aside class="callout tone-org" data-prog="blink">[\s\S]*?<blockquote><p>“BLINK® illuminated by ArtsWave/);
  assert.match(blink, /<dl class="facts"/);
  assert.match(blink, /href="schedule\.html\?p=blink">Full schedule/);
  // each session is one compact row with live state and a star; the nightly run is listed once, as a run
  assert.match(blink, /<li data-s="\d+" data-e="\d+"><a href="schedule\.html\?e=blink-2026-10-08-ready-set-blink-opening-ceremony#e-blink-2026-10-08-ready-set-blink-opening-ceremony" data-open-event=/);
  assert.equal((blink.match(/data-open-event="blink-nightly"/g) || []).length, 1);
  assert.match(blink, /<ol class="tonight prog-rows is-runs">[\s\S]*?data-inst="\d+:\d+(,\d+:\d+){3}"/);
  assert.match(blink, /<button class="star" type="button" data-star="blink-nightly"/);
  assert.match(blink, /<section class="section" id="sources"/);
  const ld = JSON.parse(blink.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(ld["@type"], "Festival");
  assert.equal(ld.startDate, "2026-10-08");
  // FotoFocus & more covers both programs
  assert.match(ff, /href="schedule\.html\?p=fotofocus,also">Full schedule/);
  assert.match(ff, /<h3 class="prog-sub" data-prog="also">/);
});

test("program pages: a draft schedule says so, only when the data says so; curated facts become sourced tiles", () => {
  assert.ok(fx("events").some((e) => e.program === "caw" && (e.tags || []).includes("draft-schedule")), "the fixture's Art Week schedule is a draft");
  assert.match(caw, /<span class="flag label">[\s\S]*?Still being announced<\/span><p>This schedule comes from a draft schedule page/);
  assert.doesNotMatch(blink, /Still being announced/);
  const d2 = copyRepo();
  try {
    editData("events", (a) => { for (const e of a) e.tags = (e.tags || []).filter((t) => t !== "draft-schedule"); })(d2);
    editData("facts", (a) => { a.push({ id: "blink-stat-artists-2026", program: "blink", label: "Artists (2026)", value: "92", as_of: null, source_url: "https://www.blinkcincinnati.com/newsroom/2026/06/08/blink-2026-participating-artists" }); })(d2);
    const r = build(d2);
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(read(d2, "docs/art-week.html"), /Still being announced/);
    const h2 = read(d2, "docs/index.html");
    assert.match(h2, /<div class="stat" data-prog="blink"><span class="n">92<\/span><span class="lp">[\s\S]*?BLINK<\/span><span class="l">Artists \(2026\)<\/span><p class="src">Source: <a href="https:\/\/www\.blinkcincinnati\.com\//, "a fact tile cites its source");
  } finally { cleanup(d2); }
});

test("news, FAQ and about pages", () => {
  for (const n of fx("news")) assert.match(news, new RegExp(`<article class="news-card" id="n-${n.id}"`));
  assert.match(news, /<div class="news-tools js-only" data-news-tools>/);
  assert.match(news, /data-news-p="blink"/);
  for (const f of fx("faqs")) assert.match(faq, new RegExp(`<details class="faq" id="${f.id}" data-p="${f.program || ""}" data-q="`));
  assert.match(faq, /<input type="search" name="q"[^>]*data-faq-q>/);
  assert.match(about, /id="corrections"/);
  assert.match(about, /© OpenStreetMap contributors/);
  assert.match(about, /Open Database License \(ODbL\)/);
  assert.match(about, /Last built [A-Z][a-z]+day, [A-Z][a-z]+ \d+, \d{4}/);
  assert.match(about, /not affiliated with any of the organizers/);
  assert.match(about, /<table class="data about-unk">/);
});
