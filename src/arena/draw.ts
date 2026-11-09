// index.html içindeki canvas çizim fonksiyonlarının karşılığı.
// Durumu yalnızca okur; hiçbir şeyi değiştirmez.
import {GOAL_HALF, TAU, type Arena, type Ball, type SimulationState} from './simulation.ts';

type Ctx = CanvasRenderingContext2D;

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

function drawBackground(ctx: Ctx, state: SimulationState, t: number) {
  const {width: W, height: H, cx, cy, radius: R} = state.arena;
  ctx.clearRect(0, 0, W, H);
  for (const s of state.stars) {
    ctx.fillStyle = `rgba(160,195,255,${s.a * (0.7 + 0.3 * Math.sin(t + s.x))})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
  }
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.7);
  g.addColorStop(0, 'rgba(38,86,169,.16)');
  g.addColorStop(1, 'rgba(3,7,18,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawTurf(ctx: Ctx, {cx, cy, radius: R}: Arena) {
  const turf = ctx.createRadialGradient(cx - R * 0.25, cy - R * 0.3, 1, cx, cy, R);
  turf.addColorStop(0, '#173e36'); turf.addColorStop(0.65, '#0b302b'); turf.addColorStop(1, '#071d20');
  ctx.fillStyle = turf;
  ctx.beginPath(); ctx.arc(cx, cy, R - 3, 0, TAU); ctx.fill();

  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R - 3, 0, TAU); ctx.clip();
  for (let i = -5; i < 6; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(92,210,126,.055)' : 'rgba(0,0,0,.045)';
    ctx.fillRect(cx + i * R * 0.19 - R * 0.1, cy - R, R * 0.19, R * 2);
  }
  ctx.strokeStyle = 'rgba(185,255,222,.24)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.55, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 3, 0, TAU); ctx.fillStyle = 'rgba(220,255,238,.65)'; ctx.fill();
  ctx.restore();

  ctx.save(); ctx.shadowColor = '#3989ff'; ctx.shadowBlur = 20;
  ctx.strokeStyle = '#4c9aff'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke(); ctx.restore();
  ctx.strokeStyle = 'rgba(173,210,255,.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, R - 6, 0, TAU); ctx.stroke();
}

function drawGoal(ctx: Ctx, {cx, cy, radius: R}: Arena, angle: number) {
  const a1 = angle - GOAL_HALF;
  const a2 = angle + GOAL_HALF;
  const rBack = R + Math.min(22, R * 0.17);
  const x1 = cx + Math.cos(a1) * R, y1 = cy + Math.sin(a1) * R;
  const x2 = cx + Math.cos(a2) * R, y2 = cy + Math.sin(a2) * R;
  const bx1 = cx + Math.cos(a1) * rBack, by1 = cy + Math.sin(a1) * rBack;
  const bx2 = cx + Math.cos(a2) * rBack, by2 = cy + Math.sin(a2) * rBack;
  const frame = () => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(bx1, by1); ctx.lineTo(bx2, by2); ctx.lineTo(x2, y2);
  };

  ctx.save();
  // Kalenin ağ arka yüzeyi
  frame(); ctx.closePath();
  const net = ctx.createLinearGradient(x1, y1, bx1, by1);
  net.addColorStop(0, 'rgba(255,255,255,.20)');
  net.addColorStop(1, 'rgba(110,160,225,.035)');
  ctx.fillStyle = net; ctx.fill();
  ctx.strokeStyle = 'rgba(220,239,255,.68)'; ctx.lineWidth = 1;
  // Ağ kareleri
  for (let i = 1; i < 6; i++) {
    const f = i / 6;
    ctx.beginPath();
    ctx.moveTo(x1 + (x2 - x1) * f, y1 + (y2 - y1) * f);
    ctx.lineTo(bx1 + (bx2 - bx1) * f, by1 + (by2 - by1) * f);
    ctx.stroke();
  }
  for (let i = 1; i < 5; i++) {
    const f = i / 5;
    ctx.beginPath();
    ctx.moveTo(x1 + (bx1 - x1) * f, y1 + (by1 - y1) * f);
    ctx.lineTo(x2 + (bx2 - x2) * f, y2 + (by2 - y2) * f);
    ctx.stroke();
  }
  // Direkler ve üst travers: parlak altın metal
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.shadowColor = '#ffc94c'; ctx.shadowBlur = 15;
  ctx.strokeStyle = '#ffca45'; ctx.lineWidth = 5;
  frame(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#fff2b0'; ctx.lineWidth = 1.7;
  frame(); ctx.stroke();
  // Kale ağının ön ağız çizgisi
  ctx.strokeStyle = '#fff8d7'; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.restore();
}

function drawBall(ctx: Ctx, b: Ball) {
  const home = b.team === 0;
  const color = home ? '#ffbb36' : '#48a6ff';
  const light = home ? '#fff2ac' : '#d6f2ff';
  b.trail.forEach((p, i) => {
    const f = (i + 1) / b.trail.length;
    ctx.fillStyle = home ? `rgba(255,179,46,${f * 0.2})` : `rgba(61,151,255,${f * 0.2})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, b.r * f * 0.75, 0, TAU); ctx.fill();
  });
  ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 17;
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill(); ctx.restore();
  const g = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.4, 1, b.x, b.y, b.r);
  g.addColorStop(0, light); g.addColorStop(0.5, color); g.addColorStop(1, home ? '#a83b17' : '#1648a0');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.82, 0, TAU); ctx.fill();

  ctx.save();
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.8, 0, TAU); ctx.clip();
  ctx.translate(b.x, b.y); ctx.rotate(b.spin * (home ? 1 : -1));
  ctx.fillStyle = 'rgba(9,17,30,.8)'; ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * TAU) / 5;
    const x = Math.cos(a) * b.r * 0.27, y = Math.sin(a) * b.r * 0.27;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const a = (i * TAU) / 5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * b.r * 0.28, Math.sin(a) * b.r * 0.28);
    ctx.lineTo(Math.cos(a) * b.r * 0.72, Math.sin(a) * b.r * 0.72);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles(ctx: Ctx, state: SimulationState) {
  for (const p of state.particles) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Tüm sahneyi çizer. `t` yıldız parıltısı için kullanılan saniye cinsinden zamandır. */
export function renderScene(ctx: Ctx, state: SimulationState, t: number) {
  drawBackground(ctx, state, t);
  drawTurf(ctx, state.arena);
  drawGoal(ctx, state.arena, state.angle);
  drawParticles(ctx, state);
  for (const b of state.balls) drawBall(ctx, b);
}
