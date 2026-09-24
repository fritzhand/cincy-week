/* ============================================================
   site/js/features/home.js · OWNER: Agent G (home, programs & info)
   The home page's clock-driven parts (DESIGN.md §9.2, §4.4). The server renders
   the "before" edition (what a reader without JS sees); this module:
   - dates the folio and the kicker ("9 days out · Art Week opens Sat, Oct 3",
     "Today is interchange day", "Day 4 of 9 · Tue, Oct 6"),
   - moves Today on the week line (aria-current="date", "Today ·" on phones),
   - before the week: the countdown, and "First up" refreshed from the clock,
   - during the week: "At this hour" (Now, open now, Next, Tonight) from events.json,
     redrawn every minute; the core's status runner adds the state words.
   Everything it prints comes from assets/data/events.json (lib/athour.js).
   ============================================================ */
import { esc } from "../lib/text.js";
import { nyParts, fmtDayLong, fmtDay, fmtTime, MIN } from "../lib/time.js";
import { items, atThisHour, firstUp, countdown, kicker, hoursText, rel, festivalDay, FL } from "../lib/athour.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export function init(app) {
  let meta = {};
  try { meta = JSON.parse($("[data-home-meta]")?.textContent || "{}"); } catch { /* keep the server's edition */ }
  const phase = app.phase();
  const R = app.root;
  if ($("[data-ear-sim]") && document.documentElement.hasAttribute("data-now")) $("[data-ear-sim]").hidden = false;

  /* ---------- date lines, kicker, today on the week line ---------- */
  function dateLines(now) {
    const p = nyParts(now), today = festivalDay(now);
    const folio = $("[data-folio-date]");
    if (folio) folio.textContent = `${fmtDayLong(p.date)}, ${p.date.slice(0, 4)}`;
    const k = $(`[data-kicker="${phase}"]`);
    if (k && phase !== "after") k.textContent = kicker(phase, now, meta);
    for (const li of $$(".wk-day")) {
      const on = li.dataset.date === today;
      if (on) li.setAttribute("aria-current", "date"); else li.removeAttribute("aria-current");
      const t = $(".wk-today", li); if (t) t.hidden = !on;
      const s = $("[data-wk-today]", li); if (s) s.hidden = !on;
    }
  }

  /* ---------- markup shared with the server (build/pages/home.mjs nnItem) ---------- */
  let data = null;
  const place = (it) => {
    const v = it.v && data.venues[it.v];
    if (v) return esc(v.n);
    if (it.lt && it.lt !== "Location not listed") return esc(it.lt);
    return '<span class="unk">Location not listed</span>';
  };
  const short = (p) => (data.programs[p] ? data.programs[p].s : p);
  const bullet = (p) => `<svg class="bullet" aria-hidden="true"><use href="#b-${esc(p)}"/></svg>`;
  function nn(it, { day = false, progress = false, word = "" } = {}) {
    const eu = it.f & FL.END_UNKNOWN;
    let bar = "";
    if (progress && !eu && it.e > it.s) {
      const total = Math.round((it.e - it.s) / MIN), done = Math.max(0, Math.min(total, Math.round((app.now() - it.s) / MIN)));
      bar = `<span class="progress" role="img" aria-label="${done} of ${total} minutes elapsed"><i data-p="${Math.round((done / total) * 100)}"></i></span>`;
    }
    return `<a class="nn-item" href="${R}schedule.html?e=${esc(it.id)}#e-${esc(it.id)}" data-open-event="${esc(it.id)}" data-prog="${esc(it.p)}" data-s="${it.s}" data-e="${it.e}"${eu ? ' data-end-unknown="1"' : ""}>${bullet(it.p)}<span class="t">${esc(it.t)}</span><span class="m"><span class="p">${esc(short(it.p))}</span> · ${day ? `${esc(fmtDay(it.day))} · ` : ""}${word ? `${esc(word)} · ` : ""}${esc(hoursText(it))} · ${place(it)} <span class="nn-st" data-status></span></span>${bar}</a>`;
  }
  const paint = (root) => {
    for (const i of $$(".progress > i[data-p]", root)) i.style.setProperty("--p", `${i.dataset.p}%`);
    app.status.update(app.now(), root);
  };

  /* ---------- before: countdown + First up ---------- */
  function drawBefore(now, all) {
    const cd = meta.first ? countdown(now, meta.first.date, meta.first.name) : null;
    const box = $("[data-countdown]");
    if (box) {
      box.hidden = !cd;
      if (cd) { $("[data-cd-n]", box).textContent = cd.n; $("[data-cd-t]", box).textContent = cd.text; }
    }
    if (!all) return;
    const list = $("[data-first-up]");
    const up = firstUp(all, now);
    if (list && up.length) { list.innerHTML = up.map((it) => nn(it, { day: true })).join(""); paint(list); }
  }

  /* ---------- during: At this hour ---------- */
  function drawDuring(now, all) {
    const clock = $("[data-ear-clock]");
    const p = nyParts(now);
    if (clock) clock.textContent = `${fmtDay(p.date)} · ${fmtTime(p.hhmm)}`;
    const body = $("[data-ear-body]");
    if (!body || !all) return;
    const r = atThisHour(all, now);
    const grp = (label, html, cls = "") => `<div class="nn-group${cls ? " is" + cls.replace(" ", "-") : ""}"><p class="nn-label label${cls}">${label}</p>${html}</div>`;
    const more = (n, href, what) => (n > 0 ? `<a class="nn-more" href="${R}${href}">${esc(`and ${n} more ${what}`)}</a>` : "");
    const out = [];
    if (r.now.length) out.push(grp("Now", r.now.map((it) => nn(it, { progress: true })).join("") + more(r.nowMore, "schedule.html?when=now", "on now"), " now"));
    else out.push(grp("Now", '<p class="nn-none">Nothing with listed hours is on right now.</p>', " now"));
    if (r.open.length) out.push(grp("Open now", r.open.map((it) => nn(it, { progress: true })).join("") + more(r.openMore, `schedule.html?day=${r.today}`, "open now"), " open"));
    if (r.next.length) {
      const first = r.next[0].s, sameDay = r.next[0].day === r.today;
      const label = sameDay ? `Next · ${rel(first - now)}` : `Next · ${fmtDay(r.next[0].day)}`;
      out.push(grp(esc(label), r.next.map((it) => nn(it, { day: !sameDay })).join("")));
    }
    if (r.onView) out.push(`<p class="nn-onview"><a href="${R}schedule.html?day=${r.today}">${esc(`${r.onView} exhibitions and installations on view today`)}</a> <span class="unk">hours not listed</span></p>`);
    if (r.tonight.length) {
      out.push(`<h3 class="sub-h">Tonight</h3><ol class="tonight">${r.tonight.map((it) => {
        const [hm, ap] = fmtTime(nyParts(it.s).hhmm).split(" ");
        const late = it.f & FL.LATE ? " · after midnight" : "";
        return `<li><a href="${R}schedule.html?e=${esc(it.id)}#e-${esc(it.id)}" data-open-event="${esc(it.id)}"><time>${esc(hm)}<small>${esc(ap)}</small></time>${bullet(it.p)}<span><span class="t">${esc(it.t)}</span><span class="w">${esc(short(it.p))} · ${esc(hoursText(it))}${late} · ${place(it)}</span></span></a></li>`;
      }).join("")}</ol>${r.tonightMore ? `<p class="ear-more"><a href="${R}schedule.html?when=tonight">${esc(`All ${r.tonight.length + r.tonightMore} tonight`)}</a></p>` : ""}`);
    }
    body.innerHTML = out.join("");
    paint(body);
  }

  let all = null;
  const draw = (now) => {
    dateLines(now);
    if (phase === "before") drawBefore(now, all);
    if (phase === "during") drawDuring(now, all);
  };
  draw(app.now());
  if (phase === "after") return;
  app.data("events.json").then((d) => {
    data = d; all = items(d);
    app.onTick(draw);
  }).catch(() => {
    const body = $("[data-ear-body]");
    if (body && phase === "during") body.innerHTML = `<p class="muted">The live list could not load. <a href="${R}schedule.html?when=now">See what is on now in The Week</a>.</p>`;
  });
}
