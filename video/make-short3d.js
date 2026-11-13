#!/usr/bin/env node
// Renders one match as a 3D 3v3 street-football Short (1080x1920, 30 fps).
// Usage:
//   node make-short3d.js --match M007                 full MP4
//   node make-short3d.js --match M007 --stills 40,600  preview frames only

import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { findSeed } from './src/seed-search.js';
import { runToEnd, recordFrames, ENGINE } from './src/street/engine.js';
import { buildContext } from './src/context.js';
import { buildSoundtrack, encodeWav } from './src/audio.js';
import { hashSeed } from '../tournament/src/rng.js';
import { REPO, log, readJson, renderVideo, renderStills } from './src/host.js';

const FPS = 30;
const INTRO_SECONDS = 3;
const FULLTIME_SECONDS = 1.3;
const OUTRO_SECONDS = 5;
const PAGE = 'video/web3d/index.html';
const SEED_SEARCH_TRIES = 100000;
// Spotlights cost ~15% per frame on software GL for little visual gain.
const QUALITY = { antialias: true, shadows: true, shadowSize: 2048, spotlights: false, renderScale: 1 };

function celebrationAges(frames) {
  let start = null;
  return frames.map((f, i) => {
    if (!f.celebration) { start = null; return 0; }
    if (start === null || !frames[i - 1]?.celebration) start = f.t;
    return f.t - start;
  });
}

function minute(playTime) {
  // Same minute the scoreboard clock shows at the moment of the goal.
  return Math.max(1, Math.min(90, Math.floor((playTime / ENGINE.playSeconds) * 90)));
}

// "🇦🇷 MESSI 12', 55' · LAUTARO 30'" per team that scored.
function scorerLines(scorers, players, context) {
  return [0, 1].map((team) => {
    const goals = scorers.filter((g) => g.team === team);
    if (goals.length === 0) return null;
    const byName = new Map();
    for (const g of goals) {
      const name = g.scorer === null ? 'OG' : `${players[g.scorer].label}${g.ownGoal ? ' (OG)' : ''}`;
      byName.set(name, [...(byName.get(name) ?? []), `${minute(g.playTime)}'`]);
    }
    const flag = team === 0 ? context.home.flag : context.away.flag;
    return `${flag} ${[...byName].map(([n, m]) => `${n} ${m.join(', ')}`).join(' · ')}`;
  }).filter(Boolean);
}

function withRosters(context, rosters) {
  const squad = (code) => rosters.teams[code].map((p) => ({ number: p.number, label: p.label, name: p.name }));
  return {
    ...context,
    home: { ...context.home, players: squad(context.home.code) },
    away: { ...context.away, players: squad(context.away.code) },
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      match: { type: 'string' },
      tournament: { type: 'string', default: join(REPO, 'tournament/output/tournament.json') },
      out: { type: 'string', default: join(REPO, 'video/output') },
      stills: { type: 'string' },
    },
  });
  if (!values.match || !/^M\d{3}$/.test(values.match)) throw new Error('Pass a match id, e.g. --match M001');

  const tournament = readJson(values.tournament);
  const teams = readJson(join(REPO, 'tournament/data/teams.json'));
  const settings = readJson(join(REPO, 'tournament/data/settings.json'));
  const rosters = readJson(join(REPO, 'tournament/data/rosters.json'));
  const context = withRosters(buildContext(tournament, teams, values.match, settings.tournamentName), rosters);
  const match = tournament.matches.find((m) => m.id === values.match);

  log(`${values.match}: ${context.home.name} ${match.score.home}-${match.score.away} ${context.away.name}`);
  const { seed, attempt } = findSeed(`street:${tournament.seed}:${values.match}`, match.score, { run: runToEnd, maxTries: SEED_SEARCH_TRIES });
  log(`  physics seed found after ${attempt} tries: ${seed}`);

  const rec = recordFrames(seed, FPS);
  const players = [...context.home.players, ...context.away.players];
  const timeline = {
    intro: Math.round(INTRO_SECONDS * FPS),
    match: rec.frames.length,
    fulltime: Math.round(FULLTIME_SECONDS * FPS),
    outro: Math.round(OUTRO_SECONDS * FPS),
  };
  const totalFrames = timeline.intro + timeline.match + timeline.fulltime + timeline.outro;
  const payload = {
    seed, seedNumber: hashSeed(seed) % 997, fps: FPS, quality: QUALITY, context, timeline, players,
    frames: rec.frames, celebrationAge: celebrationAges(rec.frames),
    celebrationSeconds: ENGINE.celebrationSeconds,
    scorerLines: scorerLines(rec.scorers, players, context),
  };

  mkdirSync(values.out, { recursive: true });
  const base = join(values.out, `${values.match}-3d`);

  if (values.stills) {
    const indexes = values.stills.split(',').map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < totalFrames);
    if (indexes.length === 0) throw new Error(`--stills needs frame numbers between 0 and ${totalFrames - 1}`);
    const files = await renderStills({ pagePath: PAGE, payload, indexes, filePattern: `${base}-frame%d.jpg` });
    log(`  stills: ${files.join(', ')}`);
    return;
  }

  const wavFile = `${base}.wav`;
  writeFileSync(wavFile, encodeWav(buildSoundtrack({
    totalSeconds: totalFrames / FPS, matchStart: timeline.intro / FPS, events: rec.events, seed,
  })));
  log(`  rendering ${totalFrames} frames (${(totalFrames / FPS).toFixed(1)} s)`);
  const thumbFrame = timeline.intro + timeline.match + timeline.fulltime + Math.round(3 * FPS);
  await renderVideo({ pagePath: PAGE, payload, totalFrames, fps: FPS, outFile: `${base}.mp4`, wavFile, thumb: { frame: thumbFrame, file: `${base}-thumb.jpg` } });
  rmSync(wavFile, { force: true });
  writeFileSync(`${base}.json`, `${JSON.stringify({
    match: values.match, title: match.title, description: match.description,
    physicsSeed: seed, seedSearchTries: attempt, durationSeconds: totalFrames / FPS, scorers: payload.scorerLines,
  }, null, 2)}\n`);
  log(`  done: ${base}.mp4`);
}

main().catch((error) => {
  process.stderr.write(`Error: ${error.message}\n`);
  process.exitCode = 1;
});
