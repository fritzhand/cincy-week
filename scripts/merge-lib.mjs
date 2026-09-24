/* ============================================================
   scripts/merge-lib.mjs · OWNER: Agent C (data)
   Pure helpers for scripts/merge-research.mjs: text normalization, URL
   and cost rules, name / address keys and the OpenStreetMap → hood map.
   No I/O. Unit-tested in tests/data.test.mjs.
   ============================================================ */
import { aliasKey, slugify } from "../site/js/lib/text.js";

/* ---------- text ---------- */
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", eacute: "é", egrave: "è", aacute: "á", oacute: "ó", uacute: "ú", iacute: "í", ntilde: "ñ", uuml: "ü", ouml: "ö", auml: "ä", ccedil: "ç", reg: "®", copy: "©", trade: "™", bull: "•", middot: "·", deg: "°" };
/** Decode HTML entities (named, decimal, hex). Unknown names are left alone. */
export function decodeEntities(s) {
  return String(s).replace(/&(#\d{1,7}|#x[0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});/g, (m, e) => {
    if (e[0] === "#") { const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(cp) && cp > 0 ? String.fromCodePoint(cp) : m; }
    return ENT[e] ?? ENT[e.toLowerCase()] ?? m;
  });
}
/** Verbatim text, normalized only: CRLF, NBSP, zero-width characters, HTML entities, <br> → newline, other tags
 *  stripped (reported through onFix), runs of spaces, trailing spaces, 3+ newlines. Empty → null. */
export function txt(s, onFix = null) {
  if (s === undefined || s === null) return null;
  let t = String(s).replace(/\r\n?/g, "\n").replace(/ /g, " ").replace(/[​‌‍⁠﻿]/g, "");
  if (/&(#\d|#x|[a-zA-Z][a-zA-Z0-9]{1,31};)/.test(t)) t = decodeEntities(t);
  if (/<br\s*\/?>/i.test(t)) t = t.replace(/<br\s*\/?>/gi, "\n");
  if (/<\/?[a-zA-Z][^>]*>/.test(t)) { if (onFix) onFix("stripped HTML tags"); t = t.replace(/<\/?[a-zA-Z][^>]*>/g, ""); }
  t = t.split("\n").map((l) => l.replace(/[ \t]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return t || null;
}
/** An https URL or null: http, mailto, "#", relative and malformed values are dropped; spaces are encoded. */
export function https(u) {
  if (typeof u !== "string") return null;
  const v = u.trim().replace(/ /g, "%20");
  if (!/^https:\/\//i.test(v)) return null;
  try { return new URL(v).protocol === "https:" ? v : null; } catch { return null; }
}

/* ---------- small collection helpers ---------- */
export const nz = (v) => (v === undefined || v === "" ? null : v);
export const uniq = (a) => [...new Set(a.filter((x) => x !== null && x !== undefined && x !== ""))];
export const first = (...vals) => { for (const v of vals) if (v !== null && v !== undefined && v !== "") return v; return null; };
/** Stable sort by key functions (ties keep input order). */
export const sortBy = (arr, ...keys) => arr.map((v, i) => [v, i]).sort(([a, ia], [b, ib]) => {
  for (const k of keys) { const x = k(a), y = k(b); if (x < y) return -1; if (x > y) return 1; }
  return ia - ib;
}).map(([v]) => v);
export const idOk = (s) => /^[a-z0-9][a-z0-9-]*$/.test(s);
export const toId = (s, max = 80) => slugify(String(s || "")).slice(0, max).replace(/-+$/, "");

/* ---------- matching keys ---------- */
/** Loose name key: accents, case, "&", punctuation, parentheticals and a leading "the" do not matter. */
export const nameKey = (s) => aliasKey(String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\([^)]*\)/g, " ")).replace(/^the /, "");
export const tightKey = (s) => nameKey(s).replace(/ /g, "");
/** Org spellings that name the same organization (checked by hand). */
export const ORG_ALIAS = { pandg: "procterandgamble", fifththirdbank: "fifththird", "3cdccincinnaticentercitydevelopmentcorp": "3cdc" };
export const orgKey = (name) => { const k = tightKey(String(name).replace(/\b(inc|llc|co)\.?$/i, "")); return ORG_ALIAS[k] || k; };
const ORD = { first: "1st", second: "2nd", third: "3rd", fourth: "4th", fifth: "5th", sixth: "6th", seventh: "7th", eighth: "8th", ninth: "9th", tenth: "10th" };
const ABBR = { street: "st", avenue: "ave", east: "e", west: "w", north: "n", south: "s", boulevard: "blvd", drive: "dr", road: "rd", place: "pl" };
/** Street-address key ("210 East Sixth Street, …" = "210 E 6th St."); null when the address has no house number. */
export function addrKey(a) {
  if (!a) return null;
  const s = aliasKey(String(a).split(",")[0]).split(" ").map((w) => ORD[w] || ABBR[w] || w).join(" ");
  return /^\d/.test(s) ? s : null;
}
/** The leading word of a name ("The Symphony Hotel" → "symphony"); an address matches only with the same one. */
export const brandTok = (name) => nameKey(name).split(" ")[0] || "";

/* ---------- money ---------- */
/** true only when the published cost starts with "Free" (not "Free to/for (Biennial) Pass Holders", "Free with …",
 *  "Free add-on"); false only when it names a price and never the word free; otherwise null. */
export function isFree(cost) {
  const c = String(cost || "").trim();
  if (!c) return null;
  if (/^(free\b(?!\s+(to|for)\s+(biennial\s+)?pass)(?!\s+with)(?!\s+add-on)|free to the public|free admission|this is a free event|entry is free)/i.test(c)) return true;
  if (/\$\s?\d/.test(c) && !/free/i.test(c) && !/\$0\.00/.test(c)) return false;
  return null;
}

/* ---------- OpenStreetMap → hoods ---------- */
/** OpenStreetMap suburb / city names → the nine canonical hood ids (places.json neighborhoods). */
export const OSM_HOOD = { "over-the-rhine": "over-the-rhine", "central business district": "downtown-cbd", pendleton: "pendleton", "west end": "west-end", "mainstrasse village": "mainstrasse-village" };
export const OSM_CITY_HOOD = { covington: "covington", newport: "newport" };
/** A Nominatim address → { hood, suburb }: a canonical hood, else the Cincinnati suburb name (for an extra
 *  OpenStreetMap-sourced neighborhood), else nothing. */
export function hoodFromOsm(addr) {
  if (!addr) return { hood: null, suburb: null };
  const sub = addr.suburb || addr.neighbourhood || addr.quarter || null;
  if (sub && OSM_HOOD[sub.toLowerCase()]) return { hood: OSM_HOOD[sub.toLowerCase()], suburb: sub };
  const city = (addr.city || addr.town || addr.village || "").toLowerCase();
  if (OSM_CITY_HOOD[city]) return { hood: OSM_CITY_HOOD[city], suburb: sub };
  return { hood: null, suburb: city === "cincinnati" ? addr.suburb || null : null };
}

/* ---------- dates ---------- */
export const inRange = (a, b, win) => !(b < win.start || a > win.end);
/** Every ISO date from a to b inclusive. */
export function daySpan(a, b) {
  const out = [];
  for (let d = a; d <= b;) { out.push(d); const t = new Date(`${d}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + 1); d = t.toISOString().slice(0, 10); }
  return out;
}

/** Research-authored text (place summaries, program history) sometimes points at research files ("see stays.json",
 *  "the blink-info slice"). Those pointers mean nothing to readers: drop the parenthetical, clause or sentence. */
export function scrubInternal(t) {
  if (!t) return t;
  let s = t.replace(/\s*\([^()]*(?:\.json|\bslice\b)[^()]*\)/gi, "");
  s = s.replace(/;\s*see the [^.;]*\bslice\b[^.;]*(?=[.;])/gi, "");
  s = s.split("\n\n").map((para) => para.split(/(?<=[.!?])\s+/).filter((sent) => !/\.json\b|\bslice\b/i.test(sent)).join(" ")).filter(Boolean).join("\n\n");
  return s.trim() || null;
}
