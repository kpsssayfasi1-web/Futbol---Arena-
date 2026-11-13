// Fruit shapes shared by the JS side (cube generation, counts) and the GLSL side
// (see fruit-glsl.js, which mirrors these formulas exactly).
// Every body is star shaped around the origin: a point p is inside when
// |p| < rho(p / |p|). The board top sits at the lowest point of the body.

const PI = Math.PI;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const ellipsoidRho = (x, y, z, a, b, c) => 1 / Math.sqrt((x / a) ** 2 + (y / b) ** 2 + (z / c) ** 2);

function appleRho(x, y, z) {
  const phi = Math.acos(clamp(y, -1, 1));
  const theta = Math.atan2(z, x);
  let rho = ellipsoidRho(x, y, z, 1, 0.9, 1);
  rho *= 1 + 0.07 * y;
  rho *= 1 + 0.022 * Math.cos(5 * theta) * (1 - smooth(-0.9, 0.2, y));
  rho -= 0.3 * Math.exp(-((phi / 0.3) ** 2));
  rho -= 0.12 * Math.exp(-(((PI - phi) / 0.24) ** 2));
  return rho;
}

function watermelonRho(x, y, z) {
  return ellipsoidRho(x, y, z, 1.24, 0.86, 0.86) * (1 - 0.035 * x);
}

function orangeRho(x, y, z) {
  const phi = Math.acos(clamp(y, -1, 1));
  let rho = ellipsoidRho(x, y, z, 0.96, 0.9, 0.96);
  rho -= 0.035 * Math.exp(-((phi / 0.22) ** 2));
  rho -= 0.025 * Math.exp(-(((PI - phi) / 0.2) ** 2));
  return rho;
}

function kiwiRho(x, y, z) {
  return ellipsoidRho(x, y, z, 1.18, 0.84, 0.88) * (1 + 0.045 * x);
}

// Attachments (stem, leaf) are thin parts that also get cut into cubes.
export const FRUITS = {
  apple: {
    id: 'apple', glsl: 0, tr: 'ELMA', en: 'APPLE',
    rho: appleRho,
    skinThickness: 0.025,
    stem: { p0: [0, 0.6, 0], p1: [0.02, 0.86, 0.01], p2: [0.09, 1.04, 0.03], r: 0.034, color: [0.33, 0.19, 0.09] },
    leaf: { base: [0.06, 0.93, 0.02], dir: [0.8, 0.45, -0.25], normal: [-0.35, 0.9, 0.2], length: 0.78, width: 0.34, curl: 0.14, droop: 0.3 },
  },
  watermelon: {
    id: 'watermelon', glsl: 1, tr: 'KARPUZ', en: 'WATERMELON',
    rho: watermelonRho,
    skinThickness: 0.03,
    stem: { p0: [1.18, 0.0, 0], p1: [1.3, 0.04, 0.0], p2: [1.36, 0.12, 0.05], r: 0.03, color: [0.42, 0.45, 0.2] },
    leaf: null,
  },
  orange: {
    id: 'orange', glsl: 2, tr: 'PORTAKAL', en: 'ORANGE',
    rho: orangeRho,
    skinThickness: 0.03,
    stem: { p0: [0, 0.84, 0], p1: [0.0, 0.92, 0.0], p2: [0.02, 0.98, 0.0], r: 0.03, color: [0.35, 0.36, 0.14] },
    leaf: { base: [0.02, 0.94, 0.0], dir: [-0.75, 0.35, 0.45], normal: [0.3, 0.9, -0.2], length: 0.5, width: 0.22, curl: 0.1, droop: 0.25 },
  },
  kiwi: {
    id: 'kiwi', glsl: 3, tr: 'KİVİ', en: 'KIWI',
    rho: kiwiRho,
    skinThickness: 0.02,
    stem: null,
    leaf: null,
  },
};

export const FRUIT_ORDER = ['apple', 'watermelon', 'orange', 'kiwi'];

export function fruitById(id) {
  return FRUITS[id] || FRUITS.apple;
}

// Signed radial distance: negative inside, positive outside.
export function bodyField(fruit, x, y, z) {
  const l = Math.hypot(x, y, z);
  if (l < 1e-6) return -fruit.rho(0, 1, 0);
  return l - fruit.rho(x / l, y / l, z / l);
}

export function isInsideBody(fruit, x, y, z) {
  return bodyField(fruit, x, y, z) < 0;
}

// --- attachment geometry (pure math, also used to build meshes) ---
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export function stemPoint(stem, t) {
  const u = 1 - t;
  const out = [0, 0, 0];
  for (let i = 0; i < 3; i++) out[i] = u * u * stem.p0[i] + 2 * u * t * stem.p1[i] + t * t * stem.p2[i];
  return out;
}

export function leafFrame(leaf) {
  const dir = norm(leaf.dir);
  const n0 = norm(leaf.normal);
  const normal = norm(sub(n0, dir.map((d) => d * dot(n0, dir))));
  const side = cross(normal, dir);
  return { dir, normal, side };
}

export function leafHalfWidth(leaf, u) {
  return leaf.width * 0.5 * Math.pow(Math.sin(PI * clamp(u, 0, 1)), 0.85) * (1 - 0.2 * u);
}

// u in [0,1] along the leaf, v in [-1,1] across it.
export function leafPoint(leaf, frame, u, v) {
  const along = u * leaf.length;
  const across = v * leafHalfWidth(leaf, u);
  const lift = leaf.curl * (across / (leaf.width * 0.5)) ** 2 * leaf.width * 0.5 - leaf.droop * along * along * 0.5;
  const p = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    p[i] = leaf.base[i] + frame.dir[i] * along + frame.side[i] * across + frame.normal[i] * lift;
  }
  return p;
}

// Cloud of points covering the attachments: used to find which cells they occupy.
export function attachmentSamples(fruit, density = 1) {
  const pts = [];
  if (fruit.stem) {
    const steps = Math.round(60 * density);
    for (let i = 0; i <= steps; i++) {
      const c = stemPoint(fruit.stem, i / steps);
      for (let a = 0; a < 6; a++) {
        const ang = (a / 6) * PI * 2;
        pts.push({ p: [c[0] + Math.cos(ang) * fruit.stem.r, c[1], c[2] + Math.sin(ang) * fruit.stem.r], mat: 2 });
      }
      pts.push({ p: c, mat: 2 });
    }
  }
  if (fruit.leaf) {
    const frame = leafFrame(fruit.leaf);
    const nu = Math.round(70 * density);
    const nv = Math.round(24 * density);
    for (let i = 0; i <= nu; i++) {
      for (let j = 0; j <= nv; j++) pts.push({ p: leafPoint(fruit.leaf, frame, i / nu, (j / nv) * 2 - 1), mat: 1 });
    }
  }
  return pts;
}

// Bounding box, board height, volume and projections (cached per fruit).
const infoCache = new Map();
export function fruitInfo(fruit) {
  if (infoCache.has(fruit.id)) return infoCache.get(fruit.id);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let bottom = Infinity;
  const NP = 90;
  const NT = 120;
  for (let i = 0; i <= NP; i++) {
    const phi = (i / NP) * PI;
    for (let j = 0; j < NT; j++) {
      const th = (j / NT) * PI * 2;
      const d = [Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th)];
      const r = fruit.rho(d[0], d[1], d[2]);
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], d[k] * r);
        max[k] = Math.max(max[k], d[k] * r);
      }
      bottom = Math.min(bottom, d[1] * r);
    }
  }
  const bodyMin = min.slice();
  const bodyMax = max.slice();
  for (const s of attachmentSamples(fruit, 0.5)) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], s.p[k]);
      max[k] = Math.max(max[k], s.p[k]);
    }
  }
  for (let k = 0; k < 3; k++) {
    min[k] -= 0.004;
    max[k] += 0.004;
  }
  const info = { bbox: { min, max }, body: { min: bodyMin, max: bodyMax }, boardY: bottom, ...measureBody(fruit, bodyMin, bodyMax) };
  infoCache.set(fruit.id, info);
  return info;
}

// Volume, silhouette areas (perpendicular to each axis) and widths of the body.
function measureBody(fruit, bmin, bmax) {
  const G = 56;
  const ext = [0, 1, 2].map((k) => bmax[k] - bmin[k]);
  const cell = ext.map((e) => e / G);
  const projX = new Uint8Array(G * G);
  const projY = new Uint8Array(G * G);
  const projZ = new Uint8Array(G * G);
  let inside = 0;
  for (let i = 0; i < G; i++) {
    const x = bmin[0] + (i + 0.5) * cell[0];
    for (let j = 0; j < G; j++) {
      const y = bmin[1] + (j + 0.5) * cell[1];
      for (let k = 0; k < G; k++) {
        const z = bmin[2] + (k + 0.5) * cell[2];
        if (isInsideBody(fruit, x, y, z)) {
          inside++;
          projX[j * G + k] = 1;
          projY[i * G + k] = 1;
          projZ[i * G + j] = 1;
        }
      }
    }
  }
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  return {
    volume: inside * cell[0] * cell[1] * cell[2],
    areas: [sum(projX) * cell[1] * cell[2], sum(projY) * cell[0] * cell[2], sum(projZ) * cell[0] * cell[1]],
    widths: ext,
  };
}

// Expected number of grid cells (cell size a,b,c) touching the body, from the
// Minkowski sum of the body with one cell (exact for convex bodies).
export function estimateCellCount(info, a, b, c) {
  const [Ax, Ay, Az] = info.areas;
  const [wx, wy, wz] = info.widths;
  const v = info.volume + a * Ax + b * Ay + c * Az + a * b * wz + b * c * wx + a * c * wy + a * b * c;
  return v / (a * b * c);
}

// Horizontal silhouette radius of the body for every azimuth (used to keep the
// growing pile out from under the part of the fruit that still stands).
export function silhouette(fruit, steps = 180) {
  const out = new Float32Array(steps);
  for (let j = 0; j < steps; j++) {
    const th = (j / steps) * PI * 2;
    let best = 0;
    for (let i = 1; i < 60; i++) {
      const phi = (i / 60) * PI;
      const d = [Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th)];
      best = Math.max(best, Math.sin(phi) * fruit.rho(d[0], d[1], d[2]));
    }
    out[j] = best;
  }
  return out;
}
