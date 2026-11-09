// index.html içindeki fizik motorunun deterministik (kare tabanlı) karşılığı.
// Sabitler ve kurallar orijinal dosyayla aynıdır; tek fark rastgeleliğin seed'li olmasıdır.
//
// Not: Simülasyon durumu bilinçli olarak yerinde (mutable) güncellenir. Saniyede 120 fizik
// adımı ve yüzlerce parçacık için her adımda kopya üretmek gereksiz bellek baskısı yaratır.
// Durum dışarıya yalnızca bu modülün fonksiyonları üzerinden değiştirilir.
import {createRng, randRange, type Rng} from './random.ts';

export const PHYSICS_STEP = 1 / 120;
export const GOAL_HALF = 0.32;
export const TAU = Math.PI * 2;

const ROTATION_SPEED = 0.95;
const BALL_RADIUS = 9;
const TRAIL_LENGTH = 9;
const MAX_PARTICLES = 220;
const STAR_COUNT = 65;
const PARTICLE_DRAG = 2.4;

export type Team = 0 | 1;
export interface Point {x: number; y: number}
export interface Ball extends Point {
  team: Team;
  vx: number;
  vy: number;
  target: number;
  r: number;
  trail: Point[];
  spin: number;
}
export interface Particle extends Point {
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
}
export interface Star extends Point {r: number; a: number}
export interface Arena {width: number; height: number; cx: number; cy: number; radius: number}

export interface SimulationState {
  readonly arena: Arena;
  readonly stars: readonly Star[];
  readonly rng: Rng;
  stepCount: number;
  elapsed: number;
  angle: number;
  scoreA: number;
  scoreB: number;
  goalCount: number;
  balls: [Ball, Ball];
  particles: Particle[];
}

export interface SimulationOptions {width: number; height: number; seed: number}

const diffAngle = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export function computeArena(width: number, height: number): Arena {
  const radius = Math.max(58, Math.min(width * 0.375, height * 0.355, (Math.min(width, height) - 30) / 2));
  return {width, height, cx: width / 2, cy: height / 2, radius};
}

export const goalWidth = (arena: Arena) => 2 * arena.radius * Math.sin(GOAL_HALF);

function createBall(team: Team, x: number, y: number, vx: number, vy: number): Ball {
  return {team, x, y, vx, vy, target: Math.hypot(vx, vy), r: BALL_RADIUS, trail: [], spin: 0};
}

function createStars(rng: Rng, arena: Arena): Star[] {
  return Array.from({length: STAR_COUNT}, () => ({
    x: rng() * arena.width,
    y: rng() * arena.height,
    r: randRange(rng, 0.5, 1.5),
    a: randRange(rng, 0.12, 0.55),
  }));
}

export function createSimulation({width, height, seed}: SimulationOptions): SimulationState {
  const arena = computeArena(width, height);
  const rng = createRng(seed);
  const {cx, cy, radius: R} = arena;
  return {
    arena,
    rng,
    stars: createStars(rng, arena),
    stepCount: 0,
    elapsed: 0,
    angle: -Math.PI / 2,
    scoreA: 0,
    scoreB: 0,
    goalCount: 0,
    balls: [
      createBall(0, cx - R * 0.3, cy - R * 0.17, 220, 155),
      createBall(1, cx + R * 0.3, cy + R * 0.17, -205, -180),
    ],
    particles: [],
  };
}

function preserveSpeed(state: SimulationState, b: Ball) {
  const s = Math.hypot(b.vx, b.vy);
  if (s < 0.001) {
    const a = randRange(state.rng, 0, TAU);
    b.vx = Math.cos(a) * b.target;
    b.vy = Math.sin(a) * b.target;
  } else {
    b.vx = (b.vx / s) * b.target;
    b.vy = (b.vy / s) * b.target;
  }
}

function burst(state: SimulationState, x: number, y: number, color: string, n: number, power: number) {
  const {rng, particles} = state;
  for (let i = 0; i < n; i++) {
    const a = randRange(rng, 0, TAU);
    const s = randRange(rng, power * 0.25, power);
    particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: randRange(rng, 0.25, 0.65), max: 0.65, size: randRange(rng, 1, 3.5), color,
    });
  }
  if (particles.length > MAX_PARTICLES) particles.splice(0, particles.length - MAX_PARTICLES);
}

function scoreGoal(state: SimulationState, b: Ball) {
  const {cx, cy, radius: R} = state.arena;
  if (b.team === 0) state.scoreA++;
  else state.scoreB++;
  state.goalCount++;
  burst(state, b.x, b.y, b.team === 0 ? '#ffd14a' : '#52aaff', 35, 180);
  const side = b.team === 0 ? 1 : -1;
  b.x = cx + side * R * 0.27;
  b.y = cy + randRange(state.rng, -R * 0.16, R * 0.16);
  const a = randRange(state.rng, 0, TAU);
  b.vx = Math.cos(a) * b.target;
  b.vy = Math.sin(a) * b.target;
  b.trail.length = 0;
}

function stepBall(state: SimulationState, b: Ball, dt: number) {
  const {cx, cy, radius: R} = state.arena;
  b.spin += dt * 7;
  b.trail.push({x: b.x, y: b.y});
  if (b.trail.length > TRAIL_LENGTH) b.trail.shift();
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  const dx = b.x - cx;
  const dy = b.y - cy;
  const d = Math.hypot(dx, dy);
  const limit = R - b.r;
  if (d < limit) return;

  const nx = dx / (d || 1);
  const ny = dy / (d || 1);
  const outward = b.vx * nx + b.vy * ny;
  const within = Math.abs(diffAngle(Math.atan2(dy, dx), state.angle)) < GOAL_HALF;
  // Yalnızca kale açıklığından dışarı doğru geçen top gol olur.
  if (within && outward > 0) {
    scoreGoal(state, b);
    return;
  }
  if (outward > 0) {
    b.vx -= 2 * outward * nx;
    b.vy -= 2 * outward * ny;
  }
  b.x = cx + nx * (limit - 0.08);
  b.y = cy + ny * (limit - 0.08);
  preserveSpeed(state, b);
  burst(state, b.x, b.y, b.team === 0 ? '#ffbf42' : '#48a8ff', 4, 45);
}

function collideBalls(state: SimulationState) {
  const [a, b] = state.balls;
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let d = Math.hypot(dx, dy);
  const min = a.r + b.r;
  if (d >= min) return;
  if (d < 0.0001) {
    dx = 1; dy = 0; d = 1;
  }
  const nx = dx / d;
  const ny = dy / d;
  const push = (min - d) / 2 + 0.02;
  a.x -= nx * push; a.y -= ny * push;
  b.x += nx * push; b.y += ny * push;
  const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rel < 0) {
    // Eşit kütleli, ideal elastik çarpışma.
    a.vx += rel * nx; a.vy += rel * ny;
    b.vx -= rel * nx; b.vy -= rel * ny;
  }
  // İki top da çarpışmadan sonra hızını korur.
  preserveSpeed(state, a);
  preserveSpeed(state, b);
  burst(state, (a.x + b.x) / 2, (a.y + b.y) / 2, '#e7f2ff', 8, 65);
}

function stepParticles(state: SimulationState, dt: number) {
  const {particles} = state;
  const drag = Math.exp(-PARTICLE_DRAG * dt);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= drag;
    p.vy *= drag;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

export function stepSimulation(state: SimulationState, dt = PHYSICS_STEP) {
  state.stepCount++;
  state.elapsed += dt;
  state.angle = (state.angle + ROTATION_SPEED * dt) % TAU;
  for (const b of state.balls) stepBall(state, b, dt);
  collideBalls(state);
  stepParticles(state, dt);
}

/** Simülasyonu verilen adım sayısına kadar ilerletir. Geriye gidemez. */
export function advanceTo(state: SimulationState, targetStep: number) {
  if (!Number.isInteger(targetStep) || targetStep < state.stepCount) {
    throw new RangeError(`Geçersiz hedef adım: ${targetStep} (mevcut: ${state.stepCount})`);
  }
  while (state.stepCount < targetStep) stepSimulation(state);
}

/** Bir video karesinin karşılık geldiği fizik adımı (30 fps'te kare başına 4 adım). */
export const stepForFrame = (frame: number, fps: number) => Math.round((frame / fps) / PHYSICS_STEP);
