// Generative background music: a small composer (chord progressions,
// motif-based melodies, accompaniment patterns) and synthesized instruments.
// The default "sneaky jazz" style is mastered clean with a small room; the
// vintage styles go through a gramophone chain (band limit, saturation,
// wow & flutter, crackle). Pure JS, runs in the worker, copyright free.
import { mulberry32, hashSeed } from './rng.js';
import { filter, SAMPLE_RATE } from './sfx.js';
import { INSTRUMENTS } from './music-instruments.js';
import { composeJazz } from './music-jazz.js';

const SR = SAMPLE_RATE;
const TAU = Math.PI * 2;

export const MUSIC_STYLES = [
  { id: 'jazz', tr: 'Gizemli Caz', en: 'Sneaky Jazz' },
  { id: 'waltz', tr: 'Gramofon Valsi', en: 'Gramophone Waltz' },
  { id: 'swing', tr: 'Kafe Caz', en: 'Café Swing' },
  { id: 'baroque', tr: 'Barok Çay Saati', en: 'Baroque Tea Time' },
  { id: 'musette', tr: 'Paris Musette', en: 'Paris Musette' },
];

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 11];
const QUALITY = { M: [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], dim: [0, 3, 6] };

const STYLES = {
  waltz: {
    meter: 3, bpm: [92, 104], keys: [65, 70, 67, 62], scale: MAJOR,
    prog: [[0, 'M'], [5, 'm'], [1, 'm'], [4, '7'], [0, 'M'], [3, 'M'], [1, 'm7'], [4, '7']],
    progB: [[3, 'M'], [0, 'M'], [1, 'm7'], [4, '7'], [5, 'm'], [1, 'm'], [4, '7'], [0, 'M']],
    lead: 'oboe', counter: 'clarinet', bass: 'pizz', chords: 'harp',
  },
  swing: {
    meter: 4, bpm: [112, 124], keys: [60, 65, 67, 70], scale: MAJOR, swing: true,
    prog: [[0, 'M7'], [5, 'm7'], [1, 'm7'], [4, '7'], [2, 'm7'], [5, '7'], [1, 'm7'], [4, '7']],
    progB: [[3, 'M7'], [3, 'm7'], [0, 'M7'], [5, '7'], [1, 'm7'], [4, '7'], [0, 'M7'], [4, '7']],
    lead: 'oboe', counter: 'clarinet', bass: 'walk', chords: 'ep', drums: true,
  },
  baroque: {
    meter: 4, bpm: [90, 98], keys: [62, 67, 65, 69], scale: MAJOR,
    prog: [[0, 'M'], [3, 'M'], [6, 'dim'], [2, 'm'], [5, 'm'], [1, 'm'], [4, '7'], [0, 'M']],
    progB: [[5, 'm'], [1, 'm'], [4, '7'], [0, 'M'], [3, 'M'], [1, 'm'], [4, '7'], [0, 'M']],
    lead: 'oboe', counter: 'bassoon', bass: 'cello', chords: 'harpsichord',
  },
  musette: {
    meter: 3, bpm: [136, 150], keys: [57, 62, 64], scale: MINOR,
    prog: [[0, 'm'], [0, 'm'], [3, 'm'], [3, 'm'], [4, '7'], [4, '7'], [0, 'm'], [0, 'm']],
    progB: [[5, 'M'], [5, 'M'], [3, 'm'], [0, 'm'], [1, 'dim'], [4, '7'], [0, 'm'], [4, '7']],
    lead: 'accordion', counter: 'oboe', bass: 'pizz', chords: 'guitar',
  },
};

// ---------- composition ----------
function chordNotes(key, scale, [deg, q]) {
  const root = key + scale[deg % 7] + 12 * Math.floor(deg / 7);
  return QUALITY[q].map((iv) => root + iv);
}

function nearestIn(pitches, target, lo, hi) {
  let best = target;
  let bd = Infinity;
  for (const p of pitches) {
    for (let o = -36; o <= 36; o += 12) {
      const c = p + o;
      if (c < lo || c > hi) continue;
      const d = Math.abs(c - target);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
  }
  return best;
}

function scaleStep(key, scale, pitch, steps) {
  const rel = (((pitch - key) % 12) + 12) % 12;
  let idx = scale.findIndex((s) => s >= rel);
  if (idx < 0) idx = 0;
  let octave = Math.floor((pitch - key) / 12);
  idx += steps;
  octave += Math.floor(idx / 7);
  idx = ((idx % 7) + 7) % 7;
  return key + octave * 12 + scale[idx];
}

const RHYTHMS = {
  3: [[2, 1], [1, 1, 1], [1.5, 0.5, 1], [1, 2], [0.5, 0.5, 1, 1]],
  4: [[1, 1, 1, 1], [1.5, 0.5, 2], [0.5, 0.5, 1, 2], [2, 1, 1], [1, 0.5, 0.5, 2], [1.5, 0.5, 1, 1]],
};

function phraseMelody(st, key, prog, rand, range) {
  const notes = [];
  let pitch = key + st.scale[2] + 7;
  for (let bar = 0; bar < 8; bar++) {
    const chord = chordNotes(key, st.scale, prog[bar]);
    const cadence = bar === 3 || bar === 7;
    const rhythm = cadence ? [st.meter] : RHYTHMS[st.meter][Math.floor(rand() * RHYTHMS[st.meter].length)];
    let beat = 0;
    rhythm.forEach((dur, i) => {
      if (i === 0 || cadence || rand() < 0.35) pitch = nearestIn(chord, pitch + Math.round((rand() - 0.5) * 6), range[0], range[1]);
      else pitch = Math.max(range[0], Math.min(range[1], scaleStep(key, st.scale, pitch, rand() < 0.5 ? 1 : -1) + (rand() < 0.15 ? 2 : 0)));
      if (bar === 7) pitch = nearestIn([chord[0]], pitch, range[0], range[1]);
      notes.push({ bar, beat, dur, midi: pitch, vel: i === 0 ? 1 : 0.85 });
      beat += dur;
    });
  }
  return notes;
}

export function compose({ style = 'jazz', seed = 1, duration = 60 }) {
  if (style === 'jazz' || !STYLES[style]) return composeJazz({ seed, duration });
  const st = STYLES[style];
  const rand = mulberry32(hashSeed('music', style, seed));
  const key = st.keys[Math.floor(rand() * st.keys.length)];
  const bpm = st.bpm[0] + rand() * (st.bpm[1] - st.bpm[0]);
  const beat = 60 / bpm;
  const barDur = beat * st.meter;
  const bars = Math.ceil(duration / barDur) + 1;
  const range = [key - 2, key + 16];
  const melA = phraseMelody(st, key, st.prog, rand, range);
  const melB = phraseMelody(st, key, st.progB, rand, range);
  const melA2 = melA.filter((n) => n.bar < 6).concat(phraseMelody(st, key, st.prog, rand, range).filter((n) => n.bar >= 6));
  const form = [['A', melA, st.prog], ['A', melA2, st.prog], ['B', melB, st.progB], ['A', melA2, st.prog]];
  const events = [];
  const swingT = (b) => (st.swing && Math.abs((b % 1) - 0.5) < 1e-6 ? b + 1 / 6 : b);
  const at = (bar, b) => (bar * st.meter + swingT(b)) * beat;
  const intro = 1;
  for (let bar = 0; bar < bars; bar++) {
    const body = bar - intro;
    const [section, melody, prog] = form[Math.floor(Math.max(0, body) / 8) % form.length];
    const pb = ((body % 8) + 8) % 8;
    const chord = chordNotes(key, st.scale, prog[pb]);
    if (body >= 0) {
      for (const n of melody) if (n.bar === pb) events.push({ inst: st.lead, t: at(bar, n.beat), dur: n.dur * beat * 0.95, midi: n.midi, vel: n.vel * 0.9 });
      if (section === 'B') events.push({ inst: st.counter, t: at(bar, 0), dur: barDur * 0.98, midi: nearestIn([chord[1], chord[chord.length - 1]], key, key - 5, key + 9), vel: 0.45 });
    }
    accompany(st, events, chord, bar, at, beat, rand, prog[(pb + 1) % 8], key);
  }
  return { events, beat, barDur, key, bpm, style };
}

function accompany(st, ev, chord, bar, at, beat, rand, next, key) {
  const root = nearestIn([chord[0]], key - 12, key - 22, key - 6);
  if (st.bass === 'walk') {
    const nextRoot = nearestIn([chordNotes(key, st.scale, next)[0]], root, key - 22, key - 6);
    const line = [root, nearestIn([chord[1], chord[2]], root + 4, key - 24, key - 2), nearestIn([chord[2]], root + 7, key - 24, key - 2), nextRoot + (rand() < 0.5 ? 1 : -1)];
    line.forEach((m, i) => ev.push({ inst: 'bass', t: at(bar, i), dur: beat * 0.9, midi: m, vel: i === 0 ? 0.95 : 0.8 }));
  } else if (st.bass === 'cello') {
    ev.push({ inst: 'cello', t: at(bar, 0), dur: beat * 1.6, midi: root, vel: 0.9 });
    ev.push({ inst: 'cello', t: at(bar, 2), dur: beat * 1.6, midi: root + 7, vel: 0.75 });
  } else {
    ev.push({ inst: 'bass', t: at(bar, 0), dur: beat * 1.5, midi: bar % 2 ? root + 7 : root, vel: 0.9 });
  }
  const voicing = chord.map((m) => nearestIn([m], key + 2, key - 3, key + 12)).sort((a, b) => a - b);
  if (st.chords === 'ep') {
    for (const b of [1.5, 3]) voicing.forEach((m) => ev.push({ inst: 'ep', t: at(bar, b), dur: beat * 0.7, midi: m, vel: 0.45 }));
  } else if (st.chords === 'harpsichord') {
    const arp = [voicing[0], voicing[1], voicing[2], voicing[0] + 12, voicing[2], voicing[1], voicing[0], voicing[1]];
    arp.forEach((m, i) => ev.push({ inst: 'harpsichord', t: at(bar, i * 0.5), dur: beat * 0.6, midi: m, vel: 0.5 }));
  } else {
    for (let b = 1; b < st.meter; b++) voicing.forEach((m, i) => ev.push({ inst: st.chords, t: at(bar, b) + i * 0.012, dur: beat * 0.8, midi: m, vel: 0.42 }));
  }
  if (st.drums) {
    for (let b = 0; b < 4; b++) ev.push({ inst: 'ride', t: at(bar, b), dur: 0.1, vel: b % 2 ? 0.5 : 0.35 });
    for (const b of [1.5, 3.5]) ev.push({ inst: 'ride', t: at(bar, b), dur: 0.08, vel: 0.3 });
    for (const b of [1, 3]) ev.push({ inst: 'brush', t: at(bar, b), dur: 0.25, vel: 0.5 });
  }
}

const PAN = { oboe: 0.15, clarinet: -0.3, bassoon: -0.25, accordion: 0.1, pizz: -0.1, bass: -0.1, cello: -0.15, harp: 0.35, guitar: 0.3, harpsichord: 0.3, ep: -0.25, ride: 0.4, brush: -0.2, upright: 0, vibes: 0.28, jazzPizz: 0.2, jazzRide: 0.35, snare: -0.12, hat: 0.25, kick: 0, sweep: -0.18 };

// ---------- gramophone ----------
function gramophone(L, R, rand) {
  const n = L.length;
  for (const ch of [L, R]) {
    filter(ch, 'highpass', 110, 0.7);
    filter(ch, 'lowpass', 5200, 0.75);
    for (let i = 0; i < n; i++) ch[i] = Math.tanh(ch[i] * 1.5) / Math.tanh(1.5);
  }
  const outL = new Float32Array(n);
  const outR = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const d = (0.006 + 0.0013 * Math.sin(TAU * 0.55 * t) + 0.00022 * Math.sin(TAU * 7.3 * t)) * SR;
    const p = i - d;
    const k = Math.floor(p);
    if (k < 0) continue;
    const fr = p - k;
    const l = L[k] + (L[k + 1] - L[k]) * fr;
    const r = R[k] + (R[k + 1] - R[k]) * fr;
    const mono = (l + r) * 0.5;
    outL[i] = mono * 0.8 + l * 0.2;
    outR[i] = mono * 0.8 + r * 0.2;
  }
  const hiss = new Float32Array(n);
  for (let i = 0; i < n; i++) hiss[i] = (rand() * 2 - 1) * 0.012;
  filter(hiss, 'bandpass', 3000, 0.6);
  const clicks = Math.floor((n / SR) * 9);
  for (let c = 0; c < clicks; c++) {
    const at = Math.floor(rand() * (n - 64));
    const amp = (rand() ** 4) * 0.35 * (rand() < 0.5 ? -1 : 1);
    for (let i = 0; i < 24; i++) hiss[at + i] += amp * (1 - i / 24) * (rand() * 2 - 1);
  }
  for (let i = 0; i < n; i++) {
    const thump = 0.004 * Math.sin(TAU * 1.3 * (i / SR)) ** 16;
    outL[i] += hiss[i] + thump;
    outR[i] += hiss[i] * 0.9 + thump;
  }
  return [outL, outR];
}

// Clean master for the jazz style: rumble filter, gentle top roll-off, a
// small Schroeder room and soft saturation.
const COMBS = [1116, 1188, 1277, 1356];
const ALLPASS = [556, 441];
function room(L, R, wet = 0.14) {
  const n = L.length;
  const process = (src, spread) => {
    const out = new Float32Array(n);
    for (const d0 of COMBS) {
      const d = Math.round((d0 + spread) * (SR / 44100));
      const buf = new Float32Array(d);
      let idx = 0;
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const y = buf[idx];
        lp = y * 0.6 + lp * 0.4;
        buf[idx] = src[i] + lp * 0.74;
        out[i] += y * 0.25;
        idx = (idx + 1) % d;
      }
    }
    for (const d0 of ALLPASS) {
      const d = Math.round((d0 + spread) * (SR / 44100));
      const buf = new Float32Array(d);
      let idx = 0;
      for (let i = 0; i < n; i++) {
        const b = buf[idx];
        const y = -out[i] + b;
        buf[idx] = out[i] + b * 0.5;
        out[i] = y;
        idx = (idx + 1) % d;
      }
    }
    return out;
  };
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) mono[i] = (L[i] + R[i]) * 0.5;
  filter(mono, 'highpass', 300, 0.7);
  const wl = process(mono, 0);
  const wr = process(mono, 23);
  for (let i = 0; i < n; i++) {
    L[i] += wl[i] * wet;
    R[i] += wr[i] * wet;
  }
}

function cleanMaster(L, R) {
  for (const ch of [L, R]) {
    filter(ch, 'highpass', 32, 0.7);
    filter(ch, 'lowpass', 11000, 0.6);
  }
  room(L, R);
  let peak = 0;
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const drive = peak > 0 ? 1.25 / peak : 1;
  for (const ch of [L, R]) for (let i = 0; i < ch.length; i++) ch[i] = Math.tanh(ch[i] * drive);
  return [L, R];
}

export function renderMusic({ style = 'jazz', seed = 1, duration = 60 }) {
  const song = compose({ style, seed, duration });
  const rand = mulberry32(hashSeed('music-render', style, seed));
  const n = Math.ceil((duration + 0.2) * SR);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const voice = new Float32Array(n);
  const byInst = new Map();
  for (const ev of song.events) {
    if (ev.t >= duration) continue;
    if (!byInst.has(ev.inst)) byInst.set(ev.inst, []);
    byInst.get(ev.inst).push({ ...ev, t: Math.max(0, ev.t + (rand() - 0.5) * 0.012 + 0.008) });
  }
  for (const [inst, evs] of byInst) {
    const play = INSTRUMENTS[inst];
    if (!play) continue;
    voice.fill(0);
    for (const ev of evs) play(voice, ev, rand);
    const pan = PAN[inst] ?? 0;
    const gl = Math.cos(((pan + 1) * Math.PI) / 4);
    const gr = Math.sin(((pan + 1) * Math.PI) / 4);
    for (let i = 0; i < n; i++) {
      L[i] += voice[i] * gl;
      R[i] += voice[i] * gr;
    }
  }
  const [outL, outR] = song.style === 'jazz' ? cleanMaster(L, R) : gramophone(L, R, rand);
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(outL[i]), Math.abs(outR[i]));
  const g = peak > 0 ? 0.85 / peak : 1;
  const fadeIn = 0.15 * SR;
  const fadeOut = 1.6 * SR;
  for (let i = 0; i < n; i++) {
    const e = Math.min(1, i / fadeIn) * Math.min(1, (n - i) / fadeOut);
    outL[i] *= g * e;
    outR[i] *= g * e;
  }
  return { left: outL, right: outR, sampleRate: SR, bpm: song.bpm, key: song.key };
}
