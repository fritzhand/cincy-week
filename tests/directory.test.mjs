/* tests/directory.test.mjs · OWNER: Agent F · the directory: people, art, partners, images, the filter logic
   Unit tests for site/js/lib/directory.js and build/core/images.mjs, build tests on the mini fixture
   (tests/fixtures/mini), and the SVG sanitizer of scripts/fetch-images.py (skipped without python3 + Pillow). */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { copyRepo, build, read, json, editData, cleanup, fx, REPO } from "./helpers.mjs";
import { splitVals, matchItem, facetCounts, parseState, writeState } from "../site/js/lib/directory.js";
import { makeImages } from "../build/core/images.mjs";

/* ---------- lib/directory.js ---------- */
const item = (hay, vals) => ({ hay, vals: Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, new Set(v)])) });
const ITEMS = [
  item("jane doe acme", { r: ["speaker"], p: ["scw"], l: ["J"] }),
  item("john roe studio", { r: ["artist", "speaker"], p: ["blink", "caw"], l: ["J"] }),
  item("ana lee", { r: ["curator"], p: ["fotofocus"], l: ["A"] }),
];

test("splitVals: spaces by default, a separator for values that hold spaces", () => {
  assert.deepEqual([...splitVals("speaker  artist")], ["speaker", "artist"]);
  assert.deepEqual([...splitVals("light installation|mural", "|")], ["light installation", "mural"]);
  assert.equal(splitVals("").size, 0);
  assert.equal(splitVals(null).size, 0);
});

test("matchItem: search terms AND, values in a group OR, groups AND, skipKey leaves one group out", () => {
  const spec = (terms, sel) => ({ terms, sel: Object.fromEntries(Object.entries(sel).map(([k, v]) => [k, new Set(v)])), keys: ["r", "p", "l"] });
  assert.ok(matchItem(ITEMS[0], spec(["jane", "acme"], {})));
  assert.ok(!matchItem(ITEMS[0], spec(["jane", "studio"], {})));
  assert.ok(matchItem(ITEMS[1], spec([], { r: ["curator", "artist"] })));
  assert.ok(!matchItem(ITEMS[1], spec([], { r: ["artist"], p: ["scw"] })));
  assert.ok(matchItem(ITEMS[1], spec([], { r: ["artist"], p: ["scw"] }), "p"));
  assert.ok(matchItem(ITEMS[2], spec([], { r: new Set() })), "an empty selection is no filter");
});

test("facetCounts: each group is counted under every other active filter", () => {
  const spec = { terms: [], sel: { p: new Set(["scw"]) }, keys: ["r", "p", "l"] };
  const c = facetCounts(ITEMS, spec);
  assert.equal(c.r.get("speaker"), 1);           // only Jane is in scw
  assert.equal(c.r.get("artist"), undefined);
  assert.equal(c.p.get("blink"), 1);             // the p group itself ignores p
  assert.equal(c.p.get("fotofocus"), 1);
  assert.equal(c.l.get("J"), 1);
});

test("parseState / writeState: URL values are validated, single keys keep one, output is sorted and minimal", () => {
  const allowed = { r: new Set(["speaker", "artist"]), p: new Set(["scw", "blink"]), l: new Set(["A", "J"]) };
  const s = parseState("?q=%20acme%20&r=artist,nope,speaker&p=zzz&l=J,A", { keys: ["r", "p", "l"], allowed, single: new Set(["l"]) });
  assert.equal(s.q, " acme ");
  assert.deepEqual([...s.sel.r], ["artist", "speaker"]);
  assert.equal(s.sel.p, undefined, "a value that names nothing is dropped");
  assert.deepEqual([...s.sel.l], ["J"]);
  const params = new URLSearchParams("w=blink-x&r=old");
  writeState(params, { q: " acme ", sel: { r: new Set(["speaker", "artist"]), p: new Set() } }, ["r", "p", "l"]);
  assert.equal(params.toString(), "w=blink-x&r=artist%2Cspeaker&q=acme");
  writeState(params, { q: "", sel: {} }, ["r", "p", "l"]);
  assert.equal(params.toString(), "w=blink-x", "other keys (the dialog's ?w=) are left alone");
});

/* ---------- build/core/images.mjs ---------- */
test("images: srcset and sizes for people and works, fallbacks, logo tone, credits", () => {
  const db = {
    programs: [{ id: "blink", url: "https://www.blinkcincinnati.com/", short_name: "BLINK", name: "BLINK" }],
    images: {
      "p/jane": { file: "img/p/jane.webp", w: 320, h: 320, sm: { file: "img/p/jane-96.webp", w: 96, h: 96 }, source_url: "https://www.blinkcincinnati.com/artists/jane" },
      "w/blink-a": { file: "img/w/blink-a-480.webp", w: 480, h: 360, lg: { file: "img/w/blink-a-960.webp", w: 960, h: 720 }, source_url: "https://cdn.example.org/x" },
      "o/acme": { file: "img/o/acme.svg", w: 320, h: 90, tone: "dark" },
    },
  };
  const I = makeImages(db);
  const mug = I.mug("../", { id: "jane", name: "Jane Doe", programs: ["blink"] }, { size: "s" });
  assert.match(mug, /^<span class="avatar s" data-prog="blink"><img src="\.\.\/assets\/img\/p\/jane\.webp" srcset="\.\.\/assets\/img\/p\/jane-96\.webp 96w, \.\.\/assets\/img\/p\/jane\.webp 320w" sizes="28px" alt="" width="320" height="320" loading="lazy" decoding="async"><\/span>$/);
  const mono = I.mug("", { id: "nobody", name: "Ana María Lee", programs: [] }, { alt: "Portrait of Ana" });
  assert.match(mono, /class="avatar mono halftone" data-prog="also" role="img" aria-label="Portrait of Ana"><span aria-hidden="true">AL<\/span>/);
  const big = I.img("", "w", "blink-a", { big: true, sizes: "100vw" });
  assert.match(big, /src="assets\/img\/w\/blink-a-960\.webp"/);
  assert.match(big, /srcset="assets\/img\/w\/blink-a-480\.webp 480w, assets\/img\/w\/blink-a-960\.webp 960w" sizes="100vw"/);
  assert.match(big, /width="960" height="720"/);
  assert.match(I.photo("", { id: "blink-none" }), /photo-missing/);
  assert.equal(I.logo("", { id: "nologo", name: "Book & Street" }), '<span class="plate-text">Book &amp; Street</span>');
  assert.match(I.logo("", { id: "acme", name: "Acme" }), /alt="Acme logo" width="320" height="90"/);
  assert.equal(I.credit("p", "jane"), "BLINK", "a program's own site is credited by the program's name");
  assert.equal(I.credit("w", "blink-a"), "cdn.example.org");
  assert.equal(I.path("p", "nobody"), null);
});

/* ---------- build output on the mini fixture ---------- */
let dir, people, art, partners;
test("setup: the fixture builds with the directory pages", () => {
  dir = copyRepo();
  const r = build(dir);
  assert.equal(r.status, 0, r.stderr);
  people = read(dir, "docs/people.html");
  art = read(dir, "docs/art.html");
  partners = read(dir, "docs/partners.html");
});

test("people.html: every person is a server-rendered row with its filter data; filters are JS-only; A–Z jumps", () => {
  const rows = [...people.matchAll(/<a class="person" href="people\/([^"]+)\.html"([^>]*)>/g)];
  assert.equal(rows.length, fx("people").length);
  for (const [, id, attrs] of rows) {
    assert.match(attrs, /data-prog="(caw|scw|blink|fotofocus|also)"/, id);
    assert.match(attrs, /data-r="[a-z ]+"/, id);
    assert.match(attrs, /data-p="[a-z ]+"/, id);
    assert.match(attrs, /data-l="[A-Z#]"/, id);
    assert.match(attrs, /data-q="[^"]+"/, id);
  }
  // rows are sorted by name; the first row under each letter carries the A–Z anchor
  const names = [...people.matchAll(/<span class="per-name">([^<]+)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })));
  const jumps = [...people.matchAll(/<a href="#(l-[a-z]+)" data-value="([A-Z])">/g)];
  assert.ok(jumps.length >= 5, `${jumps.length} letters`);
  for (const [, href, L] of jumps) assert.match(people, new RegExp(`id="${href}"[^>]*data-l="${L}"`), L);
  assert.match(people, /<a aria-disabled="true" data-value="Q">Q<\/a>/, "a letter with no one is disabled");
  assert.match(people, /<div class="dir-tools js-only" data-dir-tools>/);
  assert.match(people, /data-filter-group="r"/);
  assert.match(people, /data-filter-group="p"/);
  assert.match(people, /<p class="result-count" role="status" aria-live="polite" data-result-count data-noun="people">Showing <b>12<\/b> of 12 people<\/p>/);
  assert.match(people, /<div class="empty-state" data-dir-empty hidden>/);
  assert.match(people, /data-features="[^"]*directory/);
});

test("people/<id>.html: portrait or monogram, one h1, bio or an honest unknown, events, works, JSON-LD", () => {
  for (const p of fx("people")) {
    const html = read(dir, `docs/people/${p.id}.html`);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, p.id);
    assert.match(html, /"@type":"Person"/, p.id);
    assert.ok(html.includes(`<h1>${p.name.replace(/&/g, "&amp;")}</h1>`), p.id);
    if (p.bio) assert.match(html, /<div class="prose dp-bio">/, p.id); else assert.match(html, /Bio not published by the organizers/, p.id);
  }
  const kara = read(dir, "docs/people/kara-willis.html");
  assert.match(kara, /<div class="photo"><img src="\.\.\/assets\/img\/p\/kara-willis\.webp"[^>]* alt="Portrait of Kara Willis"/);
  assert.match(kara, /<p class="credit label">Photo via StartupCincy<\/p>/);
  const events = fx("events").filter((e) => (e.people || []).includes("kara-willis"));
  for (const e of events) assert.match(kara, new RegExp(`<article class="ev"[^>]* data-ev="${e.id}"`));
  // no downloaded headshot (the manifest has none): the halftone monogram, never a broken image
  const mz = read(dir, "docs/people/the-mz-icar-collective.html");
  assert.match(mz, /<div class="photo halftone"><span class="mono" aria-hidden="true">[A-Z]{1,2}<\/span><\/div><p class="credit label">No photo published<\/p>/);
  // a work is carried in full on its artist's page, with the image, facts, its source and its dialog link
  assert.match(mz, /<article class="wk-full" id="w-blink-in-light-of-us" data-prog="blink">/);
  assert.match(mz, /href="\.\.\/art\.html\?w=blink-in-light-of-us" data-open-work="blink-in-light-of-us"/);
  assert.match(mz, /href="\.\.\/map\.html\?focus=work:blink-in-light-of-us"/);
});

test("art.html: a card per work with the dialog deep link and star; filters; the map view waits for Agent E", () => {
  for (const w of fx("works")) {
    const card = art.match(new RegExp(`<article class="work"[^>]* id="w-${w.id}"[^>]*>[\\s\\S]*?</article>`));
    assert.ok(card, w.id);
    assert.match(card[0], new RegExp(`data-m="${w.medium}"`));
    assert.match(card[0], new RegExp(`<a href="art\\.html\\?w=${w.id}" data-open-work="${w.id}">`));
    assert.match(card[0], new RegExp(`<button class="star floating" type="button" data-star="${w.id}" data-star-kind="w"`));
  }
  assert.match(art, /data-filter-group="m" data-sep="\|"/);
  assert.match(art, /data-filter-group="z"/);
  assert.match(art, /data-filter-group="h"[^>]* hidden/);
  const stub = /STUB landed by Agent A/.test(fs.readFileSync(path.join(REPO, "site/js/features/map.js"), "utf8"));
  assert.equal(/data-dir-views/.test(art), !stub, "the Grid/Map toggle shows only once features/map.js is real");
  const extra = json(dir, "docs/assets/data/art-extra.json");
  assert.equal(extra.v, 1);
  for (const w of fx("works")) assert.ok(w.id in extra.works, w.id);
  const img = extra.works["blink-future-cities-no-1-2-and-3"].im;
  assert.ok(img && img[0][0].startsWith("assets/img/w/"), "image path");
  assert.ok(fs.existsSync(path.join(dir, "docs", img[0][0])), "the image file is published");
});

test("partners.html: walls by program then tier, each org anchored once, logos on their plates, new-tab links", () => {
  for (const o of fx("orgs")) assert.equal((partners.match(new RegExp(`id="o-${o.id}"`, "g")) || []).length, 1, o.id);
  const scw = partners.slice(partners.indexOf('id="wall-scw"'), partners.indexOf("</section>", partners.indexOf('id="wall-scw"')));
  assert.ok(scw.indexOf("Title Sponsor") < scw.indexOf("Organizers"), "the program's own tier order");
  assert.match(partners, /<a class="plate" href="https:\/\/cintrifuse\.com\/" id="o-cintrifuse"[^>]*target="_blank" rel="noopener"><img [^>]*alt="Cintrifuse logo"[^>]*>[\s\S]*?\(opens in a new tab\)<\/span><\/a>/);
  assert.match(partners, /id="o-fotofocus"[^>]*>(<span class="plate-text">FotoFocus<\/span>|<img)/);
  assert.match(partners, /data-filter-group="tier"[^>]* hidden/);
});

test("a dark-toned logo sits on the black plate", () => {
  const d = copyRepo();
  try {
    editData("images", (m) => { m["o/artswave"].tone = "dark"; })(d);
    const r = build(d);
    assert.equal(r.status, 0, r.stderr);
    assert.match(read(d, "docs/partners.html"), /id="o-artswave" data-tone="dark"/);
  } finally { cleanup(d); }
});

test("search entries: people carry their small mug, orgs their logo, works the dialog deep link", () => {
  const items = json(dir, "docs/assets/data/search.json").items;
  const kara = items.find((x) => x.k === "pe" && x.id === "kara-willis");
  assert.equal(kara.u, "people/kara-willis.html");
  assert.match(kara.i || "", /^assets\/img\/p\/kara-willis(-96)?\.webp$/);
  assert.equal(items.find((x) => x.k === "wo" && x.id === "blink-in-light-of-us").u, "art.html?w=blink-in-light-of-us");
  assert.equal(items.find((x) => x.k === "or" && x.id === "cintrifuse").u, "partners.html#o-cintrifuse");
});

test("cleanup", () => cleanup(dir));

/* ---------- scripts/fetch-images.py: the SVG sanitizer and tone detection ---------- */
const py = spawnSync("python3", ["-c", "import PIL"], { encoding: "utf8" });
test("fetch-images.py sanitizes SVG logos and detects light-on-dark tone", { skip: py.status !== 0 ? "python3 with Pillow is not installed" : false }, () => {
  const code = `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("fi", sys.argv[1]); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
bad = b'''<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x "y">]><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 200 100" onload="alert(1)"><script>alert(2)</script><style>@import url(https://evil.example/x.css); .a{fill:#fff}</style><a href="javascript:alert(3)"><rect width="10" height="10"/></a><image xlink:href="https://evil.example/t.png" width="5" height="5"/><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject><path class="a" d="M0 0h10v10z" fill="#ffffff" onclick="x()"/><use href="#p"/></svg>'''
out, w, h, tone = m.sanitize_svg(bad)
print(json.dumps({"svg": out.decode(), "w": w, "h": h, "tone": tone}))
dark = m.sanitize_svg(b'<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><path d="M0 0h1z"/></svg>')
print(json.dumps({"tone": dark[3], "w": dark[1], "h": dark[2]}))
`;
  const r = spawnSync("python3", ["-c", code, path.join(REPO, "scripts/fetch-images.py")], { encoding: "utf8", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
  assert.equal(r.status, 0, r.stderr);
  const [a, b] = r.stdout.trim().split("\n").map((l) => JSON.parse(l));
  for (const bad of [/<script/i, /onload/i, /onclick/i, /javascript:/i, /evil\.example/, /foreignObject/, /<!DOCTYPE/i, /@import/]) assert.doesNotMatch(a.svg, bad);
  assert.match(a.svg, /viewBox="0 0 200 100"/);
  assert.match(a.svg, /href="#p"/, "internal references stay");
  assert.deepEqual([a.w, a.h], [320, 160]);
  assert.equal(a.tone, "dark", "white ink is a light-on-dark logo");
  assert.equal(b.tone, "light", "an unfilled path paints black");
  assert.deepEqual([b.w, b.h], [320, 160]);
});
