// Kare kare render: sahne HTML'ini yerel sunucuda açar, her kare için
// window.renderFrame(t) çağırır ve canvas'ı PNG olarak kaydeder.
// Kullanım: node render.js <sahne.html> <cikti-klasoru> <fps> <sure-sn> [baslangic-kare]
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const [, , sceneFile, outDir, fpsArg, durArg, startArg] = process.argv;
if (!sceneFile || !outDir) {
  console.error('Kullanım: node render.js <sahne.html> <cikti> <fps> <sure> [baslangic]');
  process.exit(1);
}
const FPS = Number(fpsArg || 30);
const DURATION = Number(durArg || 8);
const START = Number(startArg || 0);
const ROOT = __dirname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const p = path.normalize(path.join(ROOT, decodeURIComponent(req.url.split('?')[0])));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
        res.writeHead(404); res.end(); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const server = await serve();
  const port = server.address().port;
  const browser = await chromium.launch({ args: ['--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', (m) => console.log('[sayfa]', m.text()));
  page.on('pageerror', (e) => { console.error('[hata]', e.message); process.exitCode = 1; });
  await page.goto(`http://127.0.0.1:${port}/${sceneFile}`);
  await page.evaluate(() => Promise.all([
    '700 46px "Courier Prime"', '400 46px "Courier Prime"', '400 46px "Special Elite"',
    '400 100px "Bebas Neue"', '700 50px "Oswald"', '500 50px "Oswald"',
  ].map((f) => document.fonts.load(f, 'AZaz09ÇŞĞİÖÜçşğıöü'))));
  await page.evaluate(() => window.setup());
  if (process.env.TIMES) { // önizleme: yalnızca verilen anlar
    for (const t of process.env.TIMES.split(',').map(Number)) {
      const url = await page.evaluate((tt) => { window.renderFrame(tt); return document.querySelector('canvas').toDataURL('image/jpeg', 0.85); }, t);
      fs.writeFileSync(path.join(outDir, `onizleme-${t.toFixed(2)}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
    }
    await browser.close(); server.close(); return;
  }
  const total = Math.round(FPS * DURATION);
  const t0 = Date.now();
  for (let i = START; i < total; i++) {
    const url = await page.evaluate((t) => { window.renderFrame(t); return document.querySelector('canvas').toDataURL('image/png'); }, i / FPS);
    fs.writeFileSync(path.join(outDir, `f${String(i).padStart(5, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
    if (i % 30 === 0) console.log(`kare ${i}/${total}  (${((Date.now() - t0) / 1000).toFixed(1)} sn)`);
  }
  await browser.close();
  server.close();
})();
