// Builds the cubes of one round: which grid cells hold fruit, when each cube is
// cut free, where it lands in the pile and how it flies there. Pure data, so it
// can run in a worker and be unit tested.
import { itemById } from './catalog/index.js';
import { objectInfo, shapeOf, estimateCellCount } from './object-info.js';
import { mulberry32, hashSeed } from './rng.js';
import { releaseTimeForZ } from './timeline.js';

export const GRAVITY = 15;
export const COARSE_CELL_LIMIT = 12000;
export const BOARD = { minX: -2.15, maxX: 2.15, minZ: -1.45, maxZ: 1.95 };

// Display grid: the real grid when it fits the budget, otherwise a scaled one
// (the counter still shows the real number of cubes).
export function displayGrid(split, budget, info) {
  const cells = split.map((n) => n + 1);
  const total = cells[0] * cells[1] * cells[2];
  const ext = [0, 1, 2].map((k) => info.bbox.max[k] - info.bbox.min[k]);
  const fill = Math.min(1, info.volume / (ext[0] * ext[1] * ext[2]));
  if (total * fill <= budget) return { dims: cells, exact: true };
  const s = Math.cbrt(budget / (total * fill));
  return { dims: cells.map((c) => Math.max(2, Math.floor(c * s))), exact: false };
}

export function trueCubeCount(split, info, exactCount, exact) {
  if (exact) return exactCount;
  const ext = [0, 1, 2].map((k) => info.bbox.max[k] - info.bbox.min[k]);
  return Math.round(estimateCellCount(info, ext[0] / (split[0] + 1), ext[1] / (split[1] + 1), ext[2] / (split[2] + 1)));
}

// Cells that hold part of the object. Thin parts (leaves, stems, wicks) count
// as soon as the surface passes close to a sample point.
function collectCells(sdf, bbox, dims, coarse) {
  const cs = [0, 1, 2].map((k) => (bbox.max[k] - bbox.min[k]) / dims[k]);
  const cubes = [];
  const S = coarse ? 4 : 1;
  const reach = coarse ? Math.min(...cs) / S * 0.35 : Math.min(...cs) * 0.3;
  for (let i = 0; i < dims[0]; i++) {
    for (let j = 0; j < dims[1]; j++) {
      for (let k = 0; k < dims[2]; k++) {
        const x0 = bbox.min[0] + i * cs[0];
        const y0 = bbox.min[1] + j * cs[1];
        const z0 = bbox.min[2] + k * cs[2];
        let hit = false;
        for (let a = 0; a < S && !hit; a++) {
          for (let b = 0; b < S && !hit; b++) {
            for (let c = 0; c < S && !hit; c++) {
              hit = sdf(x0 + ((a + 0.5) / S) * cs[0], y0 + ((b + 0.5) / S) * cs[1], z0 + ((c + 0.5) / S) * cs[2]) < reach;
            }
          }
        }
        if (hit) cubes.push({ home: [x0 + cs[0] / 2, y0 + cs[1] / 2, z0 + cs[2] / 2], size: cs.slice() });
      }
    }
  }
  return { cubes, cs };
}

function makePile(cs, coarse, count, info) {
  const base = Math.max(cs[0], cs[2]);
  const pc = coarse ? base * 1.05 : base * (count > 60000 ? 2 : 1.4);
  const nx = Math.max(4, Math.ceil((BOARD.maxX - BOARD.minX) / pc));
  const nz = Math.max(4, Math.ceil((BOARD.maxZ - BOARD.minZ) / pc));
  const footprint = new Uint8Array(nx * nz);
  for (let i = 0; i < nx; i++) {
    for (let k = 0; k < nz; k++) footprint[i * nz + k] = info.footprint(BOARD.minX + (i + 0.5) * pc, BOARD.minZ + (k + 0.5) * pc) ? 1 : 0;
  }
  return { pc, nx, nz, height: new Float32Array(nx * nz), footprint };
}

const NEIGHBORS = [
  [1, 0, 1], [1, 1, 1.414], [0, 1, 1], [-1, 1, 1.414], [-1, 0, 1], [-1, -1, 1.414], [0, -1, 1], [1, -1, 1.414],
];

function depositCube(pile, cube, clipZ, rand, coarse, boardY) {
  const { pc, nx, nz, height, footprint } = pile;
  const blocked = (i, k) => i < 0 || k < 0 || i >= nx || k >= nz || (footprint[i * nz + k] === 1 && BOARD.minZ + (k + 0.5) * pc < clipZ - pc * 0.5);
  const above = Math.max(0, cube.home[1] - boardY);
  const fwd = above * (0.3 + 0.55 * rand()) + 0.04;
  const side = (rand() - 0.5) * above * 0.55 + cube.home[0] * 0.1;
  let i = Math.floor((cube.home[0] + side - BOARD.minX) / pc);
  let k = Math.floor((cube.home[2] + fwd - BOARD.minZ) / pc);
  i = Math.min(nx - 1, Math.max(0, i));
  k = Math.min(nz - 1, Math.max(0, k));
  for (let guard = 0; guard < nz && blocked(i, k); guard++) k = Math.min(nz - 1, k + 1);
  const repose = pc * (coarse ? 0.7 : 0.6);
  for (let step = 0; step < 128; step++) {
    const h = height[i * nz + k];
    let best = -1;
    let bestDrop = 0;
    const off = Math.floor(rand() * 8);
    for (let n = 0; n < 8; n++) {
      const [di, dk, dist] = NEIGHBORS[(n + off) & 7];
      const a = i + di;
      const b = k + dk;
      if (blocked(a, b)) continue;
      const drop = (h - height[a * nz + b]) / dist;
      if (drop > repose && drop > bestDrop) {
        bestDrop = drop;
        best = (n + off) & 7;
      }
    }
    if (best < 0) break;
    i += NEIGHBORS[best][0];
    k += NEIGHBORS[best][1];
  }
  const idx = i * nz + k;
  const tumbles = above > cube.size[1] * 0.6 ? Math.floor(rand() * 3) : 0;
  const extentY = tumbles % 2 === 1 ? cube.size[2] : cube.size[1];
  const restY = boardY + height[idx] + extentY / 2;
  const vol = cube.size[0] * cube.size[1] * cube.size[2];
  height[idx] += coarse ? extentY * 0.92 : vol / (pc * pc * 0.8);
  const jitter = coarse ? 0.12 : 0.8;
  return {
    rest: [BOARD.minX + (i + 0.5 + (rand() - 0.5) * jitter) * pc, restY, BOARD.minZ + (k + 0.5 + (rand() - 0.5) * jitter) * pc],
    tumble: tumbles * (Math.PI / 2) * (rand() < 0.5 ? -1 : 1),
  };
}

export function flightDuration(homeY, restY, v0) {
  const dy = homeY - restY;
  return (v0 + Math.sqrt(Math.max(0, v0 * v0 + 2 * GRAVITY * dy))) / GRAVITY;
}

export function buildRoundCubes(round, { budget = 120000, seed = 1 } = {}) {
  const item = itemById(round.itemId);
  const info = objectInfo(item);
  const grid = displayGrid(round.split, budget, info);
  const coarse = grid.dims[0] * grid.dims[1] * grid.dims[2] <= COARSE_CELL_LIMIT;
  const { cubes, cs } = collectCells(shapeOf(item).sdf, round.bbox, grid.dims, coarse);
  const rand = mulberry32(hashSeed(seed, round.index, round.cuts, round.itemId));
  for (const c of cubes) {
    c.t0 = releaseTimeForZ(round, c.home[2]) + 0.015 + rand() * (coarse ? 0.07 : 0.1);
  }
  cubes.sort((a, b) => a.t0 - b.t0);
  const pile = makePile(cs, coarse, cubes.length, info);
  const zPlanes = round.phases[2].planes;
  const N = cubes.length;
  const out = {
    count: N,
    coarse,
    dims: grid.dims,
    cell: cs,
    exact: grid.exact,
    trueCount: trueCubeCount(round.split, info, N, grid.exact),
    home: new Float32Array(N * 3),
    size: new Float32Array(N * 3),
    rest: new Float32Array(N * 3),
    motion: new Float32Array(N * 4), // t0, duration, v0, seed
    rot: new Float32Array(N * 3), // yaw, tumble, spare
  };
  for (let n = 0; n < N; n++) {
    const c = cubes[n];
    const freedBy = zPlanes.findIndex((p) => p <= c.home[2]);
    const clipZ = freedBy < 0 ? -Infinity : zPlanes[freedBy];
    const { rest, tumble } = depositCube(pile, c, clipZ, rand, coarse, round.boardY);
    let v0 = 0.15 + rand() * 0.55;
    if (rest[1] > c.home[1]) v0 = Math.max(v0, Math.sqrt(2 * GRAVITY * (rest[1] - c.home[1])) + 0.25);
    const dur = flightDuration(c.home[1], rest[1], v0);
    out.home.set(c.home, n * 3);
    out.size.set(c.size, n * 3);
    out.rest.set(rest, n * 3);
    out.motion.set([c.t0, dur, v0, rand()], n * 4);
    out.rot.set([(rand() - 0.5) * Math.PI * (0.4 + rand()), tumble, 0], n * 3);
  }
  return out;
}

// Cubes already cut free at time t (release times are sorted).
export function releasedCount(data, t) {
  const m = data.motion;
  let lo = 0;
  let hi = data.count;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (m[mid * 4] <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function displayedCubeTotal(data, t) {
  if (!data || data.count === 0) return 0;
  const released = releasedCount(data, t);
  if (data.exact) return released;
  return Math.round((data.trueCount * released) / data.count);
}
