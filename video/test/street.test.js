import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runToEnd, recordFrames, ENGINE } from '../src/street/engine.js';
import { PITCH, goalScored, collideBallWithCage, clampPlayer, goalCenter, ownGoalCenter } from '../src/street/pitch.js';
import { assignRoles, chooseKick } from '../src/street/ai.js';
import { createRng } from '../../tournament/src/rng.js';
import { findSeed } from '../src/seed-search.js';

test('street match is deterministic per seed', () => {
  assert.deepEqual(runToEnd('det').score, runToEnd('det').score);
  assert.deepEqual(runToEnd('det').scorers, runToEnd('det').scorers);
});

test('every goal has a credited player of a valid team', () => {
  for (let i = 0; i < 20; i += 1) {
    const { score, scorers } = runToEnd(`credit-${i}`);
    assert.equal(scorers.length, score[0] + score[1]);
    for (const g of scorers) {
      assert.ok(g.team === 0 || g.team === 1);
      assert.ok(g.scorer === null || (g.scorer >= 0 && g.scorer < 6));
      if (g.scorer !== null && !g.ownGoal) assert.equal(Math.floor(g.scorer / 3), g.team, 'scorer plays for the scoring team');
      if (g.ownGoal) assert.notEqual(Math.floor(g.scorer / 3), g.team, 'own goal comes from the other team');
      if (g.assist !== null) assert.equal(Math.floor(g.assist / 3), g.team);
    }
  }
});

test('both teams have equal chances (identical physics and AI)', () => {
  const goals = [0, 0];
  for (let i = 0; i < 200; i += 1) {
    const { score } = runToEnd(`fair-${i}`);
    goals[0] += score[0]; goals[1] += score[1];
  }
  const share = goals[0] / (goals[0] + goals[1]);
  assert.ok(share > 0.4 && share < 0.6, `home goal share ${share.toFixed(2)}`);
});

test('players stay on the pitch in every frame', () => {
  const { frames } = recordFrames('bounds-street', 30);
  for (const f of frames) {
    for (const p of f.players) {
      assert.ok(Math.abs(p.x) <= PITCH.width / 2 && Math.abs(p.y) <= PITCH.length / 2);
    }
  }
  assert.equal(frames.at(-1).clock, 90);
});

test('goal line logic: only inside the mouth and beyond the line', () => {
  const r = ENGINE.ballRadius;
  assert.equal(goalScored({ x: 0, y: -PITCH.length / 2 - r - 0.01, r }), 0);
  assert.equal(goalScored({ x: 0, y: PITCH.length / 2 + r + 0.01, r }), 1);
  assert.equal(goalScored({ x: PITCH.goalHalfWidth + 0.1, y: -PITCH.length / 2 - r - 0.01, r }), null);
  assert.equal(goalScored({ x: 0, y: 0, r }), null);
  assert.deepEqual(goalCenter(0), { x: 0, y: -PITCH.length / 2 });
  assert.deepEqual(ownGoalCenter(0), { x: 0, y: PITCH.length / 2 });
});

test('cage walls, corners and posts bounce the ball back in', () => {
  const side = { r: 0.24, x: PITCH.width / 2 + 0.1, y: 3, vx: 5, vy: 0 };
  assert.equal(collideBallWithCage(side, 0.8), 'wall');
  assert.ok(side.vx < 0 && side.x <= PITCH.width / 2 - side.r);
  const corner = { r: 0.24, x: PITCH.width / 2 - 0.3, y: PITCH.length / 2 - 0.3, vx: 3, vy: 3 };
  assert.equal(collideBallWithCage(corner, 0.8), 'wall');
  assert.ok(corner.vx < 0 && corner.vy < 0);
  const post = { r: 0.24, x: PITCH.goalHalfWidth - 0.2, y: -PITCH.length / 2, vx: 6, vy: -1 };
  assert.equal(collideBallWithCage(post, 0.8), 'post');
  const inNet = { r: 0.24, x: 0, y: -PITCH.length / 2 - PITCH.goalDepth, vx: 0, vy: -4 };
  assert.equal(collideBallWithCage(inNet, 0.8), 'net');
  const player = { r: 0.45, x: 99, y: -99 };
  clampPlayer(player);
  assert.ok(Math.abs(player.x) < PITCH.width / 2 && Math.abs(player.y) < PITCH.length / 2);
});

test('AI: nearest player presses, a shot is taken near goal with a clear lane', () => {
  const mk = (id, team, x, y) => ({ id, team, x, y, vx: 0, vy: 0, r: 0.45 });
  const players = [mk(0, 0, 0, -6), mk(1, 0, -3, 0), mk(2, 0, 3, 2), mk(3, 1, 6, 6), mk(4, 1, -6, 6), mk(5, 1, 0, 10)];
  const ball = { x: 0, y: -6.6, vx: 0, vy: 0, r: 0.24 };
  const roles = assignRoles(players, ball, 0);
  assert.equal(roles.presser.id, 0);
  const kick = chooseKick(players[0], ball, players, createRng('ai'));
  assert.equal(kick.kind, 'shot');
  assert.ok(kick.vy < 0, 'shoots towards the goal it attacks');
});

test('seed search works with the street engine', () => {
  const { seed } = findSeed('street-test', { home: 2, away: 1 }, { run: runToEnd, maxTries: 20000 });
  assert.deepEqual(runToEnd(seed).score, [2, 1]);
});
