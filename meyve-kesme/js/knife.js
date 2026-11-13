// Chef's knife model. Fast strokes are drawn as several translucent copies at
// sub-frame times, which reads as motion blur.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BLADE_LENGTH } from './knife-pose.js';

const GHOSTS = 12;
const BLADE_H = 0.42;

function bladeGeometry() {
  const L = BLADE_LENGTH;
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(L * 0.7, 0);
  s.quadraticCurveTo(L * 0.93, 0.01, L, 0.1);
  s.quadraticCurveTo(L * 0.8, BLADE_H * 0.62, L * 0.45, BLADE_H * 0.92);
  s.lineTo(0.04, BLADE_H);
  s.lineTo(0, BLADE_H);
  s.lineTo(0, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.006, bevelSegments: 2, curveSegments: 24 });
  geo.translate(0, 0.006, -0.006);
  geo.computeVertexNormals();
  return geo;
}

function buildKnife(materials) {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(bladeGeometry(), materials.steel);
  g.add(blade);
  const bolster = new THREE.Mesh(new RoundedBoxGeometry(0.09, BLADE_H * 0.98, 0.05, 2, 0.015), materials.steel);
  bolster.position.set(-0.045, BLADE_H * 0.5, 0);
  g.add(bolster);
  const handle = new THREE.Mesh(new RoundedBoxGeometry(1.05, 0.22, 0.1, 4, 0.045), materials.wood);
  handle.position.set(-0.6, BLADE_H * 0.62, 0);
  g.add(handle);
  const rivetGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.104, 12);
  rivetGeo.rotateX(Math.PI / 2);
  for (const x of [-0.25, -0.6, -0.95]) {
    const r = new THREE.Mesh(rivetGeo, materials.steel);
    r.position.set(x, BLADE_H * 0.62, 0);
    g.add(r);
  }
  return g;
}

export class Knife {
  constructor() {
    this.solid = {
      steel: new THREE.MeshStandardMaterial({ color: 0xdfe4ea, metalness: 1, roughness: 0.2 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x2a160c, roughness: 0.55 }),
    };
    this.ghostMats = {
      steel: new THREE.MeshStandardMaterial({ color: 0xe8edf2, metalness: 0.9, roughness: 0.25, transparent: true, depthWrite: false }),
      wood: new THREE.MeshStandardMaterial({ color: 0x2a160c, roughness: 0.55, transparent: true, depthWrite: false }),
    };
    this.main = buildKnife(this.solid);
    this.main.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    this.ghosts = [];
    for (let i = 0; i < GHOSTS; i++) {
      const k = buildKnife(this.ghostMats);
      k.visible = false;
      this.ghosts.push(k);
    }
    this.group = new THREE.Group();
    this.group.add(this.main, ...this.ghosts);
  }

  // samples: array of poses inside the shutter interval ({pos, quat}), newest first.
  update(samples, offsetY) {
    const fast = samples.length > 1;
    this.main.visible = !fast;
    if (!fast) {
      place(this.main, samples[0], offsetY);
    }
    // ~1/N per sample is what a real shutter integrates; a little extra keeps
    // the blade readable without washing out the item behind it.
    const alpha = fast ? Math.min(0.35, 1.3 / samples.length) : 0;
    this.ghostMats.steel.opacity = alpha;
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
