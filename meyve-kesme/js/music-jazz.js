// Small-band jazz composer, modelled on the reference Shorts soundtrack: a
// minor key swing led by an upright bass with chromatic approach notes,
// rootless off-beat comping, a sparse staccato vibraphone / pizzicato melody
// and a quiet kit. Three presets share it ("Gizemli Caz" is the reference
// style; the others change tempo, key, feel and lead). Seeded, deterministic.
import { mulberry32, hashSeed } from './rng.js';

const CHORD = {
  m7: [0, 3, 7, 10],
  m6: [0, 3, 7, 9],
  7: [0, 4, 7, 10],
  M7: [0, 4, 7, 11],
  m7b5: [0, 3, 6, 10],
};
// Rootless voicings (3rd, 7th, 9th or 6th) for the comping instrument.
const VOICING = {
  m7: [3, 10, 14],
  m6: [3, 9, 14],
  7: [4, 10, 14],
  M7: [4, 11, 14],
  m7b5: [3, 6, 10],
};

// Bars of [semitones above the key, quality]; two chords = two beats each.
const PROG_A = [[[0, 'm7']], [[0, 'm6']], [[5, 'm7']], [[5, 'm7']], [[0, 'm7']], [[8, '7']], [[2, 'm7b5'], [7, '7']], [[0, 'm7'], [7, '7']]];
const PROG_B = [[[5, 'm7']], [[10, '7']], [[3, 'M7']], [[8, 'M7']], [[2, 'm7b5']], [[7, '7']], [[0, 'm7']], [[2, 'm7b5'], [7, '7']]];
const BLUES = [0, 3, 5, 6, 7, 10];

// Two-bar melodic rhythms in beats: [start, length].
const MOTIFS = [
  [[0.5, 0.5], [1.5, 0.5], [2, 0.5], [3, 1.5]],
  [[0, 0.5], [0.5, 0.5], [1, 1], [2.5, 0.5], [3.5, 0.5], [4, 2]],
  [[0.5, 0.5], [1, 0.5], [1.5, 0.5], [2.5, 1], [4.5, 0.5], [5, 0.5], [5.5, 1.5]],
  [[1, 0.5], [1.5, 0.5], [2.5, 0.5], [3, 0.5], [3.5, 2]],
];
const COMP = [
  [[0, 0.6], [1.5, 0.4]],
  [[1.5, 0.4], [3.5, 0.4]],
  [[1, 0.35], [3, 0.35]],
  [[0.5, 0.4], [2.5, 0.4]],
];

// short: longest staccato note (beats); twoFeel: bass on 1 and 3 in A
// sections; kit: 'brush' (snare + ride) or 'snap' (finger snaps, ride in B only).
export const JAZZ_PRESETS = {
  jazz: {
    bpm: [142, 152], firstKey: 62, keys: [62, 60, 64, 65, 67], swing: 0.64, comp: COMP,
    leadA: 'vibes', leadB: 'jazzPizz', short: 0.42, twoFeel: false, kit: 'brush', ride: 1, pickup: 0.14,
  },
  pizzicato: {
    bpm: [154, 164], firstKey: 64, keys: [64, 57, 62, 59], swing: 0.6,
    comp: [[[3.5, 0.3]], [[1.5, 0.3], [3.5, 0.3]], [[0.5, 0.3], [2.5, 0.3]]],
    leadA: 'jazzPizz', leadB: 'vibes', pizzGain: 1.25, short: 0.3, twoFeel: true, kit: 'snap', ride: 0.8, pickup: 0.2,
  },
  noir: {
    bpm: [118, 128], firstKey: 60, keys: [60, 65, 62, 67], swing: 0.67,
    comp: [[[0, 1.6]], [[1.5, 1.8]], [[0, 0.7], [2.5, 1.3]]],
    leadA: 'vibes', leadB: 'vibes', short: 0.75, twoFeel: false, kit: 'brush', ride: 0.65, pickup: 0.08,
  },
};
export const JAZZ_KEYS = JAZZ_PRESETS.jazz.keys;

const pick = (rand, list) => list[Math.floor(rand() * list.length)];
const clampTo = (m, lo, hi) => {
  let x = m;
  while (x < lo) x += 12;
  while (x > hi) x -= 12;
  return x;
};

function bassNear(pc, prev, lo, hi) {
  let best = clampTo(pc, lo, hi);
  for (let o = -24; o <= 24; o += 12) {
    const c = pc + o;
    if (c >= lo && c <= hi && Math.abs(c - prev) < Math.abs(best - prev)) best = c;
  }
  return best;
}

// Two-feel: half notes on 1 and 3 (root, then fifth or an approach note).
function twoBar(bar, nextRoot, key, rand, prev, push) {
  const lo = key - 26;
  const hi = key - 7;
  const [deg] = bar[0];
  const root = bassNear(key + deg, prev, lo, hi);
  const second = bar.length > 1 ? bassNear(key + bar[1][0], root, lo, hi) : rand() < 0.6 ? bassNear(root + 7, root, lo, hi) : bassNear(nextRoot, root, lo, hi) + (rand() < 0.5 ? 1 : -1);
  push(0, root, 0.95, 1.7);
  push(2, second, 0.85, 1.7);
  return second;
}

// Walking bass: root on the chord's first beat, chord/scale tones in between,
// a chromatic approach into the next root.
function walkBar(bar, nextRoot, key, rand, prev, push) {
  const lo = key - 26;
  const hi = key - 7;
  let beat = 0;
  for (let c = 0; c < bar.length; c++) {
    const [deg, q] = bar[c];
    const beats = 4 / bar.length;
    const root = bassNear(key + deg, prev, lo, hi);
    const target = c + 1 < bar.length ? key + bar[c + 1][0] : nextRoot;
    const tones = CHORD[q];
    const line = [root];
    for (let b = 1; b < beats - 1; b++) line.push(bassNear(root + pick(rand, [tones[1], tones[2], tones[2], 2, tones[3] - 12]), line[b - 1], lo, hi));
    if (beats > 1) {
      const t = bassNear(target, line[line.length - 1], lo, hi);
      line.push(rand() < 0.75 ? t + (rand() < 0.5 ? 1 : -1) : bassNear(target + 7, t, lo, hi));
    }
    line.forEach((m, i) => push(beat + i, m, i === 0 ? 0.95 : 0.8 + rand() * 0.1));
    prev = line[line.length - 1];
    beat += beats;
  }
  return prev;
}

function melodyPhrase(rand, key, chordRoot, quality, startPitch, motif, lastLong, short = 0.42) {
  const lo = key + 2;
  const hi = key + 17;
  let p = clampTo(key + chordRoot + pick(rand, CHORD[quality].slice(0, 3)), lo, hi);
  if (Math.abs(p - startPitch) > 7) p = clampTo(startPitch, lo, hi);
  const notes = [];
  motif.forEach(([b, len], i) => {
    if (i > 0) {
      const steps = rand() < 0.7 ? (rand() < 0.5 ? 1 : -1) : rand() < 0.5 ? 2 : -2;
      const rel = (((p - key) % 12) + 12) % 12;
      let idx = BLUES.reduce((bi, s, k) => (Math.abs(s - rel) < Math.abs(BLUES[bi] - rel) ? k : bi), 0);
      idx += steps;
      const oct = Math.floor(idx / BLUES.length);
      p = key + 12 * (Math.floor((p - key) / 12) + oct) + BLUES[((idx % BLUES.length) + BLUES.length) % BLUES.length];
      p = clampTo(p, lo, hi);
    }
    const last = i === motif.length - 1;
    notes.push({ beat: b, len: last && lastLong ? len : Math.min(len, short), midi: p, vel: 0.7 + rand() * 0.25 });
  });
  return notes;
}

export function composeJazz({ seed = 1, duration = 60, style = 'jazz' }) {
  const P = JAZZ_PRESETS[style] || JAZZ_PRESETS.jazz;
  const id = JAZZ_PRESETS[style] ? style : 'jazz';
  const rand = mulberry32(hashSeed('music', id, seed));
  const key = seed === 1 ? P.firstKey : pick(rand, P.keys);
  const bpm = P.bpm[0] + rand() * (P.bpm[1] - P.bpm[0]);
  const beat = 60 / bpm;
  const barDur = beat * 4;
  const bars = Math.ceil(duration / barDur) + 1;
  const events = [];
  const at = (bar, b) => {
    const whole = Math.floor(b);
    const off = Math.abs(b - whole - 0.5) < 1e-6 ? P.swing : b - whole;
    return (bar * 4 + whole + off) * beat;
  };
  const motifs = [pick(rand, MOTIFS), pick(rand, MOTIFS)];
  const comp = [pick(rand, P.comp), pick(rand, P.comp)];
  let bassPrev = key - 24;
  let melPrev = key + 7;
  const form = ['A', 'A', 'B', 'A'];
  for (let bar = 0; bar < bars; bar++) {
    const body = bar - 1; // one bar of bass and kit as the intro
    const section = form[Math.floor(Math.max(0, body) / 8) % form.length];
    const prog = section === 'B' ? PROG_B : PROG_A;
    const pb = ((body % 8) + 8) % 8;
    const chords = prog[pb];
    const nextBar = (pb + 1) % 8 === 0 && section !== 'B' && form[Math.floor((body + 1) / 8) % form.length] === 'B' ? PROG_B[0] : prog[(pb + 1) % 8];
    const bassLine = P.twoFeel && section === 'A' ? twoBar : walkBar;
    bassPrev = bassLine(chords, key + nextBar[0][0], key, rand, bassPrev, (b, midi, vel, len = 0.82) => events.push({ inst: 'upright', t: at(bar, b), dur: beat * len, midi, vel }));
    if (rand() < P.pickup) events.push({ inst: 'upright', t: at(bar, 3 + 2 / 3), dur: beat * 0.25, midi: bassPrev + (rand() < 0.5 ? 2 : -1), vel: 0.45 });
    drums(events, bar, at, beat, body, rand, P, section);
    if (body < 0) continue;
    const pattern = comp[pb % 2];
    for (const [b, len] of pattern) {
      const [deg, q] = chords[b < 2 || chords.length === 1 ? 0 : 1];
      for (const iv of VOICING[q]) events.push({ inst: 'ep', t: at(bar, b), dur: beat * len, midi: clampTo(key + deg + iv, key - 4, key + 12), vel: 0.5 });
    }
    // Melody: statement (bars 0-1), answer (4-5) and a cadence (6-7) per 8.
    if (pb === 0 || pb === 4 || pb === 6) {
      const inst = section === 'B' ? P.leadB : P.leadA;
      const motif = pb === 6 ? MOTIFS[(MOTIFS.indexOf(motifs[0]) + 1) % MOTIFS.length] : motifs[pb === 4 ? 1 : 0];
      const [deg, q] = chords[0];
      const notes = melodyPhrase(rand, key, deg, q, melPrev, motif, pb !== 0, P.short);
      if (pb === 6) notes[notes.length - 1].midi = clampTo(key + (rand() < 0.5 ? 0 : 7), key + 2, key + 14);
      const double = inst === 'vibes' ? 'jazzPizz' : 'vibes';
      for (const n of notes) {
        events.push({ inst, t: at(bar, n.beat), dur: n.len * beat, midi: n.midi, vel: n.vel * (inst === 'vibes' ? 1 : P.pizzGain ?? 0.85) });
        if (section === 'A' && Math.floor(body / 8) % 4 === 3) events.push({ inst: double, t: at(bar, n.beat), dur: n.len * beat, midi: n.midi - 12, vel: n.vel * 0.35 });
      }
      melPrev = notes[notes.length - 1].midi;
    }
  }
  return { events, beat, barDur, key, bpm, style: id };
}

function drums(events, bar, at, beat, body, rand, P, section) {
  const snaps = P.kit === 'snap';
  events.push({ inst: 'sweep', t: at(bar, 0), dur: beat * 4, beat, vel: snaps ? 0.18 : 0.32 });
  for (let b = 0; b < 4; b++) events.push({ inst: 'kick', t: at(bar, b), vel: b === 0 ? 0.16 : 0.1 });
  for (const b of [1, 3]) {
    if (snaps) events.push({ inst: 'snap', t: at(bar, b), vel: 0.5 + rand() * 0.1 });
    else events.push({ inst: 'snare', t: at(bar, b), vel: 0.36 + rand() * 0.08 });
    events.push({ inst: 'hat', t: at(bar, b), vel: 0.22 });
  }
  if (body < 0 || (snaps && section !== 'B')) return;
  for (const b of [0, 1, 1.5, 2, 3, 3.5]) events.push({ inst: 'jazzRide', t: at(bar, b), vel: ((b % 1 ? 0.28 : 0.42) + rand() * 0.06) * P.ride });
}
