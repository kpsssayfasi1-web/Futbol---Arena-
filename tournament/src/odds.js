// Monte Carlo calibration: run many tournaments and report how often
// each team wins. Use this after editing ratings or model settings.

import { runTournament } from './tournament.js';

export function championOdds({ teams, settings, runs, seedPrefix = 'odds' }) {
  if (!Number.isInteger(runs) || runs <= 0) throw new RangeError('runs must be a positive integer');
  const titles = Object.fromEntries(teams.map((t) => [t.code, 0]));
  const finals = { ...titles };
  for (let i = 0; i < runs; i += 1) {
    const { podium } = runTournament({ teams, settings, seed: `${seedPrefix}-${i}` });
    titles[podium.champion] += 1;
    finals[podium.champion] += 1;
    finals[podium.runnerUp] += 1;
  }
  return teams
    .map((t) => ({ code: t.code, name: t.name, rating: t.rating, champion: titles[t.code] / runs, final: finals[t.code] / runs }))
    .sort((a, b) => b.champion - a.champion || b.rating - a.rating);
}
