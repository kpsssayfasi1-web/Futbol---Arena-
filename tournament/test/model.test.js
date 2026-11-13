import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/rng.js';
import { expectedGoals, simulateScore, simulateShootout } from '../src/model.js';
import { loadSettings } from './helpers.js';

const { model } = loadSettings();

test('equal ratings give equal expected goals', () => {
  const xg = expectedGoals(80, 80, model);
  assert.equal(xg.home, model.baseGoals);
  assert.equal(xg.away, model.baseGoals);
});

test('stronger team has higher expected goals, symmetrically', () => {
  const xg = expectedGoals(90, 60, model);
  assert.ok(xg.home > xg.away);
  assert.ok(Math.abs(xg.home * xg.away - model.baseGoals ** 2) < 1e-9);
});

test('favourite wins clearly more often than underdog', () => {
  const rng = createRng('favourite');
  let favWins = 0;
  let dogWins = 0;
  for (let i = 0; i < 5000; i += 1) {
    const s = simulateScore(rng, 92, 58, model);
    if (s.home > s.away) favWins += 1;
    if (s.away > s.home) dogWins += 1;
  }
  assert.ok(favWins / 5000 > 0.7, `favourite win rate ${favWins / 5000}`);
  assert.ok(dogWins > 0, 'upsets must still be possible');
});

test('shootouts always produce a winner with a plausible score', () => {
  const rng = createRng('shootout');
  for (let i = 0; i < 2000; i += 1) {
    const p = simulateShootout(rng, 80, 78, model);
    assert.notEqual(p.home, p.away);
    const diff = Math.abs(p.home - p.away);
    const regulation = Math.max(p.home, p.away) <= 5;
    assert.ok(regulation ? diff <= 3 : diff === 1, `implausible shootout ${p.home}-${p.away}`);
  }
});

test('penalty probability is clamped for extreme rating gaps', () => {
  const rng = createRng('clamp');
  const p = simulateShootout(rng, 100, 0, { ...model, penaltyEdgePerPoint: 1 });
  assert.notEqual(p.home, p.away);
});
