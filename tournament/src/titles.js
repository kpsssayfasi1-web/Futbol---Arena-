// Spoiler-free English titles and descriptions for each match video.

const MAX_TITLE_LENGTH = 100;
const UNDERDOG_GAP = 12;
const DISCLOSURE = 'Every match is a real, unedited physics simulation. Team ratings shape the odds, and upsets happen!';
const HASHTAGS = '#Shorts #football #soccer #physics #simulation';

function side(team) {
  return `${team.flag} ${team.name}`;
}

function versus(home, away) {
  return `${home.flag} ${home.name} vs ${away.name} ${away.flag}`;
}

function contextLabel(match, tournamentName) {
  if (match.stage === 'GROUP') return `${tournamentName} · Group ${match.group}`;
  return `${tournamentName} · ${match.stageLabel}`;
}

function hook(match, home, away) {
  if (match.stage === 'FINAL') return '🏆 THE FINAL: ';
  if (match.stage === 'SF') return 'One step from the final! ';
  if (match.stage === 'THIRD') return '🥉 Battle for bronze: ';
  const gap = home.rating - away.rating;
  if (Math.abs(gap) >= UNDERDOG_GAP) {
    const [underdog, favourite] = gap > 0 ? [away, home] : [home, away];
    return `Can ${underdog.name} shock ${favourite.name}? `;
  }
  return match.stage === 'GROUP' ? '' : 'Win or go home! ';
}

export function buildTitle(match, teamsByCode, tournamentName) {
  const home = teamsByCode[match.home];
  const away = teamsByCode[match.away];
  const candidates = [
    `${hook(match, home, away)}${versus(home, away)} | ${contextLabel(match, tournamentName)}`,
    `${versus(home, away)} | ${contextLabel(match, tournamentName)}`,
    versus(home, away),
  ];
  return candidates.find((t) => [...t].length <= MAX_TITLE_LENGTH) ?? candidates[candidates.length - 1];
}

export function buildDescription(match, teamsByCode, tournamentName) {
  const home = teamsByCode[match.home];
  const away = teamsByCode[match.away];
  const where = match.stage === 'GROUP'
    ? `Group ${match.group}, matchday ${match.matchday}`
    : match.stageLabel;
  return [
    `${side(home)} vs ${side(away)} | ${tournamentName}, ${where}.`,
    'Who wins? Drop your prediction in the comments 👇',
    '',
    DISCLOSURE,
    '',
    HASHTAGS,
  ].join('\n');
}

export function withPublishingText(matches, teams, tournamentName) {
  const teamsByCode = Object.fromEntries(teams.map((t) => [t.code, t]));
  return matches.map((m) => ({
    ...m,
    title: buildTitle(m, teamsByCode, tournamentName),
    description: buildDescription(m, teamsByCode, tournamentName),
  }));
}
