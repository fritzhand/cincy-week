/* ============================================================
   site/js/features/plan.js · OWNER: Agent D (schedule & plan)
   My Plan, client-rendered from cw-plan + assets/data/events.json (+ works.json when art is starred):
   - "All day and all night" (multi-day items), then one list per festival day in time order
   - overlaps printed with their length ("Overlaps “X” by 1 h"), or "may overlap" when an end
     time is not listed (lib/agenda.js)
   - walking gaps between consecutive places: straight-line estimate, labeled as one; above 25 min
     it suggests the Connector streetcar or a ride; places with no address say so
   - live state words via the core (data-s / data-e on each item); ended items get the past tint
   - Export to calendar (.ics, lib/ics.js), Share (plan.html#p=<codes>;w=<codes>), Clear (confirmed)
   - a shared link opens a read-only view with Add all / Replace my plan / Just look; never silent.
     The imported hash is remembered in cw-seen-shared so reopening it does not prompt again.
   ============================================================ */
import { planHash, decode } from "../lib/share.js";
import { conflicts, conflictText, walkGap, gapText, isTimed } from "../lib/agenda.js";
import { nyParts, fmtTime, fmtRange, fmtDayLong, fmtDay, fmtDateRange } from "../lib/time.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const I = (n, cls = "") => `<svg class="i${cls ? " " + cls : ""}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;
const hm = (t) => nyParts(t).hhmm;

export function init(app) {
  const root = $("[data-plan]");
  if (!root) return;
  const R = app.root;
  const listEl = $("[data-plan-list]", root), emptyEl = $("[data-plan-empty]", root), actions = $("[data-plan-actions]", root);
  const sharedEl = $("[data-plan-shared]", root), summary = $("[data-plan-summary]", root), loading = $("[data-plan-loading]", root);
  let EV = null, WK = null, XT = null, codeToId = null, shared = null;

  const load = async (needWorks) => {
    if (!EV) [EV, XT] = await Promise.all([app.data("events.json"), app.data("schedule-extra.json").catch(() => ({ spans: {} }))]);
    if (needWorks && !WK) WK = await app.data("works.json").catch(() => ({ works: [], people: {} }));
    codeToId = new Map([...EV.events.map((e) => [e.x, e.id]), ...((WK && WK.works) || []).map((w) => [w.x, w.id])]);
  };

  /* ---------- one item ---------- */
  const star = (id, title, kind = "e") => `<button class="star" type="button" data-star="${esc(id)}"${kind === "w" ? ' data-star-kind="w"' : ""} aria-pressed="${app.plan.has(id)}" aria-label="${app.plan.has(id) ? "Remove" : "Add"} “${esc(title)}” ${app.plan.has(id) ? "from" : "to"} My Plan">${I("star")}</button>`;
  const badge = (p) => `<span class="prog-badge" data-prog="${esc(p)}"><svg class="bullet" aria-hidden="true"><use href="#b-${esc(p)}"/></svg>${esc(EV.programs[p]?.s || p)}</span>`;
  const place = (ev) => { const v = ev.v ? EV.venues[ev.v] : null; return v ? `<a href="${R}venues/${esc(ev.v)}.html">${esc(v.n)}</a>` : ev.lt && ev.lt !== "Location not listed" ? esc(ev.lt) : `<span class="unk">${ev.lt ? "Location not listed" : "Place not listed"}</span>`; };
  function item(x, notes) {
    const { ev, day, s, e, f } = x;
    const multi = ev.i.length > 1;
    const rng = multi ? fmtDateRange(...(XT.spans[ev.id] || [ev.i[0][0], ev.i[ev.i.length - 1][0]])) : "";
    const timeCol = multi ? `<small${rng.length <= 8 ? ' class="rng"' : ""}>${esc(rng)}</small>` : f & 4 ? "<small>All day</small>" : f & 2 ? "<small>Time not listed</small>" : (() => { const [a, b] = fmtTime(hm(s)).split(" "); return `${esc(a)}<small>${esc(b)}</small>`; })();
    const about = (ev.tg || []).includes("approximate-time") ? "About " : "";   // QA: an approximate source time
    const hours = f & 4 ? "All day" : f & 2 ? (ev.ht ? esc(ev.ht) : '<span class="unk">Hours not listed</span>') : f & 1 ? `${about}${esc(fmtTime(hm(s)))} <span class="unk">end time not listed</span>` : about + esc(fmtRange(hm(s), hm(e)));
    const st = f & 2 ? ' data-time-unknown="1"' : `${multi ? ` data-inst="${ev.i.map(([, a, b]) => `${a}:${b}`).join(",")}"` : ""} data-s="${s}" data-e="${e}"${f & 1 ? ' data-end-unknown="1"' : ""}`;
    const late = f & 16 ? ` · after midnight (${esc(fmtDay(nyParts(s).date))})` : "";
    return `<li class="plan-item" data-prog="${esc(ev.p)}" data-id="${esc(ev.id)}"${st}><time${f & 6 || multi ? "" : ` datetime="${new Date(s).toISOString()}"`}>${timeCol}</time>
<div><p class="t"><a href="${R}schedule.html?e=${esc(ev.id)}#e-${esc(ev.id)}" data-open-event="${esc(ev.id)}">${esc(ev.t)}</a>${ev.st === "cancelled" ? ' <span class="badge badge-warn">Cancelled</span>' : ""}</p>
<p class="m">${badge(ev.p)}<span class="tnum">${hours}${late}</span><span>${place(ev)}</span><span class="ev-status" data-status></span></p></div>
${star(ev.id, ev.t)}${notes && notes.length ? `<p class="ev-conflict">${I("warn")}<span>${notes.map((c) => esc(conflictText(c, { inPlan: false }))).join("<br>")}</span></p>` : ""}</li>`;
  }
  function workItem(w) {
    const by = w.a.map((a) => WK.people[a]?.n).filter(Boolean).join(", ") || w.at || "";
    const v = w.v && EV.venues[w.v] ? EV.venues[w.v].n : w.lt || w.z || "";
    return `<li class="plan-item plan-work" data-prog="${esc(w.p)}"><span class="plan-glyph" aria-hidden="true"><svg class="bullet"><use href="#b-${esc(w.p)}"/></svg></span>
<div><p class="t"><a href="${R}art.html?w=${esc(w.id)}" data-open-work="${esc(w.id)}">${esc(w.t)}</a></p>
<p class="m">${badge(w.p)}${by ? `<span>${esc(by)}</span>` : ""}${v ? `<span>${esc(v)}</span>` : ""}${w.ht ? `<span>${esc(w.ht)}</span>` : ""}</p></div>
${star(w.id, w.t, "w")}</li>`;
  }

  /* ---------- the whole list for a set of ids ---------- */
  function listHtml({ e, w }) {
    const evs = e.map((id) => EV.events.find((x) => x.id === id)).filter(Boolean);
    const all = [], band = [];
    for (const ev of evs) {
      if (ev.i.length > 1) { band.push(ev); continue; }
      for (const [day, s, en, f] of ev.i) all.push({ id: ev.id, t: ev.t, ev, day, s, e: en, f, v: ev.v, lt: ev.lt });
    }
    const conf = conflicts(all.filter((x) => x.ev.st !== "cancelled"));
    const days = [...new Set(all.map((x) => x.day))].sort();
    let html = "";
    if (band.length) {
      band.sort((a, b) => a.i[0][1] - b.i[0][1]);
      html += `<section class="plan-day" aria-labelledby="pd-band"><h2 id="pd-band">All day and all night <span class="label muted tnum">${plural(band.length, "item")}</span></h2><ol class="plan-list">${band.map((ev) => { const x = ev.i.find(([, , en]) => en > app.now()) || ev.i[ev.i.length - 1]; return item({ ev, day: x[0], s: x[1], e: x[2], f: x[3] }); }).join("")}</ol></section>`;
    }
    for (const d of days) {
      const xs = all.filter((x) => x.day === d).sort((a, b) => (isTimed(a.f) ? 1 : 0) - (isTimed(b.f) ? 1 : 0) || a.s - b.s || a.e - b.e);
      let rows = "", prev = null;
      for (const x of xs) {
        // a walking hint needs two places; an item with no place already says "Place not listed" in its own line
        if (prev && isTimed(prev.f) && isTimed(x.f) && prev.v && x.v) {
          const g = walkGap(prev, x, EV.venues);
          let txt = gapText(g);
          if (g.kind === "walk" && g.free !== null && g.free >= 0 && g.minutes > g.free) txt += ` · ${g.free} min between them`;
          rows += `<li class="gap-hint${g.long ? " long" : ""}">${I(g.long ? "warn" : "walk")}<span${g.kind === "unknown" ? ' class="unk"' : ""}>${esc(txt)}</span></li>`;
        }
        rows += item(x, conf.get(x.id));
        prev = x;
      }
      html += `<section class="plan-day" aria-labelledby="pd-${d}"><h2 id="pd-${d}">${esc(fmtDayLong(d))} <span class="label muted tnum">${plural(xs.length, "item")}</span></h2><ol class="plan-list">${rows}</ol></section>`;
    }
    const works = w.map((id) => WK && WK.works.find((x) => x.id === id)).filter(Boolean);
    if (works.length) html += `<section class="plan-day" aria-labelledby="pd-art"><h2 id="pd-art">Art to see <span class="label muted tnum">${plural(works.length, "work")}</span></h2><ul class="plan-list">${works.map(workItem).join("")}</ul></section>`;
    const n = { e: evs.length, w: works.length, c: [...conf.values()].reduce((a, l) => a + l.length, 0) / 2 };
    return { html, n };
  }

  /* ---------- render: my plan, or a shared plan to look at ---------- */
  let focusStar = null;
  async function render() {
    const mine = app.plan.list();
    const view = shared || mine;
    const count = view.e.length + view.w.length;
    if (!count && !shared) { listEl.innerHTML = ""; actions.hidden = true; emptyEl.hidden = false; loading.hidden = true; return; }
    if (!EV) loading.hidden = false;
    try { await load(view.w.length > 0); }
    catch { loading.hidden = false; loading.textContent = "The event data did not load. Check your connection and reload the page."; return; }
    loading.hidden = true;
    emptyEl.hidden = true;
    const { html, n } = listHtml(view);
    listEl.innerHTML = html || `<p class="unk">None of the items in this link are in the guide's current data.</p>`;
    actions.hidden = !!shared;
    if (!shared) {
      const parts = [n.e ? plural(n.e, "event") : "", n.w ? plural(n.w, "work") + " of art" : ""].filter(Boolean);
      summary.textContent = `${parts.join(" and ")} in your plan${n.c ? ` · ${plural(n.c, "overlap")}` : ""}`;
    }
    app.status.update(app.now(), listEl);
    if (focusStar !== null) {
      const stars = $$(".star", listEl);
      const t = stars[Math.min(focusStar, stars.length - 1)] || $("h1");
      if (t) { if (t.matches("h1")) t.tabIndex = -1; t.focus(); }
      focusStar = null;
    }
  }
  listEl.addEventListener("click", (e) => { const b = e.target.closest(".star"); if (b && !shared) focusStar = $$(".star", listEl).indexOf(b); }, true);
  app.plan.subscribe(() => { if (!shared) render(); else app.plan.refresh(); });

  /* ---------- shared links: #p=<codes>;w=<codes> ---------- */
  async function readHash() {
    const h = location.hash.replace(/^#/, "");
    if (!/^(p|w)=/.test(h)) { shared = null; sharedEl.hidden = true; return render(); }
    const seen = app.store.get("cw-seen-shared", null);
    try { await load(/(^|;)w=/.test(h)); } catch { sharedEl.hidden = false; sharedEl.innerHTML = '<p class="unk">This shared plan could not be read: the event data did not load.</p>'; return; }
    const got = decode(h, codeToId);
    if (seen === h) { history.replaceState(history.state, "", location.pathname + location.search); shared = null; sharedEl.hidden = true; return render(); }
    shared = { e: got.e, w: got.w };
    const n = got.e.length + got.w.length;
    const mine = app.plan.count();
    sharedEl.hidden = false;
    sharedEl.innerHTML = `<aside class="callout tone-tip plan-shared"><span class="flag label">${I("share")}Shared plan</span><p><b>${plural(n, "item")}</b> in this link${got.unknown ? ` (${plural(got.unknown, "code")} not found in the guide)` : ""}. Nothing changes in your plan until you choose.</p>
<div class="btn-row">${n ? `<button class="btn btn-primary" type="button" data-shared="add">Add all to my plan</button>${mine ? `<button class="btn btn-secondary" type="button" data-shared="replace">Replace my plan (${plural(mine, "item")})</button>` : ""}` : ""}<button class="btn btn-ghost" type="button" data-shared="look">${n ? "Just look" : "Back to my plan"}</button></div></aside>`;
    return render();
  }
  sharedEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-shared]");
    if (!b || !shared) return;
    const h = location.hash.replace(/^#/, "");
    const act = b.dataset.shared;
    if (act === "look" && b.textContent === "Just look") { b.textContent = "Back to my plan"; sharedEl.querySelector("p").insertAdjacentHTML("beforeend", " You are looking at it below; your own plan is unchanged."); return; }
    const got = shared;
    shared = null;
    if (act === "add") { app.plan.add(got.e, "e"); app.plan.add(got.w, "w"); app.toast(`Added ${plural(got.e.length + got.w.length, "item")} to My Plan`); }
    if (act === "replace") { app.plan.replace(got); app.toast("Your plan now matches the shared link"); }
    if (act !== "look") app.store.set("cw-seen-shared", h);
    sharedEl.hidden = true;
    history.replaceState(history.state, "", location.pathname + location.search);
    render();
    $("h1").tabIndex = -1; $("h1").focus();
  });
  window.addEventListener("hashchange", readHash);

  /* ---------- actions ---------- */
  root.addEventListener("click", async (e) => {
    if (e.target.closest("[data-plan-ics]")) {
      await load(false);
      const ics = await import("../lib/ics.js");
      const base = new URL(R || "./", location.href).href;   // QA: "" resolved to this page (plan.html?…), not the site root
      const TX = await app.data("event-text.json").catch(() => null);   // descriptions (core/client-data.mjs)
      const items = app.plan.list().e.map((id) => EV.events.find((x) => x.id === id)).filter(Boolean).map((ev) => (TX && TX.d ? { ...ev, d: TX.d[ev.id] || null } : ev)).flatMap((ev) => ics.eventItems(ev, EV, { base, span: XT.spans[ev.id] }));
      if (!items.length) { app.toast("Only works of art are starred: they have no set times to export"); return; }
      const url = URL.createObjectURL(new Blob([ics.vcalendar(items, { name: "My Plan · Cincy Week" })], { type: "text/calendar;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = "cincy-week-my-plan.ics"; a.hidden = true;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
      app.toast(`Calendar file with ${plural(items.length, "event")} downloaded${app.plan.list().w.length ? " (art has no set times, so it is not included)" : ""}`, { ms: 5000 });
    }
    if (e.target.closest("[data-plan-share]")) {
      const url = `${location.origin}${location.pathname}#${planHash(app.plan.list())}`;
      app.share({ title: "My Plan · Cincy Week", text: `${plural(app.plan.count(), "item")} for Cincinnati's first week of October`, url });
    }
    const conf = $("[data-plan-confirm]", root);
    if (e.target.closest("[data-plan-clear]")) { $("#plan-confirm-t").textContent = `Remove all ${plural(app.plan.count(), "item")} from My Plan? This cannot be undone.`; conf.hidden = false; $("[data-plan-clear-no]", conf).focus(); }
    if (e.target.closest("[data-plan-clear-no]")) { conf.hidden = true; $("[data-plan-clear]", root).focus(); }
    if (e.target.closest("[data-plan-clear-yes]")) { conf.hidden = true; app.plan.clear(); app.toast("Your plan is empty"); $("h1").tabIndex = -1; $("h1").focus(); }
  });

  app.onTick(() => { if (!listEl.hidden) app.status.update(app.now(), listEl); }, { immediate: false });
  readHash();
}
