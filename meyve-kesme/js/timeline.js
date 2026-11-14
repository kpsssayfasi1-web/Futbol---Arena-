// The whole video is a pure function of time. This module lays out every round,
// phase and individual cut so any moment can be rendered (or seeked) directly.
import { itemById, itemForRound } from './catalog/index.js';
import { objectInfo } from './object-info.js';

export const ROUND_PRESETS = {
  classic: [10, 50, 100, 250, 500, 1000],
  short: [10, 100, 1000],
  legend: [10, 100, 500, 1000, 2500, 5000],
};

// Reference pacing: every round opens on a fresh item already on the board with
// the knife resting on it, the knife keeps an even beat, and a round ends with
// a short look at the pile followed by a hard cut to the next item.
export const TIMING = {
  drop: 0, // the item is on the board from the first frame of its round
  ready: 0.4, // knife rests on the item before the first cut
  phaseGap: 0.12,
  sweep: 0.95, // the single horizontal pass: swing round, then a slow glide
  tail: 0.65, // last cut -> hard cut to the next round
  finalHold: 3.0, // the final pile and total stay on screen
  outro: 0, // previous pile is gone the moment the next round starts
  hook: 1.7, // opening question on screen
  accel: 1, // even beat within a phase (< 1 would speed up)
};

export const AXIS_X = 0;
export const AXIS_Y = 1;
export const AXIS_Z = 2;

// Items flatter than this (height / smaller footprint side) get no horizontal
// cuts: slicing a pizza into layers looks wrong and hides the cut pattern.
export const FLAT_RATIO = 0.4;

export function isFlatItem(item, info) {
  if (typeof item.flat === 'boolean') return item.flat;
  const e = [0, 1, 2].map((k) => info.bbox.max[k] - info.bbox.min[k]);
  return e[1] / Math.min(e[0], e[2]) < FLAT_RATIO;
}

// Half of the cuts go top-down (right to left), one horizontal pass through the
// middle, the rest front to back. Flat items skip the horizontal pass.
export function splitCuts(total, flat = false) {
  if (flat) {
    const n = Math.max(2, Math.round(total));
    const nx = Math.ceil(n / 2);
    return [nx, 0, n - nx];
  }
  const n = Math.max(3, Math.round(total));
  const nx = Math.ceil((n - 1) / 2);
  return [nx, 1, n - 1 - nx];
}

// Seconds for a phase of n top-down or front-to-back cuts: about half a second
// per cut on the opening round, a few seconds even for hundreds of cuts.
export function phaseDuration(n, speed = 1) {
  if (n <= 0) return 0;
  return Math.min(n * 0.45, 2.75 * Math.pow(n, 0.12)) / speed;
}

// Layers of cubes stacked in Y. The single horizontal pass stands for the
// whole stack: pieces come out as cubes, as in the reference videos.
export function cubeLayers(split, bbox) {
  const ext = [0, 1, 2].map((k) => bbox.max[k] - bbox.min[k]);
  const edge = (ext[0] / (split[0] + 1) + ext[2] / (split[2] + 1)) / 2;
  return Math.max(split[1] + 1, Math.round(ext[1] / edge));
}

// Plane positions, in the order the knife makes them: every axis goes from
// its max side, so X runs right to left (the knife starts on the side it rests
// on), Y top to bottom, Z front (camera side) to back.
export function planePositions(axis, n, bbox) {
  const ext = bbox.max[axis] - bbox.min[axis];
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = bbox.max[axis] - ((i + 1) / (n + 1)) * ext;
  return out;
}

export function cutTimes(n, start, duration, accel = TIMING.accel) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = start + duration * Math.pow((i + 1) / n, accel);
  return out;
}

export function buildTimeline({ rounds = ROUND_PRESETS.classic, item = 'apple', speed = 1, seed = 0 } = {}) {
  const list = [];
  let t = 0;
  rounds.forEach((cuts, index) => {
    const itemId = itemForRound(item, index, seed);
    const itemDef = itemById(itemId);
    const info = objectInfo(itemDef);
    const flat = isFlatItem(itemDef, info);
    const split = splitCuts(cuts, flat);
    const start = t;
    const land = start + TIMING.drop;
    const ready = land + TIMING.ready / speed;
    let cursor = ready;
    const phases = split.map((n, axis) => {
      const duration = axis === 1 ? (n > 0 ? TIMING.sweep / speed : 0) : phaseDuration(n, speed);
      const phase = {
        axis,
        n,
        start: cursor,
        end: cursor + duration,
        times: cutTimes(n, cursor, duration),
        planes: planePositions(axis, n, info.bbox),
      };
      if (n > 0) cursor = phase.end + TIMING.phaseGap / speed;
      return phase;
    });
    const lastCut = phases[2].end;
    const isLast = index === rounds.length - 1;
    const end = lastCut + (isLast ? TIMING.finalHold : TIMING.tail);
    const layers = cubeLayers(split, info.bbox);
    list.push({ index, cuts: split[0] + split[1] + split[2], split, layers, flat, itemId, start, land, ready, phases, lastCut, end, bbox: info.bbox, boardY: info.boardY });
    t = end;
  });
  return { rounds: list, duration: t, speed };
}

export function roundIndexAt(timeline, t) {
  const r = timeline.rounds;
  if (t <= r[0].start) return 0;
  for (let i = 0; i < r.length; i++) if (t < r[i].end) return i;
  return r.length - 1;
}

// Number of cuts already finished in a phase at time t (binary search).
export function cutsDone(phase, t) {
  const times = phase.times;
  let lo = 0;
  let hi = times.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// Everything the renderer needs to know about a round at time t.
export function roundState(round, t) {
  const done = round.phases.map((p) => cutsDone(p, t));
  const total = done[0] + done[1] + done[2];
  let active = null;
  for (let a = 0; a < 3; a++) {
    const phase = round.phases[a];
    const c = done[a];
    if (c >= phase.n) continue;
    const prevT = strokeStart(round, a, c);
    if (t >= prevT) {
      const nextT = phase.times[c];
      active = {
        axis: a,
        index: c,
        prevT,
        nextT,
        s: clamp01((t - prevT) / Math.max(1e-6, nextT - prevT)),
        plane: phase.planes[c],
        prevPlane: c === 0 ? null : phase.planes[c - 1],
        interval: nextT - prevT,
      };
    }
    break;
  }
  const zDone = done[2];
  const clipZ = zDone === 0 ? Infinity : round.phases[2].planes[zDone - 1];
  return { done, total, active, clipZ, finished: zDone >= round.phases[2].n };
}

// A stroke starts when the previous cut lands; the first stroke of a round starts
// when the knife leaves its resting spot on the item.
export function strokeStart(round, axis, index) {
  if (index > 0) return round.phases[axis].times[index - 1];
  const prev = previousPhase(round, axis);
  return prev ? prev.times[prev.n - 1] : round.ready ?? round.land;
}

// The last phase before `axis` that has any cuts (flat items skip Y).
export function previousPhase(round, axis) {
  for (let a = axis - 1; a >= 0; a--) if (round.phases[a].n > 0) return round.phases[a];
  return null;
}

// Moment the last cut that frees a given z position happens (cells are freed
// front to back; anything behind the last plane goes with the last cut).
export function releaseTimeForZ(round, z) {
  const ph = round.phases[2];
  for (let i = 0; i < ph.n; i++) if (ph.planes[i] <= z) return ph.times[i];
  return ph.times[ph.n - 1] + 0.12;
}

function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
