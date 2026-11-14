// Procedural ASMR sound bank built from physical models: impacts excite the
// resonant modes of the wooden board (modal synthesis), cuts are granular
// crackle shaped per material, horizontal slices are a pure slide. Seeded, so live playback and export match.
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

// Smooth lowpass approximation of a contact of `ms` milliseconds.
function soften(buf, ms) {
  const fc = Math.min(12000, 700 / Math.max(0.05, ms));
  return filter(buf, 'lowpass', fc, 0.6);
}

// The cutting board: a hardwood slab resting on a stone counter. Its bending
// modes are dense and strongly damped (loss factor ~0.035), so low modes ring
// for tens of milliseconds and high ones die in a few. Many closely spaced
// modes struck together give a dull woody "tok" instead of a pitched plink.
export const BOARD_LOSS = 0.035;
function boardBody(rand, n, { count = 40, lo = 160, hi = 3800, tune = 1, tilt = 0.35 } = {}) {
  const list = [];
  for (let i = 0; i < count; i++) {
    const f = tune * lo * Math.pow(hi / lo, (i + rand()) / count);
    list.push({ f, a: Math.pow(f / lo, -tilt) * (0.35 + rand() * 0.65) * (rand() < 0.5 ? -1 : 1), tau: 1 / (Math.PI * f * BOARD_LOSS) });
  }
  return modes(n, list);
}

// Knife hitting the board through the item: the board's knock (contact of
// about a third of a millisecond through the food), the counter underneath
// answering with a short low thump, the steel edge's tiny tick and a faint
// ring of the blade itself. A touch of saturation glues them together.
function thock(rand) {
  const n = len(0.18);
  const tune = 0.93 + rand() * 0.14;
  const out = normalize(soften(boardBody(rand, n, { tune }), 0.35));
  add(out, modes(n, [{ f: 112 * tune, a: 1, tau: 0.02 }, { f: 64, a: 0.55, tau: 0.028 }]), 0.4);
  add(out, env(filter(noise(len(0.004), rand), 'highpass', 4500, 0.7), (t) => Math.exp(-t / 0.0007)), 0.3);
  add(out, modes(n, [3150, 5230, 7900].map((f, i) => ({ f: f * (0.97 + rand() * 0.06), a: 0.5 / (1 + i), tau: 0.05 / (1 + i * 0.5) }))), 0.035);
  for (let i = 0; i < n; i++) out[i] = Math.tanh(out[i] * 1.4);
  filter(out, 'highpass', 45, 0.7);
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
function swish(n, rand, at, release = 0.005) {
  const out = filter(noise(n, rand), 'bandpass', (t) => 3600 + 6800 * Math.min(1, t / at) ** 1.5, 0.85);
  filter(out, 'highpass', 2400, 0.7);
  return env(out, (t) => (t < at ? (t / at) ** 2.2 : Math.exp(-(t - at) / release)));
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

// Horizontal slice: the blade glides through the item parallel to the board,
// so there is no impact at all, only a continuous slide: the swish carrying on
// under a smooth friction hiss and a little of the material's texture.
function slice(rand, profile, contact = SLICE_CONTACTS[0]) {
  const p = CUT_PROFILES[profile] || CUT_PROFILES.crisp;
  const n = len(contact + p.dur * 0.5);
  const enter = len(contact * 0.55);
  const out = swish(n, rand, contact, 0.05);
  normalize(out, 0.55);
  const span = (n - enter) / SR;
  const glide = (t) => Math.min(1, t / 0.02) * Math.max(0, 1 - t / span) ** 1.3;
  const friction = normalize(filter(noise(n - enter, rand), 'bandpass', (t) => p.band * (0.75 + 0.35 * (t / span)), 0.9));
  add(out, env(friction, glide), 0.45, enter);
  add(out, env(crunch(rand, p, n - enter), glide), 0.3, enter);
  return normalize(out, 0.85);
}

// The item landing on the board at the start of a round: the same board,
// struck softly (a long, cushioned contact) with a deeper counter thump.
function drop(rand) {
  const n = len(0.4);
  const out = normalize(soften(boardBody(rand, n, { lo: 120, hi: 2400, tilt: 0.6 }), 2.5));
  add(out, modes(n, [{ f: 62, a: 1, tau: 0.08 }, { f: 96, a: 0.4, tau: 0.05 }]), 1.2);
  return normalize(out, 0.95);
}

function whoosh(rand) {
  const dur = 0.4;
  const out = filter(noise(len(dur), rand), 'bandpass', (t) => 700 + 3200 * Math.sin((Math.PI * t) / dur), 0.9);
  return normalize(env(out, (t) => Math.sin((Math.PI * t) / dur) ** 2), 0.5);
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
    thock: many(6, thock),
    cut: byContact(CUT_CONTACTS, CUT_VARIANTS, cutSound),
    slice: byContact(SLICE_CONTACTS, SLICE_VARIANTS, slice),
    drop: many(2, drop),
    whoosh: many(2, whoosh),
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
