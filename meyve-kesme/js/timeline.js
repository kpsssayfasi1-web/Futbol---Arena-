// The whole video is a pure function of time. This module lays out every round,
// phase and individual cut so any moment can be rendered (or seeked) directly.
import { FRUIT_ORDER, fruitById, fruitInfo } from './fruits.js';

export const ROUND_PRESETS = {
  classic: [10, 50, 100, 250, 500, 1000],
  short: [10, 100, 1000],
  legend: [10, 100, 500, 1000, 2500, 5000],
};

export const TIMING = {
  drop: 0.5, // fruit falls onto the board
  settle: 0.3, // squash and bounce
  phaseGap: 0.1,
  tail: 1.7, // last slab crumbles
  hold: 0.9,
  finalHold: 2.4,
  outro: 0.45, // previous pile shrinks while the next fruit drops
  accel: 0.7, // < 1: the knife speeds up during a phase
};

export const AXIS_X = 0;
export const AXIS_Y = 1;
export const AXIS_Z = 2;

export function splitCuts(total) {
  const n = Math.max(3, Math.round(total));
  const nx = Math.ceil(n / 3);
  const ny = Math.ceil((n - nx) / 2);
  return [nx, ny, n - nx - ny];
}

export function phaseDuration(n, speed = 1) {
  if (n <= 0) return 0;
  return Math.min(n * 0.33, Math.pow(n, 0.28)) / speed;
}

// Plane positions, in the order the knife makes them. X goes left to right,
// Y top to bottom, Z front (camera side) to back.
export function planePositions(axis, n, bbox) {
  const lo = bbox.min[axis];
  const ext = bbox.max[axis] - lo;
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const f = (i + 1) / (n + 1);
    out[i] = axis === AXIS_X ? lo + f * ext : bbox.max[axis] - f * ext;
  }
  return out;
}

export function cutTimes(n, start, duration, accel = TIMING.accel) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = start + duration * Math.pow((i + 1) / n, accel);
  return out;
}

export function fruitForRound(mode, index) {
  if (mode === 'mix') return FRUIT_ORDER[index % FRUIT_ORDER.length];
  return fruitById(mode).id;
}

export function buildTimeline({ rounds = ROUND_PRESETS.classic, fruit = 'apple', speed = 1 } = {}) {
  const list = [];
  let t = 0;
  rounds.forEach((cuts, index) => {
    const fruitId = fruitForRound(fruit, index);
    const info = fruitInfo(fruitById(fruitId));
    const split = splitCuts(cuts);
    const start = t;
    const land = start + TIMING.drop;
    let cursor = land + TIMING.settle;
    const phases = split.map((n, axis) => {
      const duration = phaseDuration(n, speed);
      const phase = {
        axis,
        n,
        start: cursor,
        end: cursor + duration,
        times: cutTimes(n, cursor, duration),
        planes: planePositions(axis, n, info.bbox),
      };
      cursor = phase.end + TIMING.phaseGap;
      return phase;
    });
    const lastCut = phases[2].end;
    const isLast = index === rounds.length - 1;
    const end = lastCut + TIMING.tail + (isLast ? TIMING.finalHold : TIMING.hold);
    list.push({ index, cuts: split[0] + split[1] + split[2], split, fruitId, start, land, phases, lastCut, end, bbox: info.bbox, boardY: info.boardY });
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
// as soon as the fruit touches the board.
export function strokeStart(round, axis, index) {
  if (index > 0) return round.phases[axis].times[index - 1];
  if (axis === 0) return round.land;
  const prev = round.phases[axis - 1];
  return prev.times[prev.n - 1];
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
