import test from 'node:test';
import assert from 'node:assert/strict';
import { splitCuts, phaseDuration, planePositions, cutTimes, buildTimeline, roundState, cutsDone, releaseTimeForZ, roundIndexAt, cubeLayers, ROUND_PRESETS, TIMING } from '../js/timeline.js';

test('splitCuts: half top-down, one horizontal pass, the rest front to back', () => {
  assert.deepEqual(splitCuts(10), [5, 1, 4]);
  assert.deepEqual(splitCuts(50), [25, 1, 24]);
  assert.deepEqual(splitCuts(1000), [500, 1, 499]);
  for (const n of [3, 7, 50, 251, 5000]) {
    const s = splitCuts(n);
    assert.equal(s[0] + s[1] + s[2], n);
    assert.equal(s[1], 1);
    assert.ok(s.every((v) => v >= 1));
  }
});

test('cube layers make the pieces roughly cubic', () => {
  const bbox = { min: [-1, -0.25, -0.5], max: [1, 0.25, 0.5] }; // a bar of soap
  assert.equal(cubeLayers([5, 1, 4], bbox), 2);
  const split = [500, 1, 499];
  const L = cubeLayers(split, bbox);
  const cell = [2 / 501, 0.5 / L, 1 / 500];
  assert.ok(cell[1] / cell[0] > 0.7 && cell[1] / cell[0] < 1.5, `layers ${L}`);
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

test('cutTimes keep an even beat and end exactly at the phase end', () => {
  const t = cutTimes(20, 2, 4);
  assert.equal(t[19], 6);
  for (let i = 1; i < t.length; i++) assert.ok(Math.abs(t[i] - t[i - 1] - 0.2) < 1e-9);
  const fast = cutTimes(20, 2, 4, 0.7);
  assert.ok(fast[1] - fast[0] > fast[19] - fast[18], 'accel < 1 still speeds up');
});

test('round lengths follow the reference: ~6 s opening, ~10-13 s after, ~70 s in all', () => {
  const tl = buildTimeline({ rounds: ROUND_PRESETS.classic });
  const len = tl.rounds.map((r) => r.end - r.start);
  assert.ok(len[0] > 5 && len[0] < 7.5, `round 1: ${len[0]}`);
  for (let i = 1; i < 5; i++) assert.ok(len[i] > 9 && len[i] < 14.5, `round ${i + 1}: ${len[i]}`);
  // the opening round is cut at about two cuts per second
  const x = tl.rounds[0].phases[0];
  assert.ok(x.times[1] - x.times[0] > 0.35 && x.times[1] - x.times[0] < 0.6);
  // every round starts on a resting item: no drop, the knife waits briefly
  for (const r of tl.rounds) {
    assert.equal(r.land, r.start);
    assert.ok(Math.abs(r.ready - r.start - TIMING.ready) < 1e-9);
  }
});

test('buildTimeline chains rounds back to back', () => {
  const tl = buildTimeline({ rounds: ROUND_PRESETS.classic });
  assert.equal(tl.rounds.length, 6);
  for (let i = 1; i < tl.rounds.length; i++) assert.equal(tl.rounds[i].start, tl.rounds[i - 1].end);
  assert.equal(tl.duration, tl.rounds[5].end);
  assert.ok(tl.duration > 60 && tl.duration < 76, `duration ${tl.duration}`);
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
  const mid = roundState(r, (r.phases[1].start + r.phases[1].end) / 2);
  assert.deepEqual(mid.done, [5, 0, 0]);
  assert.equal(mid.active.axis, 1);
  assert.equal(roundState(r, r.phases[1].end + 0.01).done[1], 1);
  const end = roundState(r, r.lastCut + 0.01);
  assert.equal(end.total, 10);
  assert.equal(end.finished, true);
  assert.equal(end.clipZ, r.phases[2].planes[3]);
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
