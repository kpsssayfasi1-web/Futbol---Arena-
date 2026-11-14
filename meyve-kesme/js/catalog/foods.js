// Foods: layered interiors make the most satisfying cross-sections.
const HOLES = [
  [0.35, 0.1, 0.4, 0.15], [-0.4, -0.15, 0.3, 0.12], [0.1, 0.22, -0.45, 0.13], [-0.25, 0.05, -0.2, 0.17],
  [0.55, -0.2, -0.1, 0.1], [-0.6, 0.18, 0.1, 0.11], [0.2, -0.25, 0.1, 0.09], [-0.1, -0.05, 0.62, 0.12],
  [0.65, 0.2, 0.45, 0.08], [-0.55, -0.22, -0.55, 0.1], [0.05, 0.3, 0.15, 0.08], [0.4, 0.05, -0.65, 0.11],
];

export const FOODS = [
  {
    id: 'cake', cat: 'food', tr: 'PASTA', en: 'CAKE', dot: '#f4a6c1', skinT: 0.06,
    sound: { cut: 'soft', hard: 0.1, wet: 0.4 },
    shape: { op: 'union', of: [
      { type: 'cylinder', r: 1.0, h: 0.56, round: 0.06, part: 0 },
      { type: 'sphere', at: [0.05, 0.7, 0.05], r: 0.17, part: 1 },
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ type: 'sphere', at: [Math.cos((i * Math.PI) / 4) * 0.78, 0.6, Math.sin((i * Math.PI) / 4) * 0.78], r: 0.1, part: 2 })),
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  if (part > 1.5) return vec3(0.99, 0.95, 0.96);
  if (part > 0.5) return mix(vec3(0.85, 0.05, 0.1), vec3(0.98, 0.85, 0.3), spots(p, 30.0, 0.12, 0.8));
  return mix(vec3(0.99, 0.78, 0.86), vec3(1.0, 0.9, 0.94), fNoise(p * 6.0));
}
vec3 itemInner(vec3 p, float depth, float part) {
  if (part > 1.5) return vec3(1.0, 0.97, 0.95);
  if (part > 0.5) return mix(vec3(0.95, 0.3, 0.32), vec3(1.0, 0.85, 0.85), 1.0 - smoothstep(0.0, 0.12, length(p - vec3(0.05, 0.7, 0.05))));
  vec3 sponge = mix(vec3(0.99, 0.86, 0.56), vec3(0.96, 0.78, 0.46), fNoise(p * 7.0)) * (0.95 + 0.08 * fNoise(p * 28.0));
  sponge = mix(sponge, vec3(0.84, 0.66, 0.38), crumbPores(p, 10.0) * 0.6);
  vec3 cream = vec3(1.0, 0.97, 0.92);
  vec3 jam = vec3(0.8, 0.08, 0.16);
  float y = p.y + 0.02 * sin(p.x * 6.0 + p.z * 4.0);
  vec3 c = sponge;
  c = mix(c, cream, step(abs(y + 0.18), 0.05));
  c = mix(c, jam * (0.85 + 0.25 * fNoise(p * 18.0)), step(abs(y - 0.12), 0.03 + 0.008 * fNoise(p * 10.0)));
  c = mix(c, cream, step(0.4, y));
  return mix(vec3(0.99, 0.8, 0.88), c, smoothstep(0.06, 0.08, depth));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return part > 0.5 && part < 1.5 ? 0.25 : mix(0.75, 0.45, skin); }
`,
  },
  {
    id: 'donut', cat: 'food', tr: 'DONUT', en: 'DONUT', dot: '#e46b9e', skinT: 0.04,
    sound: { cut: 'soft', hard: 0.1, wet: 0.2 },
    bounds: [[-1.3, -0.5, -1.3], [1.3, 0.5, 1.3]],
    shape: { type: 'torus', R: 0.74, r: 0.38 },
    glsl: /* glsl */ `
float glazeMask(vec3 p) { float a = atan(p.z, p.x); return smoothstep(-0.02, 0.03, p.y + 0.05 * sin(a * 7.0) + 0.03 * sin(a * 13.0)); }
vec3 itemSkin(vec3 p, float part) {
  float g = glazeMask(p);
  vec3 dough = mix(vec3(0.78, 0.48, 0.2), vec3(0.95, 0.75, 0.45), smoothstep(-0.38, -0.2, p.y));
  float id = spotId(p, 18.0);
  vec3 sprinkle = hsv(id, 0.75, 0.98);
  vec3 glaze = mix(vec3(0.96, 0.45, 0.65), sprinkle, spots(p, 18.0, 0.14, 0.45));
  return mix(dough, glaze, g);
}
vec3 itemInner(vec3 p, float depth, float part) {
  vec3 c = mix(vec3(0.99, 0.9, 0.66), vec3(0.95, 0.82, 0.55), fNoise(p * 8.0));
  c = mix(c, vec3(0.84, 0.68, 0.42), crumbPores(p, 9.0) * 0.55);
  return mix(vec3(0.75, 0.45, 0.18), c, smoothstep(0.0, 0.05, depth));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.7, 0.25, skin); }
#define ITEM_SKIN_T
float itemSkinT(float part) { return 0.03; }
`,
  },
  {
    id: 'burger', cat: 'food', tr: 'HAMBURGER', en: 'BURGER', dot: '#b5651d', skinT: 0.03,
    sound: { cut: 'soft', hard: 0.15, wet: 0.5 },
    bounds: [[-1.3, -0.95, -1.3], [1.3, 0.8, 1.3]],
    shape: { op: 'union', of: [
      { type: 'cylinder', at: [0, -0.62, 0], r: 0.96, h: 0.17, round: 0.12, part: 0 },
      { type: 'cylinder', at: [0, -0.33, 0], r: 1.02, h: 0.13, round: 0.08, part: 1 },
      { type: 'box', at: [0, -0.175, 0], size: [0.95, 0.03, 0.95], round: 0.01, rot: [0, 0.6, 0], part: 2 },
      { type: 'cylinder', at: [0, -0.1, 0], r: 0.9, h: 0.05, round: 0.03, part: 3 },
      { type: 'cylinder', at: [0, -0.02, 0], r: 1.05, h: 0.04, round: 0.03, lobes: { n: 14, amp: 0.06 }, part: 4 },
      { op: 'subtract', from: { type: 'ellipsoid', at: [0, 0.03, 0], r: [0.98, 0.62, 0.98], part: 5 }, cut: [{ type: 'box', at: [0, -0.5, 0], size: [2, 0.53, 2] }] },
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  if (part > 4.5) return mix(vec3(0.82, 0.45, 0.13), vec3(0.98, 0.93, 0.75), spots(p, 12.0, 0.13, 0.5) * step(0.12, p.y));
  if (part > 3.5) return mix(vec3(0.3, 0.56, 0.14), vec3(0.58, 0.78, 0.3), fNoise(p * 12.0)) * (0.9 + 0.12 * strands(p.xz, 9.0, 0.12));
  if (part > 2.5) return vec3(0.85, 0.12, 0.08);
  if (part > 1.5) return vec3(1.0, 0.72, 0.12);
  if (part > 0.5) return mix(vec3(0.28, 0.14, 0.07), vec3(0.15, 0.07, 0.03), fFbm(p * 8.0));
  return vec3(0.82, 0.48, 0.16);
}
vec3 itemInner(vec3 p, float depth, float part) {
  if (part > 4.5 || part < 0.5) {
    vec3 bun = mix(vec3(0.99, 0.92, 0.72), vec3(0.95, 0.84, 0.6), fNoise(p * 8.0));
    bun = mix(bun, vec3(0.86, 0.72, 0.46), crumbPores(p, 9.0) * 0.55);
    return mix(vec3(0.8, 0.45, 0.14), bun, smoothstep(0.0, 0.035, depth));
  }
  if (part > 3.5) return vec3(0.64, 0.8, 0.38);
  if (part > 2.5) return mix(vec3(0.9, 0.15, 0.1), vec3(0.98, 0.75, 0.3), spots(p, 14.0, 0.2, 0.5));
  if (part > 1.5) return vec3(1.0, 0.78, 0.2);
  // ground beef: coarse brown grain, pink-grey centre, pale fat flecks, seared edge
  vec3 meat = mix(vec3(0.5, 0.26, 0.15), vec3(0.32, 0.15, 0.08), fFbm(p * 22.0));
  meat = mix(meat, vec3(0.62, 0.36, 0.28), (1.0 - smoothstep(0.0, 0.6, length(p.xz))) * 0.35);
  meat = mix(meat, vec3(0.82, 0.66, 0.5), smoothstep(0.72, 0.8, fNoise(p * 34.0)) * 0.7);
  return mix(vec3(0.2, 0.09, 0.04), meat, smoothstep(0.0, 0.03, depth));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return part > 1.5 && part < 3.5 ? 0.3 : 0.6; }
`,
  },
  {
    id: 'sushi', cat: 'food', tr: 'SUŞİ', en: 'SUSHI', dot: '#2b3a2a', skinT: 0.025,
    sound: { cut: 'soft', hard: 0.1, wet: 0.5 },
    bounds: [[-1.3, -0.9, -0.9], [1.3, 0.9, 0.9]],
    shape: { type: 'cylinder', axis: 'x', r: 0.76, h: 0.95, round: 0.05 },
    glsl: /* glsl */ `
vec3 sushiInside(vec3 p) {
  float q = length(p.yz) / 0.76;
  float a = atan(p.z, p.y);
  if (q > 0.93) return vec3(0.05, 0.09, 0.05);
  if (q > 0.4) {
    float gid;
    float grain = worley(p * vec3(20.0, 20.0, 12.0), gid);
    return mix(vec3(0.9, 0.9, 0.86), vec3(1.0, 1.0, 0.98) * (0.97 + 0.03 * gid), smoothstep(0.05, 0.35, grain));
  }
  if (a > 0.0) return mix(vec3(1.0, 0.45, 0.25), vec3(1.0, 0.8, 0.7), step(0.85, fract(p.y * 18.0 + p.z * 6.0)));
  if (a > -1.6) return vec3(0.55, 0.75, 0.2);
  return vec3(0.75, 0.92, 0.6);
}
vec3 itemSkin(vec3 p, float part) {
  if (abs(p.x) > 0.9) return sushiInside(p);
  return mix(vec3(0.04, 0.08, 0.04), vec3(0.1, 0.15, 0.08), fNoise(p * 18.0));
}
vec3 itemInner(vec3 p, float depth, float part) { return sushiInside(p); }
#define ITEM_ROUGH
float itemRough(float part, float skin) { return 0.55; }
`,
  },
  {
    id: 'cheese', cat: 'food', tr: 'PEYNİR', en: 'CHEESE', dot: '#f2c14e', skinT: 0.03,
    sound: { cut: 'soft', hard: 0.2, wet: 0.2 },
    bounds: [[-1.2, -0.6, -1.2], [1.2, 0.6, 1.2]],
    shape: { op: 'subtract', k: 0.02, from: { type: 'cylinder', r: 1.0, h: 0.45, round: 0.06 }, cut: HOLES.map(([x, y, z, r]) => ({ type: 'sphere', at: [x, y, z], r })) },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  if (sdCyl(p, 1.0, 0.45, 0.06) > -0.02) return mix(vec3(0.95, 0.62, 0.12), vec3(0.85, 0.5, 0.08), fNoise(p * 9.0));
  return vec3(0.96, 0.78, 0.32);
}
vec3 itemInner(vec3 p, float depth, float part) {
  vec3 c = mix(vec3(1.0, 0.86, 0.42), vec3(0.98, 0.8, 0.34), fNoise(p * 12.0));
  c = mix(c, vec3(1.0, 0.93, 0.62), spots(p, 40.0, 0.12, 0.25) * 0.5);
  return mix(vec3(0.95, 0.66, 0.16), c, smoothstep(0.0, 0.04, depth));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.5, 0.35, skin); }
`,
  },
  {
    id: 'egg', cat: 'food', tr: 'YUMURTA', en: 'EGG', dot: '#e9d3b4', skinT: 0.025,
    sound: { cut: 'soft', hard: 0.3, wet: 0.3 },
    bounds: [[-1.3, -0.9, -0.9], [1.3, 0.9, 0.9]],
    shape: { op: 'union', k: 0.45, of: [
      { type: 'ellipsoid', at: [-0.15, 0, 0], r: [0.78, 0.68, 0.68] },
      { type: 'ellipsoid', at: [0.3, 0, 0], r: [0.68, 0.55, 0.55] },
    ] },
    glsl: /* glsl */ `
vec3 itemSkin(vec3 p, float part) {
  vec3 c = mix(vec3(0.9, 0.72, 0.52), vec3(0.82, 0.6, 0.4), fFbm(p * 3.0));
  return mix(c, vec3(0.55, 0.35, 0.2), spots(p, 22.0, 0.12, 0.35) * 0.5);
}
vec3 itemInner(vec3 p, float depth, float part) {
  float yolk = length(p - vec3(-0.08, 0.0, 0.0)) - 0.36;
  if (yolk < 0.0) return mix(vec3(1.0, 0.82, 0.2), vec3(1.0, 0.62, 0.05), smoothstep(-0.36, -0.05, yolk));
  vec3 white = vec3(1.0, 0.99, 0.96);
  return mix(vec3(0.95, 0.93, 0.86), white, smoothstep(0.0, 0.06, depth));
}
#define ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.3, 0.55, skin); }
`,
  },
  {
    id: 'pizza', cat: 'food', tr: 'PİZZA', en: 'PIZZA', dot: '#e0552f', skinT: 0.015,
    sound: { cut: 'crisp', hard: 0.25, wet: 0.2 },
    bounds: [[-1.4, -0.3, -1.4], [1.4, 0.3, 1.4]],
    shape: { op: 'union', k: 0.05, of: [
      { type: 'cylinder', r: 1.1, h: 0.07, round: 0.03, part: 0 },
      { type: 'torus', at: [0, 0.02, 0], R: 1.1, r: 0.13, lobes: { n: 11, amp: 0.02 }, part: 1 },
    ] },
    glsl: /* glsl */ `
float pepMask(vec3 p) {
  vec2 q = p.xz * 2.3;
  vec2 c = floor(q);
  vec3 h = fHash3(vec3(c, 3.0));
  vec2 f = fract(q) - 0.5 - (h.xy - 0.5) * 0.3;
  return (1.0 - smoothstep(0.24, 0.27, length(f))) * step(0.22, h.z) * (1.0 - smoothstep(0.86, 0.9, length(p.xz)));
}
vec3 crustCol(vec3 p) {
  vec3 c = mix(vec3(0.42, 0.17, 0.04), vec3(0.62, 0.32, 0.09), fNoise(p * 7.0));
  return mix(c, vec3(0.16, 0.06, 0.02), spots(p, 13.0, 0.16, 0.3) * 0.7);
}
vec3 itemSkin(vec3 p, float part) {
  if (part > 0.5) return crustCol(p);
  if (p.y < 0.02) return vec3(0.55, 0.3, 0.1) * (0.88 + 0.16 * fNoise(p * 9.0));
  vec3 cheese = mix(vec3(0.68, 0.36, 0.05), vec3(0.55, 0.22, 0.03), fFbm(p * 6.0));
  cheese = mix(cheese, vec3(0.32, 0.11, 0.02), spots(p, 8.0, 0.2, 0.4) * 0.5);
  cheese = mix(cheese, vec3(0.6, 0.06, 0.02), spots(p * vec3(1.0, 0.0, 1.0) + 9.0, 6.0, 0.22, 0.25) * 0.35);
  vec3 c = mix(cheese, vec3(0.38, 0.03, 0.015) * (0.85 + 0.25 * fNoise(p * 22.0)), pepMask(p));
  return mix(c, vec3(0.03, 0.16, 0.02), spots(p * vec3(1.0, 0.0, 1.0) + 4.0, 4.5, 0.18, 0.3) * (1.0 - pepMask(p)));
}
vec3 itemInner(vec3 p, float depth, float part) {
  vec3 bread = mix(vec3(0.96, 0.84, 0.6), vec3(0.9, 0.74, 0.48), fNoise(p * 9.0));
  bread = mix(bread, vec3(0.66, 0.48, 0.26), crumbPores(p, 18.0) * 0.7);
  if (part > 0.5) return mix(crustCol(p), bread, smoothstep(0.0, 0.04, depth));
  if (p.y < 0.0) return bread;
  if (p.y < 0.025) return vec3(0.5, 0.04, 0.015) * (0.9 + 0.15 * fNoise(p * 30.0));
  return pepMask(p) > 0.5 ? vec3(0.38, 0.03, 0.015) : vec3(0.78, 0.48, 0.1);
}
#define ITEM_BUMP
float itemBump(vec3 p, float part) { return part < 0.5 && p.y > 0.02 ? pepMask(p) * 0.012 + fNoise(p * 28.0) * 0.003 : fNoise(p * 18.0) * 0.005; }
#define ITEM_ROUGH
float itemRough(float part, float skin) { return part > 0.5 ? 0.75 : mix(0.65, 0.5, skin); }
`,
  },
  {
    id: 'cookie', cat: 'food', tr: 'KURABİYE', en: 'COOKIE', dot: '#b97a3d', skinT: 0.025,
    sound: { cut: 'crisp', hard: 0.55, wet: 0 },
    bounds: [[-1.25, -0.3, -1.25], [1.25, 0.3, 1.25]],
    shape: { type: 'cylinder', r: 1.05, h: 0.15, round: 0.11, lobes: { n: 9, amp: 0.035 } },
    glsl: /* glsl */ `
float chips(vec3 p) { return spots(p, 4.2, 0.32, 0.55); }
vec3 itemSkin(vec3 p, float part) {
  float rim = smoothstep(0.75, 1.05, length(p.xz));
  vec3 dough = mix(vec3(0.68, 0.38, 0.12), vec3(0.45, 0.2, 0.05), rim * 0.8 + fFbm(p * 5.0) * 0.3);
  dough *= 0.9 + 0.15 * fNoise(p * 24.0);
  return mix(dough, vec3(0.06, 0.02, 0.008), chips(p));
}
vec3 itemInner(vec3 p, float depth, float part) {
  vec3 dough = mix(vec3(0.88, 0.64, 0.3), vec3(0.8, 0.54, 0.22), fNoise(p * 9.0));
  dough = mix(dough, vec3(0.6, 0.38, 0.14), crumbPores(p, 18.0) * 0.6);
  return mix(dough, vec3(0.07, 0.025, 0.01), chips(p));
}
#define ITEM_BUMP
float itemBump(vec3 p, float part) { return fNoise(p * 14.0) * 0.008 + chips(p) * 0.006; }
#define ITEM_ROUGH
float itemRough(float part, float skin) { return 0.72; }
`,
  },
];
