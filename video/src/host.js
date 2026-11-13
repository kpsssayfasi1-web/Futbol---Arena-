// Shared rendering host: serves the repo to a headless browser, drives a
// page frame by frame and pipes JPEG frames + a WAV track into ffmpeg.

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Playwright may be installed globally (resolved via NODE_PATH) or locally.
const { chromium } = createRequire(import.meta.url)('playwright');

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
const JPEG_QUALITY = 0.93;

export function log(message) {
  process.stdout.write(`${message}\n`);
}

export function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read ${path}: ${error.message}`);
  }
}

// Read-only static server for the repository, bound to localhost.
function startServer() {
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = normalize(join(REPO, urlPath));
    if (!file.startsWith(REPO + sep) || !MIME[extname(file)]) {
      res.writeHead(404).end();
      return;
    }
    try {
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] }).end(readFileSync(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

function startEncoder(outFile, wavFile, fps) {
  const args = [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-i', wavFile,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', outFile,
  ];
  const ffmpeg = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((ok, fail) => {
    ffmpeg.on('error', fail);
    ffmpeg.on('close', (code) => (code === 0 ? ok() : fail(new Error(`ffmpeg exited with ${code}`))));
  });
  const write = (buf) => new Promise((ok) => { if (ffmpeg.stdin.write(buf)) ok(); else ffmpeg.stdin.once('drain', ok); });
  return { write, finish: () => { ffmpeg.stdin.end(); return done; } };
}

export async function openPage(pagePath, payload) {
  const server = await startServer();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  page.on('pageerror', (e) => log(`page error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') log(`page console: ${m.text()}`); });
  await page.goto(`http://127.0.0.1:${server.address().port}/${pagePath}`);
  await page.waitForFunction(() => typeof window.setup === 'function');
  await page.evaluate((p) => window.setup(p), payload);
  const close = async () => { await browser.close(); server.close(); };
  const frame = async (i) => {
    const dataUrl = await page.evaluate(([k, q]) => { window.renderFrame(k); return window.frameData(q); }, [i, JPEG_QUALITY]);
    return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  };
  const skip = (i) => page.evaluate((k) => window.renderFrame(k, false), i);
  const evalRaw = (expr) => page.evaluate(expr);
  return { frame, skip, close, evalRaw };
}

// Renders every frame in order (effects depend on sequence) into an MP4.
export async function renderVideo({ pagePath, payload, totalFrames, fps, outFile, wavFile, thumb }) {
  const page = await openPage(pagePath, payload);
  try {
    const encoder = startEncoder(outFile, wavFile, fps);
    for (let i = 0; i < totalFrames; i += 1) {
      const jpeg = await page.frame(i);
      await encoder.write(jpeg);
      if (thumb && i === thumb.frame) writeFileSync(thumb.file, jpeg);
      if (i % (fps * 10) === 0) log(`  frame ${i}/${totalFrames}`);
    }
    await encoder.finish();
  } finally {
    await page.close();
  }
}

// Renders frames 0..max(indexes) in order and saves the requested ones.
export async function renderStills({ pagePath, payload, indexes, filePattern }) {
  const page = await openPage(pagePath, payload);
  const wanted = new Set(indexes);
  const files = [];
  try {
    const last = Math.max(...indexes);
    for (let i = 0; i <= last; i += 1) {
      if (!wanted.has(i)) { await page.skip(i); continue; }
      const file = filePattern.replace('%d', String(i));
      writeFileSync(file, await page.frame(i));
      files.push(file);
    }
  } finally {
    await page.close();
  }
  return files;
}
