// Procedural ASMR sound bank. Everything is synthesised once into Float32Arrays
// with a seeded RNG, so live playback and offline export sound identical.
import { mulberry32 } from './rng.js';

export const SAMPLE_RATE = 44100;

function biquad(type, freq, q, sr = SAMPLE_RATE) {
  const w0 = (2 * Math.PI * Math.min(freq, sr * 0.45)) / sr;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  let b0, b1, b2;
  if (type === 'lowpass') {
    b0 = (1 - cos) / 2;
    b1 = 1 - cos;
    b2 = (1 - cos) / 2;
  } else if (type === 'highpass') {
    b0 = (1 + cos) / 2;
    b1 = -(1 + cos);
    b2 = (1 + cos) / 2;
  } else {
    b0 = alpha;
    b1 = 0;
    b2 = -alpha;
  }
  const a0 = 1 + alpha;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: (-2 * cos) / a0, a2: (1 - alpha) / a0 };
}

// Filter in place; freqAt(t) allows sweeps (coefficients refreshed every 32 samples).
export function filter(buf, type, freqAt, q, sr = SAMPLE_RATE) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  let c = null;
  const f = typeof freqAt === 'function' ? freqAt : () => freqAt;
  for (let i = 0; i < buf.length; i++) {
    if ((i & 31) === 0) c = biquad(type, f(i / sr), q, sr);
    const x = buf[i];
    const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    buf[i] = y;
  }
  return buf;
}

const len = (s) => Math.max(1, Math.round(s * SAMPLE_RATE));
const noise = (n, rand) => Float32Array.from({ length: n }, () => rand() * 2 - 1);
const addInto = (dst, src, gain = 1, offset = 0) => {
  for (let i = 0; i < src.length && i + offset < dst.length; i++) dst[i + offset] += src[i] * gain;
  return dst;
};
const envelope = (buf, fn) => {
  for (let i = 0; i < buf.length; i++) buf[i] *= fn(i / SAMPLE_RATE);
  return buf;
};

export function normalize(buf, peak = 0.9) {
  let m = 0;
  for (const v of buf) m = Math.max(m, Math.abs(v));
  if (m > 0) for (let i = 0; i < buf.length; i++) buf[i] *= peak / m;
  return buf;
}

function sine(n, freqAt, ampAt) {
  const out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    ph += (2 * Math.PI * freqAt(t)) / SAMPLE_RATE;
    out[i] = Math.sin(ph) * ampAt(t);
  }
  return out;
}

// Sparse crackle: many tiny noise bursts with spiky amplitudes.
function grains(n, rate, rand, grainMs = [0.3, 1.6]) {
  const out = new Float32Array(n);
  const count = Math.round((rate * n) / SAMPLE_RATE);
  for (let g = 0; g < count; g++) {
    const at = Math.floor(rand() * n);
    const glen = len((grainMs[0] + rand() * (grainMs[1] - grainMs[0])) / 1000);
    const amp = rand() ** 3 * (rand() < 0.5 ? -1 : 1);
    for (let i = 0; i < glen && at + i < n; i++) out[at + i] += amp * (rand() * 2 - 1) * (1 - i / glen);
  }
  return out;
}

function thock(rand) {
  const n = len(0.18);
  const p = 0.9 + rand() * 0.25;
  const body = sine(n, (t) => (95 + 170 * Math.exp(-t / 0.01)) * p, (t) => Math.exp(-t / 0.032));
  const knock = envelope(filter(noise(n, rand), 'bandpass', 950 * p, 3.5), (t) => Math.exp(-t / 0.018));
  const click = envelope(filter(noise(n, rand), 'highpass', 3500, 0.7), (t) => Math.exp(-t / 0.0025));
  const out = new Float32Array(n);
  addInto(out, normalize(body), 0.8);
  addInto(out, normalize(knock), 0.7);
  addInto(out, normalize(click), 0.35);
  return normalize(out, 0.95);
}

function crunch(rand, dur = 0.22, rate = 900) {
  const n = len(dur);
  const g = filter(filter(grains(n, rate, rand), 'bandpass', 2600 + rand() * 900, 0.7), 'highpass', 800, 0.7);
  const wet = filter(noise(n, rand), 'lowpass', 700, 0.8);
  const out = new Float32Array(n);
  addInto(out, normalize(g), 1);
  addInto(out, normalize(wet), 0.22);
  return normalize(envelope(out, (t) => Math.min(1, t / 0.012) * Math.max(0, 1 - t / dur) ** 1.4), 0.9);
}

function slice(rand) {
  const dur = 0.3;
  const n = len(dur);
  const scrape = envelope(filter(noise(n, rand), 'bandpass', (t) => 3000 + 4000 * (t / dur), 7), (t) => Math.sin((Math.PI * t) / dur) ** 2);
  const out = crunch(rand, dur, 650);
  addInto(out, normalize(scrape), 0.45);
  return normalize(out, 0.85);
}

function tick(rand) {
  const n = len(0.06);
  const f = 420 + rand() * 520;
  const tone = sine(n, () => f, (t) => Math.exp(-t / 0.011));
  const tap = envelope(filter(noise(n, rand), 'bandpass', f * 3.2, 4), (t) => Math.exp(-t / 0.006));
  const out = new Float32Array(n);
  addInto(out, normalize(tone), 0.6);
  addInto(out, normalize(tap), 0.55);
  return normalize(out, 0.8);
}

// Dense rain of tiny pieces, used when thousands of cubes land at once.
function pour(rand) {
  const n = len(1.2);
  const out = new Float32Array(n);
  const blip = tick(rand);
  const count = Math.round(1.2 * 1800);
  for (let i = 0; i < count; i++) {
    const at = Math.floor(rand() * (n - blip.length));
    const gain = 0.05 + rand() ** 2 * 0.25;
    const step = 1.6 + rand() * 1.6;
    for (let k = 0; k * step < blip.length && at + k < n; k++) out[at + k] += blip[Math.floor(k * step)] * gain;
  }
  filter(out, 'highpass', 700, 0.7);
  return normalize(envelope(out, (t) => Math.min(1, t / 0.08) * Math.min(1, (1.2 - t) / 0.15)), 0.75);
}

function drop(rand) {
  const n = len(0.45);
  const thud = sine(n, (t) => 70 - 22 * Math.min(1, t / 0.12), (t) => Math.exp(-t / 0.09));
  const knock = envelope(filter(noise(n, rand), 'bandpass', 360, 2), (t) => Math.exp(-t / 0.03));
  const ring = sine(n, () => 182, (t) => Math.exp(-t / 0.15));
  const out = new Float32Array(n);
  addInto(out, normalize(thud), 1);
  addInto(out, normalize(knock), 0.55);
  addInto(out, normalize(ring), 0.18);
  return normalize(out, 0.95);
}

function whoosh(rand) {
  const dur = 0.5;
  const n = len(dur);
  const out = filter(noise(n, rand), 'bandpass', (t) => 400 + 1800 * Math.sin((Math.PI * t) / dur), 1.2);
  return normalize(envelope(out, (t) => Math.sin((Math.PI * t) / dur) ** 2), 0.6);
}

function crumble(rand) {
  const dur = 0.4;
  const n = len(dur);
  const g = filter(grains(n, 1600, rand, [0.5, 3]), 'bandpass', 1700, 0.8);
  const low = sine(n, () => 120, (t) => Math.exp(-t / 0.05));
  const out = new Float32Array(n);
  addInto(out, normalize(g), 1);
  addInto(out, normalize(low), 0.3);
  return normalize(envelope(out, (t) => Math.min(1, t / 0.01) * Math.max(0, 1 - t / dur) ** 2), 0.8);
}

export function synthBank(seed = 42) {
  const rand = mulberry32(seed);
  const many = (k, fn) => Array.from({ length: k }, () => fn(rand));
  return {
    thock: many(4, thock),
    crunch: many(6, (r) => crunch(r)),
    slice: many(3, slice),
    tick: many(8, tick),
    pour: many(2, pour),
    drop: many(2, drop),
    whoosh: many(2, whoosh),
    crumble: many(3, crumble),
  };
}

// Short exponential-noise impulse response for a small, warm room.
export function roomImpulse(seconds = 0.45, sr = SAMPLE_RATE) {
  const rand = mulberry32(9);
  const n = Math.round(seconds * sr);
  const ch = [0, 1].map(() => {
    const b = new Float32Array(n);
    for (let i = 0; i < n; i++) b[i] = (rand() * 2 - 1) * Math.exp((-i / sr) * 9);
    return filter(b, 'lowpass', 4500, 0.7, sr);
  });
  return ch;
}
