// Group draw: one team from each pot per group, with confederation
// limits (e.g. at most 3 UEFA teams and 1 from any other confederation
// per group). Randomised backtracking guarantees a valid draw.

import { shuffle } from './rng.js';

export const GROUP_IDS = 'ABCDEFGHIJKL'.split('');
const MAX_DRAW_STEPS = 200000;

function limitFor(confederation, limits) {
  return limits[confederation] ?? limits.default;
}

function fits(group, team, limits) {
  const sameConfederation = group.filter((t) => t.confederation === team.confederation).length;
  return sameConfederation < limitFor(team.confederation, limits);
}

// Cheap up-front check so clearly impossible limits fail instantly
// instead of sending the backtracking search into an exhaustive crawl.
function assertFeasible(teams, groupCount, limits) {
  const counts = {};
  for (const t of teams) counts[t.confederation] = (counts[t.confederation] ?? 0) + 1;
  for (const [confederation, count] of Object.entries(counts)) {
    const capacity = limitFor(confederation, limits) * groupCount;
    if (count > capacity) {
      throw new Error(`Group draw failed: confederation limits allow ${capacity} ${confederation} teams, but there are ${count}`);
    }
  }
}

export function drawGroups(teams, rng, { groupCount, teamsPerGroup, confederationLimits }) {
  assertFeasible(teams, groupCount, confederationLimits);
  const order = [];
  for (let pot = 1; pot <= teamsPerGroup; pot += 1) {
    order.push(...shuffle(rng, teams.filter((t) => t.pot === pot)));
  }
  const slots = Array.from({ length: groupCount }, () => []);
  const groupIndexes = Array.from({ length: groupCount }, (_, i) => i);

  let steps = 0;
  const place = (position) => {
    if (position === order.length) return true;
    steps += 1;
    if (steps > MAX_DRAW_STEPS) return false;
    const team = order[position];
    for (const g of shuffle(rng, groupIndexes)) {
      const group = slots[g];
      if (group.length === team.pot - 1 && fits(group, team, confederationLimits)) {
        group.push(team);
        if (place(position + 1)) return true;
        group.pop();
      }
    }
    return false;
  };

  if (!place(0)) {
    throw new Error('Group draw failed: confederation limits cannot be satisfied with these pots');
  }
  return slots.map((group, i) => ({
    id: GROUP_IDS[i],
    teams: group.map((t) => t.code),
  }));
}
