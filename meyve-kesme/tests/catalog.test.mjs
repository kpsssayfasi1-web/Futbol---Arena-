import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, CATEGORIES, itemById, itemsInCategory, itemForRound, isValidSelection } from '../js/catalog/index.js';
import { objectInfo, measure, shapeOf } from '../js/object-info.js';
import { META } from '../js/catalog/meta.js';
import { itemGlsl } from '../js/object-glsl.js';
import { isFlatItem } from '../js/timeline.js';

test('catalog has unique ids and every category is filled', () => {
  assert.equal(new Set(ITEMS.map((i) => i.id)).size, ITEMS.length);
  for (const c of CATEGORIES) assert.ok(itemsInCategory(c.id).length >= 2, c.id);
  assert.ok(ITEMS.length >= 30);
});

test('every item has names, a colour, a sound profile and a solid centre region', () => {
  for (const it of ITEMS) {
    assert.ok(it.tr && it.en && /^#[0-9a-f]{6}$/i.test(it.dot), it.id);
    assert.ok(it.sound && typeof it.sound.cut === 'string', it.id);
    const info = objectInfo(it);
    assert.ok(info.volume > 0.5, `${it.id} volume ${info.volume}`);
    const lowest = isFlatItem(it, info) ? -0.08 : -0.3; // flat items (pizza, cookie) sit low
    assert.ok(info.boardY < lowest && info.boardY > -1.2, `${it.id} boardY ${info.boardY}`);
    const { sdf } = shapeOf(it);
    assert.ok(sdf(0, info.boardY - 0.05, 0) > 0, `${it.id} nothing below the board`);
  }
});

test('precomputed metadata matches a fresh measurement', () => {
  for (const id of ['apple', 'burger', 'cheese']) {
    const fresh = measure({ ...itemById(id), id: `${id}-fresh` });
    const meta = META[id];
    assert.ok(meta, `meta for ${id}`);
    assert.ok(Math.abs(fresh.boardY - meta.boardY) < 1e-3, id);
    assert.ok(Math.abs(fresh.volume - meta.volume) < 1e-3, id);
  }
  for (const it of ITEMS) assert.ok(META[it.id], `run node tools/build-meta.mjs (missing ${it.id})`);
});

test('every item builds a GLSL program with the required functions', () => {
  for (const it of ITEMS) {
    const src = itemGlsl(it);
    for (const fn of ['float objMap(', 'vec3 itemSkin(vec3 p, float part)', 'vec3 itemInner(vec3 p, float depth, float part)']) {
      assert.ok(src.includes(fn), `${it.id} lacks ${fn}`);
    }
    assert.equal((src.match(/\{/g) || []).length, (src.match(/\}/g) || []).length, `${it.id} braces`);
  }
});

test('selections resolve to items', () => {
  assert.equal(itemForRound('kiwi', 3), 'kiwi');
  assert.ok(itemsInCategory('food').some((i) => i.id === itemForRound('mix:food', 2, 9)));
  assert.ok(isValidSelection('mix:all') && isValidSelection('earth') && !isValidSelection('mix:nope') && !isValidSelection('x'));
});
