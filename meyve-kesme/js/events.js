// Knife and transition sounds of a round, derived from the cut schedule.
// { t, type, gain, rate, variant, profile } sorted by time. Cube landings are a
// separate pre-mixed track (landing.js).
import { mulberry32, hashSeed } from './rng.js';
import { itemById } from './catalog/index.js';

const MIN_GAP = 0.034; // at most ~30 knife sounds per second

export function roundEvents(round) {
  const rand = mulberry32(hashSeed('sound', round.index, round.cuts, round.itemId));
  const profile = itemById(round.itemId).sound?.cut || 'crisp';
  const out = [];
  if (round.index > 0) out.push({ t: round.start + 0.02, type: 'whoosh', gain: 0.25, rate: 1, variant: round.index, profile });
  out.push({ t: round.land, type: 'drop', gain: 0.85, rate: 1, variant: round.index, profile });
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
        out.push({ t: t - lead, type: 'slice', gain: 0.6 * loud, rate, variant, profile });
      } else {
        out.push({ t: t - lead, type: 'cut', gain: 0.6 * loud, rate, variant, profile });
        out.push({ t, type: 'thock', gain: 0.8 * loud, rate: 0.95 + rand() * 0.1, variant, profile });
      }
      if (phase.axis === 2) out.push({ t: t + 0.03, type: 'crumble', gain: 0.3 * loud, rate: 1, variant, profile });
    }
  }
  return out.sort((a, b) => a.t - b.t);
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
