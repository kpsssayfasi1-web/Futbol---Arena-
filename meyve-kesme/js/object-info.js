// Measurements of a catalog item, derived from its distance function: tight
// bounding box, resting height on the board, volume, silhouettes and the
// footprint the pile must avoid. Cached per item.
import { compileJs } from './sdf.js';
import { META } from './catalog/meta.js';

const DEFAULT_BOUNDS = [[-1.6, -1.4, -1.6], [1.6, 1.6, 1.6]];
const shapes = new Map();
const infos = new Map();

export function shapeOf(item) {
  if (!shapes.has(item.id)) shapes.set(item.id, compileJs(item.shape));
  return shapes.get(item.id);
}

export function isInside(item, x, y, z) {
  return shapeOf(item).sdf(x, y, z) < 0;
}

// Surface position between an inside point a and an outside point b (along one axis).
function bisect(sdf, a, b, axis, steps = 14) {
  let lo = a.slice();
  let hi = b.slice();
  for (let s = 0; s < steps; s++) {
    const mid = lo.slice();
    mid[axis] = (lo[axis] + hi[axis]) / 2;
    if (sdf(mid[0], mid[1], mid[2]) < 0) lo = mid;
    else hi = mid;
  }
  return (lo[axis] + hi[axis]) / 2;
}

// Short hash of everything that defines the shape, to detect stale metadata.
export function shapeHash(item) {
  const s = JSON.stringify([item.shape, item.bounds || null]);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h.toString(36);
}

function fromMeta(item) {
  const m = META[item.id];
  if (!m || m.hash !== shapeHash(item)) return null;
  const bits = Uint8Array.from(atob(m.fp), (ch) => ch.charCodeAt(0));
  const { G, x0, z0, cx, cz } = m.fpGrid;
  return {
    bbox: m.bbox, boardY: m.boardY, volume: m.volume, areas: m.areas, widths: m.widths,
    footprint: (x, z) => {
      const i = Math.floor((x - x0) / cx);
      const k = Math.floor((z - z0) / cz);
      if (i < 0 || k < 0 || i >= G || k >= G) return false;
      const b = i * G + k;
      return (bits[b >> 3] >> (b & 7)) & 1;
    },
  };
}

export function objectInfo(item) {
  if (infos.has(item.id)) return infos.get(item.id);
  const meta = fromMeta(item);
  if (meta) {
    infos.set(item.id, meta);
    return meta;
  }
  return measure(item);
}

// Full measurement (used by tools/build-meta.mjs and when metadata is stale).
export function measure(item) {
  const { sdf } = shapeOf(item);
  const [bmin, bmax] = item.bounds || DEFAULT_BOUNDS;
  const G = 60;
  const cell = [0, 1, 2].map((k) => (bmax[k] - bmin[k]) / G);
  const c = (k, i) => bmin[k] + (i + 0.5) * cell[k];
  const inside = new Uint8Array(G * G * G);
  const idx = (i, j, k) => (i * G + j) * G + k;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const near = Math.max(...cell) * 0.5;
  let count = 0;
  for (let i = 0; i < G; i++) {
    for (let j = 0; j < G; j++) {
      for (let k = 0; k < G; k++) {
        const p = [c(0, i), c(1, j), c(2, k)];
        const d = sdf(p[0], p[1], p[2]);
        if (d < 0) {
          inside[idx(i, j, k)] = 1;
          count++;
        }
        if (d < near) {
          for (let a = 0; a < 3; a++) {
            min[a] = Math.min(min[a], p[a]);
            max[a] = Math.max(max[a], p[a]);
          }
        }
      }
    }
  }
  if (!count) throw new Error(`item ${item.id} has no volume inside its bounds`);
  // Exact resting height: the lowest surface point over all columns.
  let boardY = Infinity;
  const projX = new Uint8Array(G * G);
  const projY = new Uint8Array(G * G);
  const projZ = new Uint8Array(G * G);
  for (let i = 0; i < G; i++) {
    for (let k = 0; k < G; k++) {
      for (let j = 0; j < G; j++) {
        if (!inside[idx(i, j, k)]) continue;
        projY[i * G + k] = 1;
        if (j === 0 || !inside[idx(i, j - 1, k)]) {
          const p = [c(0, i), c(1, j), c(2, k)];
          boardY = Math.min(boardY, bisect(sdf, p, [p[0], p[1] - cell[1], p[2]], 1));
        }
      }
    }
  }
  for (let j = 0; j < G; j++) {
    for (let k = 0; k < G; k++) {
      for (let i = 0; i < G; i++) {
        if (!inside[idx(i, j, k)]) continue;
        projX[j * G + k] = 1;
        projZ[i * G + j] = 1;
      }
    }
  }
  for (let a = 0; a < 3; a++) {
    min[a] -= cell[a] * 0.5;
    max[a] += cell[a] * 0.5;
  }
  min[1] = Math.max(min[1], boardY - 0.002);
  const sum = (arr) => arr.reduce((s, v) => s + v, 0);
  const info = {
    bbox: { min, max },
    boardY,
    volume: count * cell[0] * cell[1] * cell[2],
    areas: [sum(projX) * cell[1] * cell[2], sum(projY) * cell[0] * cell[2], sum(projZ) * cell[0] * cell[1]],
    widths: [0, 1, 2].map((a) => max[a] - min[a]),
    footprint: (x, z) => {
      const i = Math.floor((x - bmin[0]) / cell[0]);
      const k = Math.floor((z - bmin[2]) / cell[2]);
      return i >= 0 && k >= 0 && i < G && k < G && projY[i * G + k] === 1;
    },
    fpRaw: { bits: projY, G, x0: bmin[0], z0: bmin[2], cx: cell[0], cz: cell[2] },
  };
  infos.set(item.id, info);
  return info;
}

// Expected number of grid cells (size a,b,c) touching the body: volume of the
// Minkowski sum with one cell, exact for convex bodies.
export function estimateCellCount(info, a, b, c) {
  const [Ax, Ay, Az] = info.areas;
  const [wx, wy, wz] = info.widths;
  const v = info.volume + a * Ax + b * Ay + c * Az + a * b * wz + b * c * wx + a * c * wy + a * b * c;
  return v / (a * b * c);
}
