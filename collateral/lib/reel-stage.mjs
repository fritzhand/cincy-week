/* ============================================================
   collateral/lib/reel-stage.mjs — the machinery under collateral/build-reel.mjs.

   A 1080×1920 stage (540×960 css px at device scale 2) served next to docs/, rendered frame by
   frame by Playwright on a frozen clock: every frame is a pure function of its time, and the
   site's own clock (installed in the browser) advances one frame per frame, so the real site in
   the phone shows its during-the-week states and moves with the video.

   Two checks run on every frame, so a render cannot ship text that is too quick or too close to
   the edge:
   - reading time: every element with data-read="<words>" is counted while it is fully visible
     and settled (opacity 1, no transform in flight); at the end each must have held for
     max(floor, 0.3 s × words), floor 0.8 s for 1–3 words and 1.2 s for longer lines;
   - safe zone: while a data-read element is visible, its box must sit inside the Reels safe area
     (x 64–940, y 250–1480 in 1080×1920 px) unless it carries data-zone="free" (texture, not copy).
   ============================================================ */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const FPS = 30, W = 1080, H = 1920, CSS_W = 540, CSS_H = 960, DPR = W / CSS_W;
export const SAFE = { x0: 64 / DPR, x1: 940 / DPR, y0: 250 / DPR, y1: 1480 / DPR };

export const FFMPEG = process.env.FFMPEG || (() => { try { return execFileSync("python3", ["-c", "import imageio_ffmpeg as f;print(f.get_ffmpeg_exe())"]).toString().trim(); } catch { return "ffmpeg"; } })();

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".ics": "text/calendar" };

/** Serves docs/ at / and the stage at /__stage (its HTML set later through the returned object). */
export function serve(docs) {
  const S = { html: "" };
  S.server = http.createServer((q, r) => {
    const u = new URL(q.url, "http://x");
    if (u.pathname === "/__stage") { r.writeHead(200, { "Content-Type": TYPES[".html"] }); r.end(S.html); return; }
    let f = path.join(docs, decodeURIComponent(u.pathname)); if (f.endsWith("/")) f += "index.html";
    fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); r.end(d); });
  }).listen(0);
  S.base = `http://localhost:${S.server.address().port}`;
  return S;
}

/* ---------- easing (shared by Node and the page: keep in sync with EASE_JS) ---------- */
export const clamp = (p) => (p < 0 ? 0 : p > 1 ? 1 : p);
export const easeInOut = (p) => { p = clamp(p); return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; };
export const easeOut = (p) => 1 - Math.pow(1 - clamp(p), 3);
export const EASE_JS = `const clamp=(p)=>p<0?0:p>1?1:p;const inout=(p)=>{p=clamp(p);return p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2};const out=(p)=>1-Math.pow(1-clamp(p),3);const outBack=(p)=>{p=clamp(p);const c1=1.3,c3=c1+1;return 1+c3*Math.pow(p-1,3)+c1*Math.pow(p-1,2)};const lerp=(a,b,p)=>a+(b-a)*p;`;

/* ---------- the phone (the quickstart set's iPhone drawing, as in build-video.mjs) ---------- */
export const PHONE = { w: 390, vp: 710, status: 50, toolbar: 84, bezel: 12, band: 3.5, radius: 54 };
export const PHONE_OUTER_W = PHONE.w + 2 * (PHONE.bezel + PHONE.band);
export const PHONE_OUTER_H = PHONE.status + PHONE.vp + PHONE.toolbar + 2 * (PHONE.bezel + PHONE.band);
const lockSvg = `<svg class="lock" viewBox="0 0 11 13" aria-hidden="true"><rect x=".5" y="5.5" width="10" height="7" rx="1.6" fill="currentColor"/><path d="M2.7 5.6V3.9a2.8 2.8 0 0 1 5.6 0v1.7" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>`;
const statusIcons = `<span class="st-icons" aria-hidden="true"><svg width="19" height="12" viewBox="0 0 19 12"><rect x="0" y="8" width="3.2" height="4" rx=".8" fill="currentColor"/><rect x="5.2" y="5.5" width="3.2" height="6.5" rx=".8" fill="currentColor"/><rect x="10.4" y="3" width="3.2" height="9" rx=".8" fill="currentColor"/><rect x="15.6" y="0" width="3.2" height="12" rx=".8" fill="currentColor"/></svg><svg width="17" height="12" viewBox="0 0 17 12"><path d="M8.5 11.6 6.1 9.2a3.4 3.4 0 0 1 4.8 0z" fill="currentColor"/><path d="M3.7 6.8a6.8 6.8 0 0 1 9.6 0l-1.4 1.4a4.8 4.8 0 0 0-6.8 0z" fill="currentColor"/><path d="M1.2 4.3a10.4 10.4 0 0 1 14.6 0l-1.4 1.4a8.4 8.4 0 0 0-11.8 0z" fill="currentColor"/></svg><svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.6" fill="none" stroke="currentColor" stroke-opacity=".45"/><rect x="2.3" y="2.3" width="19.4" height="8.4" rx="2.2" fill="currentColor"/><path d="M25 4.4v4.2c.9-.3 1.5-1.1 1.5-2.1s-.6-1.8-1.5-2.1z" fill="currentColor" fill-opacity=".5"/></svg></span>`;
export const PHONE_CSS = `
.phone{position:absolute;left:0;top:0;transform-origin:0 0}
.phone-body{position:relative;padding:${PHONE.band}px;border-radius:${PHONE.radius + PHONE.bezel + PHONE.band}px;background:linear-gradient(150deg,#7a7e87 0%,#3a3d45 18%,#202228 50%,#3a3d45 82%,#8a8e97 100%);box-shadow:0 1px 0 rgba(255,255,255,.18) inset,0 40px 70px -28px rgba(40,30,20,.55)}
.bezel{padding:${PHONE.bezel}px;border-radius:${PHONE.radius + PHONE.bezel}px;background:#040507}
.screen{position:relative;width:${PHONE.w}px;border-radius:${PHONE.radius}px;overflow:hidden;background:var(--bg)}
.status{height:${PHONE.status}px;display:flex;align-items:center;justify-content:space-between;padding:4px 33px 0 50px;color:var(--text);background:var(--topbar-bg, var(--bg))}
.status .time{font:600 17px/1 var(--font-body)}
.st-icons{display:flex;gap:6px;align-items:center}
.island{position:absolute;top:11px;left:50%;transform:translateX(-50%);width:122px;height:35px;border-radius:18px;background:#000;z-index:5}
.vp{position:relative;width:${PHONE.w}px;height:${PHONE.vp}px;overflow:hidden;background:var(--bg)}
.vp iframe{position:absolute;left:0;top:0;width:${PHONE.w}px;height:${PHONE.vp}px;border:0;opacity:0;background:var(--bg)}
.toolbar{position:relative;height:${PHONE.toolbar}px;background:var(--surface-alt);border-top:1px solid var(--border)}
.addr{position:absolute;left:18px;right:18px;top:11px;height:44px;border-radius:22px;display:flex;align-items:center;justify-content:center;gap:7px;background:var(--surface-sunken);color:var(--text);font:500 16px/1 var(--font-body)}
.lock{width:11px;height:13px;flex:none}
.homebar{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);width:134px;height:5px;border-radius:3px;background:var(--text)}
.key{position:absolute;width:4px;border-radius:2px}
.key.l{left:-2.5px;background:linear-gradient(90deg,#2a2c32,#6a6e77)}
.key.r{right:-2.5px;background:linear-gradient(90deg,#6a6e77,#2a2c32)}
.tap{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;z-index:40;display:none}
.tap .dot{position:absolute;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(29,26,23,.28);border:2px solid rgba(255,255,255,.85);box-shadow:0 2px 10px rgba(0,0,0,.25)}
.tap .ring{position:absolute;border-radius:50%;border:3px solid rgba(29,26,23,.35)}`;
export const phoneHtml = (id, slots, { time = "7:30", host = "fritzhand.github.io" } = {}) => `<div class="phone" id="${id}"><div class="phone-body">
<i class="key l" style="top:150px;height:30px"></i><i class="key l" style="top:206px;height:58px"></i><i class="key l" style="top:276px;height:58px"></i><i class="key r" style="top:226px;height:88px"></i>
<div class="bezel"><div class="screen"><div class="status"><span class="time">${time}</span>${statusIcons}</div><div class="island"></div>
<div class="vp">${slots.map((s) => `<iframe name="${s}" id="f-${s}" src="about:blank"></iframe>`).join("")}</div>
<div class="toolbar"><div class="addr">${lockSvg}<span>${host}</span></div><div class="homebar"></div></div></div></div></div></div>`;
export const TAP_HTML = `<div class="tap" id="tap"><div class="ring"></div><div class="dot"></div></div>`;
/** the tap ripple, drawn from its progress p (0..1) — call inside window.render */
export const TAP_JS = `window.drawTap=(tp)=>{const el=document.getElementById("tap");if(!tp){el.style.display="none";return;}const p=tp.p;el.style.display="block";el.style.left=tp.x+"px";el.style.top=tp.y+"px";const dot=el.querySelector(".dot"),ring=el.querySelector(".ring");const press=p<.35?out(p/.35):1,fade=p<.55?1:1-(p-.55)/.45;dot.style.opacity=String(fade);dot.style.transform="scale("+(1.15-.2*press)+")";const r=20+46*out(Math.max(0,(p-.2)/.8));ring.style.width=ring.style.height=2*r+"px";ring.style.left=ring.style.top=-r+"px";ring.style.opacity=String(Math.max(0,.9-p)*(p>.2?1:0));};`;

/* ---------- the per-frame audits (run in the page) ---------- */
// settled = fully opaque (every ancestor's opacity multiplied) and in the same place, at the same size, as on the previous frame
export const AUDIT_JS = `window.__prev=new Map();window.audit=()=>{const S=${JSON.stringify(SAFE)};const out=[],seen=new Map();for(const el of document.querySelectorAll("[data-read]")){let e=el,op=1,hidden=false;while(e&&e.nodeType===1){const cs=getComputedStyle(e);if(cs.display==="none"||cs.visibility==="hidden"){hidden=true;break;}op*=parseFloat(cs.opacity);e=e.parentElement;}if(hidden||op<.02)continue;const r=el.getBoundingClientRect();const id=el.dataset.id||el.textContent.trim().slice(0,48);const key=[r.left,r.top,r.width,r.height].map((v)=>Math.round(v*4)/4).join(",");const still=window.__prev.get(id)===key;seen.set(id,key);const inSafe=r.left>=S.x0-.5&&r.right<=S.x1+.5&&r.top>=S.y0-.5&&r.bottom<=S.y1+.5;const cs=getComputedStyle(el);out.push({id,words:+el.dataset.read,settled:op>.985&&still,zone:el.dataset.zone||"",safe:inSafe,box:[Math.round(r.left*2),Math.round(r.top*2),Math.round(r.right*2),Math.round(r.bottom*2)],px:Math.round(parseFloat(cs.fontSize)*2)});}window.__prev=seen;return out;};`;

/** Reading-time and safe-zone report from the per-frame audit samples. */
export function auditReport(samples, fps = FPS) {
  const lines = new Map();
  for (const [i, list] of samples) for (const s of list) {
    const L = lines.get(s.id) || { id: s.id, words: s.words, settled: 0, first: i / fps, last: i / fps, unsafe: [], minPx: Infinity, zone: s.zone };
    if (s.settled) L.settled += 1 / fps;
    L.last = i / fps; L.minPx = Math.min(L.minPx, s.px);
    if (!s.safe && s.zone !== "free" && s.settled) L.unsafe.push(`${(i / fps).toFixed(2)}s ${s.box.join(",")}`);
    lines.set(s.id, L);
  }
  const need = (w) => Math.max(w <= 3 ? 0.8 : 1.2, 0.3 * w);
  const rows = [...lines.values()].map((L) => ({ ...L, need: need(L.words), ok: L.zone === "free" || L.settled + 1e-6 >= need(L.words), unsafeCount: L.unsafe.length }));
  return { rows, failures: rows.filter((r) => !r.ok || r.unsafeCount) };
}
