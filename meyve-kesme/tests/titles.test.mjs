import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeline, ROUND_PRESETS, TIMING } from '../js/timeline.js';
import { introText } from '../js/titles.js';

test('intro card reads 10 / vs / 1000 / CUTS, one per line, from the first and last round', () => {
  const tl = buildTimeline({ rounds: ROUND_PRESETS.classic });
  assert.deepEqual(introText(tl, 'en'), { lines: ['10', 'vs', '1000', 'CUTS'] });
  assert.deepEqual(introText(buildTimeline({ rounds: ROUND_PRESETS.legend }), 'tr'), { lines: ['10', 'vs', '5000', 'KESİM'] });
});

test('intro card stays on screen between half a second and a second', () => {
  assert.ok(TIMING.intro >= 0.5 && TIMING.intro <= 1);
});
