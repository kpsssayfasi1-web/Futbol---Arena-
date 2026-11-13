// Knife and transition sounds of a round, derived from the cut schedule.
// { t, type, gain, rate, variant, profile } sorted by time. Cube landings are a
// separate pre-mixed track (landing.js).
import { mulberry32, hashSeed } from './rng.js';
import { itemById } from './catalog/index.js';
import { CUT_CONTACTS, SLICE_CONTACTS, CUT_VARIANTS, SLICE_VARIANTS } from './sfx.js';

const MIN_GAP = 0.034; // at most ~30 knife sounds per second
const DENSE = 0.14; // cut interval below which strokes blend together

// The swish length closest to the time available before the cut, nudged by a
// small playback-rate change so its contact moment lands exactly on the cut.
export function pickContact(contacts, wanted) {
  let block = 0;
  for (let i = 1; i < contacts.length; i++) if (Math.abs(Math.log(contacts[i] / wanted)) < Math.abs(Math.log(contacts[block] / wanted))) block = i;
  const rate = Math.min(1.25, Math.max(1, contacts[block] / wanted));
  return { block, rate, lead: contacts[block] / rate };
}

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
      // Dense cutting: the blade's swish carries the sound, the knocks recede
      // (overlapping knocks would otherwise turn into a mid-range drone).
      const dense = 1 - Math.min(1, interval / DENSE);
      const swishGain = loud * (1 + 0.7 * dense);
      const knockGain = loud * (1 - 0.55 * dense);
      const slicing = phase.axis === 1;
      const { block, rate, lead } = pickContact(slicing ? SLICE_CONTACTS : CUT_CONTACTS, 0.45 * Math.max(interval, MIN_GAP));
      const per = slicing ? SLICE_VARIANTS : CUT_VARIANTS;
      const variant = block * per + Math.floor(rand() * per);
      if (slicing) {
        out.push({ t: t - lead, type: 'slice', gain: 0.8 * swishGain, rate, variant, profile });
        out.push({ t, type: 'thock', gain: 0.45 * knockGain, rate: 1.05 + rand() * 0.1, variant, profile });
      } else {
        out.push({ t: t - lead, type: 'cut', gain: 0.6 * swishGain, rate, variant, profile });
        out.push({ t, type: 'thock', gain: 0.8 * knockGain, rate: 0.95 + rand() * 0.1, variant, profile });
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
