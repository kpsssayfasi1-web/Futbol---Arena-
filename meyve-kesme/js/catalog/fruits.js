// Fruits. Shapes are in object space (about 1 unit radius); colours are GLSL.
const leaf = (at, r, rot, part = 2) => ({ type: 'ellipsoid', at, r, rot, part });

export const FRUITS = [
  {
    id: 'apple', cat: 'fruit', tr: 'ELMA', en: 'APPLE', dot: '#c8281e', skinT: 0.025,
    sound: { cut: 'crisp', hard: 0.35, wet: 0.45 },
    shape: { op: 'union', of: [
      { op: 'subtract', k: 0.25, from: { type: 'ellipsoid', r: [1.0, 0.9, 1.0], lobes: { n: 5, amp: 0.018 }, part: 0 },
        cut: [{ type: 'sphere', at: [0, 1.02, 0], r: 0.32 }, { type: 'sphere', at: [0, -1.0, 0], r: 0.22 }] },
      { type: 'capsule', a: [0, 0.6, 0], b: [0.08, 1.05, 0.02], r: [0.045, 0.032], part: 1 },
      leaf([0.38, 1.0, -0.08], [0.38, 0.032, 0.16], [0.1, 0.3, 0.42]),
    ] },
    glsl: /* glsl */ `
vec3 appleSkin(vec3 p) {
  vec3 d = normalize(p);
  float n1 = fFbm(p * 1.8);
  float streak = fFbm(vec3(d.x * 6.0, d.y * 1.1, d.z * 6.0));
  float blush = 0.5 + 0.5 * dot(d, normalize(vec3(-0.35, -0.25, 0.9)));
  float red = clamp(0.5 + 0.5 * blush + 0.75 * (streak - 0.5) + 0.3 * (n1 - 0.5) - 0.55 * smoothstep(0.55, 0.97, d.y), 0.0, 1.0);
  vec3 c = mix(vec3(0.95, 0.62, 0.12), vec3(0.9, 0.27, 0.05), smoothstep(0.05, 0.4, red));
  c = mix(c, vec3(0.64, 0.04, 0.03), smoothstep(0.35, 0.75, red));
  c = mix(c, vec3(0.34, 0.015, 0.02), smoothstep(0.78, 1.0, red) * 0.65);
  c = mix(c, vec3(0.6, 0.45, 0.15), smoothstep(0.88, 0.98, d.y) * 0.7);
  return mix(c, vec3(0.97, 0.8, 0.5), spots(p, 13.0, 0.1, 0.38) * 0.3);
}
vec3 appleFlesh(vec3 p, float depth) {
  vec3 c = vec3(0.93, 0.87, 0.68) * (0.95 + 0.07 * fNoise(p * 34.0));
  c = mix(vec3(0.97, 0.8, 0.52), c, smoothstep(0.0, 0.07, depth));
  float rr = length(p.xz);
  float core = length(vec2(rr / 0.25, (p.y - 0.03) / 0.52));
  c = mix(c * vec3(0.95, 0.96, 0.84), c, smoothstep(0.9, 1.04, core));
  c = mix(c, vec3(0.86, 0.83, 0.6), (1.0 - smoothstep(0.0, 0.035, abs(core - 1.0))) * 0.55);
  float seg = 2.0 * OBJ_PI / 5.0;
  float ac = floor(atan(p.z, p.x) / seg + 0.5) * seg;
  vec2 rd = vec2(cos(ac), sin(ac));
  vec2 td = vec2(-rd.y, rd.x);
  float lr = dot(p.xz, rd) - 0.13, lt = dot(p.xz, td), ly = p.y - 0.04;
  float carpel = sq(lr / 0.075) + sq(lt / 0.05) + sq(ly / 0.15);
  c = mix(c, vec3(0.9, 0.9, 0.74), (1.0 - smoothstep(0.8, 1.0, carpel)) * 0.7);
  float seed = sq(lr / 0.045) + sq(lt / 0.028) + sq(ly / 0.085);
  return mix(c, mix(vec3(0.36, 0.17, 0.06), vec3(0.18, 0.08, 0.03), clamp(seed, 0.0, 1.0)), 1.0 - smoothstep(0.9, 1.0, seed));
}
vec3 itemSkin(vec3 p, float part) {
  if (part > 1.5) return leafGreen(p);
  if (part > 0.5) return vec3(0.33, 0.19, 0.09) * (0.85 + 0.3 * fNoise(p * 40.0));
  return appleSkin(p);
}
vec3 itemInner(vec3 p, float depth, float part) {
  if (part > 1.5) return vec3(0.36, 0.62, 0.2);
  if (part > 0.5) return vec3(0.55, 0.42, 0.25);
  return appleFlesh(p, depth);
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return part > 0.5 ? 0.6 : mix(0.5, 0.28, skin); }
`,
  },
  {
    id: 'watermelon', cat: 'fruit', tr: 'KARPUZ', en: 'WATERMELON', dot: '#2f7a2a', skinT: 0.03,
    sound: { cut: 'juicy', hard: 0.3, wet: 0.9 },
    bounds: [[-1.6, -1.1, -1.2], [1.6, 1.1, 1.2]],
    shape: { op: 'union', of: [
      { type: 'ellipsoid', r: [1.24, 0.86, 0.86], part: 0 },
      { type: 'capsule', a: [1.15, 0.02, 0], b: [1.34, 0.12, 0.05], r: 0.035, part: 1 },
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  if (part > 0.5) return vec3(0.42, 0.45, 0.2);
  float ang = atan(p.z, p.y);
  float s = sin(ang * 8.0 + fFbm(p * 3.0) * 2.2 + 0.6 * sin(p.x * 4.0));
  float stripe = smoothstep(-0.1, 0.45, s + (fFbm(p * 9.0) - 0.5) * 0.8);
  vec3 c = mix(vec3(0.32, 0.52, 0.18), vec3(0.04, 0.17, 0.06), stripe) * (0.88 + 0.24 * fNoise(p * 12.0));
  float spotMask = (1.0 - smoothstep(-0.82, -0.62, p.y)) * (1.0 - smoothstep(0.0, 0.7, abs(p.x)));
  return mix(c, vec3(0.78, 0.7, 0.33), spotMask * 0.7);
}
vec3 itemInner(vec3 p, float depth, float part) {
  if (part > 0.5) return vec3(0.6, 0.65, 0.35);
  vec3 rind = mix(vec3(0.12, 0.33, 0.1), vec3(0.72, 0.84, 0.52), smoothstep(0.02, 0.06, depth));
  vec3 white = mix(vec3(0.72, 0.84, 0.52), vec3(0.96, 0.95, 0.8), smoothstep(0.07, 0.11, depth));
  vec3 flesh = mix(vec3(0.99, 0.62, 0.56), vec3(0.92, 0.16, 0.2) * (0.9 + 0.15 * fNoise(p * 18.0)), smoothstep(0.12, 0.22, depth));
  flesh = mix(flesh, vec3(1.0, 0.5, 0.52), smoothstep(0.75, 0.95, fNoise(p * 60.0)) * 0.35);
  vec3 c = mix(rind, white, smoothstep(0.06, 0.08, depth));
  c = mix(c, flesh, smoothstep(0.105, 0.13, depth));
  vec3 q = p / vec3(1.24, 0.86, 0.86);
  vec3 cell = floor(q * 7.0);
  vec3 cc = (cell + 0.5 + (fHash3(cell + 0.3) - 0.5) * 0.4) / 7.0;
  float L = length(cc);
  if (abs(L - 0.6) < 0.12 && fHash(cell + 2.2) > 0.35) {
    vec3 rdir = cc / max(L, 1e-4);
    vec3 v = q - cc;
    float along = dot(v, rdir);
    float e = sq(along / 0.034) + sq(length(v - along * rdir) / 0.02);
    c = mix(c, vec3(0.05, 0.03, 0.02), 1.0 - smoothstep(0.85, 1.0, e));
  }
  return c;
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.45, 0.4, skin); }
`,
  },
  {
    id: 'orange', cat: 'fruit', tr: 'PORTAKAL', en: 'ORANGE', dot: '#f28a12', skinT: 0.03,
    sound: { cut: 'juicy', hard: 0.3, wet: 0.8 },
    shape: { op: 'union', of: [
      { op: 'subtract', k: 0.12, from: { type: 'ellipsoid', r: [0.96, 0.9, 0.96], part: 0 }, cut: [{ type: 'sphere', at: [0, 0.98, 0], r: 0.12 }] },
      { type: 'capsule', a: [0, 0.8, 0], b: [0.01, 0.95, 0], r: 0.035, part: 1 },
      leaf([-0.26, 0.98, 0.12], [0.3, 0.028, 0.13], [0.05, 2.6, -0.35]),
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  if (part > 1.5) return leafGreen(p);
  if (part > 0.5) return vec3(0.35, 0.36, 0.14);
  vec3 c = mix(vec3(0.98, 0.36, 0.02), vec3(0.86, 0.24, 0.01), fFbm(p * 3.0));
  return c * (0.95 + 0.06 * smoothstep(0.3, 0.7, fNoise(p * 22.0)));
}
vec3 itemInner(vec3 p, float depth, float part) {
  if (part > 0.5) return vec3(0.45, 0.6, 0.25);
  vec3 pith = vec3(0.99, 0.92, 0.76);
  float rr = length(p.xz);
  float a = atan(p.z, p.x);
  float f = fract(a / (2.0 * OBJ_PI) * 11.0 + 0.13 * sin(p.y * 3.0));
  float memb = 1.0 - smoothstep(0.004, 0.012, min(f, 1.0 - f) * (2.0 * OBJ_PI / 11.0) * rr);
  vec3 flesh = mix(vec3(1.0, 0.5, 0.06), vec3(0.94, 0.33, 0.02), fNoise(vec3(rr * 30.0, a * 8.0, p.y * 6.0)));
  vec3 c = mix(vec3(0.98, 0.38, 0.03), pith, smoothstep(0.022, 0.032, depth));
  float inFlesh = smoothstep(0.075, 0.09, depth);
  c = mix(c, flesh, inFlesh);
  c = mix(c, pith, memb * inFlesh);
  return mix(c, pith, 1.0 - smoothstep(0.05, 0.09, rr));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.4, 0.55, skin); }
#define ITEM_BUMP
float itemBump(vec3 p, float part) { return part < 0.5 ? fNoise(p * 26.0) * 0.12 : 0.0; }
`,
  },
  {
    id: 'kiwi', cat: 'fruit', tr: 'KİVİ', en: 'KIWI', dot: '#7cae2a', skinT: 0.02,
    sound: { cut: 'juicy', hard: 0.2, wet: 0.85 },
    bounds: [[-1.5, -1.1, -1.2], [1.5, 1.1, 1.2]],
    shape: { op: 'union', k: 0.5, of: [
      { type: 'ellipsoid', at: [-0.1, 0, 0], r: [1.08, 0.82, 0.86] },
      { type: 'ellipsoid', at: [0.35, 0, 0], r: [0.82, 0.84, 0.88] },
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  vec3 c = mix(vec3(0.47, 0.34, 0.19), vec3(0.3, 0.2, 0.11), fFbm(p * 5.0));
  return c * (0.95 + 0.08 * fNoise(p * 26.0));
}
vec3 itemInner(vec3 p, float depth, float part) {
  float prof = sqrt(max(0.0, 1.0 - sq(p.x / 1.2)));
  float q = length(p.yz) / max(0.05, 0.86 * prof);
  float a = atan(p.z, p.y);
  vec3 green = vec3(0.36, 0.58, 0.12);
  vec3 lightg = vec3(0.62, 0.8, 0.34);
  vec3 flesh = mix(green, lightg, clamp(smoothstep(0.55, 0.9, fNoise(vec3(a * 9.0, q * 3.0, p.x * 2.0))) * (1.0 - q) * 1.3, 0.0, 1.0));
  flesh = mix(flesh, green * 0.8, smoothstep(0.7, 1.0, q));
  vec3 c = mix(vec3(0.95, 0.92, 0.72), flesh, smoothstep(0.18, 0.23, q));
  float ua = a / (2.0 * OBJ_PI) * 46.0;
  float h = fHash(vec3(floor(ua), floor(p.x * 14.0), 1.0));
  float dq = (q - (0.29 + (h - 0.5) * 0.08)) / 0.05;
  float da = (fract(ua) - 0.5) / 0.28;
  c = mix(c, vec3(0.06, 0.04, 0.02), (1.0 - smoothstep(0.7, 1.0, dq * dq + da * da)) * step(0.25, h));
  return mix(vec3(0.5, 0.55, 0.15), c, smoothstep(0.0, 0.03, depth));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.4, 0.85, skin); }
#define ITEM_BUMP
float itemBump(vec3 p, float part) { return fNoise(p * 34.0) * 0.06; }
`,
  },
  {
    id: 'lemon', cat: 'fruit', tr: 'LİMON', en: 'LEMON', dot: '#f2d21b', skinT: 0.035,
    sound: { cut: 'juicy', hard: 0.3, wet: 0.85 },
    bounds: [[-1.5, -1.0, -1.0], [1.5, 1.0, 1.0]],
    shape: { op: 'union', k: 0.28, of: [
      { type: 'ellipsoid', r: [0.98, 0.8, 0.8] },
      { type: 'sphere', at: [1.02, 0, 0], r: 0.13 },
      { type: 'sphere', at: [-1.0, 0, 0], r: 0.11 },
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  vec3 c = mix(vec3(1.0, 0.86, 0.1), vec3(0.95, 0.72, 0.05), fFbm(p * 3.0));
  c = mix(c, vec3(0.75, 0.8, 0.2), smoothstep(0.95, 1.12, abs(p.x)) * 0.6);
  return c * (0.95 + 0.06 * fNoise(p * 24.0));
}
vec3 itemInner(vec3 p, float depth, float part) {
  vec3 pith = vec3(0.99, 0.96, 0.82);
  float rr = length(p.yz);
  float a = atan(p.z, p.y);
  float f = fract(a / (2.0 * OBJ_PI) * 10.0);
  float memb = 1.0 - smoothstep(0.004, 0.012, min(f, 1.0 - f) * (2.0 * OBJ_PI / 10.0) * rr);
  vec3 flesh = mix(vec3(1.0, 0.95, 0.45), vec3(0.98, 0.86, 0.25), fNoise(vec3(rr * 30.0, a * 8.0, p.x * 6.0)));
  vec3 c = mix(vec3(1.0, 0.85, 0.12), pith, smoothstep(0.025, 0.035, depth));
  float inFlesh = smoothstep(0.085, 0.1, depth);
  c = mix(c, flesh, inFlesh);
  c = mix(c, pith, memb * inFlesh);
  float seedA = floor(a / (2.0 * OBJ_PI) * 10.0 + 0.5);
  float sh = fHash(vec3(seedA, 3.0, 7.0));
  vec2 sc = vec2(cos((seedA + 0.5) * 2.0 * OBJ_PI / 10.0), sin((seedA + 0.5) * 2.0 * OBJ_PI / 10.0)) * 0.16;
  float seed = sq(length(p.yz - sc) / 0.035) + sq((p.x - (sh - 0.5) * 0.4) / 0.08);
  c = mix(c, vec3(0.96, 0.9, 0.7), (1.0 - smoothstep(0.8, 1.0, seed)) * step(0.5, sh));
  return mix(c, pith, 1.0 - smoothstep(0.04, 0.07, rr));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.38, 0.5, skin); }
#define ITEM_BUMP
float itemBump(vec3 p, float part) { return fNoise(p * 28.0) * 0.12; }
`,
  },
  {
    id: 'peach', cat: 'fruit', tr: 'ŞEFTALİ', en: 'PEACH', dot: '#f3a36b', skinT: 0.02,
    sound: { cut: 'juicy', hard: 0.25, wet: 0.8 },
    shape: { op: 'union', of: [
      { op: 'subtract', k: 0.16, from: { type: 'sphere', r: 0.95, part: 0 },
        cut: [{ type: 'capsule', a: [0, -0.6, 0.99], b: [0, 0.75, 0.93], r: 0.06 }, { type: 'sphere', at: [0, 1.02, 0], r: 0.16 }] },
      { type: 'capsule', a: [0, 0.82, 0], b: [0.02, 0.95, 0], r: 0.03, part: 1 },
    ] },
    glsl: /* glsl */ `
float peachPit(vec3 p) { return sdEllipsoid(p - vec3(0.0, 0.05, 0.0), vec3(0.3, 0.4, 0.25)); }
vec3 itemSkin(vec3 p, float part) {
  if (part > 0.5) return vec3(0.35, 0.25, 0.12);
  vec3 d = normalize(p);
  float blush = smoothstep(-0.3, 0.7, dot(d, normalize(vec3(-0.2, 0.3, 0.9))) + (fFbm(p * 2.5) - 0.5) * 0.8);
  vec3 c = mix(vec3(1.0, 0.72, 0.32), vec3(0.88, 0.22, 0.12), blush);
  return c * (0.95 + 0.08 * fNoise(p * 40.0));
}
vec3 itemInner(vec3 p, float depth, float part) {
  float pit = peachPit(p);
  if (pit < 0.0) {
    float w = fFbm(p * 14.0);
    return mix(vec3(0.45, 0.22, 0.1), vec3(0.25, 0.1, 0.05), smoothstep(0.35, 0.65, w));
  }
  vec3 c = mix(vec3(1.0, 0.7, 0.25), vec3(0.98, 0.78, 0.38), fNoise(p * 10.0));
  c = mix(vec3(0.85, 0.25, 0.12), c, smoothstep(0.0, 0.12, pit));
  return mix(vec3(0.95, 0.5, 0.2), c, smoothstep(0.0, 0.05, depth));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.45, 0.8, skin); }
`,
  },
  {
    id: 'avocado', cat: 'fruit', tr: 'AVOKADO', en: 'AVOCADO', dot: '#3f5b1e', skinT: 0.025,
    sound: { cut: 'soft', hard: 0.2, wet: 0.5 },
    bounds: [[-1.1, -1.2, -1.1], [1.1, 1.4, 1.1]],
    shape: { op: 'union', k: 0.55, of: [
      { type: 'sphere', at: [0, -0.18, 0], r: 0.8 },
      { type: 'sphere', at: [0, 0.6, 0], r: 0.5 },
    ] },
    glsl: /* glsl */ `
float avoSeed(vec3 p) { return length((p - vec3(0.0, -0.12, 0.0)) / vec3(1.0, 1.15, 1.0)) - 0.37; }
vec3 itemSkin(vec3 p, float part) {
  return mix(vec3(0.12, 0.2, 0.06), vec3(0.06, 0.09, 0.03), fFbm(p * 9.0)) * (0.9 + 0.2 * spots(p, 20.0, 0.2, 0.5));
}
vec3 itemInner(vec3 p, float depth, float part) {
  float s = avoSeed(p);
  if (s < 0.0) return mix(vec3(0.75, 0.58, 0.38), vec3(0.42, 0.24, 0.12), smoothstep(-0.03, 0.0, s));
  vec3 c = mix(vec3(0.96, 0.93, 0.6), vec3(0.74, 0.8, 0.36), smoothstep(0.05, 0.4, s));
  c = mix(vec3(0.15, 0.38, 0.06), c, smoothstep(0.0, 0.06, depth));
  return c * (0.96 + 0.05 * fNoise(p * 20.0));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.35, 0.75, skin); }
#define ITEM_BUMP
float itemBump(vec3 p, float part) { return fNoise(p * 22.0) * 0.4; }
`,
  },
  {
    id: 'strawberry', cat: 'fruit', tr: 'ÇİLEK', en: 'STRAWBERRY', dot: '#e0263a', skinT: 0.025,
    sound: { cut: 'juicy', hard: 0.15, wet: 0.85 },
    bounds: [[-1.4, -1.0, -1.1], [1.3, 1.0, 1.1]],
    shape: { op: 'union', of: [
      { op: 'union', k: 0.4, of: [
        { type: 'sphere', at: [-0.28, 0, 0], r: 0.72 },
        { type: 'cone', axis: 'x', at: [0.38, 0, 0], r1: 0.66, r2: 0.1, h: 0.5, round: 0.06 },
      ] },
      ...[0, 1, 2, 3, 4].map((i) => leaf([-0.96, Math.cos((i * 2 * Math.PI) / 5) * 0.24, Math.sin((i * 2 * Math.PI) / 5) * 0.24], [0.04, 0.3, 0.12], [(i * 2 * Math.PI) / 5, 0, 0.35], 1)),
      { type: 'capsule', a: [-0.95, 0, 0], b: [-1.22, 0.1, 0], r: 0.035, part: 1 },
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  if (part > 0.5) return leafGreen(p);
  vec3 c = mix(vec3(0.85, 0.05, 0.08), vec3(0.6, 0.02, 0.05), fFbm(p * 4.0));
  return mix(c, vec3(0.98, 0.85, 0.3), spots(p, 11.0, 0.12, 0.85));
}
vec3 itemInner(vec3 p, float depth, float part) {
  if (part > 0.5) return vec3(0.4, 0.65, 0.25);
  float axisD = length(p.yz) / max(0.1, 0.72 - max(p.x, 0.0) * 0.7);
  float a = atan(p.z, p.y);
  vec3 c = mix(vec3(1.0, 0.82, 0.82), vec3(0.88, 0.1, 0.15), smoothstep(0.25, 0.7, axisD));
  c = mix(c, vec3(0.9, 0.2, 0.25), smoothstep(0.7, 0.95, fNoise(vec3(a * 6.0, axisD * 2.0, p.x * 3.0))) * (1.0 - smoothstep(0.2, 0.6, axisD)) * 0.6);
  return mix(vec3(0.8, 0.04, 0.08), c, smoothstep(0.0, 0.06, depth));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return part > 0.5 ? 0.6 : mix(0.45, 0.25, skin); }
`,
  },
];
