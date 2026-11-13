// Street cage pitch geometry and collision helpers.
// Coordinates in metres. x: -width/2 (left) .. +width/2 (right).
// y: -length/2 (top goal) .. +length/2 (bottom goal).
// Team 0 defends the bottom goal and attacks upwards (towards -y).

export const PITCH = Object.freeze({
  width: 14,
  length: 24,
  goalHalfWidth: 2.2,
  goalDepth: 1.1,
  corner: 1.6,
  postRadius: 0.09,
});

export function attackDirection(team) {
  return team === 0 ? -1 : 1;
}

export function goalCenter(team, pitch = PITCH) {
  // The goal a team attacks.
  return { x: 0, y: attackDirection(team) * (pitch.length / 2) };
}

export function ownGoalCenter(team, pitch = PITCH) {
  return { x: 0, y: -attackDirection(team) * (pitch.length / 2) };
}

export function posts(pitch = PITCH) {
  const { goalHalfWidth: g, length } = pitch;
  return [
    { x: -g, y: -length / 2 }, { x: g, y: -length / 2 },
    { x: -g, y: length / 2 }, { x: g, y: length / 2 },
  ];
}

function reflect(body, nx, ny, restitution) {
  const vn = body.vx * nx + body.vy * ny;
  if (vn >= 0) return false;
  body.vx -= (1 + restitution) * vn * nx;
  body.vy -= (1 + restitution) * vn * ny;
  return true;
}

// Keeps a ball inside the cage, letting it through the goal mouths.
// Mutates `ball`; returns 'wall' | 'post' | null for the contact made.
export function collideBallWithCage(ball, restitution, pitch = PITCH) {
  const { width, length, goalHalfWidth, corner, postRadius } = pitch;
  const r = ball.r;
  let hit = null;
  const inMouth = Math.abs(ball.x) < goalHalfWidth;
  const beyondLine = Math.abs(ball.y) > length / 2;

  if (beyondLine) {
    // Inside a goal box: side netting and back of the net.
    const side = goalHalfWidth - r;
    if (Math.abs(ball.x) > side) {
      ball.x = Math.sign(ball.x) * side;
      if (reflect(ball, -Math.sign(ball.x), 0, 0.2)) hit = 'net';
    }
    const back = length / 2 + pitch.goalDepth - r;
    if (Math.abs(ball.y) > back) {
      ball.y = Math.sign(ball.y) * back;
      if (reflect(ball, 0, -Math.sign(ball.y), 0.1)) hit = 'net';
    }
    return hit;
  }

  if (ball.x < -width / 2 + r) { ball.x = -width / 2 + r; if (reflect(ball, 1, 0, restitution)) hit = 'wall'; }
  if (ball.x > width / 2 - r) { ball.x = width / 2 - r; if (reflect(ball, -1, 0, restitution)) hit = 'wall'; }
  if (!inMouth) {
    if (ball.y < -length / 2 + r) { ball.y = -length / 2 + r; if (reflect(ball, 0, 1, restitution)) hit = 'wall'; }
    if (ball.y > length / 2 - r) { ball.y = length / 2 - r; if (reflect(ball, 0, -1, restitution)) hit = 'wall'; }
  }

  // Chamfered corners stop the ball getting stuck.
  const sx = Math.sign(ball.x) || 1;
  const sy = Math.sign(ball.y) || 1;
  const over = (Math.abs(ball.x) - (width / 2 - corner)) + (Math.abs(ball.y) - (length / 2 - corner)) - corner + r * Math.SQRT2;
  if (over > 0) {
    const nx = -sx / Math.SQRT2;
    const ny = -sy / Math.SQRT2;
    ball.x += nx * over / Math.SQRT2;
    ball.y += ny * over / Math.SQRT2;
    if (reflect(ball, nx, ny, restitution)) hit = 'wall';
  }

  for (const p of posts(pitch)) {
    const dx = ball.x - p.x;
    const dy = ball.y - p.y;
    const d = Math.hypot(dx, dy);
    const min = r + postRadius;
    if (d < min && d > 1e-9) {
      const nx = dx / d;
      const ny = dy / d;
      ball.x = p.x + nx * min;
      ball.y = p.y + ny * min;
      if (reflect(ball, nx, ny, restitution)) hit = 'post';
    }
  }
  return hit;
}

// Players stay on the pitch and never enter the goal boxes.
export function clampPlayer(player, pitch = PITCH) {
  const { width, length, corner } = pitch;
  const r = player.r;
  player.x = Math.max(-width / 2 + r, Math.min(width / 2 - r, player.x));
  player.y = Math.max(-length / 2 + r, Math.min(length / 2 - r, player.y));
  const over = (Math.abs(player.x) - (width / 2 - corner)) + (Math.abs(player.y) - (length / 2 - corner)) - corner + r * Math.SQRT2;
  if (over > 0) {
    player.x -= Math.sign(player.x) * over / 2;
    player.y -= Math.sign(player.y) * over / 2;
  }
}

// Has the ball fully crossed a goal line inside the mouth?
// Returns the scoring team (the team attacking that goal) or null.
export function goalScored(ball, pitch = PITCH) {
  if (Math.abs(ball.x) >= pitch.goalHalfWidth) return null;
  if (ball.y < -pitch.length / 2 - ball.r) return 0;
  if (ball.y > pitch.length / 2 + ball.r) return 1;
  return null;
}
