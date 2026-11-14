// Camera framing as a pure function of time. 'dynamic' (default) gives every
// round its own shot (angle, height, distance): the shot changes with the hard
// cut to the next item, pushes in slowly while the knife works and pulls back
// for the final reveal. 'fixed' holds one shot for the whole video.
import { mulberry32, hashSeed } from './rng.js';

export const CAMERA_MODES = ['dynamic', 'fixed'];
export const FIXED_SHOT = { az: 28, el: 33, dist: 12.2 };
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

function fixedView() {
  return { ...FIXED_SHOT, targetY: CAMERA_TARGET[1] };
}

export function cameraView(plan, t) {
  if (!plan || plan.mode !== 'dynamic') return fixedView();
  const rs = plan.rounds;
  let i = rs.length - 1;
  while (i > 0 && t < rs[i].start) i--;
  // every round opens on a fresh item, so the new shot starts with it (a cut)
  return roundView(rs[i], t);
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
