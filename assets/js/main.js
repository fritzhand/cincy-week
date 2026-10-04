/* ============================================================
   site/js/main.js · OWNER: Agent A (core engine)
   The client entry (an ES module, deferred by nature). Boots the core,
   then imports each feature named in <body data-features="…"> from
   ./features/<name>.js and calls its init(app).

   app — what features get (code against this, not against core internals):
     root            "" or "../" (prefix for internal URLs)
     page            <html data-page> (the page slug)
     now()           epoch ms (honours ?now= in QA), onTick(fn) every 60 s
     phase()         "before" | "during" | "after"
     data(name)      Promise of assets/data/<name> (events.json, works.json, search.json)
     store           { get, set, del, blocked } for cw-* keys (see core/store.js)
     plan            { has, toggle, add, replace, clear, list, count, subscribe }
     modal           { show(el, opts), hide(), current() }
     toast(text, { link, ms })
     status          { update(now, root), statusOf(s, e, now, endUnknown) }
     share({ title, text, url }), copyText(text)
     openEvent(id, opts), openWork(id, opts), openSearch(trigger, q)
   Pages must be served over http(s) (npm run dev): ES modules do not load from file://.
   ============================================================ */
import { ROOT, PAGE, $$ } from "./core/dom.js";
import { store } from "./core/store.js";
import { initTheme } from "./core/theme.js";
import { initDrawer } from "./core/drawer.js";
import { initDock } from "./core/dock.js";
import { initModal, showModal, hideModal, current } from "./core/modal.js";
import { toast } from "./core/toast.js";
import { initSearch, openSearch } from "./core/search.js";
import { initAnchors } from "./core/anchors.js";
import { initToc } from "./core/toc.js";
import { now, onTick, phase } from "./core/clock.js";
import { updateStatus, statusOf } from "./core/status.js";
import * as plan from "./core/plan-store.js";
import { share, copyText } from "./core/share.js";
import { getJSON } from "./core/data.js";
import { initLive } from "./core/live.js";
import { initEventDialog, open as openEvent } from "./core/event-dialog.js";
import { initWorkDialog, open as openWork } from "./core/work-dialog.js";

const app = {
  root: ROOT, page: PAGE, now, onTick, phase, data: getJSON, store,
  plan: { has: plan.has, toggle: plan.toggle, add: plan.add, replace: plan.replace, clear: plan.clear, list: plan.list, count: plan.count, subscribe: plan.subscribe, refresh: plan.refreshStars },
  modal: { show: showModal, hide: hideModal, current }, toast, status: { update: updateStatus, statusOf },
  share, copyText, openEvent, openWork, openSearch,
};
window.cw = app; // handy in the console and for Playwright checks

const safe = (name, fn) => { try { fn(); } catch (e) { console.error(`[cw] ${name} failed`, e); } };
safe("theme", initTheme);
safe("drawer", initDrawer);
safe("dock", initDock);
safe("modal", initModal);
safe("search", initSearch);
safe("anchors", initAnchors);
safe("toc", initToc);
safe("plan", plan.initPlan);
safe("status", () => onTick((t) => updateStatus(t)));
safe("live", initLive);
safe("event dialog", initEventDialog);
safe("work dialog", initWorkDialog);

const features = (document.body.dataset.features || "").split(/\s+/).filter(Boolean);
Promise.all(features.map((f) => import(`./features/${f}.js`)
  .then((m) => m.init && m.init(app))
  .catch((e) => console.error(`[cw] feature ${f} failed`, e))))
  .then(() => { document.documentElement.classList.add("cw-ready"); $$("[data-js-hide]").forEach((el) => { el.hidden = true; }); });
