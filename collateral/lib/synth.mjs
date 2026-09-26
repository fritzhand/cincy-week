/* ============================================================
   collateral/lib/synth.mjs — a small, deterministic synthesizer for the Reel's soundtrack.

   No samples, no downloads: every sound is computed here, so the score is original and the
   render is the same bit for bit every time (the noise comes from a seeded PRNG). A score is a
   list of notes and effects placed on buses; `mix()` renders the buses, sends them through one
   shared room (a Freeverb), ducks the bed under the kick, glues the sum with a gentle bus
   compressor and a soft ceiling, and returns stereo Float32Arrays. `writeWav()` writes 32-bit
   float WAV for ffmpeg to loudness-normalize and encode.
   ============================================================ */
import fs from "node:fs";

export const SR = 48000;
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const TAU = Math.PI * 2;

/* ---------- deterministic noise ---------- */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1; };
}

/* ---------- filters (RBJ biquads, per-sample settable) ---------- */
export class Biquad {
  constructor(type = "lp", f = 1000, q = 0.707) { this.type = type; this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set(f, q); }
  set(f, q = this.q) {
    this.f = f; this.q = q;
    const w = (TAU * Math.min(f, SR * 0.45)) / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q);
    let b0, b1, b2, a0, a1, a2;
    if (this.type === "lp") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
    else if (this.type === "hp") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
    else { b0 = al; b1 = 0; b2 = -al; }                       // "bp": constant 0 dB peak gain
    a0 = 1 + al; a1 = -2 * c; a2 = 1 - al;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  run(x) { const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2; this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y; }
}

/* ---------- envelopes and oscillators ---------- */
const expDecay = (t, tau) => Math.exp(-t / tau);
/** attack (linear), then exponential decay toward `sustain`, released after `hold` seconds */
function adsr(t, { a = 0.005, d = 0.3, s = 0, hold = Infinity, r = 0.2 }) {
  let v = t < a ? t / a : s + (1 - s) * expDecay(t - a, d);
  if (t > hold) v *= expDecay(t - hold, r / 4.6);           // -40 dB after r seconds
  return v;
}
function blep(t, dt) { if (t < dt) { t /= dt; return t + t - t * t - 1; } if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; } return 0; }
function sawOsc(freq, phase0 = 0) { let p = phase0; const dt = freq / SR; return () => { const v = 2 * p - 1 - blep(p, dt); p += dt; if (p >= 1) p -= 1; return v; }; }

/* ---------- instruments: each returns a mono Float32Array (the note's full length) ---------- */
export const I = {
  kick({ vel = 1 } = {}) {
    const n = Math.round(SR * 0.42), o = new Float32Array(n), R = rng(7); let ph = 0;
    const hp = new Biquad("hp", 1800, 0.7);
    for (let i = 0; i < n; i++) {
      const t = i / SR, f = 46 + 84 * expDecay(t, 0.045);
      ph += (TAU * f) / SR;
      const body = Math.sin(ph) * expDecay(t, 0.19) * (t < 0.002 ? t / 0.002 : 1);
      const click = hp.run(R()) * expDecay(t, 0.004) * 0.35;
      o[i] = Math.tanh(1.6 * (body + click)) * 0.9 * vel;
    }
    return o;
  },
  clap({ vel = 1, seed = 3 } = {}) {
    const n = Math.round(SR * 0.5), o = new Float32Array(n), R = rng(seed);
    const bp = new Biquad("bp", 1250, 0.9), hp = new Biquad("hp", 650, 0.7);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let e = 0; for (const k of [0, 0.011, 0.022]) if (t >= k) e = Math.max(e, expDecay(t - k, 0.007));
      e = Math.max(e, (t >= 0.03 ? 0.55 * expDecay(t - 0.03, 0.11) : 0));
      o[i] = hp.run(bp.run(R())) * e * 1.6 * vel;
    }
    return o;
  },
  hat({ vel = 1, open = false, seed = 11 } = {}) {
    const len = open ? 0.36 : 0.07, n = Math.round(SR * len), o = new Float32Array(n), R = rng(seed);
    const hp = new Biquad("hp", 7200, 0.8), lp = new Biquad("lp", 12500, 0.6);   // dark hats: nothing spiky
    for (let i = 0; i < n; i++) { const t = i / SR; o[i] = lp.run(hp.run(R())) * expDecay(t, open ? 0.09 : 0.016) * 0.55 * vel; }
    return o;
  },
  shaker({ vel = 1, seed = 19 } = {}) {
    const n = Math.round(SR * 0.12), o = new Float32Array(n), R = rng(seed), bp = new Biquad("bp", 5200, 1.3);
    for (let i = 0; i < n; i++) { const t = i / SR, e = t < 0.02 ? t / 0.02 : expDecay(t - 0.02, 0.03); o[i] = bp.run(R()) * e * 0.5 * vel; }
    return o;
  },
  bass({ midi, dur, vel = 1 }) {
    const f = mtof(midi), n = Math.round(SR * (dur + 0.25)), o = new Float32Array(n), saw = sawOsc(f), lp = new Biquad("lp", 420, 0.9); let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR; ph += (TAU * f) / SR;
      lp.set(260 + 900 * expDecay(t, 0.09), 0.9);
      const e = adsr(t, { a: 0.004, d: 0.5, s: 0.55, hold: dur, r: 0.09 });
      o[i] = (Math.sin(ph) * 0.85 + lp.run(saw()) * 0.38) * e * 0.8 * vel;
    }
    return o;
  },
  /** electric piano: two-operator FM with a decaying index and a faint tine */
  keys({ midi, dur, vel = 1, bright = 1 }) {
    const f = mtof(midi), n = Math.round(SR * (dur + 1.1)), o = new Float32Array(n); let pc = 0, pm = 0, pt = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      pm += (TAU * f) / SR; pt += (TAU * f * 7.02) / SR;
      const idx = (0.35 + 1.9 * expDecay(t, 0.22)) * bright;
      pc += (TAU * f) / SR;
      const v = Math.sin(pc + idx * Math.sin(pm)) + 0.06 * Math.sin(pt) * expDecay(t, 0.05);
      o[i] = v * adsr(t, { a: 0.003, d: 1.1, s: 0.12, hold: dur, r: 0.35 }) * 0.32 * vel;
    }
    return o;
  },
  /** warm pad: three detuned saws, low-passed, slow attack */
  pad({ midi, dur, vel = 1, cutoff = 1300 }) {
    const f = mtof(midi), n = Math.round(SR * (dur + 1.2)), o = new Float32Array(n);
    const oscs = [sawOsc(f * 0.9965, 0.1), sawOsc(f, 0.43), sawOsc(f * 1.0035, 0.77)], lp = new Biquad("lp", cutoff, 0.6);
    for (let i = 0; i < n; i++) {
      const t = i / SR, e = adsr(t, { a: 0.35, d: 2.5, s: 0.8, hold: dur, r: 1.0 });
      o[i] = lp.run((oscs[0]() + oscs[1]() + oscs[2]()) / 3) * e * 0.22 * vel;
    }
    return o;
  },
  /** glassy bell: FM at 3.5:1, for accents, the star and the logo */
  bell({ midi, vel = 1, len = 1.8, ratio = 3.5, index = 2.2 }) {
    const f = mtof(midi), n = Math.round(SR * len), o = new Float32Array(n); let pc = 0, pm = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR; pm += (TAU * f * ratio) / SR; pc += (TAU * f) / SR;
      o[i] = Math.sin(pc + index * expDecay(t, 0.35) * Math.sin(pm)) * adsr(t, { a: 0.002, d: len / 3.2, s: 0 }) * 0.3 * vel;
    }
    return o;
  },
  /** soft pluck (lead line) */
  pluck({ midi, dur = 0.25, vel = 1 }) {
    const f = mtof(midi), n = Math.round(SR * (dur + 0.6)), o = new Float32Array(n), saw = sawOsc(f), lp = new Biquad("lp", 2400, 0.8); let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR; ph += (TAU * f) / SR; lp.set(700 + 3200 * expDecay(t, 0.06), 0.8);
      o[i] = (lp.run(saw()) * 0.55 + Math.sin(ph) * 0.45) * adsr(t, { a: 0.002, d: 0.22, s: 0.15, hold: dur, r: 0.25 }) * 0.3 * vel;
    }
    return o;
  },

  /* ---------- sound effects, tuned to the score's key ---------- */
  /** a finger tap on glass: a short pitched blip and a soft transient */
  tap({ midi = 84, vel = 1, seed = 5 }) {
    const f = mtof(midi), n = Math.round(SR * 0.16), o = new Float32Array(n), R = rng(seed), bp = new Biquad("bp", 2600, 1.1); let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / SR; ph += (TAU * f) / SR; o[i] = (Math.sin(ph) * expDecay(t, 0.028) * 0.5 + bp.run(R()) * expDecay(t, 0.004) * 0.45) * vel; }
    return o;
  },
  /** a key press (typing), randomized per key by the seed */
  key({ vel = 1, seed = 1 }) {
    const n = Math.round(SR * 0.06), o = new Float32Array(n), R = rng(seed), r0 = (R() + 1) / 2;
    const bp = new Biquad("bp", 1700 + 1400 * r0, 1.4), lp = new Biquad("lp", 5200, 0.7);
    for (let i = 0; i < n; i++) { const t = i / SR; o[i] = lp.run(bp.run(R())) * (expDecay(t, 0.006) + 0.25 * expDecay(t, 0.02)) * 1.1 * vel; }
    return o;
  },
  /** a tick for a count-up, pitched */
  tick({ midi = 96, vel = 1 }) {
    const f = mtof(midi), n = Math.round(SR * 0.05), o = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / SR; ph += (TAU * f) / SR; o[i] = Math.sin(ph) * expDecay(t, 0.009) * 0.35 * vel; }
    return o;
  },
  /** air moving: band-passed noise swept up (or down), for pushes and wipes */
  whoosh({ dur = 0.45, from = 350, to = 3200, vel = 1, seed = 23 }) {
    const n = Math.round(SR * (dur + 0.15)), o = new Float32Array(n), R = rng(seed), bp = new Biquad("bp", from, 0.9), lp = new Biquad("lp", 6000, 0.7);
    for (let i = 0; i < n; i++) {
      const t = i / SR, p = Math.min(1, t / dur);
      bp.set(from * Math.pow(to / from, p), 0.9);
      const e = Math.sin(Math.PI * Math.min(1, p)) ** 1.6 * (t > dur ? expDecay(t - dur, 0.04) : 1);
      o[i] = lp.run(bp.run(R())) * e * 0.9 * vel;
    }
    return o;
  },
  /** a low, round landing under a big reveal (a sine drop, no crack) */
  thump({ midi = 36, vel = 1 }) {
    const n = Math.round(SR * 0.7), o = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / SR, f = mtof(midi) * (1 + 0.8 * expDecay(t, 0.03)); ph += (TAU * f) / SR; o[i] = Math.sin(ph) * adsr(t, { a: 0.003, d: 0.22, s: 0 }) * 0.8 * vel; }
    return o;
  },
  /** a rising swell into a downbeat: filtered noise plus a climbing tone, ends exactly at `dur` */
  riser({ dur = 1.2, midi = 60, vel = 1, seed = 31 }) {
    const n = Math.round(SR * dur), o = new Float32Array(n), R = rng(seed), bp = new Biquad("bp", 400, 1.2); let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR, p = t / dur; bp.set(400 * Math.pow(12, p), 1.2);
      ph += (TAU * mtof(midi) * Math.pow(2, p)) / SR;
      o[i] = (bp.run(R()) * 0.8 + Math.sin(ph) * 0.12) * p ** 2.2 * vel * 0.6;
    }
    return o;
  },
};

/* ---------- Freeverb (Jezar's tunings, scaled to 48 kHz) ---------- */
class Comb { constructor(n) { this.b = new Float32Array(n); this.i = 0; this.s = 0; } run(x, fb, damp) { const y = this.b[this.i]; this.s = y * (1 - damp) + this.s * damp; this.b[this.i] = x + this.s * fb; if (++this.i >= this.b.length) this.i = 0; return y; } }
class AP { constructor(n) { this.b = new Float32Array(n); this.i = 0; } run(x) { const b = this.b[this.i], y = -x + b; this.b[this.i] = x + b * 0.5; if (++this.i >= this.b.length) this.i = 0; return y; } }
export function reverb(L, R, { size = 0.78, damp = 0.35, width = 1, predelay = 0.018 } = {}) {
  const k = SR / 44100, sp = 23, CT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], AT = [556, 441, 341, 225];
  const mk = (off) => ({ c: CT.map((n) => new Comb(Math.round((n + off) * k))), a: AT.map((n) => new AP(Math.round((n + off) * k))) });
  const l = mk(0), r = mk(sp), n = L.length, pd = Math.round(predelay * SR);
  const oL = new Float32Array(n), oR = new Float32Array(n), fb = size * 0.28 + 0.7;
  for (let i = 0; i < n; i++) {
    const x = ((i >= pd ? L[i - pd] + R[i - pd] : 0)) * 0.015;
    let a = 0, b = 0; for (const c of l.c) a += c.run(x, fb, damp); for (const c of r.c) b += c.run(x, fb, damp);
    for (const p of l.a) a = p.run(a); for (const p of r.a) b = p.run(b);
    oL[i] = a * (0.5 + width / 2) + b * (0.5 - width / 2); oR[i] = b * (0.5 + width / 2) + a * (0.5 - width / 2);
  }
  return [oL, oR];
}

/* ---------- the mix ---------- */
/**
 * score: { seconds, buses: { name: { gain, send (reverb), duck (0..1 depth under the kick), hp (Hz), lp (Hz) } },
 *          notes: [{ t, bus, inst, pan (-1..1), gain, ...instrument params }], duckKeys: [t…] }
 */
export function mix(score) {
  const N = Math.round(SR * score.seconds);
  const bus = {};
  for (const [name, b] of Object.entries(score.buses)) bus[name] = { ...b, L: new Float32Array(N), R: new Float32Array(N) };
  for (const n of score.notes) {
    const b = bus[n.bus]; if (!b) throw new Error(`no bus ${n.bus}`);
    const buf = I[n.inst](n), i0 = Math.round(n.t * SR), g = n.gain ?? 1, pan = n.pan ?? 0;
    const gl = g * Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2, gr = g * Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2;
    for (let i = 0; i < buf.length && i0 + i < N; i++) if (i0 + i >= 0) { b.L[i0 + i] += buf[i] * gl; b.R[i0 + i] += buf[i] * gr; }
  }
  // sidechain: a smooth dip after every key time (the kick), depth per bus
  const duckEnv = new Float32Array(N).fill(0);
  for (const t of score.duckKeys || []) { const i0 = Math.round(t * SR); for (let i = 0; i < SR * 0.32 && i0 + i < N; i++) { const x = i / SR, v = x < 0.008 ? x / 0.008 : Math.exp(-(x - 0.008) / 0.11); duckEnv[i0 + i] = Math.max(duckEnv[i0 + i], v); } }
  const sendL = new Float32Array(N), sendR = new Float32Array(N), outL = new Float32Array(N), outR = new Float32Array(N);
  for (const b of Object.values(bus)) {
    const hpL = b.hp ? new Biquad("hp", b.hp, 0.7) : null, hpR = b.hp ? new Biquad("hp", b.hp, 0.7) : null;
    const lpL = b.lp ? new Biquad("lp", b.lp, 0.7) : null, lpR = b.lp ? new Biquad("lp", b.lp, 0.7) : null;
    for (let i = 0; i < N; i++) {
      let l = b.L[i], r = b.R[i];
      if (hpL) { l = hpL.run(l); r = hpR.run(r); } if (lpL) { l = lpL.run(l); r = lpR.run(r); }
      const g = (b.gain ?? 1) * (1 - (b.duck || 0) * duckEnv[i]);
      l *= g; r *= g; outL[i] += l; outR[i] += r; sendL[i] += l * (b.send || 0); sendR[i] += r * (b.send || 0);
    }
  }
  const [wl, wr] = reverb(sendL, sendR, score.room || {});
  // master: add the room, then a 30 Hz high-pass (phones can't play below it and it only eats headroom)
  const mhL = new Biquad("hp", 30, 0.7), mhR = new Biquad("hp", 30, 0.7);
  for (let i = 0; i < N; i++) { outL[i] = mhL.run(outL[i] + wl[i]); outR[i] = mhR.run(outR[i] + wr[i]); }
  // bus compressor (feed-forward, RMS, 2:1 over -16 dBFS) and a soft ceiling
  let env = 0; const att = Math.exp(-1 / (0.012 * SR)), rel = Math.exp(-1 / (0.15 * SR)), thr = Math.pow(10, -16 / 20);
  for (let i = 0; i < N; i++) {
    const x = Math.max(Math.abs(outL[i]), Math.abs(outR[i])); env = x > env ? att * env + (1 - att) * x : rel * env + (1 - rel) * x;
    const gr = env > thr ? Math.pow(env / thr, 1 / 2 - 1) : 1;
    outL[i] = Math.tanh(outL[i] * gr * 1.1) / 1.1; outR[i] = Math.tanh(outR[i] * gr * 1.1) / 1.1;
  }
  // fades: in over 20 ms, out over the score's `fadeOut` seconds
  const fo = Math.round((score.fadeOut ?? 0.6) * SR), fi = Math.round(0.02 * SR);
  for (let i = 0; i < fi; i++) { outL[i] *= i / fi; outR[i] *= i / fi; }
  for (let i = 0; i < fo; i++) { const j = N - fo + i, g = Math.cos((i / fo) * Math.PI / 2); outL[j] *= g; outR[j] *= g; }
  return [outL, outR];
}

/** 32-bit float stereo WAV */
export function writeWav(file, L, R) {
  const n = L.length, data = Buffer.alloc(n * 8);
  for (let i = 0; i < n; i++) { data.writeFloatLE(L[i], i * 8); data.writeFloatLE(R[i], i * 8 + 4); }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8); h.write("fmt ", 12); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(3, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 8, 28); h.writeUInt16LE(8, 32); h.writeUInt16LE(32, 34);
  h.write("data", 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
}
