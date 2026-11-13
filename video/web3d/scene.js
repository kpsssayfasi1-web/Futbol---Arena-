// Night-time street cage: turf pitch, kickboards with graffiti, chain-link
// fence, floodlights, small street goals, a few fans and a city skyline.
// World units are metres; sim (x, y) maps to world (x, 0, y).

import * as THREE from '/video/node_modules/three/build/three.module.js';

const PITCH_W = 14;
const PITCH_L = 24;
const GOAL_HALF = 2.2;
const GOAL_H = 2;
const GOAL_DEPTH = 1.1;
const CORNER = 1.6;
const BOARD_H = 0.9;
const FENCE_H = 4.2;

// Seeded random source for textures and props (set by buildScene).
let rnd = Math.random;

function canvasTexture(w, h, draw, repeat = null) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(...repeat); }
  return tex;
}

function turfTexture() {
  const pxPerM = 48;
  return canvasTexture(PITCH_W * pxPerM, PITCH_L * pxPerM, (g, w, h) => {
    for (let i = 0; i < 12; i += 1) {
      g.fillStyle = i % 2 ? '#2f8a4c' : '#277a41';
      g.fillRect(0, (i * h) / 12, w, h / 12 + 1);
    }
    g.strokeStyle = 'rgba(255,255,255,.92)';
    g.lineWidth = 0.1 * pxPerM;
    const m = (v) => v * pxPerM;
    g.strokeRect(m(0.15), m(0.15), w - m(0.3), h - m(0.3));
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    g.beginPath(); g.arc(w / 2, h / 2, m(2.2), 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(w / 2, h / 2, m(0.15), 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
    for (const y of [0, h]) {
      g.beginPath(); g.arc(w / 2, y, m(3.6), 0, Math.PI * 2); g.stroke();
    }
    // turf grain
    for (let i = 0; i < 9000; i += 1) {
      g.fillStyle = `rgba(0,0,0,${rnd() * 0.06})`;
      g.fillRect(rnd() * w, rnd() * h, 2, 2);
    }
  });
}

function concreteTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#3a3d44'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i += 1) {
      const v = 40 + rnd() * 40;
      g.fillStyle = `rgba(${v},${v},${v + 6},.35)`;
      g.fillRect(rnd() * w, rnd() * h, 2, 2);
    }
  }, [16, 16]);
}

function graffitiTexture(colors, label) {
  return canvasTexture(1024, 96, (g, w, h) => {
    g.fillStyle = '#1b1e26'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i += 1) {
      g.fillStyle = colors[i % colors.length];
      g.globalAlpha = 0.55 + rnd() * 0.4;
      g.beginPath();
      const x = rnd() * w;
      const y = rnd() * h;
      g.ellipse(x, y, 20 + rnd() * 70, 8 + rnd() * 26, rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    g.font = "900 54px 'Inter', sans-serif";
    g.textBaseline = 'middle';
    g.lineWidth = 8; g.strokeStyle = '#0d0f14';
    g.strokeText(label, 40, h / 2 + 2);
    g.fillStyle = '#ffffff';
    g.fillText(label, 40, h / 2 + 2);
  }, [2, 1]);
}

function fenceTexture() {
  return canvasTexture(64, 64, (g) => {
    g.clearRect(0, 0, 64, 64);
    g.strokeStyle = 'rgba(200,210,225,.85)';
    g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 64); g.moveTo(64, 0); g.lineTo(0, 64); g.stroke();
  }, [1, 1]);
}

function netTexture() {
  return canvasTexture(64, 64, (g) => {
    g.clearRect(0, 0, 64, 64);
    g.strokeStyle = 'rgba(255,255,255,.9)';
    g.lineWidth = 3;
    g.strokeRect(0, 0, 64, 64);
  }, [1, 1]);
}

// Perimeter of the cage as a closed polyline (chamfered corners).
function perimeter() {
  const w = PITCH_W / 2;
  const l = PITCH_L / 2;
  const c = CORNER;
  return [
    [-w + c, -l], [w - c, -l], [w, -l + c], [w, l - c], [w - c, l], [-w + c, l], [-w, l - c], [-w, -l + c],
  ];
}

function segments() {
  const pts = perimeter();
  const segs = [];
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length];
    // Split end lines around the goal mouth.
    if (a[1] === b[1] && Math.abs(a[1]) === PITCH_L / 2) {
      const dir = Math.sign(b[0] - a[0]);
      segs.push([a, [-GOAL_HALF * dir, a[1]], true], [[GOAL_HALF * dir, a[1]], b, true]);
    } else {
      segs.push([a, b, false]);
    }
  });
  return segs;
}

function addWall(scene, a, b, height, mat, y0 = 0, thickness = 0.12) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, height, thickness), mat);
  mesh.position.set((a[0] + b[0]) / 2, y0 + height / 2, (a[1] + b[1]) / 2);
  mesh.rotation.y = -Math.atan2(dz, dx);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function addGoal(scene, z) {
  const dir = Math.sign(z);
  const white = new THREE.MeshStandardMaterial({ color: '#f4f6fa', roughness: 0.35, metalness: 0.2 });
  const post = (x, y, zz, len, axis) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, len, 10), white);
    m.position.set(x, y, zz);
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    if (axis === 'z') m.rotation.x = Math.PI / 2;
    m.castShadow = true;
    scene.add(m);
  };
  post(-GOAL_HALF, GOAL_H / 2, z, GOAL_H, 'y');
  post(GOAL_HALF, GOAL_H / 2, z, GOAL_H, 'y');
  post(0, GOAL_H, z, GOAL_HALF * 2, 'x');
  post(-GOAL_HALF, GOAL_H, z + dir * GOAL_DEPTH / 2, GOAL_DEPTH, 'z');
  post(GOAL_HALF, GOAL_H, z + dir * GOAL_DEPTH / 2, GOAL_DEPTH, 'z');
  const net = new THREE.MeshStandardMaterial({ map: netTexture(), transparent: true, side: THREE.DoubleSide, roughness: 1, depthWrite: false });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_HALF * 2, GOAL_H), net.clone());
  back.material.map = netTexture(); back.material.map.repeat.set(GOAL_HALF * 2 / 0.25, GOAL_H / 0.25);
  back.position.set(0, GOAL_H / 2, z + dir * GOAL_DEPTH);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_HALF * 2, GOAL_DEPTH), net.clone());
  top.material.map = netTexture(); top.material.map.repeat.set(GOAL_HALF * 2 / 0.25, GOAL_DEPTH / 0.25);
  top.rotation.x = Math.PI / 2; top.position.set(0, GOAL_H, z + dir * GOAL_DEPTH / 2);
  scene.add(back, top);
  for (const x of [-GOAL_HALF, GOAL_HALF]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_DEPTH, GOAL_H), net.clone());
    side.material.map = netTexture(); side.material.map.repeat.set(GOAL_DEPTH / 0.25, GOAL_H / 0.25);
    side.rotation.y = Math.PI / 2; side.position.set(x, GOAL_H / 2, z + dir * GOAL_DEPTH / 2);
    scene.add(side);
  }
}

function addFloodlight(scene, x, z, withLight) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 11, 8), new THREE.MeshStandardMaterial({ color: '#5b6270', roughness: 0.6 }));
  pole.position.set(x, 5.5, z);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.3), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff4d6', emissiveIntensity: 3 }));
  head.position.set(x * 0.97, 11, z * 0.97);
  head.lookAt(0, 0, 0);
  scene.add(pole, head);
  if (!withLight) return;
  const spot = new THREE.SpotLight('#fff1d6', 260, 60, 0.75, 0.6, 1.6);
  spot.position.set(x, 11, z);
  spot.target.position.set(0, 0, 0);
  scene.add(spot, spot.target);
}

function addSkyline(scene) {
  const win = canvasTexture(64, 128, (g, w, h) => {
    g.fillStyle = '#0b0f1c'; g.fillRect(0, 0, w, h);
    for (let y = 6; y < h; y += 12) {
      for (let x = 6; x < w; x += 12) {
        if (rnd() < 0.35) { g.fillStyle = rnd() < 0.5 ? '#ffd27a' : '#9fc4ff'; g.fillRect(x, y, 6, 7); }
      }
    }
  });
  for (let i = 0; i < 22; i += 1) {
    const w = 4 + rnd() * 7;
    const h = 10 + rnd() * 26;
    const mat = new THREE.MeshStandardMaterial({ color: '#141a2b', emissive: '#ffffff', emissiveMap: win, emissiveIntensity: 0.9 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 4), mat);
    b.position.set(-45 + i * 4.3 + rnd() * 2, h / 2, -42 - rnd() * 14);
    scene.add(b);
  }
}

function addFans(scene, home, away, rand) {
  const fans = [];
  const sides = [[-PITCH_W / 2 - 1.4, home], [PITCH_W / 2 + 1.4, away]];
  for (const [x, colors] of sides) {
    for (let i = 0; i < 14; i += 1) {
      const z = -PITCH_L / 2 + 1.5 + i * 1.6 + rand() * 0.6;
      const color = colors[i % 2];
      const fan = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.6, 3, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
      body.position.y = 0.75;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), new THREE.MeshStandardMaterial({ color: '#c69a78', roughness: 0.7 }));
      head.position.y = 1.35;
      fan.add(body, head);
      fan.position.set(x + Math.sign(x) * rand() * 0.8, 0, z);
      fan.userData.offset = rand() * 6;
      scene.add(fan);
      fans.push(fan);
    }
  }
  return fans;
}

export function buildScene({ home, away, rand, label, shadowSize = 2048, spotlights = true }) {
  rnd = rand;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#070b16');
  scene.fog = new THREE.Fog('#070b16', 45, 95);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);

  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(PITCH_W, PITCH_L), new THREE.MeshStandardMaterial({ map: turfTexture(), roughness: 0.9 }));
  pitch.rotation.x = -Math.PI / 2; pitch.position.y = 0.01; pitch.receiveShadow = true;
  scene.add(pitch);

  const boardHome = new THREE.MeshStandardMaterial({ map: graffitiTexture([...home.colors, '#ffcf4a'], `${home.name.toUpperCase()}  ·  ${label}`), roughness: 0.8 });
  const boardAway = new THREE.MeshStandardMaterial({ map: graffitiTexture([...away.colors, '#ffcf4a'], `${away.name.toUpperCase()}  ·  ${label}`), roughness: 0.8 });
  const fenceMat = new THREE.MeshStandardMaterial({ map: fenceTexture(), transparent: true, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.4, depthWrite: false });
  const postMat = new THREE.MeshStandardMaterial({ color: '#7d8796', roughness: 0.5, metalness: 0.6 });
  for (const [a, b, endLine] of segments()) {
    const mat = (a[0] + b[0]) / 2 < 0 || (endLine && a[1] > 0) ? boardHome : boardAway;
    addWall(scene, a, b, BOARD_H, mat);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const fm = fenceMat.clone();
    fm.map = fenceTexture(); fm.map.repeat.set(len / 0.35, FENCE_H / 0.35);
    addWall(scene, a, b, FENCE_H, fm, BOARD_H, 0.02);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, FENCE_H + BOARD_H, 6), postMat);
    post.position.set(a[0], (FENCE_H + BOARD_H) / 2, a[1]);
    scene.add(post);
  }
  addGoal(scene, -PITCH_L / 2);
  addGoal(scene, PITCH_L / 2);

  scene.add(new THREE.HemisphereLight('#a9c4ff', '#262c3a', spotlights ? 0.55 : 0.95));
  const key = new THREE.DirectionalLight('#fff6e8', spotlights ? 1.6 : 2.3);
  key.position.set(6, 22, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(key.shadow.camera, { left: -12, right: 12, top: 16, bottom: -16, near: 1, far: 60 });
  key.shadow.bias = -0.0005;
  scene.add(key);
  for (const [x, z] of [[-11, -16], [11, -16], [-11, 16], [11, 16]]) addFloodlight(scene, x, z, spotlights);
  addSkyline(scene);
  const fans = addFans(scene, home.colors, away.colors, rand);

  return { scene, fans };
}

export function ballTexture() {
  return canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = '#f8f8f8'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#16181d';
    for (let i = 0; i < 10; i += 1) {
      const x = (i % 5) * 52 + (i < 5 ? 14 : 40);
      const y = i < 5 ? 34 : 92;
      g.beginPath();
      for (let k = 0; k < 5; k += 1) {
        const a = -Math.PI / 2 + (k * Math.PI * 2) / 5;
        g.lineTo(x + Math.cos(a) * 15, y + Math.sin(a) * 15);
      }
      g.closePath(); g.fill();
    }
  });
}
