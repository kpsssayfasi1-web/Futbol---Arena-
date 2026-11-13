// Drama score (0-100): how exciting a result is likely to feel.
// Used to rank highlights for long-form compilations and to pick the
// tone of titles. Uses only the model result (no physics timeline yet).

const STAGE_WEIGHT = { GROUP: 0, R32: 5, R16: 10, QF: 15, SF: 20, THIRD: 5, FINAL: 30 };
const UPSET_POINTS_PER_RATING = 2;
const UPSET_DRAW_POINTS_PER_RATING = 1;
const GOAL_POINTS = 4;
const MAX_GOAL_POINTS = 24;
const CLOSE_GAME_POINTS = 12;
const SHOOTOUT_POINTS = 18;
const MAX_SCORE = 100;

function upsetPoints(match, ratings) {
  const homeRating = ratings[match.home];
  const awayRating = ratings[match.away];
  const underdogWon = match.winner && ratings[match.winner] < Math.max(homeRating, awayRating);
  const gap = Math.abs(homeRating - awayRating);
  if (underdogWon) return gap * UPSET_POINTS_PER_RATING;
  if (match.score.home === match.score.away && !match.penalties) return gap * UPSET_DRAW_POINTS_PER_RATING;
  return 0;
}

export function dramaScore(match, ratings) {
  const goals = match.score.home + match.score.away;
  const margin = Math.abs(match.score.home - match.score.away);
  const total = upsetPoints(match, ratings)
    + Math.min(MAX_GOAL_POINTS, goals * GOAL_POINTS)
    + (margin <= 1 ? CLOSE_GAME_POINTS : 0)
    + (match.penalties ? SHOOTOUT_POINTS : 0)
    + (STAGE_WEIGHT[match.stage] ?? 0);
  return Math.min(MAX_SCORE, Math.round(total));
}
