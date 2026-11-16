import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeline, ROUND_PRESETS, TIMING } from '../js/timeline.js';
import { introText } from '../js/titles.js';

test('intro card reads "10 vs 1,000 CUTS" from the first and last round', () => {
  const tl = buildTimeline({ rounds: ROUND_PRESETS.classic });
  assert.deepEqual(introText(tl, 'en'), { from: '10', to: '1,000', vs: 'vs', word: 'CUTS' });
  assert.deepEqual(introText(buildTimeline({ rounds: ROUND_PRESETS.legend }), 'tr'), { from: '10', to: '5.000', vs: 'vs', word: 'KESİM' });
});

test('intro card stays on screen between half a second and a second', () => {
  assert.ok(TIMING.intro >= 0.5 && TIMING.intro <= 1);
});
