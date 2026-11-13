// The whole fruit before it falls apart: body with cut lines, the flat cut face
// (cap) that appears as slabs come off, and the stem and leaf.
import * as THREE from 'three';
import { FRUIT_GLSL } from './fruit-glsl.js';
import { bodyField, leafFrame, leafPoint, stemPoint } from './fruits.js';
import { patchMaterial } from './shader-patch.js';

const SKIN_ROUGHNESS = { apple: 0.3, watermelon: 0.42, orange: 0.55, kiwi: 0.85 };

export function createFruitUniforms() {
  return {
    uFruit: { value: 0 },
    uSkinT: { value: 0.025 },
    uBMin: { value: new THREE.Vector3(-1, -1, -1) },
    uBMax: { value: new THREE.Vector3(1, 1, 1) },
    uCutN: { value: new THREE.Vector3() },
    uCutDone: { value: new THREE.Vector3() },
    uActive: { value: new THREE.Vector4() },
    uClipZ: { value: 1e6 },
  };
}

const CLIP_PARS = 'varying vec3 vObjPos;\nuniform float uClipZ;\n';
const CLIP_VERTEX = { begin_vertex: '$ORIGINAL\nvObjPos = position;' };

function clipDepthMaterial(uniforms, key) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  return patchMaterial(m, {
    key,
    uniforms: { uClipZ: uniforms.uClipZ },
    vertexPars: 'varying vec3 vObjPos;',
    fragmentPars: CLIP_PARS,
    vertex: CLIP_VERTEX,
    fragmentMainStart: 'if (vObjPos.z > uClipZ) discard;',
  });
}

function bodyGeometry(fruit) {
  const geo = new THREE.SphereGeometry(1, 192, 128);
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const e = 0.002;
  const f = (x, y, z) => bodyField(fruit, x, y, z);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = fruit.rho(x, y, z);
    const px = x * r;
    const py = y * r;
    const pz = z * r;
    pos.setXYZ(i, px, py, pz);
    const g = new THREE.Vector3(f(px + e, py, pz) - f(px - e, py, pz), f(px, py + e, pz) - f(px, py - e, pz), f(px, py, pz + e) - f(px, py, pz - e)).normalize();
    nor.setXYZ(i, g.x, g.y, g.z);
  }
  geo.computeBoundingSphere();
  return geo;
}

function bodyMaterial(uniforms) {
  const m = new THREE.MeshPhysicalMaterial({ roughness: 0.32, clearcoat: 0.55, clearcoatRoughness: 0.22, side: THREE.DoubleSide });
  return patchMaterial(m, {
    key: 'fruit-body',
    uniforms,
    vertexPars: 'varying vec3 vObjPos;',
    fragmentPars: `${FRUIT_GLSL}\n${CLIP_PARS}`,
    vertex: CLIP_VERTEX,
    fragment: {
      color_fragment: `$ORIGINAL
        if (vObjPos.z > uClipZ) discard;
        float fLines = cutLines(vObjPos, true);
        vec3 fCol = gl_FrontFacing ? fruitSkin(vObjPos) : fruitFlesh(vObjPos, 0.25) * 0.75;
        diffuseColor.rgb = fCol * (1.0 - 0.62 * fLines);`,
      normal_fragment_begin: `$ORIGINAL
        if (gl_FrontFacing) normal = bumpNormal(-vViewPosition, normal, fruitBump(vObjPos) - fLines * 0.35, 1.0);`,
    },
  });
}

function capMaterial(uniforms) {
  const m = new THREE.MeshPhysicalMaterial({ roughness: 0.38, clearcoat: 0.35, clearcoatRoughness: 0.3, side: THREE.DoubleSide });
  return patchMaterial(m, {
    key: 'fruit-cap',
    uniforms,
    vertexPars: 'varying vec3 vObjPos;\nuniform float uClipZ;',
    fragmentPars: `${FRUIT_GLSL}\nvarying vec3 vObjPos;`,
    vertex: { begin_vertex: '$ORIGINAL\ntransformed.z = uClipZ;\nvObjPos = transformed;' },
    fragment: {
      color_fragment: `$ORIGINAL
        if (fruitField(vObjPos) > 0.0) discard;
        float cLines = cutLines(vObjPos, false);
        diffuseColor.rgb = fruitInterior(vObjPos) * (1.0 - 0.5 * cLines);`,
    },
  });
}

function capDepthMaterial(uniforms) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  return patchMaterial(m, {
    key: 'fruit-cap-depth',
    uniforms,
    vertexPars: 'varying vec3 vObjPos;\nuniform float uClipZ;',
    fragmentPars: `${FRUIT_GLSL}\nvarying vec3 vObjPos;`,
    vertex: { begin_vertex: '$ORIGINAL\ntransformed.z = uClipZ;\nvObjPos = transformed;' },
    fragmentMainStart: 'if (fruitField(vObjPos) > 0.0) discard;',
  });
}

function leafTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#2f7f17');
  grad.addColorStop(0.5, '#4fae22');
  grad.addColorStop(1, '#2b7414');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = 'rgba(210,240,150,0.75)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, 64);
  g.lineTo(256, 64);
  g.stroke();
  g.lineWidth = 1.4;
  g.strokeStyle = 'rgba(200,235,140,0.45)';
  for (let i = 1; i < 9; i++) {
    const x = i * 28;
    g.beginPath();
    g.moveTo(x, 64);
    g.quadraticCurveTo(x + 18, 40, x + 34, 6);
    g.moveTo(x, 64);
    g.quadraticCurveTo(x + 18, 88, x + 34, 122);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function leafGeometry(leaf) {
  const frame = leafFrame(leaf);
  const NU = 40;
  const NV = 12;
  const positions = [];
  const uvs = [];
  const index = [];
  for (let i = 0; i <= NU; i++) {
    for (let j = 0; j <= NV; j++) {
      positions.push(...leafPoint(leaf, frame, i / NU, (j / NV) * 2 - 1));
      uvs.push(i / NU, j / NV);
    }
  }
  for (let i = 0; i < NU; i++) {
    for (let j = 0; j < NV; j++) {
      const a = i * (NV + 1) + j;
      const b = a + NV + 1;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

function clippedMaterial(params, uniforms, key) {
  return patchMaterial(new THREE.MeshStandardMaterial(params), {
    key,
    uniforms: { uClipZ: uniforms.uClipZ },
    vertexPars: 'varying vec3 vObjPos;',
    fragmentPars: CLIP_PARS,
    vertex: CLIP_VERTEX,
    fragmentMainStart: 'if (vObjPos.z > uClipZ) discard;',
  });
}

export class FruitModel {
  constructor(uniforms) {
    this.uniforms = uniforms;
    this.root = new THREE.Group(); // world offset (board top at y = 0)
    this.pivot = new THREE.Group(); // squash pivot at the bottom of the fruit
    this.content = new THREE.Group(); // fruit space
    this.root.add(this.pivot);
    this.pivot.add(this.content);
    this.bodyMat = bodyMaterial(uniforms);
    this.bodyDepth = clipDepthMaterial(uniforms, 'fruit-body-depth');
    this.capMat = capMaterial(uniforms);
    this.capDepth = capDepthMaterial(uniforms);
    this.leafMap = leafTexture();
    this.cap = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), this.capMat);
    this.cap.customDepthMaterial = this.capDepth;
    this.cap.castShadow = true;
    this.cap.receiveShadow = true;
    this.cap.frustumCulled = false;
    this.parts = [];
    this.cache = new Map();
    this.fruitId = null;
  }

  setFruit(fruit) {
    if (this.fruitId === fruit.id) return;
    this.fruitId = fruit.id;
    for (const p of this.parts) this.content.remove(p);
    this.parts = this.cache.get(fruit.id) || this.buildParts(fruit);
    this.cache.set(fruit.id, this.parts);
    for (const p of this.parts) this.content.add(p);
    this.content.add(this.cap);
    this.uniforms.uFruit.value = fruit.glsl;
    this.uniforms.uSkinT.value = fruit.skinThickness;
    this.bodyMat.roughness = SKIN_ROUGHNESS[fruit.id] ?? 0.4;
    this.bodyMat.clearcoat = fruit.id === 'kiwi' ? 0.0 : fruit.id === 'orange' ? 0.25 : 0.55;
  }

  buildParts(fruit) {
    const parts = [];
    const body = new THREE.Mesh(bodyGeometry(fruit), this.bodyMat);
    body.customDepthMaterial = this.bodyDepth;
    body.castShadow = true;
    body.receiveShadow = true;
    parts.push(body);
    if (fruit.stem) {
      const s = fruit.stem;
      const curve = new THREE.QuadraticBezierCurve3(...[s.p0, s.p1, s.p2].map((p) => new THREE.Vector3(...p)));
      const mat = clippedMaterial({ color: new THREE.Color(...s.color), roughness: 0.75 }, this.uniforms, 'stem');
      const stem = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, s.r, 10, false), mat);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(s.r, 10, 8), mat);
      tip.position.set(...stemPoint(s, 1));
      for (const m of [stem, tip]) {
        m.castShadow = true;
        m.customDepthMaterial = clipDepthMaterial(this.uniforms, 'stem-depth');
        parts.push(m);
      }
    }
    if (fruit.leaf) {
      const mat = clippedMaterial({ map: this.leafMap, roughness: 0.45, side: THREE.DoubleSide }, this.uniforms, 'leaf');
      const leaf = new THREE.Mesh(leafGeometry(fruit.leaf), mat);
      leaf.castShadow = true;
      leaf.customDepthMaterial = clipDepthMaterial(this.uniforms, 'leaf-depth');
      parts.push(leaf);
    }
    return parts;
  }

  // Drop from above and squash on landing, pivoting on the bottom of the fruit.
  setIntro(round, t, boardY) {
    const tau = t - round.start;
    const fall = round.land - round.start;
    this.root.position.y = -boardY;
    this.pivot.position.y = boardY;
    this.content.position.y = -boardY;
    let drop = 0;
    let sy = 1;
    if (tau < fall) {
      const k = Math.max(0, tau) / fall;
      drop = (1 - k * k) * 3.4;
      sy = 1 + 0.06 * k;
    } else {
      const k = tau - fall;
      sy = 1 - 0.16 * Math.exp(-k * 9) * Math.cos(k * 24);
    }
    this.root.position.y += drop;
    const sxz = 1 / Math.sqrt(sy);
    this.pivot.scale.set(sxz, sy, sxz);
  }

  setVisible(fruitVisible, capVisible) {
    this.root.visible = fruitVisible;
    this.cap.visible = capVisible;
  }
}
