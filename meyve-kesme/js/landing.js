// The sound of one round's cubes landing, mixed offline (in the worker) from
// physically modelled impact grains: every cube is heard exactly when and
// where it lands, louder and lower when bigger, softer when it lands on the pile.
import { impactGrain, SAMPLE_RATE } from './sfx.js';
import { mulberry32, hashSeed } from './rng.js';

const MAX_GRAINS = 26000;
const VARIANTS = 6;
const SIZES = [0.03, 0.09, 0.25];
const grainCache = new Map();

function grainBank(hard, metal) {
  const key = `${hard.toFixed(2)}|${metal}`;
  if (grainCache.has(key)) return grainCache.get(key);
  const rand = mulberry32(hashSeed('grains', key));
  const bank = {};
  for (const surface of ['board', 'pile']) {
    bank[surface] = SIZES.map((size) => Array.from({ length: VARIANTS }, () => impactGrain(rand, { surface, size, hard, metal })));
  }
  grainCache.set(key, bank);
  return bank;
}

function sizeClass(s) {
  if (s < 0.055) return 0;
  return s < 0.16 ? 1 : 2;
}

// Mix `grain` into L/R at sample `at`, resampled by `rate`.
function mixGrain(L, R, grain, at, rate, gl, gr) {
  const n = Math.floor((grain.length - 1) / rate);
  const end = Math.min(n, L.length - at);
  for (let i = 0; i < end; i++) {
    const pos = i * rate;
    const k = pos | 0;
    const v = grain[k] + (grain[k + 1] - grain[k]) * (pos - k);
    L[at + i] += v * gl;
    R[at + i] += v * gr;
  }
}

export function buildLandingTrack(data, round, sound) {
  if (!data.count) return null;
  const hard = Math.min(1, Math.max(0, sound?.hard ?? 0.3));
  const metal = sound?.cut === 'metal';
  const bank = grainBank(hard, metal);
  const rand = mulberry32(hashSeed('landing', round.index, round.cuts, round.itemId));
  const step = Math.max(1, Math.ceil(data.count / MAX_GRAINS));
  const comp = Math.sqrt(step);
  let first = Infinity;
  let last = 0;
  for (let i = 0; i < data.count; i += step) {
    const t = data.motion[i * 4] + data.motion[i * 4 + 1];
    first = Math.min(first, t);
    last = Math.max(last, t);
  }
  const start = first - 0.02;
  const n = Math.ceil((last - start + 0.6) * SAMPLE_RATE);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const bounce = data.coarse;
  for (let i = 0; i < data.count; i += step) {
    const s = Math.cbrt(data.size[i * 3] * data.size[i * 3 + 1] * data.size[i * 3 + 2]);
    const restY = data.rest[i * 3 + 1];
    const surface = restY - round.boardY < s * 0.75 ? 'board' : 'pile';
    const variants = bank[surface][sizeClass(s)];
    const grain = variants[Math.floor(rand() * VARIANTS)];
    const rate = (0.88 + rand() * 0.24) * Math.min(1.6, Math.max(0.75, Math.pow(0.12 / Math.max(0.01, s), 0.18)));
    const gain = Math.min(1, Math.pow(s / 0.3, 1.1)) * (0.55 + rand() * 0.45) * comp * (surface === 'pile' ? 0.7 : 1);
    const pan = Math.max(-1, Math.min(1, data.rest[i * 3] / 2.2)) * 0.55;
    const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
    const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
    const t = data.motion[i * 4] + data.motion[i * 4 + 1] + (rand() - 0.5) * 0.004;
    const at = Math.max(0, Math.round((t - start) * SAMPLE_RATE));
    mixGrain(L, R, grain, at, rate, gl, gr);
    if (bounce && s > 0.12) mixGrain(L, R, grain, at + Math.round(0.185 * SAMPLE_RATE), rate * 1.05, gl * 0.22, gr * 0.22);
  }
  // Level: dense pours are normalised by loudness, sparse taps by peak, then a
  // soft knee catches the few remaining peaks (no pumping, no harsh clipping).
  let rawPeak = 0;
  let energy = 0;
  for (let i = 0; i < n; i++) {
    rawPeak = Math.max(rawPeak, Math.abs(L[i]), Math.abs(R[i]));
    energy += L[i] * L[i] + R[i] * R[i];
  }
  const rms = Math.sqrt(energy / (2 * n)) || 1e-9;
  const gain = Math.min(0.9 / (rawPeak || 1), 0.1 / rms);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    L[i] = Math.tanh(L[i] * gain);
    R[i] = Math.tanh(R[i] * gain);
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
  return { start, left: L, right: R, sampleRate: SAMPLE_RATE, peak };
}
