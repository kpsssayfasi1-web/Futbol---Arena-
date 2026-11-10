// Paralel parça render: kareleri doğrudan ffmpeg'e aktarır (diske kare yazmaz).
// Kullanım: node film-render.js <başlangıç-kare> <bitiş-kare> <çıktı.mp4>
const http = require('http'), fs = require('fs'), path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const [, , A, B, OUT] = process.argv;
const ROOT = __dirname, FPS = 24;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const p = path.normalize(path.join(ROOT, decodeURIComponent(req.url.split('?')[0])));
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
server.listen(0, '127.0.0.1', async () => {
  const browser = await chromium.launch({ args: ['--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', (e) => { console.error('[hata]', e.message); process.exit(1); });
  await page.goto(`http://127.0.0.1:${server.address().port}/film.html`);
  await page.evaluate(() => Promise.all(['700 46px "Courier Prime"', '400 46px "Courier Prime"', '400 46px "Special Elite"', '400 100px "Bebas Neue"', '700 50px "Oswald"'].map((f) => document.fonts.load(f, 'AZaz09ÇŞĞİÖÜçşğıöü'))));
  await page.evaluate(() => window.setup());
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', OUT], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = Number(A); f < Number(B); f++) {
    const url = await page.evaluate((t) => { window.renderFrame(t); return document.querySelector('canvas').toDataURL('image/jpeg', 0.93); }, f / FPS);
    const buf = Buffer.from(url.split(',')[1], 'base64');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % 240 === 0) console.log(`${OUT}: ${f}/${B} (${((Date.now() - t0) / 1000).toFixed(0)} sn)`);
  }
  ff.stdin.end();
  ff.on('close', async (code) => { console.log(`${OUT} bitti (${code})`); await browser.close(); server.close(); });
});
