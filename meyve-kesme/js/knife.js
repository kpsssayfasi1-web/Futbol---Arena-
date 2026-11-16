// Knife models (chef's knife, cleaver, santoku). The edge runs along local +x
// from the heel (x = 0) to the tip (x = BLADE_LENGTH) at y = 0, so every model
// follows the same cutting poses. Fast strokes are drawn as several translucent
// copies at sub-frame times, which reads as motion blur; a hidden solid copy
// keeps casting the blade's shadow on the board meanwhile.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BLADE_LENGTH } from './knife-pose.js';

const GHOSTS = 12;
const L = BLADE_LENGTH;

// tr/en: UI names. pitch: playback rate of the knife-on-board hit (a heavier
// blade rings lower).
export const KNIVES = {
  chef: { tr: 'Şef bıçağı', en: "Chef's knife", pitch: 1 },
  cleaver: { tr: 'Satır', en: 'Cleaver', pitch: 0.8 },
  santoku: { tr: 'Santoku', en: 'Santoku', pitch: 1.08 },
};
export const KNIFE_IDS = Object.keys(KNIVES);

function extrude(shape, depth, holes = []) {
  for (const h of holes) shape.holes.push(h);
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.006, bevelSegments: 2, curveSegments: 24 });
  geo.translate(0, 0.006, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

function chefBlade(h) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(L * 0.7, 0);
  s.quadraticCurveTo(L * 0.93, 0.01, L, 0.1);
  s.quadraticCurveTo(L * 0.8, h * 0.62, L * 0.45, h * 0.92);
  s.lineTo(0.04, h);
  s.lineTo(0, h);
  s.lineTo(0, 0);
  return extrude(s, 0.012);
}

// Tall rectangle, slightly curved edge, hanging hole in the top front corner.
function cleaverBlade(h) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(L * 0.5, -0.012, L * 0.97, 0.03);
  s.quadraticCurveTo(L, 0.04, L, 0.08);
  s.lineTo(L, h - 0.04);
  s.quadraticCurveTo(L, h, L - 0.04, h);
  s.lineTo(0, h);
  s.lineTo(0, 0);
  const hole = new THREE.Path();
  hole.absarc(L - 0.2, h - 0.2, 0.075, 0, Math.PI * 2, true);
  return extrude(s, 0.022, [hole]);
}

// Flat edge, spine dropping down to a rounded "sheep's foot" tip.
function santokuBlade(h) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(L * 0.82, 0);
  s.quadraticCurveTo(L * 0.98, 0.02, L, 0.12);
  s.quadraticCurveTo(L * 0.96, h * 0.75, L * 0.7, h * 0.95);
  s.lineTo(0.04, h);
  s.lineTo(0, h);
  s.lineTo(0, 0);
  return extrude(s, 0.012);
}

const MODELS = {
  chef: { h: 0.42, blade: chefBlade, handle: [1.05, 0.22, 0.1], handleY: 0.62, rivets: [-0.25, -0.6, -0.95], bolster: true },
  cleaver: { h: 0.95, blade: cleaverBlade, handle: [1.0, 0.2, 0.11], handleY: 0.72, rivets: [-0.3, -0.62, -0.92], bolster: false },
  santoku: { h: 0.48, blade: santokuBlade, handle: [1.0, 0.2, 0.1], handleY: 0.6, rivets: [], bolster: true, dimples: true },
};

function buildKnife(materials, type) {
  const m = MODELS[type] || MODELS.chef;
  const g = new THREE.Group();
  g.add(new THREE.Mesh(m.blade(m.h), materials.steel));
  const hy = m.h * m.handleY;
  if (m.bolster) {
    const bolster = new THREE.Mesh(new RoundedBoxGeometry(0.09, m.h * 0.98, 0.05, 2, 0.015), materials.steel);
    bolster.position.set(-0.045, m.h * 0.5, 0);
    g.add(bolster);
  } else {
    // cleaver: the tang runs into the handle under a steel ferrule
    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 20), materials.steel);
    ferrule.rotation.z = Math.PI / 2;
    ferrule.position.set(-0.04, hy, 0);
    g.add(ferrule);
  }
  const handle = new THREE.Mesh(new RoundedBoxGeometry(m.handle[0], m.handle[1], m.handle[2], 4, 0.045), materials.wood);
  handle.position.set(-m.handle[0] / 2 - 0.08, hy, 0);
  g.add(handle);
  const rivetGeo = new THREE.CylinderGeometry(0.022, 0.022, m.handle[2] + 0.004, 12);
  rivetGeo.rotateX(Math.PI / 2);
  for (const x of m.rivets) {
    const r = new THREE.Mesh(rivetGeo, materials.steel);
    r.position.set(x, hy, 0);
    g.add(r);
  }
  if (m.dimples) {
    // granton dimples along the blade, both sides
    const dimple = new THREE.SphereGeometry(0.035, 12, 8);
    dimple.scale(1.4, 1, 0.25);
    for (let i = 0; i < 9; i++) {
      for (const side of [-1, 1]) {
        const d = new THREE.Mesh(dimple, materials.dark);
        d.position.set(0.25 + i * 0.2, 0.1, side * 0.008);
        g.add(d);
      }
    }
  }
  return g;
}

export class Knife {
  constructor(type = 'chef') {
    this.solid = {
      steel: new THREE.MeshStandardMaterial({ color: 0xdfe4ea, metalness: 1, roughness: 0.2 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x2a160c, roughness: 0.55 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 1, roughness: 0.35 }),
    };
    this.ghostMats = {
      steel: new THREE.MeshStandardMaterial({ color: 0xe8edf2, metalness: 0.9, roughness: 0.25, transparent: true, depthWrite: false }),
      wood: new THREE.MeshStandardMaterial({ color: 0x2a160c, roughness: 0.55, transparent: true, depthWrite: false }),
      dark: new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.9, roughness: 0.35, transparent: true, depthWrite: false }),
    };
    const hidden = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    this.hiddenMats = { steel: hidden, wood: hidden, dark: hidden };
    this.group = new THREE.Group();
    this.setType(type);
  }

  setType(type) {
    if (this.type === type) return;
    this.type = KNIVES[type] ? type : 'chef';
    this.group.clear();
    this.main = buildKnife(this.solid, this.type);
    this.main.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    // invisible in the colour pass, still in the shadow map
    this.shadowCaster = buildKnife(this.hiddenMats, this.type);
    this.shadowCaster.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    this.ghosts = [];
    for (let i = 0; i < GHOSTS; i++) {
      const k = buildKnife(this.ghostMats, this.type);
      k.visible = false;
      this.ghosts.push(k);
    }
    this.group.add(this.main, this.shadowCaster, ...this.ghosts);
  }

  // samples: array of poses inside the shutter interval ({pos, quat}), newest first.
  update(samples, offsetY) {
    const fast = samples.length > 1;
    this.main.visible = !fast;
    this.shadowCaster.visible = fast;
    place(fast ? this.shadowCaster : this.main, samples[0], offsetY);
    // ~1/N per sample is what a real shutter integrates; a little extra keeps
    // the blade readable without washing out the item behind it.
    const alpha = fast ? Math.min(0.35, 1.3 / samples.length) : 0;
    this.ghostMats.steel.opacity = alpha;
    this.ghostMats.dark.opacity = alpha;
    this.ghostMats.wood.opacity = alpha * 0.45;
    this.ghosts.forEach((g, i) => {
      g.visible = fast && i < samples.length;
      if (g.visible) place(g, samples[i], offsetY);
    });
  }

  static get ghostCount() {
    return GHOSTS;
  }
}

function place(obj, pose, offsetY) {
  obj.position.set(pose.pos[0], pose.pos[1] + offsetY, pose.pos[2]);
  obj.quaternion.set(pose.quat[0], pose.quat[1], pose.quat[2], pose.quat[3]);
}
