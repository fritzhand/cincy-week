/* ============================================================
   collateral/lib/reel-score.mjs — the original score for "The Interchange" (collateral/build-reel.mjs).

   Written to the picture (brag-plan.md "Music spec"): 120 BPM, 4/4, D major (B minor for the Night
   edition), a 0.5 s pickup, so the downbeat of bar n is at 0.5 + 2(n − 1) s. Each line is a note
   (A = D, S = F#, B = A; BF = E and F = B complete the D6/9 of the end card), the capsule is the D
   major chord, and every effect is pitched in D and sent to the same room as the music. Accents
   land at 0.5 s (the capsule), 8.5 s (night falls) and 16.5 s (the capsule again, on the mark).
   The station ticks are timed from the same easing the picture uses, so each tick lands on its pop.
   ============================================================ */
import { mix, writeWav } from "./synth.mjs";

const out = (p) => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);
/** when a head easing out from a to b over [t0, t1] passes y (the picture's own formula) */
const passT = (y, a, b, t0, t1) => { for (let i = 0; i <= 400; i++) { const p = i / 400; if (a + (b - a) * out(p) >= y - 0.01) return t0 + p * (t1 - t0); } return t1; };

// notes (MIDI)
const D1 = 26, D2 = 38, G2 = 43, A2 = 45, B1 = 35, D3 = 50, F3s = 54, G3 = 55, A3 = 57, B3 = 59, C4s = 61, D4 = 62, E4 = 64, F4s = 66, G4 = 67, A4 = 69, B4 = 71, D5 = 74, E5 = 76, F5s = 78, A5 = 81;
const BEAT = 0.5, bar = (n) => 0.5 + 2 * (n - 1);

export function score() {
  const N = [], duck = [];
  const add = (t, bus, inst, o = {}) => N.push({ t, bus, inst, ...o });
  const chord = (t, notes, dur, o = {}) => notes.forEach((m, i) => add(t + (o.strum || 0) * i, o.bus || "keys", o.inst || "keys", { midi: m, dur, pan: ((i % 2) ? -0.25 : 0.25) * (o.spread ?? 1), gain: o.gain ?? 1, bright: o.bright }));

  /* ---- S1: pickup and the capsule (0–2.5) ---- */
  add(0, "pad", "pad", { midi: D2, dur: 0.5, gain: 0.55, cutoff: 500 });                      // sub swell under the pickup
  const tue = passT(1072, 1026, 1216, 0.03, 0.5), wed = passT(1144, 1026, 1216, 0.03, 0.5);
  add(tue, "sfx", "tick", { midi: D5 + 12, gain: 0.5, pan: -0.2 });                          // station ticks, on the pops
  add(wed, "sfx", "tick", { midi: F5s + 12, gain: 0.5, pan: 0.2 });
  add(0.40, "lead", "pluck", { midi: D4, dur: 0.12, gain: 0.8, pan: -0.3 });                  // A lands on D4
  add(0.45, "lead", "pluck", { midi: F4s, dur: 0.12, gain: 0.8, pan: 0.3 });                  // S lands on F#4
  // ACCENT 1 (0.5): felt thump + struck D major + bell attack, a long room tail
  add(0.5, "sfx", "thump", { midi: D2, gain: 0.9 });
  add(0.5, "bass", "bass", { midi: D2, dur: 1.4, gain: 0.8 });
  chord(0.5, [D3, F3s, A3, D4], 1.8, { gain: 0.95 });
  add(0.5, "bells", "bell", { midi: D5, len: 2.2, gain: 0.35, index: 1.4 });
  add(0.5, "pad", "pad", { midi: D3, dur: 1.9, gain: 0.5, cutoff: 900 });
  add(0.55, "lead", "pluck", { midi: A4, dur: 0.18, gain: 0.85 });                            // B launches: A4 completes the triad
  for (const y of [1288, 1360]) add(passT(y, 1254, 1432, 0.55, 1.0), "sfx", "tick", { midi: A5 + 12, gain: 0.4, pan: 0.3 });
  add(passT(1288, 1254, 1360, 0.55, 0.85), "sfx", "tick", { midi: A5, gain: 0.3, pan: -0.3 });
  add(1.5, "sfx", "thump", { midi: D1 + 12, gain: 0.35 }); add(2.0, "sfx", "thump", { midi: D1 + 12, gain: 0.3 });   // heartbeat

  /* ---- S2: the pull-back and the named lines (2.5–6.5) ---- */
  add(2.5, "sfx", "whoosh", { dur: 0.5, from: 1800, to: 500, gain: 0.35 });                  // pull-back: air moving away
  add(2.6, "pad", "pad", { midi: B3, dur: 1.2, gain: 0.35, cutoff: 1800 }); add(2.6, "pad", "pad", { midi: E4, dur: 1.2, gain: 0.3, cutoff: 1800 });
  [[2.625, D4], [2.75, F4s], [2.875, A4], [3.0, D5]].forEach(([t, m], i) => add(t, "lead", "pluck", { midi: m, dur: 0.2, gain: 0.8, pan: -0.3 + 0.2 * i }));
  chord(bar(2), [D3, A3, D4, F4s], 2.05, { gain: 0.6, bright: 1.0 });
  add(bar(2), "bass", "bass", { midi: D2, dur: 1.95, gain: 0.55 });
  chord(bar(3), [G2 + 12, B3, D4, G4], 1.05, { gain: 0.6, bright: 1.0 }); add(bar(3), "bass", "bass", { midi: G2, dur: 0.98, gain: 0.55 });
  chord(bar(3) + 1, [A2 + 12, C4s, E4, A4], 1.05, { gain: 0.6, bright: 1.0 }); add(bar(3) + 1, "bass", "bass", { midi: A2, dur: 0.98, gain: 0.55 });
  // a quiet 8th-note arpeggio in the upper register as the lines are named (motion and air, under the reading)
  const arpS2 = [[3.25, [D5, A4, F5s, A4]], [bar(3), [D5, B4, G4, B4]], [bar(3) + 1, [E5, C4s + 12, A4, C4s + 12]]];
  for (const [t0, ns] of arpS2) for (let i = 0; i < (t0 === 3.25 ? 5 : 4); i++) add(t0 + 0.25 * i, "arp", "pluck", { midi: ns[i % 4], dur: 0.1, gain: 0.55, pan: i % 2 ? 0.35 : -0.35 });
  for (let i = 0; i < 12; i++) add(bar(3) + i * 0.125, "drums", "shaker", { gain: i % 2 ? 0.25 : 0.4, seed: 40 + i, pan: 0.35 });   // shaker 16ths, very low
  add(6.0, "sfx", "riser", { dur: 0.5, midi: D4, gain: 0.55 });                               // into the push

  /* ---- S3: the groove, three stops, night falls (6.5–12.5) ---- */
  const harm = { 4: [D2, [D3, F3s, A3, D4]], 5: [B1 + 12, [B3 - 12, D3, F3s, B3]], 6: [G2, [G3 - 12, B3 - 12, D3, G3]], 7: [A2, [A3 - 12, C4s - 12, E4 - 12, A3]], 8: [D2, [D3, F3s, A3, D4]] };
  for (let n = 4; n <= 8; n++) {
    const t0 = bar(n), [root, ch] = harm[n];
    const last = n === 8;                                                                        // bar 8: the drums and bass stop at 15.5
    chord(t0, ch, last ? 0.95 : 2.05, { gain: n === 5 ? 0.72 : 0.6, bright: 1.1 });
    chord(t0 + 0.75, ch.slice(1).map((m) => m + 12), 0.2, { gain: 0.3, bright: 1.3 });              // a light stab on the "and" of 2
    // round bass: 1 (held), the octave on the "and" of 2, 3 (held), a pickup on the "and" of 4
    add(t0, "bass", "bass", { midi: root, dur: 0.7, gain: 0.85 });
    add(t0 + 0.75, "bass", "bass", { midi: root + 12, dur: 0.2, gain: 0.45 });
    if (!last) { add(t0 + 1.0, "bass", "bass", { midi: root, dur: 0.7, gain: 0.75 }); add(t0 + 1.75, "bass", "bass", { midi: root + 7, dur: 0.2, gain: 0.5 }); }
    // the arpeggio: 8ths over the chord, an octave up
    for (let i = 0; i < (last ? 4 : 8); i++) add(t0 + 0.25 * i, "arp", "pluck", { midi: ch[[3, 1, 2, 1][i % 4]] + 12, dur: 0.1, gain: 0.5, pan: i % 2 ? 0.35 : -0.35 });
    for (let b = 0; b < 4; b++) {
      const t = t0 + b * BEAT;
      if (t >= 15.5) break;                                                                    // the drums drop out at 15.5
      if (b % 2 === 0) { add(t, "drums", "kick", { gain: 0.85 }); duck.push(t); }
      else add(t, "drums", "clap", { gain: 0.42, seed: 3 + b });
      add(t, "drums", "hat", { gain: 0.32, pan: 0.3, seed: 11 + b });
      add(t + 0.25, "drums", "hat", { gain: 0.5, pan: 0.3, seed: 17 + b, open: b === 3 });
      add(t + 0.125, "drums", "hat", { gain: 0.14, pan: -0.25, seed: 23 + b }); add(t + 0.375, "drums", "hat", { gain: 0.14, pan: -0.25, seed: 29 + b });
      add(t + 0.25, "drums", "shaker", { gain: 0.3, pan: -0.35, seed: 50 + b });
    }
  }
  add(6.5, "bells", "bell", { midi: D5, len: 1.4, gain: 0.3, index: 1.2 });                   // stop chimes: the triad again
  add(7.5, "bells", "bell", { midi: F5s, len: 1.4, gain: 0.28, index: 1.2 });
  // ACCENT 2 (8.5): chime A5 + a tuned switch click + a sub drop + the warm pad opening
  add(8.5, "bells", "bell", { midi: A5, len: 2.0, gain: 0.32, index: 1.3 });
  add(8.5, "sfx", "tap", { midi: A5, gain: 0.5 });
  add(8.5, "sfx", "thump", { midi: B1 + 12, gain: 0.7 });
  for (const m of [B3 - 12, D4, F4s]) add(8.5, "pad", "pad", { midi: m, dur: 3.5, gain: 0.45, cutoff: 600, cutoffTo: 2200, sweep: 1.0 });
  for (const m of [G3, B3, D4]) add(10.5, "pad", "pad", { midi: m, dur: 1.9, gain: 0.35, cutoff: 1600 });
  add(12.3, "sfx", "whoosh", { dur: 0.25, from: 3000, to: 5200, gain: 0.18, seed: 29 });     // paper swish: the stops leave

  /* ---- S4: the real site (12.5–16.0) ---- */
  add(12.5, "sfx", "whoosh", { dur: 0.35, from: 250, to: 900, gain: 0.35, seed: 37 });       // the phone rises
  for (const m of [A3 - 12, C4s - 12, E4 - 12]) add(12.5, "pad", "pad", { midi: m + 12, dur: 1.9, gain: 0.3, cutoff: 1500 });
  // one soft rising roll under the scroll (a texture, not a tick per card), landing on a ding at 31
  for (let i = 0; i < 16; i++) { const p = i / 15, t = 12.7 + 0.8 * (1 - Math.pow(1 - p, 1.6)); add(t, "sfx", "tick", { midi: D5 + Math.round(12 * p), gain: 0.14 + 0.12 * p, pan: -0.4 + 0.8 * p }); }
  add(13.5, "bells", "bell", { midi: A5, len: 1.2, gain: 0.3, index: 1.0 });
  add(13.75, "sfx", "tap", { midi: D5 + 12, gain: 0.55, seed: 9 });                            // the star tap
  add(13.75, "lead", "pluck", { midi: D5, dur: 0.1, gain: 0.7 }); add(13.875, "lead", "pluck", { midi: A5, dur: 0.2, gain: 0.7 });   // "added"
  for (const m of [D4, F4s, A4]) add(13.8, "pad", "pad", { midi: m, dur: 1.6, gain: 0.3, cutoff: 1400 });   // swell under the push
  for (const m of [D3, A3, F4s]) add(15.5, "pad", "pad", { midi: m, dur: 0.5, gain: 0.3, cutoff: 900 });    // the tail as the drums stop

  /* ---- S5: the mark (16.0–18.5) ---- */
  [[16.0, D4], [16.125, F4s], [16.25, A4]].forEach(([t, m], i) => add(t, "lead", "pluck", { midi: m, dur: 0.15, gain: 0.8, pan: -0.3 + 0.3 * i }));
  // ACCENT 3 (16.5): the hook's chord again, no drums
  add(16.5, "sfx", "thump", { midi: D2, gain: 0.9 });
  add(16.5, "bass", "bass", { midi: D2, dur: 1.9, gain: 0.8 });
  chord(16.5, [D3, F3s, A3, D4], 2.0, { gain: 0.95 });
  add(16.5, "bells", "bell", { midi: D5, len: 2.6, gain: 0.35, index: 1.4 });
  for (const m of [D3, A3, D4]) add(16.5, "pad", "pad", { midi: m, dur: 2.0, gain: 0.4, cutoff: 1100 });
  [[16.75, A4], [17.0, F4s], [17.25, E4], [17.5, D4]].forEach(([t, m]) => add(t, "lead", "pluck", { midi: m, dur: 0.2, gain: 0.7 }));   // the four words

  /* ---- S6: the end card (18.5–22.0) ---- */
  chord(18.5, [D3, A3, D4, F4s, B4, E5], 2.9, { gain: 0.8, strum: 0.02, bright: 0.7 });     // D6/9: all five lines
  add(18.5, "bass", "bass", { midi: D2, dur: 2.6, gain: 0.6 });
  for (const m of [D3, A3, F4s, B4]) add(18.5, "pad", "pad", { midi: m, dur: 2.2, gain: 0.35, cutoff: 1300 });
  add(18.9, "sfx", "whoosh", { dur: 0.4, from: 2500, to: 6000, gain: 0.12, seed: 41 });       // the river rule draws: a soft shimmer
  [D4, F4s, A4, B4, E5].forEach((m, i) => add(19.0 + 0.06 * i, "lead", "pluck", { midi: m + 12, dur: 0.12, gain: 0.45, pan: -0.4 + 0.2 * i }));   // five bullets
  for (const m of [D3, A3, D4, F4s]) add(20.5, "pad", "pad", { midi: m, dur: 0.6, gain: 0.3, cutoff: 1000 });

  return {
    seconds: 22, fadeOut: 1.4, duckKeys: duck, notes: N,
    buses: {
      drums: { gain: 0.8, send: 0.06, hp: 35 },
      bass: { gain: 0.8, duck: 0.45, lp: 900 },
      keys: { gain: 0.66, send: 0.26, duck: 0.2, hp: 170 },
      pad: { gain: 0.32, send: 0.38, duck: 0.35, hp: 240 },
      lead: { gain: 0.62, send: 0.3, hp: 250 },
      arp: { gain: 0.36, send: 0.35, hp: 450, duck: 0.2 },
      bells: { gain: 0.42, send: 0.4, hp: 300, lp: 7000 },
      sfx: { gain: 0.5, send: 0.22, lp: 8000 },
    },
    room: { size: 0.8, damp: 0.4, predelay: 0.02 }, presence: 6, presenceHz: 2000,
  };
}

export function renderScore(file) {
  const s = score();
  const [L, R] = mix(s);
  writeWav(file, L, R);
  let pk = 0; for (let i = 0; i < L.length; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
  return { file, seconds: L.length / 48000, notes: s.notes.length, peak: +pk.toFixed(3) };
}
