// Player decision-making. Both teams use exactly the same logic and
// numbers; only the physics seed differs between matches.
//
// Each team, every decision tick:
//   presser - teammate nearest the ball: runs at it and kicks
//   cover   - of the other two, the one nearer its own goal: guards the goal
//   support - the remaining player: finds space up the pitch for a pass

import { PITCH, attackDirection, goalCenter, ownGoalCenter } from './pitch.js';

export const AI = Object.freeze({
  shootRange: 11,
  shotSpeed: 17,
  shotSpread: 0.09,
  passSpeedMin: 7,
  passSpeedMax: 12,
  passSpread: 0.07,
  dribbleSpeed: 5.2,
  dribbleSpread: 0.25,
  kickReach: 0.32,
  kickCooldown: 0.4,
  coverDepth: 0.5,
  supportAhead: 4.5,
  passLaneClearance: 1.1,
  shotLaneClearance: 0.75,
  blindShotChance: 0.35,
  jockeyDistance: 1.6,
  takeOnRange: 2.2,
  takeOnAngle: 0.8,
});

const SHOT_AIMS = [-0.8, -0.45, 0, 0.45, 0.8];

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function assignRoles(players, ball, team) {
  const mine = players.filter((p) => p.team === team);
  const presser = mine.reduce((best, p) => (dist(p, ball) < dist(best, ball) ? p : best));
  const own = ownGoalCenter(team);
  const others = mine.filter((p) => p !== presser).sort((a, b) => dist(a, own) - dist(b, own));
  return { presser, cover: others[0], support: others[1] };
}

function clampToPitch(point, margin = 1) {
  return {
    x: Math.max(-PITCH.width / 2 + margin, Math.min(PITCH.width / 2 - margin, point.x)),
    y: Math.max(-PITCH.length / 2 + margin, Math.min(PITCH.length / 2 - margin, point.y)),
  };
}

// Where each player wants to be.
export function targetFor(player, role, ball, players = [], ai = AI) {
  const goal = goalCenter(player.team);
  if (role === 'presser') {
    // If an opponent already has the ball, jockey goal-side instead of
    // crashing into it; otherwise get behind the ball and attack.
    const own = ownGoalCenter(player.team);
    const rival = players.find((p) => p.team !== player.team && dist(p, ball) < p.r + ball.r + ai.kickReach + 0.15);
    if (rival && dist(player, ball) > dist(rival, ball)) {
      const ox = own.x - ball.x;
      const oy = own.y - ball.y;
      const od = Math.hypot(ox, oy) || 1;
      return { x: ball.x + (ox / od) * ai.jockeyDistance, y: ball.y + (oy / od) * ai.jockeyDistance };
    }
    const lead = { x: ball.x + ball.vx * 0.25, y: ball.y + ball.vy * 0.25 };
    const dx = goal.x - lead.x;
    const dy = goal.y - lead.y;
    const d = Math.hypot(dx, dy) || 1;
    const back = player.r + ball.r * 0.6;
    return { x: lead.x - (dx / d) * back, y: lead.y - (dy / d) * back };
  }
  if (role === 'cover') {
    const own = ownGoalCenter(player.team);
    return clampToPitch({ x: own.x + (ball.x - own.x) * ai.coverDepth, y: own.y + (ball.y - own.y) * ai.coverDepth });
  }
  const dir = attackDirection(player.team);
  return clampToPitch({ x: -ball.x * 0.6 + (ball.x >= 0 ? -1.5 : 1.5), y: ball.y + dir * ai.supportAhead }, 1.5);
}

// A lane is blocked by an opponent standing in it further than
// `ignoreNear` metres along the lane (players right at the ball are
// contesting it, not blocking the line).
function laneIsClear(from, to, opponents, clearance, ignoreNear = 0.9) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return opponents.every((o) => {
    const along = ((o.x - from.x) * dx + (o.y - from.y) * dy) / len;
    if (along < ignoreNear || along > len) return true;
    const lateral = Math.abs((o.x - from.x) * dy - (o.y - from.y) * dx) / len;
    return lateral > clearance;
  });
}

function aimed(from, to, speed, spread, rng) {
  const a = Math.atan2(to.y - from.y, to.x - from.x) + (rng.next() * 2 - 1) * spread;
  return { vx: Math.cos(a) * speed, vy: Math.sin(a) * speed };
}

// Decides the kick for a presser touching the ball.
// Returns { kind, vx, vy, target } or null.
export function chooseKick(player, ball, players, rng, ai = AI) {
  const goal = goalCenter(player.team);
  const dir = attackDirection(player.team);
  const opponents = players.filter((p) => p.team !== player.team);

  if (dist(ball, goal) < ai.shootRange) {
    // Look for a corner of the goal with a clear shooting lane.
    const clear = SHOT_AIMS
      .map((f) => ({ x: f * PITCH.goalHalfWidth, y: goal.y }))
      .filter((aim) => laneIsClear(ball, aim, opponents, ai.shotLaneClearance));
    const pool = clear.length > 0 ? clear : (rng.next() < ai.blindShotChance ? [{ x: 0, y: goal.y }] : []);
    if (pool.length > 0) {
      const aim = pool[Math.floor(rng.next() * pool.length)];
      return { kind: 'shot', ...aimed(ball, aim, ai.shotSpeed, ai.shotSpread, rng) };
    }
  }

  const options = players
    .filter((p) => p.team === player.team && p !== player)
    .filter((p) => (p.y - ball.y) * dir > 1 && laneIsClear(ball, p, opponents, ai.passLaneClearance))
    .sort((a, b) => dist(a, goal) - dist(b, goal));
  if (options.length > 0) {
    const mate = options[0];
    const lead = { x: mate.x + mate.vx * 0.3, y: mate.y + mate.vy * 0.3 };
    const speed = Math.max(ai.passSpeedMin, Math.min(ai.passSpeedMax, dist(ball, lead) * 1.3));
    return { kind: 'pass', target: mate.id, ...aimed(ball, lead, speed, ai.passSpread, rng) };
  }

  // Dribble: carry the ball at the goal, or take on a goal-side defender
  // by pushing the ball diagonally past them.
  const toGoal = Math.atan2(goal.y - ball.y, goal.x - ball.x);
  const blocker = opponents.find((o) => {
    const along = (o.x - ball.x) * Math.cos(toGoal) + (o.y - ball.y) * Math.sin(toGoal);
    const lateral = Math.abs(-(o.x - ball.x) * Math.sin(toGoal) + (o.y - ball.y) * Math.cos(toGoal));
    return along > 0 && along < ai.takeOnRange && lateral < 1.2;
  });
  let angle = toGoal;
  if (blocker) {
    const side = Math.sign(-(blocker.x - ball.x) * Math.sin(toGoal) + (blocker.y - ball.y) * Math.cos(toGoal)) || 1;
    angle = toGoal - side * ai.takeOnAngle;
  }
  angle += (rng.next() * 2 - 1) * ai.dribbleSpread;
  return { kind: blocker ? 'takeon' : 'dribble', vx: Math.cos(angle) * ai.dribbleSpeed, vy: Math.sin(angle) * ai.dribbleSpeed };
}
