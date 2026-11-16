// More fruits and vegetables, in the same style as fruits.js / veggies.js:
// shapes in object space (about 1 unit radius), colours as GLSL, picked so the
// item reads at first sight and its cut face looks like the real thing.
const leaf = (at, r, rot, part = 2) => ({ type: 'ellipsoid', at, r, rot, part });

export const EXTRA_FRUITS = [
  {
    id: 'pineapple', cat: 'fruit', tr: 'ANANAS', en: 'PINEAPPLE', dot: '#e0a722', skinT: 0.05,
    sound: { cut: 'juicy', hard: 0.45, wet: 0.75 },
    shape: { op: 'union', k: 0.06, of: [
      { type: 'ellipsoid', at: [0, -0.18, 0], r: [0.68, 0.92, 0.68], part: 0 },
      leaf([0, 1.05, 0], [0.08, 0.42, 0.03], [0, 0, 0]),
      leaf([0.14, 0.98, 0], [0.08, 0.38, 0.03], [0, 0, -0.45]),
      leaf([-0.14, 0.98, 0], [0.08, 0.38, 0.03], [0, 0, 0.45]),
      leaf([0, 0.98, 0.14], [0.03, 0.38, 0.08], [0.45, 0, 0]),
      leaf([0, 0.98, -0.14], [0.03, 0.38, 0.08], [-0.45, 0, 0]),
      leaf([0.2, 0.86, 0.1], [0.07, 0.3, 0.03], [0.3, 0, -0.85]),
      leaf([-0.2, 0.86, -0.1], [0.07, 0.3, 0.03], [-0.3, 0, 0.85]),
    ] },
    glsl: /* glsl */ `
// Diamond "eyes" in a criss-cross lattice, each with a dark spiky centre.
vec3 pineSkin(vec3 p) {
  float a = atan(p.z, p.x);
  float y = p.y * 7.5;
  vec2 g = vec2(a * 2.6 + y, a * 2.6 - y);
  vec2 f = fract(g) - 0.5;
  float edge = max(abs(f.x), abs(f.y));
  float eye = length(f);
  vec3 c = mix(vec3(0.86, 0.56, 0.12), vec3(0.62, 0.36, 0.08), smoothstep(0.25, 0.48, edge));
  c = mix(c, vec3(0.5, 0.52, 0.14), smoothstep(0.35, 0.95, fFbm(p * 2.5)) * 0.45);
  c = mix(c, vec3(0.28, 0.16, 0.05), 1.0 - smoothstep(0.06, 0.12, eye));
  return c * (0.9 + 0.15 * fNoise(p * 30.0));
}
vec3 itemSkin(vec3 p, float part) {
  if (part > 1.5) return mix(vec3(0.2, 0.45, 0.22), vec3(0.42, 0.58, 0.3), fNoise(p * 9.0));
  return pineSkin(p);
}
vec3 itemInner(vec3 p, float depth, float part) {
  if (part > 1.5) return vec3(0.5, 0.7, 0.4);
  float rr = length(p.xz);
  vec3 flesh = vec3(1.0, 0.84, 0.28);
  // juicy fibres running out from the core, a paler fibrous core
  float fib = fNoise(vec3(atan(p.z, p.x) * 18.0, rr * 4.0, p.y * 3.0));
  flesh *= 0.94 + 0.1 * fib;
  vec3 c = mix(vec3(1.0, 0.93, 0.62), flesh, smoothstep(0.14, 0.2, rr));
  // the eyes reach a little way in as brown pits under the skin
  c = mix(vec3(0.8, 0.6, 0.25), c, smoothstep(0.05, 0.1, depth));
  return c;
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return part > 1.5 ? 0.55 : mix(0.4, 0.6, skin); }
#define ITEM_BUMP
float itemBump(vec3 p, float part) {
  if (part > 1.5) return 0.0;
  float a = atan(p.z, p.x);
  vec2 f = fract(vec2(a * 2.6 + p.y * 7.5, a * 2.6 - p.y * 7.5)) - 0.5;
  return (0.5 - max(abs(f.x), abs(f.y))) * 0.9;
}
`,
  },
  {
    id: 'banana', cat: 'fruit', tr: 'MUZ', en: 'BANANA', dot: '#f5d21c', skinT: 0.045,
    sound: { cut: 'soft', hard: 0.2, wet: 0.35 },
    bounds: [[-1.7, -0.7, -0.6], [1.7, 1.0, 0.6]],
    shape: { op: 'union', k: 0.18, of: [
      { type: 'capsule', a: [-1.25, 0.38, 0], b: [-0.62, -0.05, 0], r: [0.17, 0.27], part: 0 },
      { type: 'capsule', a: [-0.62, -0.05, 0], b: [0, -0.18, 0], r: [0.27, 0.3], part: 0 },
      { type: 'capsule', a: [0, -0.18, 0], b: [0.62, -0.05, 0], r: [0.3, 0.27], part: 0 },
      { type: 'capsule', a: [0.62, -0.05, 0], b: [1.2, 0.36, 0], r: [0.27, 0.16], part: 0 },
      { type: 'capsule', a: [1.2, 0.36, 0], b: [1.42, 0.56, 0], r: [0.08, 0.065], part: 1 },
      { type: 'sphere', at: [-1.3, 0.42, 0], r: 0.075, part: 2 },
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  if (part > 1.5) return vec3(0.18, 0.12, 0.06);
  if (part > 0.5) return mix(vec3(0.45, 0.5, 0.18), vec3(0.3, 0.24, 0.1), smoothstep(1.3, 1.42, p.x));
  vec3 c = mix(vec3(1.0, 0.84, 0.12), vec3(0.98, 0.76, 0.08), fFbm(p * 2.0));
  c = mix(c, vec3(0.62, 0.72, 0.18), smoothstep(1.0, 1.25, abs(p.x)) * 0.6);
  // faint ridges along the fruit and a few sugar spots
  c *= 1.0 - 0.08 * smoothstep(0.75, 1.0, abs(sin(atan(p.z, p.y + 0.1) * 2.5)));
  return mix(c, vec3(0.4, 0.24, 0.06), spots(p, 9.0, 0.06, 0.25) * 0.6);
}
vec3 itemInner(vec3 p, float depth, float part) {
  if (part > 0.5) return vec3(0.75, 0.75, 0.55);
  vec3 c = vec3(0.98, 0.93, 0.72) * (0.96 + 0.05 * fNoise(p * 30.0));
  // a cream band under the peel and the dark seed specks along the centre
  c = mix(vec3(0.99, 0.96, 0.8), c, smoothstep(0.02, 0.06, depth));
  float centre = smoothstep(0.17, 0.23, depth);
  c = mix(c, vec3(0.93, 0.85, 0.6), centre * 0.6);
  return mix(c, vec3(0.32, 0.2, 0.08), spots(p, 26.0, 0.12, 0.6) * centre);
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.55, 0.42, skin); }
`,
  },
  {
    id: 'pear', cat: 'fruit', tr: 'ARMUT', en: 'PEAR', dot: '#b5c42f', skinT: 0.022,
    sound: { cut: 'crisp', hard: 0.3, wet: 0.6 },
    shape: { op: 'union', of: [
      { op: 'union', k: 0.55, of: [
        { type: 'sphere', at: [0, -0.32, 0], r: 0.78, part: 0 },
        { type: 'sphere', at: [0, 0.48, 0], r: 0.46, part: 0 },
      ] },
      { type: 'capsule', a: [0, 0.82, 0], b: [0.07, 1.22, 0.02], r: [0.045, 0.03], part: 1 },
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  if (part > 0.5) return vec3(0.33, 0.21, 0.1) * (0.85 + 0.3 * fNoise(p * 40.0));
  vec3 d = normalize(p);
  float blush = smoothstep(0.2, 0.9, dot(d, normalize(vec3(-0.5, 0.1, 0.85))));
  vec3 c = mix(vec3(0.72, 0.8, 0.2), vec3(0.88, 0.82, 0.22), fFbm(p * 1.6));
  c = mix(c, vec3(0.86, 0.45, 0.16), blush * 0.45);
  return mix(c, vec3(0.5, 0.36, 0.12), spots(p, 16.0, 0.09, 0.5) * 0.55);
}
vec3 itemInner(vec3 p, float depth, float part) {
  if (part > 0.5) return vec3(0.55, 0.42, 0.25);
  vec3 c = vec3(0.98, 0.96, 0.84) * (0.95 + 0.06 * fNoise(p * 40.0));
  c = mix(vec3(0.9, 0.93, 0.6), c, smoothstep(0.0, 0.04, depth));
  // gritty stone cells and a small core with dark seeds
  c = mix(c, vec3(0.93, 0.9, 0.74), spots(p, 30.0, 0.18, 0.4) * 0.5);
  float core = length(vec2(length(p.xz) / 0.2, (p.y + 0.25) / 0.38));
  c = mix(c * vec3(0.97, 0.97, 0.88), c, smoothstep(0.9, 1.05, core));
  float seed = length(vec3(abs(p.x) - 0.07, (p.y + 0.22) / 1.8, p.z) / 0.05);
  return mix(c, vec3(0.25, 0.13, 0.05), 1.0 - smoothstep(0.85, 1.0, seed));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return part > 0.5 ? 0.6 : mix(0.45, 0.35, skin); }
`,
  },
  {
    id: 'pomegranate', cat: 'fruit', tr: 'NAR', en: 'POMEGRANATE', dot: '#b0122a', skinT: 0.07,
    sound: { cut: 'juicy', hard: 0.35, wet: 0.85 },
    shape: { op: 'union', k: 0.08, of: [
      { type: 'sphere', r: 0.9, lobes: { n: 6, amp: 0.02 }, part: 0 },
      { type: 'cone', at: [0, 0.98, 0], r1: 0.16, r2: 0.23, h: 0.12, lobes: { n: 6, amp: 0.25 }, part: 1 },
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  vec3 c = mix(vec3(0.72, 0.06, 0.08), vec3(0.55, 0.03, 0.06), fFbm(p * 2.2));
  c = mix(c, vec3(0.86, 0.5, 0.25), smoothstep(0.55, 0.9, fFbm(p * 1.3 + 3.0)) * 0.35);
  if (part > 0.5) c = mix(vec3(0.5, 0.12, 0.08), vec3(0.35, 0.08, 0.05), fNoise(p * 20.0));
  return c * (0.94 + 0.08 * fNoise(p * 25.0));
}
vec3 itemInner(vec3 p, float depth, float part) {
  // leathery rind, then ruby arils packed between pale membranes
  vec3 rind = vec3(0.95, 0.78, 0.62);
  if (depth < 0.08) return mix(vec3(0.72, 0.06, 0.08), rind, smoothstep(0.0, 0.03, depth));
  // worley: 1 inside an aril, 0 on the thin pale membrane between arils
  float id;
  float w = worley(p * 8.0, id);
  vec3 aril = mix(vec3(0.82, 0.03, 0.14), vec3(0.6, 0.02, 0.1), fHash(vec3(id)));
  // a glossy lighter rim where each aril bulges and a hint of its pale seed
  aril = mix(aril, vec3(0.98, 0.35, 0.45), (1.0 - smoothstep(0.35, 0.7, w)) * 0.45);
  aril = mix(aril, vec3(0.95, 0.75, 0.7), smoothstep(0.92, 0.98, fNoise(p * 26.0 + id * 3.0)) * 0.5);
  vec3 c = mix(vec3(0.97, 0.88, 0.75), aril, smoothstep(0.08, 0.3, w));
  return mix(rind, c, smoothstep(0.08, 0.12, depth));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.2, 0.45, skin); }
`,
  },
  {
    id: 'dragonfruit', cat: 'fruit', tr: 'EJDER MEYVESİ', en: 'DRAGON FRUIT', dot: '#e8237a', skinT: 0.05,
    sound: { cut: 'soft', hard: 0.2, wet: 0.7 },
    shape: { op: 'union', k: 0.05, of: [
      { type: 'ellipsoid', r: [0.76, 0.98, 0.76], part: 0 },
      leaf([0.62, 0.35, 0.3], [0.05, 0.3, 0.13], [0.2, 0, -0.75], 1),
      leaf([-0.62, 0.25, -0.3], [0.05, 0.3, 0.13], [-0.2, 0, 0.75], 1),
      leaf([0.25, 0.4, -0.66], [0.13, 0.3, 0.05], [-0.75, 0, -0.2], 1),
      leaf([-0.3, 0.38, 0.64], [0.13, 0.3, 0.05], [0.75, 0, 0.2], 1),
      leaf([0, 1.0, 0], [0.12, 0.2, 0.12], [0, 0, 0], 1),
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  vec3 pink = mix(vec3(0.95, 0.12, 0.48), vec3(0.85, 0.06, 0.38), fFbm(p * 2.5));
  vec3 green = vec3(0.55, 0.78, 0.2);
  if (part > 0.5) return mix(pink, green, smoothstep(0.1, 0.35, length(p) - 0.75));
  // pink scales with green tips drawn on the body
  float a = atan(p.z, p.x);
  vec2 f = fract(vec2(a * 1.3 + p.y * 2.2, a * 1.3 - p.y * 2.2)) - 0.5;
  float tip = 1.0 - smoothstep(0.05, 0.14, length(f - vec2(0.2, 0.2)));
  return mix(pink, green, tip * 0.8);
}
vec3 itemInner(vec3 p, float depth, float part) {
  if (part > 0.5) return vec3(0.85, 0.3, 0.55);
  vec3 c = vec3(0.98, 0.97, 0.96) * (0.97 + 0.04 * fNoise(p * 30.0));
  c = mix(vec3(0.95, 0.2, 0.55), c, smoothstep(0.03, 0.06, depth));
  return mix(c, vec3(0.04, 0.03, 0.03), spots(p, 34.0, 0.11, 0.55) * smoothstep(0.08, 0.14, depth));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.35, 0.4, skin); }
`,
  },
];

export const EXTRA_VEGGIES = [
  {
    id: 'pepper', cat: 'veg', tr: 'KIRMIZI BİBER', en: 'RED PEPPER', dot: '#d61a12', skinT: 0.02,
    sound: { cut: 'crisp', hard: 0.35, wet: 0.6 },
    shape: { op: 'union', k: 0.04, of: [
      { op: 'subtract', k: 0.04,
        from: { type: 'ellipsoid', at: [0, -0.1, 0], r: [0.8, 0.95, 0.8], lobes: { n: 4, amp: 0.1 }, part: 0 },
        cut: [{ type: 'ellipsoid', at: [0, -0.08, 0], r: [0.68, 0.82, 0.68], lobes: { n: 4, amp: 0.1 } }] },
      { type: 'capsule', a: [0, 0.72, 0], b: [0, 0.0, 0], r: [0.16, 0.1], part: 2 },
      { type: 'cylinder', at: [0, 0.95, 0], r: 0.09, h: 0.16, round: 0.03, part: 1 },
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  if (part > 1.5) return vec3(0.96, 0.9, 0.62);
  if (part > 0.5) return mix(vec3(0.18, 0.4, 0.1), vec3(0.32, 0.52, 0.16), fNoise(p * 12.0));
  return mix(vec3(0.86, 0.05, 0.03), vec3(0.66, 0.02, 0.02), fFbm(p * 1.8)) * (0.96 + 0.06 * fNoise(p * 20.0));
}
vec3 itemInner(vec3 p, float depth, float part) {
  if (part > 1.5) return mix(vec3(0.97, 0.92, 0.66), vec3(0.98, 0.86, 0.45), spots(p, 22.0, 0.18, 0.6));
  if (part > 0.5) return vec3(0.6, 0.8, 0.45);
  // crisp wall: deep red under the skin, lighter and juicier inside
  return mix(vec3(0.8, 0.06, 0.03), vec3(0.98, 0.32, 0.2), smoothstep(0.0, 0.08, depth)) * (0.96 + 0.06 * fNoise(p * 40.0));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return part > 0.5 ? 0.55 : mix(0.4, 0.16, skin); }
`,
  },
  {
    id: 'cabbage', cat: 'veg', tr: 'MOR LAHANA', en: 'RED CABBAGE', dot: '#6a2a7a', skinT: 0.02,
    sound: { cut: 'crisp', hard: 0.45, wet: 0.4 },
    shape: { type: 'ellipsoid', r: [0.96, 0.86, 0.96], lobes: { n: 7, amp: 0.025 } },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  vec3 d = normalize(p);
  vec3 c = mix(vec3(0.42, 0.18, 0.5), vec3(0.3, 0.12, 0.42), fFbm(p * 2.0));
  // pale leaf veins fanning out from the stem underneath
  float vein = 1.0 - smoothstep(0.0, 0.05, abs(sin(atan(d.z, d.x) * 7.0 + d.y * 3.0 + fNoise(p * 4.0))));
  c = mix(c, vec3(0.78, 0.66, 0.82), vein * smoothstep(0.6, -0.4, d.y) * 0.6);
  return c * (0.92 + 0.1 * fNoise(p * 18.0));
}
vec3 itemInner(vec3 p, float depth, float part) {
  // tightly packed purple leaves with white ribs between them
  float r = length(p * vec3(1.0, 1.1, 1.0));
  float warp = fFbm(p * 2.6) * 0.18 + fNoise(p * 7.0) * 0.03;
  float layer = abs(sin((r + warp) * 46.0));
  vec3 purple = mix(vec3(0.5, 0.07, 0.42), vec3(0.36, 0.05, 0.36), fNoise(p * 9.0));
  vec3 c = mix(vec3(0.95, 0.9, 0.95), purple, smoothstep(0.18, 0.55, layer));
  // white core where the leaves join the stem
  float core = length(vec2(length(p.xz) / 0.22, (p.y + 0.35) / 0.5));
  return mix(vec3(0.95, 0.93, 0.85), c, smoothstep(0.85, 1.1, core));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.35, 0.3, skin); }
`,
  },
  {
    id: 'potato', cat: 'veg', tr: 'PATATES', en: 'POTATO', dot: '#b0814c', skinT: 0.018,
    sound: { cut: 'crisp', hard: 0.55, wet: 0.3 },
    bounds: [[-1.4, -0.9, -1.0], [1.4, 0.9, 1.0]],
    shape: { op: 'union', k: 0.45, of: [
      { type: 'ellipsoid', at: [-0.25, -0.02, 0], r: [0.82, 0.62, 0.7] },
      { type: 'ellipsoid', at: [0.45, 0.0, 0.05], r: [0.62, 0.55, 0.62] },
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  vec3 c = mix(vec3(0.8, 0.62, 0.4), vec3(0.7, 0.52, 0.32), fFbm(p * 2.0));
  c *= 0.95 + 0.07 * fNoise(p * 40.0);
  // a few eyes: small dark dimples
  return mix(c, vec3(0.42, 0.28, 0.14), spots(p, 3.0, 0.07, 0.18) * 0.8);
}
vec3 itemInner(vec3 p, float depth, float part) {
  vec3 c = vec3(0.98, 0.92, 0.62) * (0.96 + 0.05 * fNoise(p * 50.0));
  // the vascular ring a little under the skin
  c = mix(c, vec3(0.94, 0.86, 0.5), (1.0 - smoothstep(0.0, 0.025, abs(depth - 0.1))) * 0.5);
  return mix(vec3(0.85, 0.75, 0.45), c, smoothstep(0.0, 0.03, depth));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.4, 0.75, skin); }
#define ITEM_BUMP
float itemBump(vec3 p, float part) { return -spots(p, 3.0, 0.07, 0.18) * 0.6 + fNoise(p * 6.0) * 0.06; }
`,
  },
  {
    id: 'corn', cat: 'veg', tr: 'MISIR', en: 'CORN', dot: '#f2c318', skinT: 0.13,
    sound: { cut: 'crisp', hard: 0.5, wet: 0.4 },
    bounds: [[-1.6, -0.6, -0.6], [1.6, 0.6, 0.6]],
    shape: { type: 'capsule', a: [-1.0, 0, 0], b: [1.0, 0, 0], r: [0.44, 0.34] },
    glsl: /* glsl */ `
// Rows of kernels around the cob: cell coordinates along and around it.
vec2 cornCell(vec3 p, out vec2 cell) {
  float a = (atan(p.z, p.y) / (2.0 * OBJ_PI) + 0.5) * 16.0;
  float row = floor(a);
  vec2 g = vec2(a, p.x / 0.095 + 0.5 * mod(row, 2.0));
  cell = floor(g);
  return fract(g) - 0.5;
}
vec3 itemSkin(vec3 p, float part) {
  vec2 cell;
  vec2 f = cornCell(p, cell);
  float k = max(abs(f.x), abs(f.y));
  vec3 kernel = mix(vec3(1.0, 0.82, 0.18), vec3(0.98, 0.7, 0.1), fHash(vec3(cell, 1.0)));
  kernel = mix(kernel, vec3(1.0, 0.94, 0.6), (1.0 - smoothstep(0.0, 0.35, length(f - vec2(-0.1, -0.12)))) * 0.4);
  return mix(kernel, vec3(0.62, 0.42, 0.08), smoothstep(0.36, 0.5, k));
}
vec3 itemInner(vec3 p, float depth, float part) {
  // kernels (yellow, a paler starchy tip) around a light, spongy cob
  vec2 cell;
  vec2 f = cornCell(p, cell);
  vec3 kernel = mix(vec3(1.0, 0.86, 0.3), vec3(0.98, 0.95, 0.75), smoothstep(0.05, 0.11, depth));
  kernel = mix(kernel, vec3(0.75, 0.55, 0.12), smoothstep(0.38, 0.5, abs(f.y)) * 0.8);
  vec3 cob = mix(vec3(0.95, 0.88, 0.68), vec3(0.88, 0.8, 0.6), fNoise(p * 30.0));
  return mix(kernel, cob, smoothstep(0.12, 0.15, depth));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.4, 0.25, skin); }
#define ITEM_BUMP
float itemBump(vec3 p, float part) {
  vec2 cell;
  vec2 f = cornCell(p, cell);
  return (0.5 - max(abs(f.x), abs(f.y))) * 1.2;
}
`,
  },
];
