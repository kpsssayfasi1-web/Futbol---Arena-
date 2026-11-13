// Deterministic arena physics, ported from the original Football Arena
// animation. Two equal balls (one per team) bounce inside a circular
// arena at constant speed; a single goal mouth rotates around the rim.
// A ball that leaves through the goal mouth scores for its own team.
//
// Both teams always get identical physics. The match result is chosen by
// the tournament model; the seed search picks a physics seed whose
// natural, unedited outcome equals that result.
//
// Units: arena radius = 1, time in seconds.

import { createRng } from '../../tournament/src/rng.js';

export const PHYSICS = Object.freeze({
  step: 1 / 240,
  playSeconds: 40,
  ballRadius: 0.095,
  baseSpeed: 0.95,
  lateSpeedBoost: 0.35,
  goalHalfAngle: 0.16,
  goalRotation: 0.7,
  celebrationSeconds: 1.5,
  kickoffOffset: { x: 0.32, y: 0.18 },
});

const TAU = Math.PI * 2;
const WALL_EPSILON = 0.0005;

function angleDiff(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function launch(ball, rng, speed) {
  const a = rng.next() * TAU;
  return { ...ball, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed };
}

function withSpeed(ball, speed) {
  const s = Math.hypot(ball.vx, ball.vy) || 1;
  return { ...ball, vx: (ball.vx / s) * speed, vy: (ball.vy / s) * speed };
}

function kickoffBall(team, rng, speed, p) {
  const side = team === 0 ? -1 : 1;
  const y = (rng.next() * 2 - 1) * p.kickoffOffset.y;
  return launch({ team, x: side * p.kickoffOffset.x, y, vx: 0, vy: 0 }, rng, speed);
}

export function speedAt(playTime, p = PHYSICS) {
  return p.baseSpeed * (1 + p.lateSpeedBoost * Math.min(1, playTime / p.playSeconds));
}

export function createMatch(seed, p = PHYSICS) {
  const rng = createRng(seed);
  const speed = speedAt(0, p);
  return {
    rng,
    p,
    time: 0,
    playTime: 0,
    angle: rng.next() * TAU,
    score: [0, 0],
    pause: 0,
    pendingRespawn: null,
    finished: false,
    balls: [kickoffBall(0, rng, speed, p), kickoffBall(1, rng, speed, p)],
    events: [],
  };
}

// Moves one ball; returns { ball, goal, bounce }.
function moveBall(ball, angle, dt, p) {
  const moved = { ...ball, x: ball.x + ball.vx * dt, y: ball.y + ball.vy * dt };
  const d = Math.hypot(moved.x, moved.y);
  const limit = 1 - p.ballRadius;
  if (d < limit) return { ball: moved, goal: false, bounce: false };

  const nx = moved.x / d;
  const ny = moved.y / d;
  const outward = moved.vx * nx + moved.vy * ny;
  const inMouth = Math.abs(angleDiff(Math.atan2(ny, nx), angle)) < p.goalHalfAngle;
  if (inMouth && outward > 0) return { ball: moved, goal: true, bounce: false };

  const vx = outward > 0 ? moved.vx - 2 * outward * nx : moved.vx;
  const vy = outward > 0 ? moved.vy - 2 * outward * ny : moved.vy;
  return {
    ball: { ...moved, x: nx * (limit - WALL_EPSILON), y: ny * (limit - WALL_EPSILON), vx, vy },
    goal: false,
    bounce: outward > 0,
  };
}

// Equal-mass elastic collision, then both balls keep their speed.
function collide(a, b, speed, p) {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let d = Math.hypot(dx, dy);
  const min = 2 * p.ballRadius;
  if (d >= min) return null;
  if (d < 1e-9) { dx = 1; dy = 0; d = 1; }
  const nx = dx / d;
  const ny = dy / d;
  const push = (min - d) / 2 + WALL_EPSILON;
  const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  const impulse = rel < 0 ? rel : 0;
  return [
    withSpeed({ ...a, x: a.x - nx * push, y: a.y - ny * push, vx: a.vx + impulse * nx, vy: a.vy + impulse * ny }, speed),
    withSpeed({ ...b, x: b.x + nx * push, y: b.y + ny * push, vx: b.vx - impulse * nx, vy: b.vy - impulse * ny }, speed),
  ];
}

function event(state, type, data = {}) {
  state.events.push({ type, t: state.time, playTime: state.playTime, ...data });
}

function resumeAfterGoal(state) {
  const team = state.pendingRespawn;
  const speed = speedAt(state.playTime, state.p);
  state.balls = state.balls.map((b) => (b.team === team ? kickoffBall(team, state.rng, speed, state.p) : withSpeed(b, speed)));
  state.pendingRespawn = null;
  event(state, 'restart', { team });
}

// Advances the simulation by one fixed step. Mutates `state` (a private,
// per-match object) for speed; inputs and outputs stay plain data.
export function step(state) {
  const { p } = state;
  const dt = p.step;
  state.time += dt;
  state.angle = (state.angle + p.goalRotation * dt) % TAU;

  if (state.pause > 0) {
    state.pause -= dt;
    if (state.pause <= 0) resumeAfterGoal(state);
    return state;
  }

  state.playTime += dt;
  if (state.playTime >= p.playSeconds) {
    state.finished = true;
    event(state, 'fulltime');
    return state;
  }

  const speed = speedAt(state.playTime, p);
  const moved = state.balls.map((b) => moveBall(withSpeed(b, speed), state.angle, dt, p));
  state.balls = moved.map((m) => m.ball);
  moved.forEach((m) => { if (m.bounce) event(state, 'bounce', { team: m.ball.team }); });

  const scorer = moved.find((m) => m.goal);
  if (scorer) {
    const team = scorer.ball.team;
    state.score = state.score.map((s, i) => (i === team ? s + 1 : s));
    state.pause = p.celebrationSeconds;
    state.pendingRespawn = team;
    event(state, 'goal', { team, score: [...state.score] });
    return state;
  }

  const hit = collide(state.balls[0], state.balls[1], speed, p);
  if (hit) {
    state.balls = hit;
    event(state, 'clash');
  }
  return state;
}

export function runToEnd(seed, p = PHYSICS) {
  const state = createMatch(seed, p);
  while (!state.finished) step(state);
  return { score: state.score, events: state.events, duration: state.time };
}

// Samples the match at `fps` for rendering: compact per-frame snapshots.
export function recordFrames(seed, fps, p = PHYSICS) {
  const state = createMatch(seed, p);
  const frames = [];
  const stepsPerFrame = Math.round(1 / fps / p.step);
  const snapshot = () => ({
    t: state.time,
    clock: Math.min(90, Math.floor((state.playTime / p.playSeconds) * 90)),
    angle: state.angle,
    score: [...state.score],
    celebrating: state.pause > 0 ? state.pendingRespawn : null,
    balls: state.balls.map((b) => ({ x: b.x, y: b.y })),
  });
  frames.push(snapshot());
  while (!state.finished) {
    for (let i = 0; i < stepsPerFrame && !state.finished; i += 1) step(state);
    frames.push(snapshot());
  }
  return { frames, events: state.events, score: state.score };
}
