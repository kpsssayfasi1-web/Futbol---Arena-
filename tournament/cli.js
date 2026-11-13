#!/usr/bin/env node
// Usage:
//   node cli.js --seed season-1 --start 2026-12-01   generate a tournament
//   node cli.js --odds 5000                           calibration odds

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { validateTeams, validateSettings } from './src/validate.js';
import { runTournament } from './src/tournament.js';
import { scheduleMatches } from './src/schedule.js';
import { withPublishingText } from './src/titles.js';
import { buildSummary, buildScheduleCsv } from './src/report.js';
import { championOdds } from './src/odds.js';

const ROOT = dirname(fileURLToPath(import.meta.url));

function readJson(relativePath) {
  const path = join(ROOT, relativePath);
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read ${relativePath}: ${error.message}`);
  }
}

function printOdds(teams, settings, runs) {
  const odds = championOdds({ teams, settings, runs });
  process.stdout.write(`Champion odds over ${runs} simulated tournaments:\n`);
  for (const o of odds) {
    process.stdout.write(`${o.name.padEnd(14)} ${String(o.rating).padStart(3)}  champion ${(o.champion * 100).toFixed(1).padStart(5)}%  final ${(o.final * 100).toFixed(1).padStart(5)}%\n`);
  }
}

function generate(teams, settings, seed, start, outDir) {
  const result = runTournament({ teams, settings, seed });
  const scheduled = scheduleMatches(result.matches, start, settings.schedule);
  const matches = withPublishingText(scheduled, teams, settings.tournamentName);
  const full = { ...result, startDate: start, matches };

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'tournament.json'), `${JSON.stringify(full, null, 2)}\n`);
  writeFileSync(join(outDir, 'schedule.csv'), buildScheduleCsv(matches));
  writeFileSync(join(outDir, 'summary.md'), buildSummary(full, teams, settings.tournamentName));

  const lastDay = Math.max(...matches.map((m) => m.publishDay));
  process.stdout.write(`Generated ${matches.length} matches over ${lastDay} days into ${outDir}\n`);
}

function main() {
  const { values } = parseArgs({
    options: {
      seed: { type: 'string', default: 'season-1' },
      start: { type: 'string', default: '2026-12-01' },
      out: { type: 'string', default: join(ROOT, 'output') },
      odds: { type: 'string' },
    },
  });
  const settings = validateSettings(readJson('data/settings.json'));
  const teams = validateTeams(readJson('data/teams.json'), settings.format);

  if (values.odds !== undefined) {
    const runs = Number(values.odds);
    if (!Number.isInteger(runs) || runs <= 0) throw new Error('--odds needs a positive whole number');
    printOdds(teams, settings, runs);
    return;
  }
  generate(teams, settings, values.seed, values.start, values.out);
}

try {
  main();
} catch (error) {
  process.stderr.write(`Error: ${error.message}\n`);
  process.exitCode = 1;
}
