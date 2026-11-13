// Result model: ratings decide the odds, not the physics.
// Expected goals follow a log-linear model on the rating difference,
// actual goals are Poisson draws around those expectations.

import { samplePoisson } from './rng.js';

const REGULATION_KICKS = 5;
const MIN_PENALTY_PROB = 0.5;
const MAX_PENALTY_PROB = 0.95;

export function expectedGoals(homeRating, awayRating, { baseGoals, ratingFactor }) {
  const diff = homeRating - awayRating;
  return {
    home: baseGoals * Math.exp(ratingFactor * diff),
    away: baseGoals * Math.exp(-ratingFactor * diff),
  };
}

export function simulateScore(rng, homeRating, awayRating, model) {
  const xg = expectedGoals(homeRating, awayRating, model);
  return {
    home: samplePoisson(rng, xg.home),
    away: samplePoisson(rng, xg.away),
  };
}

function penaltyProbability(ownRating, opponentRating, { penaltyBase, penaltyEdgePerPoint }) {
  const raw = penaltyBase + penaltyEdgePerPoint * (ownRating - opponentRating);
  return Math.min(MAX_PENALTY_PROB, Math.max(MIN_PENALTY_PROB, raw));
}

function isDecided(goals, taken) {
  const remainingHome = REGULATION_KICKS - taken.home;
  const remainingAway = REGULATION_KICKS - taken.away;
  return goals.home > goals.away + remainingAway || goals.away > goals.home + remainingHome;
}

// Returns a realistic shootout score such as { home: 4, away: 3 }.
export function simulateShootout(rng, homeRating, awayRating, model) {
  const pHome = penaltyProbability(homeRating, awayRating, model);
  const pAway = penaltyProbability(awayRating, homeRating, model);
  const goals = { home: 0, away: 0 };
  const taken = { home: 0, away: 0 };

  for (let round = 0; round < REGULATION_KICKS; round += 1) {
    taken.home += 1;
    if (rng.next() < pHome) goals.home += 1;
    if (isDecided(goals, taken)) return { ...goals };
    taken.away += 1;
    if (rng.next() < pAway) goals.away += 1;
    if (isDecided(goals, taken)) return { ...goals };
  }

  // Sudden death: one kick each until the round ends unequal.
  while (goals.home === goals.away) {
    if (rng.next() < pHome) goals.home += 1;
    if (rng.next() < pAway) goals.away += 1;
  }
  return { ...goals };
}
