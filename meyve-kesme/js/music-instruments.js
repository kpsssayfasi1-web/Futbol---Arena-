// Synthesized instruments for the background music. Each renderer adds one
// note event { t, dur, midi, vel } into a mono buffer. Pizzicato strings are
// Karplus-Strong; the upright bass, keys, vibraphone and the kit are additive /
// filtered-noise models. Pure JS, runs in the worker.
import { filter, SAMPLE_RATE } from './sfx.js';

const SR = SAMPLE_RATE;
const TAU = Math.PI * 2;
export const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

const startOf = (ev) => Math.floor(ev.t * SR);
const gauss = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));

// ---------- plucked strings (Karplus-Strong with all-pass tuning) ----------
const JAZZ_PIZZ = { sustain: 0.99, bright: 0.42, gain: 0.8, damp: 0.06 };

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

// Finger snap: a bright crack plus a short skin "pop".
function renderSnap(out, ev, rand) {
  noiseBurst(out, ev, rand, { freq: 2100, q: 1.1, attack: 0.0006, decay: 0.022, gain: 0.9 });
  noiseBurst(out, ev, rand, { freq: 5200, q: 0.8, attack: 0.0004, decay: 0.008, gain: 0.35 });
}

export const INSTRUMENTS = {
  ep: (o, e) => renderEp(o, e),
  upright: renderUpright,
  vibes: renderVibes,
  jazzPizz: (o, e, r) => renderPluck(o, e, r, JAZZ_PIZZ),
  jazzRide: renderRide,
  snare: (o, e, r) => noiseBurst(o, e, r, { freq: 2600, q: 0.7, attack: 0.003, decay: 0.055, gain: 0.5 }),
  snap: renderSnap,
  hat: (o, e, r) => noiseBurst(o, e, r, { freq: 8000, q: 0.7, attack: 0.001, decay: 0.018, gain: 0.35, type: 'highpass' }),
  kick: renderKick,
  sweep: renderSweep,
};
