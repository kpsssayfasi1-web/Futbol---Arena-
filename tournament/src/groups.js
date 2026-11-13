// Group stage: fixtures (6 matches over 3 matchdays) and standings.

// Positions are pot order inside the group (0 = pot 1 team, 3 = pot 4 team).
const MATCHDAY_PAIRS = [
  [[0, 1], [2, 3]],
  [[0, 2], [3, 1]],
  [[3, 0], [1, 2]],
];

export function groupFixtures(group) {
  return MATCHDAY_PAIRS.flatMap((pairs, index) => pairs.map(([h, a]) => ({
    group: group.id,
    matchday: index + 1,
    home: group.teams[h],
    away: group.teams[a],
  })));
}

function emptyRow(code) {
  return { team: code, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0 };
}

function applyResult(row, scored, conceded) {
  const won = scored > conceded ? 1 : 0;
  const drawn = scored === conceded ? 1 : 0;
  return {
    ...row,
    played: row.played + 1,
    won: row.won + won,
    drawn: row.drawn + drawn,
    lost: row.lost + (1 - won - drawn),
    goalsFor: row.goalsFor + scored,
    goalsAgainst: row.goalsAgainst + conceded,
    goalDiff: row.goalDiff + scored - conceded,
    points: row.points + won * 3 + drawn,
  };
}

// Higher is better on points, goal difference, goals scored; ties beyond
// that are broken by a pre-drawn lot order (lower index wins).
export function compareRows(a, b, lotOrder) {
  return (b.points - a.points)
    || (b.goalDiff - a.goalDiff)
    || (b.goalsFor - a.goalsFor)
    || (lotOrder.indexOf(a.team) - lotOrder.indexOf(b.team));
}

export function computeStandings(group, matches, lotOrder) {
  const initial = Object.fromEntries(group.teams.map((code) => [code, emptyRow(code)]));
  const rows = matches
    .filter((m) => m.group === group.id)
    .reduce((acc, m) => ({
      ...acc,
      [m.home]: applyResult(acc[m.home], m.score.home, m.score.away),
      [m.away]: applyResult(acc[m.away], m.score.away, m.score.home),
    }), initial);
  return Object.values(rows)
    .sort((a, b) => compareRows(a, b, lotOrder))
    .map((row, index) => ({ ...row, group: group.id, position: index + 1 }));
}
