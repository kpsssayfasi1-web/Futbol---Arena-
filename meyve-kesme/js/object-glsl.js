// Shader source for one catalog item: shared helpers, the item's shape
// (compiled from its description), its colour functions and the cut-line pattern.
import { compileGlsl, SDF_GLSL_LIB } from './sdf.js';

export const HELPERS_GLSL = /* glsl */ `
#ifndef OBJ_PI
#define OBJ_PI 3.14159265359
#endif
float fHash(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 fHash3(vec3 p) { return vec3(fHash(p), fHash(p + 17.3), fHash(p + 41.7)); }
float fNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = fHash(i), b = fHash(i + vec3(1, 0, 0)), c = fHash(i + vec3(0, 1, 0)), d = fHash(i + vec3(1, 1, 0));
  float e = fHash(i + vec3(0, 0, 1)), g = fHash(i + vec3(1, 0, 1)), h = fHash(i + vec3(0, 1, 1)), k = fHash(i + vec3(1, 1, 1));
  return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, g, f.x), mix(h, k, f.x), f.y), f.z);
}
float fFbm(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * fNoise(p); p = p * 2.07 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
  return s;
}
float sq(float x) { return x * x; }
// Round spots on a jittered 3D lattice: returns 1 inside a spot.
float spots(vec3 p, float scale, float radius, float density) {
  vec3 q = p * scale;
  vec3 cell = floor(q);
  vec3 f = fract(q) - 0.5 - (fHash3(cell) - 0.5) * 0.6;
  return (1.0 - smoothstep(radius * 0.7, radius, length(f))) * step(1.0 - density, fHash(cell + 3.7));
}
// Same lattice, returns a random value per spot (for colourful sprinkles).
float spotId(vec3 p, float scale) { return fHash(floor(p * scale) + 11.1); }
vec3 leafGreen(vec3 p) { return mix(vec3(0.16, 0.42, 0.07), vec3(0.32, 0.62, 0.14), fNoise(p * 14.0)); }
// Cheap 2x2x2 Worley pattern: returns the distance-to-wall measure (1 inside a
// cell, 0 on its wall) and a random id per cell.
float worley(vec3 q, out float id) {
  vec3 i = floor(q - 0.5);
  float d1 = 9.0, d2 = 9.0;
  id = 0.0;
  for (int z = 0; z < 2; z++) for (int y = 0; y < 2; y++) for (int x = 0; x < 2; x++) {
    vec3 c = i + vec3(float(x), float(y), float(z));
    vec3 f = c + 0.15 + 0.7 * fHash3(c) - q;
    float d = dot(f, f);
    if (d < d1) { d2 = d1; d1 = d; id = fHash(c + 5.1); } else if (d < d2) d2 = d;
  }
  return smoothstep(0.0, 0.22, sqrt(d2) - sqrt(d1));
}
float fleshCells(vec3 q) { float id; return worley(q, id); }
// Baked crumb (sponge, bread, dough): irregular air pockets of two sizes. 1 in a pore.
float crumbPores(vec3 p, float s) {
  float big = smoothstep(0.66, 0.74, fNoise(p * s) * 0.65 + fNoise(p * s * 2.3) * 0.35);
  float small = smoothstep(0.7, 0.78, fNoise(p * s * 3.1 + 7.0));
  return max(big, small * 0.8);
}
// Fine strands running along one direction (vascular bundles, fibres): 1 on a strand.
float strands(vec2 cross, float density, float width) {
  vec2 g = cross * density;
  vec2 f = fract(g) - 0.5 - (vec2(fHash(vec3(floor(g), 1.0)), fHash(vec3(floor(g), 2.0))) - 0.5) * 0.6;
  return 1.0 - smoothstep(width * 0.5, width, length(f));
}
// Citrus flesh: radially elongated juice vesicles inside segments. rr = distance
// from the axis, a = angle around it, y = position along it, seg = segment count.
// Returns the flesh colour between a deep and a light tone, with white membranes.
vec3 citrusFlesh(float rr, float a, float y, float seg, vec3 deep, vec3 light, vec3 pith) {
  float id;
  float cell = worley(vec3(rr * 14.0, a * max(rr, 0.08) * 38.0, y * 38.0), id);
  vec3 c = mix(deep, light, 0.25 + 0.5 * id);
  c = mix(c * 0.86, c * 1.06, cell);
  float f = fract(a / (2.0 * OBJ_PI) * seg + 0.08 * sin(y * 3.0));
  float memb = 1.0 - smoothstep(0.004, 0.011, min(f, 1.0 - f) * (2.0 * OBJ_PI / seg) * rr);
  return mix(c, pith, memb * 0.9);
}
vec3 hsv(float h, float s, float v) { vec3 k = clamp(abs(mod(h * 6.0 + vec3(0, 4, 2), 6.0) - 3.0) - 1.0, 0.0, 1.0); return v * mix(vec3(1.0), k, s); }
// Catalog colours are written as display (sRGB-like) values, but lighting works
// in linear light: without this step every colour renders washed out and pale.
// Part gamma decode, part saturation boost, so pastels stay pastel.
#ifndef VIVID_GAMMA
#define VIVID_GAMMA 1.6
#endif
#ifndef VIVID_SAT
#define VIVID_SAT 1.1
#endif
vec3 vivid(vec3 c) {
  c = pow(max(c, vec3(0.0)), vec3(VIVID_GAMMA));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return max(mix(vec3(l), c, VIVID_SAT), vec3(0.0));
}
`;

// Item GLSL defines itemSkin / itemInner; they are renamed while it compiles
// and wrapped so every item gets the same colour treatment.
const VIVID_BEGIN = '#define itemSkin itemSkinSrc\n#define itemInner itemInnerSrc';
const VIVID_END = /* glsl */ `
#undef itemSkin
#undef itemInner
vec3 itemSkin(vec3 p, float part) { return vivid(itemSkinSrc(p, part)); }
vec3 itemInner(vec3 p, float depth, float part) { return vivid(itemInnerSrc(p, depth, part)); }
`;

const DEFAULTS_GLSL = /* glsl */ `
#ifndef ITEM_ROUGH
float itemRough(float part, float skin) { return mix(0.5, 0.4, skin); }
#endif
#ifndef ITEM_METAL
float itemMetal(float part) { return 0.0; }
#endif
#ifndef ITEM_EMISSIVE
vec3 itemEmissive(vec3 p, float depth, float part) { return vec3(0.0); }
#endif
#ifndef ITEM_BUMP
float itemBump(vec3 p, float part) { return 0.0; }
#endif
#ifndef ITEM_SKIN_T
float itemSkinT(float part) { return ITEM_SKIN_DEFAULT; }
#endif
`;

const OBJECT_GLSL = /* glsl */ `
// ---- cut flesh: cell texture, juice gloss, light scattering (see lookOf) ----
// Shades a cut face (skin < 0.5) with its cells; h is the cell relief for the
// bump, faded out where cells get smaller than a few pixels (no shimmer).
vec3 fleshShade(vec3 col, vec3 p, float skin, out float h) {
  h = 0.0;
  if (LOOK_CELL <= 0.0 || skin > 0.5) return col;
  float px = max(max(fwidth(p.x), fwidth(p.y)), fwidth(p.z)) * LOOK_CELL;
  float vis = 1.0 - smoothstep(0.12, 0.4, px);
  if (vis <= 0.0) return col;
  float c = fleshCells(p * LOOK_CELL);
  h = c * vis;
  float k = LOOK_CELL_DEPTH * vis;
  return col * (1.0 - 0.32 * k * (1.0 - c)) * (1.0 + 0.05 * k * c);
}
float fleshRough(float r, float skin) { return mix(r, 0.14, LOOK_JUICE * (1.0 - skin)); }
vec3 fleshGlow(vec3 col, float skin) { return col * LOOK_SSS * 0.12 * (1.0 - 0.6 * skin); }
float fleshBumpScale() { return LOOK_CELL > 0.0 ? 0.12 * LOOK_CELL_DEPTH / LOOK_CELL : 0.0; }

float objField(vec3 p) { float part; return objMap(p, part); }
vec3 objNormal(vec3 p) {
  const float e = 0.002;
  return normalize(vec3(
    objField(p + vec3(e, 0, 0)) - objField(p - vec3(e, 0, 0)),
    objField(p + vec3(0, e, 0)) - objField(p - vec3(0, e, 0)),
    objField(p + vec3(0, 0, e)) - objField(p - vec3(0, 0, e))));
}
// Colour anywhere in or on the object; skin = 1 within the skin layer.
vec3 objColor(vec3 p, out float part, out float skin, out float depth) {
  depth = -objMap(p, part);
  float st = itemSkinT(part);
  skin = 1.0 - smoothstep(st * 0.6, st, depth);
  if (skin > 0.999) return itemSkin(p, part);
  vec3 inner = itemInner(p, max(depth, 0.0), part);
  if (skin < 0.001) return inner;
  return mix(inner, itemSkin(p, part), skin);
}

uniform vec3 uBMin;
uniform vec3 uBMax;
uniform vec3 uCutN;
uniform vec3 uCutDone;
uniform vec4 uActive; // axis, plane index (from min), edge coordinate, 1 when valid

float axisLines(float coord, int axis, float pix, vec3 p) {
  float n = uCutN[axis];
  if (n < 0.5) return 0.0;
  float lo = uBMin[axis];
  float stepW = (uBMax[axis] - lo) / (n + 1.0);
  float u = (coord - lo) / stepW;
  float k = floor(u + 0.5);
  if (k < 1.0 || k > n) return 0.0;
  float j = k - 1.0;
  float done = uCutDone[axis];
  bool isDone = j >= n - done; // planes are cut from the max side
  if (!isDone && uActive.w > 0.5 && int(uActive.x) == axis && abs(uActive.y - j) < 0.5) {
    isDone = axis == 1 ? (p.x > uActive.z) : (p.y > uActive.z);
  }
  if (!isDone) return 0.0;
  // Anti-aliased line about 1.5 px wide. When lines get closer than ~30 px
  // they fade out: dense stripes would only alias into moire.
  float spacing = stepW / max(pix, 1e-6);
  float vis = smoothstep(12.0, 34.0, spacing);
  if (vis <= 0.0) return 0.0;
  float dist = abs(u - k) * stepW;
  float w = max(0.003, pix * 1.5);
  return vis * (1.0 - smoothstep(0.0, w, dist));
}
float cutLines(vec3 p, bool withZ) {
  vec3 pix = fwidth(p);
  float l = max(axisLines(p.x, 0, pix.x, p), axisLines(p.y, 1, pix.y, p));
  if (withZ) l = max(l, axisLines(p.z, 2, pix.z, p));
  return l;
}
vec3 bumpNormal(vec3 surfPos, vec3 surfNorm, float h, float scale) {
  vec3 sx = dFdx(surfPos);
  vec3 sy = dFdy(surfPos);
  vec3 r1 = cross(sy, surfNorm);
  vec3 r2 = cross(surfNorm, sx);
  float det = dot(sx, r1);
  vec2 dh = vec2(dFdx(h), dFdy(h)) * scale;
  vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
  return normalize(abs(det) * surfNorm - grad);
}
`;

const cache = new Map();

// Surface character of an item's cut faces. Organic items get juicy, slightly
// translucent flesh with a visible cell structure; foods a porous crumb;
// hard objects none of it. An item can override any field with `look`.
export function lookOf(item) {
  const wet = item.sound?.wet ?? 0;
  const organic = item.cat === 'fruit' || item.cat === 'veg';
  const food = item.cat === 'food';
  const base = {
    juice: organic ? 0.3 + 0.7 * wet : food ? 0.4 * wet : 0,
    sss: organic ? 0.7 : food ? 0.3 : 0,
    cell: organic ? 55 : 0,
    cellDepth: organic ? 0.45 : 0,
    sheen: 0,
    sheenColor: '#ffffff',
  };
  return { ...base, ...(item.look || {}) };
}

const f = (v) => Number(v).toFixed(4);

export function itemGlsl(item) {
  if (cache.has(item.id)) return cache.get(item.id);
  const skinT = (item.skinT ?? 0.03).toFixed(4);
  const look = lookOf(item);
  const src = [
    `#define ITEM_SKIN_DEFAULT ${skinT}`,
    `#define LOOK_JUICE ${f(look.juice)}`,
    `#define LOOK_SSS ${f(look.sss)}`,
    `#define LOOK_CELL ${f(look.cell)}`,
    `#define LOOK_CELL_DEPTH ${f(look.cellDepth)}`,
    HELPERS_GLSL,
    SDF_GLSL_LIB,
    compileGlsl(item.shape, 'objMap'),
    VIVID_BEGIN,
    item.glsl,
    VIVID_END,
    DEFAULTS_GLSL,
    OBJECT_GLSL,
  ].join('\n');
  cache.set(item.id, src);
  return src;
}
