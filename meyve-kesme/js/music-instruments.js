// Synthesized instruments for the background music. Each renderer adds one
// note event { t, dur, midi, vel } into a mono buffer. Reeds use wavetables,
// plucked strings Karplus-Strong, the upright bass, vibraphone and the brush
// kit are additive / filtered-noise models. Pure JS, runs in the worker.
import { filter, SAMPLE_RATE } from './sfx.js';

const SR = SAMPLE_RATE;
const TAU = Math.PI * 2;
export const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

const startOf = (ev) => Math.floor(ev.t * SR);
const gauss = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));

// ---------- reeds (wavetable) ----------
const tables = new Map();
function reedTable(inst, f) {
  const key = `${inst}|${Math.round(f)}`;
  if (tables.has(key)) return tables.get(key);
  const N = 2048;
  const t = new Float32Array(N);
  for (let h = 1; h * f < 9000; h++) {
    const x = h * f;
    let a;
    if (inst === 'clarinet') a = ((h % 2 ? 1 : 0.12) * (0.3 + gauss(x, 1500, 600) + 0.5 * gauss(x, 2400, 700))) / h ** 0.4;
    else if (inst === 'bassoon') a = (0.4 + gauss(x, 450, 200) + 0.7 * gauss(x, 1150, 400)) / h ** 0.5;
    else if (inst === 'accordion') a = (0.5 + 0.8 * gauss(x, 1500, 1200)) / h ** 0.65;
    else a = (0.18 + gauss(x, 1150, 420) + 0.6 * gauss(x, 2900, 800)) / h ** 0.25;
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
  const start = startOf(ev);
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

// ---------- plucked strings (Karplus-Strong with all-pass tuning) ----------
const PLUCKS = {
  pizz: { sustain: 0.994, bright: 0.35, gain: 0.9 },
  bass: { sustain: 0.997, bright: 0.25, gain: 1.1 },
  cello: { sustain: 0.996, bright: 0.3, gain: 1.0 },
  harp: { sustain: 0.9985, bright: 0.55, gain: 0.45 },
  guitar: { sustain: 0.995, bright: 0.6, gain: 0.4 },
  harpsichord: { sustain: 0.997, bright: 0.95, gain: 0.35 },
  jazzPizz: { sustain: 0.99, bright: 0.42, gain: 0.8, damp: 0.06 },
};

function renderPluck(out, ev, rand, { sustain, bright, gain, damp = 0.3 }) {
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
  const n = Math.floor(Math.min(ev.dur + damp * 2, 2.5) * SR);
  const start = startOf(ev);
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
    const release = t > ev.dur + damp ? Math.max(0, 1 - (t - ev.dur - damp) / damp) : 1;
    out[start + i] += a * gain * ev.vel * release;
  }
}

// ---------- keys ----------
function renderEp(out, ev) {
  const f = mtof(ev.midi);
  const n = Math.floor((ev.dur + 0.4) * SR);
  const start = startOf(ev);
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / SR;
    const e = Math.exp(-t / 0.9) * Math.min(1, t / 0.004) * (t > ev.dur ? Math.max(0, 1 - (t - ev.dur) / 0.3) : 1);
    out[start + i] += ev.vel * 0.35 * e * (Math.sin(TAU * f * t) + 0.32 * Math.sin(TAU * 2 * f * t) * Math.exp(-t / 0.25) + 0.1 * Math.sin(TAU * 3 * f * t) * Math.exp(-t / 0.12) + 0.12 * Math.sin(TAU * 7.1 * f * t) * Math.exp(-t / 0.05));
  }
}

// Upright bass: plucked string with per-harmonic decay, a short pitch settle
// at the attack, a wooden body bump and finger noise. Damped after `dur`
// like a walking line.
function renderUpright(out, ev, rand) {
  const f = mtof(ev.midi);
  const start = startOf(ev);
  const n = Math.floor((ev.dur + 0.12) * SR);
  const pos = 0.17 + rand() * 0.04;
  const partials = [];
  for (let h = 1; h <= 14 && h * f < 2600; h++) {
    const fh = h * f * (1 + 0.0003 * h * h);
    const body = 1 + 0.9 * gauss(fh, 105, 45) + 0.35 * gauss(fh, 230, 90);
    const amp = (Math.abs(Math.sin(Math.PI * h * pos)) / h ** 0.95) * body * (fh > 1200 ? Math.exp(-(fh - 1200) / 500) : 1);
    partials.push({ w: (TAU * fh) / SR, amp, k: Math.exp(-1 / ((1.3 / (1 + 0.55 * (h - 1))) * SR)), ph: rand() * TAU });
  }
  const tmp = new Float32Array(n);
  for (const p of partials) {
    let g = p.amp;
    let ph = p.ph;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      ph += p.w * (1 + 0.01 * Math.exp(-t / 0.028));
      tmp[i] += g * Math.sin(ph);
      g *= p.k;
    }
  }
  const finger = new Float32Array(Math.floor(0.03 * SR));
  for (let i = 0; i < finger.length; i++) finger[i] = (rand() * 2 - 1) * Math.exp(-i / (0.006 * SR));
  filter(finger, 'bandpass', 650 + rand() * 250, 0.9);
  for (let i = 0; i < finger.length; i++) tmp[i] += finger[i] * 0.5;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / SR;
    const e = Math.min(1, t / 0.003) * (t > ev.dur ? Math.exp(-(t - ev.dur) / 0.035) : 1);
    out[start + i] += tmp[i] * e * ev.vel * 0.55;
  }
}

// Vibraphone: tuned bar partials (1 : 4 : 10), soft mallet click, gentle
// motor tremolo, damped by the pedal after `dur`.
function renderVibes(out, ev, rand) {
  const f = mtof(ev.midi);
  const start = startOf(ev);
  const n = Math.floor((ev.dur + 0.5) * SR);
  const parts = [
    { r: 1, a: 1, tau: 1.8 },
    { r: 4, a: 0.22, tau: 0.32 },
    { r: 10, a: 0.05, tau: 0.06 },
  ].filter((p) => p.r * f < 12000);
  const ph0 = rand() * TAU;
  const tremPh = rand() * TAU;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / SR;
    let v = 0;
    for (const p of parts) v += p.a * Math.exp(-t / p.tau) * Math.sin(TAU * f * p.r * t + ph0 * p.r);
    const trem = 1 - 0.18 * (0.5 + 0.5 * Math.sin(TAU * 5.2 * t + tremPh));
    const e = Math.min(1, t / 0.0015) * (t > ev.dur ? Math.exp(-(t - ev.dur) / 0.12) : 1);
    out[start + i] += v * trem * e * ev.vel * 0.6;
  }
}

// ---------- drums ----------
function noiseBurst(out, ev, rand, { freq, q, attack, decay, gain = 0.6, type = 'bandpass' }) {
  const n = Math.floor((attack + decay * 6) * SR);
  const start = startOf(ev);
  const tmp = new Float32Array(n);
  for (let i = 0; i < n; i++) tmp[i] = rand() * 2 - 1;
  filter(tmp, type, freq, q);
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / SR;
    out[start + i] += tmp[i] * ev.vel * gain * Math.min(1, t / attack) * Math.exp(-Math.max(0, t - attack) / decay);
  }
}

const RIDE_F = [3150, 4410, 5370, 6230, 7900, 9620];
function renderRide(out, ev, rand) {
  const start = startOf(ev);
  const n = Math.floor(0.9 * SR);
  const ph = RIDE_F.map(() => rand() * TAU);
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / SR;
    let v = 0;
    for (let k = 0; k < RIDE_F.length; k++) v += Math.sin(TAU * RIDE_F[k] * t + ph[k]) / (1 + k * 0.4);
    out[start + i] += v * 0.11 * ev.vel * Math.min(1, t / 0.001) * Math.exp(-t / 0.35);
  }
  noiseBurst(out, ev, rand, { freq: 7000, q: 0.7, attack: 0.001, decay: 0.03, gain: 0.25, type: 'highpass' });
}

function renderKick(out, ev) {
  const start = startOf(ev);
  const n = Math.floor(0.25 * SR);
  let ph = 0;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / SR;
    ph += (TAU * (52 + 40 * Math.exp(-t / 0.02))) / SR;
    out[start + i] += Math.sin(ph) * Math.exp(-t / 0.09) * ev.vel * 0.9;
  }
}

// Brush circling the snare head: a swell on every beat of the bar.
function renderSweep(out, ev, rand) {
  const n = Math.floor(ev.dur * SR);
  const start = startOf(ev);
  const tmp = new Float32Array(n);
  for (let i = 0; i < n; i++) tmp[i] = rand() * 2 - 1;
  filter(tmp, 'bandpass', 3800, 0.55);
  const beat = ev.beat || 0.4;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / SR;
    const ph = (t / beat) % 1;
    out[start + i] += tmp[i] * ev.vel * 0.3 * (0.25 + 0.75 * Math.sin(Math.PI * ph) ** 2) * Math.min(1, t / 0.05) * Math.min(1, (ev.dur - t) / 0.05);
  }
}

export const INSTRUMENTS = {
  oboe: (o, e, r) => renderReed(o, e, r, 'oboe'),
  clarinet: (o, e, r) => renderReed(o, e, r, 'clarinet'),
  bassoon: (o, e, r) => renderReed(o, e, r, 'bassoon'),
  accordion: (o, e, r) => renderReed(o, e, r, 'accordion'),
  ep: (o, e) => renderEp(o, e),
  upright: renderUpright,
  vibes: renderVibes,
  ride: (o, e, r) => noiseBurst(o, e, r, { freq: 7500, q: 0.8, attack: 0.002, decay: 0.03 }),
  brush: (o, e, r) => noiseBurst(o, e, r, { freq: 3500, q: 0.6, attack: 0.04, decay: 0.05 }),
  jazzRide: renderRide,
  snare: (o, e, r) => noiseBurst(o, e, r, { freq: 2600, q: 0.7, attack: 0.003, decay: 0.055, gain: 0.5 }),
  hat: (o, e, r) => noiseBurst(o, e, r, { freq: 8000, q: 0.7, attack: 0.001, decay: 0.018, gain: 0.35, type: 'highpass' }),
  kick: renderKick,
  sweep: renderSweep,
  ...Object.fromEntries(Object.entries(PLUCKS).map(([name, p]) => [name, (o, e, r) => renderPluck(o, e, r, p)])),
};
