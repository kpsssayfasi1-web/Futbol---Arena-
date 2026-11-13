import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, deriveRng, hashSeed, samplePoisson, shuffle } from '../src/rng.js';

test('same seed produces the same sequence', () => {
  const a = createRng('season-1');
  const b = createRng('season-1');
  const seqA = Array.from({ length: 5 }, () => a.next());
  const seqB = Array.from({ length: 5 }, () => b.next());
  assert.deepEqual(seqA, seqB);
});

test('different labels give independent streams', () => {
  assert.notEqual(deriveRng('s', 'a').next(), deriveRng('s', 'b').next());
});

test('numeric and string seeds both work and stay in [0, 1)', () => {
  const rng = createRng(42);
  for (let i = 0; i < 1000; i += 1) {
    const v = rng.next();
    assert.ok(v >= 0 && v < 1);
  }
  assert.equal(typeof hashSeed('x'), 'number');
});

test('poisson sample mean is close to lambda', () => {
  const rng = createRng('poisson');
  const n = 20000;
  let sum = 0;
  for (let i = 0; i < n; i += 1) sum += samplePoisson(rng, 1.6);
  assert.ok(Math.abs(sum / n - 1.6) < 0.05);
});

test('poisson rejects negative lambda', () => {
  assert.throws(() => samplePoisson(createRng(1), -1), RangeError);
});

test('shuffle returns a permutation without mutating the input', () => {
  const input = [1, 2, 3, 4, 5, 6];
  const output = shuffle(createRng('shuffle'), input);
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual([...output].sort(), input);
});
