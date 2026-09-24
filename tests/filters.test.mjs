/* tests/filters.test.mjs · OWNER: Agent A · site/js/lib/filters.js */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, serialize, matches, defaults, activeCount } from "../site/js/lib/filters.js";

const SCHEMA = {
  day: { type: "one", values: (v) => v === "all" || /^\d{4}-\d\d-\d\d$/.test(v), default: "2026-10-08" },
  p: { type: "list", values: ["caw", "scw", "blink", "fotofocus", "also"] },
  k: { type: "list", values: ["talks", "hands-on", "social", "art", "pitch"], field: "kg" },
  free: { type: "bool" },
  q: { type: "text" },
  view: { type: "one", values: ["list", "map"], default: "list" },
};

test("parse/serialize round-trip", () => {
  const s = parse("?p=scw,blink&k=talks&free=1&q=union%20hall&day=2026-10-06", SCHEMA);
  assert.deepEqual(s, { day: "2026-10-06", p: ["blink", "scw"], k: ["talks"], free: true, q: "union hall", view: "list" });
  const url = serialize(s, SCHEMA);
  assert.equal(url, "?day=2026-10-06&p=blink,scw&k=talks&free=1&q=union%20hall");
  assert.deepEqual(parse(url, SCHEMA), s);
});

test("defaults are omitted", () => {
  assert.equal(serialize(defaults(SCHEMA), SCHEMA), "");
  assert.equal(serialize({ ...defaults(SCHEMA), view: "list", day: "2026-10-08" }, SCHEMA), "");
  assert.equal(serialize({ ...defaults(SCHEMA), view: "map" }, SCHEMA), "?view=map");
});

test("invalid values and unknown keys are dropped", () => {
  const s = parse("?p=scw,nope&view=grid&day=tomorrow&zzz=1&free=maybe", SCHEMA);
  assert.deepEqual(s.p, ["scw"]);
  assert.equal(s.view, "list");
  assert.equal(s.day, "2026-10-08");
  assert.equal(s.free, false);
  assert.ok(!("zzz" in s));
});

test("stable ordering: the same state gives the same URL", () => {
  const a = serialize({ ...defaults(SCHEMA), p: ["scw", "caw", "blink"] }, SCHEMA);
  const b = serialize({ ...defaults(SCHEMA), p: ["blink", "scw", "caw", "scw"] }, SCHEMA);
  assert.equal(a, b);
  assert.equal(a, "?p=blink,caw,scw");
});

test("matches: lists intersect, bools require, text needs every term", () => {
  const item = { p: "scw", kg: "talks", free: false, q: "cintrifuse annual meeting union hall jake rouse" };
  const st = (o) => ({ ...defaults(SCHEMA), ...o });
  assert.ok(matches(item, st({}), SCHEMA));
  assert.ok(matches(item, st({ p: ["scw", "caw"] }), SCHEMA));
  assert.ok(!matches(item, st({ p: ["blink"] }), SCHEMA));
  assert.ok(matches(item, st({ k: ["talks"] }), SCHEMA));
  assert.ok(!matches(item, st({ free: true }), SCHEMA));
  assert.ok(matches(item, st({ q: "Union Háll" }), SCHEMA));
  assert.ok(!matches(item, st({ q: "union blink" }), SCHEMA));
  assert.equal(activeCount(st({ p: ["scw", "caw"], free: true }), SCHEMA), 3);
});
