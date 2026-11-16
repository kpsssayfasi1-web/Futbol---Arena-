// Kitchen sets: the board, the counter it rests on, the wall behind and the
// light / fog tint that goes with them. Textures are built on first use.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BOARD } from './cubes-data.js';
import * as tex from './textures.js';

export const BOARD_THICKNESS = 0.26;

// tr/en: names in the UI. board.long: a plank running out of frame.
export const SETS = {
  classic: {
    tr: 'Klasik', en: 'Classic',
    background: 0x0c0d0c, fog: [0x0c0d0c, 16, 30], hemi: [0xdde8ff, 0x3a2b20, 0.5], env: 0.42,
    board: { map: tex.mapleWood, roughness: 0.6 },
    counter: { map: tex.darkStone, repeat: 4, roughness: 0.7 },
    wall: { map: () => tex.tiles(5, [40, 44, 41], [18, 21, 19]), repeat: [5, 4], roughness: 0.32, z: -5.2 },
  },
  walnut: {
    tr: 'Ceviz', en: 'Walnut',
    background: 0x3c1a10, fog: [0x4a2115, 17, 34], hemi: [0xfff0e6, 0x5a3424, 0.45], env: 0.4,
    board: { map: tex.walnutWood, roughness: 0.55, long: true },
    counter: { map: tex.lightConcrete, repeat: 3, roughness: 0.62 },
    wall: { map: () => tex.plaster(5, [128, 52, 34]), repeat: [1, 1], roughness: 0.9, z: -7.5 },
  },
  marble: {
    tr: 'Mermer', en: 'Marble',
    background: 0x9aa59c, fog: [0xa9b3aa, 18, 36], hemi: [0xf4f7ff, 0x8a8478, 0.55], env: 0.45,
    board: { map: tex.bambooWood, roughness: 0.5 },
    counter: { map: tex.whiteMarble, repeat: 2, roughness: 0.28 },
    wall: { map: () => tex.plaster(7, [150, 170, 152]), repeat: [1, 1], roughness: 0.9, z: -6.5 },
  },
  slate: {
    tr: 'Arduvaz', en: 'Slate',
    background: 0x0e1716, fog: [0x0e1716, 16, 30], hemi: [0xe3f0ff, 0x2a2018, 0.5], env: 0.42,
    board: { map: tex.slateBoard, roughness: 0.75 },
    counter: { map: tex.darkOakPlanks, repeat: 3, roughness: 0.6 },
    wall: { map: () => tex.tiles(9, [26, 70, 64], [10, 22, 20], 96, 96, 3), repeat: [6, 4], roughness: 0.25, z: -5.2 },
  },
};
export const SET_IDS = Object.keys(SETS);

const cache = new Map();
function texture(key, fn, repeat) {
  if (!cache.has(key)) cache.set(key, fn());
  const t = cache.get(key).clone();
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...(Array.isArray(repeat) ? repeat : [repeat, repeat]));
  }
  t.needsUpdate = true;
  return t;
}

// The board, counter and wall of one set as a group; lighting tints are
// applied to the scene and hemisphere light passed in.
export function buildSet(id, scene, hemi) {
  if (!SETS[id]) id = 'classic';
  const s = SETS[id];
  scene.background = new THREE.Color(s.background);
  scene.fog = new THREE.Fog(...s.fog);
  scene.environmentIntensity = s.env;
  hemi.color.setHex(s.hemi[0]);
  hemi.groundColor.setHex(s.hemi[1]);
  hemi.intensity = s.hemi[2];

  const group = new THREE.Group();
  const boardW = s.board.long ? 11 : BOARD.maxX - BOARD.minX + 0.25;
  const boardD = BOARD.maxZ - BOARD.minZ + 0.25;
  const board = new THREE.Mesh(
    new RoundedBoxGeometry(boardW, BOARD_THICKNESS, boardD, 4, s.board.long ? 0.05 : 0.07),
    new THREE.MeshStandardMaterial({ map: texture(`${id}:board`, s.board.map, s.board.long ? [2.2, 1] : null), roughness: s.board.roughness }),
  );
  board.position.set(s.board.long ? 0 : (BOARD.minX + BOARD.maxX) / 2, -BOARD_THICKNESS / 2, (BOARD.minZ + BOARD.maxZ) / 2);
  board.receiveShadow = true;
  board.castShadow = true;

  const counter = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshStandardMaterial({ map: texture(`${id}:counter`, s.counter.map, s.counter.repeat), roughness: s.counter.roughness }));
  counter.rotation.x = -Math.PI / 2;
  counter.position.set(0, -BOARD_THICKNESS, 0);
  counter.receiveShadow = true;

  const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), new THREE.MeshStandardMaterial({ map: texture(`${id}:wall`, s.wall.map, s.wall.repeat), roughness: s.wall.roughness }));
  wall.position.set(-2, 5, s.wall.z);
  wall.rotation.y = 0.32;
  wall.receiveShadow = true;

  group.add(board, counter, wall);
  return group;
}

export function disposeSet(group) {
  group.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.dispose();
    o.material.map?.dispose();
    o.material.dispose();
  });
}
