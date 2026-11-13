// Draws one video frame at a time onto a 1080x1920 canvas.
// The page is driven by make-short.js: setup(payload), then renderFrame(i)
// for i = 0..totalFrames-1 in order (effects keep state between frames).

import { createRng } from '/tournament/src/rng.js';

const W = 1080;
const H = 1920;
const CX = 540;
const CY = 1060;
const R = 430;
const TAU = Math.PI * 2;
const FONT = "'Inter', 'Noto Color Emoji', sans-serif";
const GOLD = '#ffcf4a';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

let P = null;          // payload
const flags = {};      // iso2 -> Image
let particles = [];
let fxRng = null;
const trails = [[], []];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOut = (t) => 1 - (1 - clamp(t, 0, 1)) ** 3;
const toX = (x) => CX + x * R;
const toY = (y) => CY + y * R;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

function text(str, x, y, { size, weight = 900, color = '#fff', align = 'center', spacing = 0, alpha = 1 }) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(str, x, y);
  ctx.restore();
}

function fitText(str, maxWidth, size, weight = 900) {
  let s = size;
  ctx.font = `${weight} ${s}px ${FONT}`;
  while (s > 18 && ctx.measureText(str).width > maxWidth) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${FONT}`;
  }
  return s;
}

function roundRect(x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}

function flagDisc(team, x, y, r, glow = true) {
  ctx.save();
  if (glow) { ctx.shadowColor = team.colors[0]; ctx.shadowBlur = r * 0.6; }
  ctx.beginPath(); ctx.arc(x, y, r + r * 0.12, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  ctx.drawImage(flags[team.iso2], x - r, y - r, r * 2, r * 2);
  const shine = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.05, x, y, r);
  shine.addColorStop(0, 'rgba(255,255,255,.45)');
  shine.addColorStop(0.45, 'rgba(255,255,255,0)');
  shine.addColorStop(1, 'rgba(0,0,0,.35)');
  ctx.fillStyle = shine; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

// ---------- background, arena, goal ----------

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0d1838'); g.addColorStop(0.5, '#081028'); g.addColorStop(1, '#03060f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (const [x, y] of [[80, 560], [1000, 560]]) {
    const l = ctx.createRadialGradient(x, y, 0, x, y, 520);
    l.addColorStop(0, 'rgba(120,170,255,.16)'); l.addColorStop(1, 'rgba(120,170,255,0)');
    ctx.fillStyle = l; ctx.fillRect(0, 0, W, H);
  }
  const halo = ctx.createRadialGradient(CX, CY, R * 0.6, CX, CY, R * 1.6);
  halo.addColorStop(0, 'rgba(40,95,190,.22)'); halo.addColorStop(1, 'rgba(40,95,190,0)');
  ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
}

function drawPitch() {
  const turf = ctx.createRadialGradient(CX - R * 0.25, CY - R * 0.3, 1, CX, CY, R);
  turf.addColorStop(0, '#1d6b45'); turf.addColorStop(0.7, '#13513a'); turf.addColorStop(1, '#0b3428');
  ctx.save();
  ctx.beginPath(); ctx.arc(CX, CY, R, 0, TAU); ctx.fillStyle = turf; ctx.fill(); ctx.clip();
  for (let i = -6; i <= 6; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(120,230,150,.06)' : 'rgba(0,0,0,.06)';
    ctx.fillRect(CX + i * R * 0.16 - R * 0.08, CY - R, R * 0.16, R * 2);
  }
  ctx.strokeStyle = 'rgba(230,255,240,.35)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(CX, CY, R * 0.3, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(CX, CY - R); ctx.lineTo(CX, CY + R); ctx.stroke();
  ctx.beginPath(); ctx.arc(CX, CY, 6, 0, TAU); ctx.fillStyle = 'rgba(230,255,240,.7)'; ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.shadowColor = '#4c9aff'; ctx.shadowBlur = 30;
  ctx.strokeStyle = '#5aa6ff'; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.arc(CX, CY, R + 4, 0, TAU); ctx.stroke();
  ctx.restore();
}

function drawGoal(angle) {
  const half = P.physics.goalHalfAngle;
  const depth = R * 0.16;
  const pts = [angle - half, angle + half].map((a) => ({
    fx: CX + Math.cos(a) * R, fy: CY + Math.sin(a) * R,
    bx: CX + Math.cos(a) * (R + depth), by: CY + Math.sin(a) * (R + depth),
  }));
  const [p1, p2] = pts;
  ctx.save();
  ctx.beginPath(); ctx.moveTo(p1.fx, p1.fy); ctx.lineTo(p1.bx, p1.by); ctx.lineTo(p2.bx, p2.by); ctx.lineTo(p2.fx, p2.fy); ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fill();
  ctx.strokeStyle = 'rgba(235,245,255,.6)'; ctx.lineWidth = 2;
  for (let i = 1; i < 6; i += 1) {
    const f = i / 6;
    ctx.beginPath();
    ctx.moveTo(p1.fx + (p2.fx - p1.fx) * f, p1.fy + (p2.fy - p1.fy) * f);
    ctx.lineTo(p1.bx + (p2.bx - p1.bx) * f, p1.by + (p2.by - p1.by) * f); ctx.stroke();
  }
  for (let i = 1; i < 4; i += 1) {
    const f = i / 4;
    ctx.beginPath();
    ctx.moveTo(p1.fx + (p1.bx - p1.fx) * f, p1.fy + (p1.by - p1.fy) * f);
    ctx.lineTo(p2.fx + (p2.bx - p2.fx) * f, p2.fy + (p2.by - p2.fy) * f); ctx.stroke();
  }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.shadowColor = GOLD; ctx.shadowBlur = 24;
  ctx.strokeStyle = GOLD; ctx.lineWidth = 12;
  ctx.beginPath(); ctx.moveTo(p1.fx, p1.fy); ctx.lineTo(p1.bx, p1.by); ctx.lineTo(p2.bx, p2.by); ctx.lineTo(p2.fx, p2.fy); ctx.stroke();
  ctx.shadowBlur = 0; ctx.strokeStyle = '#fff3c2'; ctx.lineWidth = 4; ctx.stroke();
  ctx.restore();
}

// ---------- balls and effects ----------

function drawBalls(frame, hiddenTeam) {
  const r = P.physics.ballRadius * R;
  [P.context.home, P.context.away].forEach((team, i) => {
    if (i === hiddenTeam) return;
    const b = frame.balls[i];
    const trail = trails[i];
    trail.forEach((p, k) => {
      const f = (k + 1) / (trail.length + 1);
      ctx.fillStyle = team.colors[0];
      ctx.globalAlpha = f * 0.35;
      ctx.beginPath(); ctx.arc(p.x, p.y, r * (0.4 + 0.5 * f), 0, TAU); ctx.fill();
    });
    ctx.globalAlpha = 1;
    flagDisc(team, toX(b.x), toY(b.y), r);
  });
}

function spawn(x, y, colors, count, power, life) {
  for (let i = 0; i < count; i += 1) {
    const a = fxRng.next() * TAU;
    const s = power * (0.3 + 0.7 * fxRng.next());
    particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life,
      size: 4 + fxRng.next() * 8, color: colors[Math.floor(fxRng.next() * colors.length)],
    });
  }
}

function updateParticles(dt) {
  particles = particles
    .map((p) => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, vx: p.vx * 0.94, vy: p.vy * 0.94 + 30 * dt, life: p.life - dt }))
    .filter((p) => p.life > 0);
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function triggerEvents(frameIndex, frame) {
  for (const e of P.eventsByFrame[frameIndex] ?? []) {
    const team = e.team === 0 ? P.context.home : e.team === 1 ? P.context.away : null;
    if (e.type === 'bounce') {
      const b = frame.balls[e.team];
      spawn(toX(b.x), toY(b.y), [team.colors[0], '#ffffff'], 6, 220, 0.4);
    } else if (e.type === 'clash') {
      const [a, b] = frame.balls;
      spawn(toX((a.x + b.x) / 2), toY((a.y + b.y) / 2), ['#ffffff', '#cfe3ff'], 14, 360, 0.5);
    } else if (e.type === 'goal') {
      const gx = CX + Math.cos(frame.angle) * R;
      const gy = CY + Math.sin(frame.angle) * R;
      spawn(gx, gy, [...team.colors, GOLD], 90, 900, 1.6);
    }
  }
}

// ---------- HUD ----------

function drawHeader(alpha = 1) {
  text(P.context.tournamentName.toUpperCase(), CX, 150, { size: 34, color: GOLD, spacing: 8, alpha });
  const label = `${P.context.header.stage}  ·  ${P.context.header.detail}`;
  ctx.font = `800 28px ${FONT}`;
  const w = ctx.measureText(label).width + 70;
  ctx.globalAlpha = alpha;
  roundRect(CX - w / 2, 180, w, 50, 25, 'rgba(255,255,255,.08)', 'rgba(255,255,255,.18)');
  ctx.globalAlpha = 1;
  text(label, CX, 206, { size: 28, weight: 800, color: '#dbe6ff', spacing: 3, alpha });
}

function drawScoreboard(frame, popTeam, popT) {
  roundRect(50, 255, 980, 250, 36, 'rgba(10,20,45,.82)', 'rgba(120,160,255,.25)');
  const sides = [[P.context.home, 210], [P.context.away, 870]];
  sides.forEach(([team, x]) => {
    flagDisc(team, x, 345, 62);
    const size = fitText(team.name.toUpperCase(), 300, 38);
    text(team.name.toUpperCase(), x, 448, { size, color: '#ffffff', spacing: 1 });
  });
  frame.score.forEach((s, i) => {
    const pop = popTeam === i ? 1 + 0.45 * Math.sin(Math.PI * clamp(popT / 0.6, 0, 1)) : 1;
    text(String(s), i === 0 ? 455 : 625, 350, { size: Math.round(130 * pop), color: popTeam === i ? GOLD : '#ffffff' });
  });
  text('–', CX, 345, { size: 80, color: 'rgba(255,255,255,.55)' });
  roundRect(CX - 58, 420, 116, 48, 24, 'rgba(255,207,74,.15)', 'rgba(255,207,74,.5)');
  text(`${frame.clock}'`, CX, 445, { size: 30, color: GOLD });
}

function drawFooter(alpha = 1) {
  text(P.context.stakes, CX, 1610, { size: fitText(P.context.stakes, 920, 40, 800), weight: 800, color: '#ffffff', alpha });
  text('Who wins? Comment your prediction 👇', CX, 1672, { size: 32, weight: 800, color: 'rgba(219,230,255,.75)', alpha });
}

function drawGoalBanner(team, t) {
  const flash = clamp(1 - t / 0.25, 0, 1);
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.35})`; ctx.fillRect(0, 0, W, H); }
  const s = 0.6 + 0.4 * easeOut(t / 0.35);
  const alpha = clamp((P.physics.celebrationSeconds - t) / 0.3, 0, 1);
  ctx.save();
  ctx.translate(CX, CY - 40); ctx.scale(s, s);
  ctx.shadowColor = team.colors[0]; ctx.shadowBlur = 40;
  text('GOAL!', 0, 0, { size: 190, color: GOLD, alpha });
  ctx.restore();
  ctx.globalAlpha = alpha;
  flagDisc(team, CX - 150, CY + 120, 40, false);
  ctx.globalAlpha = 1;
  text(team.name.toUpperCase(), CX - 90, CY + 122, { size: 50, color: '#ffffff', align: 'left', alpha });
}

// ---------- intro / full time / outro cards ----------

function dim(alpha) {
  ctx.fillStyle = `rgba(3,6,15,${alpha})`; ctx.fillRect(0, 0, W, H);
}

function drawIntro(t) {
  dim(0.72);
  const slide = easeOut(t / 0.6);
  const { home, away } = P.context;
  flagDisc(home, CX - 230 - (1 - slide) * 400, 880, 130);
  flagDisc(away, CX + 230 + (1 - slide) * 400, 880, 130);
  text('VS', CX, 880, { size: 90, color: GOLD, alpha: slide });
  text(home.name.toUpperCase(), CX - 230, 1060, { size: fitText(home.name.toUpperCase(), 420, 54), alpha: slide });
  text(away.name.toUpperCase(), CX + 230, 1060, { size: fitText(away.name.toUpperCase(), 420, 54), alpha: slide });
  const late = easeOut((t - 0.5) / 0.6);
  text(P.context.stakes, CX, 1200, { size: fitText(P.context.stakes, 940, 42, 800), weight: 800, color: '#dbe6ff', alpha: late });
  text('Real physics simulation · team ratings shape the odds', CX, 1290, { size: 26, weight: 800, color: 'rgba(219,230,255,.55)', alpha: late });
}

function drawFullTime(frame, t) {
  dim(0.45 * easeOut(t / 0.3));
  const s = 0.8 + 0.2 * easeOut(t / 0.3);
  ctx.save(); ctx.translate(CX, CY); ctx.scale(s, s);
  roundRect(-330, -80, 660, 160, 30, 'rgba(10,20,45,.92)', GOLD);
  text('FULL TIME', 0, -20, { size: 64, color: GOLD, spacing: 6 });
  text(`${frame.score[0]} – ${frame.score[1]}`, 0, 45, { size: 52, color: '#ffffff' });
  ctx.restore();
}

function tableRows() {
  const { table, home, away, teams } = P.context;
  return table.map((row, i) => ({ ...row, pos: i + 1, highlight: row.team === home.code || row.team === away.code, info: teams[row.team] }));
}

function drawTable(y0, alpha) {
  ctx.globalAlpha = alpha;
  roundRect(70, y0, 940, 470, 30, 'rgba(10,20,45,.9)', 'rgba(120,160,255,.3)');
  ctx.globalAlpha = 1;
  text(`${P.context.header.stage} TABLE`, CX, y0 + 50, { size: 34, color: GOLD, spacing: 4, alpha });
  const cols = [[650, 'P'], [780, 'GD'], [910, 'PTS']];
  cols.forEach(([x, h]) => text(h, x, y0 + 110, { size: 26, weight: 800, color: 'rgba(219,230,255,.6)', alpha }));
  tableRows().forEach((r, i) => {
    const y = y0 + 175 + i * 75;
    if (r.highlight) { ctx.globalAlpha = alpha; roundRect(90, y - 32, 900, 64, 16, 'rgba(255,207,74,.12)'); ctx.globalAlpha = 1; }
    text(String(r.pos), 130, y, { size: 32, color: r.pos <= 2 ? '#7dffb0' : '#ffffff', alpha });
    text(`${r.info.flag} ${r.info.name}`, 175, y, { size: fitText(`${r.info.flag} ${r.info.name}`, 420, 34, 800), weight: 800, align: 'left', alpha });
    text(String(r.played), 650, y, { size: 32, weight: 800, alpha });
    text(`${r.goalDiff > 0 ? '+' : ''}${r.goalDiff}`, 780, y, { size: 32, weight: 800, alpha });
    text(String(r.points), 910, y, { size: 36, color: GOLD, alpha });
  });
}

function drawOutro(frame, t) {
  const a = easeOut(t / 0.5);
  const { home, away, next, teams, result } = P.context;
  text('FULL TIME', CX, 330, { size: 44, color: GOLD, spacing: 8, alpha: a });
  flagDisc(home, 250, 470, 85);
  flagDisc(away, 830, 470, 85);
  text(`${frame.score[0]} – ${frame.score[1]}`, CX, 470, { size: 120, alpha: a });
  if (result.penalties) {
    text(`Penalties ${result.penalties.home}–${result.penalties.away}`, CX, 590, { size: 40, color: GOLD, alpha: a });
  }
  if (P.context.table) drawTable(650, easeOut((t - 0.3) / 0.5));
  const b = easeOut((t - 0.8) / 0.5);
  text('NEXT UP', CX, 1220, { size: 32, color: GOLD, spacing: 6, alpha: b });
  [home, away].forEach((team, i) => {
    const n = next[i];
    const line = n ? `${team.flag} ${team.name}  vs  ${teams[n.opponent].name} ${teams[n.opponent].flag}` : `${team.flag} ${team.name}: season over`;
    text(line, CX, 1290 + i * 70, { size: fitText(line, 940, 40, 800), weight: 800, alpha: b });
  });
  const c = easeOut((t - 1.4) / 0.5);
  text('Follow so you never miss a match ⚽', CX, 1500, { size: 40, weight: 800, color: '#ffffff', alpha: c });
}

// ---------- frame driver ----------

function sceneFrame(frame, frameIndex) {
  drawBackground();
  drawPitch();
  drawGoal(frame.angle);
  updateParticles(1 / P.fps);
  drawBalls(frame, frame.celebrating);
  drawHeader();
  return frame;
}

window.setup = async (payload) => {
  P = payload;
  fxRng = createRng(`fx:${payload.seed}`);
  particles = [];
  trails[0] = []; trails[1] = [];
  const codes = [payload.context.home.iso2, payload.context.away.iso2];
  await Promise.all(codes.map(async (iso) => { flags[iso] = await loadImage(`/video/node_modules/flag-icons/flags/1x1/${iso}.svg`); }));
  await document.fonts.load(`900 40px Inter`);
  await document.fonts.load(`800 40px Inter`);
  await document.fonts.load(`40px 'Noto Color Emoji'`);
  return true;
};

window.renderFrame = (i) => {
  const { intro, match, fulltime } = P.timeline;
  const frames = P.frames;
  if (i < intro) {
    sceneFrame(frames[0], -1);
    drawScoreboard(frames[0], null, 0);
    drawIntro(i / P.fps);
    return;
  }
  const m = i - intro;
  if (m < match) {
    const frame = frames[m];
    const prev = frames[Math.max(0, m - 1)];
    frame.balls.forEach((b, k) => {
      const jumped = Math.hypot(b.x - prev.balls[k].x, b.y - prev.balls[k].y) > 0.3;
      if (jumped || frame.celebrating === k) trails[k].length = 0;
      else { trails[k].push({ x: toX(b.x), y: toY(b.y) }); if (trails[k].length > 7) trails[k].shift(); }
    });
    triggerEvents(m, frame);
    sceneFrame(frame, m);
    const celebrating = frame.celebrating;
    const sinceGoal = celebrating === null ? 0 : P.celebrationAge[m];
    drawScoreboard(frame, celebrating, sinceGoal);
    drawFooter();
    if (celebrating !== null) drawGoalBanner(celebrating === 0 ? P.context.home : P.context.away, sinceGoal);
    return;
  }
  const last = frames[frames.length - 1];
  const f = m - match;
  if (f < fulltime) {
    sceneFrame(last, -1);
    drawScoreboard(last, null, 0);
    drawFullTime(last, f / P.fps);
    return;
  }
  // Outro is its own clean card: no arena or scoreboard ghosting behind it.
  drawBackground();
  updateParticles(1 / P.fps);
  drawHeader();
  drawOutro(last, (f - fulltime) / P.fps);
};

window.frameData = (quality) => canvas.toDataURL('image/jpeg', quality);
