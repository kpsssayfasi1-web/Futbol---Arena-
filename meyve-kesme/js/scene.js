// Renderer, camera, lights and the kitchen set (walnut board, concrete counter,
// warm out-of-focus wall).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mulberry32 } from './rng.js';
import { BOARD } from './cubes-data.js';
import { cameraView, cameraPose } from './camera.js';

export const BOARD_THICKNESS = 0.26;
const SHADOW_SOFTNESS = 3.5; // PCF radius in shadow-map texels
const CONTACT_OPACITY = 0.5;

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Value noise for the wood grain.
function makeNoise(seed) {
  const rand = mulberry32(seed);
  const N = 256;
  const table = new Float32Array(N * N).map(() => rand());
  const at = (x, y) => table[((y & (N - 1)) * N + (x & (N - 1)))];
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    let fx = x - xi;
    let fy = y - yi;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * fx;
    const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * fx;
    return a + (b - a) * fy;
  };
}

// Dark walnut: reddish brown with long, tight grain lines along the board.
function woodTexture() {
  const noise = makeNoise(11);
  return canvasTexture(1024, 1024, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const warp = noise(x * 0.003, y * 0.02) * 30 + noise(x * 0.015, y * 0.12) * 5;
        const line = Math.pow(0.5 + 0.5 * Math.sin((y + warp) * 0.55), 6); // thin dark grain lines
        const band = noise(x * 0.002, y * 0.05); // broad light/dark bands
        const fibre = noise(x * 0.6, y * 4) * 0.14;
        const k = 0.78 + band * 0.32 + fibre - line * 0.28;
        const i = (y * w + x) * 4;
        img.data[i] = Math.min(255, 132 * k);
        img.data[i + 1] = Math.min(255, 66 * k);
        img.data[i + 2] = Math.min(255, 38 * k);
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  });
}

// Light grey polished concrete with a few hairline cracks.
function stoneTexture() {
  const noise = makeNoise(3);
  const rand = mulberry32(17);
  return canvasTexture(1024, 1024, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n = noise(x * 0.01, y * 0.01) * 0.5 + noise(x * 0.06, y * 0.06) * 0.3 + noise(x * 0.5, y * 0.5) * 0.2;
        const v = 158 + n * 34;
        const i = (y * w + x) * 4;
        img.data[i] = v;
        img.data[i + 1] = v * 0.965;
        img.data[i + 2] = v * 0.93;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = 'rgba(70,60,52,0.35)';
    g.lineWidth = 1.4;
    for (let c = 0; c < 5; c++) {
      let x = rand() * w;
      let y = rand() * h;
      let a = rand() * Math.PI * 2;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 40; k++) {
        a += (rand() - 0.5) * 0.7;
        x += Math.cos(a) * 9;
        y += Math.sin(a) * 9;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  });
}

// Out-of-focus warm wall behind the counter: soft red-brown mottling only.
function wallTexture() {
  const noise = makeNoise(5);
  return canvasTexture(512, 512, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n = noise(x * 0.012, y * 0.012) * 0.6 + noise(x * 0.03, y * 0.03) * 0.4;
        const k = 0.75 + n * 0.45;
        const i = (y * w + x) * 4;
        img.data[i] = Math.min(255, 128 * k);
        img.data[i + 1] = Math.min(255, 52 * k);
        img.data[i + 2] = Math.min(255, 34 * k);
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  });
}

export function createStage(canvas, { shadowSize = 2048 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Neutral keeps hues and saturation (ACES pulls bright colours towards white).
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  // PCF with a radius gives the soft-edged, clearly visible shadows of the
  // reference videos (PCFSoftShadowMap ignores the radius).
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.autoClear = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x3c1a10);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.4; // low fill keeps the shadows dark
  scene.fog = new THREE.Fog(0x4a2115, 17, 34);

  const camera = new THREE.PerspectiveCamera(30, 9 / 16, 0.5, 60);

  const key = new THREE.DirectionalLight(0xffeedd, 3.2);
  key.position.set(-4.2, 7.0, 4.4);
  key.target.position.set(0, 0, 0.3);
  key.castShadow = true;
  key.shadow.mapSize.set(shadowSize, shadowSize);
  key.shadow.camera.left = -3.4;
  key.shadow.camera.right = 3.4;
  key.shadow.camera.top = 3.4;
  key.shadow.camera.bottom = -3.4;
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 18;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.015;
  key.shadow.radius = SHADOW_SOFTNESS;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xc9dcff, 1.3);
  rim.position.set(3.5, 3.2, -4.5);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xfff0e6, 0x5a3424, 0.45));

  // A long walnut plank running out of frame on both sides; the cube pile
  // stays within BOARD, the plank is just wider.
  const boardW = 11;
  const boardD = BOARD.maxZ - BOARD.minZ + 0.25;
  const wood = woodTexture();
  wood.wrapS = THREE.RepeatWrapping;
  wood.repeat.set(2.2, 1);
  const board = new THREE.Mesh(
    new RoundedBoxGeometry(boardW, BOARD_THICKNESS, boardD, 4, 0.05),
    new THREE.MeshStandardMaterial({ map: wood, roughness: 0.55 }),
  );
  board.position.set(0, -BOARD_THICKNESS / 2, (BOARD.minZ + BOARD.maxZ) / 2);
  board.receiveShadow = true;
  board.castShadow = true;
  scene.add(board);

  const stone = stoneTexture();
  stone.wrapS = stone.wrapT = THREE.RepeatWrapping;
  stone.repeat.set(3, 3);
  const counter = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshStandardMaterial({ map: stone, roughness: 0.62 }));
  counter.rotation.x = -Math.PI / 2;
  counter.position.set(0, -BOARD_THICKNESS, 0);
  counter.receiveShadow = true;
  scene.add(counter);

  const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), new THREE.MeshStandardMaterial({ map: wallTexture(), roughness: 0.9 }));
  wall.position.set(-2, 5, -7.5);
  wall.rotation.y = 0.32;
  wall.receiveShadow = true;
  scene.add(wall);

  const contact = contactShadow();
  scene.add(contact);

  return { renderer, scene, camera, key, contact };
}

// Soft darkening right under the item where it rests on the board (ambient
// occlusion the shadow map alone does not give). Unit size; placed per round.
function contactShadow() {
  const tex = canvasTexture(128, 128, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, 'rgba(0,0,0,1)');
    r.addColorStop(0.55, 'rgba(0,0,0,0.7)');
    r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, w, h);
  });
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: tex, color: 0x140904, transparent: true, opacity: CONTACT_OPACITY, depthWrite: false, toneMapped: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 1;
  return mesh;
}

// Fit the contact shadow to what still stands of the item: its bbox (board
// space, board top y = 0) behind the front-to-back clip plane.
export function placeContactShadow(contact, round, visible, clipZ = Infinity) {
  const { min, max } = round.bbox;
  const back = min[2];
  const front = Math.min(max[2], clipZ);
  contact.visible = visible && front > back + 0.05;
  if (!contact.visible) return;
  contact.position.set((min[0] + max[0]) / 2, 0.004, (back + front) / 2);
  contact.scale.set((max[0] - min[0]) * 1.12, (front - back) * 1.12, 1);
}

// Framing from the camera plan plus a small kick on every chop.
export function placeCamera(camera, t, shake, plan) {
  const { position, target } = cameraPose(cameraView(plan, t));
  camera.position.set(position[0], position[1] + shake, position[2]);
  camera.lookAt(target[0], target[1] + shake * 0.5, target[2]);
}
