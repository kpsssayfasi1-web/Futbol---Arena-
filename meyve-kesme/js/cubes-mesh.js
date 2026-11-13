// GPU-animated cubes: every cube's flight from the fruit to the pile is computed
// in the vertex shader from uTime, so hundreds of thousands cost no CPU time.
// Big cubes (few cuts) are ray marched against the fruit shape so each piece
// shows the real curved skin, like a boolean cut.
import * as THREE from 'three';
import { FRUIT_GLSL } from './fruit-glsl.js';
import { patchMaterial } from './shader-patch.js';
import { GRAVITY } from './cubes-data.js';

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

const VERTEX_PARS = /* glsl */ `
${POSE_GLSL}
uniform vec3 uGroupOffset;
varying vec3 vHome;
varying vec3 vLocal;
flat varying float vMat;
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

const FRAGMENT_PARS = /* glsl */ `
${FRUIT_GLSL}
uniform vec3 uGroupOffset;
uniform mat4 uProj;
uniform vec3 uLeafColor;
uniform vec3 uStemColor;
uniform float uSkinRough;
varying vec3 vHome;
varying vec3 vLocal;
flat varying float vMat;
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

const BEGIN_VERTEX = /* glsl */ `
vec3 cLp = position * aSize;
vec3 transformed = cCenter + cR * (cLp * cScale);
vHome = aHome + cLp;
vLocal = position;
vMat = aRot.z;
#ifdef CUBE_BOOLEAN
vec3 cCamObj = cameraPosition - uGroupOffset;
vCamHome = aHome + transpose(cR) * (cCamObj - cCenter) / max(cScale, 1e-4);
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
bool cSkinHit = false;
vec3 cSkinN = vec3(0.0, 1.0, 0.0);
#ifdef CUBE_BOOLEAN
gl_FragDepth = gl_FragCoord.z;
#endif
if (vMat > 1.5) {
  cCol = uStemColor * (0.85 + 0.3 * fNoise(vHome * 40.0));
} else if (vMat > 0.5) {
  cCol = mix(uLeafColor, uLeafColor * 1.35, fNoise(vHome * 30.0));
} else {
#ifdef CUBE_BOOLEAN
  vec3 ro = vHome;
  vec3 rd = normalize(vHome - vCamHome);
  if (fruitField(ro) <= 0.0) {
    cCol = fruitInterior(ro);
  } else {
    vec3 inv = 1.0 / (rd + vec3(1e-6));
    vec3 tA = (vBoxMin - ro) * inv;
    vec3 tB = (vBoxMax - ro) * inv;
    vec3 tF = max(tA, tB);
    float tExit = min(tF.x, min(tF.y, tF.z));
    float t = 0.0;
    bool hit = false;
    for (int i = 0; i < 48; i++) {
      float f = fruitField(ro + rd * t);
      if (f < 0.0006) { hit = true; break; }
      t += max(f * 0.7, 0.0015);
      if (t > tExit) break;
    }
    if (!hit) discard;
    vec3 hp = ro + rd * t;
    mat3 cRm = mat3(vR0, vR1, vR2);
    cCol = fruitSkin(hp);
    cSkinHit = true;
    cSkinN = cRm * fruitNormal(hp);
    vec3 hitWorld = uGroupOffset + vC + cRm * ((hp - vHomeC) * vScale);
    vec4 hc = uProj * viewMatrix * vec4(hitWorld, 1.0);
    gl_FragDepth = clamp(0.5 * hc.z / hc.w + 0.5, 0.0, 1.0);
  }
#else
  cCol = fruitInterior(vHome);
#endif
}
vec3 cE = abs(vLocal) * 2.0;
float cM1 = max(cE.x, max(cE.y, cE.z));
float cM3 = min(cE.x, min(cE.y, cE.z));
float cM2 = cE.x + cE.y + cE.z - cM1 - cM3;
float cW = min(0.5, fwidth(cM2) * 1.5 + 0.05);
if (!cSkinHit) cCol *= 1.0 - 0.28 * smoothstep(1.0 - cW, 1.0, cM2);
diffuseColor.rgb = cCol;
`;

function makeMaterial(uniforms, boolean) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0 });
  return patchMaterial(m, {
    key: boolean ? 'cubes-boolean' : 'cubes-fine',
    uniforms,
    defines: boolean ? { CUBE_BOOLEAN: '' } : {},
    vertexPars: VERTEX_PARS,
    fragmentPars: FRAGMENT_PARS,
    vertex: {
      beginnormal_vertex: 'vec3 cCenter; mat3 cR; float cScale;\ncubePose(cCenter, cR, cScale);\nvec3 objectNormal = cR * normal;',
      begin_vertex: BEGIN_VERTEX,
    },
    fragment: {
      color_fragment: COLOR_FRAGMENT,
      roughnessmap_fragment: '$ORIGINAL\nroughnessFactor = cSkinHit ? uSkinRough : 0.42;',
      normal_fragment_begin: '$ORIGINAL\nif (cSkinHit) normal = normalize((viewMatrix * vec4(cSkinN, 0.0)).xyz);',
    },
  });
}

function makeDepthMaterial(uniforms) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  return patchMaterial(m, {
    key: 'cubes-depth',
    uniforms,
    vertexPars: POSE_GLSL,
    vertex: {
      begin_vertex: 'vec3 cCenter; mat3 cR; float cScale;\ncubePose(cCenter, cR, cScale);\nvec3 transformed = cCenter + cR * (position * aSize * cScale);',
    },
  });
}

// Each pile owns its materials (and so its uniforms): three.js only uploads
// uniforms when the material changes, so piles must not share one material.
function pileUniforms(shared, fruit) {
  return {
    uFruit: { value: fruit.glsl },
    uSkinT: { value: fruit.skinThickness },
    uBMin: { value: new THREE.Vector3(...fruit.bbox.min) },
    uBMax: { value: new THREE.Vector3(...fruit.bbox.max) },
    uTime: { value: 0 },
    uOutro: { value: 0 },
    uGravity: { value: GRAVITY },
    uGroupOffset: { value: new THREE.Vector3(0, -fruit.boardY, 0) },
    uProj: shared.uProj,
    uLeafColor: { value: new THREE.Color(0.25, 0.58, 0.14) },
    uStemColor: { value: new THREE.Color(...(fruit.stemColor || [0.33, 0.19, 0.09])) },
    uSkinRough: { value: fruit.skinRoughness ?? 0.35 },
  };
}

const BOX = new THREE.BoxGeometry(1, 1, 1);

// One round's worth of cubes. fruit = { glsl, skinThickness, bbox, boardY, ... }
export class CubePile {
  constructor(data, fruit, shared) {
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
    this.geometry = geo;
    this.uniforms = pileUniforms(shared, fruit);
    this.material = makeMaterial(this.uniforms, data.coarse);
    this.depthMaterial = makeDepthMaterial(this.uniforms);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.customDepthMaterial = this.depthMaterial;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.position.y = -fruit.boardY;
  }

  set(time, outro) {
    this.uniforms.uTime.value = time;
    this.uniforms.uOutro.value = outro;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.depthMaterial.dispose();
  }
}
