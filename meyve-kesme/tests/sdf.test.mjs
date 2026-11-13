import test from 'node:test';
import assert from 'node:assert/strict';
import { compileJs, compileGlsl } from '../js/sdf.js';
import { surfaceNets } from '../js/mesher.js';
import { objectInfo, estimateCellCount } from '../js/object-info.js';

const close = (a, b, e = 1e-6) => Math.abs(a - b) < e;

test('primitive distances are exact where they should be', () => {
  const s = compileJs({ type: 'sphere', at: [1, 0, 0], r: 0.5 }).sdf;
  assert.ok(close(s(1, 0, 0), -0.5));
  assert.ok(close(s(2, 0, 0), 0.5));
  const b = compileJs({ type: 'box', size: [1, 2, 3] }).sdf;
  assert.ok(close(b(2, 0, 0), 1));
  assert.ok(close(b(0, 0, 0), -1));
  const c = compileJs({ type: 'cylinder', r: 1, h: 0.5 }).sdf;
  assert.ok(close(c(0, 1, 0), 0.5));
  assert.ok(close(c(2, 0, 0), 1));
  const t = compileJs({ type: 'torus', R: 1, r: 0.2 }).sdf;
  assert.ok(close(t(1, 0, 0), -0.2));
  const k = compileJs({ type: 'capsule', a: [0, 0, 0], b: [0, 2, 0], r: 0.5 }).sdf;
  assert.ok(close(k(0, 3, 0), 0.5));
  const cone = compileJs({ type: 'cone', r1: 1, r2: 0.2, h: 1 }).sdf;
  assert.ok(cone(0, 0, 0) < 0 && cone(0, 1.5, 0) > 0 && cone(1.5, -1, 0) > 0);
});

test('axis and rotation move the primitive', () => {
  const x = compileJs({ type: 'cylinder', r: 0.2, h: 1, axis: 'x' }).sdf;
  assert.ok(x(0.9, 0, 0) < 0 && x(0, 0.9, 0) > 0);
  const r = compileJs({ type: 'box', size: [1, 0.1, 0.1], rot: [0, 0, Math.PI / 2] }).sdf;
  assert.ok(r(0, 0.9, 0) < 0 && r(0.9, 0, 0) > 0);
});

test('operations combine shapes and report the part that is nearest', () => {
  const u = compileJs({ op: 'union', of: [{ type: 'sphere', at: [-1, 0, 0], r: 0.6, part: 0 }, { type: 'sphere', at: [1, 0, 0], r: 0.6, part: 3 }] });
  assert.ok(u.sdf(-1, 0, 0) < 0 && u.sdf(1, 0, 0) < 0 && u.sdf(0, 0, 0) > 0);
  assert.equal(u.part(1, 0, 0), 3);
  assert.equal(u.part(-1, 0, 0), 0);
  const smooth = compileJs({ op: 'union', k: 0.6, of: [{ type: 'sphere', at: [-0.5, 0, 0], r: 0.4 }, { type: 'sphere', at: [0.5, 0, 0], r: 0.4 }] });
  assert.ok(smooth.sdf(0, 0, 0) < 0, 'smooth union fills the gap');
  const sub = compileJs({ op: 'subtract', from: { type: 'sphere', r: 1, part: 2 }, cut: [{ type: 'sphere', r: 0.5 }] });
  assert.ok(sub.sdf(0, 0, 0) > 0 && sub.sdf(0.75, 0, 0) < 0);
  assert.equal(sub.part(0.75, 0, 0), 2);
});

test('compileGlsl emits one function covering every node', () => {
  const g = compileGlsl({ op: 'subtract', k: 0.1, from: { op: 'union', of: [{ type: 'sphere', r: 1 }, { type: 'box', size: [1, 1, 1], rot: [0.1, 0.2, 0.3], lobes: { n: 5, amp: 0.1 } }] }, cut: [{ type: 'capsule', a: [0, 0, 0], b: [0, 1, 0], r: [0.1, 0.2] }] });
  assert.match(g, /^float objMap\(vec3 p, out float part\)/);
  assert.match(g, /sdBox/);
  assert.match(g, /sdCapsule/);
  assert.match(g, /sdSmax/);
  assert.equal((g.match(/\{/g) || []).length, (g.match(/\}/g) || []).length);
});

test('surface nets produce a closed, outward facing sphere mesh', () => {
  const { sdf } = compileJs({ type: 'sphere', r: 1 });
  const m = surfaceNets(sdf, { min: [-1.2, -1.2, -1.2], max: [1.2, 1.2, 1.2] }, 40);
  assert.ok(m.index.length > 1000);
  let outward = 0;
  for (let t = 0; t < m.index.length; t += 3) {
    const [a, b, c] = [m.index[t] * 3, m.index[t + 1] * 3, m.index[t + 2] * 3];
    const p = m.positions;
    const e1 = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]];
    const e2 = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (n[0] * p[a] + n[1] * p[a + 1] + n[2] * p[a + 2] > 0) outward++;
  }
  assert.ok(outward / (m.index.length / 3) > 0.99, `outward ${outward}`);
  for (let v = 0; v < m.positions.length; v += 3) {
    assert.ok(Math.abs(Math.hypot(m.positions[v], m.positions[v + 1], m.positions[v + 2]) - 1) < 0.01);
  }
});

test('objectInfo measures a known box', () => {
  const item = { id: 'test-box', shape: { type: 'box', size: [0.5, 0.25, 0.5] }, bounds: [[-1, -1, -1], [1, 1, 1]] };
  const info = objectInfo(item);
  assert.ok(Math.abs(info.boardY + 0.25) < 0.005, `board ${info.boardY}`);
  assert.ok(Math.abs(info.volume - 0.5) < 0.05, `volume ${info.volume}`);
  assert.ok(info.footprint(0, 0) && !info.footprint(0.9, 0.9));
  const est = estimateCellCount(info, 0.5, 0.5, 0.5);
  assert.ok(est > 15 && est < 20, `${est}`);
});
