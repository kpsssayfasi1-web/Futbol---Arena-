import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeline } from '../js/timeline.js';
import { buildCameraPlan, cameraView, cameraPose } from '../js/camera.js';

const tl = buildTimeline({ item: 'mix:all', seed: 3 });

test('dynamic camera moves smoothly through every round change', () => {
  const plan = buildCameraPlan(tl, 'dynamic', 3);
  let prev = cameraPose(cameraView(plan, 0)).position;
  for (let t = 0; t <= tl.duration; t += 1 / 60) {
    const p = cameraPose(cameraView(plan, t)).position;
    assert.ok(p.every(Number.isFinite));
    assert.ok(Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]) < 0.16, `camera jump at ${t.toFixed(2)}`);
    prev = p;
  }
});

test('each round gets its own shot, the opening one is the classic framing', () => {
  const plan = buildCameraPlan(tl, 'dynamic', 3);
  const views = tl.rounds.map((r) => cameraView(plan, r.land + 0.01));
  assert.ok(Math.abs(views[0].az - 30) < 3 && Math.abs(views[0].el - 29) < 1e-9);
  for (let i = 1; i < views.length; i++) assert.ok(views[i].az !== views[i - 1].az || views[i].el !== views[i - 1].el, `round ${i}`);
  for (const v of views) assert.ok(v.dist > 10.5 && v.dist < 14 && v.el > 18 && v.el < 46);
});

test('fixed mode keeps the original framing and seeds change the shot order', () => {
  const fixed = buildCameraPlan(tl, 'fixed');
  assert.equal(cameraView(fixed, 10).dist, 12.6);
  const a = buildCameraPlan(tl, 'dynamic', 3).rounds.map((r) => r.az).join();
  const b = buildCameraPlan(tl, 'dynamic', 4).rounds.map((r) => r.az).join();
  assert.notEqual(a, b);
});
