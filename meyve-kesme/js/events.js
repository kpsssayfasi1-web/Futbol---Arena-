// Knife sounds of a round, derived from the cut schedule, modelled on the
// reference Shorts: every top-down and front-to-back cut is the blade going
// through the item, a knock on the board and the blade ringing; the single
// horizontal pass and the cut to the next round are silent, and so are the
// falling cubes. { t, type, gain, rate, variant, profile } sorted by time.
import { mulberry32, hashSeed } from './rng.js';
import { itemById } from './catalog/index.js';
import { CUT_CONTACTS, CUT_VARIANTS } from './sfx.js';

const MIN_GAP = 0.034; // at most ~30 knife sounds per second
const DENSE = 0.14; // cut interval below which strokes blend together
const RING_GAIN = 0.42;

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
  if (round.land > round.start) {
    // only when an item drops in (TIMING.drop > 0)
    if (round.index > 0) out.push({ t: round.start + 0.02, type: 'whoosh', gain: 0.25, rate: 1, variant: round.index, profile });
    out.push({ t: round.land, type: 'drop', gain: 0.85, rate: 1, variant: round.index, profile });
  }
  for (const phase of round.phases) {
    if (phase.axis === 1) continue; // the horizontal pass glides through silently
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
      const knockGain = loud * (1 - 0.7 * dense);
      const { block, rate, lead } = pickContact(CUT_CONTACTS, 0.45 * Math.max(interval, MIN_GAP));
      const variant = block * CUT_VARIANTS + Math.floor(rand() * CUT_VARIANTS);
      out.push({ t: t - lead, type: 'cut', gain: 1.3 * swishGain, rate, variant, profile });
      out.push({ t, type: 'thock', gain: 0.55 * knockGain, rate: 0.95 + rand() * 0.1, variant: Math.floor(rand() * 6), profile });
      // the blade rings a moment after the knock; the ring carries the dense
      // passages, so it recedes less than the knock does
      out.push({ t: t + 0.004, type: 'ring', gain: RING_GAIN * loud * (1 - 0.1 * dense), rate: 1, variant: Math.floor(rand() * 4), profile });
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
