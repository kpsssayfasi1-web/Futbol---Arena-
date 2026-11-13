// WebAudio playback of the sound events, live (scheduled slightly ahead of the
// playhead) or offline (whole video rendered into one AudioBuffer for export).
import { synthBank, roomImpulse, SAMPLE_RATE } from './sfx.js';

let bankCache = null;
function bankData() {
  if (!bankCache) bankCache = synthBank(42);
  return bankCache;
}

function toBuffers(ctx) {
  const out = {};
  for (const [name, list] of Object.entries(bankData())) {
    out[name] = list.map((samples) => {
      const b = ctx.createBuffer(1, samples.length, SAMPLE_RATE);
      b.copyToChannel(samples, 0);
      return b;
    });
  }
  return out;
}

function buildGraph(ctx) {
  const input = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 8;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.12;
  const verb = ctx.createConvolver();
  const ir = roomImpulse(0.45, ctx.sampleRate);
  const irBuf = ctx.createBuffer(2, ir[0].length, ctx.sampleRate);
  irBuf.copyToChannel(ir[0], 0);
  irBuf.copyToChannel(ir[1], 1);
  verb.buffer = irBuf;
  const wet = ctx.createGain();
  wet.gain.value = 0.14;
  const master = ctx.createGain();
  master.gain.value = 0.9;
  input.connect(comp);
  input.connect(verb);
  verb.connect(wet);
  wet.connect(comp);
  comp.connect(master);
  master.connect(ctx.destination);
  return { input, master };
}

function playEvent(ctx, graph, buffers, ev, when, track) {
  const list = buffers[ev.type];
  if (!list) return;
  const src = ctx.createBufferSource();
  src.buffer = list[ev.variant % list.length];
  src.playbackRate.value = ev.rate || 1;
  const g = ctx.createGain();
  src.connect(g);
  g.connect(graph.input);
  const start = Math.max(when, ctx.currentTime);
  if (ev.duration) {
    const d = ev.duration;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(ev.gain, start + 0.04);
    g.gain.setValueAtTime(ev.gain, start + d - 0.05);
    g.gain.linearRampToValueAtTime(0, start + d);
    const offset = ((ev.variant * 0.37 + ev.t * 1.7) % 1) * Math.max(0, src.buffer.duration - d - 0.05);
    src.start(start, offset);
    src.stop(start + d + 0.02);
  } else {
    g.gain.value = ev.gain;
    src.start(start);
  }
  if (track) track(src);
}

export async function renderOfflineAudio(events, duration, sampleRate = 48000) {
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
  const graph = buildGraph(ctx);
  const buffers = toBuffers(ctx);
  for (const ev of events) if (ev.t >= 0 && ev.t < duration) playEvent(ctx, graph, buffers, ev, ev.t);
  return ctx.startRendering();
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.sources = new Set();
    this.scheduledUntil = 0;
  }

  // Must be called from a user gesture the first time.
  ensure() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx({ latencyHint: 'interactive' });
      this.graph = buildGraph(this.ctx);
      this.buffers = toBuffers(this.ctx);
      if (this.ctx.createMediaStreamDestination) {
        this.streamDest = this.ctx.createMediaStreamDestination();
        this.graph.master.connect(this.streamDest);
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  get running() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  reset(t) {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources.clear();
    this.scheduledUntil = t;
  }

  update(t, getEvents) {
    if (!this.running || !this.enabled) return;
    const ahead = t + 0.2;
    if (ahead <= this.scheduledUntil) return;
    const from = Math.max(this.scheduledUntil, t);
    for (const ev of getEvents(from, ahead)) {
      playEvent(this.ctx, this.graph, this.buffers, ev, this.ctx.currentTime + (ev.t - t), (src) => {
        this.sources.add(src);
        src.onended = () => this.sources.delete(src);
      });
    }
    this.scheduledUntil = ahead;
  }
}
