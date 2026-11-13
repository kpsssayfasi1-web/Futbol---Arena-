import test from 'node:test';
import assert from 'node:assert/strict';
import { FRUITS, FRUIT_ORDER, fruitInfo, isInsideBody, bodyField, estimateCellCount, attachmentSamples, silhouette } from '../js/fruits.js';

test('every fruit contains its centre and excludes far points', () => {
  for (const id of FRUIT_ORDER) {
    const f = FRUITS[id];
    assert.ok(isInsideBody(f, 0, 0, 0), id);
    assert.ok(!isInsideBody(f, 3, 0, 0), id);
    assert.ok(bodyField(f, 0, 0.1, 0) < 0);
  }
});

test('apple has a stem cavity at the top', () => {
  const f = FRUITS.apple;
  const top = f.rho(0, 1, 0);
  const shoulder = f.rho(Math.sin(0.5), Math.cos(0.5), 0);
  assert.ok(top < shoulder - 0.1);
});

test('fruitInfo bbox covers the body and attachments, board under the fruit', () => {
  const info = fruitInfo(FRUITS.apple);
  assert.ok(info.bbox.max[1] > 1.0, 'stem reaches above the body');
  assert.ok(info.boardY < -0.8 && info.boardY > -1.0);
  assert.ok(info.volume > 3 && info.volume < 4.2, `volume ${info.volume}`);
  for (const s of attachmentSamples(FRUITS.apple)) {
    for (let k = 0; k < 3; k++) {
      assert.ok(s.p[k] >= info.bbox.min[k] && s.p[k] <= info.bbox.max[k]);
    }
  }
});

test('estimateCellCount approaches volume/cell for tiny cells and counts boundary cells', () => {
  const info = fruitInfo(FRUITS.orange);
  const a = 0.01;
  const est = estimateCellCount(info, a, a, a);
  const ratio = est / (info.volume / a ** 3);
  assert.ok(ratio > 1 && ratio < 1.1, `ratio ${ratio}`);
  const coarse = estimateCellCount(info, 0.5, 0.5, 0.5);
  assert.ok(coarse > info.volume / 0.125);
});

test('silhouette radius is positive in all directions', () => {
  const s = silhouette(FRUITS.kiwi, 36);
  assert.equal(s.length, 36);
  assert.ok(s.every((r) => r > 0.7 && r < 1.4));
});
