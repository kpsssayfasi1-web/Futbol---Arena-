import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runToEnd, recordFrames, speedAt, PHYSICS } from '../src/sim.js';
import { findSeed } from '../src/seed-search.js';
import { buildContext } from '../src/context.js';
import { buildSoundtrack, encodeWav, SAMPLE_RATE } from '../src/audio.js';
import { runTournament } from '../../tournament/src/tournament.js';

const readJson = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const teams = readJson('../../tournament/data/teams.json');
const settings = readJson('../../tournament/data/settings.json');

test('physics is deterministic per seed and differs across seeds', () => {
  assert.deepEqual(runToEnd('a').score, runToEnd('a').score);
  const scores = new Set(Array.from({ length: 30 }, (_, i) => runToEnd(`s${i}`).score.join('-')));
  assert.ok(scores.size > 5);
});

test('match lasts the play time plus one celebration per goal', () => {
  const { score, duration, events } = runToEnd('timing');
  const goals = score[0] + score[1];
  assert.equal(events.filter((e) => e.type === 'goal').length, goals);
  assert.ok(Math.abs(duration - (PHYSICS.playSeconds + goals * PHYSICS.celebrationSeconds)) < 0.05);
  assert.equal(events.at(-1).type, 'fulltime');
});

test('balls in play stay inside the arena and speed rises late in the match', () => {
  const { frames } = recordFrames('bounds', 30);
  for (const f of frames) {
    // The scoring ball sits in the goal mouth (hidden) while the goal is celebrated.
    f.balls.forEach((b, k) => {
      if (k !== f.celebrating) assert.ok(Math.hypot(b.x, b.y) <= 1 - PHYSICS.ballRadius + 1e-6);
    });
  }
  assert.ok(speedAt(PHYSICS.playSeconds) > speedAt(0));
  assert.equal(frames.at(-1).clock, 90);
});

test('recorded frames end on the same score as a plain run', () => {
  const rec = recordFrames('same', 30);
  assert.deepEqual(rec.score, runToEnd('same').score);
  assert.deepEqual(rec.frames.at(-1).score, rec.score);
});

test('seed search finds a seed whose natural result is the target', () => {
  for (const target of [{ home: 0, away: 0 }, { home: 3, away: 1 }, { home: 1, away: 2 }]) {
    const { seed } = findSeed('TEST', target);
    assert.deepEqual(runToEnd(seed).score, [target.home, target.away]);
  }
  assert.throws(() => findSeed('TEST', { home: 30, away: 0 }, { maxTries: 5 }), /No physics seed/);
});

test('context has the group table after the match and next opponents', () => {
  const tournament = runTournament({ teams, settings, seed: 'ctx' });
  const first = tournament.matches[0];
  const ctx = buildContext(tournament, teams, first.id, 'Physics World Cup');
  assert.equal(ctx.home.code, first.home);
  assert.equal(ctx.table.length, 4);
  assert.equal(ctx.table.reduce((s, r) => s + r.played, 0), 2);
  assert.ok(ctx.next.every((n) => n && n.id > first.id));
  const final = tournament.matches.at(-1);
  const finalCtx = buildContext(tournament, teams, final.id, 'Physics World Cup');
  assert.equal(finalCtx.table, null);
  assert.deepEqual(finalCtx.next, [null, null]);
  assert.match(finalCtx.stakes, /trophy/);
  assert.throws(() => buildContext(tournament, teams, 'M999', 'x'), /not found/);
});

test('soundtrack is normalised and encodes as a valid WAV', () => {
  const { events } = runToEnd('audio');
  const samples = buildSoundtrack({ totalSeconds: 50, matchStart: 2, events, seed: 'audio' });
  assert.equal(samples.length, 50 * SAMPLE_RATE);
  const peak = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  assert.ok(peak > 0.8 && peak <= 0.9);
  const wav = encodeWav(samples.slice(0, 1000));
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.length, 44 + 2000);
});
