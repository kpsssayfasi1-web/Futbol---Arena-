// Objects: the classic ASMR cutting materials (soap, kinetic sand, candles...).
export const OBJECTS = [
  {
    id: 'soap', cat: 'object', tr: 'SABUN', en: 'SOAP', dot: '#b9a1e6', skinT: 0.015,
    sound: { cut: 'soft', hard: 0.3, wet: 0.1 },
    bounds: [[-1.3, -0.6, -0.9], [1.3, 0.6, 0.9]],
    shape: { type: 'box', size: [1.08, 0.44, 0.7], round: 0.2 },
    glsl: /* glsl */ `
vec3 soapMarble(vec3 p) {
  float w = fFbm(p * 1.4 + fFbm(p * 2.2) * 1.6);
  float band = 0.5 + 0.5 * sin(w * 14.0);
  vec3 c = mix(vec3(0.72, 0.62, 0.92), vec3(0.98, 0.72, 0.85), smoothstep(0.3, 0.7, band));
  return mix(c, vec3(1.0, 0.97, 1.0), smoothstep(0.88, 0.98, band));
}
vec3 itemSkin(vec3 p, float part) { return soapMarble(p) * 1.02; }
vec3 itemInner(vec3 p, float depth, float part) { return soapMarble(p); }
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.45, 0.3, skin); }
`,
  },
  {
    id: 'sand', cat: 'object', tr: 'KİNETİK KUM', en: 'KINETIC SAND', dot: '#5fc3d8', skinT: 0.01,
    sound: { cut: 'sand', hard: 0.05, wet: 0.0 },
    shape: { type: 'box', size: [1.0, 0.6, 1.0], round: 0.05 },
    glsl: /* glsl */ `
vec3 itemInner(vec3 p, float depth, float part) {
  float y = p.y + 0.06 * sin(p.x * 3.0 + p.z * 2.0) + 0.04 * sin(p.z * 5.0);
  float layer = floor((y + 0.6) / 0.2);
  vec3 c = hsv(fract(layer * 0.17 + 0.55), 0.55, 0.95);
  float grain = fNoise(p * 160.0);
  return c * (0.85 + 0.25 * grain);
}
vec3 itemSkin(vec3 p, float part) { return itemInner(p, 0.0, part); }
#define ITEM_ROUGH
float itemRough(float part, float skin) { return 0.95; }
`,
  },
  {
    id: 'candle', cat: 'object', tr: 'MUM', en: 'CANDLE', dot: '#f6d6a8', skinT: 0.012,
    sound: { cut: 'soft', hard: 0.35, wet: 0.0 },
    bounds: [[-0.8, -1.1, -0.8], [0.8, 1.35, 0.8]],
    shape: { op: 'union', of: [
      { type: 'cylinder', r: 0.6, h: 0.95, round: 0.06, part: 0 },
      { type: 'capsule', a: [0, 0.8, 0], b: [0.02, 1.13, 0], r: 0.028, part: 1 },
    ] },
    glsl: /* glsl */ `
vec3 candleWax(vec3 p) {
  float layer = floor((p.y + 0.95 + 0.03 * sin(atan(p.z, p.x) * 3.0)) / 0.27);
  vec3 c = hsv(fract(0.95 - layer * 0.13), 0.35, 1.0);
  return c * (0.95 + 0.05 * fNoise(p * 20.0));
}
vec3 itemSkin(vec3 p, float part) { return part > 0.5 ? vec3(0.08, 0.06, 0.05) : candleWax(p) * 1.03; }
vec3 itemInner(vec3 p, float depth, float part) {
  if (part > 0.5 || length(p.xz) < 0.028) return vec3(0.12, 0.1, 0.08);
  return candleWax(p);
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return 0.35; }
`,
  },
  {
    id: 'gold', cat: 'object', tr: 'ALTIN KÜLÇE', en: 'GOLD BAR', dot: '#d4a72c', skinT: 0.01, envBoost: 6,
    sound: { cut: 'metal', hard: 1.0, wet: 0.0 },
    bounds: [[-1.3, -0.6, -0.8], [1.3, 0.6, 0.8]],
    shape: { op: 'intersect', of: [
      { type: 'box', size: [1.15, 0.32, 0.62], round: 0.04 },
      { type: 'box', at: [0, -0.32, 0], size: [1.3, 0.62, 0.62], rot: [0.32, 0, 0], round: 0.02 },
      { type: 'box', at: [0, -0.32, 0], size: [1.3, 0.62, 0.62], rot: [-0.32, 0, 0], round: 0.02 },
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  vec3 c = vec3(1.0, 0.72, 0.22);
  float stamp = step(abs(p.x), 0.55) * step(abs(p.z), 0.18) * step(0.2, p.y);
  float edge = stamp * (1.0 - step(abs(p.x), 0.5) * step(abs(p.z), 0.14));
  return c * (1.0 - 0.25 * edge) * (0.97 + 0.04 * fNoise(p * 30.0));
}
vec3 itemInner(vec3 p, float depth, float part) { return vec3(1.0, 0.74, 0.25); }
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.34, 0.26, skin); }
#define ITEM_METAL
float itemMetal(float part) { return 0.85; }
`,
  },
  {
    id: 'rubik', cat: 'object', tr: 'ZEKA KÜPÜ', en: 'PUZZLE CUBE', dot: '#2a7de1', skinT: 0.03,
    sound: { cut: 'snap', hard: 0.85, wet: 0.0 },
    shape: { type: 'box', size: [0.85, 0.85, 0.85], round: 0.07 },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  vec3 a = abs(p);
  vec3 col;
  vec2 uv;
  if (a.y >= a.x && a.y >= a.z) { col = p.y > 0.0 ? vec3(0.95) : vec3(1.0, 0.85, 0.05); uv = p.xz; }
  else if (a.x >= a.z) { col = p.x > 0.0 ? vec3(0.85, 0.08, 0.08) : vec3(1.0, 0.45, 0.02); uv = p.yz; }
  else { col = p.z > 0.0 ? vec3(0.05, 0.65, 0.25) : vec3(0.05, 0.3, 0.85); uv = p.xy; }
  vec2 g = abs(fract((uv + 0.85) / 0.5667) - 0.5);
  float sticker = step(max(g.x, g.y), 0.4);
  return mix(vec3(0.03), col, sticker);
}
vec3 itemInner(vec3 p, float depth, float part) { return vec3(0.05) + 0.03 * fNoise(p * 10.0); }
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.6, 0.25, skin); }
`,
  },
  {
    id: 'jawbreaker', cat: 'object', tr: 'ŞEKER TOPU', en: 'JAWBREAKER', dot: '#ff5a8a', skinT: 0.02,
    sound: { cut: 'snap', hard: 0.9, wet: 0.0 },
    shape: { type: 'sphere', r: 0.95 },
    glsl: /* glsl */ `
vec3 candyLayer(float depth) {
  float layer = floor(depth / 0.085);
  float f = fract(depth / 0.085);
  vec3 c = hsv(fract(layer * 0.137), 0.75, 1.0);
  return mix(vec3(1.0), c, smoothstep(0.0, 0.12, f));
}
vec3 itemSkin(vec3 p, float part) { return hsv(0.95, 0.6, 1.0) * (0.95 + 0.05 * fNoise(p * 12.0)); }
vec3 itemInner(vec3 p, float depth, float part) { return candyLayer(depth); }
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.3, 0.12, skin); }
`,
  },
];

// Soccer ball helpers: nearest face of a truncated icosahedron.
const BALL_GLSL = /* glsl */ `
void ballFaces(vec3 d, out float best, out float second, out float isPent) {
  const float P = 1.61803399;
  vec3 V[12] = vec3[12](vec3(0, 1, P), vec3(0, -1, P), vec3(0, 1, -P), vec3(0, -1, -P), vec3(1, P, 0), vec3(-1, P, 0), vec3(1, -P, 0), vec3(-1, -P, 0), vec3(P, 0, 1), vec3(-P, 0, 1), vec3(P, 0, -1), vec3(-P, 0, -1));
  vec3 H[20] = vec3[20](vec3(1, 1, 1), vec3(1, 1, -1), vec3(1, -1, 1), vec3(1, -1, -1), vec3(-1, 1, 1), vec3(-1, 1, -1), vec3(-1, -1, 1), vec3(-1, -1, -1), vec3(0, 1.0 / P, P), vec3(0, 1.0 / P, -P), vec3(0, -1.0 / P, P), vec3(0, -1.0 / P, -P), vec3(1.0 / P, P, 0), vec3(-1.0 / P, P, 0), vec3(1.0 / P, -P, 0), vec3(-1.0 / P, -P, 0), vec3(P, 0, 1.0 / P), vec3(-P, 0, 1.0 / P), vec3(P, 0, -1.0 / P), vec3(-P, 0, -1.0 / P));
  best = -2.0; second = -2.0; isPent = 0.0;
  for (int i = 0; i < 12; i++) { float v = dot(d, normalize(V[i])) + 0.035; if (v > best) { second = best; best = v; isPent = 1.0; } else if (v > second) second = v; }
  for (int i = 0; i < 20; i++) { float v = dot(d, normalize(H[i])); if (v > best) { second = best; best = v; isPent = 0.0; } else if (v > second) second = v; }
}
`;

export const FIGURES = [
  {
    id: 'duck', cat: 'figure', tr: 'LASTİK ÖRDEK', en: 'RUBBER DUCK', dot: '#ffd21f', skinT: 0.03,
    sound: { cut: 'rubber', hard: 0.4, wet: 0.0 },
    bounds: [[-1.4, -1.0, -1.1], [1.4, 1.2, 1.1]],
    shape: { op: 'union', of: [
      { op: 'union', k: 0.28, of: [
        { type: 'ellipsoid', at: [-0.05, -0.28, 0], r: [0.95, 0.58, 0.74] },
        { type: 'ellipsoid', at: [-0.85, -0.02, 0], r: [0.36, 0.2, 0.3], rot: [0, 0, 0.7] },
        { type: 'sphere', at: [0.42, 0.5, 0], r: 0.47 },
      ] },
      { type: 'ellipsoid', at: [0.92, 0.42, 0], r: [0.3, 0.1, 0.22], rot: [0, 0, -0.1], part: 1 },
      { type: 'sphere', at: [0.76, 0.66, 0.24], r: 0.075, part: 2 },
      { type: 'sphere', at: [0.76, 0.66, -0.24], r: 0.075, part: 2 },
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  if (part > 1.5) return mix(vec3(0.02), vec3(1.0), 1.0 - smoothstep(0.0, 0.025, length(p - vec3(0.8, 0.71, sign(p.z) * 0.27))));
  if (part > 0.5) return vec3(1.0, 0.45, 0.05);
  return mix(vec3(1.0, 0.85, 0.1), vec3(1.0, 0.74, 0.05), fNoise(p * 3.0));
}
vec3 itemInner(vec3 p, float depth, float part) {
  if (part > 1.5) return vec3(0.05);
  if (part > 0.5) return vec3(1.0, 0.55, 0.15);
  return mix(vec3(1.0, 0.9, 0.35), vec3(1.0, 0.95, 0.6), fNoise(p * 9.0));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.5, 0.22, skin); }
`,
  },
  {
    id: 'snowman', cat: 'figure', tr: 'KARDAN ADAM', en: 'SNOWMAN', dot: '#e8f2ff', skinT: 0.02,
    sound: { cut: 'sand', hard: 0.1, wet: 0.2 },
    bounds: [[-0.9, -1.1, -0.9], [0.9, 1.5, 0.9]],
    shape: { op: 'union', of: [
      { op: 'union', k: 0.08, of: [
        { type: 'sphere', at: [0, -0.47, 0], r: 0.56 },
        { type: 'sphere', at: [0, 0.28, 0], r: 0.41 },
        { type: 'sphere', at: [0, 0.84, 0], r: 0.3 },
      ] },
      { type: 'cone', axis: 'z', at: [0, 0.84, 0.4], r1: 0.065, r2: 0.01, h: 0.15, part: 1 },
      { type: 'sphere', at: [0.1, 0.93, 0.25], r: 0.04, part: 2 },
      { type: 'sphere', at: [-0.1, 0.93, 0.25], r: 0.04, part: 2 },
      { type: 'sphere', at: [0, 0.42, 0.37], r: 0.045, part: 2 },
      { type: 'sphere', at: [0, 0.24, 0.4], r: 0.045, part: 2 },
      { type: 'sphere', at: [0, 0.06, 0.38], r: 0.045, part: 2 },
      { type: 'cylinder', at: [0, 1.1, 0], r: 0.34, h: 0.025, part: 3 },
      { type: 'cylinder', at: [0, 1.3, 0], r: 0.22, h: 0.19, round: 0.02, part: 3 },
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  if (part > 2.5) return vec3(0.06, 0.06, 0.08) + vec3(0.5, 0.05, 0.05) * step(abs(p.y - 1.16), 0.035);
  if (part > 1.5) return vec3(0.04);
  if (part > 0.5) return vec3(1.0, 0.45, 0.05);
  return vec3(0.95, 0.97, 1.0) * (0.92 + 0.1 * fNoise(p * 30.0));
}
vec3 itemInner(vec3 p, float depth, float part) {
  if (part > 0.5) return itemSkin(p, part) * 1.1;
  return mix(vec3(0.88, 0.93, 1.0), vec3(1.0), spots(p, 40.0, 0.2, 0.4));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return part > 2.5 ? 0.6 : 0.85; }
`,
  },
  {
    id: 'teddy', cat: 'figure', tr: 'OYUNCAK AYI', en: 'TEDDY BEAR', dot: '#9a5b2b', skinT: 0.035,
    sound: { cut: 'soft', hard: 0.05, wet: 0.0 },
    bounds: [[-1.0, -1.1, -0.9], [1.0, 1.25, 1.0]],
    shape: { op: 'union', of: [
      { op: 'union', k: 0.12, of: [
        { type: 'ellipsoid', at: [0, -0.28, 0], r: [0.6, 0.66, 0.52] },
        { type: 'sphere', at: [0, 0.6, 0], r: 0.46 },
        { type: 'sphere', at: [0.35, 0.98, 0], r: 0.15 },
        { type: 'sphere', at: [-0.35, 0.98, 0], r: 0.15 },
        { type: 'ellipsoid', at: [0.58, -0.12, 0.12], r: [0.17, 0.36, 0.19], rot: [0, 0, 0.45] },
        { type: 'ellipsoid', at: [-0.58, -0.12, 0.12], r: [0.17, 0.36, 0.19], rot: [0, 0, -0.45] },
        { type: 'ellipsoid', at: [0.33, -0.8, 0.22], r: [0.22, 0.2, 0.34] },
        { type: 'ellipsoid', at: [-0.33, -0.8, 0.22], r: [0.22, 0.2, 0.34] },
      ] },
      { type: 'ellipsoid', at: [0, 0.5, 0.4], r: [0.19, 0.14, 0.15], part: 1 },
      { type: 'sphere', at: [0, 0.57, 0.55], r: 0.06, part: 2 },
      { type: 'sphere', at: [0.16, 0.72, 0.38], r: 0.045, part: 2 },
      { type: 'sphere', at: [-0.16, 0.72, 0.38], r: 0.045, part: 2 },
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  if (part > 1.5) return vec3(0.04);
  if (part > 0.5) return vec3(0.85, 0.65, 0.45);
  float belly = 1.0 - smoothstep(0.3, 0.36, length((p - vec3(0.0, -0.25, 0.5)) / vec3(1.0, 1.3, 1.0)));
  vec3 fur = mix(vec3(0.58, 0.34, 0.15), vec3(0.42, 0.23, 0.1), fNoise(p * 50.0));
  return mix(fur, vec3(0.85, 0.65, 0.45), belly);
}
vec3 itemInner(vec3 p, float depth, float part) {
  if (part > 1.5) return vec3(0.05);
  return mix(vec3(0.95, 0.94, 0.9), vec3(1.0), fNoise(p * vec3(40.0, 8.0, 40.0)));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return part > 1.5 ? 0.3 : 0.92; }
#define ITEM_BUMP
float itemBump(vec3 p, float part) { return part < 0.5 ? fNoise(p * 60.0) * 0.3 : 0.0; }
`,
  },
  {
    id: 'emoji', cat: 'figure', tr: 'GÜLEN SURAT', en: 'SMILEY', dot: '#ffcc1a', skinT: 0.03,
    sound: { cut: 'rubber', hard: 0.35, wet: 0.0 },
    shape: { type: 'sphere', r: 0.95 },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  vec3 d = normalize(p);
  vec3 fwd = normalize(vec3(0.5, 0.12, 0.86));
  vec3 right = normalize(cross(vec3(0, 1, 0), fwd));
  vec3 up = cross(fwd, right);
  float u = dot(d, right), v = dot(d, up);
  float front = step(0.0, dot(d, fwd));
  float eyes = (1.0 - smoothstep(0.9, 1.0, sq((abs(u) - 0.3) / 0.1) + sq((v - 0.25) / 0.17))) * front;
  float smile = (1.0 - smoothstep(0.035, 0.055, abs(length(vec2(u, v + 0.02)) - 0.5))) * step(v, -0.12) * front;
  float cheek = (1.0 - smoothstep(0.0, 0.14, length(vec2(abs(u) - 0.52, v + 0.18)))) * front;
  vec3 c = mix(vec3(1.0, 0.8, 0.1), vec3(1.0, 0.65, 0.05), (1.0 - smoothstep(-0.9, 0.2, v)) * 0.5);
  c = mix(c, vec3(1.0, 0.5, 0.35), cheek * 0.5);
  return mix(c, vec3(0.25, 0.12, 0.03), max(eyes, smile));
}
vec3 itemInner(vec3 p, float depth, float part) { return mix(vec3(1.0, 0.78, 0.15), vec3(1.0, 0.92, 0.5), smoothstep(0.1, 0.8, depth)); }
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.5, 0.25, skin); }
`,
  },
  {
    id: 'heart', cat: 'figure', tr: 'KALP', en: 'HEART', dot: '#d8143a', skinT: 0.03,
    sound: { cut: 'soft', hard: 0.2, wet: 0.3 },
    bounds: [[-1.2, -1.3, -0.8], [1.2, 1.1, 0.8]],
    shape: { op: 'union', k: 0.35, of: [
      { type: 'ellipsoid', at: [0.35, 0.3, 0], r: [0.58, 0.56, 0.44], rot: [0, 0.52, 0] },
      { type: 'ellipsoid', at: [-0.35, 0.3, 0], r: [0.58, 0.56, 0.44], rot: [0, 0.52, 0] },
      { type: 'cone', at: [0, -0.42, 0], r1: 0.05, r2: 0.62, h: 0.52, rot: [0, 0.52, 0] },
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) { return mix(vec3(0.9, 0.06, 0.14), vec3(0.6, 0.02, 0.08), fFbm(p * 2.0)); }
vec3 itemInner(vec3 p, float depth, float part) {
  vec3 cake = vec3(0.7, 0.08, 0.12) * (0.9 + 0.15 * fNoise(p * 26.0));
  return mix(cake, vec3(1.0, 0.96, 0.92), smoothstep(0.26, 0.3, depth));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.7, 0.2, skin); }
`,
  },
  {
    id: 'football', cat: 'figure', tr: 'FUTBOL TOPU', en: 'SOCCER BALL', dot: '#f5f5f5', skinT: 0.03,
    sound: { cut: 'rubber', hard: 0.45, wet: 0.0 },
    shape: { type: 'sphere', r: 0.95 },
    glsl: `${BALL_GLSL}
vec3 itemSkin(vec3 p, float part) {
  float best, second, pent;
  ballFaces(normalize(p), best, second, pent);
  float seam = 1.0 - smoothstep(0.004, 0.012, best - second);
  vec3 c = pent > 0.5 ? vec3(0.04) : vec3(0.96);
  return mix(c, vec3(0.35), seam);
}
vec3 itemInner(vec3 p, float depth, float part) {
  if (depth < 0.05) return vec3(0.12);
  return mix(vec3(0.82, 0.84, 0.86), vec3(0.95), spots(p, 30.0, 0.3, 0.7));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.6, 0.35, skin); }
#define ITEM_BUMP
float itemBump(vec3 p, float part) { float b, s, pe; ballFaces(normalize(p), b, s, pe); return smoothstep(0.0, 0.02, b - s) * 0.5; }
`,
  },
];

export const SPACE = [
  {
    id: 'earth', cat: 'space', tr: 'DÜNYA', en: 'EARTH', proper: true, dot: '#2f6fd1', skinT: 0.02,
    sound: { cut: 'rock', hard: 0.6, wet: 0.0 },
    shape: { type: 'sphere', r: 0.98 },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  vec3 d = normalize(p);
  float land = fFbm(d * 2.1 + vec3(3.0, 1.0, 7.0));
  vec3 ocean = mix(vec3(0.02, 0.1, 0.38), vec3(0.05, 0.32, 0.58), smoothstep(0.38, 0.5, land));
  vec3 ground = mix(vec3(0.16, 0.42, 0.12), vec3(0.58, 0.48, 0.26), smoothstep(0.55, 0.7, fFbm(d * 5.0)));
  vec3 c = mix(ocean, ground, smoothstep(0.5, 0.52, land));
  c = mix(c, vec3(0.97), smoothstep(0.82, 0.9, abs(d.y)));
  float cloud = smoothstep(0.55, 0.75, fFbm(d * 3.5 + vec3(9.0, 2.0, 4.0)));
  return mix(c, vec3(1.0), cloud * 0.6);
}
vec3 itemInner(vec3 p, float depth, float part) {
  if (depth < 0.05) return vec3(0.45, 0.35, 0.28);
  if (depth < 0.45) return mix(vec3(0.75, 0.22, 0.06), vec3(0.95, 0.45, 0.1), smoothstep(0.05, 0.45, depth) + (fNoise(p * 8.0) - 0.5) * 0.3);
  if (depth < 0.72) return vec3(1.0, 0.68, 0.15);
  return vec3(1.0, 0.95, 0.7);
}
#define ITEM_EMISSIVE
vec3 itemEmissive(vec3 p, float depth, float part) {
  return vec3(1.0, 0.45, 0.08) * smoothstep(0.2, 0.45, depth) * 0.35 + vec3(1.0, 0.75, 0.3) * smoothstep(0.45, 0.75, depth) * 0.9;
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.7, 0.35, skin); }
`,
  },
  {
    id: 'moon', cat: 'space', tr: 'AY', en: 'MOON', proper: true, dot: '#bdbdbd', skinT: 0.03,
    sound: { cut: 'rock', hard: 0.65, wet: 0.0 },
    shape: { type: 'sphere', r: 0.92 },
    glsl: /* glsl */ `
float crater(vec3 d) {
  vec3 q = d * 4.0;
  vec3 cell = floor(q);
  vec3 f = fract(q) - 0.5 - (fHash3(cell) - 0.5) * 0.5;
  float r = 0.18 + 0.22 * fHash(cell + 5.0);
  float l = length(f) / r;
  return l < 1.0 ? -0.6 * (1.0 - l * l) : 0.25 * exp(-sq((l - 1.0) * 6.0));
}
vec3 itemSkin(vec3 p, float part) {
  vec3 d = normalize(p);
  float maria = smoothstep(0.45, 0.6, fFbm(d * 1.6 + 2.0));
  vec3 c = mix(vec3(0.72), vec3(0.42), maria);
  return c * (0.9 + 0.25 * crater(d)) * (0.92 + 0.1 * fNoise(p * 30.0));
}
vec3 itemInner(vec3 p, float depth, float part) {
  if (depth > 0.62) return vec3(0.55, 0.25, 0.12);
  return mix(vec3(0.6), vec3(0.4), smoothstep(0.05, 0.6, depth)) * (0.9 + 0.15 * fNoise(p * 14.0));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return 0.9; }
#define ITEM_BUMP
float itemBump(vec3 p, float part) { return crater(normalize(p)) * 0.5; }
`,
  },
];
