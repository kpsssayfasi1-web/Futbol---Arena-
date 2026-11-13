// Knockout stage: best thirds, seeded round-of-32 bracket, and the
// rounds through to the final.

import { compareRows } from './groups.js';

export const KNOCKOUT_STAGES = {
  R32: 'Round of 32',
  R16: 'Round of 16',
  QF: 'Quarter-final',
  SF: 'Semi-final',
  THIRD: 'Third-place match',
  FINAL: 'Final',
};

export function rankAcrossGroups(rows, lotOrder) {
  return [...rows].sort((a, b) => compareRows(a, b, lotOrder));
}

// Standard bracket order so seed 1 and seed 2 can only meet in the final.
export function bracketOrder(size) {
  if (size === 1) return [1];
  return bracketOrder(size / 2).flatMap((seed) => [seed, size + 1 - seed]);
}

function sameGroup(pair) {
  return pair[0].group === pair[1].group;
}

// Indexes ordered by distance from `index`, so swaps stay between similar seeds.
function byDistance(index, length) {
  return Array.from({ length }, (_, j) => j)
    .filter((j) => j !== index)
    .sort((a, b) => Math.abs(a - index) - Math.abs(b - index) || a - b);
}

// Swap the lower-seeded side with the nearest pair that removes the
// group rematch without creating a new one.
function separateGroupRematches(pairs) {
  const result = pairs.map((pair) => [...pair]);
  for (let i = 0; i < result.length; i += 1) {
    if (!sameGroup(result[i])) continue;
    const swapIndex = byDistance(i, result.length).find((j) => result[j][1].group !== result[i][0].group
      && result[i][1].group !== result[j][0].group) ?? -1;
    if (swapIndex === -1) throw new Error('Could not build a round of 32 without group rematches');
    const lower = result[i][1];
    result[i] = [result[i][0], result[swapIndex][1]];
    result[swapIndex] = [result[swapIndex][0], lower];
  }
  return result;
}

// standingsByGroup: { A: [row1, row2, row3, row4], ... }
export function buildRoundOf32(standingsByGroup, bestThirdsCount, lotOrder) {
  const groups = Object.values(standingsByGroup);
  const winners = rankAcrossGroups(groups.map((g) => g[0]), lotOrder);
  const runnersUp = rankAcrossGroups(groups.map((g) => g[1]), lotOrder);
  const thirdsRanked = rankAcrossGroups(groups.map((g) => g[2]), lotOrder);
  const thirds = thirdsRanked.slice(0, bestThirdsCount);
  const seeds = [...winners, ...runnersUp, ...thirds];

  const order = bracketOrder(seeds.length);
  const pairs = [];
  for (let i = 0; i < order.length; i += 2) {
    pairs.push([seeds[order[i] - 1], seeds[order[i + 1] - 1]]);
  }
  return {
    pairs: separateGroupRematches(pairs).map(([a, b]) => [a.team, b.team]),
    thirdsTable: thirdsRanked.map((row, index) => ({ ...row, qualified: index < bestThirdsCount })),
  };
}
