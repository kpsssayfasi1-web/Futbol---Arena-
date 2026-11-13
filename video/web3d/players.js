// Stylised low-poly footballers built from primitives. Deliberately
// generic (no likenesses): kit colours, shirt number and a run/kick cycle.

import * as THREE from '/video/node_modules/three/build/three.module.js';

const SKIN_TONES = ['#f1c7a5', '#e0ac85', '#c68863', '#a86b4a', '#8a5236', '#6b3e26'];
const HAIR_TONES = ['#1d1612', '#2e2018', '#4a3020', '#6b4a2b', '#c9a15c', '#121212'];

function material(color, roughness = 0.75) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
}

function capsule(radius, length, mat) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 10), mat);
  mesh.castShadow = true;
  return mesh;
}

function numberTexture(number, shirt, ink) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = shirt; g.fillRect(0, 0, 128, 128);
  g.fillStyle = ink;
  g.font = "900 92px 'Inter', sans-serif";
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(number === null ? '' : String(number), 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

// Kit: shirt = primary colour, shorts/socks = secondary (or a dark tone
// when both are light), number ink picked for contrast.
export function kitFor(colors) {
  const [primary, secondary] = colors;
  const shorts = luminance(primary) > 0.8 && luminance(secondary) > 0.8 ? '#1c2333' : secondary;
  const ink = luminance(primary) > 0.55 ? '#111827' : '#ffffff';
  return { shirt: primary, shorts, socks: primary, ink };
}

export function createPlayer({ kit, number, seed }) {
  const skin = material(SKIN_TONES[seed % SKIN_TONES.length], 0.6);
  const hair = material(HAIR_TONES[(seed * 7) % HAIR_TONES.length], 0.9);
  const shirt = material(kit.shirt, 0.65);
  const shorts = material(kit.shorts, 0.7);
  const socks = material(kit.socks, 0.7);
  const boots = material('#111111', 0.4);

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const legs = [-1, 1].map((side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.12, 0.86, 0);
    const thigh = capsule(0.105, 0.3, skin); thigh.position.y = -0.2;
    const short = capsule(0.13, 0.12, shorts); short.position.y = -0.08;
    const shin = capsule(0.09, 0.32, socks); shin.position.y = -0.56;
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.26), boots);
    boot.position.set(0, -0.81, 0.05); boot.castShadow = true;
    hip.add(thigh, short, shin, boot);
    body.add(hip);
    return hip;
  });

  const torso = capsule(0.25, 0.36, shirt);
  torso.scale.set(1, 1, 0.72);
  torso.position.y = 1.2;
  body.add(torso);

  const tex = numberTexture(number, kit.shirt, kit.ink);
  for (const z of [0.185, -0.185]) {
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
    plate.position.set(0, 1.22, z);
    if (z < 0) plate.rotation.y = Math.PI;
    body.add(plate);
  }

  const arms = [-1, 1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.33, 1.42, 0);
    const sleeve = capsule(0.085, 0.16, shirt); sleeve.position.y = -0.12;
    const forearm = capsule(0.07, 0.26, skin); forearm.position.y = -0.38;
    shoulder.add(sleeve, forearm);
    shoulder.rotation.z = side * 0.12;
    body.add(shoulder);
    return shoulder;
  });

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), skin);
  head.position.y = 1.74; head.castShadow = true;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.178, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  cap.position.y = 1.755; cap.rotation.x = -0.25;
  body.add(head, cap);

  return { root, body, legs, arms, phase: 0 };
}

// Pose from the simulation snapshot: position, facing, speed, kick timer.
export function posePlayer(p, snap, dt) {
  p.root.position.set(snap.x, 0, snap.y);
  p.root.rotation.y = Math.atan2(Math.cos(snap.facing), Math.sin(snap.facing));
  const stride = Math.min(1, snap.speed / 5.6);
  p.phase += snap.speed * dt * 2.1;
  const swing = Math.sin(p.phase) * 0.9 * stride;
  p.legs[0].rotation.x = swing;
  p.legs[1].rotation.x = -swing;
  p.arms[0].rotation.x = -swing * 0.8;
  p.arms[1].rotation.x = swing * 0.8;
  p.body.position.y = Math.abs(Math.cos(p.phase)) * 0.06 * stride;
  p.body.rotation.x = 0.18 * stride;
  p.arms[0].rotation.z = -0.12;
  p.arms[1].rotation.z = 0.12;
  if (snap.kick > 0) {
    const k = 1 - snap.kick / 0.25;
    p.legs[1].rotation.x = -1.3 * Math.sin(k * Math.PI);
    p.arms[0].rotation.x = 0.9 * Math.sin(k * Math.PI);
  }
}

export function celebrate(p, t) {
  p.body.position.y = Math.abs(Math.sin(t * 9)) * 0.35;
  p.arms[0].rotation.x = Math.PI * 0.95;
  p.arms[1].rotation.x = Math.PI * 0.95;
  p.arms[0].rotation.z = -0.4;
  p.arms[1].rotation.z = 0.4;
  p.legs[0].rotation.x = 0;
  p.legs[1].rotation.x = 0;
  p.body.rotation.x = 0;
}
