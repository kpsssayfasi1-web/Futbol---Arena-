// More foods, objects and figures, in the same style as the rest of the
// catalog: simple, instantly recognisable shapes with believable insides.
export const EXTRA_FOODS = [
  {
    id: 'chocolate', cat: 'food', tr: 'ÇİKOLATA', en: 'CHOCOLATE BAR', dot: '#5a2e14', skinT: 0.012,
    sound: { cut: 'snap', hard: 0.6, wet: 0.0 },
    bounds: [[-1.4, -0.5, -0.9], [1.4, 0.5, 0.9]],
    shape: { op: 'union', k: 0.02, of: [
      { type: 'box', at: [0, -0.1, 0], size: [1.12, 0.1, 0.62], round: 0.03 },
      ...[-0.84, -0.28, 0.28, 0.84].flatMap((x) => [-0.31, 0.31].map((z) => ({ type: 'box', at: [x, 0.02, z], size: [0.25, 0.1, 0.27], round: 0.06 }))),
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  return mix(vec3(0.4, 0.2, 0.09), vec3(0.34, 0.16, 0.07), fNoise(p * 8.0));
}
vec3 itemInner(vec3 p, float depth, float part) {
  vec3 c = vec3(0.45, 0.24, 0.11) * (0.95 + 0.06 * fNoise(p * 60.0));
  // a few tiny air bubbles in the bar
  return mix(c, vec3(0.3, 0.15, 0.06), spots(p, 40.0, 0.12, 0.25));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.45, 0.22, skin); }
`,
  },
  {
    id: 'bread', cat: 'food', tr: 'EKMEK', en: 'BREAD', dot: '#c47a2c', skinT: 0.06,
    sound: { cut: 'crisp', hard: 0.4, wet: 0.0 },
    bounds: [[-1.5, -0.8, -0.9], [1.5, 0.9, 0.9]],
    shape: { op: 'union', k: 0.25, of: [
      { type: 'box', at: [0, -0.2, 0], size: [1.2, 0.38, 0.62], round: 0.18 },
      { type: 'ellipsoid', at: [0, 0.14, 0], r: [1.16, 0.5, 0.62] },
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  float top = smoothstep(-0.1, 0.4, p.y);
  vec3 c = mix(vec3(0.82, 0.55, 0.24), vec3(0.6, 0.32, 0.1), top);
  // diagonal scores on top, paler where the crust opened
  float score = 1.0 - smoothstep(0.0, 0.06, abs(fract(p.x * 1.4 + p.z * 0.6) - 0.5));
  c = mix(c, vec3(0.92, 0.75, 0.45), score * top * 0.7);
  return c * (0.9 + 0.15 * fFbm(p * 6.0));
}
vec3 itemInner(vec3 p, float depth, float part) {
  vec3 crumb = vec3(0.97, 0.9, 0.72) * (1.0 - 0.3 * crumbPores(p, 26.0));
  return mix(vec3(0.66, 0.38, 0.14), crumb, smoothstep(0.04, 0.07, depth));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.85, 0.6, skin); }
`,
  },
  {
    id: 'macaron', cat: 'food', tr: 'MAKARON', en: 'MACARON', dot: '#f39ab8', skinT: 0.05,
    sound: { cut: 'soft', hard: 0.25, wet: 0.1 },
    bounds: [[-1.2, -0.8, -1.2], [1.2, 0.8, 1.2]],
    shape: { op: 'union', k: 0.04, of: [
      { type: 'ellipsoid', at: [0, 0.32, 0], r: [0.95, 0.3, 0.95], part: 0 },
      { type: 'ellipsoid', at: [0, -0.32, 0], r: [0.95, 0.3, 0.95], part: 0 },
      { type: 'cylinder', r: 0.84, h: 0.13, round: 0.06, part: 1 },
      { type: 'cylinder', at: [0, 0.12, 0], r: 0.93, h: 0.05, round: 0.04, lobes: { n: 40, amp: 0.025 }, part: 0 },
      { type: 'cylinder', at: [0, -0.12, 0], r: 0.93, h: 0.05, round: 0.04, lobes: { n: 40, amp: 0.025 }, part: 0 },
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  if (part > 0.5) return vec3(0.99, 0.95, 0.86);
  vec3 c = mix(vec3(0.98, 0.6, 0.72), vec3(0.95, 0.5, 0.65), fFbm(p * 3.0));
  return c * (0.95 + 0.08 * fNoise(p * 40.0));
}
vec3 itemInner(vec3 p, float depth, float part) {
  if (part > 0.5) return vec3(0.99, 0.94, 0.84) * (0.97 + 0.04 * fNoise(p * 30.0));
  // airy shell: crisp pink crust, chewy paler inside with small holes
  vec3 c = vec3(0.98, 0.78, 0.84) * (1.0 - 0.2 * crumbPores(p, 30.0));
  return mix(vec3(0.97, 0.58, 0.7), c, smoothstep(0.02, 0.05, depth));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return part > 0.5 ? 0.35 : 0.6; }
`,
  },
];

export const EXTRA_OBJECTS = [
  {
    id: 'brick', cat: 'object', tr: 'OYUNCAK TUĞLA', en: 'TOY BRICK', dot: '#d41f16', skinT: 0.012,
    sound: { cut: 'rubber', hard: 0.6, wet: 0.0 },
    bounds: [[-1.3, -0.7, -0.8], [1.3, 0.8, 0.8]],
    shape: { op: 'union', k: 0.01, of: [
      { type: 'box', at: [0, -0.12, 0], size: [1.04, 0.48, 0.52], round: 0.035 },
      ...[-0.78, -0.26, 0.26, 0.78].flatMap((x) => [-0.26, 0.26].map((z) => ({ type: 'cylinder', at: [x, 0.42, z], r: 0.16, h: 0.08, round: 0.02 }))),
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) { return vec3(0.86, 0.07, 0.05); }
vec3 itemInner(vec3 p, float depth, float part) { return vec3(0.8, 0.06, 0.05) * (0.97 + 0.04 * fNoise(p * 50.0)); }
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.4, 0.18, skin); }
`,
  },
  {
    id: 'dice', cat: 'object', tr: 'ZAR', en: 'DICE', dot: '#f3f1ea', skinT: 0.02,
    sound: { cut: 'rubber', hard: 0.6, wet: 0.0 },
    shape: { type: 'box', size: [0.76, 0.76, 0.76], round: 0.14 },
    glsl: /* glsl */ `
// Pips on each face (1 on top, 2 front, 3 right, opposite faces add to 7).
float dicePip(vec2 uv, float n) {
  float d = 1e3;
  if (n == 1.0 || n == 3.0 || n == 5.0) d = min(d, length(uv));
  if (n >= 2.0) { d = min(d, length(uv - vec2(0.42, 0.42))); d = min(d, length(uv + vec2(0.42, 0.42))); }
  if (n >= 4.0) { d = min(d, length(uv - vec2(0.42, -0.42))); d = min(d, length(uv + vec2(0.42, -0.42))); }
  if (n == 6.0) { d = min(d, length(uv - vec2(0.42, 0.0))); d = min(d, length(uv + vec2(0.42, 0.0))); }
  return 1.0 - smoothstep(0.11, 0.13, d);
}
float dicePips(vec3 p) {
  vec3 a = abs(p);
  if (a.y >= a.x && a.y >= a.z) return dicePip(p.xz / 0.76, p.y > 0.0 ? 1.0 : 6.0);
  if (a.x >= a.z) return dicePip(p.zy / 0.76, p.x > 0.0 ? 3.0 : 4.0);
  return dicePip(p.xy / 0.76, p.z > 0.0 ? 2.0 : 5.0);
}
vec3 itemSkin(vec3 p, float part) {
  return mix(vec3(0.97, 0.96, 0.92), vec3(0.06, 0.06, 0.07), dicePips(p));
}
vec3 itemInner(vec3 p, float depth, float part) { return vec3(0.96, 0.95, 0.91) * (0.98 + 0.03 * fNoise(p * 40.0)); }
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.35, 0.2, skin); }
#define ITEM_BUMP
float itemBump(vec3 p, float part) { return -dicePips(p) * 0.6; }
`,
  },
];

export const EXTRA_FIGURES = [
  {
    id: 'tennis', cat: 'figure', tr: 'TENİS TOPU', en: 'TENNIS BALL', dot: '#cfe022', skinT: 0.04,
    sound: { cut: 'rubber', hard: 0.3, wet: 0.0 },
    look: { sheen: 0.9, sheenColor: '#f4ff9a' },
    shape: { op: 'subtract', from: { type: 'sphere', r: 0.86 }, cut: [{ type: 'sphere', r: 0.7 }] },
    glsl: /* glsl */ `
float tennisSeam(vec3 p) {
  vec3 d = normalize(p);
  float f = d.y - 0.62 * cos(2.0 * atan(d.z, d.x)) * length(d.xz);
  return 1.0 - smoothstep(0.025, 0.05, abs(f));
}
vec3 itemSkin(vec3 p, float part) {
  vec3 felt = mix(vec3(0.84, 0.92, 0.14), vec3(0.76, 0.86, 0.1), fNoise(p * 30.0));
  return mix(felt, vec3(0.97, 0.97, 0.92), tennisSeam(p));
}
vec3 itemInner(vec3 p, float depth, float part) {
  // felt, then the grey rubber shell; the ball is hollow
  return mix(vec3(0.8, 0.88, 0.2), vec3(0.42, 0.42, 0.4) * (0.95 + 0.08 * fNoise(p * 40.0)), smoothstep(0.02, 0.04, depth));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.6, 0.9, skin); }
`,
  },
  {
    id: 'basketball', cat: 'figure', tr: 'BASKETBOL TOPU', en: 'BASKETBALL', dot: '#e2661c', skinT: 0.03,
    sound: { cut: 'rubber', hard: 0.35, wet: 0.0 },
    shape: { op: 'subtract', from: { type: 'sphere', r: 0.9 }, cut: [{ type: 'sphere', r: 0.78 }] },
    glsl: /* glsl */ `
float ballLines(vec3 p) {
  vec3 d = normalize(p);
  float l = min(abs(d.x), abs(d.y));
  l = min(l, abs(length(d.xy) - 0.72));
  return 1.0 - smoothstep(0.016, 0.03, l);
}
vec3 itemSkin(vec3 p, float part) {
  vec3 c = mix(vec3(0.9, 0.4, 0.1), vec3(0.8, 0.32, 0.07), fFbm(p * 2.0));
  c *= 0.95 + 0.08 * fNoise(p * 22.0);
  return mix(c, vec3(0.08, 0.05, 0.04), ballLines(p));
}
vec3 itemInner(vec3 p, float depth, float part) {
  // rubber cover over a dark bladder; hollow inside
  return mix(vec3(0.82, 0.36, 0.1), vec3(0.2, 0.17, 0.15), smoothstep(0.03, 0.05, depth));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.7, 0.6, skin); }
#define ITEM_BUMP
float itemBump(vec3 p, float part) { return -ballLines(p) * 0.6; }
`,
  },
];
