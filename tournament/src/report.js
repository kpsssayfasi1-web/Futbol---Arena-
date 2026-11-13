// Human-readable outputs: a Markdown summary (Turkish headings for the
// producer) and a CSV publishing schedule.

const STAGE_ORDER = ['R32', 'R16', 'QF', 'SF', 'THIRD', 'FINAL'];
const STAGE_TR = {
  R32: 'Son 32', R16: 'Son 16', QF: 'Çeyrek final', SF: 'Yarı final', THIRD: 'Üçüncülük maçı', FINAL: 'Final',
};

function label(code, teamsByCode) {
  const t = teamsByCode[code];
  return `${t.flag} ${t.name}`;
}

function scoreText(m) {
  const pens = m.penalties ? ` (pen. ${m.penalties.home}-${m.penalties.away})` : '';
  return `${m.score.home}-${m.score.away}${pens}`;
}

function standingsTable(rows, teamsByCode, qualifiedThirds) {
  const lines = ['| # | Takım | O | G | B | M | AG | YG | Av | P | |', '|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const r of rows) {
    const mark = r.position <= 2 || qualifiedThirds.has(r.team) ? '✅' : '';
    lines.push(`| ${r.position} | ${label(r.team, teamsByCode)} | ${r.played} | ${r.won} | ${r.drawn} | ${r.lost} | ${r.goalsFor} | ${r.goalsAgainst} | ${r.goalDiff > 0 ? '+' : ''}${r.goalDiff} | **${r.points}** | ${mark} |`);
  }
  return lines.join('\n');
}

export function buildSummary(result, teams, tournamentName) {
  const teamsByCode = Object.fromEntries(teams.map((t) => [t.code, t]));
  const qualifiedThirds = new Set(result.thirdsTable.filter((r) => r.qualified).map((r) => r.team));
  const { podium, matches } = result;
  const out = [
    `# ${tournamentName}: sezon özeti (seed: \`${result.seed}\`)`,
    '',
    '> ⚠️ Bu dosya tüm sonuçları içerir. Yalnızca yapımcı içindir.',
    '',
    `🥇 **${label(podium.champion, teamsByCode)}** · 🥈 ${label(podium.runnerUp, teamsByCode)} · 🥉 ${label(podium.third, teamsByCode)} · 4. ${label(podium.fourth, teamsByCode)}`,
    '',
    '## Gruplar',
  ];
  for (const group of result.groups) {
    out.push('', `### Grup ${group.id}`, '', standingsTable(result.standings[group.id], teamsByCode, qualifiedThirds));
    out.push('', ...matches.filter((m) => m.group === group.id)
      .map((m) => `- ${m.matchday}. hafta: ${label(m.home, teamsByCode)} **${scoreText(m)}** ${label(m.away, teamsByCode)}`));
  }
  out.push('', '## Üçüncüler sıralaması (ilk 8 tur atlar)', '');
  out.push(...result.thirdsTable.map((r, i) => `${i + 1}. ${label(r.team, teamsByCode)} (Grup ${r.group}): ${r.points} P, ${r.goalDiff > 0 ? '+' : ''}${r.goalDiff} av. ${r.qualified ? '✅' : '❌'}`));
  for (const stage of STAGE_ORDER) {
    out.push('', `## ${STAGE_TR[stage]}`, '');
    out.push(...matches.filter((m) => m.stage === stage)
      .map((m) => `- ${label(m.home, teamsByCode)} **${scoreText(m)}** ${label(m.away, teamsByCode)} → ${label(m.winner, teamsByCode)}`));
  }
  const top = [...matches].sort((a, b) => b.drama - a.drama).slice(0, 10);
  out.push('', '## En dramatik 10 maç (uzun video derlemeleri için)', '');
  out.push(...top.map((m) => `- ${m.id} · drama ${m.drama} · ${label(m.home, teamsByCode)} ${scoreText(m)} ${label(m.away, teamsByCode)}`));
  return `${out.join('\n')}\n`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildScheduleCsv(matches) {
  const header = ['id', 'publish_day', 'publish_at_utc', 'stage', 'group', 'home', 'away', 'score', 'penalties', 'winner', 'drama', 'title'];
  const rows = matches.map((m) => [
    m.id, m.publishDay, m.publishAtUtc, m.stage, m.group ?? '', m.home, m.away,
    `${m.score.home}-${m.score.away}`, m.penalties ? `${m.penalties.home}-${m.penalties.away}` : '',
    m.winner ?? '', m.drama, m.title,
  ]);
  return `${[header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')}\n`;
}
