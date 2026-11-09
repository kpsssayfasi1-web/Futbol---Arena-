import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import {getStateAtFrame} from './frameCache.ts';
import {advanceTo, createSimulation, stepForFrame, type SimulationState} from './simulation.ts';

const OPTIONS = {width: 360, height: 536, seed: 2024};
const TWENTY_SECONDS = stepForFrame(600, 30);

const snapshot = (s: SimulationState) => JSON.stringify({
  elapsed: s.elapsed, angle: s.angle, scoreA: s.scoreA, scoreB: s.scoreB,
  balls: s.balls, particles: s.particles,
});

describe('simulation', () => {
  test('aynı seed aynı maçı üretir', () => {
    const a = createSimulation(OPTIONS);
    const b = createSimulation(OPTIONS);
    advanceTo(a, TWENTY_SECONDS);
    advanceTo(b, TWENTY_SECONDS);
    assert.equal(snapshot(a), snapshot(b));
  });

  test('farklı seed farklı maç üretir', () => {
    const a = createSimulation(OPTIONS);
    const b = createSimulation({...OPTIONS, seed: 7});
    advanceTo(a, TWENTY_SECONDS);
    advanceTo(b, TWENTY_SECONDS);
    assert.notEqual(snapshot(a), snapshot(b));
  });

  test('toplar gol dışında arenanın içinde kalır ve hızını korur', () => {
    const s = createSimulation(OPTIONS);
    const {cx, cy, radius} = s.arena;
    for (let step = 1; step <= TWENTY_SECONDS; step++) {
      advanceTo(s, step);
      for (const b of s.balls) {
        assert.ok(Math.hypot(b.x - cx, b.y - cy) <= radius, `adım ${step}: top arena dışında`);
        assert.ok(Math.abs(Math.hypot(b.vx, b.vy) - b.target) < 1e-6, `adım ${step}: hız değişti`);
      }
    }
  });

  test('20 saniyede gol atılır ve skorlar toplam gole eşittir', () => {
    const s = createSimulation(OPTIONS);
    advanceTo(s, TWENTY_SECONDS);
    assert.ok(s.goalCount > 0);
    assert.equal(s.scoreA + s.scoreB, s.goalCount);
  });

  test('geriye doğru ilerletme reddedilir', () => {
    const s = createSimulation(OPTIONS);
    advanceTo(s, 10);
    assert.throws(() => advanceTo(s, 5), RangeError);
  });

  test('stepForFrame 30 fps için kare başına 4 fizik adımı verir', () => {
    assert.equal(stepForFrame(0, 30), 0);
    assert.equal(stepForFrame(1, 30), 4);
    assert.equal(stepForFrame(600, 30), 2400);
  });
});

describe('frameCache', () => {
  test('sırasız kare istekleri sıralı simülasyonla aynı sonucu verir', () => {
    const opts = {...OPTIONS, seed: 99};
    const late = snapshot(getStateAtFrame(opts, 300, 30));
    getStateAtFrame(opts, 10, 30); // geriye atla: baştan simüle eder
    const again = snapshot(getStateAtFrame(opts, 300, 30));
    const fresh = createSimulation(opts);
    advanceTo(fresh, stepForFrame(300, 30));
    assert.equal(late, again);
    assert.equal(late, snapshot(fresh));
  });
});
