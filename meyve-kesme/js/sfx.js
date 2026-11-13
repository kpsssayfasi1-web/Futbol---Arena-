// Procedural ASMR sound bank built from physical models: impacts excite the
// resonant modes of the wooden board (modal synthesis), cuts are granular
// crackle shaped per material. Seeded, so live playback and export match.
import { mulberry32 } from './rng.js';

export const SAMPLE_RATE = 48000;
const SR = SAMPLE_RATE;
const TAU = Math.PI * 2;

function biquad(type, freq, q) {
  const w0 = (TAU * Math.min(freq, SR * 0.45)) / SR;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  let b0, b1, b2;
  if (type === 'lowpass') [b0, b1, b2] = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2];
  else if (type === 'highpass') [b0, b1, b2] = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
  else [b0, b1, b2] = [alpha, 0, -alpha];
  const a0 = 1 + alpha;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: (-2 * cos) / a0, a2: (1 - alpha) / a0 };
}

// Filter in place; freqAt(t) allows sweeps (coefficients refreshed every 32 samples).
export function filter(buf, type, freqAt, q) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  let c = null;
  const f = typeof freqAt === 'function' ? freqAt : () => freqAt;
  for (let i = 0; i < buf.length; i++) {
    if ((i & 31) === 0) c = biquad(type, f(i / SR), q);
    const x = buf[i];
    const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    buf[i] = y;
  }
  return buf;
}

export function normalize(buf, peak = 0.9) {
  let m = 0;
  for (const v of buf) m = Math.max(m, Math.abs(v));
  if (m > 0) for (let i = 0; i < buf.length; i++) buf[i] *= peak / m;
  return buf;
}

const len = (s) => Math.max(1, Math.round(s * SR));
const noise = (n, rand) => Float32Array.from({ length: n }, () => rand() * 2 - 1);
const add = (dst, src, gain = 1, offset = 0) => {
  for (let i = 0; i < src.length && i + offset < dst.length; i++) dst[i + offset] += src[i] * gain;
  return dst;
};
const env = (buf, fn) => {
  for (let i = 0; i < buf.length; i++) buf[i] *= fn(i / SR);
  return buf;
};

// Sum of exponentially decaying sines.
function modes(n, list) {
  const out = new Float32Array(n);
  for (const { f, a, tau, ph = 0 } of list) {
    const w = (TAU * f) / SR;
    const k = Math.exp(-1 / (tau * SR));
    let g = a;
    for (let i = 0; i < n; i++) {
      out[i] += g * Math.sin(w * i + ph);
      g *= k;
      if (g < 1e-5) break;
    }
  }
  return out;
}

// Raised-cosine force pulse; longer contact = softer, darker impact.
function contact(n, ms) {
  const m = Math.max(2, Math.round((ms / 1000) * SR));
  const out = new Float32Array(n);
  for (let i = 0; i < m && i < n; i++) out[i] = 0.5 - 0.5 * Math.cos((TAU * i) / m);
  return out;
}

// Board response: plate-like modes, random per strike position.
const BOARD_F = [168, 251, 356, 447, 583, 702, 846, 1030, 1284, 1570, 1915, 2390, 2960, 3650];
function boardModes(rand, brightness, strength = 1) {
  return BOARD_F.map((f0, i) => {
    const f = f0 * (0.94 + rand() * 0.12);
    const tilt = Math.pow(1 + i, -1.15 + brightness * 0.9);
    return { f, a: strength * tilt * (0.35 + rand() * 0.65), tau: Math.min(0.09, Math.max(0.006, 0.055 * Math.pow(220 / f, 0.7))), ph: rand() * TAU };
  });
}

// Smooth lowpass approximation of a contact of `ms` milliseconds.
function soften(buf, ms) {
  const fc = Math.min(12000, 700 / Math.max(0.05, ms));
  return filter(buf, 'lowpass', fc, 0.6);
}

// One falling cube. surface: 'board' | 'pile'; size in scene units; hard 0..1.
export function impactGrain(rand, { surface, size, hard, metal }) {
  const ms = 0.3 + (1 - hard) * 3.2 + size * 2;
  const n = len(metal ? 0.32 : 0.12);
  const out = new Float32Array(n);
  if (surface === 'board') add(out, soften(modes(n, boardModes(rand, hard)), ms), 0.9);
  const thud = env(filter(noise(n, rand), 'bandpass', 380 + hard * 1400 + rand() * 300, 1.2), (t) => Math.exp(-t / (0.004 + (1 - hard) * 0.008)));
  add(out, thud, surface === 'board' ? 0.45 : 0.9);
  if (hard > 0.6 || metal) {
    const f = (metal ? 2400 : 3800) * (0.8 + rand() * 0.5) * Math.pow(0.1 / Math.max(0.02, size), 0.3);
    const ring = metal
      ? [1, 2.76, 5.4, 8.93].map((k, i) => ({ f: f * k, a: 0.5 / (1 + i), tau: 0.14 / (1 + i * 0.7), ph: rand() * TAU }))
      : [1, 1.58, 2.31].map((k, i) => ({ f: f * k, a: 0.4 / (1 + i), tau: 0.012, ph: rand() * TAU }));
    add(out, modes(n, ring), metal ? 0.7 : 0.35);
  }
  if (surface === 'pile') filter(out, 'lowpass', 2600 + hard * 5000, 0.7);
  const c = contact(n, ms);
  for (let i = 0; i < c.length && c[i] > 0; i++) out[i] += c[i] * 0.25 * (1 - hard);
  filter(out, 'highpass', 60, 0.7);
  return normalize(out, 0.9);
}

// Knife hitting the board through the item: a sharp edge click, then the
// board's knock (a cluster of modes around 1.3-2 kHz with a 3.2 kHz pair, as
// measured on the reference video) over a short low body thump.
const KNOCK = [
  [1335, 1, 0.04], [1415, 0.75, 0.034], [1500, 0.9, 0.038], [1590, 0.7, 0.03], [1655, 0.6, 0.028],
  [1890, 0.55, 0.026], [1950, 0.5, 0.024], [2620, 0.45, 0.02], [3200, 0.8, 0.017], [3370, 0.65, 0.015], [4100, 0.35, 0.011],
  [960, 0.35, 0.03], [620, 0.22, 0.028],
];
function thock(rand) {
  const n = len(0.2);
  const tune = 0.97 + rand() * 0.06;
  const out = modes(n, KNOCK.map(([f, a, tau]) => ({ f: f * tune * (0.99 + rand() * 0.02), a: a * (0.7 + rand() * 0.3), tau, ph: rand() * TAU })));
  soften(out, 0.12);
  add(out, modes(n, [{ f: 165 * tune, a: 1.1, tau: 0.045 }, { f: 245 * tune, a: 0.7, tau: 0.032 }, { f: 84, a: 0.5, tau: 0.05 }]), 0.35);
  add(out, env(filter(noise(n, rand), 'highpass', 6000, 0.7), (t) => Math.exp(-t / 0.0014)), 0.9);
  add(out, normalize(env(filter(noise(n, rand), 'bandpass', 3400 * tune, 0.7), (t) => Math.exp(-t / 0.0022))), 0.55);
  return normalize(out, 0.95);
}

// Granular crackle: many tiny noise bursts with spiky amplitudes.
function grains(n, rate, rand, grainMs = [0.3, 1.6]) {
  const out = new Float32Array(n);
  const count = Math.round((rate * n) / SR);
  for (let g = 0; g < count; g++) {
    const at = Math.floor(rand() * n);
    const glen = len((grainMs[0] + rand() * (grainMs[1] - grainMs[0])) / 1000);
    const amp = rand() ** 3 * (rand() < 0.5 ? -1 : 1);
    for (let i = 0; i < glen && at + i < n; i++) out[at + i] += amp * (rand() * 2 - 1) * (1 - i / glen);
  }
  return out;
}

const CUT_PROFILES = {
  crisp: { rate: 1100, band: 3200, q: 0.7, wet: 0.15, dur: 0.2 },
  juicy: { rate: 600, band: 1900, q: 0.8, wet: 0.55, dur: 0.24 },
  soft: { rate: 160, band: 1100, q: 0.7, wet: 0.35, dur: 0.22 },
  snap: { rate: 70, band: 4200, q: 1.2, wet: 0.0, dur: 0.16, snaps: 3 },
  metal: { rate: 40, band: 5200, q: 6, wet: 0.0, dur: 0.32, scrape: true },
  sand: { rate: 4200, band: 5200, q: 0.5, wet: 0.0, dur: 0.26 },
  rubber: { rate: 120, band: 900, q: 1.0, wet: 0.2, dur: 0.22, squeak: true },
  rock: { rate: 900, band: 1500, q: 0.7, wet: 0.0, dur: 0.24 },
};

// The blade's rush of air: bright band-passed noise rising to the contact at
// `at` seconds, then cut off. Brighter and louder as the knife speeds up.
function swish(n, rand, at) {
  const out = filter(noise(n, rand), 'bandpass', (t) => 3600 + 6800 * Math.min(1, t / at) ** 1.5, 0.85);
  filter(out, 'highpass', 2400, 0.7);
  return env(out, (t) => (t < at ? (t / at) ** 2.2 : Math.exp(-(t - at) / 0.005)));
}

// Material crunch while the edge passes through the item.
function crunch(rand, p, n) {
  const out = normalize(filter(grains(n, p.rate, rand), 'bandpass', p.band * (0.85 + rand() * 0.3), p.q));
  if (p.wet > 0) {
    const wet = filter(noise(n, rand), 'lowpass', 900, 0.8);
    const bub = 18 + rand() * 20;
    env(wet, (t) => 0.5 + 0.5 * Math.sin(TAU * bub * t) ** 2);
    add(out, normalize(wet), p.wet);
  }
  if (p.snaps) for (let s = 0; s < p.snaps; s++) add(out, modes(len(0.05), [{ f: 2500 + rand() * 3000, a: 1, tau: 0.008 }]), 0.6, Math.floor(rand() * n * 0.7));
  if (p.scrape) add(out, normalize(env(filter(noise(n, rand), 'bandpass', (t) => 3500 + 3000 * (t / (n / SR)), 9), (t) => Math.sin((Math.PI * t * SR) / n))), 0.7);
  if (p.squeak) {
    const f0 = 800 + rand() * 500;
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      ph += (TAU * f0 * (1 + 0.04 * Math.sin(TAU * 9 * t))) / SR;
      out[i] += 0.25 * Math.sin(ph) * Math.sin((Math.PI * i) / n) ** 2;
    }
  }
  return normalize(out);
}

// Seconds from the start of a cut / slice buffer to the moment of contact.
// Each length has its own variants, so fast cuts get a short swish instead of
// a sped-up one (resampling would push the bright air noise above Nyquist).
export const CUT_CONTACTS = [0.1, 0.06, 0.036];
export const SLICE_CONTACTS = [0.18, 0.1, 0.05];
export const CUT_VARIANTS = 6;
export const SLICE_VARIANTS = 3;

// Downward chop: swish -> edge click -> crunch. The board knock is the
// separate 'thock' event at the same moment.
function cutSound(rand, profile, contact = CUT_CONTACTS[0]) {
  const p = CUT_PROFILES[profile] || CUT_PROFILES.crisp;
  const tail = p.dur * 0.6;
  const n = len(contact + tail);
  const at = len(contact);
  const out = swish(n, rand, contact);
  normalize(out, 0.5);
  const c = crunch(rand, p, n - at);
  env(c, (t) => Math.min(1, t / 0.002) * Math.max(0, 1 - t / tail) ** 1.6);
  add(out, c, 0.75, at);
  add(out, env(filter(noise(len(0.01), rand), 'highpass', 5000, 0.7), (t) => Math.exp(-t / 0.0012)), 0.7, at);
  return normalize(out, 0.9);
}

// Horizontal slice: a longer swish, the edge drawing through the item, and a
// light tick as it leaves (no board under the blade).
function slice(rand, profile, contact = SLICE_CONTACTS[0]) {
  const p = CUT_PROFILES[profile] || CUT_PROFILES.crisp;
  const n = len(contact + p.dur * 0.5);
  const enter = len(contact * 0.55);
  const out = swish(n, rand, contact);
  normalize(out, 0.55);
  const c = crunch(rand, p, n - enter);
  const span = (n - enter) / SR;
  env(c, (t) => Math.min(1, t / 0.015) * Math.max(0, 1 - t / span) ** 1.2);
  add(out, c, 0.6, enter);
  add(out, modes(len(0.04), [{ f: 2900 + rand() * 600, a: 1, tau: 0.006 }, { f: 1500 + rand() * 200, a: 0.6, tau: 0.012 }]), 0.35, len(contact));
  return normalize(out, 0.85);
}

function drop(rand) {
  const n = len(0.5);
  const out = soften(modes(n, boardModes(rand, 0.4, 1.5)), 2.5);
  add(out, modes(n, [{ f: 62, a: 1, tau: 0.08 }, { f: 96, a: 0.4, tau: 0.05 }]), 1.2);
  return normalize(out, 0.95);
}

function whoosh(rand) {
  const dur = 0.4;
  const out = filter(noise(len(dur), rand), 'bandpass', (t) => 700 + 3200 * Math.sin((Math.PI * t) / dur), 0.9);
  return normalize(env(out, (t) => Math.sin((Math.PI * t) / dur) ** 2), 0.5);
}

function crumble(rand, profile) {
  const p = CUT_PROFILES[profile] || CUT_PROFILES.crisp;
  const dur = 0.35;
  const n = len(dur);
  const out = filter(grains(n, Math.max(300, p.rate), rand, [0.5, 2.5]), 'bandpass', p.band * 0.7, 0.8);
  return normalize(env(out, (t) => Math.min(1, t / 0.01) * Math.max(0, 1 - t / dur) ** 2), 0.8);
}

// Event sounds for one material profile.
const banks = new Map();
export function eventBank(profile = 'crisp') {
  if (banks.has(profile)) return banks.get(profile);
  const rand = mulberry32(1000 + Object.keys(CUT_PROFILES).indexOf(profile));
  const many = (k, fn) => Array.from({ length: k }, () => fn(rand, profile));
  // cut / slice lists hold one block of variants per contact length.
  const byContact = (contacts, k, fn) => contacts.flatMap((c) => Array.from({ length: k }, () => fn(rand, profile, c)));
  const bank = {
    thock: many(4, thock),
    cut: byContact(CUT_CONTACTS, CUT_VARIANTS, cutSound),
    slice: byContact(SLICE_CONTACTS, SLICE_VARIANTS, slice),
    drop: many(2, drop),
    whoosh: many(2, whoosh),
    crumble: many(3, crumble),
  };
  banks.set(profile, bank);
  return bank;
}

export const PROFILES = Object.keys(CUT_PROFILES);

// Short exponential-noise impulse response for a small, warm room.
export function roomImpulse(seconds = 0.45, sr = SR) {
  const rand = mulberry32(9);
  const n = Math.round(seconds * sr);
  return [0, 1].map(() => {
    const b = new Float32Array(n);
    for (let i = 0; i < n; i++) b[i] = (rand() * 2 - 1) * Math.exp((-i / sr) * 9);
    return filter(b, 'lowpass', 4500, 0.7);
  });
}
