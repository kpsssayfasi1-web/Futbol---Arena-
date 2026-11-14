// A small AAC-LC encoder in plain JavaScript (no WebAssembly, no platform codec),
// so every device writes the same, phone-playable soundtrack into the MP4.
// Long blocks only, a simple masking model (per-band SNR target plus the
// threshold of hearing) and Huffman coding with the standard codebooks.
import { SPECTRAL_BOOKS, SCALEFACTOR_BOOK } from './aac-tables.js';

const N = 1024; // spectral lines per frame
const SR_INDEX = { 96000: 0, 88200: 1, 64000: 2, 48000: 3, 44100: 4, 32000: 5 };
// Scalefactor band edges for long windows at 44.1 / 48 kHz (ISO/IEC 14496-3, Table 4.110).
const SWB = [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 88, 96, 108, 120, 132, 144, 160, 176, 196, 216,
  240, 264, 292, 320, 352, 384, 416, 448, 480, 512, 544, 576, 608, 640, 672, 704, 736, 768, 800, 832, 864, 896, 928, 1024];
const MAX_BANDS = 42; // up to bin 736: about 17 kHz at 48 kHz
const PCM_SCALE = 32768; // the decoder works in 16-bit PCM units
const MAX_Q = 8191;
const MAX_CHANNEL_BITS = 6000; // a channel may use at most 6144 bits per frame
const ID_CPE = 1;
const ID_END = 7;

// ---------- MDCT (2048 windowed samples -> 1024 lines) via a 256-point complex FFT ----------
const WINDOW = Float64Array.from({ length: 2 * N }, (_, n) => Math.sin((Math.PI / (2 * N)) * (n + 0.5)));
const H = N / 2;
const FFT_N = N / 2;
const BITREV = new Uint16Array(FFT_N);
const COS = new Float64Array(FFT_N / 2);
const SIN = new Float64Array(FFT_N / 2);
const PRE_C = new Float64Array(H);
const PRE_S = new Float64Array(H);
const POST_C = new Float64Array(H);
const POST_S = new Float64Array(H);
(() => {
  const bits = Math.log2(FFT_N);
  for (let i = 0; i < FFT_N; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    BITREV[i] = r;
  }
  for (let i = 0; i < FFT_N / 2; i++) {
    COS[i] = Math.cos((2 * Math.PI * i) / FFT_N);
    SIN[i] = -Math.sin((2 * Math.PI * i) / FFT_N);
  }
  for (let n = 0; n < H; n++) {
    PRE_C[n] = Math.cos((Math.PI * (4 * n + 1)) / (4 * N));
    PRE_S[n] = -Math.sin((Math.PI * (4 * n + 1)) / (4 * N));
    POST_C[n] = Math.cos((Math.PI * n) / N);
    POST_S[n] = -Math.sin((Math.PI * n) / N);
  }
})();

function fft(re, im) {
  for (let i = 0; i < FFT_N; i++) {
    const j = BITREV[i];
    if (j > i) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let size = 2; size <= FFT_N; size <<= 1) {
    const half = size >> 1;
    const step = FFT_N / size;
    for (let start = 0; start < FFT_N; start += size) {
      for (let k = 0; k < half; k++) {
        const c = COS[k * step];
        const s = SIN[k * step];
        const a = start + k;
        const b = a + half;
        const tr = re[b] * c - im[b] * s;
        const ti = re[b] * s + im[b] * c;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
}

// DCT-IV of length N: out[k] = sum u[n] cos(pi/N (n + 1/2)(k + 1/2)).
const fRe = new Float64Array(FFT_N);
const fIm = new Float64Array(FFT_N);
function dct4(u, out) {
  for (let n = 0; n < H; n++) {
    const a = u[2 * n];
    const b = u[N - 1 - 2 * n];
    fRe[n] = a * PRE_C[n] - b * PRE_S[n];
    fIm[n] = a * PRE_S[n] + b * PRE_C[n];
  }
  fft(fRe, fIm);
  for (let k = 0; k < H; k++) {
    const yr = fRe[k] * POST_C[k] - fIm[k] * POST_S[k];
    const yi = fRe[k] * POST_S[k] + fIm[k] * POST_C[k];
    out[2 * k] = yr;
    out[N - 1 - 2 * k] = -yi;
  }
  return out;
}

// MDCT as defined for the AAC filterbank:
// X[k] = 2 * sum_{n<2N} w[n] x[n] cos(pi/N (n + 1/2 + N/2)(k + 1/2)).
const fold = new Float64Array(N);
export function mdct(block, out = new Float64Array(N)) {
  const z = (n) => block[n] * WINDOW[n];
  for (let n = 0; n < H; n++) {
    fold[n] = -z(3 * H - 1 - n) - z(3 * H + n);
    fold[H + n] = z(n) - z(N - 1 - n);
  }
  dct4(fold, out);
  for (let k = 0; k < N; k++) out[k] *= 2;
  return out;
}

// ---------- bit writer ----------
class BitWriter {
  constructor(bytes = 2048) {
    this.buf = new Uint8Array(bytes);
    this.bit = 0;
  }
  write(value, bits) {
    for (let i = bits - 1; i >= 0; i--) {
      const byte = this.bit >> 3;
      if (byte >= this.buf.length) {
        const next = new Uint8Array(this.buf.length * 2);
        next.set(this.buf);
        this.buf = next;
      }
      if ((value >>> i) & 1) this.buf[byte] |= 0x80 >> (this.bit & 7);
      this.bit++;
    }
  }
  bytes() {
    return this.buf.slice(0, (this.bit + 7) >> 3);
  }
}

// ---------- quantisation ----------
const gainOf = (sf) => Math.pow(2, 0.25 * (sf - 100));

function quantize(x, from, to, sf, q) {
  const inv = 1 / gainOf(sf);
  let noise = 0;
  let max = 0;
  const g = gainOf(sf);
  for (let i = from; i < to; i++) {
    const a = Math.abs(x[i]);
    const v = Math.floor(Math.pow(a * inv, 0.75) + 0.4054);
    q[i] = x[i] < 0 ? -v : v;
    const d = a - Math.pow(v, 4 / 3) * g;
    noise += d * d;
    if (v > max) max = v;
  }
  return { noise, max };
}

// Coarsest scalefactor whose quantisation noise stays within `allowed`.
function chooseScalefactor(x, from, to, allowed, q) {
  let peak = 0;
  for (let i = from; i < to; i++) peak = Math.max(peak, Math.abs(x[i]));
  if (peak === 0) return 255;
  const floor = Math.max(0, Math.ceil(100 + 4 * Math.log2(peak / Math.pow(MAX_Q, 4 / 3))));
  let lo = floor;
  let hi = 255;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (quantize(x, from, to, mid, q).noise <= allowed) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// ---------- Huffman cost and coding ----------
function bookIndex(book, q, i) {
  const base = book.signed ? 2 * book.max + 1 : book.max + 1;
  let idx = 0;
  for (let d = 0; d < book.dim; d++) {
    let v = q[i + d];
    if (!book.signed) v = Math.min(Math.abs(v), book.max);
    else v += book.max;
    idx = idx * base + v;
  }
  return idx;
}

function escapeBits(v) {
  const n = 31 - Math.clz32(v);
  return 2 * n - 3;
}

function bandBits(book, q, from, to) {
  let bits = 0;
  for (let i = from; i < to; i += book.dim) {
    bits += book.len[bookIndex(book, q, i)];
    if (!book.signed) {
      for (let d = 0; d < book.dim; d++) {
        const a = Math.abs(q[i + d]);
        if (a) bits++;
        if (book.max === 16 && a >= 16) bits += escapeBits(a);
      }
    }
  }
  return bits;
}

function bestBook(q, from, to, maxAbs) {
  if (maxAbs === 0) return { cb: 0, bits: 0 };
  let best = { cb: 11, bits: Infinity };
  for (let cb = 1; cb <= 11; cb++) {
    const book = SPECTRAL_BOOKS[cb];
    if (book.max < Math.min(maxAbs, 16)) continue;
    const bits = bandBits(book, q, from, to);
    if (bits < best.bits) best = { cb, bits };
  }
  return best;
}

function writeBand(w, book, q, from, to) {
  for (let i = from; i < to; i += book.dim) {
    const idx = bookIndex(book, q, i);
    w.write(book.code[idx], book.len[idx]);
    if (book.signed) continue;
    for (let d = 0; d < book.dim; d++) if (q[i + d]) w.write(q[i + d] < 0 ? 1 : 0, 1);
    if (book.max !== 16) continue;
    for (let d = 0; d < book.dim; d++) {
      const a = Math.abs(q[i + d]);
      if (a < 16) continue;
      const n = 31 - Math.clz32(a);
      w.write((1 << (n - 4)) - 1, n - 4);
      w.write(0, 1);
      w.write(a - (1 << n), n);
    }
  }
}

// ---------- psychoacoustics ----------
// Threshold of hearing (Terhardt), dB SPL, with full scale taken as 96 dB.
function athDb(hz) {
  const f = Math.max(0.02, hz / 1000);
  return 3.64 * Math.pow(f, -0.8) - 6.5 * Math.exp(-0.6 * (f - 3.3) ** 2) + 1e-3 * f ** 4;
}

function makeModel(sampleRate) {
  // Energy of a full-scale sine in the MDCT domain, the reference for 96 dB.
  const block = Float64Array.from({ length: 2 * N }, (_, n) => PCM_SCALE * Math.sin((2 * Math.PI * 1000 * n) / sampleRate));
  const spec = mdct(block);
  const full = spec.reduce((s, v) => s + v * v, 0);
  const ath = new Float64Array(MAX_BANDS);
  for (let b = 0; b < MAX_BANDS; b++) {
    const hz = ((SWB[b] + SWB[b + 1]) / 2) * (sampleRate / 2 / N);
    ath[b] = full * Math.pow(10, (athDb(hz) - 96) / 10);
  }
  return { ath };
}

// ---------- one channel ----------
function encodeChannel(x, model, snrDb) {
  const q = new Int32Array(N);
  const energy = new Float64Array(MAX_BANDS);
  for (let b = 0; b < MAX_BANDS; b++) for (let i = SWB[b]; i < SWB[b + 1]; i++) energy[b] += x[i] * x[i];
  const ratio = Math.pow(10, -snrDb / 10);
  const sf = new Int32Array(MAX_BANDS);
  const cb = new Int32Array(MAX_BANDS);
  for (let b = 0; b < MAX_BANDS; b++) {
    const mask = Math.max(energy[b], 0.25 * (energy[b - 1] || 0), 0.06 * (energy[b + 1] || 0));
    const allowed = Math.max(mask * ratio, model.ath[b]);
    sf[b] = chooseScalefactor(x, SWB[b], SWB[b + 1], allowed, q);
  }
  // Neighbouring transmitted scalefactors may differ by at most 60.
  let prev = -1;
  let maxSfb = 0;
  let bits = 0;
  for (let b = 0; b < MAX_BANDS; b++) {
    const { max } = quantize(x, SWB[b], SWB[b + 1], sf[b], q);
    if (max === 0) {
      cb[b] = 0;
      continue;
    }
    if (prev >= 0 && Math.abs(sf[b] - prev) > 60) {
      sf[b] = Math.max(prev - 60, Math.min(prev + 60, sf[b]));
      const again = quantize(x, SWB[b], SWB[b + 1], sf[b], q);
      if (again.max === 0) {
        cb[b] = 0;
        continue;
      }
    }
    const best = bestBook(q, SWB[b], SWB[b + 1], Math.max(...q.subarray(SWB[b], SWB[b + 1]).map(Math.abs)));
    cb[b] = best.cb;
    bits += best.bits;
    prev = sf[b];
    maxSfb = b + 1;
  }
  return { q, sf, cb, maxSfb, bits };
}

function writeChannel(w, ch) {
  const { q, sf, cb, maxSfb } = ch;
  let global = 100;
  for (let b = 0; b < maxSfb; b++) if (cb[b]) {
    global = sf[b];
    break;
  }
  w.write(global, 8);
  // ics_info: reserved, ONLY_LONG_SEQUENCE, sine window, max_sfb, no prediction
  w.write(0, 1);
  w.write(0, 2);
  w.write(0, 1);
  w.write(maxSfb, 6);
  w.write(0, 1);
  // section_data
  for (let b = 0; b < maxSfb;) {
    let end = b + 1;
    while (end < maxSfb && cb[end] === cb[b]) end++;
    w.write(cb[b], 4);
    let len = end - b;
    while (len >= 31) {
      w.write(31, 5);
      len -= 31;
    }
    w.write(len, 5);
    b = end;
  }
  // scale_factor_data
  let last = global;
  for (let b = 0; b < maxSfb; b++) {
    if (!cb[b]) continue;
    const d = sf[b] - last + 60;
    w.write(SCALEFACTOR_BOOK.code[d], SCALEFACTOR_BOOK.len[d]);
    last = sf[b];
  }
  w.write(0, 1); // pulse_data_present
  w.write(0, 1); // tns_data_present
  w.write(0, 1); // gain_control_data_present
  for (let b = 0; b < maxSfb; b++) if (cb[b]) writeBand(w, SPECTRAL_BOOKS[cb[b]], q, SWB[b], SWB[b + 1]);
}

// AudioSpecificConfig: AAC-LC, sample rate index, stereo.
export function audioSpecificConfig(sampleRate, channels = 2) {
  const sr = SR_INDEX[sampleRate];
  if (sr === undefined) throw new Error(`AAC: unsupported sample rate ${sampleRate}`);
  return Uint8Array.from([(2 << 3) | (sr >> 1), ((sr & 1) << 7) | (channels << 3)]);
}

/**
 * Encode stereo PCM (Float32Arrays in -1..1) to raw AAC-LC frames of 1024
 * samples. Frame k starts at k * 1024 samples, so no encoder delay needs to be
 * signalled: block k covers input samples [k*1024, k*1024 + 2048).
 */
export function encodeAac({ left, right, sampleRate }, { snrDb = 32 } = {}) {
  const model = makeModel(sampleRate);
  const frames = Math.ceil(left.length / N) + 1;
  const block = new Float64Array(2 * N);
  const spec = [new Float64Array(N), new Float64Array(N)];
  const out = [];
  for (let k = 0; k < frames; k++) {
    const channels = [left, right].map((src, c) => {
      for (let n = 0; n < 2 * N; n++) {
        const i = k * N + n;
        block[n] = i < src.length ? src[i] * PCM_SCALE : 0;
      }
      mdct(block, spec[c]);
      let snr = snrDb;
      let ch = encodeChannel(spec[c], model, snr);
      while (ch.bits > MAX_CHANNEL_BITS - 400 && snr > 0) {
        snr -= 3;
        ch = encodeChannel(spec[c], model, snr);
      }
      return ch;
    });
    const w = new BitWriter();
    w.write(ID_CPE, 3);
    w.write(0, 4); // element_instance_tag
    w.write(0, 1); // common_window
    writeChannel(w, channels[0]);
    writeChannel(w, channels[1]);
    w.write(ID_END, 3);
    out.push(w.bytes());
  }
  return { frames: out, frameSize: N, sampleRate, config: audioSpecificConfig(sampleRate) };
}
