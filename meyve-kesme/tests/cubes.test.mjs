import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeline } from '../js/timeline.js';
import { buildRoundCubes, displayGrid, releasedCount, displayedCubeTotal, flightDuration, cellsOf, GRAVITY, BOARD } from '../js/cubes-data.js';
import { itemById } from '../js/catalog/index.js';
import { objectInfo } from '../js/object-info.js';
import { formatCount } from '../js/format.js';

const tl = buildTimeline({ rounds: [10, 1000] });

test('small rounds are rendered cube for cube', () => {
  const d = buildRoundCubes(tl.rounds[0], { budget: 50000 });
  assert.equal(d.exact, true);
  assert.equal(d.coarse, true);
  assert.equal(d.trueCount, d.count);
  const [a, b, c] = cellsOf(tl.rounds[0].split, tl.rounds[0].layers);
  assert.ok(d.count > 30 && d.count <= a * b * c, `count ${d.count}`);
});

test('large rounds cap the display grid but estimate the real count', () => {
  const d = buildRoundCubes(tl.rounds[1], { budget: 20000 });
  assert.equal(d.exact, false);
  assert.ok(d.count < 30000);
  assert.ok(d.trueCount > 2e7 && d.trueCount < 9e7, `true ${d.trueCount}`);
});

test('displayGrid keeps the real grid when it fits', () => {
  const info = objectInfo(itemById('apple'));
  assert.deepEqual(displayGrid([4, 3, 3], 1000, info), { dims: [5, 4, 4], exact: true });
  const g = displayGrid([334, 333, 333], 10000, info);
  assert.equal(g.exact, false);
  assert.ok(g.dims[0] * g.dims[1] * g.dims[2] < 40000);
});

test('cubes are released in order and only after the first z cut', () => {
  const r = tl.rounds[0];
  const d = buildRoundCubes(r, { budget: 50000 });
  for (let i = 1; i < d.count; i++) assert.ok(d.motion[i * 4] >= d.motion[(i - 1) * 4]);
  assert.ok(d.motion[0] >= r.phases[2].times[0]);
  assert.equal(releasedCount(d, r.phases[2].times[0] - 0.01), 0);
  assert.equal(releasedCount(d, r.end), d.count);
  assert.equal(displayedCubeTotal(d, r.end), d.trueCount);
});

test('cubes come to rest on the board, inside its edges', () => {
  const r = tl.rounds[1];
  const d = buildRoundCubes(r, { budget: 20000 });
  for (let i = 0; i < d.count; i++) {
    const x = d.rest[i * 3];
    const y = d.rest[i * 3 + 1];
    const z = d.rest[i * 3 + 2];
    assert.ok(y >= r.boardY - 1e-6, 'above board');
    assert.ok(x >= BOARD.minX - 0.1 && x <= BOARD.maxX + 0.1);
    assert.ok(z >= BOARD.minZ - 0.1 && z <= BOARD.maxZ + 0.1);
    assert.ok(d.motion[i * 4 + 1] > 0, 'positive flight time');
  }
});

test('the heap stays where the item stood, lower than the item was', () => {
  for (const item of ['apple', 'soap', 'pumpkin']) {
    const r = buildTimeline({ rounds: [1000], item }).rounds[0];
    const d = buildRoundCubes(r, { budget: 20000 });
    const { min, max } = r.bbox;
    const ex = 0.3 * (max[0] - min[0]);
    const ez = 0.3 * (max[2] - min[2]);
    let maxY = -Infinity;
    let inside = 0;
    for (let i = 0; i < d.count; i++) {
      const x = d.rest[i * 3];
      const z = d.rest[i * 3 + 2];
      maxY = Math.max(maxY, d.rest[i * 3 + 1]);
      if (x > min[0] - ex && x < max[0] + ex && z > min[2] - ez && z < max[2] + ez) inside++;
    }
    assert.ok(inside / d.count > 0.97, `${item}: ${((100 * inside) / d.count).toFixed(1)}% on the footprint`);
    assert.ok(maxY < max[1] + 0.1 * (max[1] - r.boardY), `${item}: heap top ${maxY}`);
  }
});

test('build is deterministic for the same seed', () => {
  const a = buildRoundCubes(tl.rounds[0], { seed: 7 });
  const b = buildRoundCubes(tl.rounds[0], { seed: 7 });
  assert.deepEqual(Array.from(a.rest), Array.from(b.rest));
});

test('flightDuration solves the ballistic drop', () => {
  const T = flightDuration(1, 0, 0);
  assert.ok(Math.abs(T - Math.sqrt(2 / GRAVITY)) < 1e-9);
  const up = flightDuration(0, 0, 3);
  assert.ok(Math.abs(up - 6 / GRAVITY) < 1e-9);
});

test('formatCount shows exact and approximate numbers', () => {
  assert.equal(formatCount(59, false), '59');
  assert.equal(formatCount(14868, false), '14,868');
  assert.equal(formatCount(13752345, true), '≈ 13,752,000');
  assert.equal(formatCount(13752345, true, 'tr-TR'), '≈ 13.752.000');
  assert.equal(formatCount(0, true), '0');
});

test('flat items: pieces stay near-cubic and the count follows the drawn grid', () => {
  const info = objectInfo(itemById('pizza'));
  const r = buildTimeline({ rounds: [10, 1000], item: 'pizza' }).rounds;
  assert.equal(r[0].layers, 1, 'few cuts: one layer of columns');
  assert.ok(r[1].layers > 4, `layers ${r[1].layers}`);
  const big = displayGrid(r[1].split, 420000, info, r[1].layers);
  const cell = [0, 1, 2].map((k) => (info.bbox.max[k] - info.bbox.min[k]) / big.dims[k]);
  assert.ok(cell[1] / Math.min(cell[0], cell[2]) < 2, 'roughly cubic');
});
