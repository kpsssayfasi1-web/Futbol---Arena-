// A third batch of items in the catalog's style: everyday fruits, vegetables,
// foods and objects that read at first sight, with believable cut faces.
const leaf = (at, r, rot, part = 2) => ({ type: 'ellipsoid', at, r, rot, part });

export const MORE_FRUITS = [
  {
    id: 'coconut', cat: 'fruit', tr: 'HİNDİSTAN CEVİZİ', en: 'COCONUT', dot: '#6b4423', skinT: 0.09, envBoost: 0.35,
    sound: { cut: 'rock', hard: 0.7, wet: 0.2 },
    shape: { op: 'subtract', from: { type: 'ellipsoid', r: [0.92, 0.86, 0.92] }, cut: [{ type: 'ellipsoid', r: [0.7, 0.64, 0.7] }] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  // hairy brown husk: fibres running pole to pole, and the three dark eyes on top
  // coarse hairy fibres running from pole to pole, darker in the grooves
  float a = atan(p.z, p.x);
  float streak = fNoise(vec3(a * 9.0, p.y * 1.2, 1.0)) * 0.6 + fNoise(vec3(a * 30.0, p.y * 4.0, 2.0)) * 0.4;
  vec3 c = mix(vec3(0.26, 0.16, 0.08), vec3(0.36, 0.24, 0.13), 0.5 + 0.35 * (streak - 0.5));
  // fine hairs: tiny light flecks over the husk
  c = mix(c, vec3(0.55, 0.4, 0.25), smoothstep(0.72, 0.9, fNoise(p * 60.0)) * 0.5);
  vec3 d = normalize(p);
  for (int i = 0; i < 3; i++) {
    float a = float(i) * 2.094;
    vec3 e = normalize(vec3(cos(a) * 0.22, 1.0, sin(a) * 0.22));
    c = mix(c, vec3(0.15, 0.09, 0.05), 1.0 - smoothstep(0.03, 0.06, distance(d, e)));
  }
  return c;
}
vec3 itemInner(vec3 p, float depth, float part) {
  // brown shell, a thin brown skin, then the snow-white meat; hollow inside
  vec3 shell = vec3(0.38, 0.24, 0.12) * (0.9 + 0.15 * fNoise(p * 30.0));
  vec3 meat = vec3(0.98, 0.97, 0.94) * (0.97 + 0.04 * fNoise(p * 40.0));
  vec3 c = mix(shell, vec3(0.55, 0.38, 0.22), smoothstep(0.07, 0.085, depth));
  return mix(c, meat, smoothstep(0.095, 0.11, depth));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.45, 1.0, skin); }
`,
  },
  {
    id: 'mango', cat: 'fruit', tr: 'MANGO', en: 'MANGO', dot: '#f2a41c', skinT: 0.02,
    sound: { cut: 'juicy', hard: 0.25, wet: 0.85 },
    bounds: [[-1.4, -0.9, -1.0], [1.4, 0.9, 1.0]],
    shape: { op: 'union', of: [
      { type: 'ellipsoid', r: [1.12, 0.72, 0.8], rot: [0, 0, -0.18] },
      { type: 'capsule', a: [-1.02, 0.28, 0], b: [-1.18, 0.4, 0], r: 0.04, part: 1 },
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  if (part > 0.5) return vec3(0.32, 0.24, 0.1);
  // green shoulder blushing through yellow-orange to red
  float t = clamp(0.5 + 0.45 * p.x + 0.25 * p.y + 0.3 * (fFbm(p * 1.5) - 0.5), 0.0, 1.0);
  vec3 c = mix(vec3(0.45, 0.62, 0.15), vec3(0.98, 0.72, 0.12), smoothstep(0.1, 0.5, t));
  c = mix(c, vec3(0.88, 0.2, 0.12), smoothstep(0.6, 0.95, t));
  return mix(c, vec3(0.98, 0.9, 0.55), spots(p, 14.0, 0.06, 0.4) * 0.4);
}
vec3 itemInner(vec3 p, float depth, float part) {
  if (part > 0.5) return vec3(0.5, 0.4, 0.2);
  vec3 c = mix(vec3(1.0, 0.62, 0.05), vec3(1.0, 0.72, 0.15), fNoise(p * 12.0));
  c = mix(vec3(0.95, 0.75, 0.2), c, smoothstep(0.0, 0.04, depth));
  // the big flat stone in the middle, wrapped in pale fibres
  float stone = length(p / vec3(0.75, 0.35, 0.14));
  c = mix(c, vec3(0.98, 0.88, 0.62), (1.0 - smoothstep(0.95, 1.15, stone)) * 0.7);
  return mix(c, vec3(0.9, 0.82, 0.62) * (0.9 + 0.15 * fNoise(p * 50.0)), 1.0 - smoothstep(0.9, 1.0, stone));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.25, 0.35, skin); }
`,
  },
  {
    id: 'grapefruit', cat: 'fruit', tr: 'GREYFURT', en: 'GRAPEFRUIT', dot: '#f2785c', skinT: 0.03,
    sound: { cut: 'juicy', hard: 0.3, wet: 0.9 },
    shape: { op: 'subtract', k: 0.1, from: { type: 'ellipsoid', r: [1.0, 0.92, 1.0] }, cut: [{ type: 'sphere', at: [0, 0.98, 0], r: 0.1 }] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  vec3 c = mix(vec3(0.98, 0.72, 0.28), vec3(0.95, 0.5, 0.32), smoothstep(0.3, 0.8, fFbm(p * 1.8)));
  return c * (0.98 + 0.03 * fNoise(p * 20.0));
}
vec3 itemInner(vec3 p, float depth, float part) {
  vec3 pith = vec3(0.99, 0.93, 0.82);
  float rr = length(p.xz);
  vec3 flesh = citrusFlesh(rr, atan(p.z, p.x), p.y, 12.0, vec3(0.92, 0.22, 0.24), vec3(0.99, 0.45, 0.42), pith);
  vec3 c = mix(vec3(0.97, 0.6, 0.3), pith, smoothstep(0.02, 0.03, depth));
  c = mix(c, flesh, smoothstep(0.08, 0.1, depth));
  return mix(c, pith, 1.0 - smoothstep(0.05, 0.09, rr));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.35, 0.42, skin); }
`,
  },
  {
    id: 'plum', cat: 'fruit', tr: 'ERİK', en: 'PLUM', dot: '#5b1f5e', skinT: 0.018,
    sound: { cut: 'juicy', hard: 0.2, wet: 0.8 },
    shape: { op: 'union', of: [
      { op: 'subtract', k: 0.2, from: { type: 'ellipsoid', r: [0.9, 0.86, 0.84] }, cut: [{ type: 'sphere', at: [0, 0.92, 0], r: 0.14 }] },
      { type: 'capsule', a: [0, 0.7, 0], b: [0.05, 1.0, 0.02], r: [0.035, 0.025], part: 1 },
    ] },
    look: { sheen: 0.6, sheenColor: '#b7a6d6' },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  if (part > 0.5) return vec3(0.4, 0.3, 0.14);
  vec3 c = mix(vec3(0.38, 0.09, 0.32), vec3(0.24, 0.05, 0.24), fFbm(p * 2.0));
  // the seam down one side
  c *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.06, abs(p.z + 0.04 * p.y)));
  return c;
}
vec3 itemInner(vec3 p, float depth, float part) {
  if (part > 0.5) return vec3(0.6, 0.5, 0.3);
  vec3 c = mix(vec3(0.98, 0.78, 0.2), vec3(0.95, 0.66, 0.1), fNoise(p * 10.0));
  c = mix(vec3(0.75, 0.15, 0.2), c, smoothstep(0.01, 0.06, depth));
  // red flush around the stone and the brown stone itself
  float stone = length(p / vec3(0.36, 0.4, 0.26));
  c = mix(c, vec3(0.9, 0.35, 0.18), (1.0 - smoothstep(1.0, 1.4, stone)) * 0.6);
  return mix(c, vec3(0.6, 0.38, 0.2) * (0.9 + 0.2 * fNoise(p * 30.0)), 1.0 - smoothstep(0.92, 1.0, stone));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.25, 0.35, skin); }
`,
  },
  {
    id: 'lime', cat: 'fruit', tr: 'MİSKET LİMONU', en: 'LIME', dot: '#58a821', skinT: 0.025,
    sound: { cut: 'juicy', hard: 0.35, wet: 0.85 },
    shape: { type: 'ellipsoid', r: [0.95, 0.85, 0.85] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  vec3 c = mix(vec3(0.3, 0.6, 0.12), vec3(0.2, 0.48, 0.08), fFbm(p * 2.0));
  return c * (0.97 + 0.04 * fNoise(p * 20.0));
}
vec3 itemInner(vec3 p, float depth, float part) {
  vec3 pith = vec3(0.92, 0.96, 0.78);
  float rr = length(p.yz);
  vec3 flesh = citrusFlesh(rr, atan(p.z, p.y), p.x, 10.0, vec3(0.55, 0.78, 0.2), vec3(0.78, 0.92, 0.42), pith);
  vec3 c = mix(vec3(0.3, 0.6, 0.12), pith, smoothstep(0.015, 0.025, depth));
  c = mix(c, flesh, smoothstep(0.05, 0.07, depth));
  return mix(c, pith, 1.0 - smoothstep(0.04, 0.07, rr));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.35, 0.38, skin); }
`,
  },
];

export const MORE_VEGGIES = [
  {
    id: 'beet', cat: 'veg', tr: 'PANCAR', en: 'BEETROOT', dot: '#7a1033', skinT: 0.02,
    sound: { cut: 'crisp', hard: 0.6, wet: 0.5 },
    shape: { op: 'union', k: 0.1, of: [
      { type: 'sphere', at: [0, -0.1, 0], r: 0.82, part: 0 },
      { type: 'cone', at: [0, -0.95, 0], r1: 0.03, r2: 0.18, h: 0.12, part: 0 },
      { type: 'capsule', a: [0, 0.6, 0], b: [0.12, 1.15, 0.05], r: [0.06, 0.04], part: 1 },
      { type: 'capsule', a: [0, 0.6, 0], b: [-0.18, 1.1, -0.08], r: [0.06, 0.04], part: 1 },
      leaf([0.22, 1.32, 0.08], [0.1, 0.26, 0.03], [0, 0, -0.4]),
      leaf([-0.3, 1.25, -0.1], [0.1, 0.26, 0.03], [0, 0, 0.5]),
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  if (part > 1.5) return mix(vec3(0.15, 0.4, 0.12), vec3(0.45, 0.08, 0.2), smoothstep(0.08, 0.0, abs(p.x * 0.3 + p.z)));
  if (part > 0.5) return vec3(0.6, 0.08, 0.25);
  vec3 c = mix(vec3(0.42, 0.06, 0.16), vec3(0.3, 0.04, 0.12), fFbm(p * 3.0));
  return c * (0.9 + 0.12 * fNoise(p * vec3(30.0, 6.0, 30.0)));
}
vec3 itemInner(vec3 p, float depth, float part) {
  if (part > 0.5) return vec3(0.75, 0.25, 0.45);
  // deep magenta with paler concentric growth rings
  float r = length(p - vec3(0.0, -0.1, 0.0));
  float ring = abs(sin((r + fNoise(p * 3.0) * 0.05) * 38.0));
  vec3 c = mix(vec3(0.85, 0.3, 0.55), vec3(0.62, 0.02, 0.24), smoothstep(0.15, 0.6, ring));
  return mix(vec3(0.45, 0.05, 0.18), c, smoothstep(0.0, 0.03, depth));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return part > 0.5 ? 0.5 : mix(0.2, 0.55, skin); }
`,
  },
  {
    id: 'mushroom', cat: 'veg', tr: 'MANTAR', en: 'MUSHROOM', dot: '#d9c8ad', skinT: 0.02,
    sound: { cut: 'soft', hard: 0.2, wet: 0.3 },
    shape: { op: 'union', k: 0.08, of: [
      { op: 'subtract', k: 0.06, from: { type: 'ellipsoid', at: [0, 0.25, 0], r: [1.0, 0.7, 1.0], part: 0 }, cut: [{ type: 'box', at: [0, -0.6, 0], size: [1.5, 0.6, 1.5] }] },
      { type: 'cylinder', at: [0, -0.45, 0], r: 0.36, h: 0.5, round: 0.08, part: 1 },
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  if (part > 0.5) return vec3(0.95, 0.92, 0.85) * (0.95 + 0.05 * fNoise(p * 20.0));
  vec3 c = mix(vec3(0.86, 0.76, 0.62), vec3(0.72, 0.58, 0.44), smoothstep(0.4, 0.95, p.y));
  // the gills under the cap
  float a = atan(p.z, p.x);
  float gills = 0.5 + 0.5 * sin(a * 70.0);
  c = mix(c, mix(vec3(0.55, 0.42, 0.33), vec3(0.75, 0.62, 0.5), gills), 1.0 - smoothstep(-0.02, 0.05, p.y));
  return c * (0.95 + 0.06 * fNoise(p * 14.0));
}
vec3 itemInner(vec3 p, float depth, float part) {
  vec3 c = vec3(0.97, 0.94, 0.88) * (0.96 + 0.05 * fNoise(p * vec3(20.0, 60.0, 20.0)));
  return mix(vec3(0.82, 0.7, 0.56), c, smoothstep(0.0, 0.025, depth));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.6, 0.55, skin); }
`,
  },
  {
    id: 'zucchini', cat: 'veg', tr: 'KABAK', en: 'ZUCCHINI', dot: '#2f6b23', skinT: 0.02,
    sound: { cut: 'crisp', hard: 0.35, wet: 0.6 },
    bounds: [[-1.7, -0.6, -0.6], [1.7, 0.6, 0.6]],
    shape: { op: 'union', of: [
      { type: 'capsule', a: [-1.1, 0, 0], b: [1.05, 0, 0], r: [0.38, 0.42] },
      { type: 'cylinder', axis: 'x', at: [1.5, 0, 0], r: 0.12, h: 0.1, round: 0.03, part: 1 },
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  if (part > 0.5) return vec3(0.6, 0.65, 0.4);
  float a = atan(p.z, p.y);
  float fleck = spots(p * vec3(0.35, 1.0, 1.0), 16.0, 0.16, 0.45);
  vec3 c = mix(vec3(0.12, 0.32, 0.1), vec3(0.18, 0.4, 0.14), 0.5 + 0.5 * sin(a * 6.0));
  return mix(c, vec3(0.55, 0.68, 0.38), fleck * 0.5);
}
vec3 itemInner(vec3 p, float depth, float part) {
  if (part > 0.5) return vec3(0.8, 0.85, 0.6);
  float q = length(p.yz) / 0.4;
  vec3 c = mix(vec3(0.95, 0.96, 0.8), vec3(0.85, 0.92, 0.62), smoothstep(0.6, 1.0, q));
  c = mix(c, vec3(0.96, 0.95, 0.78), (1.0 - smoothstep(0.32, 0.4, q)) * 0.5);
  c = mix(c, vec3(0.9, 0.9, 0.72), spots(p, 26.0, 0.12, 0.4) * (1.0 - smoothstep(0.3, 0.4, q)));
  return mix(vec3(0.25, 0.5, 0.18), c, smoothstep(0.0, 0.025, depth));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.35, 0.25, skin); }
`,
  },
  {
    id: 'radish', cat: 'veg', tr: 'TURP', en: 'RADISH', dot: '#d81f4a', skinT: 0.02,
    sound: { cut: 'crisp', hard: 0.5, wet: 0.5 },
    shape: { op: 'union', k: 0.1, of: [
      { type: 'sphere', at: [0, -0.15, 0], r: 0.8, part: 0 },
      { type: 'cone', at: [0, -1.0, 0], r1: 0.02, r2: 0.16, h: 0.14, part: 0 },
      { type: 'capsule', a: [0, 0.55, 0], b: [0.1, 1.05, 0], r: [0.05, 0.035], part: 1 },
      leaf([0.25, 1.25, 0.05], [0.12, 0.3, 0.035], [0, 0, -0.5]),
      leaf([-0.25, 1.2, -0.05], [0.12, 0.3, 0.035], [0, 0, 0.5]),
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  if (part > 1.5) return leafGreen(p);
  if (part > 0.5) return vec3(0.75, 0.82, 0.55);
  vec3 c = mix(vec3(0.88, 0.1, 0.25), vec3(0.72, 0.05, 0.2), fFbm(p * 2.5));
  // white tip at the root end
  return mix(c, vec3(0.97, 0.94, 0.94), smoothstep(-0.55, -0.85, p.y));
}
vec3 itemInner(vec3 p, float depth, float part) {
  if (part > 0.5) return vec3(0.8, 0.9, 0.6);
  vec3 c = vec3(0.99, 0.98, 0.96) * (0.96 + 0.05 * fNoise(p * 40.0));
  // a thin red rim and faint rays from the centre
  float rays = smoothstep(0.7, 0.95, fNoise(vec3(atan(p.z, p.x) * 10.0, length(p.xz) * 3.0, p.y * 4.0)));
  c = mix(c, vec3(0.92, 0.9, 0.86), rays * 0.5);
  return mix(vec3(0.9, 0.15, 0.3), c, smoothstep(0.0, 0.025, depth));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return part > 0.5 ? 0.5 : mix(0.3, 0.2, skin); }
`,
  },
];

export const MORE_FOODS = [
  {
    id: 'cupcake', cat: 'food', tr: 'CUPCAKE', en: 'CUPCAKE', dot: '#f08fb5', skinT: 0.04,
    sound: { cut: 'soft', hard: 0.15, wet: 0.2 },
    shape: { op: 'union', k: 0.06, of: [
      { type: 'cone', at: [0, -0.55, 0], r1: 0.62, r2: 0.78, h: 0.42, lobes: { n: 24, amp: 0.03 }, part: 0 },
      { type: 'ellipsoid', at: [0, 0.0, 0], r: [0.86, 0.32, 0.86], part: 1 },
      { type: 'cone', at: [0, 0.38, 0], r1: 0.75, r2: 0.12, h: 0.42, round: 0.08, lobes: { n: 8, amp: 0.06 }, part: 2 },
      { type: 'sphere', at: [0, 0.95, 0], r: 0.15, part: 3 },
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  if (part > 2.5) return vec3(0.85, 0.05, 0.1);
  if (part > 1.5) {
    // swirled pink frosting with a few sprinkles
    vec3 c = mix(vec3(0.98, 0.6, 0.75), vec3(1.0, 0.75, 0.85), 0.5 + 0.5 * sin(atan(p.z, p.x) * 3.0 + p.y * 18.0));
    return mix(c, hsv(spotId(p, 16.0), 0.7, 0.98), spots(p, 16.0, 0.12, 0.3));
  }
  if (part > 0.5) return vec3(0.82, 0.55, 0.28);
  // pleated paper liner
  float a = atan(p.z, p.x);
  return mix(vec3(0.3, 0.55, 0.85), vec3(0.45, 0.7, 0.95), 0.5 + 0.5 * sin(a * 24.0));
}
vec3 itemInner(vec3 p, float depth, float part) {
  if (part > 2.5) return vec3(0.95, 0.3, 0.3);
  if (part > 1.5) return vec3(1.0, 0.8, 0.88);
  vec3 crumb = vec3(0.97, 0.88, 0.62) * (1.0 - 0.25 * crumbPores(p, 22.0));
  return mix(vec3(0.75, 0.5, 0.25), crumb, smoothstep(0.02, 0.05, depth));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return part > 1.5 ? 0.5 : 0.75; }
`,
  },
  {
    id: 'butter', cat: 'food', tr: 'TEREYAĞI', en: 'BUTTER', dot: '#f6dc6b', skinT: 0.01,
    sound: { cut: 'soft', hard: 0.15, wet: 0.1 },
    bounds: [[-1.4, -0.7, -0.8], [1.4, 0.7, 0.8]],
    shape: { type: 'box', size: [1.1, 0.42, 0.5], round: 0.05 },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) { return vec3(0.99, 0.88, 0.45) * (0.97 + 0.04 * fNoise(p * 12.0)); }
vec3 itemInner(vec3 p, float depth, float part) { return vec3(1.0, 0.9, 0.5) * (0.98 + 0.03 * fNoise(p * 30.0)); }
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.4, 0.3, skin); }
`,
  },
  {
    id: 'sandwich', cat: 'food', tr: 'SANDVİÇ', en: 'SANDWICH', dot: '#d9a35b', skinT: 0.05,
    sound: { cut: 'crisp', hard: 0.3, wet: 0.3 },
    bounds: [[-1.3, -0.8, -1.3], [1.3, 0.8, 1.3]],
    shape: { op: 'union', of: [
      { type: 'box', at: [0, -0.38, 0], size: [0.95, 0.2, 0.95], round: 0.1, part: 0 },
      { type: 'box', at: [0, -0.12, 0], size: [0.98, 0.05, 0.98], round: 0.03, lobes: { n: 9, amp: 0.05 }, part: 1 },
      { type: 'box', at: [0, -0.02, 0], size: [0.93, 0.05, 0.93], round: 0.02, part: 2 },
      { type: 'box', at: [0, 0.08, 0], size: [0.97, 0.04, 0.97], round: 0.02, rot: [0, 0.4, 0], part: 3 },
      { type: 'box', at: [0, 0.32, 0], size: [0.95, 0.2, 0.95], round: 0.1, part: 0 },
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  if (part > 2.5) return vec3(1.0, 0.78, 0.15);
  if (part > 1.5) return vec3(0.92, 0.55, 0.55);
  if (part > 0.5) return mix(vec3(0.35, 0.7, 0.18), vec3(0.55, 0.85, 0.3), fNoise(p * 10.0));
  // golden crust on the outside of the bread
  return mix(vec3(0.88, 0.62, 0.3), vec3(0.75, 0.48, 0.2), fFbm(p * 4.0));
}
vec3 itemInner(vec3 p, float depth, float part) {
  if (part > 2.5) return vec3(1.0, 0.8, 0.2);
  if (part > 1.5) return mix(vec3(0.95, 0.6, 0.6), vec3(0.98, 0.75, 0.72), fNoise(p * 20.0));
  if (part > 0.5) return vec3(0.6, 0.85, 0.4);
  vec3 crumb = vec3(0.98, 0.93, 0.8) * (1.0 - 0.2 * crumbPores(p, 26.0));
  return mix(vec3(0.75, 0.5, 0.22), crumb, smoothstep(0.03, 0.05, depth));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return part > 0.5 ? 0.4 : 0.8; }
`,
  },
];

export const MORE_OBJECTS = [
  {
    id: 'crayon', cat: 'object', tr: 'PASTEL BOYA', en: 'CRAYON', dot: '#2a6ad8', skinT: 0.03,
    sound: { cut: 'soft', hard: 0.4, wet: 0.0 },
    bounds: [[-1.7, -0.6, -0.6], [1.7, 0.6, 0.6]],
    shape: { op: 'union', k: 0.02, of: [
      { type: 'cylinder', axis: 'x', at: [-0.25, 0, 0], r: 0.42, h: 1.05, round: 0.04, part: 0 },
      { type: 'cone', axis: 'x', at: [1.12, 0, 0], r1: 0.42, r2: 0.1, h: 0.33, round: 0.03, part: 1 },
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  vec3 wax = vec3(0.12, 0.38, 0.85);
  if (part > 0.5) return wax;
  // paper label with dark bands and zig-zag stripes
  vec3 c = wax;
  float band = step(0.82, abs(fract(p.x * 0.6 + 0.5) - 0.5) * 2.0);
  c = mix(c, vec3(0.05, 0.1, 0.25), band);
  float zig = 1.0 - smoothstep(0.02, 0.05, abs(fract(p.x * 1.4 + abs(fract(atan(p.z, p.y) * 1.2) - 0.5) * 0.4) - 0.5));
  return mix(c, vec3(0.05, 0.12, 0.3), zig * 0.8);
}
vec3 itemInner(vec3 p, float depth, float part) {
  // a thin paper wrap around solid wax
  vec3 wax = vec3(0.15, 0.42, 0.88) * (0.97 + 0.04 * fNoise(p * 30.0));
  return part < 0.5 ? mix(vec3(0.95, 0.94, 0.9), wax, smoothstep(0.01, 0.02, depth)) : wax;
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.45, 0.6, skin); }
`,
  },
  {
    id: 'sponge', cat: 'object', tr: 'BULAŞIK SÜNGERİ', en: 'SPONGE', dot: '#f4d33a', skinT: 0.01,
    sound: { cut: 'soft', hard: 0.1, wet: 0.2 },
    bounds: [[-1.4, -0.7, -0.9], [1.4, 0.7, 0.9]],
    shape: { op: 'union', of: [
      { type: 'box', at: [0, -0.12, 0], size: [1.08, 0.4, 0.68], round: 0.08, part: 0 },
      { type: 'box', at: [0, 0.38, 0], size: [1.08, 0.12, 0.68], round: 0.04, part: 1 },
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  if (part > 0.5) return mix(vec3(0.12, 0.45, 0.2), vec3(0.2, 0.6, 0.28), fNoise(p * 40.0));
  return vec3(0.99, 0.84, 0.2) * (1.0 - 0.3 * crumbPores(p, 14.0));
}
vec3 itemInner(vec3 p, float depth, float part) {
  if (part > 0.5) return mix(vec3(0.1, 0.4, 0.18), vec3(0.22, 0.6, 0.3), fNoise(p * 50.0));
  return vec3(0.99, 0.86, 0.25) * (1.0 - 0.4 * crumbPores(p, 16.0));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return part > 0.5 ? 0.9 : 0.85; }
`,
  },
];
