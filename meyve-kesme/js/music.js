// Generative background music in a vintage style: a small composer (chord
// progressions, motif-based melodies, accompaniment patterns) and synthesized
// instruments, finished with a gramophone chain (band limit, saturation,
// wow & flutter, crackle). Pure JS, runs in the worker, copyright free.
import { mulberry32, hashSeed } from './rng.js';
import { filter, SAMPLE_RATE } from './sfx.js';

const SR = SAMPLE_RATE;
const TAU = Math.PI * 2;
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

export const MUSIC_STYLES = [
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

export function compose({ style = 'waltz', seed = 1, duration = 60 }) {
  const st = STYLES[style] || STYLES.waltz;
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

// ---------- instruments ----------
const tables = new Map();
function reedTable(inst, f) {
  const key = `${inst}|${Math.round(f)}`;
  if (tables.has(key)) return tables.get(key);
  const N = 2048;
  const t = new Float32Array(N);
  const g = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
  for (let h = 1; h * f < 9000; h++) {
    const x = h * f;
    let a;
    if (inst === 'clarinet') a = (h % 2 ? 1 : 0.12) * (0.3 + g(x, 1500, 600) + 0.5 * g(x, 2400, 700)) / h ** 0.4;
    else if (inst === 'bassoon') a = (0.4 + g(x, 450, 200) + 0.7 * g(x, 1150, 400)) / h ** 0.5;
    else if (inst === 'accordion') a = (0.5 + 0.8 * g(x, 1500, 1200)) / h ** 0.65;
    else a = (0.18 + g(x, 1150, 420) + 0.6 * g(x, 2900, 800)) / h ** 0.25;
    a *= x > 4500 ? Math.exp(-(x - 4500) / 1500) : 1;
    for (let i = 0; i < N; i++) t[i] += a * Math.sin((TAU * h * i) / N + h * 0.7);
  }
  let rms = 0;
  for (const v of t) rms += v * v;
  rms = Math.sqrt(rms / N) || 1;
  for (let i = 0; i < N; i++) t[i] /= rms * 3;
  tables.set(key, t);
  return t;
}

function renderReed(out, ev, rand, inst) {
  const f = mtof(ev.midi);
  const table = reedTable(inst, f);
  const n = Math.floor((ev.dur + 0.12) * SR);
  const start = Math.floor(ev.t * SR);
  const voices = inst === 'accordion' ? [-0.006, 0.006] : [0];
  for (const det of voices) {
    let ph = rand();
    for (let i = 0; i < n && start + i < out.length; i++) {
      const t = i / SR;
      const vib = 1 + (inst === 'accordion' ? 0 : 0.0045 * Math.sin(TAU * 5.3 * t) * Math.min(1, t / 0.35));
      ph += (f * (1 + det) * vib) / SR;
      const p = (ph - Math.floor(ph)) * 2048;
      const k = p | 0;
      const v = table[k] + (table[(k + 1) & 2047] - table[k]) * (p - k);
      const envA = Math.min(1, t / 0.045) * (t > ev.dur ? Math.max(0, 1 - (t - ev.dur) / 0.1) : 1);
      out[start + i] += v * envA * ev.vel * (inst === 'accordion' ? 0.6 : 1);
    }
  }
}

// Karplus-Strong with an all-pass tuning stage.
function renderPluck(out, ev, rand, { sustain, bright, gain }) {
  const f = mtof(ev.midi);
  const D = SR / f - 0.5;
  const N = Math.max(2, Math.floor(D));
  const frac = D - N;
  const C = (1 - frac) / (1 + frac);
  const buf = new Float32Array(N);
  let lp = 0;
  for (let i = 0; i < N; i++) {
    lp += (rand() * 2 - 1 - lp) * bright;
    buf[i] = lp;
  }
  const n = Math.floor(Math.min(ev.dur + 0.6, 2.5) * SR);
  const start = Math.floor(ev.t * SR);
  let idx = 0;
  let apX = 0;
  let apY = 0;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const a = buf[idx];
    const b = buf[(idx + 1) % N];
    const avg = sustain * 0.5 * (a + b);
    const y = C * avg + apX - C * apY;
    apX = avg;
    apY = y;
    buf[idx] = y;
    idx = (idx + 1) % N;
    const t = i / SR;
    const release = t > ev.dur + 0.3 ? Math.max(0, 1 - (t - ev.dur - 0.3) / 0.3) : 1;
    out[start + i] += a * gain * ev.vel * release;
  }
}

function renderEp(out, ev) {
  const f = mtof(ev.midi);
  const n = Math.floor((ev.dur + 0.4) * SR);
  const start = Math.floor(ev.t * SR);
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / SR;
    const e = Math.exp(-t / 0.9) * Math.min(1, t / 0.004) * (t > ev.dur ? Math.max(0, 1 - (t - ev.dur) / 0.3) : 1);
    out[start + i] += ev.vel * 0.35 * e * (Math.sin(TAU * f * t) + 0.25 * Math.sin(TAU * 2 * f * t) * Math.exp(-t / 0.2) + 0.06 * Math.sin(TAU * 7.1 * f * t) * Math.exp(-t / 0.05));
  }
}

function renderNoiseHit(out, ev, rand, { freq, q, attack, decay }) {
  const n = Math.floor((attack + decay * 5) * SR);
  const start = Math.floor(ev.t * SR);
  const tmp = new Float32Array(n);
  for (let i = 0; i < n; i++) tmp[i] = rand() * 2 - 1;
  filter(tmp, 'bandpass', freq, q);
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / SR;
    out[start + i] += tmp[i] * ev.vel * Math.min(1, t / attack) * Math.exp(-Math.max(0, t - attack) / decay) * 0.6;
  }
}

const PLUCKS = {
  pizz: { sustain: 0.994, bright: 0.35, gain: 0.9 },
  bass: { sustain: 0.997, bright: 0.25, gain: 1.1 },
  cello: { sustain: 0.996, bright: 0.3, gain: 1.0 },
  harp: { sustain: 0.9985, bright: 0.55, gain: 0.45 },
  guitar: { sustain: 0.995, bright: 0.6, gain: 0.4 },
  harpsichord: { sustain: 0.997, bright: 0.95, gain: 0.35 },
};
const PAN = { oboe: 0.15, clarinet: -0.3, bassoon: -0.25, accordion: 0.1, pizz: -0.1, bass: -0.1, cello: -0.15, harp: 0.35, guitar: 0.3, harpsichord: 0.3, ep: 0.25, ride: 0.4, brush: -0.2 };

// ---------- gramophone ----------
function gramophone(L, R, rand) {
  const n = L.length;
  for (const ch of [L, R]) {
    filter(ch, 'highpass', 230, 0.7);
    filter(ch, 'lowpass', 4300, 0.75);
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

export function renderMusic({ style = 'waltz', seed = 1, duration = 60 }) {
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
    byInst.get(ev.inst).push({ ...ev, t: ev.t + (rand() - 0.5) * 0.012 + 0.008 });
  }
  for (const [inst, evs] of byInst) {
    voice.fill(0);
    for (const ev of evs) {
      if (['oboe', 'clarinet', 'bassoon', 'accordion'].includes(inst)) renderReed(voice, ev, rand, inst);
      else if (PLUCKS[inst]) renderPluck(voice, ev, rand, PLUCKS[inst]);
      else if (inst === 'ep') renderEp(voice, ev);
      else if (inst === 'ride') renderNoiseHit(voice, ev, rand, { freq: 7500, q: 0.8, attack: 0.002, decay: 0.03 });
      else if (inst === 'brush') renderNoiseHit(voice, ev, rand, { freq: 3500, q: 0.6, attack: 0.04, decay: 0.05 });
    }
    const pan = PAN[inst] ?? 0;
    const gl = Math.cos(((pan + 1) * Math.PI) / 4);
    const gr = Math.sin(((pan + 1) * Math.PI) / 4);
    for (let i = 0; i < n; i++) {
      L[i] += voice[i] * gl;
      R[i] += voice[i] * gr;
    }
  }
  const [outL, outR] = gramophone(L, R, rand);
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
