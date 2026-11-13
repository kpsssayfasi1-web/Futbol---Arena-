import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bracketOrder, buildRoundOf32 } from '../src/knockout.js';
import { GROUP_IDS } from '../src/draw.js';

test('bracket order keeps top seeds apart until the final', () => {
  const order = bracketOrder(32);
  assert.equal(order.length, 32);
  assert.deepEqual(order.slice(0, 2), [1, 32]);
  assert.ok(order.indexOf(1) < 16 && order.indexOf(2) >= 16);
  assert.deepEqual(bracketOrder(4), [1, 4, 2, 3]);
});

function row(group, position, points, team = `${group}${position}`) {
  return { team, group, position, points, goalDiff: 0, goalsFor: 0 };
}

function fakeStandings(thirdPoints) {
  return Object.fromEntries(GROUP_IDS.map((g, i) => [g, [
    row(g, 1, 9 - (i % 3)), row(g, 2, 6 - (i % 2)), row(g, 3, thirdPoints[i]), row(g, 4, 0),
  ]]));
}

test('round of 32 has 32 unique qualifiers and no group rematches', () => {
  const standings = fakeStandings([4, 3, 4, 2, 3, 4, 1, 3, 4, 3, 2, 4]);
  const lots = GROUP_IDS.flatMap((g) => [1, 2, 3, 4].map((p) => `${g}${p}`));
  const { pairs, thirdsTable } = buildRoundOf32(standings, 8, lots);
  assert.equal(pairs.length, 16);
  const teams = pairs.flat();
  assert.equal(new Set(teams).size, 32);
  for (const [a, b] of pairs) assert.notEqual(a[0], b[0], `${a} vs ${b} are from the same group`);
  assert.equal(thirdsTable.filter((r) => r.qualified).length, 8);
  assert.ok(thirdsTable.filter((r) => r.qualified).every((r) => r.points >= 3));
});
