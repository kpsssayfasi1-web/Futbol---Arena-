// Original, synthesised soundtrack (no third-party audio, so no Content ID
// claims): crowd bed, ball taps, clashes, goal roars and referee whistles,
// all placed from the simulation's event list.

import { createRng } from '../../tournament/src/rng.js';

export const SAMPLE_RATE = 44100;
const TAU = Math.PI * 2;

function addTone(buf, start, { freq, duration, gain, decay, sweep = 0 }) {
  const from = Math.floor(start * SAMPLE_RATE);
  const len = Math.floor(duration * SAMPLE_RATE);
  let phase = 0;
  for (let i = 0; i < len && from + i < buf.length; i += 1) {
    const t = i / SAMPLE_RATE;
    phase += (TAU * (freq + sweep * t)) / SAMPLE_RATE;
    buf[from + i] += Math.sin(phase) * gain * Math.exp(-t * decay);
  }
}

function addNoiseBurst(buf, start, rng, { duration, gain, attack, decay, smooth }) {
  const from = Math.floor(start * SAMPLE_RATE);
  const len = Math.floor(duration * SAMPLE_RATE);
  let low = 0;
  for (let i = 0; i < len && from + i < buf.length; i += 1) {
    const t = i / SAMPLE_RATE;
    low += (rng.next() * 2 - 1 - low) * smooth;
    const env = Math.min(1, t / attack) * Math.exp(-Math.max(0, t - attack) * decay);
    buf[from + i] += low * gain * env;
  }
}

// Pea whistle: a high tone with a fast warble.
function addWhistle(buf, start, duration, gain) {
  const from = Math.floor(start * SAMPLE_RATE);
  const len = Math.floor(duration * SAMPLE_RATE);
  let phase = 0;
  for (let i = 0; i < len && from + i < buf.length; i += 1) {
    const t = i / SAMPLE_RATE;
    const warble = Math.sin(TAU * 32 * t);
    phase += (TAU * (2850 + 140 * warble)) / SAMPLE_RATE;
    const env = Math.min(1, t / 0.02) * Math.min(1, (duration - t) / 0.04);
    buf[from + i] += Math.sin(phase) * gain * env * (0.75 + 0.25 * warble);
  }
}

function addCrowdBed(buf, rng) {
  let low = 0;
  let lower = 0;
  for (let i = 0; i < buf.length; i += 1) {
    const t = i / SAMPLE_RATE;
    low += (rng.next() * 2 - 1 - low) * 0.08;
    lower += (low - lower) * 0.05;
    const swell = 0.75 + 0.25 * Math.sin(TAU * 0.11 * t) * Math.sin(TAU * 0.037 * t + 1);
    buf[i] += lower * 0.55 * swell;
  }
}

function normalize(buf, peak = 0.89) {
  let max = 0;
  for (const v of buf) max = Math.max(max, Math.abs(v));
  const k = max > 0 ? peak / max : 1;
  return buf.map((v) => v * k);
}

// cues: { matchStart, matchEnd, outroStart, events } in video seconds;
// event times are relative to matchStart.
export function buildSoundtrack({ totalSeconds, matchStart, events, seed }) {
  const rng = createRng(`audio:${seed}`);
  const buf = new Float32Array(Math.ceil(totalSeconds * SAMPLE_RATE));
  addCrowdBed(buf, rng);

  addNoiseBurst(buf, 0.05, rng, { duration: 1.2, gain: 0.5, attack: 0.6, decay: 4, smooth: 0.3 });
  addWhistle(buf, matchStart, 0.55, 0.22);

  let lastTap = -1;
  for (const e of events) {
    const at = matchStart + e.t;
    if (e.type === 'bounce' && at - lastTap > 0.06) {
      addTone(buf, at, { freq: e.team === 0 ? 210 : 175, duration: 0.09, gain: 0.32, decay: 45 });
      addNoiseBurst(buf, at, rng, { duration: 0.02, gain: 0.25, attack: 0.001, decay: 200, smooth: 0.9 });
      lastTap = at;
    } else if (e.type === 'clash') {
      addTone(buf, at, { freq: 620, duration: 0.12, gain: 0.35, decay: 35 });
      addTone(buf, at, { freq: 930, duration: 0.08, gain: 0.18, decay: 50 });
    } else if (e.type === 'goal') {
      addTone(buf, at, { freq: 90, duration: 0.5, gain: 0.7, decay: 6, sweep: -60 });
      addNoiseBurst(buf, at, rng, { duration: 3.2, gain: 2.4, attack: 0.25, decay: 1.1, smooth: 0.12 });
    } else if (e.type === 'fulltime') {
      [0, 0.45, 0.9].forEach((offset, i) => addWhistle(buf, at + offset, i === 2 ? 0.9 : 0.32, 0.22));
      addNoiseBurst(buf, at + 0.9, rng, { duration: 3, gain: 1.4, attack: 0.4, decay: 1, smooth: 0.12 });
    }
  }
  return normalize(buf);
}

export function encodeWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}
