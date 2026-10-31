/* ============================================================
   site/js/core/dom.js · OWNER: Agent A (core engine)
   Tiny DOM helpers shared by core modules and features.
   ============================================================ */
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
export const html = document.documentElement;
export const ROOT = html.getAttribute("data-root") || "";
export const PAGE = html.getAttribute("data-page") || "";
export const DATA_V = html.getAttribute("data-v") || "";
export const motionOK = () => !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
export const IS_MAC = /mac|iphone|ipad|ipod/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || "");
export { esc } from "../lib/text.js";
/** Focusable elements that are actually visible. */
export const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
export const focusables = (el) => $$(FOCUSABLE, el).filter((x) => x.offsetParent !== null || x.getClientRects().length);
/** A click that should open in a new tab/window is left to the browser. */
export const modified = (e) => e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0;
