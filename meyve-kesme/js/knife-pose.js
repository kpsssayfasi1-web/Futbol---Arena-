// Knife position/orientation as a pure function of the round state.
// Knife local frame: +x along the blade towards the tip, +y towards the spine,
// origin on the edge at the heel. Quaternions are [x, y, z, w].
import { strokeStart } from './timeline.js';

export const BLADE_LENGTH = 2.4;
const HEEL_GAP = 0.28;

function quatFromBasis(X, Y, Z) {
  const m00 = X[0], m01 = Y[0], m02 = Z[0];
  const m10 = X[1], m11 = Y[1], m12 = Z[1];
  const m20 = X[2], m21 = Y[2], m22 = Z[2];
  const tr = m00 + m11 + m22;
  let x, y, z, w;
  if (tr > 0) {
    const s = 0.5 / Math.sqrt(tr + 1);
    w = 0.25 / s;
    x = (m21 - m12) * s;
    y = (m02 - m20) * s;
    z = (m10 - m01) * s;
  } else if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    w = (m21 - m12) / s;
    x = 0.25 * s;
    y = (m01 + m10) / s;
    z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    w = (m02 - m20) / s;
    x = (m01 + m10) / s;
    y = 0.25 * s;
    z = (m12 + m21) / s;
  } else {
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
    w = (m10 - m01) / s;
    x = (m02 + m20) / s;
    y = (m12 + m21) / s;
    z = 0.25 * s;
  }
  return [x, y, z, w];
}

export function quatMul(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

export function quatAxisAngle(axis, angle) {
  const s = Math.sin(angle / 2);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)];
}

export function slerp(a, b, t) {
  let cos = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bb = b;
  if (cos < 0) {
    cos = -cos;
    bb = b.map((v) => -v);
  }
  if (cos > 0.9995) {
    const r = a.map((v, i) => v + (bb[i] - v) * t);
    const l = Math.hypot(...r);
    return r.map((v) => v / l);
  }
  const th = Math.acos(cos);
  const s = Math.sin(th);
  const wa = Math.sin((1 - t) * th) / s;
  const wb = Math.sin(t * th) / s;
  return a.map((v, i) => v * wa + bb[i] * wb);
}

// Blade plane per cutting axis.
export const AXIS_QUAT = [
  quatFromBasis([0, 0, -1], [0, 1, 0], [1, 0, 0]), // X cuts: vertical blade, tip away from camera
  quatFromBasis([0, 0, -1], [1, 0, 0], [0, -1, 0]), // Y cuts: flat blade, edge towards -x
  quatFromBasis([-1, 0, 0], [0, 1, 0], [0, 0, -1]), // Z cuts: vertical blade, handle on the right
];
const REST_QUAT = quatMul(AXIS_QUAT[0], quatAxisAngle([0, 0, 1], 0.5));

const easeOut = (x) => 1 - (1 - x) ** 3;
const easeIn = (x) => x * x * x;
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

function geometry(round) {
  const { min, max } = round.bbox;
  return {
    top: max[1] + 0.32,
    board: round.boardY + 0.003,
    heelZ: max[2] + HEEL_GAP,
    heelX: max[0] + HEEL_GAP,
    xStart: max[0] + 0.14,
    xEnd: min[0] - 0.12,
  };
}

// Pose of the knife exactly when cut `index` on `axis` lands.
function contactPose(round, axis, index, g) {
  const plane = round.phases[axis].planes[index];
  if (axis === 0) return { pos: [plane, g.board, g.heelZ], quat: AXIS_QUAT[0] };
  if (axis === 1) return { pos: [g.xEnd, plane, g.heelZ], quat: AXIS_QUAT[1] };
  return { pos: [g.heelX, g.board, plane], quat: AXIS_QUAT[2] };
}

function hoverPose(round, axis, index, g) {
  const plane = round.phases[axis].planes[index];
  if (axis === 0) return { pos: [plane, g.top, g.heelZ], quat: AXIS_QUAT[0] };
  if (axis === 1) return { pos: [g.xStart, plane, g.heelZ], quat: AXIS_QUAT[1] };
  return { pos: [g.heelX, g.top, plane], quat: AXIS_QUAT[2] };
}

export function restPose(round) {
  const { max } = round.bbox;
  return { pos: [max[0] + 0.7, max[1] + 2.6, 0.45], quat: REST_QUAT };
}

function blend(a, b, t) {
  return { pos: a.pos.map((v, i) => lerp(v, b.pos[i], t)), quat: slerp(a.quat, b.quat, t) };
}

function withArc(pose, lift) {
  return { pos: [pose.pos[0], pose.pos[1] + lift, pose.pos[2]], quat: pose.quat };
}

function chopPose(axis, s, from, hover, contact, first) {
  if (first) {
    if (s < 0.55) {
      const k = smooth(0, 0.55, s);
      return withArc(blend(from, hover, k), Math.sin(k * Math.PI) * 0.35);
    }
    return blend(hover, contact, easeIn((s - 0.55) / 0.45));
  }
  const up = s < 0.38 ? easeOut(s / 0.38) : s < 0.55 ? 1 : 1 - easeIn((s - 0.55) / 0.45);
  const lateral = smooth(0.1, 0.55, s);
  const latIdx = axis === 0 ? 0 : 2;
  const pos = contact.pos.slice();
  pos[latIdx] = lerp(from.pos[latIdx], contact.pos[latIdx], lateral);
  pos[1] = lerp(contact.pos[1], hover.pos[1], up);
  return { pos, quat: contact.quat };
}

function slicePose(s, from, hover, contact, first) {
  if (first) {
    if (s < 0.5) {
      const k = smooth(0, 0.5, s);
      return withArc(blend(from, hover, k), Math.sin(k * Math.PI) * 0.3);
    }
  } else if (s < 0.5) {
    // pull back out along the previous plane, then drop to the next height
    const back = smooth(0, 0.35, s);
    const drop = smooth(0.33, 0.5, s);
    return { pos: [lerp(from.pos[0], hover.pos[0], back), lerp(from.pos[1], hover.pos[1], drop), hover.pos[2]], quat: hover.quat };
  }
  const k = (s - 0.5) / 0.5;
  const e = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k);
  return { pos: [lerp(hover.pos[0], contact.pos[0], e), hover.pos[1], hover.pos[2]], quat: hover.quat };
}

// Tip dips slightly while the blade is raised: small roll about the blade normal.
function addRock(pose, axis, g) {
  if (axis === 1) return pose;
  const h = Math.min(1, Math.max(0, (pose.pos[1] - g.board) / (g.top - g.board)));
  return { pos: pose.pos, quat: quatMul(pose.quat, quatAxisAngle([0, 0, 1], -0.09 * h)) };
}

// Returns { pos, quat, edge, interval } where edge is the coordinate the blade
// edge has reached (used to reveal the cut line as the knife passes).
export function knifePose(round, state, t) {
  const g = geometry(round);
  const rest = restPose(round);
  const a = state.active;
  if (!a) {
    if (t < round.land) return { ...rest, edge: Infinity, interval: 1 };
    const zp = round.phases[2];
    const last = contactPose(round, 2, zp.n - 1, g);
    const k = smooth(0, 0.7, t - zp.times[zp.n - 1]);
    return { ...withArc(blend(last, rest, k), Math.sin(k * Math.PI) * 0.4), edge: -Infinity, interval: 1 };
  }
  const first = a.index === 0;
  let from;
  if (!first) from = contactPose(round, a.axis, a.index - 1, g);
  else if (a.axis === 0) from = rest;
  else from = contactPose(round, a.axis - 1, round.phases[a.axis - 1].n - 1, g);
  const hover = hoverPose(round, a.axis, a.index, g);
  const contact = contactPose(round, a.axis, a.index, g);
  const pose = a.axis === 1 ? slicePose(a.s, from, hover, contact, first) : addRock(chopPose(a.axis, a.s, from, hover, contact, first), a.axis, g);
  const edge = a.axis === 1 ? pose.pos[0] : pose.pos[1];
  return { ...pose, edge, interval: a.interval };
}

export { strokeStart };
