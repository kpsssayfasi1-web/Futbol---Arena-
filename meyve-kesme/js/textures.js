// Procedural canvas textures for the kitchen sets: value noise and a per-pixel
// painter, plus the wood, stone, tile and plaster patterns built from them.
import * as THREE from 'three';
import { mulberry32 } from './rng.js';

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Smooth value noise in [0, 1].
export function makeNoise(seed) {
  const rand = mulberry32(seed);
  const N = 256;
  const table = new Float32Array(N * N).map(() => rand());
  const at = (x, y) => table[(y & (N - 1)) * N + (x & (N - 1))];
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

// Paints every pixel with colour(x, y) -> [r, g, b] (0-255).
function pixels(size, colour, after) {
  return canvasTexture(size, size, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const [r, gg, b] = colour(x, y);
        const i = (y * w + x) * 4;
        img.data[i] = Math.min(255, r);
        img.data[i + 1] = Math.min(255, gg);
        img.data[i + 2] = Math.min(255, b);
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    after?.(g, w, h);
  });
}

const tint = (rgb, k) => [rgb[0] * k, rgb[1] * k, rgb[2] * k];

// Light maple: soft growth rings.
export function mapleWood() {
  const noise = makeNoise(11);
  return pixels(1024, (x, y) => {
    const warp = noise(x * 0.004, y * 0.03) * 26 + noise(x * 0.02, y * 0.2) * 4;
    const ring = 0.5 + 0.5 * Math.sin((y + warp) * 0.23);
    const fine = noise(x * 0.5, y * 3) * 0.12;
    return tint([222, 176, 118], 0.86 + ring * 0.1 + fine - noise(x * 0.01, y * 0.01) * 0.08);
  });
}

// Dark walnut: reddish brown with long, tight grain lines.
export function walnutWood() {
  const noise = makeNoise(11);
  return pixels(1024, (x, y) => {
    const warp = noise(x * 0.003, y * 0.02) * 30 + noise(x * 0.015, y * 0.12) * 5;
    const line = Math.pow(0.5 + 0.5 * Math.sin((y + warp) * 0.55), 6);
    const band = noise(x * 0.002, y * 0.05);
    const fibre = noise(x * 0.6, y * 4) * 0.14;
    return tint([132, 66, 38], 0.78 + band * 0.32 + fibre - line * 0.28);
  });
}

// End-grain style bamboo: pale strips with darker joints between them.
export function bambooWood() {
  const noise = makeNoise(21);
  return pixels(1024, (x, y) => {
    const strip = y % 64;
    const joint = strip < 2 || strip > 61 ? 0.82 : 1;
    const shade = 0.92 + noise(3.7, Math.floor(y / 64) * 1.3) * 0.12;
    const fibre = noise(x * 0.3, y * 2.5) * 0.08 + noise(x * 0.02, y * 0.4) * 0.05;
    const knot = ((x + Math.floor(y / 64) * 197) % 340) - 170;
    const node = Math.exp(-(knot * knot) / 30) * 0.12;
    return tint([228, 196, 140], joint * shade * (0.95 + fibre) - node);
  });
}

// Slate serving board: cool dark grey stone with faint layering.
export function slateBoard() {
  const noise = makeNoise(31);
  return pixels(1024, (x, y) => {
    const layer = noise(x * 0.002, y * 0.03) * 0.5 + noise(x * 0.01, y * 0.08) * 0.3;
    const grain = noise(x * 0.4, y * 0.4) * 0.12;
    return tint([62, 66, 72], 0.82 + layer * 0.35 + grain);
  });
}

// Dark stone counter.
export function darkStone() {
  const noise = makeNoise(3);
  return pixels(512, (x, y) => {
    const v = 22 + (noise(x * 0.05, y * 0.05) * 0.5 + noise(x * 0.3, y * 0.3) * 0.3 + noise(x, y) * 0.2) * 18;
    return [v, v * 0.97, v * 0.93];
  });
}

// Light grey polished concrete with a few hairline cracks.
export function lightConcrete() {
  const noise = makeNoise(3);
  const rand = mulberry32(17);
  return pixels(1024, (x, y) => {
    const v = 158 + (noise(x * 0.01, y * 0.01) * 0.5 + noise(x * 0.06, y * 0.06) * 0.3 + noise(x * 0.5, y * 0.5) * 0.2) * 34;
    return [v, v * 0.965, v * 0.93];
  }, (g, w, h) => cracks(g, w, h, rand, 'rgba(70,60,52,0.35)', 5));
}

// White marble with soft grey veins.
export function whiteMarble() {
  const noise = makeNoise(41);
  return pixels(1024, (x, y) => {
    const turb = noise(x * 0.005, y * 0.005) * 5 + noise(x * 0.02, y * 0.02) * 1.5;
    const vein = Math.pow(1 - Math.abs(Math.sin((x * 0.003 + y * 0.0015) * 5 + turb)), 7);
    const fine = Math.pow(1 - Math.abs(Math.sin((x * 0.006 - y * 0.004) * 7 + turb * 1.7)), 12);
    const cloud = noise(x * 0.008, y * 0.008) * 0.05;
    const k = 0.95 + cloud - vein * 0.13 - fine * 0.06;
    return [236 * k, 235 * k, 233 * k];
  });
}

// Old dark oak table: wide planks with seams.
export function darkOakPlanks() {
  const noise = makeNoise(51);
  return pixels(1024, (x, y) => {
    const plank = Math.floor(y / 170);
    const seam = y % 170 < 3 ? 0.45 : 1;
    const warp = noise(x * 0.003, y * 0.03 + plank * 5) * 22;
    const ring = 0.5 + 0.5 * Math.sin((y + warp) * 0.3);
    const fibre = noise(x * 0.5, y * 3) * 0.1;
    return tint([86, 58, 38], seam * (0.8 + ring * 0.12 + fibre + noise(plank * 2.1, 0.5) * 0.15));
  });
}

// Running-bond tiles: base rgb, grout rgb, tile size in px.
export function tiles(seed, base, grout, tw = 128, th = 64, gap = 4) {
  const rand = mulberry32(seed);
  return canvasTexture(1024, 1024, (g, w, h) => {
    g.fillStyle = `rgb(${grout.join(',')})`;
    g.fillRect(0, 0, w, h);
    for (let row = 0; row < h / th; row++) {
      for (let col = -1; col < w / tw + 1; col++) {
        const x = col * tw + (row % 2) * (tw / 2);
        const y = row * th;
        const k = 0.9 + rand() * 0.2;
        const grad = g.createLinearGradient(x, y, x, y + th);
        grad.addColorStop(0, `rgb(${base.map((c) => Math.round(c * k * 1.12)).join(',')})`);
        grad.addColorStop(1, `rgb(${base.map((c) => Math.round(c * k * 0.9)).join(',')})`);
        g.fillStyle = grad;
        g.fillRect(x + gap, y + gap, tw - gap * 2, th - gap * 2);
      }
    }
  });
}

// Out-of-focus plaster wall: soft mottling around one colour.
export function plaster(seed, rgb) {
  const noise = makeNoise(seed);
  return pixels(512, (x, y) => tint(rgb, 0.75 + (noise(x * 0.012, y * 0.012) * 0.6 + noise(x * 0.03, y * 0.03) * 0.4) * 0.45));
}

function cracks(g, w, h, rand, colour, count) {
  g.strokeStyle = colour;
  g.lineWidth = 1.4;
  for (let c = 0; c < count; c++) {
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
}
