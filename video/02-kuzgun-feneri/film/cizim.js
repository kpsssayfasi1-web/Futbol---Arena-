// Çizim kütüphanesi: mürekkep/çizgi roman tarzı yardımcılar ve karakterler.
// Tüm fonksiyonlar global `ctx` yerine parametre olarak bağlam (g) alır.
const INK = '#120c08';
const PAL = {
  skin: '#e2a978', skinShade: '#b9774c', skinOld: '#d99f73',
  navy: '#1e2c45', navyDark: '#121b2b', orange: '#e0782b', rust: '#a4521c',
  teal: '#1d3b40', tealLight: '#3f7378', amber: '#ffb347', red: '#d8301f',
  brass: '#c8913f', brassLight: '#f3c57a', paper: '#efe3c6',
};

// ---------- temel yollar ----------
function wobble(seed, amp) { const n = noise1(seed); return (k) => n(k) * amp; }

function inkStroke(g, w = 3, color = INK) { g.lineWidth = w; g.strokeStyle = color; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }

function ellipsePath(g, x, y, rx, ry, rot = 0, seed = 1, amp = 0.6) {
  const w = wobble(seed, amp), n = 48;
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2, d = 1 + w(i * 0.7) / Math.max(rx, ry);
    const px = Math.cos(a) * rx * d, py = Math.sin(a) * ry * d;
    const X = x + px * Math.cos(rot) - py * Math.sin(rot), Y = y + px * Math.sin(rot) + py * Math.cos(rot);
    i ? g.lineTo(X, Y) : g.moveTo(X, Y);
  }
  g.closePath();
}

function polyPath(g, pts, close = true) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  if (close) g.closePath();
}

// Yumuşak kapalı eğri (Catmull-Rom → Bezier)
function smoothPath(g, pts, close = true) {
  const n = pts.length;
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  const P = (i) => pts[(i + n) % n];
  const last = close ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    if (!close && i === 0) p0[0] = p1[0];
    g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  if (close) g.closePath();
}

let HATCH = null;
function hatchPattern(g) {
  if (!HATCH) {
    const c = document.createElement('canvas'); c.width = c.height = 18;
    const h = c.getContext('2d'); h.strokeStyle = 'rgba(18,12,8,0.9)'; h.lineWidth = 1.6;
    for (let o = -18; o <= 36; o += 6) { h.beginPath(); h.moveTo(o, 0); h.lineTo(o - 18, 18); h.stroke(); }
    HATCH = c;
  }
  return g.createPattern(HATCH, 'repeat');
}

// Bir yolun içini yarım ay şeklinde taramayla gölgeler (ışıktan uzak taraf)
function hatchShade(g, pathFn, cx, cy, r, angle, alpha = 0.45) {
  g.save(); pathFn(); g.clip();
  g.translate(cx, cy); g.rotate(angle); g.globalAlpha = alpha;
  g.fillStyle = hatchPattern(g);
  g.beginPath(); g.arc(r * 0.6, 0, r * 1.1, 0, Math.PI * 2); g.fill();
  g.restore();
}

function stipple(g, x, y, w, h, count, seed, color = 'rgba(70,35,15,0.35)', size = 1.2) {
  const r = rng(seed); g.fillStyle = color;
  for (let i = 0; i < count; i++) g.fillRect(x + r() * w, y + r() * h, size * (0.5 + r()), size * (0.5 + r()));
}

// ---------- KARAKTER: kafa ----------
// o: {x,y,s, skin, age, turn, look:[x,y], blink, mouth, smile, brow, worry, tears, hair:fn, extras:fn, light}
function drawHead(g, o) {
  const s = o.s || 1, turn = o.turn || 0;
  g.save(); g.translate(o.x, o.y); g.scale(s, s);
  if (o.tilt) g.rotate(o.tilt);
  const skin = o.skin || PAL.skin, shade = o.shade || PAL.skinShade;
  const seed = o.seed || 7;
  // boyun
  g.fillStyle = shade;
  g.beginPath(); g.moveTo(-34 + turn * 8, 80); g.lineTo(34 + turn * 8, 80); g.lineTo(40 + turn * 6, 160); g.lineTo(-40 + turn * 6, 160); g.closePath(); g.fill();
  inkStroke(g, 3);
  if (o.hairBack) o.hairBack(g, o);
  // kulaklar
  const earX = 92 - Math.abs(turn) * 10;
  for (const side of [-1, 1]) {
    if (side * turn > 0.55) continue;
    ellipsePath(g, side * earX + turn * 10, 10, 14, 24, 0, seed + side, 0.4);
    g.fillStyle = shade; g.fill(); inkStroke(g, 3);
  }
  // yüz
  const facePts = [[0, -112], [62, -98], [92, -40], [90, 25], [70, 78], [34, 108], [0, 116], [-34, 108], [-70, 78], [-90, 25], [-92, -40], [-62, -98]]
    .map(([x, y]) => [x * (1 - Math.abs(turn) * 0.08) + turn * 6, y]);
  const faceGrad = g.createRadialGradient(-30 - (o.light || 0) * 30, -30, 10, 0, 0, 140);
  faceGrad.addColorStop(0, skin); faceGrad.addColorStop(1, shade);
  g.fillStyle = faceGrad; smoothPath(g, facePts); g.fill();
  hatchShade(g, () => smoothPath(g, facePts), 0, 0, 120, o.shadeAngle ?? 0.4, 0.22);
  smoothPath(g, facePts); inkStroke(g, 3.6);
  stipple(g, -70, 30, 140, 70, 90 + (o.age || 0) * 2, seed + 3, 'rgba(90,45,20,0.35)', 1.4);
  // yaş çizgileri
  if (o.age > 40) {
    g.strokeStyle = 'rgba(18,12,8,0.6)'; g.lineWidth = 1.6;
    for (const sx of [-1, 1]) {
      g.beginPath(); g.moveTo(sx * 58 + turn * 20, -8); g.quadraticCurveTo(sx * 70 + turn * 20, 2, sx * 64 + turn * 20, 14); g.stroke();
      g.beginPath(); g.moveTo(sx * 30 + turn * 20, 46); g.quadraticCurveTo(sx * 42 + turn * 20, 62, sx * 38 + turn * 20, 78); g.stroke();
    }
    g.beginPath(); g.moveTo(-26 + turn * 20, -66); g.quadraticCurveTo(0 + turn * 20, -72, 26 + turn * 20, -66); g.stroke();
  }
  const fx = turn * 22; // yüz hatlarının yatay kayması
  // gözler
  const eyeY = -10, eyeDX = 40, openK = clamp(1 - (o.blink || 0), 0.05, 1) * (o.eyeOpen || 1);
  for (const side of [-1, 1]) {
    const ex = side * eyeDX + fx + (side * turn > 0 ? -turn * 6 : 0);
    const erx = 25 * (side * turn > 0 ? 1 - turn * 0.25 : 1), ery = 29;
    g.save();
    ellipsePath(g, ex, eyeY, erx, ery * openK, 0, seed + 10 + side, 0.3);
    g.fillStyle = '#fbf3df'; g.fill();
    g.clip();
    const lx = (o.look ? o.look[0] : 0) * 9, ly = (o.look ? o.look[1] : 0) * 9;
    g.fillStyle = INK; ellipsePath(g, ex + lx, eyeY + ly + 4, 8.5 * (o.pupil || 1), 10 * (o.pupil || 1), 0, seed + 20 + side, 0.2); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + lx - 3, eyeY + ly, 2.6, 0, Math.PI * 2); g.fill();
    g.restore();
    ellipsePath(g, ex, eyeY, erx, ery * openK, 0, seed + 10 + side, 0.3); inkStroke(g, 3.4);
    if (o.age > 40) { g.lineWidth = 1.5; g.beginPath(); g.arc(ex, eyeY + 6, erx + 4, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke(); }
    // gözyaşı
    if (o.tears > 0) {
      const ty = eyeY + ery * openK + 6 + (o.tears * 40) % 40;
      g.fillStyle = 'rgba(200,230,240,0.9)'; g.beginPath(); g.ellipse(ex + side * 6, ty, 4, 6, 0, 0, Math.PI * 2); g.fill();
      g.lineWidth = 1.2; g.stroke();
      g.strokeStyle = 'rgba(200,230,240,0.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(ex + side * 6, eyeY + ery * openK); g.lineTo(ex + side * 6, ty - 4); g.stroke();
    }
    // kaş
    const worry = o.worry || 0, browY = eyeY - ery - 14 - (o.brow || 0) * 10;
    g.fillStyle = o.browColor || INK;
    g.beginPath();
    g.moveTo(ex - side * 22, browY + 4 - worry * side * 0 + (side === -1 ? worry * 8 : worry * 8) * 0);
    const inner = ex - side * 24, outer = ex + side * 22;
    g.moveTo(inner, browY + 2 - worry * 9); g.quadraticCurveTo(ex, browY - 8 + worry * 2, outer, browY + 4 + worry * 4);
    g.lineTo(outer, browY + 12 + worry * 4); g.quadraticCurveTo(ex, browY + 2 + worry * 2, inner, browY + 12 - worry * 9);
    g.closePath(); g.fill();
  }
  // burun
  g.strokeStyle = INK; g.lineWidth = 3;
  g.beginPath(); g.moveTo(fx + 4, -2); g.quadraticCurveTo(fx + 16 + turn * 8, 30, fx + 2, 40); g.quadraticCurveTo(fx - 8, 42, fx - 12, 36); g.stroke();
  g.fillStyle = 'rgba(120,60,30,0.25)'; g.beginPath(); g.ellipse(fx + 6, 34, 14, 7, 0, 0, Math.PI * 2); g.fill();
  if (o.extras) o.extras(g, o, fx);
  // ağız
  drawMouth(g, fx, o.mouthY || 72, o.mouth || 0, o.smile || 0, o.mouthW || 1);
  if (o.mustache) o.mustache(g, o, fx);
  if (o.hair) o.hair(g, o, fx);
  g.restore();
}

function drawMouth(g, x, y, open, smile, wk) {
  const w = 24 * wk;
  g.save(); g.translate(x, y);
  if (open < 0.1) {
    g.beginPath(); g.moveTo(-w, -smile * 7); g.quadraticCurveTo(0, 6 + smile * 6, w, -smile * 7);
    inkStroke(g, 3);
    g.fillStyle = 'rgba(150,60,45,0.35)'; g.beginPath(); g.ellipse(0, 12, w * 0.5, 4, 0, 0, Math.PI * 2); g.fill();
    g.restore(); return;
  }
  const h = 6 + open * 22;
  g.beginPath();
  g.moveTo(-w, -smile * 6);
  g.quadraticCurveTo(0, -5 + smile * 4, w, -smile * 6);
  g.quadraticCurveTo(w * 0.7, h, 0, h + smile * 3);
  g.quadraticCurveTo(-w * 0.7, h, -w, -smile * 6);
  g.closePath();
  g.fillStyle = '#4a1510'; g.fill();
  g.save(); g.clip(); g.fillStyle = '#f4ead6'; g.fillRect(-w, -8, w * 2, 6 + open * 3); g.fillStyle = '#b63b33'; g.beginPath(); g.ellipse(0, h + 2, w * 0.55, h * 0.4, 0, 0, Math.PI * 2); g.fill(); g.restore();
  inkStroke(g, 2.8);
  g.restore();
}

// ---------- KARAKTER tanımları ----------
const CHAR = {
  deniz: {
    skin: '#e9b487', shade: '#bf7f55', age: 24, seed: 11,
    hairBack: (g) => { g.fillStyle = '#1b1411'; smoothPath(g, [[-104, -60], [-96, -130], [0, -158], [96, -130], [106, -60], [110, 40], [84, 70], [70, 0], [-70, 0], [-86, 70], [-112, 40]]); g.fill(); inkStroke(g, 3.4); },
    hair: (g, o, fx) => {
      g.fillStyle = '#211813';
      smoothPath(g, [[-96, -40], [-92, -110], [-30, -150], [40, -148], [96, -108], [98, -40], [70, -78], [30, -92], [20, -60], [-10, -88], [-50, -74], [-80, -50]]);
      g.fill(); inkStroke(g, 3.4);
      g.strokeStyle = 'rgba(255,220,180,0.25)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(-50, -132); g.quadraticCurveTo(-10, -150, 40, -136); g.stroke();
    },
  },
  enes: {
    skin: '#d9a07a', shade: '#a86c47', age: 57, seed: 23, browColor: '#cfc6b8', mouthY: 86,
    hair: (g, o, fx) => {
      // kep
      g.fillStyle = PAL.navy;
      g.fillStyle = '#d8d2c6'; smoothPath(g, [[-100, -84], [-84, -84], [-86, -20], [-92, 10], [-104, -30]]); g.fill(); inkStroke(g, 2);
      smoothPath(g, [[100, -84], [84, -84], [86, -20], [92, 10], [104, -30]]); g.fill(); inkStroke(g, 2);
      g.fillStyle = PAL.navy;
      smoothPath(g, [[-102, -96], [-96, -150], [-40, -190], [40, -190], [96, -150], [102, -96]], true); g.fill(); inkStroke(g, 3.6);
      g.fillStyle = PAL.navyDark; polyPath(g, [[-110, -98], [110, -98], [124, -76], [-124, -76]]); g.fill(); inkStroke(g, 3.6);
      g.fillStyle = PAL.brassLight; ellipsePath(g, 0, -134, 18, 14, 0, 4, 0.3); g.fill(); inkStroke(g, 2.4);
    },
    mustache: (g, o, fx) => {
      g.fillStyle = '#cbc3b5';
      smoothPath(g, [[fx - 50, 72], [fx - 28, 48], [fx, 54], [fx + 28, 48], [fx + 50, 72], [fx + 22, 66], [fx, 70], [fx - 22, 66]]); g.fill(); inkStroke(g, 2.6);
    },
  },
  hasan: {
    skin: '#d99a6c', shade: '#a2643d', age: 68, seed: 31, browColor: '#e8e2d6', mouthY: 94,
    hair: (g, o, fx) => {
      // bere (referans görseldeki gibi)
      g.fillStyle = '#7d7267';
      smoothPath(g, [[-104, -80], [-100, -140], [-50, -182], [20, -188], [86, -162], [106, -110], [104, -80]]); g.fill(); inkStroke(g, 3.6);
      g.fillStyle = '#6b6057'; polyPath(g, [[-112, -94], [112, -94], [110, -62], [-110, -62]]); g.fill(); inkStroke(g, 3.4);
      g.strokeStyle = 'rgba(18,12,8,0.55)'; g.lineWidth = 1.6;
      for (let x = -100; x <= 100; x += 12) { g.beginPath(); g.moveTo(x, -92); g.lineTo(x + 2, -64); g.stroke(); }
      g.fillStyle = '#e6e0d6'; smoothPath(g, [[-108, -62], [-88, -62], [-92, -20], [-100, 16], [-112, -10]]); g.fill(); inkStroke(g, 2);
      smoothPath(g, [[108, -62], [88, -62], [92, -20], [100, 16], [112, -10]]); g.fill(); inkStroke(g, 2);
    },
    mustache: (g, o, fx) => {
      g.fillStyle = '#ece6dc';
      smoothPath(g, [[fx - 66, 86], [fx - 42, 44], [fx, 52], [fx + 42, 44], [fx + 66, 86], [fx + 30, 72], [fx, 76], [fx - 30, 72]]); g.fill(); inkStroke(g, 3);
      g.strokeStyle = 'rgba(18,12,8,0.35)'; g.lineWidth = 1.2;
      for (let k = -40; k <= 40; k += 8) { g.beginPath(); g.moveTo(fx + k, 50); g.lineTo(fx + k * 1.2, 66); g.stroke(); }
      stipple(g, fx - 70, 96, 140, 26, 120, 77, 'rgba(230,225,215,0.7)', 1.4);
    },
  },
  nur: {
    skin: '#e3ab80', shade: '#b47650', age: 44, seed: 41,
    hairBack: (g) => { g.fillStyle = '#2a1c16'; ellipsePath(g, 0, -150, 52, 42, 0, 5, 1); g.fill(); inkStroke(g, 3.4); },
    hair: (g) => {
      g.fillStyle = '#2f211a';
      smoothPath(g, [[-98, -20], [-96, -110], [-40, -150], [40, -150], [96, -110], [98, -20], [74, -84], [0, -104], [-74, -84]]); g.fill(); inkStroke(g, 3.4);
      g.strokeStyle = '#a8a29a'; g.lineWidth = 4; g.beginPath(); g.moveTo(30, -146); g.quadraticCurveTo(70, -120, 84, -80); g.stroke();
    },
  },
  kucukNur: {
    skin: '#eab48a', shade: '#c4855b', age: 6, seed: 51,
    hairBack: (g) => {
      g.fillStyle = '#2b1d16';
      for (const sx of [-1, 1]) { ellipsePath(g, sx * 112, 10, 26, 46, sx * 0.3, 6 + sx, 1); g.fill(); inkStroke(g, 3); }
    },
    hair: (g) => {
      g.fillStyle = '#f0b628';
      smoothPath(g, [[-118, 40], [-116, -100], [-60, -168], [60, -168], [116, -100], [118, 40], [92, -20], [70, -86], [0, -110], [-70, -86], [-92, -20]]); g.fill(); inkStroke(g, 3.6);
      g.fillStyle = '#2b1d16'; smoothPath(g, [[-76, -60], [-50, -96], [0, -104], [50, -96], [76, -60], [30, -78], [-30, -78]]); g.fill(); inkStroke(g, 2.6);
    },
  },
};

function head(g, who, o) { drawHead(g, Object.assign({}, CHAR[who], o)); }

// Gövde: omuzlar ve ceket
function torso(g, x, y, s, color, opts = {}) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const w = opts.w || 230;
  g.fillStyle = color;
  smoothPath(g, [[-w, 260], [-w + 10, 120], [-w * 0.6, 40], [-50, 6], [50, 6], [w * 0.6, 40], [w - 10, 120], [w, 260]], true);
  g.fill();
  hatchShade(g, () => smoothPath(g, [[-w, 260], [-w + 10, 120], [-w * 0.6, 40], [-50, 6], [50, 6], [w * 0.6, 40], [w - 10, 120], [w, 260]], true), 0, 120, w, opts.shadeAngle ?? 0.3, 0.35);
  smoothPath(g, [[-w, 260], [-w + 10, 120], [-w * 0.6, 40], [-50, 6], [50, 6], [w * 0.6, 40], [w - 10, 120], [w, 260]], true);
  inkStroke(g, 3.6);
  if (opts.collar) opts.collar(g);
  g.restore();
}

// Pirinç düdük (kolye)
function whistle(g, x, y, s, rot = 0, chain = true) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  if (chain) { g.strokeStyle = '#d6b066'; g.lineWidth = 2; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(-60, -90); g.quadraticCurveTo(-30, -10, -6, -14); g.moveTo(60, -90); g.quadraticCurveTo(30, -10, 6, -14); g.stroke(); g.setLineDash([]); }
  const gr = g.createLinearGradient(0, -20, 0, 20); gr.addColorStop(0, PAL.brassLight); gr.addColorStop(0.5, PAL.brass); gr.addColorStop(1, '#6b4519');
  g.fillStyle = gr;
  g.beginPath(); g.roundRect(-34, -10, 50, 22, 6); g.fill(); inkStroke(g, 2.4);
  ellipsePath(g, 20, 8, 18, 18, 0, 3, 0.3); g.fill(); inkStroke(g, 2.4);
  g.fillStyle = INK; g.beginPath(); g.roundRect(-30, -4, 10, 8, 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(-26, -7, 30, 3);
  g.restore();
}
