// 3v3 street football match engine (no goalkeepers). Deterministic for a
// given seed. Both teams share identical physics and AI parameters.

import { createRng } from '../../../tournament/src/rng.js';
import { PITCH, collideBallWithCage, clampPlayer, goalScored } from './pitch.js';
import { AI, assignRoles, targetFor, chooseKick } from './ai.js';

export const ENGINE = Object.freeze({
  step: 1 / 120,
  playSeconds: 50,
  decisionInterval: 0.1,
  celebrationSeconds: 2.2,
  playerRadius: 0.45,
  playerMaxSpeed: 5.6,
  playerAccel: 16,
  ballRadius: 0.24,
  ballFriction: 0.55,
  wallRestitution: 0.82,
  bodyRestitution: 0.45,
  gravity: 22,
});

// Formation per team: relative to own half (y as fraction of half-length).
const FORMATION = [{ x: 0, y: 0.18 }, { x: -3.2, y: 0.5 }, { x: 3.2, y: 0.5 }];

function formationSpot(team, index) {
  const sign = team === 0 ? 1 : -1;
  const f = FORMATION[index];
  return { x: f.x * sign, y: sign * f.y * (PITCH.length / 2) };
}

function kickoffPositions(state, kickingTeam) {
  state.players.forEach((p) => {
    const spot = formationSpot(p.team, p.index);
    p.x = spot.x; p.y = spot.y; p.vx = 0; p.vy = 0; p.kickTimer = 0; p.cooldown = 0.3;
  });
  // The kicking team's first player starts just behind the ball.
  const taker = state.players.find((p) => p.team === kickingTeam && p.index === 0);
  taker.y = (kickingTeam === 0 ? 1 : -1) * (taker.r + state.ball.r + 0.15);
  Object.assign(state.ball, { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 });
}

export function createMatch(seed, cfg = ENGINE) {
  const rng = createRng(seed);
  const players = [0, 1].flatMap((team) => [0, 1, 2].map((index) => ({
    id: team * 3 + index, team, index, r: cfg.playerRadius,
    x: 0, y: 0, vx: 0, vy: 0, facing: team === 0 ? -Math.PI / 2 : Math.PI / 2,
    target: { x: 0, y: 0 }, role: 'support', kickTimer: 0, cooldown: 0,
  })));
  const state = {
    rng, cfg, time: 0, playTime: 0, decisionClock: 0,
    score: [0, 0], pause: 0, celebration: null, finished: false,
    ball: { r: cfg.ballRadius, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 },
    players, touches: [], events: [], scorers: [],
  };
  kickoffPositions(state, rng.next() < 0.5 ? 0 : 1);
  return state;
}

function event(state, type, data = {}) {
  state.events.push({ type, t: state.time, playTime: state.playTime, ...data });
}

function touch(state, player, kind) {
  state.touches.push({ id: player.id, team: player.team, kind, t: state.time });
  if (state.touches.length > 6) state.touches.shift();
}

function decide(state) {
  for (const team of [0, 1]) {
    const roles = assignRoles(state.players, state.ball, team);
    for (const [role, player] of Object.entries(roles)) {
      player.role = role;
      player.target = targetFor(player, role, state.ball, state.players);
    }
  }
}

function movePlayers(state, dt) {
  const { playerAccel, playerMaxSpeed } = state.cfg;
  for (const p of state.players) {
    const dx = p.target.x - p.x;
    const dy = p.target.y - p.y;
    const d = Math.hypot(dx, dy);
    const desired = Math.min(playerMaxSpeed, d * 3);
    const wantVx = d > 1e-6 ? (dx / d) * desired : 0;
    const wantVy = d > 1e-6 ? (dy / d) * desired : 0;
    const ax = wantVx - p.vx;
    const ay = wantVy - p.vy;
    const a = Math.hypot(ax, ay);
    const k = a > playerAccel * dt ? (playerAccel * dt) / a : 1;
    p.vx += ax * k; p.vy += ay * k;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (Math.hypot(p.vx, p.vy) > 0.4) p.facing = Math.atan2(p.vy, p.vx);
    p.kickTimer = Math.max(0, p.kickTimer - dt);
    p.cooldown = Math.max(0, p.cooldown - dt);
    clampPlayer(p);
  }
  // Players bump each other apart.
  for (let i = 0; i < state.players.length; i += 1) {
    for (let j = i + 1; j < state.players.length; j += 1) {
      const a = state.players[i];
      const b = state.players[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1e-6;
      const min = a.r + b.r;
      if (d < min) {
        const push = (min - d) / 2;
        a.x -= (dx / d) * push; a.y -= (dy / d) * push;
        b.x += (dx / d) * push; b.y += (dy / d) * push;
      }
    }
  }
}

function tryKicks(state) {
  const { ball } = state;
  for (const p of state.players) {
    if (p.role !== 'presser' || p.cooldown > 0) continue;
    if (Math.hypot(ball.x - p.x, ball.y - p.y) > p.r + ball.r + AI.kickReach || ball.z > 0.6) continue;
    const kick = chooseKick(p, ball, state.players, state.rng);
    ball.vx = kick.vx; ball.vy = kick.vy;
    ball.vz = kick.kind === 'shot' ? 3 + state.rng.next() * 3 : kick.kind === 'pass' ? 1.2 : 0;
    p.cooldown = AI.kickCooldown;
    p.kickTimer = 0.25;
    p.facing = Math.atan2(kick.vy, kick.vx);
    touch(state, p, kick.kind);
    event(state, 'kick', { kind: kick.kind, player: p.id, team: p.team });
    return;
  }
}

function deflectOffPlayers(state) {
  const { ball, cfg } = state;
  for (const p of state.players) {
    const dx = ball.x - p.x;
    const dy = ball.y - p.y;
    const d = Math.hypot(dx, dy);
    const min = p.r + ball.r;
    if (d >= min || d < 1e-9 || ball.z > 0.9) continue;
    const nx = dx / d;
    const ny = dy / d;
    ball.x = p.x + nx * min; ball.y = p.y + ny * min;
    const rel = (ball.vx - p.vx) * nx + (ball.vy - p.vy) * ny;
    if (rel < 0) {
      ball.vx -= (1 + cfg.bodyRestitution) * rel * nx;
      ball.vy -= (1 + cfg.bodyRestitution) * rel * ny;
      const last = state.touches[state.touches.length - 1];
      if (Math.hypot(ball.vx, ball.vy) > 6 && last && last.team !== p.team && last.kind === 'shot') {
        event(state, 'block', { player: p.id, team: p.team });
      }
      touch(state, p, 'deflect');
    }
  }
}

function moveBall(state, dt) {
  const { ball, cfg } = state;
  const speed = Math.hypot(ball.vx, ball.vy);
  const decay = Math.exp(-cfg.ballFriction * dt * (ball.z > 0 ? 0.3 : 1));
  ball.vx *= decay; ball.vy *= decay;
  if (speed < 0.05) { ball.vx = 0; ball.vy = 0; }
  ball.x += ball.vx * dt; ball.y += ball.vy * dt;
  ball.vz -= cfg.gravity * dt;
  ball.z += ball.vz * dt;
  if (ball.z < 0) { ball.z = 0; ball.vz = ball.vz < -2 ? -ball.vz * 0.45 : 0; }
  const hit = collideBallWithCage(ball, cfg.wallRestitution);
  if (hit === 'post') event(state, 'post');
  else if (hit === 'wall' && speed > 3) event(state, 'wall', { speed });
}

// Football's rule of thumb: a shot deflected in off a defender counts for
// the shooter; anything else last touched by a defender is an own goal.
const DEFLECTION_CREDIT_SECONDS = 1.5;

function creditGoal(state, team) {
  const touches = state.touches;
  const last = touches[touches.length - 1] ?? null;
  const shooter = [...touches].reverse()
    .find((t) => t.team === team && t.kind === 'shot' && state.time - t.t < DEFLECTION_CREDIT_SECONDS);
  const deflectedIn = last !== null && last.team !== team && last.kind === 'deflect' && shooter;
  const ownGoal = last !== null && last.team !== team && !deflectedIn;
  const scorer = deflectedIn ? shooter.id : last ? last.id : null;
  const assistTouch = [...touches].reverse()
    .find((t) => t.team === team && t.id !== scorer && t.kind === 'pass');
  state.score = state.score.map((s, i) => (i === team ? s + 1 : s));
  const goal = { team, scorer, ownGoal, assist: ownGoal ? null : assistTouch?.id ?? null, playTime: state.playTime };
  state.scorers.push(goal);
  state.celebration = goal;
  state.pause = state.cfg.celebrationSeconds;
  event(state, 'goal', { ...goal, score: [...state.score] });
}

// Advances one fixed step. Mutates the private match state for speed.
export function step(state) {
  const { cfg } = state;
  const dt = cfg.step;
  state.time += dt;

  if (state.pause > 0) {
    state.pause -= dt;
    moveBall(state, dt);
    if (state.pause <= 0) {
      kickoffPositions(state, 1 - state.celebration.team);
      state.celebration = null;
      touch(state, state.players[0], 'restart');
      state.touches.length = 0;
      event(state, 'restart');
    }
    return state;
  }

  state.playTime += dt;
  if (state.playTime >= cfg.playSeconds) {
    state.finished = true;
    event(state, 'fulltime');
    return state;
  }

  state.decisionClock -= dt;
  if (state.decisionClock <= 0) {
    decide(state);
    state.decisionClock = cfg.decisionInterval;
  }
  movePlayers(state, dt);
  tryKicks(state);
  deflectOffPlayers(state);
  moveBall(state, dt);

  const scoringTeam = goalScored(state.ball);
  if (scoringTeam !== null) creditGoal(state, scoringTeam);
  return state;
}

export function runToEnd(seed, cfg = ENGINE) {
  const state = createMatch(seed, cfg);
  while (!state.finished) step(state);
  return { score: state.score, scorers: state.scorers, events: state.events, duration: state.time };
}

const round = (v) => Math.round(v * 1000) / 1000;

// Per-frame snapshots for the renderer.
export function recordFrames(seed, fps, cfg = ENGINE) {
  const state = createMatch(seed, cfg);
  const stepsPerFrame = Math.round(1 / fps / cfg.step);
  const frames = [];
  const snapshot = () => ({
    t: round(state.time),
    clock: Math.min(90, Math.floor((state.playTime / cfg.playSeconds) * 90)),
    score: [...state.score],
    celebration: state.celebration,
    ball: { x: round(state.ball.x), y: round(state.ball.y), z: round(state.ball.z) },
    players: state.players.map((p) => ({
      x: round(p.x), y: round(p.y), facing: round(p.facing),
      speed: round(Math.hypot(p.vx, p.vy)), kick: round(p.kickTimer),
    })),
  });
  frames.push(snapshot());
  while (!state.finished) {
    for (let i = 0; i < stepsPerFrame && !state.finished; i += 1) step(state);
    frames.push(snapshot());
  }
  return { frames, events: state.events, score: state.score, scorers: state.scorers };
}
