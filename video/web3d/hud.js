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

// Soft cinematic vignette and a darker band behind the top HUD, so the
// pitch reads brighter in the middle and text stays legible.
export function drawVignette(h) {
  const { ctx } = h;
  const g = ctx.createRadialGradient(CX, H * 0.55, H * 0.25, CX, H * 0.55, H * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const top = ctx.createLinearGradient(0, 0, 0, 460);
  top.addColorStop(0, 'rgba(3,6,15,.75)');
  top.addColorStop(1, 'rgba(3,6,15,0)');
  ctx.fillStyle = top; ctx.fillRect(0, 0, W, 460);
  const bottom = ctx.createLinearGradient(0, H - 420, 0, H);
  bottom.addColorStop(0, 'rgba(3,6,15,0)');
  bottom.addColorStop(1, 'rgba(3,6,15,.7)');
  ctx.fillStyle = bottom; ctx.fillRect(0, H - 420, W, 420);
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

const ORDINAL_TAGS = { 2: 'BRACE!', 3: 'HAT-TRICK!', 4: 'FOUR GOALS!', 5: 'FIVE GOALS!' };

// Tiny deterministic hash so confetti is identical however frames are reached.
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function confetti(h, colors, t, salt) {
  const { ctx } = h;
  for (let i = 0; i < 70; i += 1) {
    const r = (k) => hash(salt * 97 + i * 13 + k);
    const delay = r(1) * 0.35;
    const age = t - delay;
    if (age <= 0) continue;
    const x = r(2) * W + Math.sin(age * (2 + r(3) * 3) + r(4) * 6) * 40;
    const y = -40 + age * (520 + r(5) * 480);
    if (y > H + 40) continue;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(age * (4 + r(6) * 8));
    ctx.scale(1, Math.abs(Math.cos(age * (5 + r(7) * 6))) + 0.15);
    ctx.fillStyle = i % 5 === 4 ? GOLD : colors[i % colors.length];
    ctx.fillRect(-9, -5, 18, 10);
    ctx.restore();
  }
}

// Goal sequence (celebrationSeconds long): flash, "GOAL!" punching in
// letter by letter, then a scorer card on a diagonal band in the team's
// colours with the shirt number, name, minute, brace/hat-trick tag and
// assist. Kept out of the middle of the frame, where the camera is
// zooming in on the scorer.
export function drawGoalBanner(h, P, goal, t) {
  const { text, flag, ctx, fit } = h;
  const info = P.goals.find((g) => Math.abs(g.playTime - goal.playTime) < 1e-6) ?? { minute: 0, tally: 1, score: [0, 0], index: 0 };
  const team = goal.team === 0 ? P.context.home : P.context.away;
  const [c1, c2] = team.colors;
  const scorer = goal.scorer === null ? null : P.players[goal.scorer];
  const out = clamp((P.celebrationSeconds - t) / 0.35, 0, 1);
  const exit = (1 - easeOut(out)) * W * 1.2;

  const flash = clamp(1 - t / 0.2, 0, 1);
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.45})`; ctx.fillRect(0, 0, W, H); }
  confetti(h, [c1, c2, '#ffffff'], t, info.index + 1);

  // "GOAL!" letters drop in one after another with an overshoot.
  const word = goal.ownGoal ? 'OWN GOAL!' : 'GOAL!';
  const size = goal.ownGoal ? 150 : 210;
  ctx.font = `900 ${size}px ${FONT}`;
  const widths = [...word].map((ch) => ctx.measureText(ch).width);
  let x = CX - widths.reduce((a, b) => a + b, 0) / 2;
  [...word].forEach((ch, i) => {
    const k = clamp((t - 0.05 - i * 0.06) / 0.28, 0, 1);
    const pop = k < 1 ? easeOut(k) * (1 + 0.25 * Math.sin(Math.PI * k)) : 1;
    ctx.save();
    ctx.translate(x + widths[i] / 2 - exit, 610 - (1 - easeOut(k)) * 120);
    ctx.scale(pop, pop);
    ctx.rotate(-0.06);
    ctx.shadowColor = c1; ctx.shadowBlur = 50;
    text(ch, 0, 0, { size, color: GOLD, alpha: k > 0 ? 1 : 0, stroke: { width: 16, color: 'rgba(0,0,0,.7)' } });
    ctx.restore();
    x += widths[i];
  });

  // Diagonal band sweeping in from the left.
  const sweep = easeOut((t - 0.25) / 0.35);
  const bandY = 1320;
  const off = (1 - sweep) * -W * 1.3 - exit;
  ctx.save();
  ctx.translate(off, 0);
  ctx.beginPath();
  ctx.moveTo(-60, bandY - 120); ctx.lineTo(W + 60, bandY - 175); ctx.lineTo(W + 60, bandY + 120); ctx.lineTo(-60, bandY + 175);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, c1); grad.addColorStop(1, c2 === '#ffffff' || c2.toLowerCase() === '#fff' ? c1 : c2);
  ctx.fillStyle = grad; ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(8,14,30,.93)';
  ctx.beginPath();
  ctx.moveTo(-60, bandY - 100); ctx.lineTo(W + 60, bandY - 150); ctx.lineTo(W + 60, bandY + 100); ctx.lineTo(-60, bandY + 150);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  const reveal = easeOut((t - 0.45) / 0.35);
  if (reveal <= 0) return;
  const shift = (1 - reveal) * 80 - exit;
  ctx.save();
  ctx.translate(shift, 0);
  // Giant outlined shirt number behind the name.
  if (scorer && scorer.number !== null && !goal.ownGoal) {
    ctx.save();
    ctx.globalAlpha = 0.9 * reveal;
    const numSize = fit(String(scorer.number), 270, 300);
    ctx.font = `900 ${numSize}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = GOLD;
    ctx.strokeText(String(scorer.number), 190, bandY + 12);
    ctx.restore();
  }
  flag(team, 400, bandY - 52, 40, false);
  const name = goal.ownGoal ? 'OWN GOAL' : scorer ? scorer.label : team.name.toUpperCase();
  text(name, 460, bandY - 50, { size: fit(name, 560, 78), align: 'left', alpha: reveal });
  const tag = goal.ownGoal ? (scorer ? `off ${scorer.label}` : '') : (ORDINAL_TAGS[info.tally] ?? '');
  const minuteLine = `${info.minute}'${tag ? '   ' : ''}`;
  text(minuteLine, 362, bandY + 38, { size: 50, color: '#dbe6ff', align: 'left', alpha: reveal });
  if (tag) {
    ctx.font = `900 50px ${FONT}`;
    const mx = 362 + ctx.measureText(minuteLine).width;
    const pulse = 1 + 0.08 * Math.sin(t * 12);
    ctx.save(); ctx.translate(mx, bandY + 38); ctx.scale(pulse, pulse);
    text(tag, 0, 0, { size: fit(tag, 1000 - mx, 50), color: GOLD, align: 'left', alpha: reveal });
    ctx.restore();
  }
  ctx.restore();

  const late = easeOut((t - 0.75) / 0.3) * out;
  if (goal.assist !== null && P.players[goal.assist] && !goal.ownGoal) {
    const a = P.players[goal.assist];
    const line = `assist  ${a.number ?? ''} ${a.label}`.replace(/\s+/g, ' ');
    text(line, CX, bandY + 215, { size: 38, weight: 800, color: '#ffffff', alpha: late, stroke: { width: 8, color: 'rgba(0,0,0,.6)' } });
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
