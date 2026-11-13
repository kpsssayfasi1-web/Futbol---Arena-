// Sound events of a round, derived from the cut schedule and the cube data.
// { t, type, gain, rate, variant } sorted by time.
import { mulberry32, hashSeed } from './rng.js';

const MIN_GAP = 0.034; // at most ~30 knife sounds per second
const FINE_CELL = 0.06; // cubes smaller than this land as "pour" sand

function cutEvents(round, rand, out) {
  for (const phase of round.phases) {
    let lastEmitted = -1;
    for (let i = 0; i < phase.n; i++) {
      const t = phase.times[i];
      const prev = i === 0 ? phase.start - 0.4 : phase.times[i - 1];
      const interval = t - prev;
      if (t - lastEmitted < MIN_GAP) continue;
      lastEmitted = t;
      const loud = interval >= 0.25 ? 1 : 0.5 + 0.5 * (interval / 0.25);
      const lead = Math.min(phase.axis === 1 ? 0.18 : 0.1, 0.45 * Math.max(interval, MIN_GAP));
      const rate = Math.min(2.4, Math.max(1, (phase.axis === 1 ? 0.18 : 0.1) / lead));
      const variant = Math.floor(rand() * 8);
      if (phase.axis === 1) {
        out.push({ t: t - lead, type: 'slice', gain: 0.55 * loud, rate, variant });
      } else {
        out.push({ t: t - lead, type: 'crunch', gain: 0.6 * loud, rate, variant });
        out.push({ t, type: 'thock', gain: 0.85 * loud, rate: 0.95 + rand() * 0.1, variant });
      }
      if (phase.axis === 2) out.push({ t: t + 0.03, type: 'crumble', gain: 0.35 * loud, rate: 1, variant });
    }
  }
}

function landingEvents(data, rand, out) {
  const cell = Math.cbrt(data.cell[0] * data.cell[1] * data.cell[2]);
  const fine = cell < FINE_CELL || !data.exact;
  const bin = fine ? 0.1 : 0.02;
  const counts = new Map();
  for (let i = 0; i < data.count; i++) {
    const land = data.motion[i * 4] + data.motion[i * 4 + 1];
    const k = Math.floor(land / bin);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  for (const [k, c] of counts) {
    const t = k * bin;
    if (fine) {
      const gain = Math.min(1, Math.log1p(c) / Math.log1p(1500)) * 0.75;
      out.push({ t, type: 'pour', gain, rate: Math.min(1.6, 0.9 + 0.02 / cell), variant: Math.floor(rand() * 2), duration: bin * 1.6 });
    } else {
      const n = Math.min(c, 3);
      for (let j = 0; j < n; j++) {
        out.push({ t: t + rand() * bin, type: 'tick', gain: Math.min(0.9, 0.35 + c * 0.05), rate: Math.min(1.8, Math.max(0.55, 0.12 / cell)), variant: Math.floor(rand() * 8) });
      }
    }
  }
}

export function roundEvents(round, data) {
  const rand = mulberry32(hashSeed('sound', round.index, round.cuts));
  const out = [];
  if (round.index > 0) out.push({ t: round.start + 0.02, type: 'whoosh', gain: 0.3, rate: 1, variant: round.index });
  out.push({ t: round.land, type: 'drop', gain: 0.9, rate: 1, variant: round.index });
  cutEvents(round, rand, out);
  if (data) landingEvents(data, rand, out);
  out.sort((a, b) => a.t - b.t);
  return out;
}

export function eventsInWindow(events, from, to) {
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid].t < from) lo = mid + 1;
    else hi = mid;
  }
  const res = [];
  for (let i = lo; i < events.length && events[i].t < to; i++) res.push(events[i]);
  return res;
}
