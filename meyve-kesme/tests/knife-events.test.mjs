import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeline, roundState } from '../js/timeline.js';
import { knifePose, slerp, quatMul, quatAxisAngle, AXIS_QUAT } from '../js/knife-pose.js';
import { roundEvents, eventsInWindow, pickContact } from '../js/events.js';
import { buildRoundCubes } from '../js/cubes-data.js';
import { eventBank, impactGrain, PROFILES, filter, normalize, SAMPLE_RATE } from '../js/sfx.js';
import { buildLandingTrack } from '../js/landing.js';
import { renderMusic, compose, MUSIC_STYLES } from '../js/music.js';
import { mulberry32 } from '../js/rng.js';

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
    assert.ok(dist(p.pos, prev.pos) < 0.7, `jump at ${t.toFixed(3)}: ${dist(p.pos, prev.pos)}`);
    prev = p;
  }
});

test('quaternion helpers stay unit length', () => {
  const q = slerp(AXIS_QUAT[0], AXIS_QUAT[2], 0.37);
  assert.ok(Math.abs(Math.hypot(...q) - 1) < 1e-9);
  const r = quatMul(AXIS_QUAT[1], quatAxisAngle([0, 0, 1], 0.4));
  assert.ok(Math.abs(Math.hypot(...r) - 1) < 1e-9);
});

test('round events include a drop and every slow cut', () => {
  const ev = roundEvents(round);
  for (let i = 1; i < ev.length; i++) assert.ok(ev[i].t >= ev[i - 1].t);
  assert.equal(ev.filter((e) => e.type === 'drop').length, 1);
  assert.equal(ev.filter((e) => e.type === 'thock').length, round.split[0] + round.split[1] + round.split[2]);
  assert.equal(ev.filter((e) => e.type === 'slice').length, round.split[1]);
  assert.ok(ev.every((e) => e.profile === 'crisp'));
  const w = eventsInWindow(ev, round.land - 0.01, round.land + 0.01);
  assert.ok(w.some((e) => e.type === 'drop'));
});

test('fast rounds are thinned to a playable number of knife sounds', () => {
  const big = buildTimeline({ rounds: [1000] }).rounds[0];
  const thocks = roundEvents(big).filter((e) => e.type === 'thock');
  assert.ok(thocks.length < 667, `${thocks.length}`);
  assert.ok(thocks.length / (big.lastCut - big.land) < 40);
});

const peakOf = (buf) => buf.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

test('every material profile renders finite, normalised event sounds', () => {
  for (const p of PROFILES) {
    for (const [name, list] of Object.entries(eventBank(p))) {
      for (const buf of list) {
        assert.ok(buf.every(Number.isFinite), `${p}/${name}`);
        const peak = peakOf(buf);
        assert.ok(peak > 0.3 && peak <= 1, `${p}/${name} peak ${peak}`);
      }
    }
  }
});

test('impact grains: big board hits are longer-ringing than small pile taps', () => {
  const rand = mulberry32(3);
  const energyAfter = (buf, ms) => buf.slice(Math.round((ms / 1000) * SAMPLE_RATE)).reduce((s, v) => s + v * v, 0);
  const big = impactGrain(rand, { surface: 'board', size: 0.3, hard: 0.3 });
  const tap = impactGrain(rand, { surface: 'pile', size: 0.03, hard: 0.3 });
  assert.ok(energyAfter(big, 25) > energyAfter(tap, 25));
  const metal = impactGrain(rand, { surface: 'board', size: 0.1, hard: 1, metal: true });
  assert.ok(energyAfter(metal, 80) > energyAfter(big, 80), 'metal rings longest');
});

test('landing track places every cube in time and stays below clipping', () => {
  const data = buildRoundCubes(round, { budget: 50000 });
  const tr = buildLandingTrack(data, round, { cut: 'crisp', hard: 0.35 });
  let first = Infinity;
  for (let i = 0; i < data.count; i++) first = Math.min(first, data.motion[i * 4] + data.motion[i * 4 + 1]);
  assert.ok(tr.start <= first && first - tr.start < 0.05);
  assert.ok(tr.peak < 1 && tr.peak > 0.05);
  assert.equal(tr.left.length, tr.right.length);
});

test('music: every style composes a full-length, non-silent, unclipped track', () => {
  for (const s of MUSIC_STYLES) {
    const song = compose({ style: s.id, seed: 4, duration: 8 });
    assert.ok(song.events.length > 20, s.id);
    assert.ok(song.events.some((e) => ['oboe', 'accordion', 'vibes'].includes(e.inst)), `${s.id} has a lead`);
  }
  const m = renderMusic({ style: 'waltz', seed: 2, duration: 6 });
  assert.ok(m.left.length >= 6 * m.sampleRate);
  const peak = peakOf(m.left);
  assert.ok(peak > 0.3 && peak <= 0.86, `peak ${peak}`);
  const again = renderMusic({ style: 'waltz', seed: 2, duration: 6 });
  assert.equal(again.left[12345], m.left[12345], 'deterministic');
  const other = renderMusic({ style: 'waltz', seed: 3, duration: 6 });
  assert.notEqual(other.left[48000 * 3], m.left[48000 * 3], 'new seed, new music');
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

test('jazz: minor-key swing with a walking upright bass on every beat', () => {
  const song = compose({ style: 'jazz', seed: 1, duration: 20 });
  assert.equal(song.key, 62, 'default seed plays in D minor like the reference');
  assert.ok(song.bpm >= 140 && song.bpm <= 152, `bpm ${song.bpm}`);
  const bass = song.events.filter((e) => e.inst === 'upright');
  const bars = Math.floor(20 / song.barDur);
  assert.ok(bass.length >= bars * 4, `${bass.length} bass notes for ${bars} bars`);
  assert.ok(bass.every((e) => e.midi >= 30 && e.midi <= 56), 'bass stays in the upright register');
  assert.ok(song.events.some((e) => e.inst === 'jazzRide') && song.events.some((e) => e.inst === 'sweep'), 'brush kit');
  const m = renderMusic({ style: 'jazz', seed: 1, duration: 4 });
  assert.ok(m.left.every(Number.isFinite));
  const peak = peakOf(m.left);
  assert.ok(peak > 0.3 && peak <= 0.86, `peak ${peak}`);
});

test('fast cuts use a short swish instead of a sped-up one', () => {
  const big = buildTimeline({ rounds: [1000] }).rounds[0];
  const cuts = roundEvents(big).filter((e) => e.type === 'cut' || e.type === 'slice');
  assert.ok(cuts.every((e) => e.rate >= 1 && e.rate <= 1.25), 'no pitch-shifted swishes');
  const lens = eventBank('crisp');
  assert.ok(cuts.every((e) => e.variant < lens[e.type].length));
  assert.ok(cuts.some((e) => e.variant >= 6), 'short variants are used in dense passages');
  const { block, rate, lead } = pickContact([0.1, 0.06, 0.036], 0.04);
  assert.equal(block, 2);
  assert.ok(Math.abs(lead - 0.036 / rate) < 1e-12 && lead <= 0.04 + 1e-9);
});
