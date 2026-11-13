#!/usr/bin/env node
// Renders one match as a vertical Short (1080x1920, 30 fps, MP4).
// Usage: node make-short.js --match M001 [--tournament ../tournament/output/tournament.json] [--out output]

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, normalize, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createRequire } from 'node:module';
import { findSeed } from './src/seed-search.js';
import { recordFrames, PHYSICS } from './src/sim.js';
import { buildContext } from './src/context.js';
import { buildSoundtrack, encodeWav } from './src/audio.js';

// Playwright may be installed globally (resolved via NODE_PATH) or locally.
const { chromium } = createRequire(import.meta.url)('playwright');

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const FPS = 30;
const INTRO_SECONDS = 2.4;
const FULLTIME_SECONDS = 1.3;
const OUTRO_SECONDS = 4.5;
const JPEG_QUALITY = 0.93;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };

function log(message) {
  process.stdout.write(`${message}\n`);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read ${path}: ${error.message}`);
  }
}

// Serves the repository read-only on localhost so the page can load
// modules, flags and fonts from the same origin.
function startServer() {
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = normalize(join(REPO, urlPath));
    if (!file.startsWith(REPO + sep) || !MIME[extname(file)]) {
      res.writeHead(404).end();
      return;
    }
    try {
      const body = readFileSync(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

function framesByEvent(events) {
  const byFrame = {};
  for (const e of events) {
    const k = Math.round(e.t * FPS);
    (byFrame[k] ??= []).push(e);
  }
  return byFrame;
}

function celebrationAges(frames) {
  let start = null;
  return frames.map((f, i) => {
    if (f.celebrating === null) { start = null; return 0; }
    if (start === null || frames[i - 1]?.celebrating !== f.celebrating) start = f.t;
    return f.t - start;
  });
}

function encodeVideo(outFile, wavFile) {
  const args = [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
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

async function render(payload, totalFrames, outFile, wavFile, thumbFile) {
  const server = await startServer();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
    page.on('pageerror', (e) => log(`page error: ${e.message}`));
    await page.goto(`http://127.0.0.1:${server.address().port}/video/web/index.html`);
    await page.waitForFunction(() => typeof window.setup === 'function');
    await page.evaluate((p) => window.setup(p), payload);

    const encoder = encodeVideo(outFile, wavFile);
    const thumbAt = payload.timeline.intro + payload.timeline.match + payload.timeline.fulltime + Math.round(2.5 * FPS);
    for (let i = 0; i < totalFrames; i += 1) {
      const dataUrl = await page.evaluate(([k, q]) => { window.renderFrame(k); return window.frameData(q); }, [i, JPEG_QUALITY]);
      const jpeg = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
      await encoder.write(jpeg);
      if (i === thumbAt) writeFileSync(thumbFile, jpeg);
      if (i % (FPS * 10) === 0) log(`  frame ${i}/${totalFrames}`);
    }
    await encoder.finish();
  } finally {
    await browser.close();
    server.close();
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      match: { type: 'string' },
      tournament: { type: 'string', default: join(REPO, 'tournament/output/tournament.json') },
      out: { type: 'string', default: join(HERE, 'output') },
    },
  });
  if (!values.match || !/^M\d{3}$/.test(values.match)) throw new Error('Pass a match id, e.g. --match M001');

  const tournament = readJson(values.tournament);
  const teams = readJson(join(REPO, 'tournament/data/teams.json'));
  const settings = readJson(join(REPO, 'tournament/data/settings.json'));
  const context = buildContext(tournament, teams, values.match, settings.tournamentName);
  const match = tournament.matches.find((m) => m.id === values.match);

  log(`${values.match}: ${context.home.name} ${match.score.home}-${match.score.away} ${context.away.name}`);
  const physicsSeed = `${tournament.seed}:${values.match}`;
  const { seed, attempt } = findSeed(physicsSeed, match.score);
  log(`  physics seed found after ${attempt} tries: ${seed}`);

  const recording = recordFrames(seed, FPS);
  const timeline = {
    intro: Math.round(INTRO_SECONDS * FPS),
    match: recording.frames.length,
    fulltime: Math.round(FULLTIME_SECONDS * FPS),
    outro: Math.round(OUTRO_SECONDS * FPS),
  };
  const totalFrames = timeline.intro + timeline.match + timeline.fulltime + timeline.outro;
  const payload = {
    seed, fps: FPS, physics: PHYSICS, context, timeline,
    frames: recording.frames,
    eventsByFrame: framesByEvent(recording.events),
    celebrationAge: celebrationAges(recording.frames),
  };

  mkdirSync(values.out, { recursive: true });
  const base = join(values.out, values.match);
  const wavFile = `${base}.wav`;
  writeFileSync(wavFile, encodeWav(buildSoundtrack({
    totalSeconds: totalFrames / FPS, matchStart: timeline.intro / FPS, events: recording.events, seed,
  })));

  log(`  rendering ${totalFrames} frames (${(totalFrames / FPS).toFixed(1)} s)`);
  await render(payload, totalFrames, `${base}.mp4`, wavFile, `${base}-thumb.jpg`);
  rmSync(wavFile, { force: true });
  writeFileSync(`${base}.json`, `${JSON.stringify({
    match: values.match, title: match.title, description: match.description,
    physicsSeed: seed, seedSearchTries: attempt, durationSeconds: totalFrames / FPS,
  }, null, 2)}\n`);
  log(`  done: ${base}.mp4`);
}

main().catch((error) => {
  process.stderr.write(`Error: ${error.message}\n`);
  process.exitCode = 1;
});
