// GPU-animated cubes: every cube's flight from the object to the pile is
// computed in the vertex shader from uTime. Three drawing modes:
//  - boolean (few big pieces): ray marched against the shape, real curved skin
//  - detailed (medium): colour evaluated per pixel at the cube's original spot
//  - baked (huge counts): colour computed once per cube into a texture
import * as THREE from 'three';
import { itemGlsl } from './object-glsl.js';
import { patchMaterial } from './shader-patch.js';
import { GRAVITY } from './cubes-data.js';

export const DETAILED_LIMIT = 30000;
const BAKE_W = 1024;

const POSE_GLSL = /* glsl */ `
attribute vec3 aHome;
attribute vec3 aSize;
attribute vec3 aRest;
attribute vec4 aMotion;
attribute vec3 aRot;
uniform float uTime;
uniform float uOutro;
uniform float uGravity;
mat3 cubeRotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 cubeRotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
void cubePose(out vec3 center, out mat3 R, out float scale) {
  float tau = uTime - aMotion.x;
  float T = aMotion.y;
  float s = clamp(tau / T, 0.0, 1.0);
  float tt = clamp(tau, 0.0, T);
  center.xz = mix(aHome.xz, aRest.xz, s);
  center.y = aHome.y + aMotion.z * tt - 0.5 * uGravity * tt * tt;
  if (tau >= T) {
    float b = tau - T;
    center.y = aRest.y + 0.18 * aSize.y * abs(sin(b * 17.0)) * exp(-b * 13.0) * step(b, 0.45);
  }
  float rs = s * 0.75 + smoothstep(0.0, 1.0, s) * 0.25;
  R = cubeRotY(aRot.x * rs) * cubeRotX(aRot.y * rs);
  float o = clamp((uOutro - aMotion.w * 0.25) / 0.2, 0.0, 1.0);
  scale = (tau < 0.0 ? 0.0 : 1.0) * (1.0 - o);
}
`;

const SHARED_VARYINGS = /* glsl */ `
varying vec3 vHome;
varying vec3 vLocal;
#ifdef CUBE_BAKED
flat varying vec4 vBake;
flat varying vec3 vBakeEmit;
#endif
#ifdef CUBE_BOOLEAN
flat varying vec3 vCamHome;
flat varying vec3 vBoxMin;
flat varying vec3 vBoxMax;
flat varying vec3 vC;
flat varying float vScale;
flat varying vec3 vR0;
flat varying vec3 vR1;
flat varying vec3 vR2;
flat varying vec3 vHomeC;
#endif
`;

const VERTEX_PARS = `${POSE_GLSL}\nuniform vec3 uGroupOffset;\nuniform sampler2D uBake;\nuniform float uBakeRows;\n${SHARED_VARYINGS}`;

const BEGIN_VERTEX = /* glsl */ `
vec3 cLp = position * aSize;
vec3 transformed = cCenter + cR * (cLp * cScale);
vHome = aHome + cLp;
vLocal = position;
#ifdef CUBE_BAKED
ivec2 bt = ivec2(gl_InstanceID % ${BAKE_W}, gl_InstanceID / ${BAKE_W});
vBake = texelFetch(uBake, bt, 0);
vBakeEmit = texelFetch(uBake, bt + ivec2(0, int(uBakeRows)), 0).rgb;
#endif
#ifdef CUBE_BOOLEAN
vCamHome = aHome + transpose(cR) * ((cameraPosition - uGroupOffset) - cCenter) / max(cScale, 1e-4);
vBoxMin = aHome - aSize * 0.5;
vBoxMax = aHome + aSize * 0.5;
vC = cCenter;
vScale = cScale;
vR0 = cR[0];
vR1 = cR[1];
vR2 = cR[2];
vHomeC = aHome;
#endif
`;

const COLOR_FRAGMENT = /* glsl */ `
#include <color_fragment>
vec3 cCol;
float cPart = 0.0, cSkin = 0.0, cDepth = 0.0;
bool cSkinHit = false;
vec3 cSkinN = vec3(0.0, 1.0, 0.0);
vec3 cEmit = vec3(0.0);
#if defined(CUBE_BAKED)
  float code = floor(vBake.a * 255.0 + 0.5);
  cPart = mod(code, 16.0);
  cSkin = step(16.0, code);
  cCol = vBake.rgb;
  cEmit = vBakeEmit;
#elif defined(CUBE_BOOLEAN)
  gl_FragDepth = gl_FragCoord.z;
  vec3 ro = vHome;
  vec3 rd = normalize(vHome - vCamHome);
  if (objField(ro) <= 0.0) {
    cCol = objColor(ro, cPart, cSkin, cDepth);
  } else {
    vec3 inv = 1.0 / (rd + vec3(1e-6));
    vec3 tF = max((vBoxMin - ro) * inv, (vBoxMax - ro) * inv);
    float tExit = min(tF.x, min(tF.y, tF.z));
    float t = 0.0;
    bool hit = false;
    for (int i = 0; i < 48; i++) {
      float f = objField(ro + rd * t);
      if (f < 0.0006) { hit = true; break; }
      t += max(f * 0.8, 0.0015);
      if (t > tExit) break;
    }
    if (!hit) discard;
    vec3 hp = ro + rd * t;
    mat3 cRm = mat3(vR0, vR1, vR2);
    objMap(hp, cPart);
    cCol = itemSkin(hp, cPart);
    cSkin = 1.0;
    cSkinHit = true;
    cSkinN = cRm * objNormal(hp);
    vec4 hc = uProj * viewMatrix * vec4(uGroupOffset + vC + cRm * ((hp - vHomeC) * vScale), 1.0);
    gl_FragDepth = clamp(0.5 * hc.z / hc.w + 0.5, 0.0, 1.0);
  }
#else
  cCol = objColor(vHome, cPart, cSkin, cDepth);
#endif
#if !defined(CUBE_BAKED)
  cEmit = itemEmissive(vHome, max(cDepth, 0.0), cPart);
#endif
vec3 cE = abs(vLocal) * 2.0;
float cM1 = max(cE.x, max(cE.y, cE.z));
float cM3 = min(cE.x, min(cE.y, cE.z));
float cM2 = cE.x + cE.y + cE.z - cM1 - cM3;
float cW = min(0.5, fwidth(cM2) * 1.5 + 0.05);
if (!cSkinHit) cCol *= 1.0 - 0.26 * smoothstep(1.0 - cW, 1.0, cM2);
diffuseColor.rgb = cCol;
`;

function modeDefines(mode) {
  if (mode === 'boolean') return { CUBE_BOOLEAN: '' };
  if (mode === 'baked') return { CUBE_BAKED: '' };
  return {};
}

function cubeMaterial(item, uniforms, mode) {
  return patchMaterial(new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0, envMapIntensity: item.envBoost ?? 1 }), {
    key: `cubes-${mode}-${item.id}`,
    uniforms,
    defines: modeDefines(mode),
    vertexPars: VERTEX_PARS,
    fragmentPars: `${itemGlsl(item)}\nuniform vec3 uGroupOffset;\nuniform mat4 uProj;\n${SHARED_VARYINGS}`,
    vertex: {
      beginnormal_vertex: 'vec3 cCenter; mat3 cR; float cScale;\ncubePose(cCenter, cR, cScale);\nvec3 objectNormal = cR * normal;',
      begin_vertex: BEGIN_VERTEX,
    },
    fragment: {
      color_fragment: COLOR_FRAGMENT,
      roughnessmap_fragment: '$ORIGINAL\nroughnessFactor = itemRough(cPart, cSkin);',
      metalnessmap_fragment: '$ORIGINAL\nmetalnessFactor = itemMetal(cPart);',
      normal_fragment_begin: '$ORIGINAL\nif (cSkinHit) normal = normalize((viewMatrix * vec4(cSkinN, 0.0)).xyz);',
      emissivemap_fragment: '$ORIGINAL\ntotalEmissiveRadiance += cEmit;',
    },
  });
}

function depthMaterial(uniforms) {
  return patchMaterial(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), {
    key: 'cubes-depth',
    uniforms,
    vertexPars: POSE_GLSL,
    vertex: {
      begin_vertex: 'vec3 cCenter; mat3 cR; float cScale;\ncubePose(cCenter, cR, cScale);\nvec3 transformed = cCenter + cR * (position * aSize * cScale);',
    },
  });
}

export function pileMode(data) {
  if (data.coarse) return 'boolean';
  return data.count <= DETAILED_LIMIT ? 'detailed' : 'baked';
}

// Bake each cube's colour (row block 1) and glow (row block 2) into a texture.
function bakeColors(renderer, item, data) {
  const rows = Math.ceil(data.count / BAKE_W);
  const pos = new Float32Array(BAKE_W * rows * 4);
  for (let i = 0; i < data.count; i++) pos.set([data.home[i * 3], data.home[i * 3 + 1], data.home[i * 3 + 2], 1], i * 4);
  const posTex = new THREE.DataTexture(pos, BAKE_W, rows, THREE.RGBAFormat, THREE.FloatType);
  posTex.needsUpdate = true;
  const target = new THREE.WebGLRenderTarget(BAKE_W, rows * 2, { depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const mat = new THREE.ShaderMaterial({
    uniforms: { uPos: { value: posTex }, uRows: { value: rows } },
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `${itemGlsl(item)}
      uniform sampler2D uPos;
      uniform float uRows;
      void main() {
        ivec2 px = ivec2(gl_FragCoord.xy);
        bool glow = float(px.y) >= uRows;
        vec3 p = texelFetch(uPos, ivec2(px.x, glow ? px.y - int(uRows) : px.y), 0).xyz;
        float part, skin, depth;
        vec3 c = objColor(p, part, skin, depth);
        if (glow) gl_FragColor = vec4(itemEmissive(p, max(depth, 0.0), part), 1.0);
        else gl_FragColor = vec4(c, (part + 16.0 * step(0.5, skin)) / 255.0);
      }`,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  const scene = new THREE.Scene();
  scene.add(quad);
  const prev = renderer.getRenderTarget();
  const prevAuto = renderer.autoClear;
  renderer.setRenderTarget(target);
  renderer.render(scene, new THREE.Camera());
  renderer.setRenderTarget(prev);
  renderer.autoClear = prevAuto;
  posTex.dispose();
  mat.dispose();
  quad.geometry.dispose();
  return { target, rows };
}

const BOX = new THREE.BoxGeometry(1, 1, 1);

// One round's cubes; owns its materials so its uniforms are uploaded correctly.
export class CubePile {
  constructor(data, item, round, shared, renderer) {
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = BOX.index;
    for (const name of ['position', 'normal', 'uv']) geo.setAttribute(name, BOX.attributes[name]);
    geo.setAttribute('aHome', new THREE.InstancedBufferAttribute(data.home, 3));
    geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(data.size, 3));
    geo.setAttribute('aRest', new THREE.InstancedBufferAttribute(data.rest, 3));
    geo.setAttribute('aMotion', new THREE.InstancedBufferAttribute(data.motion, 4));
    geo.setAttribute('aRot', new THREE.InstancedBufferAttribute(data.rot, 3));
    geo.instanceCount = data.count;
    this.data = data;
    this.mode = pileMode(data);
    this.geometry = geo;
    this.bake = this.mode === 'baked' ? bakeColors(renderer, item, data) : null;
    this.uniforms = {
      uTime: { value: -1e3 },
      uOutro: { value: 0 },
      uGravity: { value: GRAVITY },
      uGroupOffset: { value: new THREE.Vector3(0, -round.boardY, 0) },
      uProj: shared.uProj,
      uBake: { value: this.bake ? this.bake.target.texture : null },
      uBakeRows: { value: this.bake ? this.bake.rows : 0 },
    };
    this.material = cubeMaterial(item, this.uniforms, this.mode);
    this.depthMaterial = depthMaterial(this.uniforms);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.customDepthMaterial = this.depthMaterial;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.position.y = -round.boardY;
    this.warm = 2; // draw invisibly for a couple of frames so buffers upload early
  }

  set(time, outro) {
    this.uniforms.uTime.value = time;
    this.uniforms.uOutro.value = outro;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.depthMaterial.dispose();
    this.bake?.target.dispose();
  }
}

export function cubeMaterialsFor(item, mode) {
  const dummy = { uTime: { value: 0 }, uOutro: { value: 0 }, uGravity: { value: GRAVITY }, uGroupOffset: { value: new THREE.Vector3() }, uProj: { value: new THREE.Matrix4() }, uBake: { value: null }, uBakeRows: { value: 0 } };
  return cubeMaterial(item, dummy, mode);
}
