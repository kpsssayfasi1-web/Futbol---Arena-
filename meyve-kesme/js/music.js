// Generative background music in the style of the reference Shorts: small-
// band minor-key jazz (see music-jazz.js) with synthesized instruments,
// mastered clean with a small room. Pure JS, runs in the worker, copyright free.
import { mulberry32, hashSeed } from './rng.js';
import { filter, SAMPLE_RATE } from './sfx.js';
import { INSTRUMENTS } from './music-instruments.js';
import { composeJazz } from './music-jazz.js';

const SR = SAMPLE_RATE;

export const MUSIC_STYLES = [
  { id: 'jazz', tr: 'Gizemli Caz', en: 'Sneaky Jazz' },
  { id: 'pizzicato', tr: 'Sinsi Pizzicato', en: 'Sneaky Pizzicato' },
  { id: 'noir', tr: 'Gece Cazı', en: 'Late Night Jazz' },
];

export function compose({ style = 'jazz', seed = 1, duration = 60 }) {
  return composeJazz({ style, seed, duration });
}

const PAN = { ep: -0.25, upright: 0, vibes: 0.28, jazzPizz: 0.2, jazzRide: 0.35, snare: -0.12, snap: -0.2, hat: 0.25, kick: 0, sweep: -0.18 };

// Rumble filter, gentle top roll-off, a small Schroeder room and soft
// saturation.
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
  const [outL, outR] = cleanMaster(L, R);
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
