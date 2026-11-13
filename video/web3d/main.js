// Frame driver for the 3D street-football Short. make-short3d.js calls
// setup(payload) once, then renderFrame(i) in order and frameData().

import * as THREE from '/video/node_modules/three/build/three.module.js';
import { createRng } from '/tournament/src/rng.js';
import { buildScene, ballTexture } from './scene.js';
import { createPlayer, posePlayer, celebrate, kitFor } from './players.js';
import {
  W, H, createHud, drawHeader, drawScoreboard, drawNameTag, drawFooter,
  drawGoalBanner, drawIntro, drawFullTime, drawOutro, drawVignette,
} from './hud.js';

// Broadcast-style follow camera: fixed offset from the look point, which
// tracks the ball (clamped so the frame never leaves the cage).
const CAM = {
  offset: [0, 28, 25], fov: 30, goalFov: 20,
  lookX: [-3, 3], lookZ: [-8.5, 7], followX: 0.55, followZ: 0.75, ease: 0.07,
};
const CAMERA_OFFSET = new THREE.Vector3(...CAM.offset);
const BASE_LOOK = new THREE.Vector3(0, 0, 0);
const BALL_R = 0.22;

const out = document.getElementById('c');
const ctx = out.getContext('2d');
let P = null;
let hud = null;
let renderer = null;
let camera = null;
let world = null;
let ball = null;
let players = [];
const look = BASE_LOOK.clone();

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

window.setup = async (payload) => {
  P = payload;
  if (P.camera) Object.assign(CAM, P.camera);
  CAMERA_OFFSET.set(...CAM.offset);
  await Promise.all([
    document.fonts.load('900 40px Inter'), document.fonts.load('800 40px Inter'),
    document.fonts.load("40px 'Noto Color Emoji'"),
  ]);
  const flags = {};
  for (const iso of [P.context.home.iso2, P.context.away.iso2]) {
    flags[iso] = await loadImage(`/video/node_modules/flag-icons/flags/1x1/${iso}.svg`);
  }
  hud = createHud(ctx, flags);

  const q = { antialias: true, shadows: true, shadowSize: 2048, spotlights: true, renderScale: 1, width: W, height: H, ...(P.quality ?? {}) };
  // The HUD is laid out on a 1080x1920 grid and scaled to the output size.
  out.width = q.width; out.height = q.height;
  ctx.setTransform(q.width / W, 0, 0, q.height / H, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  renderer = new THREE.WebGLRenderer({ antialias: q.antialias, preserveDrawingBuffer: true });
  renderer.setSize(Math.round(q.width * q.renderScale), Math.round(q.height * q.renderScale), false);
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = q.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const rng = createRng(`scene:${P.seed}`);
  world = buildScene({ home: P.context.home, away: P.context.away, rand: () => rng.next(), label: P.context.tournamentName.toUpperCase(), shadowSize: q.shadowSize, spotlights: q.spotlights });
  camera = new THREE.PerspectiveCamera(CAM.fov, W / H, 0.1, 200);
  camera.position.copy(BASE_LOOK).add(CAMERA_OFFSET);

  ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 24, 16), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.45 }));
  ball.castShadow = true;
  world.scene.add(ball);

  players = P.players.map((info, id) => {
    const team = id < 3 ? P.context.home : P.context.away;
    const p = createPlayer({ kit: kitFor(team.colors), number: info.number, seed: id * 3 + P.seedNumber });
    world.scene.add(p.root);
    return p;
  });
  return true;
};

function placeBall(snap, prev, dt) {
  ball.position.set(snap.ball.x, BALL_R + snap.ball.z, snap.ball.y);
  if (!prev) return;
  const dx = snap.ball.x - prev.ball.x;
  const dz = snap.ball.y - prev.ball.y;
  const d = Math.hypot(dx, dz);
  if (d > 1e-4 && d < 3) {
    const axis = new THREE.Vector3(dz, 0, -dx).normalize();
    ball.rotateOnWorldAxis(axis, d / BALL_R);
  }
}

function aimCamera(snap, celebrateT) {
  const clampTo = (v, [lo, hi]) => Math.max(lo, Math.min(hi, v));
  const target = new THREE.Vector3(clampTo(snap.ball.x * CAM.followX, CAM.lookX), 0, clampTo(snap.ball.y * CAM.followZ, CAM.lookZ));
  let fov = CAM.fov;
  if (snap.celebration && snap.celebration.scorer !== null) {
    const s = snap.players[snap.celebration.scorer];
    const k = Math.min(1, celebrateT / 0.6);
    target.lerp(new THREE.Vector3(s.x, 0.8, s.y), k * 0.7);
    fov = CAM.fov + (CAM.goalFov - CAM.fov) * k;
  }
  look.lerp(target, CAM.ease);
  camera.fov += (fov - camera.fov) * 0.1;
  camera.updateProjectionMatrix();
  camera.position.copy(look).add(CAMERA_OFFSET);
  camera.lookAt(look);
}

function drawWorld(snap, prev, celebrateT, draw = true) {
  const dt = 1 / P.fps;
  snap.players.forEach((s, i) => {
    const celebrating = snap.celebration && snap.celebration.team === (i < 3 ? 0 : 1);
    if (celebrating) { players[i].root.position.set(s.x, 0, s.y); celebrate(players[i], celebrateT + i * 0.1); }
    else posePlayer(players[i], s, dt);
  });
  placeBall(snap, prev, dt);
  world.fans.forEach((f, i) => {
    const cheering = snap.celebration && (f.position.x < 0 ? 0 : 1) === snap.celebration.team;
    f.position.y = Math.abs(Math.sin(snap.t * (cheering ? 9 : 1.5) + f.userData.offset)) * (cheering ? 0.4 : 0.05);
  });
  aimCamera(snap, celebrateT);
  if (!draw) return;
  renderer.render(world.scene, camera);
  ctx.drawImage(renderer.domElement, 0, 0, W, H);
  drawVignette(hud);
}

function nameTags(snap) {
  const v = new THREE.Vector3();
  const order = snap.players.map((s, i) => ({ s, i })).sort((a, b) => a.s.y - b.s.y);
  for (const { s, i } of order) {
    v.set(s.x, 2.25, s.y).project(camera);
    const team = i < 3 ? P.context.home : P.context.away;
    const isScorer = snap.celebration && snap.celebration.scorer === i;
    drawNameTag(hud, (v.x + 1) / 2 * W, (1 - v.y) / 2 * H, P.players[i], team, isScorer);
  }
}

// draw=false advances animation state (ball spin, camera easing, run
// cycles) without rendering, so any frame range can be reached quickly.
window.renderFrame = (i, draw = true) => {
  const { intro, match, fulltime } = P.timeline;
  const frames = P.frames;
  if (!draw) {
    const m = Math.min(Math.max(i - intro, 0), match - 1);
    drawWorld(frames[m], m > 0 ? frames[m - 1] : null, P.celebrationAge[m], false);
    return;
  }
  if (i < intro) {
    drawWorld(frames[0], null, 0);
    drawHeader(hud, P);
    drawScoreboard(hud, P, frames[0]);
    drawIntro(hud, P, i / P.fps);
    return;
  }
  const m = i - intro;
  if (m < match) {
    const snap = frames[m];
    const age = P.celebrationAge[m];
    drawWorld(snap, frames[m - 1], age);
    nameTags(snap);
    drawHeader(hud, P);
    drawScoreboard(hud, P, snap, snap.celebration ? snap.celebration.team : null, age);
    if (snap.celebration) drawGoalBanner(hud, P, snap.celebration, age);
    else drawFooter(hud, P);
    return;
  }
  const last = frames[frames.length - 1];
  const f = m - match;
  drawWorld(last, null, 0);
  if (f < fulltime) {
    drawHeader(hud, P);
    drawScoreboard(hud, P, last);
    drawFullTime(hud, last, f / P.fps);
  } else {
    drawHeader(hud, P);
    drawOutro(hud, P, last, (f - fulltime) / P.fps);
  }
};

window.frameData = (quality) => out.toDataURL('image/jpeg', quality);
