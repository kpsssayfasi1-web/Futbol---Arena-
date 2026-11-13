// Runs a full 48-team, 104-match tournament from a seed.

import { deriveRng, shuffle } from './rng.js';
import { expectedGoals, simulateScore, simulateShootout } from './model.js';
import { drawGroups } from './draw.js';
import { groupFixtures, computeStandings } from './groups.js';
import { buildRoundOf32, KNOCKOUT_STAGES } from './knockout.js';
import { dramaScore } from './drama.js';

const XG_DECIMALS = 100;

function roundXg(value) {
  return Math.round(value * XG_DECIMALS) / XG_DECIMALS;
}

function winnerOf(fixture, score, penalties) {
  const decider = penalties ?? score;
  if (decider.home === decider.away) return null;
  return decider.home > decider.away ? fixture.home : fixture.away;
}

function playMatch(fixture, { seed, ratings, model, knockout, attempt = 0 }) {
  const retry = attempt > 0 ? `:retry${attempt}` : '';
  const rng = deriveRng(seed, `match:${fixture.stage}:${fixture.slot}:${fixture.home}-${fixture.away}${retry}`);
  const score = simulateScore(rng, ratings[fixture.home], ratings[fixture.away], model);
  const penalties = knockout && score.home === score.away
    ? simulateShootout(rng, ratings[fixture.home], ratings[fixture.away], model)
    : null;
  const xg = expectedGoals(ratings[fixture.home], ratings[fixture.away], model);
  const match = {
    ...fixture,
    score,
    penalties,
    winner: winnerOf(fixture, score, penalties),
    expectedGoals: { home: roundXg(xg.home), away: roundXg(xg.away) },
  };
  return { ...match, drama: dramaScore(match, ratings) };
}

function loserOf(match) {
  return match.winner === match.home ? match.away : match.home;
}

// Realism rules are decided before any results are seen and apply to every
// team equally, e.g. "a pot 1 team never finishes its group on 0 points".
// A group stage that breaks a rule is re-simulated as a whole.
export function breaksRealism(standings, pots, realism) {
  const minPoints = realism?.minGroupPointsByPot ?? {};
  return Object.values(standings).flat()
    .some((row) => row.points < (minPoints[String(pots[row.team])] ?? 0));
}

function runGroupStage(groups, ctx) {
  const fixtures = groups
    .flatMap(groupFixtures)
    .sort((a, b) => a.matchday - b.matchday || a.group.localeCompare(b.group));
  const maxAttempts = ctx.realism?.maxGroupStageAttempts ?? 1;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const matches = fixtures.map((f, i) => playMatch(
      { ...f, stage: 'GROUP', slot: i + 1 },
      { ...ctx, knockout: false, attempt },
    ));
    const standings = Object.fromEntries(groups.map((g) => [g.id, computeStandings(g, matches, ctx.lotOrder)]));
    if (!breaksRealism(standings, ctx.pots, ctx.realism)) return { matches, standings, attempt };
  }
  throw new Error(`No group stage met the realism rules in ${maxAttempts} attempts; relax settings.realism`);
}

function playRound(pairs, stage, ctx) {
  return pairs.map(([home, away], i) => playMatch(
    { stage, stageLabel: KNOCKOUT_STAGES[stage], slot: i + 1, home, away },
    { ...ctx, knockout: true },
  ));
}

function pairUp(codes) {
  const pairs = [];
  for (let i = 0; i < codes.length; i += 2) pairs.push([codes[i], codes[i + 1]]);
  return pairs;
}

function runKnockout(r32Pairs, ctx) {
  const r32 = playRound(r32Pairs, 'R32', ctx);
  const r16 = playRound(pairUp(r32.map((m) => m.winner)), 'R16', ctx);
  const qf = playRound(pairUp(r16.map((m) => m.winner)), 'QF', ctx);
  const sf = playRound(pairUp(qf.map((m) => m.winner)), 'SF', ctx);
  const [third] = playRound([sf.map(loserOf)], 'THIRD', ctx);
  const [final] = playRound([sf.map((m) => m.winner)], 'FINAL', ctx);
  return { matches: [...r32, ...r16, ...qf, ...sf, third, final], final, third };
}

export function runTournament({ teams, settings, seed }) {
  const ratings = Object.fromEntries(teams.map((t) => [t.code, t.rating]));
  const lotOrder = shuffle(deriveRng(seed, 'lots'), teams.map((t) => t.code));
  const pots = Object.fromEntries(teams.map((t) => [t.code, t.pot]));
  const ctx = { seed, ratings, pots, model: settings.model, realism: settings.realism, lotOrder };

  const groups = drawGroups(teams, deriveRng(seed, 'draw'), settings.format);
  const groupStage = runGroupStage(groups, ctx);
  const { pairs, thirdsTable } = buildRoundOf32(groupStage.standings, settings.format.bestThirdsCount, lotOrder);
  const knockout = runKnockout(pairs, ctx);

  const matches = [...groupStage.matches, ...knockout.matches]
    .map((m, i) => ({ id: `M${String(i + 1).padStart(3, '0')}`, ...m }));

  return {
    seed,
    groupStageAttempt: groupStage.attempt,
    groups,
    standings: groupStage.standings,
    thirdsTable,
    matches,
    podium: {
      champion: knockout.final.winner,
      runnerUp: loserOf(knockout.final),
      third: knockout.third.winner,
      fourth: loserOf(knockout.third),
    },
  };
}
