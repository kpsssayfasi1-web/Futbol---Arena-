// Vegetables.
const sepal = (i, n, y, len, tilt) => ({
  type: 'ellipsoid', at: [Math.cos((i * 2 * Math.PI) / n) * len * 0.8, y, Math.sin((i * 2 * Math.PI) / n) * len * 0.8],
  r: [len, 0.025, len * 0.3], rot: [0, -(i * 2 * Math.PI) / n, tilt], part: 1,
});

export const VEGGIES = [
  {
    id: 'tomato', cat: 'veg', tr: 'DOMATES', en: 'TOMATO', dot: '#d8261b', skinT: 0.02,
    sound: { cut: 'juicy', hard: 0.2, wet: 0.95 },
    shape: { op: 'union', of: [
      { op: 'subtract', k: 0.18, from: { type: 'ellipsoid', r: [0.98, 0.76, 0.98], lobes: { n: 6, amp: 0.035 }, part: 0 }, cut: [{ type: 'sphere', at: [0, 0.85, 0], r: 0.16 }] },
      ...[0, 1, 2, 3, 4].map((i) => sepal(i, 5, 0.72, 0.24, -0.25)),
      { type: 'capsule', a: [0, 0.66, 0], b: [0.02, 0.86, 0], r: 0.04, part: 1 },
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  if (part > 0.5) return leafGreen(p);
  vec3 c = mix(vec3(0.86, 0.08, 0.04), vec3(0.62, 0.03, 0.02), fFbm(p * 2.5));
  return mix(c, vec3(0.95, 0.45, 0.08), smoothstep(0.55, 0.75, normalize(p).y) * 0.35);
}
vec3 itemInner(vec3 p, float depth, float part) {
  if (part > 0.5) return vec3(0.4, 0.65, 0.25);
  float rr = length(p.xz) / 0.98;
  float a = atan(p.z, p.x);
  float sector = fract(a / (2.0 * OBJ_PI) * 4.0);
  float wall = 1.0 - smoothstep(0.03, 0.08, min(sector, 1.0 - sector) * rr * 2.0);
  vec3 flesh = vec3(0.85, 0.08, 0.05);
  vec3 jelly = vec3(0.9, 0.6, 0.2);
  float locule = smoothstep(0.2, 0.28, rr) * (1.0 - smoothstep(0.62, 0.7, rr)) * (1.0 - wall) * (1.0 - smoothstep(0.35, 0.5, abs(p.y)));
  vec3 c = mix(flesh, jelly, locule);
  float seeds = spots(p, 16.0, 0.16, 0.9) * locule;
  c = mix(c, vec3(0.95, 0.88, 0.6), seeds);
  c = mix(c, vec3(0.95, 0.4, 0.35), (1.0 - smoothstep(0.12, 0.2, rr)) * 0.6);
  return c * (0.95 + 0.06 * fNoise(p * 25.0));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return part > 0.5 ? 0.6 : mix(0.4, 0.18, skin); }
`,
  },
  {
    id: 'onion', cat: 'veg', tr: 'SOĞAN', en: 'ONION', dot: '#8e2a5b', skinT: 0.02,
    sound: { cut: 'crisp', hard: 0.3, wet: 0.6 },
    bounds: [[-1.2, -1.1, -1.2], [1.2, 1.5, 1.2]],
    shape: { op: 'union', k: 0.35, of: [
      { type: 'sphere', at: [0, -0.05, 0], r: 0.93 },
      { type: 'cone', at: [0, 0.98, 0], r1: 0.3, r2: 0.03, h: 0.28 },
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  float a = atan(p.z, p.x);
  float streak = fNoise(vec3(a * 18.0, p.y * 2.0, 0.0));
  vec3 c = mix(vec3(0.5, 0.12, 0.28), vec3(0.32, 0.06, 0.18), streak);
  return mix(c, vec3(0.6, 0.38, 0.25), smoothstep(0.8, 1.1, p.y) * 0.6);
}
vec3 itemInner(vec3 p, float depth, float part) {
  float ring = fract(depth / 0.075);
  vec3 white = vec3(0.96, 0.92, 0.95);
  vec3 purple = vec3(0.62, 0.2, 0.46);
  vec3 c = mix(white, purple, smoothstep(0.72, 0.98, ring) * (0.5 + 0.5 * smoothstep(0.1, 0.4, depth)));
  c = mix(c, vec3(0.85, 0.8, 0.85), 1.0 - smoothstep(0.0, 0.04, ring));
  return c * (0.96 + 0.05 * fNoise(p * 30.0));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.3, 0.55, skin); }
`,
  },
  {
    id: 'carrot', cat: 'veg', tr: 'HAVUÇ', en: 'CARROT', dot: '#ee7716', skinT: 0.02,
    sound: { cut: 'crisp', hard: 0.5, wet: 0.35 },
    bounds: [[-1.7, -0.6, -0.7], [1.4, 1.2, 0.7]],
    shape: { op: 'union', of: [
      { type: 'cone', axis: 'x', r1: 0.42, r2: 0.07, h: 1.2, round: 0.04, part: 0 },
      { type: 'capsule', a: [-1.16, 0.05, 0], b: [-1.5, 0.75, 0.1], r: [0.05, 0.025], part: 1 },
      { type: 'capsule', a: [-1.16, 0.05, 0], b: [-1.62, 0.5, -0.2], r: [0.05, 0.025], part: 1 },
      { type: 'capsule', a: [-1.16, 0.05, 0], b: [-1.3, 0.85, -0.15], r: [0.05, 0.025], part: 1 },
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  if (part > 0.5) return leafGreen(p) * 1.1;
  vec3 c = mix(vec3(0.95, 0.3, 0.02), vec3(0.8, 0.2, 0.01), fNoise(p * vec3(2.0, 12.0, 12.0)));
  float ringLine = 1.0 - smoothstep(0.0, 0.08, abs(fract(p.x * 7.0 + fNoise(p * 5.0)) - 0.5) * 2.0 - 0.9);
  return c * (1.0 - 0.18 * ringLine);
}
vec3 itemInner(vec3 p, float depth, float part) {
  if (part > 0.5) return vec3(0.5, 0.75, 0.3);
  float rLocal = mix(0.42, 0.07, clamp((p.x + 1.2) / 2.4, 0.0, 1.0));
  float q = length(p.yz) / rLocal;
  vec3 cortex = vec3(0.98, 0.33, 0.02);
  vec3 core = vec3(1.0, 0.5, 0.08);
  vec3 c = mix(core, cortex, smoothstep(0.42, 0.5, q));
  c = mix(c, vec3(0.9, 0.28, 0.02), (1.0 - smoothstep(0.0, 0.04, abs(q - 0.46))) * 0.5);
  return c * (0.95 + 0.06 * fNoise(vec3(p.x * 3.0, q * 10.0, atan(p.z, p.y) * 4.0)));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.4, 0.6, skin); }
`,
  },
  {
    id: 'cucumber', cat: 'veg', tr: 'SALATALIK', en: 'CUCUMBER', dot: '#2c6b2a', skinT: 0.022,
    sound: { cut: 'crisp', hard: 0.4, wet: 0.7 },
    bounds: [[-1.6, -0.6, -0.6], [1.6, 0.6, 0.6]],
    shape: { type: 'capsule', a: [-1.05, 0, 0], b: [1.05, 0, 0], r: 0.42 },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  float a = atan(p.z, p.y);
  float stripe = smoothstep(0.2, 0.8, 0.5 + 0.5 * sin(a * 9.0 + fNoise(p * 3.0) * 2.0));
  vec3 c = mix(vec3(0.08, 0.28, 0.08), vec3(0.22, 0.45, 0.14), stripe * 0.6);
  return mix(c, vec3(0.6, 0.72, 0.4), spots(p, 14.0, 0.12, 0.35));
}
vec3 itemInner(vec3 p, float depth, float part) {
  float q = length(p.yz) / 0.42;
  float a = atan(p.z, p.y);
  vec3 c = mix(vec3(0.86, 0.94, 0.62), vec3(0.55, 0.78, 0.3), smoothstep(0.75, 1.0, q));
  float seedZone = 1.0 - smoothstep(0.38, 0.45, q);
  c = mix(c, vec3(0.92, 0.95, 0.75), seedZone * 0.6);
  float lobe = fract(a / (2.0 * OBJ_PI) * 3.0);
  vec2 sp = vec2(q * 2.4, fract(p.x * 5.0));
  float seed = sq((q - 0.25) / 0.06) + sq((fract(p.x * 5.0 + lobe) - 0.5) / 0.18) + sq((lobe - 0.5) / 0.2);
  c = mix(c, vec3(0.97, 0.96, 0.85), (1.0 - smoothstep(0.8, 1.0, seed)) * seedZone);
  return c;
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.35, 0.4, skin); }
#define ITEM_BUMP
float itemBump(vec3 p, float part) { return spots(p, 14.0, 0.12, 0.35) * 0.6; }
`,
  },
  {
    id: 'pumpkin', cat: 'veg', tr: 'BALKABAĞI', en: 'PUMPKIN', dot: '#f07a18', skinT: 0.03,
    sound: { cut: 'crisp', hard: 0.45, wet: 0.4 },
    bounds: [[-1.5, -1.1, -1.5], [1.5, 1.4, 1.5]],
    shape: { op: 'union', of: [
      { op: 'subtract', k: 0.2, from: { type: 'ellipsoid', r: [1.18, 0.82, 1.18], lobes: { n: 10, amp: 0.06 }, part: 0 },
        cut: [{ type: 'sphere', at: [0, 0.9, 0], r: 0.2 }, { type: 'ellipsoid', r: [0.86, 0.52, 0.86] }] },
      { type: 'cylinder', at: [0.03, 0.85, 0], r: 0.11, h: 0.22, round: 0.04, rot: [0, 0, -0.2], part: 1 },
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  if (part > 0.5) return mix(vec3(0.35, 0.3, 0.12), vec3(0.22, 0.25, 0.1), fNoise(p * 10.0));
  if (length(p / vec3(0.86, 0.52, 0.86)) < 1.06) {
    return mix(vec3(0.98, 0.72, 0.25), vec3(0.95, 0.85, 0.6), spots(p, 9.0, 0.22, 0.6));
  }
  float a = atan(p.z, p.x);
  float groove = smoothstep(0.6, 1.0, -cos(a * 10.0));
  vec3 c = mix(vec3(0.95, 0.34, 0.02), vec3(0.8, 0.24, 0.01), fFbm(p * 3.0));
  return mix(c, vec3(0.55, 0.18, 0.02), groove * 0.5);
}
vec3 itemInner(vec3 p, float depth, float part) {
  if (part > 0.5) return vec3(0.6, 0.55, 0.3);
  return mix(vec3(1.0, 0.45, 0.05), vec3(0.98, 0.55, 0.12), fNoise(p * 12.0));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return part > 0.5 ? 0.8 : mix(0.55, 0.45, skin); }
`,
  },
  {
    id: 'eggplant', cat: 'veg', tr: 'PATLICAN', en: 'EGGPLANT', dot: '#4a1d47', skinT: 0.02,
    sound: { cut: 'soft', hard: 0.25, wet: 0.5 },
    bounds: [[-1.7, -0.8, -0.8], [1.4, 0.9, 0.8]],
    shape: { op: 'union', of: [
      { op: 'union', k: 0.55, of: [{ type: 'ellipsoid', at: [-0.6, 0, 0], r: [0.55, 0.48, 0.48] }, { type: 'ellipsoid', at: [0.42, 0, 0], r: [0.78, 0.64, 0.64] }] },
      { type: 'cone', axis: 'x', at: [-1.08, 0, 0], r1: 0.12, r2: 0.36, h: 0.14, part: 1 },
      { type: 'capsule', a: [-1.15, 0, 0], b: [-1.5, 0.16, 0], r: 0.05, part: 1 },
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  if (part > 0.5) return mix(vec3(0.2, 0.35, 0.1), vec3(0.3, 0.45, 0.15), fNoise(p * 9.0));
  return mix(vec3(0.2, 0.04, 0.17), vec3(0.11, 0.02, 0.1), fFbm(p * 2.0));
}
vec3 itemInner(vec3 p, float depth, float part) {
  if (part > 0.5) return vec3(0.5, 0.65, 0.35);
  vec3 c = mix(vec3(0.95, 0.9, 0.72), vec3(0.88, 0.86, 0.6), fNoise(p * 8.0));
  c = mix(c, vec3(0.55, 0.42, 0.2), spots(p, 18.0, 0.12, 0.45) * smoothstep(0.15, 0.3, depth));
  return mix(vec3(0.75, 0.75, 0.45), c, smoothstep(0.0, 0.05, depth));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return part > 0.5 ? 0.6 : mix(0.5, 0.15, skin); }
`,
  },
];
