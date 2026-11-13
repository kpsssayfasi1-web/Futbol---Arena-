import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeline, roundState } from '../js/timeline.js';
import { knifePose, slerp, quatMul, quatAxisAngle, AXIS_QUAT } from '../js/knife-pose.js';
import { roundEvents, eventsInWindow } from '../js/events.js';
import { buildRoundCubes } from '../js/cubes-data.js';
import { synthBank, filter, normalize, SAMPLE_RATE } from '../js/sfx.js';

const tl = buildTimeline({ rounds: [10] });
const round = tl.rounds[0];
const poseAt = (t) => knifePose(round, roundState(round, t), t);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test('knife reaches the board exactly when each chop lands', () => {
  for (const axis of [0, 2]) {
    const ph = round.phases[axis];
    for (let i = 0; i < ph.n; i++) {
      const p = poseAt(ph.times[i] - 1e-6);
      assert.ok(Math.abs(p.pos[1] - (round.boardY + 0.003)) < 0.02, `axis ${axis} cut ${i} y=${p.pos[1]}`);
      const lateral = axis === 0 ? p.pos[0] : p.pos[2];
      assert.ok(Math.abs(lateral - ph.planes[i]) < 1e-3);
    }
  }
});

test('horizontal slices end with the edge past the fruit', () => {
  const ph = round.phases[1];
  for (let i = 0; i < ph.n; i++) {
    const p = poseAt(ph.times[i] - 1e-6);
    assert.ok(p.pos[0] < round.bbox.min[0], `edge x ${p.pos[0]}`);
    assert.ok(Math.abs(p.pos[1] - ph.planes[i]) < 1e-3);
  }
});

test('knife motion has no jumps', () => {
  let prev = poseAt(round.start);
  for (let t = round.start; t < round.end; t += 1 / 240) {
    const p = poseAt(t);
    assert.ok(dist(p.pos, prev.pos) < 0.35, `jump at ${t.toFixed(3)}: ${dist(p.pos, prev.pos)}`);
    prev = p;
  }
});

test('quaternion helpers stay unit length', () => {
  const q = slerp(AXIS_QUAT[0], AXIS_QUAT[2], 0.37);
  assert.ok(Math.abs(Math.hypot(...q) - 1) < 1e-9);
  const r = quatMul(AXIS_QUAT[1], quatAxisAngle([0, 0, 1], 0.4));
  assert.ok(Math.abs(Math.hypot(...r) - 1) < 1e-9);
});

test('round events include a drop, every slow cut and cube landings', () => {
  const data = buildRoundCubes(round, { budget: 50000 });
  const ev = roundEvents(round, data);
  for (let i = 1; i < ev.length; i++) assert.ok(ev[i].t >= ev[i - 1].t);
  assert.equal(ev.filter((e) => e.type === 'drop').length, 1);
  assert.equal(ev.filter((e) => e.type === 'thock').length, round.split[0] + round.split[2]);
  assert.equal(ev.filter((e) => e.type === 'slice').length, round.split[1]);
  assert.ok(ev.some((e) => e.type === 'tick'));
  const w = eventsInWindow(ev, round.land - 0.01, round.land + 0.01);
  assert.ok(w.some((e) => e.type === 'drop'));
});

test('fast rounds are thinned to a playable number of knife sounds', () => {
  const big = buildTimeline({ rounds: [1000] }).rounds[0];
  const ev = roundEvents(big, null);
  const thocks = ev.filter((e) => e.type === 'thock');
  assert.ok(thocks.length < 667, `${thocks.length}`);
  const span = big.lastCut - big.land;
  assert.ok(thocks.length / span < 40);
});

test('sound bank renders finite, normalised samples', () => {
  const bank = synthBank(1);
  for (const [name, list] of Object.entries(bank)) {
    for (const buf of list) {
      let peak = 0;
      for (const v of buf) {
        assert.ok(Number.isFinite(v), name);
        peak = Math.max(peak, Math.abs(v));
      }
      assert.ok(peak > 0.3 && peak <= 1, `${name} peak ${peak}`);
    }
  }
});

test('lowpass filter removes high frequency content', () => {
  const n = SAMPLE_RATE / 10;
  const hi = Float32Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 9000 * i) / SAMPLE_RATE));
  filter(hi, 'lowpass', 500, 0.7);
  let peak = 0;
  for (let i = n / 2; i < n; i++) peak = Math.max(peak, Math.abs(hi[i]));
  assert.ok(peak < 0.05, `peak ${peak}`);
  assert.equal(normalize(new Float32Array(4)).length, 4);
});
