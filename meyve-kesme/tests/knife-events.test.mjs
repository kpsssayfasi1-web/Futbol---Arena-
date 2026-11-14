import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeline, roundState } from '../js/timeline.js';
import { knifePose, slerp, quatMul, quatAxisAngle, AXIS_QUAT } from '../js/knife-pose.js';
import { roundEvents, eventsInWindow, pickContact } from '../js/events.js';
import { runJob } from '../js/work.js';
import { eventBank, PROFILES, filter, normalize, SAMPLE_RATE } from '../js/sfx.js';
import { renderMusic, compose, MUSIC_STYLES } from '../js/music.js';

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
  assert.equal(ev.filter((e) => e.type === 'thock').length, round.split[0] + round.split[2]);
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

test('horizontal slices are a slide only: no board knock under the blade', () => {
  const ev = roundEvents(round);
  const slices = round.phases[1];
  for (const t of slices.times) {
    assert.ok(!ev.some((e) => e.type === 'thock' && Math.abs(e.t - t) < 0.02), `knock at slice ${t}`);
  }
  assert.ok(!ev.some((e) => e.type === 'crumble'), 'no falling-cube sounds');
});

// Short-time energy in windows of `ms`, used to look at a sound's envelope.
const frames = (buf, ms) => {
  const w = Math.round((ms / 1000) * SAMPLE_RATE);
  const out = [];
  for (let i = 0; i + w <= buf.length; i += w) out.push(buf.slice(i, i + w).reduce((s, v) => s + v * v, 0) / w);
  return out;
};

test('slice sounds glide smoothly, with no click or knock in them', () => {
  for (const p of PROFILES) {
    for (const buf of eventBank(p).slice) {
      const fine = frames(buf, 1);
      const coarse = frames(buf, 12);
      // A transient shows up as a 1 ms window far louder than its 12 ms surroundings.
      const ratio = Math.max(...fine) / Math.max(...coarse);
      assert.ok(ratio < 3, `${p} slice transient ratio ${ratio.toFixed(2)}`);
    }
  }
});

// Spectral centroid (Hz) of the first `ms` of a sound, by direct DFT.
function centroid(buf, ms = 60) {
  const n = Math.min(buf.length, Math.round((ms / 1000) * SAMPLE_RATE));
  let num = 0;
  let den = 0;
  for (let f = 40; f < 12000; f += 40) {
    let re = 0;
    let im = 0;
    const w = (2 * Math.PI * f) / SAMPLE_RATE;
    for (let i = 0; i < n; i++) {
      re += buf[i] * Math.cos(w * i);
      im += buf[i] * Math.sin(w * i);
    }
    const mag = Math.hypot(re, im);
    num += f * mag;
    den += mag;
  }
  return num / den;
}

test('board knock: a short, woody tok centred in the low mids', () => {
  for (const buf of eventBank('crisp').thock) {
    const c = centroid(buf);
    assert.ok(c > 500 && c < 2200, `centroid ${c.toFixed(0)} Hz`);
    const e = frames(buf, 10);
    const total = e.reduce((s, v) => s + v, 0);
    const late = e.slice(12).reduce((s, v) => s + v, 0);
    assert.ok(late / total < 0.02, `tail after 120 ms ${(late / total).toFixed(3)}`);
    assert.ok(e.indexOf(Math.max(...e)) <= 1, 'attack within the first 20 ms');
  }
});

test('falling cubes make no sound: the cube job carries no landing track', () => {
  const { result } = runJob({ kind: 'cubes', params: { rounds: [10] }, index: 0, budget: 20000 });
  assert.ok(result.count > 0);
  assert.equal(result.landing, undefined);
});

test('music: every style composes a full-length, non-silent, unclipped track', () => {
  for (const s of MUSIC_STYLES) {
    const song = compose({ style: s.id, seed: 4, duration: 8 });
    assert.ok(song.events.length > 20, s.id);
    assert.ok(song.events.some((e) => ['vibes', 'jazzPizz'].includes(e.inst)), `${s.id} has a lead`);
    assert.ok(song.events.some((e) => e.inst === 'upright'), `${s.id} has a bass`);
  }
  assert.deepEqual(MUSIC_STYLES.map((s) => s.id), ['jazz', 'pizzicato', 'noir']);
  const m = renderMusic({ style: 'noir', seed: 2, duration: 6 });
  assert.ok(m.left.length >= 6 * m.sampleRate);
  const peak = peakOf(m.left);
  assert.ok(peak > 0.3 && peak <= 0.86, `peak ${peak}`);
  const again = renderMusic({ style: 'noir', seed: 2, duration: 6 });
  assert.equal(again.left[12345], m.left[12345], 'deterministic');
  const other = renderMusic({ style: 'noir', seed: 3, duration: 6 });
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

test('jazz presets differ in tempo and feel', () => {
  const tempo = (style) => compose({ style, seed: 1, duration: 10 }).bpm;
  assert.ok(tempo('noir') < tempo('jazz') && tempo('jazz') < tempo('pizzicato'));
  const piz = compose({ style: 'pizzicato', seed: 1, duration: 20 });
  assert.ok(piz.events.some((e) => e.inst === 'snap'), 'finger snaps');
  assert.ok(!piz.events.some((e) => e.inst === 'snare'));
});

test('flat items: the knife goes straight from the last vertical chop to the front-to-back chops', () => {
  const flat = buildTimeline({ rounds: [10], item: 'donut' }).rounds[0];
  const at = (t) => knifePose(flat, roundState(flat, t), t);
  let prev = at(flat.start);
  for (let t = flat.start; t < flat.end; t += 1 / 240) {
    const p = at(t);
    assert.ok(p.pos.every(Number.isFinite), `finite at ${t}`);
    assert.ok(dist(p.pos, prev.pos) < 0.7, `jump at ${t.toFixed(3)}`);
    prev = p;
  }
  assert.ok(!roundEvents(flat).some((e) => e.type === 'slice'));
});
