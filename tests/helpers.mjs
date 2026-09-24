/* ============================================================
   tests/helpers.mjs · OWNER: Agent A (core engine) — shared by every *.test.mjs
   (not a test file itself: npm test runs tests/*.test.mjs only).
   Domain agents write their own tests/<domain>.test.mjs with these helpers instead of
   editing tests/build.test.mjs, so parallel work never touches the same file:

     import { copyRepo, build, read, json, editData, cleanup } from "./helpers.mjs";
     test("the schedule renders day tabs", () => {
       const dir = copyRepo();                       // throwaway copy + tests/fixtures/mini as data/
       try {
         editData("events", (a) => { a[0].featured = true; })(dir);   // mutate the copy, never the fixture
         const r = build(dir);
         assert.equal(r.status, 0, r.stderr);
         assert.match(read(dir, "docs/schedule.html"), /class="daytabs"/);
       } finally { cleanup(dir); }
     });
   ============================================================ */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const FIXTURE = path.join(REPO, "tests", "fixtures", "mini");
export const CONFIG = JSON.parse(fs.readFileSync(path.join(REPO, "site.config.json"), "utf8"));
/** a fixture file's records */
export const fx = (f) => JSON.parse(fs.readFileSync(path.join(FIXTURE, `${f}.json`), "utf8"));

/** A throwaway copy of the repo's build inputs, with `data` (default: the mini fixture) as data/. */
export function copyRepo({ data = FIXTURE } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cw-build-"));
  for (const f of ["build.mjs", "site.config.json", "package.json"]) fs.copyFileSync(path.join(REPO, f), path.join(dir, f));
  for (const d of ["build", "site"]) fs.cpSync(path.join(REPO, d), path.join(dir, d), { recursive: true });
  fs.cpSync(data, path.join(dir, "data"), { recursive: true });
  return dir;
}
/** node build.mjs in dir (deterministic date); env adds variables, e.g. { CW_OUT: ".cache/out" } */
export const build = (dir, env = {}) => spawnSync(process.execPath, ["build.mjs"], { cwd: dir, encoding: "utf8", env: { ...process.env, SOURCE_DATE_EPOCH: "1790000000", CW_OUT: "", ...env } });
export const read = (dir, f) => fs.readFileSync(path.join(dir, f), "utf8");
export const write = (dir, f, s) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), s); };
export const cleanup = (dir) => fs.rmSync(dir, { recursive: true, force: true });
export const json = (dir, f) => JSON.parse(read(dir, f));
/** mutate data/<file>.json in a copy: editData("events", (records) => { … })(dir) */
export const editData = (file, fn) => (dir) => { const v = json(dir, `data/${file}.json`); fn(v); write(dir, `data/${file}.json`, JSON.stringify(v, null, 2)); };
/** rewrite any file in a copy: edit("site/css/40-schedule.css", (s) => s + "…")(dir) */
export const edit = (file, fn) => (dir) => write(dir, file, fn(read(dir, file)));
/** add a page module that produces a detail page with the given body (for crawler tests) */
export const extraPage = (body, extra = "") => (dir) => write(dir, "build/pages/zz-extra.mjs",
  `export function pages() { return [{ path: "people/zz-extra.html", nav: "people", title: "Extra", description: "A test page.", body: (root) => ${JSON.stringify(body)}${extra ? `, ${extra}` : ""} }]; }\n`);
/** sha256 over every file (path + bytes) under dir */
export const hashTree = (dir) => {
  const h = crypto.createHash("sha256");
  const walk = (d) => { for (const f of fs.readdirSync(d).sort()) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else h.update(p.slice(dir.length)).update(fs.readFileSync(p)); } };
  walk(dir);
  return h.digest("hex");
};
