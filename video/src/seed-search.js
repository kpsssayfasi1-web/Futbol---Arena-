// Finds a physics seed whose natural, unedited outcome equals the score
// the tournament model chose. Nothing inside the match is altered.

import { runToEnd, PHYSICS } from './sim.js';

export const DEFAULT_MAX_TRIES = 50000;

export function findSeed(matchId, target, { maxTries = DEFAULT_MAX_TRIES, physics = PHYSICS, run = (seed) => runToEnd(seed, physics) } = {}) {
  for (let attempt = 0; attempt < maxTries; attempt += 1) {
    const seed = `${matchId}:${attempt}`;
    const { score } = run(seed);
    if (score[0] === target.home && score[1] === target.away) return { seed, attempt: attempt + 1 };
  }
  throw new Error(`No physics seed produced ${target.home}-${target.away} for ${matchId} within ${maxTries} tries`);
}
