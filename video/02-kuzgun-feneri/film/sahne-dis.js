// Dış mekân sahneleri: fırtına, fener, istasyon, sandal, kayalık, mağara, jenerik kartları.
// Her sahne: SETS.ad = (g, i) => {...}  i: {t, T, dur, p, mouth(who), speaking(who), env}

const SETS = {};

function camera(g, i, def = [1.0, 1.08], cx = 960, cy = 540) {
  const z = i.p.z || def, k = easeInOut(i.t / Math.max(i.dur, 0.01));
  const s = lerp(z[0], z[1], k);
  const dx = (i.p.dx || 0) * k, dy = (i.p.dy || 0) * k;
  g.translate(960, 540); g.scale(s, s); g.translate(-cx - dx, -cy - dy);
}

function lightning(T, seed, rate = 0.18) {
  // birkaç saniyede bir çakan şimşek: 0..1 parlaklık
  const slot = Math.floor(T * rate), r = rng(slot * 97 + seed)();
  if (r > 0.55) return 0;
  const t0 = slot / rate + r * 2, dt = T - t0;
  if (dt < 0 || dt > 0.5) return 0;
  return (dt < 0.06 ? 1 : dt < 0.12 ? 0.3 : dt < 0.18 ? 0.8 : Math.exp(-(dt - 0.18) * 12)) * (0.6 + r * 0.8);
}

function sky(g, era, flash, top, bottom) {
  const gr = g.createLinearGradient(0, -200, 0, bottom);
  if (era === 1987) { gr.addColorStop(0, '#120d0a'); gr.addColorStop(0.6, '#3a2619'); gr.addColorStop(1, '#5a3a22'); }
  else { gr.addColorStop(0, '#060d14'); gr.addColorStop(0.6, '#13293a'); gr.addColorStop(1, '#24475a'); }
  g.fillStyle = gr; g.fillRect(-400, -300, 2720, bottom + 300);
  if (flash > 0) { g.fillStyle = `rgba(220,235,255,${0.45 * flash})`; g.fillRect(-400, -300, 2720, bottom + 300); }
}

function clouds(g, T, era, y0 = 0) {
  const r = rng(3);
  for (let k = 0; k < 14; k++) {
    const x = ((r() * 2600 + T * (8 + r() * 14)) % 2800) - 400, y = y0 + r() * 280, rx = 220 + r() * 260, ry = 60 + r() * 60;
    g.fillStyle = era === 1987 ? `rgba(20,12,8,${0.35 + r() * 0.3})` : `rgba(4,10,16,${0.35 + r() * 0.35})`;
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
  }
}

function boltPath(g, T, seed, flash) {
  if (flash < 0.6) return;
  const r = rng(Math.floor(T * 0.18) * 13 + seed);
  let x = 200 + r() * 1500, y = -50;
  g.strokeStyle = `rgba(240,248,255,${flash})`; g.lineWidth = 4; g.shadowColor = '#cfe6ff'; g.shadowBlur = 30;
  g.beginPath(); g.moveTo(x, y);
  while (y < 420) { x += (r() - 0.5) * 90; y += 30 + r() * 40; g.lineTo(x, y); }
  g.stroke(); g.shadowBlur = 0;
}

// Dalgalı deniz: katmanlar halinde, ön katmanlar daha büyük
function sea(g, T, horizon, era, intensity = 1, flash = 0) {
  const layers = 6;
  for (let L = 0; L < layers; L++) {
    const k = L / (layers - 1), y = horizon + Math.pow(k, 1.6) * (1100 - horizon);
    const amp = (6 + k * 60) * intensity, wl = 120 + k * 520, sp = 0.6 + k * 1.4;
    const base = era === 1987 ? [40 + k * 20, 32 + k * 14, 26 + k * 10] : [12 + k * 10, 34 + k * 22, 44 + k * 24];
    g.fillStyle = `rgb(${base.map((c) => Math.round(c + flash * 40)).join(',')})`;
    g.beginPath(); g.moveTo(-400, 1300);
    for (let x = -400; x <= 2320; x += 16) {
      const yy = y + Math.sin(x / wl + T * sp + L) * amp + Math.sin(x / (wl * 0.37) - T * sp * 1.7 + L * 2) * amp * 0.35;
      g.lineTo(x, yy);
    }
    g.lineTo(2320, 1300); g.closePath(); g.fill();
    // köpük ve mürekkep kontur
    g.strokeStyle = INK; g.lineWidth = 1 + k * 3; g.stroke();
    g.strokeStyle = `rgba(235,240,235,${0.25 + k * 0.5})`; g.lineWidth = 1 + k * 3;
    g.beginPath();
    for (let x = -400; x <= 2320; x += 16) {
      const yy = y + Math.sin(x / wl + T * sp + L) * amp + Math.sin(x / (wl * 0.37) - T * sp * 1.7 + L * 2) * amp * 0.35;
      const crest = Math.sin(x / wl + T * sp + L) > 0.6;
      if (crest) g.lineTo(x, yy + 2); else g.moveTo(x, yy + 2);
    }
    g.stroke();
  }
}

function rain(g, T, amount = 1, angle = 0.25) {
  const r = rng(17);
  g.strokeStyle = 'rgba(200,220,230,0.35)'; g.lineWidth = 1.6;
  g.beginPath();
  for (let k = 0; k < 420 * amount; k++) {
    const x = (r() * 2600 + T * 300 * angle * 4) % 2600 - 340, sp = 900 + r() * 700;
    const y = ((r() * 1400 + T * sp) % 1400) - 200, len = 22 + r() * 30;
    g.moveTo(x, y); g.lineTo(x - len * angle, y + len);
  }
  g.stroke();
}

// Fener kulesi
function lighthouse(g, x, y, s, T, opt = {}) {
  g.save(); g.translate(x, y); g.scale(s, s);
  // kayalık
  g.fillStyle = '#16110e';
  smoothPath(g, [[-260, 40], [-200, -30], [-120, -60], [-40, -80], [60, -76], [150, -50], [230, -10], [290, 40], [300, 120], [-280, 120]]);
  g.fill(); inkStroke(g, 4);
  hatchShade(g, () => smoothPath(g, [[-260, 40], [-200, -30], [-120, -60], [-40, -80], [60, -76], [150, -50], [230, -10], [290, 40], [300, 120], [-280, 120]]), 0, 0, 300, 0.2, 0.5);
  // kule
  const H = 440, bw = 72, tw = 46;
  const tower = () => polyPath(g, [[-bw, -70], [bw, -70], [tw, -70 - H], [-tw, -70 - H]]);
  g.fillStyle = opt.era === 1987 ? '#d8c3a0' : '#bcc6c4'; tower(); g.fill();
  g.save(); tower(); g.clip();
  g.fillStyle = opt.era === 1987 ? '#9b3a24' : '#8a2b22';
  for (let b = 0; b < 4; b++) g.fillRect(-100, -70 - H * (b * 0.25 + 0.06), 200, H * 0.11);
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(10, -80 - H, 80, H + 20);
  g.restore();
  tower(); inkStroke(g, 4);
  // pencereler
  for (const wy of [-180, -300, -410]) { g.fillStyle = opt.lit ? '#ffb950' : '#0b0d10'; g.beginPath(); g.roundRect(-9, wy, 18, 30, 8); g.fill(); inkStroke(g, 2.4); }
  // galeri
  const gy = -70 - H;
  g.fillStyle = '#1c1714'; g.fillRect(-tw - 26, gy - 10, (tw + 26) * 2, 14); inkStroke(g, 2.6);
  g.strokeStyle = INK; g.lineWidth = 2;
  for (let k = -tw - 20; k <= tw + 20; k += 12) { g.beginPath(); g.moveTo(k, gy - 10); g.lineTo(k, gy - 34); g.stroke(); }
  g.beginPath(); g.moveTo(-tw - 26, gy - 34); g.lineTo(tw + 26, gy - 34); g.stroke();
  // fener odası
  const lampOn = opt.lampOn ?? 1;
  g.fillStyle = opt.lit ? `rgba(255,200,110,${0.8 * lampOn + 0.1})` : `rgba(210,230,240,${0.5 * lampOn + 0.08})`;
  g.fillRect(-34, gy - 96, 68, 62); inkStroke(g, 3);
  g.strokeStyle = INK; g.lineWidth = 2; for (const k of [-12, 12]) { g.beginPath(); g.moveTo(k, gy - 96); g.lineTo(k, gy - 34); g.stroke(); }
  if (opt.silhouette) { g.fillStyle = 'rgba(20,12,8,0.85)'; g.beginPath(); g.ellipse(8, gy - 62, 9, 11, 0, 0, Math.PI * 2); g.fill(); g.fillRect(-4, gy - 52, 24, 20); }
  g.fillStyle = '#2a201b'; g.beginPath(); g.moveTo(-44, gy - 96); g.quadraticCurveTo(0, gy - 160, 44, gy - 96); g.closePath(); g.fill(); inkStroke(g, 3);
  g.restore();
  return { lx: x, ly: y + (gy - 66) * s };
}

// Dönen fener ışığı (on saniyede bir tur)
function beam(g, lx, ly, T, s = 1, warm = false, power = 1, period = 10) {
  const a = (T / period) * Math.PI * 2;
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const off of [0, Math.PI]) {
    const ang = a + off, facing = Math.cos(ang); // >0: sağa, sahne düzleminde
    const len = 1700 * s, spread = 0.09 + 0.05 * Math.abs(Math.sin(ang));
    const dir = Math.sign(facing) || 1, w = Math.abs(facing);
    if (w < 0.04) continue;
    const ex = lx + dir * len * w, gr = g.createLinearGradient(lx, ly, ex, ly);
    const col = warm ? '255,210,140' : '210,235,255';
    gr.addColorStop(0, `rgba(${col},${0.55 * power})`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(lx, ly - 8 * s); g.lineTo(ex, ly - len * spread); g.lineTo(ex, ly + len * spread); g.lineTo(lx, ly + 8 * s); g.closePath(); g.fill();
  }
  const facingCam = Math.pow(Math.max(0, Math.sin(a)), 30) + Math.pow(Math.max(0, -Math.sin(a)), 30);
  const glow = g.createRadialGradient(lx, ly, 0, lx, ly, 160 * s * (1 + facingCam * 3));
  glow.addColorStop(0, `rgba(255,240,210,${(0.7 + facingCam * 0.3) * power})`); glow.addColorStop(1, 'rgba(255,220,160,0)');
  g.fillStyle = glow; g.fillRect(lx - 800, ly - 800, 1600, 1600);
  g.restore();
}

function boatSilhouette(g, x, y, s, rot, light = 1, T = 0) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  g.fillStyle = '#0e0a08';
  g.beginPath(); g.moveTo(-90, -10); g.lineTo(90, -16); g.lineTo(60, 26); g.lineTo(-70, 24); g.closePath(); g.fill(); inkStroke(g, 3);
  g.fillRect(-20, -60, 46, 46); g.strokeRect(-20, -60, 46, 46);
  g.beginPath(); g.moveTo(4, -60); g.lineTo(4, -130); g.stroke();
  if (light > 0) {
    g.globalCompositeOperation = 'lighter';
    const gl = g.createRadialGradient(4, -130, 0, 4, -130, 60); gl.addColorStop(0, `rgba(255,220,140,${light})`); gl.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = gl; g.fillRect(-60, -190, 130, 130);
  }
  g.restore();
}

// ---------- SAHNELER ----------
SETS.void = (g, i) => {
  g.fillStyle = '#020403'; g.fillRect(0, 0, W, H);
  const e = i.envAny;
  g.save(); g.shadowColor = '#3cff9a'; g.shadowBlur = 18; g.strokeStyle = 'rgba(80,255,160,0.9)'; g.lineWidth = 3;
  g.beginPath();
  for (let x = 160; x <= 1760; x += 4) {
    const k = Math.sin((x - 160) / 1600 * Math.PI);
    const y = 540 + Math.sin(x * 0.045 + i.T * 22) * 90 * e * k + Math.sin(x * 0.13 - i.T * 31) * 30 * e * k + (rng(Math.floor(i.T * 24) * 2000 + x)() - 0.5) * 6 * k;
    x === 160 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.stroke(); g.restore();
};

SETS.storm = (g, i) => {
  const p = i.p, era = p.era || 0, T = i.T;
  const flash = p.calm ? 0 : lightning(T, 5);
  g.save(); camera(g, i, [1.0, 1.15], 1100, 520);
  sky(g, era, flash, 0, 760); clouds(g, T, era); boltPath(g, T, 5, flash);
  if (p.ship || p.wreck) {
    const bob = Math.sin(T * 1.7) * 14;
    const light = p.wreck ? clamp(1 - i.t / 2.5, 0, 1) * (Math.sin(T * 40) > 0 ? 1 : 0.2) : 1;
    boatSilhouette(g, 420, 700 + bob, 0.7, p.wreck ? 0.5 + i.t * 0.08 : Math.sin(T * 1.3) * 0.15, light, T);
  }
  const L = lighthouse(g, 1280, 760, 1.0, T, { era, lit: p.lit, silhouette: era === 1987, lampOn: 1 });
  sea(g, T, 700, era, p.calm ? 0.4 : 1, flash);
  if (p.rowboat) {
    const bx = 1000 + i.t * 18, by = 820 + Math.sin(T * 2.2) * 22;
    boatSilhouette(g, bx, by, 0.35, Math.sin(T * 2) * 0.2, 0.9, T);
  }
  beam(g, L.lx, L.ly, T, 1, era === 1987, p.lit || era === 0 ? 1 : 0.6);
  if (!p.calm) rain(g, T, 1);
  g.restore();
};

SETS.station_ext = (g, i) => {
  const T = i.T, flash = i.p.lateLight ? 0 : lightning(T, 9, 0.12);
  g.save(); camera(g, i, [1.0, 1.1], 900, 560);
  sky(g, 0, flash, 0, 800); clouds(g, T, 0);
  // uzaktaki fener
  const L = { lx: 260, ly: 610 };
  g.fillStyle = '#0a1016'; g.fillRect(250, 612, 20, 50);
  sea(g, T, 660, 0, 0.6, flash);
  beam(g, L.lx, L.ly, T, 0.35, false, 0.8);
  // kıyı ve bina
  g.fillStyle = '#0d0f12';
  smoothPath(g, [[500, 760], [800, 700], [1300, 690], [1900, 720], [2100, 900], [2100, 1200], [400, 1200]]); g.fill(); inkStroke(g, 4);
  g.fillStyle = '#2a3238'; g.fillRect(900, 470, 620, 260); inkStroke(g, 4); g.strokeRect(900, 470, 620, 260);
  g.fillStyle = '#1c2227'; polyPath(g, [[880, 470], [1540, 470], [1520, 440], [900, 440]]); g.fill(); inkStroke(g, 3);
  hatchShade(g, () => { g.beginPath(); g.rect(900, 470, 620, 260); }, 1210, 600, 400, 0.2, 0.4);
  for (const [wx, on] of [[960, 0], [1120, 1], [1300, 1]]) {
    g.fillStyle = on ? '#f2b45a' : '#141a1f'; g.fillRect(wx, 540, 120, 90); inkStroke(g, 3); g.strokeRect(wx, 540, 120, 90);
    if (on) { g.save(); g.globalCompositeOperation = 'lighter'; const gl = g.createRadialGradient(wx + 60, 585, 0, wx + 60, 585, 220); gl.addColorStop(0, 'rgba(255,190,100,0.35)'); gl.addColorStop(1, 'rgba(255,190,100,0)'); g.fillStyle = gl; g.fillRect(wx - 160, 365, 440, 440); g.restore(); }
  }
  g.fillStyle = '#e9e2d0'; g.fillRect(1000, 650, 300, 40); inkStroke(g, 2.6); g.strokeRect(1000, 650, 300, 40);
  g.fillStyle = INK; g.font = '700 24px "Oswald"'; g.textAlign = 'center'; g.fillText('KUZEY EGE İSTASYONU', 1150, 679);
  // anten direği
  g.strokeStyle = '#1a1f24'; g.lineWidth = 6; g.beginPath(); g.moveTo(1450, 440); g.lineTo(1450, 120); g.stroke();
  g.lineWidth = 2.4; for (let y = 160; y < 440; y += 40) { g.beginPath(); g.moveTo(1430, y); g.lineTo(1470, y + 40); g.moveTo(1470, y); g.lineTo(1430, y + 40); g.stroke(); }
  if (Math.sin(T * 3) > 0) { g.save(); g.globalCompositeOperation = 'lighter'; const gl = g.createRadialGradient(1450, 118, 0, 1450, 118, 50); gl.addColorStop(0, 'rgba(255,40,30,0.9)'); gl.addColorStop(1, 'rgba(255,0,0,0)'); g.fillStyle = gl; g.fillRect(1390, 60, 120, 120); g.restore(); }
  if (!i.p.lateLight) rain(g, T, 1); else rain(g, T, 0.3);
  g.restore();
};

SETS.rowboat = (g, i) => {
  const T = i.T, flash = lightning(T, 21, 0.25);
  g.save(); camera(g, i, [1.05, 1.2], 960, 560);
  sky(g, 1987, flash, 0, 700); clouds(g, T, 1987); boltPath(g, T, 21, flash);
  const L = lighthouse(g, 1700, 640, 0.55, T, { era: 1987, lit: 1, lampOn: 1 });
  beam(g, L.lx, L.ly, T, 0.6, true, 0.8);
  sea(g, T, 560, 1987, 1.5, flash);
  // sandal ve Hasan
  const by = 760 + Math.sin(T * 1.6) * 60, rot = Math.sin(T * 1.6 + 0.8) * 0.22;
  g.save(); g.translate(880, by); g.rotate(rot);
  g.fillStyle = '#3b2416'; g.beginPath(); g.moveTo(-170, -10); g.lineTo(170, -20); g.lineTo(130, 40); g.lineTo(-140, 40); g.closePath(); g.fill(); inkStroke(g, 4);
  g.fillStyle = '#d9a62a'; smoothPath(g, [[-50, -10], [-56, -90], [-20, -130], [30, -126], [56, -80], [50, -10]]); g.fill(); inkStroke(g, 3.4);
  g.fillStyle = '#7d7267'; g.beginPath(); g.ellipse(0, -150, 34, 30, 0, 0, Math.PI * 2); g.fill(); inkStroke(g, 3);
  const oar = Math.sin(T * 3.2) * 0.5;
  g.strokeStyle = '#2a1a10'; g.lineWidth = 8;
  for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * 40, -60); g.lineTo(sd * (180 + Math.cos(oar) * 40), 40 + Math.sin(oar) * 30); g.stroke(); }
  // fener (el lambası)
  g.fillStyle = '#ffcf70'; g.beginPath(); g.arc(120, -40, 14, 0, Math.PI * 2); g.fill(); inkStroke(g, 2.4);
  g.globalCompositeOperation = 'lighter'; const gl = g.createRadialGradient(120, -40, 0, 120, -40, 260); gl.addColorStop(0, 'rgba(255,190,90,0.6)'); gl.addColorStop(1, 'rgba(255,170,70,0)'); g.fillStyle = gl; g.fillRect(-160, -320, 560, 560);
  g.restore();
  // ön plan dev dalga
  g.fillStyle = 'rgba(30,24,20,0.95)'; g.beginPath(); g.moveTo(-400, 1300);
  for (let x = -400; x <= 2320; x += 20) g.lineTo(x, 980 + Math.sin(x / 300 + T * 2) * 70 + Math.sin(x / 90 - T * 3) * 12);
  g.lineTo(2320, 1300); g.fill(); inkStroke(g, 5);
  rain(g, T, 1.3, 0.35);
  g.restore();
};

SETS.rocks = (g, i) => {
  const T = i.T, p = i.p, flash = p.flare ? 0 : lightning(T, 33, 0.25);
  g.save(); camera(g, i, [1.0, 1.12], 960, 540);
  sky(g, 1987, flash, 0, 700); clouds(g, T, 1987); boltPath(g, T, 33, flash);
  sea(g, T, 600, 1987, 1.4, flash);
  if (p.boat) {
    const bx = 2000 - i.t * 60;
    boatSilhouette(g, bx, 690 + Math.sin(T * 1.4) * 12, 0.55, 0, 0);
    g.save(); g.globalCompositeOperation = 'lighter';
    const gr = g.createLinearGradient(bx - 30, 640, bx - 600, 600); gr.addColorStop(0, 'rgba(255,250,220,0.6)'); gr.addColorStop(1, 'rgba(255,250,220,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(bx - 30, 640); g.lineTo(bx - 700, 560); g.lineTo(bx - 700, 700); g.closePath(); g.fill(); g.restore();
  }
  // kayalık
  g.fillStyle = '#100c0a';
  smoothPath(g, [[-300, 1200], [-200, 760], [200, 640], [520, 560], [720, 520], [860, 560], [1100, 720], [1500, 900], [2200, 1000], [2200, 1300]]);
  g.fill(); inkStroke(g, 5);
  hatchShade(g, () => smoothPath(g, [[-300, 1200], [-200, 760], [200, 640], [520, 560], [720, 520], [860, 560], [1100, 720], [1500, 900], [2200, 1000], [2200, 1300]]), 700, 800, 900, -0.4, 0.5);
  if (p.climb) {
    const cy = 700 - i.t * 22, cx = 760 + Math.sin(i.t) * 8;
    g.fillStyle = '#d9a62a'; g.beginPath(); g.ellipse(cx, cy, 26, 46, 0.2, 0, Math.PI * 2); g.fill(); inkStroke(g, 3);
    g.fillStyle = '#7d7267'; g.beginPath(); g.arc(cx + 6, cy - 52, 20, 0, Math.PI * 2); g.fill(); inkStroke(g, 3);
    g.save(); g.globalCompositeOperation = 'lighter'; const gl = g.createRadialGradient(cx + 40, cy - 10, 0, cx + 40, cy - 10, 200); gl.addColorStop(0, 'rgba(255,190,90,0.5)'); gl.addColorStop(1, 'rgba(255,170,70,0)'); g.fillStyle = gl; g.fillRect(cx - 200, cy - 220, 480, 420); g.restore();
  }
  if (p.flare) {
    const fx = 720, fy = 500, fl = 0.8 + 0.2 * Math.sin(T * 37) * Math.sin(T * 23);
    g.strokeStyle = '#2a1a10'; g.lineWidth = 6; g.beginPath(); g.moveTo(fx, fy + 30); g.lineTo(fx, fy); g.stroke();
    g.save(); g.globalCompositeOperation = 'lighter';
    const gl = g.createRadialGradient(fx, fy, 0, fx, fy, 900 * fl); gl.addColorStop(0, 'rgba(255,80,50,0.95)'); gl.addColorStop(0.15, 'rgba(255,50,30,0.45)'); gl.addColorStop(1, 'rgba(255,20,10,0)');
    g.fillStyle = gl; g.fillRect(-300, -400, 2400, 1800);
    g.restore();
    const r = rng(Math.floor(T * 24));
    for (let k = 0; k < 30; k++) { // duman
      const a = r(), yy = fy - (((T * 60 + a * 400) % 400)), xx = fx + Math.sin(yy * 0.02 + a * 6) * 40 - (fy - yy) * 0.4;
      g.fillStyle = `rgba(90,40,35,${0.25 * (yy - fy + 400) / 400})`; g.beginPath(); g.arc(xx, yy, 20 + (fy - yy) * 0.15, 0, Math.PI * 2); g.fill();
    }
  }
  rain(g, T, 1.1, 0.3);
  g.restore();
};

SETS.cave = (g, i) => {
  const T = i.T, p = i.p, shot = p.shot || 'wide';
  const flash = lightning(T, 41, 0.2);
  g.save();
  const Z = { wide: [[1.0, 1.06], 960, 560], two: [[1.55, 1.62], 900, 620], girl: [[2.6, 2.75], 1180, 640], hasan: [[2.3, 2.45], 760, 520] }[shot];
  camera(g, i, Z[0], Z[1], Z[2]);
  // mağara ağzı: dışarıda fırtınalı deniz
  g.save(); smoothPath(g, [[700, 120], [1100, 80], [1400, 200], [1460, 500], [1300, 640], [760, 640], [600, 420]]); g.clip();
  sky(g, 1987, flash, 0, 500); sea(g, T, 380, 1987, 1.3, flash); rain(g, T, 0.8);
  g.restore();
  // kaya duvarlar
  g.fillStyle = '#17110d';
  g.beginPath(); g.rect(-200, -200, 2320, 1500);
  smoothPath(g, [[700, 120], [1100, 80], [1400, 200], [1460, 500], [1300, 640], [760, 640], [600, 420]]);
  g.fill('evenodd');
  g.strokeStyle = INK; g.lineWidth = 9; smoothPath(g, [[700, 120], [1100, 80], [1400, 200], [1460, 500], [1300, 640], [760, 640], [600, 420]]); g.stroke();
  g.strokeStyle = 'rgba(160,190,200,0.35)'; g.lineWidth = 3; g.stroke();
  g.save(); g.globalAlpha = 0.65; g.fillStyle = hatchPattern(g); g.beginPath(); g.rect(-200, -200, 2320, 1500); smoothPath(g, [[700, 120], [1100, 80], [1400, 200], [1460, 500], [1300, 640], [760, 640], [600, 420]]); g.fill('evenodd'); g.restore();
  g.fillStyle = '#120d0a'; smoothPath(g, [[-200, 1300], [-200, 820], [300, 760], [800, 800], [1300, 760], [2200, 840], [2200, 1300]]); g.fill(); inkStroke(g, 4);
  // fener ışığı
  const lx = 820, ly = 720;
  g.save(); g.globalCompositeOperation = 'lighter';
  const gl = g.createRadialGradient(lx, ly, 0, lx, ly, 900); gl.addColorStop(0, 'rgba(255,190,100,0.5)'); gl.addColorStop(0.3, 'rgba(255,150,60,0.14)'); gl.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = gl; g.fillRect(-200, -200, 2400, 1600); g.restore();
  // küçük Nur: kayaya sarılmış
  g.fillStyle = '#2a201a'; smoothPath(g, [[1080, 900], [1120, 640], [1200, 600], [1300, 640], [1340, 900]]); g.fill(); inkStroke(g, 4);
  const girlMouth = i.mouth('kucukNur');
  torso(g, 1190, 700, 0.42, '#f0b628');
  head(g, 'kucukNur', { x: 1190, y: 650, s: 0.42, worry: 1.1, eyeOpen: 1.05, tears: 0.6 + (T % 1) * 0.3, mouth: girlMouth, blink: blinkAt(T, 3), look: [-0.6, 0.1] });
  // Hasan diz çökmüş
  const hm = i.mouth('hasan'), calm = p.calm;
  torso(g, 760, 720, 0.6, '#d9a62a', { shadeAngle: 0.8 });
  head(g, 'hasan', { x: 760, y: 610, s: 0.6, turn: 0.35, look: [0.8, 0.2], mouth: hm, smile: calm ? 0.35 : 0.1, worry: calm ? 0.2 : 0.5, eyeOpen: calm ? 0.75 : 0.95, blink: blinkAt(T, 8) });
  // el feneri
  g.fillStyle = '#3a2a18'; g.fillRect(lx - 16, ly - 10, 32, 40); inkStroke(g, 2.6);
  g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(lx, ly - 18, 13, 0, Math.PI * 2); g.fill(); inkStroke(g, 2.4);
  if (p.give) { // düdüğü uzatan el
    const k = easeInOut(clamp(i.t / Math.max(i.dur * 0.6, 0.1), 0, 1));
    whistle(g, lerp(880, 1100, k), lerp(700, 690, k), 0.7, -0.3, false);
  }
  g.restore();
};

SETS.title = (g, i) => {
  g.fillStyle = '#04080b'; g.fillRect(0, 0, W, H);
  beam(g, 960, 470, i.T, 1.2, false, 0.6, 6);
  const k = range(i.t, 0.4, 1.4), title = 'KUZGUN FENERİ';
  g.save(); g.textAlign = 'center'; g.font = '400 220px "Bebas Neue"';
  g.globalAlpha = k * (i.t < 2 && Math.sin(i.t * 70) > 0.5 ? 0.4 : 1);
  g.shadowColor = 'rgba(255,200,120,0.7)'; g.shadowBlur = 40; g.fillStyle = '#f3e2c6'; g.fillText(title, 960, 600);
  g.shadowBlur = 0; g.globalAlpha = range(i.t, 1.6, 2.4);
  g.font = '400 56px "Special Elite"'; g.fillStyle = '#ff5a3c'; g.fillText(typed('— SON ÇAĞRI —', range(i.t, 1.6, 2.8)), 960, 690);
  g.restore();
};

SETS.end = (g, i) => {
  g.fillStyle = '#04080b'; g.fillRect(0, 0, W, H);
  beam(g, 960, 300, i.T, 0.8, false, 0.35, 10);
  g.save(); g.textAlign = 'center';
  g.globalAlpha = range(i.t, 0.3, 1.2); g.font = '400 120px "Bebas Neue"'; g.fillStyle = '#f3e2c6'; g.fillText('KUZGUN FENERİ', 960, 470);
  g.globalAlpha = range(i.t, 1.2, 2.0); g.font = '400 44px "Special Elite"'; g.fillStyle = '#e8d6b8';
  g.fillText('Siz olsaydınız... telsizi kapatır mıydınız?', 960, 580);
  g.globalAlpha = range(i.t, 2.2, 3.0); g.font = '400 34px "Courier Prime"'; g.fillStyle = 'rgba(232,214,184,0.8)';
  g.fillText('Yorumlarda buluşalım · Abone olmayı unutmayın', 960, 660);
  g.globalAlpha = range(i.t, 3.0, 3.8); g.font = '400 24px "Courier Prime"'; g.fillStyle = 'rgba(232,214,184,0.5)';
  g.fillText('Bu hikâye kurgudur. Kişiler ve olaylar hayal ürünüdür.', 960, 980);
  g.restore();
};
