// Renderer, camera, lights and the kitchen set (board, counter, tiled wall).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mulberry32 } from './rng.js';
import { BOARD } from './cubes-data.js';
import { cameraView, cameraPose } from './camera.js';

export const BOARD_THICKNESS = 0.26;

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

function woodTexture() {
  const noise = makeNoise(11);
  return canvasTexture(1024, 1024, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const warp = noise(x * 0.004, y * 0.03) * 26 + noise(x * 0.02, y * 0.2) * 4;
        const ring = 0.5 + 0.5 * Math.sin((y + warp) * 0.23);
        const fine = noise(x * 0.5, y * 3) * 0.12;
        const k = 0.86 + ring * 0.1 + fine - noise(x * 0.01, y * 0.01) * 0.08;
        const i = (y * w + x) * 4;
        img.data[i] = Math.min(255, 222 * k);
        img.data[i + 1] = Math.min(255, 176 * k);
        img.data[i + 2] = Math.min(255, 118 * k);
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  });
}

function tileTexture() {
  const rand = mulberry32(5);
  return canvasTexture(1024, 1024, (g, w, h) => {
    g.fillStyle = '#121513';
    g.fillRect(0, 0, w, h);
    const tw = 128;
    const th = 64;
    for (let row = 0; row < h / th; row++) {
      for (let col = -1; col < w / tw + 1; col++) {
        const x = col * tw + (row % 2) * (tw / 2);
        const y = row * th;
        const v = 34 + rand() * 14;
        const grad = g.createLinearGradient(x, y, x, y + th);
        grad.addColorStop(0, `rgb(${v + 6},${v + 10},${v + 7})`);
        grad.addColorStop(1, `rgb(${v - 6},${v - 3},${v - 5})`);
        g.fillStyle = grad;
        g.fillRect(x + 4, y + 4, tw - 8, th - 8);
      }
    }
  });
}

function stoneTexture() {
  const noise = makeNoise(3);
  return canvasTexture(512, 512, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n = noise(x * 0.05, y * 0.05) * 0.5 + noise(x * 0.3, y * 0.3) * 0.3 + noise(x, y) * 0.2;
        const v = 22 + n * 18;
        const i = (y * w + x) * 4;
        img.data[i] = v;
        img.data[i + 1] = v * 0.97;
        img.data[i + 2] = v * 0.93;
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
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.autoClear = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c0d0c);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.42;
  scene.fog = new THREE.Fog(0x0c0d0c, 16, 30);

  const camera = new THREE.PerspectiveCamera(30, 9 / 16, 0.5, 60);

  const key = new THREE.DirectionalLight(0xfff1e2, 3.1);
  key.position.set(-3.6, 7.5, 4.2);
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
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xc9dcff, 1.3);
  rim.position.set(3.5, 3.2, -4.5);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xdde8ff, 0x3a2b20, 0.5));

  const boardW = BOARD.maxX - BOARD.minX + 0.25;
  const boardD = BOARD.maxZ - BOARD.minZ + 0.25;
  const board = new THREE.Mesh(
    new RoundedBoxGeometry(boardW, BOARD_THICKNESS, boardD, 4, 0.07),
    new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.6 }),
  );
  board.position.set((BOARD.minX + BOARD.maxX) / 2, -BOARD_THICKNESS / 2, (BOARD.minZ + BOARD.maxZ) / 2);
  board.receiveShadow = true;
  board.castShadow = true;
  scene.add(board);

  const stone = stoneTexture();
  stone.wrapS = stone.wrapT = THREE.RepeatWrapping;
  stone.repeat.set(4, 4);
  const counter = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshStandardMaterial({ map: stone, roughness: 0.7 }));
  counter.rotation.x = -Math.PI / 2;
  counter.position.set(0, -BOARD_THICKNESS, 0);
  counter.receiveShadow = true;
  scene.add(counter);

  const tiles = tileTexture();
  tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping;
  tiles.repeat.set(5, 4);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(26, 14), new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.32 }));
  wall.position.set(-2, 5, -5.2);
  wall.rotation.y = 0.32;
  wall.receiveShadow = true;
  scene.add(wall);

  return { renderer, scene, camera, key };
}

// Framing from the camera plan plus a small kick on every chop.
export function placeCamera(camera, t, shake, plan) {
  const { position, target } = cameraPose(cameraView(plan, t));
  camera.position.set(position[0], position[1] + shake, position[2]);
  camera.lookAt(target[0], target[1] + shake * 0.5, target[2]);
}
