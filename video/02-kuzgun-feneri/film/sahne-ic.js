// İç mekân ve yakın çekim sahneleri.

function blinkAt(T, seed) {
  const period = 3.2 + (seed % 5) * 0.4, ph = (T + seed * 1.37) % period;
  return ph < 0.12 ? Math.sin((ph / 0.12) * Math.PI) : 0;
}

const EXPR = {
  calm: { smile: 0.15 }, listen: { worry: 0.15, smile: 0.2, look: [0.5, 0] }, smile: { smile: 0.85, eyeOpen: 0.85 },
  surprised: { brow: 0.8, eyeOpen: 1.15, pupil: 0.8 }, cautious: { worry: 0.45, eyeOpen: 0.92 }, hesitant: { worry: 0.6, look: [-0.5, 0.25] },
  curious: { brow: 0.4, worry: 0.2, look: [0.6, 0] }, determined: { worry: -0.35, eyeOpen: 0.85, look: [-0.3, 0.2] },
  shock: { brow: 1, eyeOpen: 1.25, pupil: 0.7, mouthBase: 0.2 }, realize: { brow: 0.9, eyeOpen: 1.2, pupil: 0.62, mouthBase: 0.12 },
  dilemma: { worry: 1, look: [0.3, 0.35] }, tremble: { worry: 1, tremble: 1 }, cry: { worry: 1.15, eyeOpen: 0.75, tremble: 0.5 },
  stern: { worry: -0.4, eyeOpen: 0.8 }, frozen: { brow: 0.7, eyeOpen: 1.2, pupil: 0.7 }, soft: { worry: 0.3, eyeOpen: 0.85, look: [0.4, 0.1] },
  sad: { worry: 0.85, eyeOpen: 0.7, look: [0, 0.45] }, whisper: { worry: 0.6, eyeOpen: 0.9 }, tears: { worry: 0.9, eyeOpen: 0.7, smile: 0.1 },
  shout: { brow: 0.6, eyeOpen: 1.1, mouthBase: 0.15 }, angry: { worry: -0.9, eyeOpen: 0.95 }, silent: { worry: 0.4, look: [0, 0.35] },
};

function face(i, who, expr, extra = {}) {
  const e = EXPR[expr] || {};
  const m = i.mouth(who), tr = (e.tremble || 0) * Math.sin(i.T * 30) * 0.8;
  return Object.assign({ blink: blinkAt(i.T, who.length), mouth: Math.min(1, (e.mouthBase || 0) + m * 0.95) }, e, { tilt: tr * 0.01 }, extra);
}

function bokehBg(g, base, spots) {
  g.fillStyle = base; g.fillRect(-200, -200, 2320, 1480);
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const [x, y, r, c] of spots) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  g.restore();
  g.save(); g.globalAlpha = 0.12; g.fillStyle = hatchPattern(g); g.fillRect(-200, -200, 2320, 1480); g.restore();
}

const NIGHT_BG = [[300, 760, 380, 'rgba(60,255,160,0.18)'], [1650, 300, 300, 'rgba(255,170,80,0.22)'], [1400, 820, 200, 'rgba(80,200,255,0.15)'], [500, 200, 260, 'rgba(80,140,170,0.15)']];
const DAWN_BG = [[1500, 300, 520, 'rgba(255,200,150,0.35)'], [400, 820, 200, 'rgba(255,170,60,0.4)'], [300, 200, 400, 'rgba(140,180,230,0.25)']];

function headset(g, x, y, s, mic = true) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.strokeStyle = '#15171a'; g.lineWidth = 14; g.beginPath(); g.arc(0, -10, 118, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
  for (const sd of [-1, 1]) { g.fillStyle = '#23272c'; ellipsePath(g, sd * 104, 10, 26, 40, 0, 9 + sd, 0.3); g.fill(); inkStroke(g, 3); }
  if (mic) { g.strokeStyle = '#15171a'; g.lineWidth = 6; g.beginPath(); g.moveTo(-104, 30); g.quadraticCurveTo(-90, 110, -30, 92); g.stroke(); g.fillStyle = '#111'; g.beginPath(); g.ellipse(-26, 92, 12, 9, 0, 0, Math.PI * 2); g.fill(); }
  g.restore();
}

function phoneAtEar(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = '#111418'; g.beginPath(); g.roundRect(84, -60, 44, 150, 12); g.fill(); inkStroke(g, 3);
  g.fillStyle = PAL.skin; smoothPath(g, [[80, 40], [140, 20], [170, 80], [150, 170], [100, 190], [70, 120]]); g.fill(); inkStroke(g, 3);
  g.restore();
}

// Karakter yakın çekim çerçevesi
function portrait(g, i, who, opts) {
  const dawn = opts.dawn;
  bokehBg(g, dawn ? '#3a4a5c' : '#0e1a20', dawn ? DAWN_BG : NIGHT_BG);
  g.save(); camera(g, i, i.p.z || [1.0, 1.06], 960, 540);
  const x = opts.x || 900, y = opts.y || 470, s = opts.s || 2.0;
  const jacket = { deniz: PAL.navy, enes: PAL.navy, nur: '#6e3b4a', hasan: '#d9a62a' }[who];
  torso(g, x, y + 100 * s, s * 0.9, jacket, { shadeAngle: dawn ? -2.6 : 0.4, collar: opts.collar });
  if (opts.preHead) opts.preHead(g, x, y, s);
  head(g, who, Object.assign(face(i, who, i.p.expr || 'calm', { tears: i.p.tears ? (i.T * 0.6) % 1 : 0 }), { x, y, s, shadeAngle: dawn ? -2.6 : 0.5 }));
  if (opts.post) opts.post(g, x, y, s);
  g.restore();
  // ışık rengi
  g.save(); g.globalCompositeOperation = 'soft-light';
  g.fillStyle = dawn ? 'rgba(255,190,140,0.35)' : 'rgba(40,200,160,0.25)'; g.fillRect(0, 0, W, H); g.restore();
}

SETS.deniz = (g, i) => portrait(g, i, 'deniz', {
  dawn: i.p.dawn,
  collar: (gg) => { gg.fillStyle = PAL.orange; polyPath(gg, [[-60, 10], [0, 70], [60, 10], [40, 0], [0, 40], [-40, 0]]); gg.fill(); inkStroke(gg, 3); },
  post: (gg, x, y, s) => {
    whistle(gg, x + 6 * s, y + 230 * s, s * 0.6, 0.1);
    if (i.p.headset) headset(gg, x, y, s);
    if (i.p.phone) phoneAtEar(gg, x, y, s);
  },
});

SETS.enes = (g, i) => portrait(g, i, 'enes', {
  x: 980,
  collar: (gg) => {
    gg.fillStyle = '#e9e4d8'; polyPath(gg, [[-50, 6], [0, 60], [50, 6]]); gg.fill(); inkStroke(gg, 2.6);
    for (const sd of [-1, 1]) { gg.fillStyle = PAL.brassLight; gg.fillRect(sd * 150 - 40, 40, 80, 18); inkStroke(gg, 2); }
    gg.fillStyle = PAL.brass; for (const by of [90, 150, 210]) { gg.beginPath(); gg.arc(0, by, 8, 0, Math.PI * 2); gg.fill(); inkStroke(gg, 2); }
  },
});

SETS.nur = (g, i) => portrait(g, i, 'nur', {
  dawn: true, x: 1000,
  collar: (gg) => { gg.fillStyle = '#c9a77a'; smoothPath(gg, [[-200, 60], [-60, 20], [0, 90], [60, 20], [200, 60], [150, 140], [0, 120], [-150, 140]]); gg.fill(); inkStroke(gg, 3); },
});

// İstasyon içi geniş plan
SETS.station_int = (g, i) => {
  const T = i.T, p = i.p, shot = p.shot || 'wide', flash = lightning(T, 9, 0.15);
  g.save(); camera(g, i, shot === 'two' ? [1.12, 1.18] : [1.0, 1.08], 960, 560);
  // duvar
  g.fillStyle = '#16262c'; g.fillRect(-100, -100, 2120, 1300);
  stipple(g, -100, -100, 2120, 900, 5000, 3, 'rgba(0,0,0,0.25)', 1.6);
  // pencere
  g.save(); g.beginPath(); g.rect(480, 160, 640, 430); g.clip();
  sky(g, 0, flash, 0, 600); sea(g, T, 470, 0, 0.5, flash);
  g.fillStyle = '#05080b'; g.fillRect(290, 450, 14, 30);
  beam(g, 297, 448, T, 0.25, false, p.flickerBeam ?? 0.8);
  rain(g, T, 0.7);
  g.restore();
  g.lineWidth = 10; g.strokeStyle = '#0b1114'; g.strokeRect(480, 160, 640, 430); g.lineWidth = 6; g.beginPath(); g.moveTo(800, 160); g.lineTo(800, 590); g.stroke();
  inkStroke(g, 3);
  // takvim
  g.fillStyle = '#e8e1cf'; g.fillRect(1230, 220, 170, 200); inkStroke(g, 3); g.strokeRect(1230, 220, 170, 200);
  g.fillStyle = PAL.red; g.fillRect(1230, 220, 170, 50);
  g.fillStyle = '#fff'; g.font = '700 30px "Oswald"'; g.textAlign = 'center'; g.fillText('KASIM', 1315, 256);
  g.fillStyle = INK; g.font = '700 100px "Oswald"'; g.fillText('14', 1315, 380);
  // kapı
  const open = p.door ? easeInOut(clamp(i.t / 2.2, 0, 1)) : (shot === 'two' ? 1 : 0);
  g.fillStyle = '#d9b27a'; g.fillRect(1600, 140, 260, 760);
  if (open > 0) { g.save(); g.globalCompositeOperation = 'lighter'; const gl = g.createRadialGradient(1730, 520, 0, 1730, 520, 700); gl.addColorStop(0, `rgba(255,200,120,${0.4 * open})`); gl.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = gl; g.fillRect(1100, -100, 1000, 1200); g.restore(); }
  g.fillStyle = '#2b1d14'; polyPath(g, [[1600, 140], [1600 + 260 * (1 - open * 0.85), 140 + 30 * open], [1600 + 260 * (1 - open * 0.85), 900 - 30 * open], [1600, 900]]); g.fill(); inkStroke(g, 3.4);
  if (p.door && i.t > 1.2) { // kapıdaki siluet
    const a = clamp((i.t - 1.2) / 1, 0, 1); g.fillStyle = `rgba(10,8,6,${0.9 * a})`;
    g.beginPath(); g.ellipse(1760, 360, 50, 60, 0, 0, Math.PI * 2); g.fill(); g.fillRect(1690, 410, 140, 490);
  }
  // Enes (iki kişilik plan)
  if (shot === 'two') {
    const fe = face(i, 'enes', p.relief ? 'soft' : p.tense ? 'frozen' : 'shock', p.relief ? { blink: 1 } : {});
    torso(g, 1420, 560, 0.85, PAL.navy); head(g, 'enes', Object.assign(fe, { x: 1420, y: 470, s: 0.85, turn: -0.3, look: [-0.7, 0.3] }));
  }
  // masa ve cihazlar
  g.fillStyle = '#2a1f19'; g.fillRect(-100, 760, 2120, 400); inkStroke(g, 4); g.strokeRect(-100, 760, 2120, 400);
  g.fillStyle = '#3a3f44'; g.fillRect(220, 600, 420, 170); inkStroke(g, 3.4); g.strokeRect(220, 600, 420, 170);
  for (let k = 0; k < 5; k++) { g.fillStyle = '#15181b'; g.beginPath(); g.arc(270 + k * 60, 720, 18, 0, Math.PI * 2); g.fill(); inkStroke(g, 2.4); }
  g.fillStyle = '#0f2a1c'; g.fillRect(250, 620, 200, 60); g.fillStyle = '#5dffa8'; g.font = '700 30px "Courier Prime"'; g.textAlign = 'left'; g.fillText('CH 16', 270, 662);
  // radar
  g.fillStyle = '#1b1f22'; g.fillRect(720, 540, 340, 230); inkStroke(g, 3.4); g.strokeRect(720, 540, 340, 230);
  g.fillStyle = '#052014'; g.beginPath(); g.arc(890, 655, 95, 0, Math.PI * 2); g.fill();
  const sa = T * 2; g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(80,255,150,0.35)'; g.beginPath(); g.moveTo(890, 655); g.arc(890, 655, 95, sa - 0.5, sa); g.closePath(); g.fill();
  const rg = g.createRadialGradient(890, 655, 0, 890, 655, 600); rg.addColorStop(0, 'rgba(60,255,150,0.25)'); rg.addColorStop(1, 'rgba(60,255,150,0)'); g.fillStyle = rg; g.fillRect(290, 55, 1200, 1200); g.restore();
  g.fillStyle = '#20262b'; g.fillRect(1120, 560, 330, 210); inkStroke(g, 3.4); g.strokeRect(1120, 560, 330, 210);
  g.fillStyle = '#0d2b3a'; g.fillRect(1140, 580, 290, 170);
  // Deniz arkadan
  const dx = shot === 'two' ? 820 : 900;
  g.fillStyle = PAL.navy; smoothPath(g, [[dx - 230, 1100], [dx - 220, 900], [dx - 120, 820], [dx + 120, 820], [dx + 220, 900], [dx + 230, 1100]]); g.fill(); inkStroke(g, 4);
  g.fillStyle = '#1b1411'; ellipsePath(g, dx, 740, 105, 118, 0, 77, 0.8); g.fill(); inkStroke(g, 4);
  g.strokeStyle = '#15171a'; g.lineWidth = 14; g.beginPath(); g.arc(dx, 740, 108, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
  for (const sd of [-1, 1]) { g.fillStyle = '#23272c'; ellipsePath(g, dx + sd * 104, 760, 24, 38, 0, 4, 0.3); g.fill(); inkStroke(g, 3); }
  g.strokeStyle = 'rgba(90,255,170,0.5)'; g.lineWidth = 4; g.beginPath(); g.arc(dx, 740, 104, Math.PI * 1.15, Math.PI * 1.55); g.stroke();
  g.restore();
};

SETS.radio = (g, i) => {
  const T = i.T, mode = i.p.mode || 'live', old = mode === 'broken';
  g.save(); camera(g, i, [1.0, 1.1], 960, 540);
  g.fillStyle = old ? '#2b2118' : '#15191c'; g.fillRect(-100, -100, 2120, 1300);
  // panel
  g.fillStyle = old ? '#5a4a36' : '#3a4046'; g.beginPath(); g.roundRect(160, 180, 1600, 720, 30); g.fill(); inkStroke(g, 5);
  stipple(g, 160, 180, 1600, 720, 2500, 8, 'rgba(0,0,0,0.3)', 1.6);
  // osiloskop ekranı
  g.fillStyle = old ? '#1a1206' : '#031a0f'; g.beginPath(); g.roundRect(240, 250, 820, 420, 20); g.fill(); inkStroke(g, 4);
  g.strokeStyle = old ? 'rgba(255,170,60,0.15)' : 'rgba(80,255,160,0.15)'; g.lineWidth = 1.5;
  for (let x = 240; x <= 1060; x += 82) { g.beginPath(); g.moveTo(x, 250); g.lineTo(x, 670); g.stroke(); }
  for (let y = 250; y <= 670; y += 70) { g.beginPath(); g.moveTo(240, y); g.lineTo(1060, y); g.stroke(); }
  let e = i.envWho('hasan');
  if (mode === 'static') e = 0.15 + 0.25 * Math.abs(Math.sin(T * 13));
  if (mode === 'silent' || mode === 'mic') e = 0.02;
  if (mode === 'dead') e = i.t < 2.6 ? 0.4 * (Math.sin(T * 50) > 0 ? 1 : 0.2) : 0;
  if (mode === 'flicker') e = (i.t % 3 < 0.4) ? 0.5 : 0.02;
  if (old) e = 0.05;
  g.save(); g.shadowColor = old ? '#ffb347' : '#3cff9a'; g.shadowBlur = 16; g.strokeStyle = old ? 'rgba(255,190,90,0.9)' : 'rgba(90,255,170,0.95)'; g.lineWidth = 3.5;
  g.beginPath();
  for (let x = 250; x <= 1050; x += 4) {
    const k = Math.sin((x - 250) / 800 * Math.PI), r = rng(Math.floor(T * 24) * 1000 + x)();
    const y = 460 + Math.sin(x * 0.05 + T * 25) * 140 * e * k + Math.sin(x * 0.17 - T * 37) * 50 * e * k + (r - 0.5) * (8 + e * 40) * k;
    x === 250 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.stroke(); g.restore();
  // VU göstergesi
  g.fillStyle = '#efe3c6'; g.beginPath(); g.roundRect(1140, 260, 520, 240, 14); g.fill(); inkStroke(g, 4);
  g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.arc(1400, 480, 190, Math.PI * 1.2, Math.PI * 1.8); g.stroke();
  g.strokeStyle = PAL.red; g.beginPath(); g.arc(1400, 480, 190, Math.PI * 1.65, Math.PI * 1.8); g.stroke();
  const na = Math.PI * (1.22 + Math.min(0.56, e * 0.5 + 0.02));
  g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.moveTo(1400, 480); g.lineTo(1400 + Math.cos(na) * 200, 480 + Math.sin(na) * 200); g.stroke();
  // frekans ve düğmeler
  g.fillStyle = '#0a1a10'; g.fillRect(1140, 540, 360, 110); inkStroke(g, 3); g.strokeRect(1140, 540, 360, 110);
  g.fillStyle = old ? '#ffb347' : '#5dffa8'; g.font = '700 64px "Courier Prime"'; g.textAlign = 'left'; g.fillText(old ? 'ARIZA' : 'KNL 16', 1160, 620);
  const tx = mode === 'live' && e > 0.2 || (mode === 'mic' && Math.sin(T * 4) > 0) || mode === 'static';
  g.fillStyle = tx ? '#ff3b24' : '#4a1410'; g.beginPath(); g.arc(1590, 595, 28, 0, Math.PI * 2); g.fill(); inkStroke(g, 3);
  if (tx) { g.save(); g.globalCompositeOperation = 'lighter'; const gl = g.createRadialGradient(1590, 595, 0, 1590, 595, 120); gl.addColorStop(0, 'rgba(255,60,30,0.6)'); gl.addColorStop(1, 'rgba(255,0,0,0)'); g.fillStyle = gl; g.fillRect(1470, 475, 240, 240); g.restore(); }
  for (let k = 0; k < 6; k++) { g.fillStyle = '#16191c'; g.beginPath(); g.arc(320 + k * 130, 780, 40, 0, Math.PI * 2); g.fill(); inkStroke(g, 3); g.strokeStyle = '#ccc'; g.lineWidth = 3; g.beginPath(); g.moveTo(320 + k * 130, 780); g.lineTo(320 + k * 130 + Math.cos(k + 1) * 30, 780 + Math.sin(k + 1) * 30); g.stroke(); }
  if (mode === 'mic') { // masa mikrofonu ön planda
    g.fillStyle = '#0c0e10'; g.beginPath(); g.ellipse(1500, 1060, 180, 50, 0, 0, Math.PI * 2); g.fill(); g.fillRect(1480, 760, 40, 300);
    g.beginPath(); g.roundRect(1430, 640, 140, 160, 60); g.fill(); inkStroke(g, 4);
  }
  if (old) { g.strokeStyle = 'rgba(0,0,0,0.8)'; g.lineWidth = 3; g.beginPath(); g.moveTo(400, 260); g.lineTo(520, 420); g.lineTo(480, 560); g.moveTo(520, 420); g.lineTo(700, 470); g.stroke(); }
  g.restore();
};

SETS.radar = (g, i) => {
  const T = i.T;
  g.save(); camera(g, i, [1.0, 1.08], 960, 540);
  g.fillStyle = '#0b0f11'; g.fillRect(-100, -100, 2120, 1300);
  g.fillStyle = '#1b2024'; g.beginPath(); g.roundRect(460, 60, 1000, 960, 40); g.fill(); inkStroke(g, 5);
  const cx = 960, cy = 540, R = 420;
  g.fillStyle = '#021a0e'; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill(); inkStroke(g, 5);
  g.strokeStyle = 'rgba(80,255,160,0.25)'; g.lineWidth = 2;
  for (let r = 100; r <= R; r += 105) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); }
  for (let a = 0; a < 12; a++) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a * Math.PI / 6) * R, cy + Math.sin(a * Math.PI / 6) * R); g.stroke(); }
  // kıyı şeridi
  g.fillStyle = 'rgba(80,255,160,0.25)'; smoothPath(g, [[cx + 60, cy + 420], [cx + 140, cy + 180], [cx + 300, cy + 80], [cx + 420, cy + 60], [cx + 420, cy + 420]]); g.fill();
  g.fillStyle = 'rgba(120,255,190,0.8)'; g.beginPath(); g.arc(cx - 160, cy - 90, 6, 0, Math.PI * 2); g.fill();
  const sa = T * 1.6;
  g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip(); g.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 30; k++) { g.fillStyle = `rgba(80,255,160,${0.012 * (30 - k)})`; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, sa - k * 0.03 - 0.03, sa - k * 0.03); g.closePath(); g.fill(); }
  g.strokeStyle = 'rgba(160,255,200,0.9)'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(sa) * R, cy + Math.sin(sa) * R); g.stroke();
  g.restore();
  g.fillStyle = '#5dffa8'; g.font = '700 34px "Courier Prime"'; g.textAlign = 'left';
  g.fillText('AIS HEDEF: 0', 520, 130); g.textAlign = 'right'; g.fillText('KUZEYBATI ▸ BOŞ', 1400, 130);
  g.restore();
};

const REPORT = [
  'OLAY RAPORU — 14.11.1987', '',
  'Mavi Yunus balıkçı teknesi Kuzgun Adası', 'açıklarında battı.',
  'Teknede üç mürettebat ve bir çocuk.',
  'Fener bekçisi Hasan Kaya, kendi sandalıyla', 'yardıma gitti.',
  'Cesedi ertesi sabah Doğu Kayalıkları\'nda bulundu.', '',
  'KURTULAN: Bir kişi.',
  'Altı yaşında bir kız çocuğu, Doğu Kayalıkları\'ndaki', 'bir mağarada bulundu.',
  'Çocuk ifadesinde, bekçiye yolu telsizdeki', 'bir kadının gösterdiğini söylemiştir.',
  'İfade, travmaya bağlanmıştır.',
];

SETS.monitor = (g, i) => {
  const T = i.T, mode = i.p.mode;
  g.save(); camera(g, i, [1.0, 1.06], 960, 540);
  g.fillStyle = '#0a0e11'; g.fillRect(-100, -100, 2120, 1300);
  g.fillStyle = '#1d2226'; g.beginPath(); g.roundRect(150, 50, 1620, 980, 30); g.fill(); inkStroke(g, 5);
  g.fillStyle = '#0c1f2b'; g.fillRect(200, 100, 1520, 880);
  g.fillStyle = '#163a4f'; g.fillRect(200, 100, 1520, 60);
  g.fillStyle = '#bfe4f2'; g.font = '700 30px "Courier Prime"'; g.textAlign = 'left'; g.fillText('SAHİL KAYIT SİSTEMİ  v4.2', 230, 141);
  if (mode === 'registry') {
    g.fillStyle = '#e8f4f8'; g.fillRect(300, 300, 1100, 90); inkStroke(g, 3); g.strokeRect(300, 300, 1100, 90);
    g.fillStyle = INK; g.font = '700 50px "Courier Prime"'; g.fillText(typed('TEKNE ARA: MAVİ YUNUS', range(i.t, 0.2, 1.8)) + (Math.floor(T * 2) % 2 ? '_' : ''), 330, 362);
    if (i.t > 2.2) {
      const a = range(i.t, 2.2, 2.5);
      g.globalAlpha = a; g.fillStyle = '#ff4b34'; g.font = '700 90px "Oswald"'; g.fillText('KAYIT BULUNAMADI', 300, 560);
      g.fillStyle = '#bfe4f2'; g.font = '400 36px "Courier Prime"'; g.fillText('Bu isimde kayıtlı tekne yok.', 300, 640); g.globalAlpha = 1;
    }
  } else {
    const prog = i.p.hl ? 1 : range(i.t, 6.8, i.dur - 1.0);
    const chars = REPORT.join('\n').length * prog;
    let used = 0;
    g.font = '400 46px "Courier Prime"';
    REPORT.forEach((ln, k) => {
      const y = 230 + k * 52; const show = Math.max(0, Math.min(ln.length, chars - used)); used += ln.length + 1;
      const isCave = k >= 9 && k <= 13, isBody = k === 7;
      if ((i.p.hl === 'cave' && isCave) || (i.p.hl === 'body' && isBody)) { g.fillStyle = 'rgba(255,210,60,0.35)'; g.fillRect(250, y - 40, 1420, 52); }
      g.fillStyle = k === 0 ? '#ffd27a' : (k === 9 ? '#ff9a7a' : '#e8f4f8');
      g.font = k === 0 || k === 9 ? '700 46px "Courier Prime"' : '400 46px "Courier Prime"';
      g.fillText(ln.slice(0, show), 260, y);
    });
  }
  g.restore();
};

SETS.phone = (g, i) => {
  const T = i.T, buzz = Math.sin(T * 60) * (Math.floor(T * 1.2) % 2 === 0 ? 4 : 0);
  g.save(); camera(g, i, [1.0, 1.1], 960, 560);
  g.fillStyle = '#2a1f19'; g.fillRect(-100, -100, 2120, 1300);
  g.save(); g.globalAlpha = 0.25; g.fillStyle = hatchPattern(g); g.fillRect(-100, -100, 2120, 1300); g.restore();
  g.translate(960 + buzz, 560);
  g.rotate(-0.08);
  g.fillStyle = '#0d0f12'; g.beginPath(); g.roundRect(-210, -400, 420, 800, 50); g.fill(); inkStroke(g, 5);
  const sg = g.createLinearGradient(0, -360, 0, 360); sg.addColorStop(0, '#2b4a6a'); sg.addColorStop(1, '#0f1c2c');
  g.fillStyle = sg; g.beginPath(); g.roundRect(-185, -370, 370, 740, 36); g.fill();
  g.fillStyle = '#c9b18c'; g.beginPath(); g.arc(0, -150, 80, 0, Math.PI * 2); g.fill(); inkStroke(g, 3);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '700 64px "Oswald"'; g.fillText('Annem', 0, 0);
  g.font = '400 30px "Courier Prime"'; g.fillText('arıyor...', 0, 50);
  g.fillStyle = '#2fbf5a'; g.beginPath(); g.arc(90, 260, 50, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#d8302a'; g.beginPath(); g.arc(-90, 260, 50, 0, Math.PI * 2); g.fill();
  g.restore();
  g.save(); g.globalCompositeOperation = 'lighter'; const gl = g.createRadialGradient(960, 560, 0, 960, 560, 700); gl.addColorStop(0, 'rgba(90,140,200,0.25)'); gl.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gl; g.fillRect(0, 0, W, H); g.restore();
};

SETS.calendar = (g, i) => {
  const flash = lightning(i.T, 9, 0.15);
  g.save(); camera(g, i, [1.0, 1.15], 960, 540);
  g.fillStyle = '#16262c'; g.fillRect(-100, -100, 2120, 1300); stipple(g, -100, -100, 2120, 1300, 6000, 5, 'rgba(0,0,0,0.3)', 2);
  g.fillStyle = '#e8e1cf'; g.fillRect(560, 120, 800, 860); inkStroke(g, 5); g.strokeRect(560, 120, 800, 860);
  g.fillStyle = PAL.red; g.fillRect(560, 120, 800, 200);
  g.fillStyle = '#fff'; g.font = '700 120px "Oswald"'; g.textAlign = 'center'; g.fillText('KASIM', 960, 270);
  g.fillStyle = INK; g.font = '700 460px "Oswald"'; g.fillText('14', 960, 800);
  g.font = '400 50px "Courier Prime"'; g.fillText('PERŞEMBE', 960, 900);
  if (flash > 0) { g.fillStyle = `rgba(220,235,255,${0.3 * flash})`; g.fillRect(-100, -100, 2120, 1300); }
  g.restore();
};

SETS.whistle = (g, i) => {
  const dawn = i.p.dawn;
  g.save(); camera(g, i, [1.0, 1.12], 960, 540);
  g.fillStyle = dawn ? '#2a3550' : PAL.navy; g.fillRect(-100, -100, 2120, 1300);
  g.save(); g.globalAlpha = 0.35; g.fillStyle = hatchPattern(g); g.fillRect(-100, -100, 2120, 1300); g.restore();
  g.fillStyle = PAL.orange; polyPath(g, [[500, -100], [960, 260], [1420, -100]]); g.fill(); inkStroke(g, 5);
  g.fillStyle = PAL.skin; polyPath(g, [[620, -100], [960, 180], [1300, -100]]); g.fill(); inkStroke(g, 4);
  whistle(g, 960, 600, 4.2, 0.1 + Math.sin(i.T * 1.5) * 0.03);
  if (i.p.hand) { // parmaklar düdüğe uzanıyor
    const k = easeInOut(clamp(i.t / 2.5, 0, 1));
    g.fillStyle = PAL.skin; smoothPath(g, [[1900 - k * 600, 900], [1500 - k * 450, 700], [1460 - k * 450, 640], [1560 - k * 450, 620], [1900 - k * 500, 700]]); g.fill(); inkStroke(g, 4);
  }
  if (i.p.finger) {
    const k = easeInOut(clamp(i.t / 2, 0, 1));
    g.fillStyle = '#d99f73'; smoothPath(g, [[-100, 1000], [500 + k * 200, 780 - k * 60], [620 + k * 200, 740 - k * 60], [640 + k * 200, 800 - k * 60], [-100, 1150]]); g.fill(); inkStroke(g, 4);
  }
  g.restore();
  g.save(); g.globalCompositeOperation = 'soft-light'; g.fillStyle = dawn ? 'rgba(255,190,140,0.45)' : 'rgba(255,170,80,0.3)'; g.fillRect(0, 0, W, H); g.restore();
};

SETS.window = (g, i) => {
  const T = i.T, f = i.p.flicker;
  let power = 1;
  if (f !== undefined) { const d = i.t - f; if ((d > 0 && d < 0.18) || (d > 0.32 && d < 0.42)) power = 0.05; }
  const flash = lightning(T, 12, 0.15);
  g.save(); camera(g, i, [1.0, 1.15], 960, 540);
  g.save(); g.beginPath(); g.rect(160, 80, 1600, 920); g.clip();
  sky(g, 0, flash, 0, 800); clouds(g, T, 0); sea(g, T, 640, 0, 0.7, flash);
  lighthouse(g, 1300, 700, 0.42, T, { era: 0, lit: 0, lampOn: power });
  beam(g, 1300, 700 - 576 * 0.42, T, 0.6, false, power);
  rain(g, T, 1);
  // camdaki damlalar
  const r = rng(4); g.fillStyle = 'rgba(200,225,235,0.35)';
  for (let k = 0; k < 120; k++) { const x = 160 + r() * 1600, y = (80 + r() * 920 + T * (20 + r() * 60)) % 1000 + 80; g.beginPath(); g.ellipse(x, y, 3 + r() * 4, 5 + r() * 7, 0, 0, Math.PI * 2); g.fill(); }
  g.restore();
  g.strokeStyle = '#0b1114'; g.lineWidth = 40; g.strokeRect(160, 80, 1600, 920); g.lineWidth = 24; g.beginPath(); g.moveTo(960, 80); g.lineTo(960, 1000); g.stroke();
  g.restore();
};

SETS.photo = (g, i) => {
  g.save(); camera(g, i, [1.0, 1.12], 960, 520);
  g.fillStyle = '#1f1914'; g.fillRect(-100, -100, 2120, 1300); stipple(g, -100, -100, 2120, 1300, 5000, 7, 'rgba(0,0,0,0.3)', 2);
  g.fillStyle = '#4a3220'; g.fillRect(620, 90, 680, 840); inkStroke(g, 6); g.strokeRect(620, 90, 680, 840);
  g.fillStyle = '#d9c4a0'; g.fillRect(670, 140, 580, 740);
  g.save(); g.beginPath(); g.rect(670, 140, 580, 740); g.clip();
  g.fillStyle = '#b9a07a'; g.fillRect(670, 140, 580, 740);
  lighthouse(g, 1120, 700, 0.45, 0, { era: 1987, lit: 0 });
  torso(g, 900, 640, 1.0, '#8a7a5a');
  head(g, 'hasan', { x: 900, y: 520, s: 1.05, smile: 0.35, eyeOpen: 0.85, skin: '#cdb48c', shade: '#9c8461', look: [0, 0] });
  g.globalCompositeOperation = 'color'; g.fillStyle = 'rgba(150,110,60,0.85)'; g.fillRect(670, 140, 580, 740);
  g.restore();
  g.fillStyle = 'rgba(255,250,240,0.08)'; g.fillRect(670, 140, 200, 740);
  g.restore();
};

SETS.lantern = (g, i) => {
  const T = i.T, p = i.p;
  const lensRot = T * 0.63;
  let lamp = 1; if (p.flicker && i.t > i.dur - 2.2) lamp = Math.sin(T * 50) > 0.2 ? 0.25 : 1;
  const flash = lightning(T, 27, 0.25);
  g.save(); camera(g, i, [1.0, 1.06], 960, 540);
  // cam paneller arkasında fırtına
  sky(g, 1987, flash, 0, 1100); clouds(g, T, 1987, 100); rain(g, T, 1.2);
  // dev Fresnel mercek
  g.save(); g.globalCompositeOperation = 'lighter';
  const lg = g.createRadialGradient(1450, 420, 0, 1450, 420, 650 * lamp + 50); lg.addColorStop(0, `rgba(255,220,150,${0.9 * lamp})`); lg.addColorStop(0.4, `rgba(255,170,80,${0.35 * lamp})`); lg.addColorStop(1, 'rgba(255,150,60,0)');
  g.fillStyle = lg; g.fillRect(500, -300, 1700, 1500);
  for (let k = 0; k < 8; k++) { const a = lensRot + k * Math.PI / 4, x = 1450 + Math.cos(a) * 220; if (Math.sin(a) < 0) continue; g.fillStyle = `rgba(255,230,180,${0.18 * lamp * Math.sin(a)})`; g.fillRect(x - 20, 120, 40, 600); }
  g.restore();
  g.strokeStyle = '#1a120c'; g.lineWidth = 16; for (const x of [200, 700, 1200, 1700]) { g.beginPath(); g.moveTo(x, -100); g.lineTo(x + 40, 1200); g.stroke(); }
  g.beginPath(); g.moveTo(-100, 820); g.lineTo(2100, 820); g.stroke();
  // Hasan
  const ex = p.expr || 'shout';
  torso(g, 760, 640, 1.5, '#d9a62a', { shadeAngle: 3.0, collar: (gg) => { gg.fillStyle = '#b88a1c'; polyPath(gg, [[-70, 4], [0, 80], [70, 4]]); gg.fill(); inkStroke(gg, 3); } });
  head(g, 'hasan', Object.assign(face(i, 'hasan', ex), { x: 760, y: 470, s: 1.5, turn: 0.25, look: [0.5, 0], shadeAngle: 3.0 }));
  // el telsizi
  g.fillStyle = '#1a1a1a'; g.beginPath(); g.roundRect(860, 560, 90, 190, 14); g.fill(); inkStroke(g, 3.4);
  g.fillStyle = '#333'; g.fillRect(890, 470, 14, 90);
  g.fillStyle = PAL.skinShade; smoothPath(g, [[840, 640], [960, 620], [990, 700], [950, 780], [850, 770]]); g.fill(); inkStroke(g, 3.4);
  g.restore();
};

SETS.home = (g, i) => {
  const T = i.T, p = i.p, shot = p.shot || 'wide';
  g.save(); camera(g, i, shot === 'wide' ? [1.0, 1.06] : [1.35, 1.42], shot === 'wide' ? 960 : 1060, shot === 'wide' ? 540 : 520);
  // duvar
  g.fillStyle = '#3d4a5a'; g.fillRect(-100, -100, 2120, 1300); stipple(g, -100, -100, 2120, 1300, 5000, 13, 'rgba(0,0,0,0.2)', 2);
  // şafak penceresi
  g.save(); g.beginPath(); g.rect(700, 120, 900, 560); g.clip();
  const sg = g.createLinearGradient(0, 120, 0, 680); sg.addColorStop(0, '#5b7aa8'); sg.addColorStop(0.55, '#e8a988'); sg.addColorStop(0.7, '#f6c99a'); sg.addColorStop(1, '#4a6a88');
  g.fillStyle = sg; g.fillRect(700, 120, 900, 560);
  g.fillStyle = '#2c4560'; g.fillRect(700, 520, 900, 160);
  g.strokeStyle = 'rgba(255,220,190,0.5)'; g.lineWidth = 2; for (let y = 530; y < 680; y += 18) { g.beginPath(); g.moveTo(700, y + Math.sin(T + y) * 2); g.lineTo(1600, y + Math.sin(T * 1.2 + y) * 2); g.stroke(); }
  g.fillStyle = '#20303f'; g.fillRect(1480, 470, 8, 50);
  g.restore();
  g.lineWidth = 24; g.strokeStyle = '#e6dccb'; g.strokeRect(700, 120, 900, 560); g.lineWidth = 12; g.beginPath(); g.moveTo(1150, 120); g.lineTo(1150, 680); g.stroke();
  g.fillStyle = '#d9cfbd'; g.fillRect(660, 680, 980, 40); inkStroke(g, 3); g.strokeRect(660, 680, 980, 40);
  // mum
  const fl = 1 + Math.sin(T * 13) * 0.08 + Math.sin(T * 29) * 0.05;
  g.fillStyle = '#f4ead6'; g.fillRect(760, 600, 40, 80); inkStroke(g, 2.6); g.strokeRect(760, 600, 40, 80);
  g.fillStyle = '#ffcf5a'; g.beginPath(); g.ellipse(780, 584 - fl * 4, 10, 22 * fl, 0, 0, Math.PI * 2); g.fill();
  g.save(); g.globalCompositeOperation = 'lighter'; const cg = g.createRadialGradient(780, 580, 0, 780, 580, 360 * fl); cg.addColorStop(0, 'rgba(255,190,90,0.5)'); cg.addColorStop(1, 'rgba(255,170,60,0)'); g.fillStyle = cg; g.fillRect(380, 200, 800, 800); g.restore();
  // Nur koltukta
  g.fillStyle = '#5a3a2c'; g.beginPath(); g.roundRect(860, 640, 460, 460, 60); g.fill(); inkStroke(g, 4);
  const nf = face(i, 'nur', shot === 'wide' ? 'silent' : (p.hug ? 'soft' : 'sad'));
  torso(g, 1080, 650, 0.9, '#6e3b4a', { shadeAngle: -2.6 }); head(g, 'nur', Object.assign(nf, { x: 1080, y: 560, s: 0.9, turn: -0.35, look: [-0.6, 0], shadeAngle: -2.6 }));
  if (shot !== 'wide') {
    const dx = p.hug ? 1310 : 1400;
    torso(g, dx, 640, 0.95, PAL.navy, { shadeAngle: -2.6 });
    head(g, 'deniz', Object.assign(face(i, 'deniz', p.hug ? 'cry' : 'cautious'), { x: dx, y: 545, s: 0.95, turn: -0.45, look: [-0.8, 0.2], shadeAngle: -2.6, tilt: p.hug ? -0.12 : 0 }));
    whistle(g, dx + 4, 545 + 230 * 0.95 * 0.95, 0.55, 0.1);
  }
  g.restore();
  g.save(); g.globalCompositeOperation = 'soft-light'; g.fillStyle = 'rgba(255,180,130,0.35)'; g.fillRect(0, 0, W, H); g.restore();
};
