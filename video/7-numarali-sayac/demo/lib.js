// Sahneler arasında paylaşılan yardımcılar: easing, gürültü, kamera, film dokusu.
const W = 1920, H = 1080;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const easeInOut = (k) => { k = clamp(k, 0, 1); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const easeOut = (k) => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
const easeIn = (k) => Math.pow(clamp(k, 0, 1), 3);
const range = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

// Tekrarlanabilir rastgele sayı üreticisi (mulberry32)
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let x = s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// 1B değer gürültüsü: titreme ve el kamerası için
function noise1(seed) {
  const r = rng(seed);
  const table = Array.from({ length: 512 }, r);
  return (x) => {
    const i = Math.floor(x), f = x - i;
    const a = table[((i % 512) + 512) % 512], b = table[(((i + 1) % 512) + 512) % 512];
    return lerp(a, b, f * f * (3 - 2 * f)) * 2 - 1;
  };
}

// Anahtar karelerden kamera: [{t, cx, cy, w}] — w logaritmik olarak ara değerlenir
function cameraAt(keys, t, ease = easeInOut) {
  if (t <= keys[0].t) return { ...keys[0] };
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t <= b.t) {
      const k = (b.ease || ease)((t - a.t) / (b.t - a.t));
      return { cx: lerp(a.cx, b.cx, k), cy: lerp(a.cy, b.cy, k), w: Math.exp(lerp(Math.log(a.w), Math.log(b.w), k)) };
    }
  }
  return { ...keys[keys.length - 1] };
}

// Film greni: önceden üretilmiş gürültü dokuları, her karede farklı ofset
function makeGrain(size = 512, count = 6) {
  const tiles = [];
  for (let n = 0; n < count; n++) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const img = g.createImageData(size, size);
    const r = rng(1000 + n);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (r() + r() + r() - 1.5) * 120;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    tiles.push(c);
  }
  return tiles;
}

function drawGrain(ctx, tiles, frame, alpha = 0.1) {
  const tile = tiles[frame % tiles.length];
  const r = rng(frame * 7 + 3);
  const ox = Math.floor(r() * tile.width), oy = Math.floor(r() * tile.height);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = alpha;
  for (let y = -oy; y < H; y += tile.height) for (let x = -ox; x < W; x += tile.width) ctx.drawImage(tile, x, y);
  ctx.restore();
}

function drawVignette(ctx, strength = 0.75, color = '0,0,0') {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, `rgba(${color},0)`);
  g.addColorStop(1, `rgba(${color},${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// Ekran sabit yazılar (saat damgası, altyazı, başlık)
function drawClock(ctx, t, text, alpha, blinkColon = true) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha;
  ctx.font = '700 46px "Courier Prime"';
  ctx.textBaseline = 'alphabetic';
  const shown = blinkColon && Math.floor(t * 2) % 2 ? text.replace(':', ' ') : text;
  ctx.shadowColor = 'rgba(255,60,40,0.9)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#ff5a3c';
  ctx.fillText(shown, 96, H - 96);
  ctx.shadowBlur = 0;
  ctx.font = '400 20px "Courier Prime"';
  ctx.fillStyle = 'rgba(255,220,200,0.75)';
  ctx.fillText('● REC   NERGİS APT. — BODRUM', 98, H - 150);
  ctx.restore();
}

function drawSubtitle(ctx, text, alpha, y = H - 120) {
  if (alpha <= 0 || !text) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha;
  ctx.font = '400 46px "Special Elite"';
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 9;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.strokeText(text, W / 2, y);
  ctx.fillStyle = '#f6e7cf';
  ctx.fillText(text, W / 2, y);
  ctx.restore();
}

// Daktilo efektiyle yazı: k = 0..1 arası ilerleme
const typed = (text, k) => text.slice(0, Math.round(text.length * clamp(k, 0, 1)));
