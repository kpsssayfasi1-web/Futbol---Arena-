// GLSL twin of fruits.js: shape (must match the JS formulas exactly), skin and
// flesh colours, and the cut-line pattern drawn on the surface.
export const FRUIT_GLSL = /* glsl */ `
uniform int uFruit;
uniform float uSkinT;
#ifndef FRUIT_PI
#define FRUIT_PI 3.14159265359
#endif

float fHash(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
float fNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = fHash(i);
  float b = fHash(i + vec3(1.0, 0.0, 0.0));
  float c = fHash(i + vec3(0.0, 1.0, 0.0));
  float d = fHash(i + vec3(1.0, 1.0, 0.0));
  float e = fHash(i + vec3(0.0, 0.0, 1.0));
  float g = fHash(i + vec3(1.0, 0.0, 1.0));
  float h = fHash(i + vec3(0.0, 1.0, 1.0));
  float k = fHash(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, g, f.x), mix(h, k, f.x), f.y), f.z);
}
float fFbm(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * fNoise(p);
    p = p * 2.07 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s;
}
float ellRho(vec3 d, vec3 r) {
  vec3 q = d / r;
  return inversesqrt(dot(q, q));
}
float sq(float x) { return x * x; }

float fruitRho(vec3 d) {
  if (uFruit == 0) {
    float phi = acos(clamp(d.y, -1.0, 1.0));
    float th = atan(d.z, d.x);
    float rho = ellRho(d, vec3(1.0, 0.9, 1.0));
    rho *= 1.0 + 0.07 * d.y;
    rho *= 1.0 + 0.022 * cos(5.0 * th) * (1.0 - smoothstep(-0.9, 0.2, d.y));
    rho -= 0.3 * exp(-sq(phi / 0.3));
    rho -= 0.12 * exp(-sq((FRUIT_PI - phi) / 0.24));
    return rho;
  } else if (uFruit == 1) {
    return ellRho(d, vec3(1.24, 0.86, 0.86)) * (1.0 - 0.035 * d.x);
  } else if (uFruit == 2) {
    float phi = acos(clamp(d.y, -1.0, 1.0));
    float rho = ellRho(d, vec3(0.96, 0.9, 0.96));
    rho -= 0.035 * exp(-sq(phi / 0.22));
    rho -= 0.025 * exp(-sq((FRUIT_PI - phi) / 0.2));
    return rho;
  }
  return ellRho(d, vec3(1.18, 0.84, 0.88)) * (1.0 + 0.045 * d.x);
}

// Negative inside, positive outside (radial distance to the surface).
float fruitField(vec3 p) {
  float l = length(p);
  if (l < 1e-5) return -0.5;
  return l - fruitRho(p / l);
}

vec3 fruitNormal(vec3 p) {
  const float e = 0.003;
  return normalize(vec3(
    fruitField(p + vec3(e, 0.0, 0.0)) - fruitField(p - vec3(e, 0.0, 0.0)),
    fruitField(p + vec3(0.0, e, 0.0)) - fruitField(p - vec3(0.0, e, 0.0)),
    fruitField(p + vec3(0.0, 0.0, e)) - fruitField(p - vec3(0.0, 0.0, e))));
}

// ---------- skins ----------
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
  c = mix(c, vec3(0.35, 0.25, 0.12), (1.0 - smoothstep(-0.985, -0.9, d.y)) * 0.6);
  vec3 q = p * 13.0;
  vec3 cell = floor(q);
  vec3 f = fract(q) - 0.5 - (vec3(fHash(cell), fHash(cell + 7.1), fHash(cell + 3.3)) - 0.5) * 0.6;
  float spot = (1.0 - smoothstep(0.05, 0.1, length(f))) * step(0.62, fHash(cell + 1.9));
  return mix(c, vec3(0.97, 0.8, 0.5), spot * 0.3);
}

vec3 melonSkin(vec3 p) {
  float ang = atan(p.z, p.y);
  float wob = fFbm(p * 3.0) * 2.2 + 0.6 * sin(p.x * 4.0);
  float s = sin(ang * 8.0 + wob);
  float stripe = smoothstep(-0.1, 0.45, s + (fFbm(p * 9.0) - 0.5) * 0.8);
  vec3 c = mix(vec3(0.32, 0.52, 0.18), vec3(0.04, 0.17, 0.06), stripe);
  c *= 0.88 + 0.24 * fNoise(p * 12.0);
  float spotMask = (1.0 - smoothstep(-0.82, -0.62, p.y)) * (1.0 - smoothstep(0.0, 0.7, abs(p.x)));
  return mix(c, vec3(0.78, 0.7, 0.33), spotMask * 0.7);
}

vec3 orangeSkin(vec3 p) {
  vec3 c = mix(vec3(0.98, 0.36, 0.02), vec3(0.86, 0.24, 0.01), fFbm(p * 3.0));
  c *= 0.95 + 0.06 * smoothstep(0.3, 0.7, fNoise(p * 22.0));
  return mix(c, vec3(0.45, 0.42, 0.1), smoothstep(0.93, 0.99, normalize(p).y) * 0.6);
}

vec3 kiwiSkin(vec3 p) {
  vec3 c = mix(vec3(0.47, 0.34, 0.19), vec3(0.3, 0.2, 0.11), fFbm(p * 5.0));
  return c * (0.95 + 0.08 * fNoise(p * 26.0));
}

vec3 fruitSkin(vec3 p) {
  if (uFruit == 0) return appleSkin(p);
  if (uFruit == 1) return melonSkin(p);
  if (uFruit == 2) return orangeSkin(p);
  return kiwiSkin(p);
}

// Height used for bump shading of the skin (pores, fuzz).
float fruitBump(vec3 p) {
  if (uFruit == 2) return fNoise(p * 26.0) * 0.12;
  if (uFruit == 3) return fNoise(p * 34.0) * 0.06;
  if (uFruit == 1) return fNoise(p * 12.0) * 0.12;
  return 0.0;
}

// ---------- flesh ----------
vec3 appleFlesh(vec3 p, float depth) {
  vec3 c = vec3(0.93, 0.87, 0.68) * (0.95 + 0.07 * fNoise(p * 34.0));
  c = mix(vec3(0.97, 0.8, 0.52), c, smoothstep(0.0, 0.07, depth));
  float rr = length(p.xz);
  float core = length(vec2(rr / 0.25, (p.y - 0.03) / 0.52));
  c = mix(c * vec3(0.95, 0.96, 0.84), c, smoothstep(0.9, 1.04, core));
  c = mix(c, vec3(0.86, 0.83, 0.6), (1.0 - smoothstep(0.0, 0.035, abs(core - 1.0))) * 0.55);
  float seg = 2.0 * FRUIT_PI / 5.0;
  float ac = floor(atan(p.z, p.x) / seg + 0.5) * seg;
  vec2 rd = vec2(cos(ac), sin(ac));
  vec2 td = vec2(-rd.y, rd.x);
  float lr = dot(p.xz, rd) - 0.13;
  float lt = dot(p.xz, td);
  float ly = p.y - 0.04;
  float carpel = sq(lr / 0.075) + sq(lt / 0.05) + sq(ly / 0.15);
  c = mix(c, vec3(0.9, 0.9, 0.74), (1.0 - smoothstep(0.8, 1.0, carpel)) * 0.7);
  float seed = sq(lr / 0.045) + sq(lt / 0.028) + sq(ly / 0.085);
  vec3 seedC = mix(vec3(0.36, 0.17, 0.06), vec3(0.18, 0.08, 0.03), clamp(seed, 0.0, 1.0));
  return mix(c, seedC, 1.0 - smoothstep(0.9, 1.0, seed));
}

vec3 melonFlesh(vec3 p, float depth) {
  vec3 rind = mix(vec3(0.12, 0.33, 0.1), vec3(0.72, 0.84, 0.52), smoothstep(0.02, 0.06, depth));
  vec3 white = mix(vec3(0.72, 0.84, 0.52), vec3(0.96, 0.95, 0.8), smoothstep(0.07, 0.11, depth));
  vec3 red = vec3(0.92, 0.16, 0.2) * (0.9 + 0.15 * fNoise(p * 18.0));
  vec3 flesh = mix(vec3(0.99, 0.62, 0.56), red, smoothstep(0.12, 0.22, depth));
  flesh = mix(flesh, vec3(1.0, 0.5, 0.52), smoothstep(0.75, 0.95, fNoise(p * 60.0)) * 0.35);
  vec3 c = mix(rind, white, smoothstep(0.06, 0.08, depth));
  c = mix(c, flesh, smoothstep(0.105, 0.13, depth));
  vec3 q = p / vec3(1.24, 0.86, 0.86);
  vec3 cell = floor(q * 7.0);
  vec3 cc = (cell + 0.5 + (vec3(fHash(cell + 0.3), fHash(cell + 5.7), fHash(cell + 9.1)) - 0.5) * 0.4) / 7.0;
  float L = length(cc);
  if (abs(L - 0.6) < 0.12 && fHash(cell + 2.2) > 0.35) {
    vec3 rdir = cc / max(L, 1e-4);
    vec3 v = q - cc;
    float along = dot(v, rdir);
    float perp = length(v - along * rdir);
    float e = sq(along / 0.034) + sq(perp / 0.02);
    c = mix(c, vec3(0.05, 0.03, 0.02), 1.0 - smoothstep(0.85, 1.0, e));
  }
  return c;
}

vec3 orangeFlesh(vec3 p, float depth) {
  vec3 peel = vec3(0.98, 0.38, 0.03);
  vec3 pith = vec3(0.99, 0.92, 0.76);
  float rr = length(p.xz);
  float a = atan(p.z, p.x);
  float nseg = 11.0;
  float f = fract(a / (2.0 * FRUIT_PI) * nseg + 0.13 * sin(p.y * 3.0));
  float arc = min(f, 1.0 - f) * (2.0 * FRUIT_PI / nseg) * rr;
  float memb = 1.0 - smoothstep(0.004, 0.012, arc);
  float ves = fNoise(vec3(rr * 30.0, a * 8.0, p.y * 6.0));
  vec3 flesh = mix(vec3(1.0, 0.5, 0.06), vec3(0.94, 0.33, 0.02), ves);
  vec3 c = mix(peel, pith, smoothstep(0.022, 0.032, depth));
  float inFlesh = smoothstep(0.075, 0.09, depth);
  c = mix(c, flesh, inFlesh);
  c = mix(c, pith, memb * inFlesh);
  return mix(c, pith, 1.0 - smoothstep(0.05, 0.09, rr));
}

vec3 kiwiFlesh(vec3 p, float depth) {
  float prof = sqrt(max(0.0, 1.0 - sq(p.x / 1.2)));
  float q = length(p.yz) / max(0.05, 0.86 * prof);
  float a = atan(p.z, p.y);
  vec3 green = vec3(0.42, 0.73, 0.1);
  vec3 lightg = vec3(0.65, 0.86, 0.3);
  float streak = fNoise(vec3(a * 9.0, q * 3.0, p.x * 2.0));
  vec3 flesh = mix(green, lightg, clamp(smoothstep(0.55, 0.9, streak) * (1.0 - q) * 1.3, 0.0, 1.0));
  flesh = mix(flesh, green * 0.8, smoothstep(0.7, 1.0, q));
  float coreR = 0.2;
  vec3 c = mix(vec3(0.95, 0.92, 0.72), flesh, smoothstep(coreR - 0.02, coreR + 0.03, q));
  c = mix(c, vec3(1.0, 0.98, 0.85), (1.0 - smoothstep(0.0, coreR, q)) * smoothstep(0.6, 0.9, fNoise(vec3(a * 14.0, q * 4.0, p.x))) * 0.5);
  float nA = 46.0;
  float ua = a / (2.0 * FRUIT_PI) * nA;
  float h = fHash(vec3(floor(ua), floor(p.x * 14.0), 1.0));
  float dq = (q - (0.29 + (h - 0.5) * 0.08)) / 0.05;
  float da = (fract(ua) - 0.5) / 0.28;
  c = mix(c, vec3(0.06, 0.04, 0.02), (1.0 - smoothstep(0.7, 1.0, dq * dq + da * da)) * step(0.25, h));
  c = mix(c, lightg, (1.0 - smoothstep(0.0, 0.1, abs(q - 0.29))) * 0.25);
  return mix(vec3(0.5, 0.55, 0.15), c, smoothstep(0.0, 0.03, depth));
}

vec3 fruitFlesh(vec3 p, float depth) {
  if (uFruit == 0) return appleFlesh(p, depth);
  if (uFruit == 1) return melonFlesh(p, depth);
  if (uFruit == 2) return orangeFlesh(p, depth);
  return kiwiFlesh(p, depth);
}

vec3 fruitInterior(vec3 p) {
  float depth = -fruitField(p);
  if (depth < uSkinT * 0.6) return fruitSkin(p);
  return mix(fruitSkin(p), fruitFlesh(p, depth), smoothstep(uSkinT * 0.6, uSkinT, depth));
}

// ---------- cut lines ----------
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
  bool isDone = axis == 0 ? (j < done) : (j >= n - done);
  if (!isDone && uActive.w > 0.5 && int(uActive.x) == axis && abs(uActive.y - j) < 0.5) {
    isDone = axis == 1 ? (p.x > uActive.z) : (p.y > uActive.z);
  }
  if (!isDone) return 0.0;
  float dist = abs(u - k) * stepW;
  float w = max(0.0045, pix * 0.9);
  float line = 1.0 - smoothstep(w * 0.45, w, dist);
  float density = smoothstep(2.5, 7.0, stepW / max(pix, 1e-6));
  return mix(clamp(1.2 * max(0.0045, pix * 0.9) / stepW, 0.0, 0.45), line, density);
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
