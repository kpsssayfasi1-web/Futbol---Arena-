// 2D overlay drawn on top of the 3D frame: header, scoreboard, name tags,
// goal banner, intro / full-time / outro cards.

export const W = 1080;
export const H = 1920;
const CX = W / 2;
const TAU = Math.PI * 2;
const FONT = "'Inter', 'Noto Color Emoji', sans-serif";
export const GOLD = '#ffcf4a';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const easeOut = (t) => 1 - (1 - clamp(t, 0, 1)) ** 3;

export function createHud(ctx, flags) {
  const text = (str, x, y, { size, weight = 900, color = '#fff', align = 'center', spacing = 0, alpha = 1, stroke = null }) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = `${spacing}px`;
    if (stroke) { ctx.lineWidth = stroke.width; ctx.strokeStyle = stroke.color; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y); }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.restore();
  };

  const fit = (str, maxWidth, size, weight = 900) => {
    let s = size;
    ctx.font = `${weight} ${s}px ${FONT}`;
    while (s > 16 && ctx.measureText(str).width > maxWidth) { s -= 2; ctx.font = `${weight} ${s}px ${FONT}`; }
    return s;
  };

  const box = (x, y, w, h, r, fill, stroke) => {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  };

  const flag = (team, x, y, r, glow = true) => {
    ctx.save();
    if (glow) { ctx.shadowColor = team.colors[0]; ctx.shadowBlur = r * 0.6; }
    ctx.beginPath(); ctx.arc(x, y, r * 1.12, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
    ctx.drawImage(flags[team.iso2], x - r, y - r, r * 2, r * 2);
    ctx.restore();
  };

  const dim = (a) => { ctx.fillStyle = `rgba(3,6,15,${a})`; ctx.fillRect(0, 0, W, H); };

  return { text, fit, box, flag, dim, ctx };
}

export function drawHeader(h, P, alpha = 1) {
  const { text, box, ctx } = h;
  text(P.context.tournamentName.toUpperCase(), CX, 120, { size: 32, color: GOLD, spacing: 8, alpha, stroke: { width: 6, color: 'rgba(0,0,0,.5)' } });
  const label = `${P.context.header.stage}  ·  ${P.context.header.detail}`;
  ctx.font = `800 26px ${FONT}`;
  const w = ctx.measureText(label).width + 64;
  ctx.globalAlpha = alpha;
  box(CX - w / 2, 148, w, 46, 23, 'rgba(8,14,30,.75)', 'rgba(255,255,255,.2)');
  ctx.globalAlpha = 1;
  text(label, CX, 172, { size: 26, weight: 800, color: '#dbe6ff', spacing: 3, alpha });
}

export function drawScoreboard(h, P, frame, popTeam = null, popT = 0) {
  const { text, fit, box, flag } = h;
  box(50, 215, 980, 200, 32, 'rgba(8,14,30,.86)', 'rgba(120,160,255,.28)');
  [[P.context.home, 190], [P.context.away, 890]].forEach(([team, x]) => {
    flag(team, x, 285, 50);
    const name = team.name.toUpperCase();
    text(name, x, 378, { size: fit(name, 280, 34), spacing: 1 });
  });
  frame.score.forEach((s, i) => {
    const pop = popTeam === i ? 1 + 0.45 * Math.sin(Math.PI * clamp(popT / 0.6, 0, 1)) : 1;
    text(String(s), i === 0 ? 445 : 635, 290, { size: Math.round(118 * pop), color: popTeam === i ? GOLD : '#fff' });
  });
  text('–', CX, 286, { size: 72, color: 'rgba(255,255,255,.55)' });
  box(CX - 54, 352, 108, 44, 22, 'rgba(255,207,74,.15)', 'rgba(255,207,74,.55)');
  text(`${frame.clock}'`, CX, 375, { size: 28, color: GOLD });
}

// Name tag above a player: "10 MESSI" in the team colour.
export function drawNameTag(h, x, y, player, team, highlight = false) {
  const { ctx, text } = h;
  const label = player.number === null ? player.label : `${player.number}  ${player.label}`;
  ctx.font = `900 24px ${FONT}`;
  const w = ctx.measureText(label).width + 26;
  ctx.save();
  ctx.globalAlpha = 0.92;
  h.box(x - w / 2, y - 18, w, 36, 18, highlight ? GOLD : 'rgba(8,14,30,.82)', team.colors[0]);
  ctx.restore();
  text(label, x, y + 1, { size: 24, color: highlight ? '#111827' : '#fff' });
}

export function drawFooter(h, P) {
  const { text, fit } = h;
  const stroke = { width: 7, color: 'rgba(0,0,0,.55)' };
  text(P.context.stakes, CX, 1640, { size: fit(P.context.stakes, 920, 40, 800), weight: 800, stroke });
  text('Who wins? Comment your prediction 👇', CX, 1700, { size: 30, weight: 800, color: 'rgba(230,238,255,.9)', stroke });
}

export function drawGoalBanner(h, P, goal, t) {
  const { text, flag, ctx, fit } = h;
  const team = goal.team === 0 ? P.context.home : P.context.away;
  const scorer = goal.scorer === null ? null : P.players[goal.scorer];
  const alpha = clamp((P.celebrationSeconds - t) / 0.3, 0, 1);
  const flash = clamp(1 - t / 0.25, 0, 1);
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.3})`; ctx.fillRect(0, 0, W, H); }
  const s = 0.6 + 0.4 * easeOut(t / 0.35);
  ctx.save();
  ctx.translate(CX, 820); ctx.scale(s, s);
  ctx.shadowColor = team.colors[0]; ctx.shadowBlur = 40;
  text(goal.ownGoal ? 'OWN GOAL!' : 'GOAL!', 0, 0, { size: goal.ownGoal ? 140 : 190, color: GOLD, alpha, stroke: { width: 14, color: 'rgba(0,0,0,.6)' } });
  ctx.restore();
  ctx.globalAlpha = alpha;
  h.box(140, 930, 800, 110, 55, 'rgba(8,14,30,.88)', team.colors[0]);
  flag(team, 205, 985, 38, false);
  ctx.globalAlpha = 1;
  const who = scorer ? `${scorer.number ?? ''} ${scorer.label}`.trim() : team.name.toUpperCase();
  text(who, 265, 985, { size: fit(who, 640, 54), align: 'left', alpha });
  if (goal.assist !== null && P.players[goal.assist]) {
    text(`assist: ${P.players[goal.assist].label}`, CX, 1075, { size: 30, weight: 800, color: '#dbe6ff', alpha, stroke: { width: 6, color: 'rgba(0,0,0,.5)' } });
  }
}

export function drawIntro(h, P, t) {
  const { text, fit, flag, dim } = h;
  dim(0.7);
  const slide = easeOut(t / 0.6);
  const { home, away } = P.context;
  flag(home, CX - 230 - (1 - slide) * 400, 760, 125);
  flag(away, CX + 230 + (1 - slide) * 400, 760, 125);
  text('VS', CX, 760, { size: 88, color: GOLD, alpha: slide });
  [[home, CX - 230], [away, CX + 230]].forEach(([team, x]) => {
    const name = team.name.toUpperCase();
    text(name, x, 935, { size: fit(name, 420, 52), alpha: slide });
    team.players.forEach((p, i) => {
      const line = `${p.number ?? ''} ${p.label}`.trim();
      text(line, x, 1000 + i * 46, { size: fit(line, 420, 30, 800), weight: 800, color: '#dbe6ff', alpha: easeOut((t - 0.4 - i * 0.12) / 0.4) });
    });
  });
  const late = easeOut((t - 0.8) / 0.6);
  text(P.context.stakes, CX, 1230, { size: fit(P.context.stakes, 940, 42, 800), weight: 800, color: '#ffffff', alpha: late });
  text('3v3 street football · real physics · ratings shape the odds', CX, 1300, { size: 25, weight: 800, color: 'rgba(219,230,255,.6)', alpha: late });
}

export function drawFullTime(h, frame, t) {
  const { text, box, dim, ctx } = h;
  dim(0.45 * easeOut(t / 0.3));
  const s = 0.8 + 0.2 * easeOut(t / 0.3);
  ctx.save(); ctx.translate(CX, 900); ctx.scale(s, s);
  box(-330, -80, 660, 160, 30, 'rgba(8,14,30,.92)', GOLD);
  text('FULL TIME', 0, -20, { size: 64, color: GOLD, spacing: 6 });
  text(`${frame.score[0]} – ${frame.score[1]}`, 0, 45, { size: 52 });
  ctx.restore();
}

function drawTable(h, P, y0, alpha) {
  const { text, fit, box, ctx } = h;
  const { table, home, away, teams } = P.context;
  ctx.globalAlpha = alpha;
  box(70, y0, 940, 450, 30, 'rgba(8,14,30,.92)', 'rgba(120,160,255,.3)');
  ctx.globalAlpha = 1;
  text(`${P.context.header.stage} TABLE`, CX, y0 + 48, { size: 32, color: GOLD, spacing: 4, alpha });
  [[650, 'P'], [780, 'GD'], [910, 'PTS']].forEach(([x, label]) => text(label, x, y0 + 102, { size: 24, weight: 800, color: 'rgba(219,230,255,.6)', alpha }));
  table.forEach((r, i) => {
    const y = y0 + 165 + i * 72;
    const info = teams[r.team];
    if (r.team === home.code || r.team === away.code) { ctx.globalAlpha = alpha; box(90, y - 31, 900, 62, 16, 'rgba(255,207,74,.12)'); ctx.globalAlpha = 1; }
    text(String(i + 1), 130, y, { size: 30, color: i < 2 ? '#7dffb0' : '#fff', alpha });
    const name = `${info.flag} ${info.name}`;
    text(name, 175, y, { size: fit(name, 420, 32, 800), weight: 800, align: 'left', alpha });
    text(String(r.played), 650, y, { size: 30, weight: 800, alpha });
    text(`${r.goalDiff > 0 ? '+' : ''}${r.goalDiff}`, 780, y, { size: 30, weight: 800, alpha });
    text(String(r.points), 910, y, { size: 34, color: GOLD, alpha });
  });
}

export function drawOutro(h, P, frame, t) {
  const { text, fit, flag, dim } = h;
  dim(0.9);
  const a = easeOut(t / 0.5);
  const { home, away, next, teams, result } = P.context;
  text('FULL TIME', CX, 300, { size: 42, color: GOLD, spacing: 8, alpha: a });
  flag(home, 250, 430, 80);
  flag(away, 830, 430, 80);
  text(`${frame.score[0]} – ${frame.score[1]}`, CX, 430, { size: 116, alpha: a });
  if (result.penalties) text(`Penalties ${result.penalties.home}–${result.penalties.away}`, CX, 540, { size: 38, color: GOLD, alpha: a });
  const scorers = P.scorerLines;
  scorers.forEach((line, i) => text(line, CX, 560 + i * 40, { size: fit(line, 940, 28, 800), weight: 800, color: '#dbe6ff', alpha: a }));
  const tableY = 600 + Math.max(0, scorers.length - 1) * 40 + 40;
  if (P.context.table) drawTable(h, P, tableY, easeOut((t - 0.3) / 0.5));
  const b = easeOut((t - 0.8) / 0.5);
  const nextY = tableY + 520;
  text('NEXT UP', CX, nextY, { size: 30, color: GOLD, spacing: 6, alpha: b });
  [home, away].forEach((team, i) => {
    const n = next[i];
    const line = n ? `${team.flag} ${team.name}  vs  ${teams[n.opponent].name} ${teams[n.opponent].flag}` : `${team.flag} ${team.name}: tournament over`;
    text(line, CX, nextY + 62 + i * 62, { size: fit(line, 940, 38, 800), weight: 800, alpha: b });
  });
  text('Follow so you never miss a match ⚽', CX, nextY + 230, { size: 38, weight: 800, alpha: easeOut((t - 1.4) / 0.5) });
}
