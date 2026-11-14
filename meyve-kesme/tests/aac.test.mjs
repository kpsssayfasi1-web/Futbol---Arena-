import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mdct, encodeAac, audioSpecificConfig } from '../js/aac-encoder.js';
import { SPECTRAL_BOOKS, SCALEFACTOR_BOOK } from '../js/aac-tables.js';

const SR = 48000;

test('fast MDCT matches the AAC filterbank definition', () => {
  const N = 1024;
  const x = Float64Array.from({ length: 2 * N }, (_, n) => Math.sin(n * 0.37) * 0.8 + Math.cos(n * 0.011) * 0.3 + ((n * 7919) % 13) / 40);
  const fast = mdct(x);
  for (const k of [0, 1, 5, 100, 511, 512, 777, 1023]) {
    let ref = 0;
    for (let n = 0; n < 2 * N; n++) {
      const w = Math.sin((Math.PI / (2 * N)) * (n + 0.5));
      ref += 2 * w * x[n] * Math.cos((Math.PI / N) * (n + 0.5 + N / 2) * (k + 0.5));
    }
    assert.ok(Math.abs(fast[k] - ref) < 1e-6 * Math.max(1, Math.abs(ref)), `k=${k}: ${fast[k]} vs ${ref}`);
  }
});

test('codebooks are complete prefix codes', () => {
  for (const book of SPECTRAL_BOOKS.slice(1).concat([SCALEFACTOR_BOOK])) {
    // Kraft sum of a complete prefix code is exactly 1.
    const kraft = book.len.reduce((s, l) => s + 2 ** -l, 0);
    assert.ok(Math.abs(kraft - 1) < 1e-9, `kraft ${kraft}`);
  }
  assert.deepEqual([...audioSpecificConfig(48000)], [0x11, 0x90]);
});

test('silence encodes to tiny frames', () => {
  const left = new Float32Array(SR / 2);
  const { frames } = encodeAac({ left, right: left, sampleRate: SR });
  assert.equal(frames.length, Math.ceil(left.length / 1024) + 1);
  assert.ok(frames.every((f) => f.length < 16));
});

function adts(frames) {
  const parts = frames.map((f) => {
    const len = f.length + 7;
    // AAC-LC (profile 1), 48 kHz (index 3), 2 channels, no CRC
    const h = Uint8Array.from([0xff, 0xf1, (1 << 6) | (3 << 2), (2 << 6) | (len >> 11), (len >> 3) & 0xff, ((len & 7) << 5) | 0x1f, 0xfc]);
    return Buffer.concat([Buffer.from(h), Buffer.from(f)]);
  });
  return Buffer.concat(parts);
}

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;

test('round trip through a reference decoder keeps level, timing and quality', { skip: !hasFfmpeg && 'ffmpeg not installed' }, () => {
  const n = SR * 2;
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    left[i] = 0.4 * Math.sin(2 * Math.PI * 440 * t) + 0.1 * Math.sin(2 * Math.PI * 3100 * t);
    right[i] = 0.3 * Math.sin(2 * Math.PI * 660 * t) + 0.05 * rnd();
  }
  // a sharp click at exactly 1.0 s on the left channel
  for (let i = 0; i < 48; i++) left[SR + i] += 0.5 * Math.exp(-i / 8);
  const { frames } = encodeAac({ left, right, sampleRate: SR });
  const dir = mkdtempSync(join(tmpdir(), 'aac-'));
  writeFileSync(join(dir, 'a.aac'), adts(frames));
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', join(dir, 'a.aac'), '-f', 'f32le', '-ac', '2', '-ar', String(SR), join(dir, 'a.raw')]);
  assert.equal(r.status, 0, String(r.stderr));
  const raw = new Float32Array(readFileSync(join(dir, 'a.raw')).buffer.slice(0));
  const outL = raw.filter((_, i) => i % 2 === 0);
  const outR = raw.filter((_, i) => i % 2 === 1);
  const snr = (a, b, from, to) => {
    let s = 0;
    let e = 0;
    for (let i = from; i < to; i++) {
      s += a[i] * a[i];
      e += (a[i] - b[i]) ** 2;
    }
    return 10 * Math.log10(s / e);
  };
  const snrL = snr(left, outL, 4096, n - 4096);
  const snrR = snr(right, outR, 4096, n - 4096);
  assert.ok(snrL > 26, `left SNR ${snrL.toFixed(1)} dB`);
  assert.ok(snrR > 20, `right SNR ${snrR.toFixed(1)} dB`);
  // level: same loudness after decoding
  const rms = (a, from, to) => Math.sqrt(a.slice(from, to).reduce((t, v) => t + v * v, 0) / (to - from));
  const level = rms(outL, 4096, n - 4096) / rms(left, 4096, n - 4096);
  assert.ok(Math.abs(level - 1) < 0.05, `level ratio ${level.toFixed(3)}`);
  // timing: the decoded click lands where it was (no encoder delay)
  const diff = (a, i) => Math.abs(a[i] - a[i - 1]);
  let at = SR - 2000;
  for (let i = SR - 2000; i < SR + 2000; i++) if (diff(outL, i) > diff(outL, at)) at = i;
  assert.ok(Math.abs(at - SR) <= 4, `click decoded at sample ${at}, expected ${SR}`);
  console.log(`SNR L ${snrL.toFixed(1)} dB, R ${snrR.toFixed(1)} dB, level ${level.toFixed(3)}, click at ${at}`);
  const bytes = frames.reduce((s, f) => s + f.length, 0);
  const kbps = (bytes * 8) / (n / SR) / 1000;
  console.log(`${kbps.toFixed(0)} kbps`);
  assert.ok(kbps < 400, `${kbps.toFixed(0)} kbps`);
});
