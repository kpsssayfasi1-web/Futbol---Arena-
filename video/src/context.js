// Builds everything the renderer needs to know about one match: teams,
// header labels, the group table after the match and each team's next game.

import { computeStandings } from '../../tournament/src/groups.js';

function teamView(team) {
  return {
    code: team.code, name: team.name, flag: team.flag, iso2: team.iso2,
    colors: team.colors, rating: team.rating,
  };
}

function headerFor(match) {
  if (match.stage === 'GROUP') return { stage: `GROUP ${match.group}`, detail: `MATCHDAY ${match.matchday}` };
  return { stage: match.stageLabel.toUpperCase(), detail: match.stage === 'FINAL' ? 'FOR THE TROPHY' : 'WIN OR GO HOME' };
}

function stakesFor(match, home, away) {
  if (match.stage !== 'GROUP') return match.stage === 'FINAL' ? 'Winner lifts the trophy 🏆' : 'Loser is eliminated';
  const gap = home.rating - away.rating;
  if (Math.abs(gap) >= 12) {
    const underdog = gap > 0 ? away : home;
    return `Can ${underdog.name} pull off the upset?`;
  }
  return `Top 2 + best thirds reach the Round of 32`;
}

function groupTableAfter(tournament, match) {
  if (match.stage !== 'GROUP') return null;
  const group = tournament.groups.find((g) => g.id === match.group);
  const played = tournament.matches.filter((m) => m.group === match.group && m.id <= match.id);
  return computeStandings(group, played, group.teams).map((r) => ({
    team: r.team, played: r.played, goalDiff: r.goalDiff, points: r.points,
  }));
}

function nextMatchFor(tournament, match, code) {
  const next = tournament.matches.find((m) => m.id > match.id && (m.home === code || m.away === code));
  if (!next) return null;
  return { id: next.id, opponent: next.home === code ? next.away : next.home };
}

export function buildContext(tournament, teams, matchId, tournamentName) {
  const match = tournament.matches.find((m) => m.id === matchId);
  if (!match) throw new Error(`Match ${matchId} not found in tournament data`);
  const byCode = Object.fromEntries(teams.map((t) => [t.code, t]));
  const home = byCode[match.home];
  const away = byCode[match.away];
  return {
    matchId,
    tournamentName,
    header: headerFor(match),
    stakes: stakesFor(match, home, away),
    home: teamView(home),
    away: teamView(away),
    result: { score: match.score, penalties: match.penalties, winner: match.winner },
    table: groupTableAfter(tournament, match),
    next: [nextMatchFor(tournament, match, home.code), nextMatchFor(tournament, match, away.code)],
    teams: Object.fromEntries(teams.map((t) => [t.code, { name: t.name, flag: t.flag, iso2: t.iso2 }])),
  };
}
