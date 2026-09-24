/* tests/share.test.mjs · OWNER: Agent A · site/js/lib/share.js + site/js/lib/text.js */
import { test } from "node:test";
import assert from "node:assert/strict";
import { code, encode, decode, planHash, codeTable, CODE_RE } from "../site/js/lib/share.js";
import { initials, truncate, paras, hostOf, aliasKey } from "../site/js/lib/text.js";

test("codes are stable, 5 base36 characters", () => {
  const c = code("scw-sucw-2026-kickoff");
  assert.match(c, CODE_RE);
  assert.equal(code("scw-sucw-2026-kickoff"), c);
  assert.notEqual(code("scw-sucw-2026-kickoff"), code("scw-sucw-2026-kickoff-2"));
  assert.equal(code("blink-2026-10-08-nightly"), code("blink-2026-10-08-nightly"));
});

test("encode/decode round-trip; unknown codes are ignored", () => {
  const ids = ["scw-a", "caw-b", "blink-c"];
  const { map, collisions } = codeTable([...ids, "blink-work-1"]);
  assert.deepEqual(collisions, []);
  const hash = "#" + planHash({ e: ids, w: ["blink-work-1"] });
  assert.match(hash, /^#p=[0-9a-z]{5}(,[0-9a-z]{5}){2};w=[0-9a-z]{5}$/);
  const out = decode(hash + ",zzzzz,BAD!", map);
  assert.deepEqual(out.e.sort(), [...ids].sort());
  assert.deepEqual(out.w, ["blink-work-1"]);
  assert.equal(out.unknown, 2);
  assert.equal(encode(["a", "b"]), encode(["b", "a", "a"]));
});

test("text helpers", () => {
  assert.equal(initials("Jeremy Fritzhand"), "JF");
  assert.equal(initials("Ludwig van Beethoven"), "LB");
  assert.equal(initials("Madonna"), "M");
  assert.equal(initials("Ólafur Arnalds"), "ÓA");
  assert.equal(truncate("A long sentence that goes on", 12), "A long…");
  assert.equal(truncate("Short", 12), "Short");
  assert.deepEqual(paras("One.\n\nTwo\nlines.\n\n\n"), ["One.", "Two lines."]);
  assert.equal(hostOf("https://www.blinkcincinnati.com/faqs"), "blinkcincinnati.com");
  assert.equal(aliasKey("Over-the-Rhine & Pendleton!"), "over the rhine and pendleton");
});
