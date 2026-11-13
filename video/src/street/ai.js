// Player decision-making. Both teams use exactly the same logic and
// numbers; only the physics seed differs between matches.
//
// There are no fixed positions: roles are re-dealt every decision tick
// from who is nearest the ball and which team has it, so every player
// attacks, defends, scores and assists.
//
//   presser - teammate nearest the ball: runs at it and kicks
//   In possession, the other two both push up:
//     striker - the more advanced one: runs into the box for a pass/shot
//     wide    - the other: an option on the far flank, level with the ball
//   Out of possession, the other two each mark an opponent goal-side:
//     marker  - one per remaining opponent (whole team defends)
//     cover   - when the ball is near our goal, whichever marker has the
//               less dangerous opponent drops in front of the goal instead

import { PITCH, attackDirection, goalCenter, ownGoalCenter } from './pitch.js';

// shootRange and shotSpread are defaults; each match draws its own values
// from CONDITIONS in engine.js (always the same for both teams).
export const AI = Object.freeze({
  shootRange: 8.5,
  shotSpeed: 17,
  shotSpread: 0.14,
  passSpeedMin: 7,
  passSpeedMax: 12,
  passSpread: 0.07,
  dribbleSpeed: 5.2,
  dribbleSpread: 0.25,
  kickReach: 0.32,
  kickCooldown: 0.4,
  supportAhead: 4.5,
  strikerAhead: 7,
  strikerGoalGap: 3.2,
  wideX: 4.6,
  markDistance: 1.5,
  coverZone: 13,
  coverDepth: 0.25,
  possessionMargin: 0.6,
  passLaneClearance: 0.7,
  shotLaneClearance: 1.0,
  blindShotChance: 0.12,
  jockeyDistance: 1.6,
  roundBallGap: 0.5,
  takeOnRange: 2.2,
  takeOnAngle: 0.8,
  layOffBack: 2,
});

const SHOT_AIMS = [-0.8, -0.45, 0, 0.45, 0.8];

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Which team has the ball: the one whose nearest player is clearly
// closer to it. `current` adds hysteresis so possession does not flicker.
export function possessionTeam(players, ball, current = null, ai = AI) {
  const nearest = [0, 1].map((team) => Math.min(...players.filter((p) => p.team === team).map((p) => dist(p, ball))));
  if (nearest[0] + ai.possessionMargin < nearest[1]) return 0;
  if (nearest[1] + ai.possessionMargin < nearest[0]) return 1;
  return current;
}

const advance = (p) => -attackDirection(p.team) * p.y; // smaller = further up the pitch

// Returns { presser, ... } plus, for markers, the opponent each one marks.
export function assignRoles(players, ball, team, possession = null) {
  const mine = players.filter((p) => p.team === team);
  const presser = mine.reduce((best, p) => (dist(p, ball) < dist(best, ball) ? p : best));
  const others = mine.filter((p) => p !== presser);
  if (possession === team) {
    const [striker, wide] = [...others].sort((a, b) => advance(a) - advance(b));
    return { roles: { presser, striker, wide }, marks: {} };
  }
  // Mark the two opponents not on the ball, pairing to minimise running.
  const rivals = players.filter((p) => p.team !== team);
  const carrier = rivals.reduce((best, p) => (dist(p, ball) < dist(best, ball) ? p : best));
  const [r1, r2] = rivals.filter((p) => p !== carrier);
  const [a, b] = others;
  const straight = dist(a, r1) + dist(b, r2);
  const swapped = dist(a, r2) + dist(b, r1);
  const marks = straight <= swapped ? { [a.id]: r1, [b.id]: r2 } : { [a.id]: r2, [b.id]: r1 };
  const own = ownGoalCenter(team);
  if (dist(ball, own) < AI.coverZone) {
    const [danger, safe] = [a, b].sort((p, q) => dist(marks[p.id], own) - dist(marks[q.id], own));
    return { roles: { presser, markerA: danger, cover: safe }, marks };
  }
  return { roles: { presser, markerA: a, markerB: b }, marks };
}

function clampToPitch(point, margin = 1) {
  return {
    x: Math.max(-PITCH.width / 2 + margin, Math.min(PITCH.width / 2 - margin, point.x)),
    y: Math.max(-PITCH.length / 2 + margin, Math.min(PITCH.length / 2 - margin, point.y)),
  };
}

// Where each player wants to be. `mark` is the opponent a marker guards.
export function targetFor(player, role, ball, players = [], ai = AI, mark = null) {
  const goal = goalCenter(player.team);
  const own = ownGoalCenter(player.team);
  const dir = attackDirection(player.team);
  if (role === 'presser') {
    // If an opponent already has the ball, jockey goal-side instead of
    // crashing into it; otherwise get behind the ball and attack.
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
    // Caught on the wrong side of the ball: loop round it instead of
    // running through it (which would push it towards our own goal).
    const ahead = ((player.x - lead.x) * dx + (player.y - lead.y) * dy) / d;
    if (ahead > -back * 0.5) {
      const px = -dy / d;
      const py = dx / d;
      const s = Math.sign((player.x - lead.x) * px + (player.y - lead.y) * py) || 1;
      const wide = player.r + ball.r + ai.roundBallGap;
      return { x: lead.x + px * s * wide - (dx / d) * back, y: lead.y + py * s * wide - (dy / d) * back };
    }
    return { x: lead.x - (dx / d) * back, y: lead.y - (dy / d) * back };
  }
  const side = ball.x >= 0 ? 1 : -1;
  if (role === 'striker') {
    // Run in behind, towards the box, on the far side of the ball.
    const furthest = goal.y - dir * ai.strikerGoalGap;
    const wanted = ball.y + dir * ai.strikerAhead;
    const y = dir < 0 ? Math.max(furthest, wanted) : Math.min(furthest, wanted);
    return clampToPitch({ x: -side * 1.6, y }, 1.2);
  }
  if (role === 'wide') {
    return clampToPitch({ x: -side * ai.wideX, y: ball.y + dir * ai.supportAhead * 0.4 }, 1.2);
  }
  if (role === 'cover') {
    return clampToPitch({ x: own.x + (ball.x - own.x) * ai.coverDepth, y: own.y + (ball.y - own.y) * ai.coverDepth });
  }
  if (mark) {
    // Stay between the opponent and our goal, a step off them.
    const ox = own.x - mark.x;
    const oy = own.y - mark.y;
    const od = Math.hypot(ox, oy) || 1;
    const k = Math.min(ai.markDistance, od * 0.5);
    return clampToPitch({ x: mark.x + (ox / od) * k, y: mark.y + (oy / od) * k }, 0.8);
  }
  return clampToPitch({ x: -ball.x * 0.6, y: ball.y + dir * ai.supportAhead }, 1.5);
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

  // Blocked by a goal-side defender? Then a square or slightly backward
  // lay-off is also fine; otherwise only passes that move the ball forward.
  const toGoal = Math.atan2(goal.y - ball.y, goal.x - ball.x);
  const blocker = opponents.find((o) => {
    const along = (o.x - ball.x) * Math.cos(toGoal) + (o.y - ball.y) * Math.sin(toGoal);
    const lateral = Math.abs(-(o.x - ball.x) * Math.sin(toGoal) + (o.y - ball.y) * Math.cos(toGoal));
    return along > 0 && along < ai.takeOnRange && lateral < 1.2;
  });
  const minGain = blocker ? -ai.layOffBack : 1;
  const options = players
    .filter((p) => p.team === player.team && p !== player)
    .filter((p) => (p.y - ball.y) * dir > minGain && laneIsClear(ball, p, opponents, ai.passLaneClearance))
    .sort((a, b) => dist(a, goal) - dist(b, goal));
  if (options.length > 0) {
    const mate = options[0];
    const lead = { x: mate.x + mate.vx * 0.3, y: mate.y + mate.vy * 0.3 };
    const speed = Math.max(ai.passSpeedMin, Math.min(ai.passSpeedMax, dist(ball, lead) * 1.3));
    return { kind: 'pass', target: mate.id, ...aimed(ball, lead, speed, ai.passSpread, rng) };
  }

  // Dribble: carry the ball at the goal, or take on a goal-side defender
  // by pushing the ball diagonally past them.
  let angle = toGoal;
  if (blocker) {
    const side = Math.sign(-(blocker.x - ball.x) * Math.sin(toGoal) + (blocker.y - ball.y) * Math.cos(toGoal)) || 1;
    angle = toGoal - side * ai.takeOnAngle;
  }
  angle += (rng.next() * 2 - 1) * ai.dribbleSpread;
  return { kind: blocker ? 'takeon' : 'dribble', vx: Math.cos(angle) * ai.dribbleSpeed, vy: Math.sin(angle) * ai.dribbleSpeed };
}
