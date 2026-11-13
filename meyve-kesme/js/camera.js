// Camera framing as a pure function of time. 'fixed' keeps one gently
// drifting view; 'dynamic' gives every round its own shot (angle, height,
// distance), eases into it while the item drops, pushes in slowly while the
// knife works and pulls back for the final reveal.
import { mulberry32, hashSeed } from './rng.js';

export const CAMERA_MODES = ['dynamic', 'fixed'];
export const CAMERA_TARGET = [0, 0.66, 0.35];

// az / el in degrees, dist in scene units. Shot 0 is the classic framing.
const SHOTS = [
  { az: 30, el: 29, dist: 12.6 },
  { az: 19, el: 33, dist: 11.7 },
  { az: 41, el: 25, dist: 12.3 },
  { az: 25, el: 21, dist: 11.5 },
  { az: 36, el: 36, dist: 13.0 },
  { az: 15, el: 27, dist: 12.1 },
];
const EASE_IN = 1.0; // seconds from round start to settle into the new shot
const PUSH = 0.07; // relative push-in over a round
const DRIFT = 4; // degrees of orbit over a round
const FLAT_LIFT = 9; // look down more on flat items (pizza, cookie)

const smooth = (x) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

export function buildCameraPlan(timeline, mode = 'dynamic', seed = 1) {
  if (mode !== 'dynamic') return { mode: 'fixed' };
  const rand = mulberry32(hashSeed('camera', seed));
  const order = SHOTS.slice(1).map((s, i) => ({ i: i + 1, k: rand() })).sort((a, b) => a.k - b.k).map((o) => o.i);
  const rounds = timeline.rounds.map((r, idx) => {
    const shot = SHOTS[idx === 0 ? 0 : order[(idx - 1) % order.length]];
    return {
      start: r.start,
      land: r.land,
      work: r.lastCut,
      end: r.end,
      last: idx === timeline.rounds.length - 1,
      dir: idx % 2 ? -1 : 1,
      az: shot.az,
      el: shot.el + (r.flat ? FLAT_LIFT : 0),
      dist: shot.dist,
      targetY: r.flat ? CAMERA_TARGET[1] - 0.25 : CAMERA_TARGET[1],
    };
  });
  return { mode: 'dynamic', rounds };
}

// Framing within one round at time t (before any blend with the previous one).
function roundView(r, t) {
  const p = smooth((t - r.land) / Math.max(0.1, r.work - r.land));
  let dist = r.dist * (1 - PUSH * p);
  if (r.last) dist *= 1 + 0.08 * smooth((t - r.work) / 2.2);
  return { az: r.az + DRIFT * (p - 0.5) * r.dir, el: r.el, dist, targetY: r.targetY };
}

function fixedView(t) {
  return { az: 30 + 5 * Math.sin(t * 0.11), el: 29 + 2 * Math.sin(t * 0.07 + 1), dist: 12.6, targetY: CAMERA_TARGET[1] };
}

export function cameraView(plan, t) {
  if (!plan || plan.mode !== 'dynamic') return fixedView(t);
  const rs = plan.rounds;
  let i = rs.length - 1;
  while (i > 0 && t < rs[i].start) i--;
  const cur = roundView(rs[i], t);
  if (i === 0) return cur;
  const k = smooth((t - rs[i].start) / EASE_IN);
  if (k >= 1) return cur;
  const prev = roundView(rs[i - 1], Math.min(t, rs[i - 1].end));
  const mix = (a, b) => a + (b - a) * k;
  return { az: mix(prev.az, cur.az), el: mix(prev.el, cur.el), dist: mix(prev.dist, cur.dist), targetY: mix(prev.targetY, cur.targetY) };
}

// World-space camera position and look-at target for a view.
export function cameraPose(view) {
  const az = (view.az * Math.PI) / 180;
  const el = (view.el * Math.PI) / 180;
  const [tx, , tz] = CAMERA_TARGET;
  const ty = view.targetY;
  return {
    position: [tx + view.dist * Math.cos(el) * Math.sin(az), ty + view.dist * Math.sin(el), tz + view.dist * Math.cos(el) * Math.cos(az)],
    target: [tx, ty, tz],
  };
}
