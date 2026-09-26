/* ============================================================
   site/js/features/schedule.js · OWNER: Agent D (schedule & plan)
   "The Week" on top of the server-rendered list (build/pages/schedule.mjs). JS never builds
   cards: it hides and shows them, moves ended slots into a fold, and keeps the URL in sync.

   URL (engine spec §4.6; only non-default values are written, with replaceState):
     day   ISO date | all       default: today during the week, else the first week day
     p k t h (lists) · v · free=1 · q · star=1 · view=list|map · when=now|next|tonight
     past  0 = hide ended (fold them), 1 = show ended inline; default: hide on today only
     e     left to the event dialog (core/event-dialog.js); on load it also picks the event's day
   Counts: day tabs and chips count sessions at set times (not the all-day band) under the other
   filters; the live region says "42 events on Thu, Oct 8, plus 92 all day and all night".
   ============================================================ */
import { parse, serialize } from "../lib/filters.js";
import { norm, terms } from "../lib/search.js";
import { festivalToday, defaultDay, inWhen, conflicts, conflictText, F } from "../lib/agenda.js";
import { status as statusOf, relTime, fmtTime, fmtDay, nyParts } from "../lib/time.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const ICON = (n, cls = "") => `<svg class="i${cls ? " " + cls : ""}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;

export function init(app) {
  const root = $("[data-sched]");
  if (!root) return;
  const meta = JSON.parse($("[data-sched-meta]", root).textContent);
  const list = $("#sched-list", root);
  const tablist = $("[data-daytabs]", root);
  const tabs = $$(".daytab", tablist);
  const days = tabs.map((t) => t.dataset.day).filter((d) => d !== "all");
  const sheet = document.getElementById("sched-filters");
  const countEl = $("[data-result-count]", root);
  const band = $("[data-ongoing]", root);
  const bandTop = band && $("[data-ongoing-top]", band);
  const bandMore = band && $("[data-ongoing-more]", band);
  const bandMoreList = bandMore && $(".ongoing-list", bandMore);
  const emptyEl = $("[data-sched-empty]", root);
  const mapEl = $("[data-sched-map]", root);
  const TOP = matchMedia("(max-width: 699px)").matches ? 3 : Number(root.dataset.top) || 5; // phones: a shorter band before the timeline

  /* ---------- index the server-rendered cards once ---------- */
  const cards = $$("article.ev", list).map((el) => {
    const d = el.dataset;
    const ongoing = !!el.closest("[data-ongoing]");
    const f = (d.endUnknown ? F.END_UNKNOWN : 0) | (d.timeUnknown ? F.TIME_UNKNOWN : 0) | (ongoing ? F.ONGOING : 0);
    const inst = d.inst ? d.inst.split(",").map((x) => x.split(":").map(Number)) : [[Number(d.s), Number(d.e)]];
    return {
      el, id: d.ev, p: d.p, kg: d.kg, k: d.k, day: d.day, days: d.days ? d.days.split(" ").filter(Boolean) : [d.day],
      s: Number(d.s), e: Number(d.e), inst, f, t: d.t, h: d.h || "", v: d.v || "", free: d.free === "1",
      q: norm([...$$(".ev-meta, .ev-title, .ev-where, .ev-people, .ev-tags", el).map((x) => x.textContent), d.q || ""].join(" ")),
      ongoing, live: !d.cancelled, slot: ongoing ? null : el.closest(".slot"), title: ($(".ev-title a", el) || el).textContent.trim(),
    };
  });
  const byId = new Map(cards.map((c) => [c.id, c]));
  const timed = cards.filter((c) => !c.ongoing);
  const ongoingCards = cards.filter((c) => c.ongoing);
  const sections = new Map($$(".sched-day", list).map((s) => [s.dataset.day, s]));
  const slotsBy = new Map([...sections].map(([d, s]) => [d, $$(".slot", s)]));
  for (const s of $$(".slot", list)) s._cards = timed.filter((c) => c.slot === s);

  /* ---------- state ⇄ URL ---------- */
  const progs = $$("[data-sf='p']", root).flatMap((x) => x.dataset.v.split(","));
  const kindVals = [...Object.keys(meta.groups), ...Object.keys(meta.kinds)];
  const venueVals = sheet ? $$("[data-sf-v] option", sheet).map((o) => o.value).filter(Boolean) : [];
  const now0 = app.now();
  const today0 = festivalToday(now0);
  const schema = {
    day: { type: "one", values: (v) => v === "all" || days.includes(v), default: defaultDay(now0, days, meta.week.start) },
    p: { type: "list", values: progs },
    k: { type: "list", values: kindVals },
    t: { type: "list", values: Object.keys(meta.buckets) },
    h: { type: "list", values: Object.keys(meta.hoods) },
    v: { type: "one", values: venueVals },
    free: { type: "bool" },
    q: { type: "text", max: 80 },
    past: { type: "one", values: ["0", "1"] },
    star: { type: "bool" },
    view: { type: "one", values: ["list", "map"], default: "list" },
    when: { type: "one", values: ["now", "next", "tonight"] },
  };
  const S = parse(location.search, schema);
  const hashDay = /^#d-(\d{4}-\d\d-\d\d)$/.exec(location.hash);
  if (hashDay && days.includes(hashDay[1]) && !new URLSearchParams(location.search).has("day")) S.day = hashDay[1];
  const prefs = app.store.get("cw-prefs", {}) || {};
  if (!new URLSearchParams(location.search).has("view") && prefs.scheduleView === "map") S.view = "map";
  if (S.when && days.includes(today0)) S.day = today0; // presets are about today
  const deep = new URLSearchParams(location.search).get("e");
  if (deep && byId.has(deep)) {
    const c = byId.get(deep);
    if (S.day !== "all" && !(c.ongoing ? c.days.includes(S.day) : c.day === S.day)) S.day = c.ongoing ? (c.days.includes(today0) ? today0 : c.days[0] || "all") : c.day;
  }
  const writeUrl = () => {
    const u = new URL(location.href);
    const e = u.searchParams.get("e");
    let qs = serialize(S, schema);
    if (e) qs += `${qs ? "&" : "?"}e=${encodeURIComponent(e)}`;
    for (const k of ["now", "theme"]) if (u.searchParams.has(k)) qs += `${qs ? "&" : "?"}${k}=${encodeURIComponent(u.searchParams.get(k))}`; // QA params stay
    history.replaceState(history.state, "", u.pathname + qs + (/^#d-/.test(u.hash) ? "" : u.hash));
  };
  // "Hide ended": ended slots fold into "Earlier today". Default: on for today's single-day view only.
  const hidePastDefault = (day, today) => day === today;
  const hidePast = (today) => (S.past === "0" ? true : S.past === "1" ? false : hidePastDefault(S.day, today));
  const foldDay = (d, today) => S.past === "0" || (S.past !== "1" && S.day === d && d === today);

  /* ---------- matching ---------- */
  let qTerms = terms(S.q);
  const runsOn = (c, d) => (c.ongoing ? c.days.includes(d) : c.day === d);
  const instOn = (c, d) => { // an ongoing card's hours on festival day d
    if (!c.ongoing || c.f & F.TIME_UNKNOWN) return null;
    if (!c.byDay) c.byDay = new Map(c.inst.map((x) => [festivalToday(x[0]), x]));
    return c.byDay.get(d) || null;
  };
  function tests(now, today) {
    const plan = new Set(app.plan.list().e);
    return {
      day: (c) => S.day === "all" || runsOn(c, S.day),
      p: (c) => !S.p.length || S.p.includes(c.p),
      k: (c) => !S.k.length || S.k.includes(c.kg) || S.k.includes(c.k),
      t: (c) => !S.t.length || S.t.includes(c.t) || (c.ongoing && c.t === "allday"),
      h: (c) => !S.h.length || S.h.includes(c.h),
      v: (c) => !S.v || c.v === S.v,
      free: (c) => !S.free || c.free,
      star: (c) => !S.star || plan.has(c.id),
      q: (c) => !qTerms.length || qTerms.every((t) => c.q.includes(t)),
      when: (c) => {
        if (!S.when) return true;
        if (!c.ongoing) return inWhen({ s: c.s, e: c.e, f: c.f, day: c.day }, S.when, now);
        const x = instOn(c, today);
        return !!x && inWhen({ s: x[0], e: x[1], f: c.f & ~F.ONGOING, day: today }, S.when, now);
      },
    };
  }
  const KEYS = ["day", "p", "k", "t", "h", "v", "free", "star", "q", "when"];
  const matchAll = (T, c, except = null) => KEYS.every((k) => k === except || T[k](c));

  /* ---------- tabs: roving tabindex, arrows, Home/End; the list is their tabpanel ---------- */
  tablist.setAttribute("role", "tablist");
  tablist.setAttribute("aria-label", "Days of the week");
  list.setAttribute("role", "tabpanel");
  for (const t of tabs) { t.setAttribute("role", "tab"); t.setAttribute("aria-controls", "sched-list"); }
  const isWeek = app.phase() === "during";
  const todayTab = tabs.find((t) => t.dataset.day === today0);
  if (todayTab && isWeek) todayTab.classList.add("is-today");
  function selectDay(d, { focus = false, user = false } = {}) {
    S.day = d;
    if (S.when && d !== festivalToday(app.now())) S.when = null;
    apply({ user });
    const t = tabs.find((x) => x.dataset.day === d);
    if (focus && t) t.focus();
    if (user) {
      const top = $(".sched-status", root).getBoundingClientRect().top;
      if (top < 0) (band && !band.hidden ? band : list).scrollIntoView({ block: "start" });
    }
  }
  tablist.addEventListener("click", (e) => {
    const t = e.target.closest(".daytab");
    if (!t || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    selectDay(t.dataset.day, { user: true });
  });
  tablist.addEventListener("keydown", (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); selectDay(tabs[i].dataset.day, { user: true }); return; }
    const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (j === undefined) return;
    e.preventDefault();
    selectDay(tabs[(j + tabs.length) % tabs.length].dataset.day, { focus: true, user: true });
  });

  /* ---------- chips, sheet, switches, search ---------- */
  const set = (key, v) => {
    if (Array.isArray(S[key])) { const vs = v.split(","); const on = vs.every((x) => S[key].includes(x)); S[key] = on ? S[key].filter((x) => !vs.includes(x)) : [...new Set([...S[key], ...vs])].sort(); }
    else if (key === "when") { S.when = S.when === v ? null : v; if (S.when) { const td = festivalToday(app.now()); if (days.includes(td)) S.day = td; } }
    else S[key] = v;
  };
  document.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-sf]");
    if (chip && (root.contains(chip) || (sheet && sheet.contains(chip)))) { set(chip.dataset.sf, chip.dataset.v); apply({ user: true }); return; }
    const sw = e.target.closest("[data-sf-switch]");
    if (sw && sheet && sheet.contains(sw)) {
      const k = sw.dataset.sfSwitch;
      if (k === "past") { const td = festivalToday(app.now()); const want = !hidePast(td); S.past = want === hidePastDefault(S.day, td) ? null : want ? "0" : "1"; }
      else S[k] = !S[k];
      apply({ user: true });
      return;
    }
    if (e.target.closest("[data-sched-clear]")) { clearAll(); return; }
    const rm = e.target.closest("[data-rm]");
    if (rm && root.contains(rm)) {
      const [k, v] = rm.dataset.rm.split(":");
      const next = rm.nextElementSibling || rm.previousElementSibling;
      if (k === "past") S.past = null; else if (Array.isArray(S[k])) S[k] = S[k].filter((x) => x !== v); else if (k === "free" || k === "star") S[k] = false; else if (k === "q") { S.q = ""; qTerms = []; } else S[k] = null;
      apply({ user: true });
      const tgt = next && next.dataset.rm && $(`[data-rm="${next.dataset.rm}"]`, root);
      (tgt || $("[data-sheet-open]", root)).focus();
      return;
    }
    const vb = e.target.closest("[data-view]");
    if (vb && root.contains(vb)) { S.view = vb.dataset.view; try { app.store.set("cw-prefs", { ...(app.store.get("cw-prefs", {}) || {}), scheduleView: S.view }); } catch { /* per-reader convenience only */ } apply({ user: true }); }
  });
  const openBtn = $("[data-sheet-open]", root);
  const sheetH = sheet && $("#sched-filters-h", sheet);
  if (sheetH) sheetH.tabIndex = -1; // focus lands on the sheet's title, so phones do not pop the keyboard open
  if (openBtn && sheet) openBtn.addEventListener("click", () => app.modal.show(sheet, { trigger: openBtn, focus: "#sched-filters-h" }));
  const qInput = sheet && $("[data-sf-q]", sheet);
  if (qInput) {
    qInput.value = S.q;
    let tm;
    qInput.addEventListener("input", () => { clearTimeout(tm); tm = setTimeout(() => { S.q = qInput.value.trim().slice(0, 80); qTerms = terms(S.q); apply({ user: true }); }, 160); });
    qInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); app.modal.hide(); } });
  }
  const vSel = sheet && $("[data-sf-v]", sheet);
  if (vSel) { vSel.value = S.v || ""; vSel.addEventListener("change", () => { S.v = vSel.value || null; apply({ user: true }); }); }
  if (sheet) {
    const whenSet = $("[data-sf-when-set]", sheet);
    if (whenSet && !isWeek && !S.when) whenSet.hidden = true;
    $("[data-show-n]", sheet).addEventListener("click", () => { requestAnimationFrame(() => { if ($(".sched-status", root).getBoundingClientRect().top < 0) list.scrollIntoView({ block: "start" }); }); });
  }
  function clearAll() {
    Object.assign(S, { p: [], k: [], t: [], h: [], v: null, free: false, q: "", past: null, star: false, when: null });
    qTerms = [];
    if (qInput) qInput.value = "";
    if (vSel) vSel.value = "";
    apply({ user: true });
  }

  /* ---------- the fold, the NOW line, slot states ---------- */
  function foldFor(sec) {
    let d = $(":scope > details.earlier", sec);
    if (!d) {
      d = document.createElement("details");
      d.className = "earlier";
      d.innerHTML = `<summary>${ICON("chev-r", "chev")}<span></span></summary><div class="slots"></div>`;
      const main = $(":scope > [data-slots]", sec);
      sec.insertBefore(d, main);
    }
    return d;
  }
  function layoutDay(d, now, today, fold) {
    const sec = sections.get(d);
    const main = sec && $(":scope > [data-slots]", sec);
    if (!main) return;
    const slots = slotsBy.get(d) || [];
    const isToday = d === today;
    const folded = [], kept = [];
    for (const s of slots) {
      const vis = s._cards.filter((c) => !c.el.hidden);
      s.hidden = !vis.length;
      if (!vis.length) { kept.push(s); continue; }
      const sts = vis.map((c) => statusOf(c.s, c.e, now, !!(c.f & F.END_UNKNOWN)));
      const st = sts.some((x) => x === "live" || x === "started") ? "live" : sts.every((x) => x === "past") ? "past" : sts.some((x) => x === "soon") ? "soon" : "upcoming";
      s.dataset.status = st;
      const rel = $("[data-slot-rel]", s);
      const s0 = Number(s.dataset.slotS);
      const eMax = Math.max(...vis.map((c) => c.e));
      const txt = isToday ? relTime(s0, eMax, now, vis.every((c) => c.f & F.END_UNKNOWN)) : st === "past" ? "Ended" : "";
      if (rel.textContent !== txt) rel.textContent = txt;
      (fold && st === "past" ? folded : kept).push(s);
    }
    let det = $(":scope > details.earlier", sec);
    if (folded.length) {
      det = foldFor(sec);
      const inner = $(".slots", det);
      for (const s of folded) inner.appendChild(s);
      const n = folded.reduce((a, s) => a + s._cards.filter((c) => !c.el.hidden).length, 0);
      const a = fmtTime(nyParts(Number(folded[0].dataset.slotS)).hhmm), b = fmtTime(nyParts(Number(folded[folded.length - 1].dataset.slotS)).hhmm);
      $("summary > span", det).innerHTML = `<b>${isToday ? "Earlier today" : "Ended"}:</b> ${plural(n, "session")}, ${a === b ? a : `${a} to ${b}`}`;
      det.hidden = false;
    } else if (det) det.hidden = true;
    for (const s of kept) main.appendChild(s);
    // the NOW line: today only, after the fold, before the first slot that has not ended
    let line = $(":scope > .now-line", main);
    if (isToday && app.phase() === "during") {
      if (!line) { line = document.createElement("div"); line.className = "now-line"; line.setAttribute("role", "note"); line.innerHTML = "<span></span>"; }
      line.firstChild.textContent = `Now · ${fmtTime(nyParts(now).hhmm)}`;
      const next = kept.find((s) => !s.hidden && s.dataset.status !== "past");
      if (next) main.insertBefore(line, next); else main.appendChild(line);
      line.hidden = !kept.some((s) => !s.hidden) && !folded.length;
    } else if (line) line.remove();
  }

  /* ---------- the band: first TOP visible rows, the rest in "Show n more" ---------- */
  function layoutBand(T, now, today) {
    if (!band) return 0;
    const fold = hidePast(today) && S.day === today;
    const vis = [];
    for (const c of ongoingCards) {
      let ok = matchAll(T, c);
      if (ok && fold) { const x = instOn(c, today); if (x && x[1] <= now) ok = false; }
      c.el.hidden = !ok;
      if (ok) vis.push(c);
    }
    vis.forEach((c, i) => (i < TOP ? bandTop : bandMoreList).appendChild(c.el));
    for (const c of ongoingCards) if (c.el.hidden) bandMoreList.appendChild(c.el); // hidden rows sit after the shown ones
    band.hidden = !vis.length;
    if (bandMore) { bandMore.hidden = vis.length <= TOP; $("[data-ongoing-more-n]", bandMore).textContent = String(Math.max(0, vis.length - TOP)); }
    $("[data-ongoing-n]", band).textContent = String(vis.filter((c) => c.live).length);
    return vis.filter((c) => c.live).length;
  }

  /* ---------- conflicts between starred sessions ---------- */
  function markConflicts() {
    const plan = new Set(app.plan.list().e);
    const mine = timed.filter((c) => plan.has(c.id) && c.live).map((c) => ({ id: c.id, t: c.title, day: c.day, s: c.s, e: c.e, f: c.f }));
    const m = conflicts(mine);
    for (const c of timed) {
      const old = $(":scope .ev-conflict", c.el);
      const list = m.get(c.id);
      if (!list) { if (old) old.remove(); continue; }
      const html = `${ICON("warn")}<span>${list.map((x) => esc(conflictText(x))).join("<br>")}</span>`;
      if (old) { if (old.innerHTML !== html) old.innerHTML = html; continue; }
      const p = document.createElement("p");
      p.className = "ev-conflict";
      p.innerHTML = html;
      const body = $(".ev-body", c.el);
      body.insertBefore(p, $(".ev-more", body));
    }
  }

  /* ---------- apply: the whole view from S ---------- */
  let lastCount = "";
  function apply({ user = false, tick = false } = {}) {
    const now = app.now(), today = festivalToday(now);
    const T = tests(now, today);
    const fold = hidePast(today);
    root.classList.toggle("is-today", S.day === today);
    // tabs
    const perDay = new Map(days.map((d) => [d, 0]));
    let totalAll = 0;
    for (const c of timed) if (c.live && matchAll(T, c, "day")) { perDay.set(c.day, (perDay.get(c.day) || 0) + 1); totalAll++; }
    for (const t of tabs) {
      const d = t.dataset.day, n = d === "all" ? totalAll : perDay.get(d) || 0, on = d === S.day;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      t.classList.toggle("is-zero", !n);
      const nEl = $("[data-dt-n]", t); if (nEl.textContent !== String(n)) nEl.textContent = String(n);
      t.setAttribute("aria-label", `${t.dataset.l1}${d === today && isWeek ? " (today)" : ""}, ${plural(n, "event")}${t.dataset.l2 ? `. ${t.dataset.l2}` : ""}`);
      if (on) list.setAttribute("aria-labelledby", t.id);
    }
    // cards and slots
    let shown = 0;
    for (const c of timed) { const ok = matchAll(T, c); c.el.hidden = !ok; if (ok && c.live) shown++; }
    const bandN = layoutBand(T, now, today);
    for (const [d, sec] of sections) {
      const vis = (slotsBy.get(d) || []).some((s) => s._cards.some((c) => !c.el.hidden));
      sec.hidden = S.day === "all" ? !vis : d !== S.day || !vis;
      if (!sec.hidden) {
        layoutDay(d, now, today, foldDay(d, today));
        const n = (slotsBy.get(d) || []).reduce((a, s) => a + s._cards.filter((c) => !c.el.hidden && c.live).length, 0);
        const nEl = $("[data-day-n]", sec); if (nEl) nEl.textContent = plural(n, "event");
      }
    }
    const anyTimed = timed.some((c) => !c.el.hidden);
    emptyEl.hidden = anyTimed || (band && !band.hidden);
    if (!emptyEl.hidden) {
      const where = S.day === "all" ? "this week" : `on ${fmtDay(S.day)}`;
      $("h3", emptyEl).textContent = S.when === "now" ? `Nothing on right now${S.p.length + S.k.length ? " for these filters" : ""}` : S.star && !app.plan.count() ? "Your plan is empty" : `Nothing matches these filters ${where}`;
      $("p", emptyEl).textContent = app.phase() === "before" && S.when ? `The week starts ${fmtDay(meta.week.start)}.` : S.star && !app.plan.count() ? "Star events to add them to My Plan." : "Try another day, or clear the filters.";
    }
    // chip counts (sessions at set times, on the day shown, under the other filters)
    const countBy = (key, val) => timed.reduce((n, c) => n + (c.live && matchAll(T, c, key) && val(c) ? 1 : 0), 0);
    for (const ch of $$("[data-sf]", root).concat(sheet ? $$("[data-sf]", sheet) : [])) {
      const k = ch.dataset.sf, v = ch.dataset.v, vs = v.split(",");
      const on = Array.isArray(S[k]) ? vs.every((x) => S[k].includes(x)) : S[k] === v;
      ch.setAttribute("aria-pressed", String(on));
      const nEl = $(".n", ch);
      if (nEl && k !== "when") {
        const n = k === "p" ? countBy("p", (c) => vs.includes(c.p)) : k === "k" ? countBy("k", (c) => c.kg === v || c.k === v) : k === "t" ? countBy("t", (c) => c.t === v) : k === "h" ? countBy("h", (c) => c.h === v) : null;
        if (n !== null) {
          nEl.textContent = String(n); ch.classList.toggle("is-zero", !n);
          ch.setAttribute("aria-label", `${$("span:not(.n)", ch)?.textContent || v}, ${plural(n, "event")}`);
        }
      }
    }
    // single kinds from a deep link (k=performance) get their own pressed chip in the sheet
    const kx = sheet && $("[data-sf-kinds]", sheet);
    if (kx) kx.innerHTML = S.k.filter((k) => meta.kinds[k]).map((k) => `<button class="chip" type="button" aria-pressed="true" data-sf="k" data-v="${esc(k)}"><span>${esc(meta.kinds[k])}</span>${ICON("check", "ck")}</button>`).join("");
    if (sheet) {
      for (const sw of $$("[data-sf-switch]", sheet)) { const k = sw.dataset.sfSwitch; sw.setAttribute("aria-checked", String(k === "past" ? fold : !!S[k])); }
      const b = $("[data-show-n]", sheet);
      b.textContent = shown ? `Show ${plural(shown, "event")}` : bandN ? `Show ${plural(bandN, "all-day item")}` : "No events match";
      if (qInput && document.activeElement !== qInput && qInput.value !== S.q) qInput.value = S.q;
      if (vSel) vSel.value = S.v || "";
    }
    // active chips (the sheet's filters) and the Filters (n) badge
    const act = [];
    if (S.when) act.push(["when", S.when, { now: "On now", next: "Next 2 hours", tonight: "Tonight" }[S.when]]);
    if (S.q) act.push(["q", "", `“${S.q}”`]);
    for (const k of S.k) act.push(["k", k, meta.groups[k] || meta.kinds[k] || k]);
    for (const t of S.t) act.push(["t", t, meta.buckets[t]]);
    for (const hh of S.h) act.push(["h", hh, meta.hoods[hh] || hh]);
    if (S.v) act.push(["v", S.v, vSel ? vSel.selectedOptions[0]?.textContent || S.v : S.v]);
    if (S.free) act.push(["free", "", "Free only"]);
    if (S.star) act.push(["star", "", "In my plan"]);
    if (S.past) act.push(["past", "", S.past === "0" ? "Hide ended" : "Showing ended"]);
    const ac = $("[data-active-chips]", root);
    ac.innerHTML = act.map(([k, v, l]) => `<button class="chip" type="button" data-rm="${esc(k)}:${esc(v)}"><span>${esc(l)}</span>${ICON("x", "x")}<span class="sr-only">Remove this filter</span></button>`).join("");
    ac.hidden = !act.length;
    const fc = $("[data-filter-count]", root);
    fc.textContent = String(act.length); fc.hidden = !act.length;
    $("[data-sheet-open]", root).setAttribute("aria-label", act.length ? `Filters, ${act.length} active` : "Filters");
    for (const b of $$(".sched-status [data-sched-clear]", root)) b.hidden = !(act.length || S.p.length);
    // the live count (announced only when it changes)
    const where = S.day === "all" ? `across ${plural(days.length, "day")}` : `on ${fmtDay(S.day)}`;
    const progsTxt = S.p.length ? ` · ${$$('[data-sf="p"][aria-pressed="true"] span:not(.n)', root).map((x) => x.textContent).join(", ")}` : "";
    const txt = `<b>${shown}</b> ${shown === 1 ? "event" : "events"} ${where}${bandN ? `, plus ${bandN} all day and all night` : ""}${progsTxt}`;
    if (txt !== lastCount && (!tick || S.when)) { countEl.innerHTML = txt; lastCount = txt; }
    // view
    for (const b of $$("[data-view]", root)) b.setAttribute("aria-pressed", String(b.dataset.view === S.view));
    if (S.view === "map") drawMap(); else if (mapEl) mapEl.hidden = true;
    if (!tick) markConflicts();
    if (user || !tick) writeUrl();
  }

  /* ---------- List / Map: pins are the venues of the visible events (features/map.js, Agent E) ---------- */
  let map = null;
  async function drawMap() {
    if (!mapEl) return;
    mapEl.hidden = false;
    let data;
    try { data = await app.data("events.json"); } catch { mapEl.innerHTML = '<p class="unk">The map needs the event data, which did not load. The list below has every event.</p>'; return; }
    const count = new Map(), progOf = new Map();
    for (const c of cards) if (!c.el.hidden && c.v) { count.set(c.v, (count.get(c.v) || 0) + 1); if (!progOf.has(c.v)) progOf.set(c.v, c.p); }
    const pins = [...count].map(([id, n]) => { const v = data.venues[id]; return v && v.ll ? { id, kind: "venue", lat: v.ll[0], lng: v.ll[1], prog: progOf.get(id), n: v.st || "", label: `${v.n}: ${plural(n, "event")}` } : null; }).filter(Boolean);
    try {
      const m = await import("./map.js");
      if (!map) {
        map = m.mountMap(mapEl, { pins, layers: ["venues"], fit: true, onSelect: (id) => { S.v = S.v === id ? null : id; apply({ user: true }); } });
      } else map.update(pins);
    } catch (e) { console.error("[cw] map", e); }
    // if the map module draws nothing (not available yet), say so; the note goes once the map draws
    setTimeout(() => {
      const note = $("[data-map-note]", mapEl), drawn = [...mapEl.children].some((x) => !x.hasAttribute("data-map-note"));
      if (!drawn && !note) mapEl.insertAdjacentHTML("beforeend", '<p class="unk" data-map-note>The map view is not available in this build yet. The list below has every event.</p>');
      else if (drawn && note) note.remove();
    }, 300);
  }

  /* ---------- go ---------- */
  apply();
  // the deep-linked event: make sure its card is in view behind the dialog
  if (deep && byId.has(deep)) {
    const c = byId.get(deep);
    if (c.ongoing && bandMore && bandMore.contains(c.el)) bandMore.open = true;
    const det = c.el.closest("details.earlier"); if (det) det.open = true;
    c.el.classList.add("is-hit");
    // after main.js marks the page ready (the list is then laid out for real), bring the card into view
    requestAnimationFrame(() => requestAnimationFrame(() => c.el.scrollIntoView({ block: "center" })));
  }
  app.onTick(() => apply({ tick: true }), { immediate: false });
  app.plan.subscribe(() => { if (S.star) apply({ user: false, tick: false }); else markConflicts(); });
  // the tab strip scrolls the selected day into view on phones
  const sel = tabs.find((t) => t.dataset.day === S.day);
  if (sel) tablist.scrollLeft = Math.max(0, sel.offsetLeft - tablist.clientWidth / 2 + sel.clientWidth / 2);
}
