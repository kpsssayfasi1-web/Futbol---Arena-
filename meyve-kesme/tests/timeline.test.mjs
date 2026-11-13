import test from 'node:test';
import assert from 'node:assert/strict';
import { splitCuts, phaseDuration, planePositions, cutTimes, buildTimeline, roundState, cutsDone, releaseTimeForZ, roundIndexAt, ROUND_PRESETS, TIMING } from '../js/timeline.js';

test('splitCuts spreads cuts over the three axes and keeps the total', () => {
  assert.deepEqual(splitCuts(10), [4, 3, 3]);
  assert.deepEqual(splitCuts(1000), [334, 333, 333]);
  for (const n of [3, 7, 50, 251, 5000]) {
    const s = splitCuts(n);
    assert.equal(s[0] + s[1] + s[2], n);
    assert.ok(s.every((v) => v >= 1));
  }
});

test('splitCuts never returns fewer than three cuts', () => {
  assert.deepEqual(splitCuts(1), [1, 1, 1]);
});

test('phaseDuration grows slower than the number of cuts', () => {
  assert.ok(phaseDuration(334) > phaseDuration(34));
  assert.ok(phaseDuration(334) / 334 < phaseDuration(4) / 4);
  assert.equal(phaseDuration(0), 0);
  assert.ok(Math.abs(phaseDuration(100, 2) - phaseDuration(100) / 2) < 1e-9);
});

test('planePositions lie strictly inside the box in cutting order', () => {
  const bbox = { min: [-1, -1, -1], max: [1, 1, 1] };
  const x = planePositions(0, 3, bbox);
  assert.deepEqual(x, [0.5, 0, -0.5], 'X runs right to left');
  const z = planePositions(2, 3, bbox);
  assert.deepEqual(z, [0.5, 0, -0.5]);
});

test('cutTimes accelerate and end exactly at the phase end', () => {
  const t = cutTimes(20, 2, 4);
  assert.equal(t[19], 6);
  const first = t[1] - t[0];
  const last = t[19] - t[18];
  assert.ok(first > last, 'later cuts come faster');
  for (let i = 1; i < t.length; i++) assert.ok(t[i] > t[i - 1]);
});

test('buildTimeline chains rounds back to back', () => {
  const tl = buildTimeline({ rounds: ROUND_PRESETS.classic });
  assert.equal(tl.rounds.length, 6);
  for (let i = 1; i < tl.rounds.length; i++) assert.equal(tl.rounds[i].start, tl.rounds[i - 1].end);
  assert.equal(tl.duration, tl.rounds[5].end);
  assert.ok(tl.duration > 40 && tl.duration < 70, `duration ${tl.duration}`);
  assert.equal(tl.rounds[5].cuts, 1000);
});

test('mixed mode picks a different item of the category every round', () => {
  const tl = buildTimeline({ rounds: [10, 10, 10, 10], item: 'mix:veg', seed: 3 });
  const ids = tl.rounds.map((r) => r.itemId);
  assert.equal(new Set(ids).size, 4);
  const again = buildTimeline({ rounds: [10, 10, 10, 10], item: 'mix:veg', seed: 3 });
  assert.deepEqual(again.rounds.map((r) => r.itemId), ids, 'same seed, same order');
});

test('rounds follow each other without dead time', () => {
  const tl = buildTimeline({ rounds: ROUND_PRESETS.classic });
  for (let i = 0; i < tl.rounds.length - 1; i++) {
    const gap = tl.rounds[i + 1].phases[0].times[0] - tl.rounds[i].lastCut;
    assert.ok(gap < 1.6, `round ${i}: ${gap.toFixed(2)}s between last cut and next first cut`);
  }
});

test('roundIndexAt finds the round for any time', () => {
  const tl = buildTimeline({ rounds: [10, 50] });
  assert.equal(roundIndexAt(tl, -1), 0);
  assert.equal(roundIndexAt(tl, tl.rounds[1].start + 0.01), 1);
  assert.equal(roundIndexAt(tl, tl.duration + 5), 1);
});

test('roundState counts cuts and moves the clip plane front to back', () => {
  const tl = buildTimeline({ rounds: [10] });
  const r = tl.rounds[0];
  const before = roundState(r, r.start);
  assert.equal(before.total, 0);
  assert.equal(before.active, null);
  assert.equal(before.clipZ, Infinity);
  const mid = roundState(r, r.phases[1].times[1]);
  assert.deepEqual(mid.done, [4, 2, 0]);
  assert.equal(mid.active.axis, 1);
  const end = roundState(r, r.lastCut + 0.01);
  assert.equal(end.total, 10);
  assert.equal(end.finished, true);
  assert.equal(end.clipZ, r.phases[2].planes[2]);
});

test('active stroke progress is continuous across phase changes', () => {
  const tl = buildTimeline({ rounds: [50] });
  const r = tl.rounds[0];
  const tEnd = r.phases[0].times[r.phases[0].n - 1];
  const a = roundState(r, tEnd - 1e-4).active;
  const b = roundState(r, tEnd + 1e-4).active;
  assert.equal(a.axis, 0);
  assert.ok(a.s > 0.99);
  assert.equal(b.axis, 1);
  assert.ok(b.s < 0.01);
});

test('cutsDone and releaseTimeForZ agree with the cut schedule', () => {
  const tl = buildTimeline({ rounds: [10] });
  const r = tl.rounds[0];
  const z = r.phases[2];
  assert.equal(cutsDone(z, z.times[0]), 1);
  assert.equal(releaseTimeForZ(r, r.bbox.max[2] - 0.01), z.times[0]);
  assert.ok(releaseTimeForZ(r, r.bbox.min[2] + 0.01) > z.times[z.n - 1]);
});

test('flat items are cut only vertically and front to back', () => {
  assert.deepEqual(splitCuts(10, true), [5, 0, 5]);
  assert.deepEqual(splitCuts(1000, true), [500, 0, 500]);
  const r = buildTimeline({ rounds: [10, 100], item: 'donut' }).rounds;
  for (const round of r) {
    assert.ok(round.flat);
    assert.equal(round.split[1], 0);
    assert.equal(round.cuts, round.split[0] + round.split[2]);
    // the Z phase follows the X phase directly
    assert.ok(Math.abs(round.phases[2].start - round.phases[0].end - TIMING.phaseGap) < 1e-9);
    let prevTotal = 0;
    for (let t = round.land; t < round.end; t += 0.01) {
      const st = roundState(round, t);
      assert.ok(st.total >= prevTotal);
      prevTotal = st.total;
      if (st.active) assert.notEqual(st.active.axis, 1);
    }
    assert.equal(prevTotal, round.cuts);
  }
  assert.ok(!buildTimeline({ rounds: [10], item: 'apple' }).rounds[0].flat);
});
