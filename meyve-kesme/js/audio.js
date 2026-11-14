// WebAudio playback: knife events (scheduled slightly ahead of the playhead)
// and the background music bed. The same mix renders offline for export.
import { roomImpulse, capPeak } from './sfx.js';
import { eventsInWindow } from './events.js';

export function toBuffer({ left, right, sampleRate }) {
  const b = new AudioBuffer({ length: left.length, numberOfChannels: 2, sampleRate });
  b.copyToChannel(left, 0);
  b.copyToChannel(right || left, 1);
  return b;
}

function monoBuffer(samples, sampleRate) {
  const b = new AudioBuffer({ length: samples.length, numberOfChannels: 1, sampleRate });
  b.copyToChannel(samples, 0);
  return b;
}

function buildGraph(ctx) {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.knee.value = 8;
  comp.ratio.value = 3.5;
  comp.attack.value = 0.003;
  comp.release.value = 0.15;
  const master = ctx.createGain();
  master.gain.value = 0.95;
  const sfx = ctx.createGain();
  const music = ctx.createGain();
  const verb = ctx.createConvolver();
  const ir = roomImpulse(0.45, ctx.sampleRate);
  verb.buffer = toBuffer({ left: ir[0], right: ir[1], sampleRate: ctx.sampleRate });
  const wet = ctx.createGain();
  wet.gain.value = 0.12;
  sfx.connect(comp);
  sfx.connect(verb);
  verb.connect(wet);
  wet.connect(comp);
  comp.connect(master);
  music.connect(master);
  master.connect(ctx.destination);
  return { sfx, music, master };
}

function playEvent(ctx, graph, banks, ev, when, gain, track) {
  const list = banks.get(ev.profile)?.[ev.type];
  if (!list || !list.length) return;
  const src = ctx.createBufferSource();
  src.buffer = list[ev.variant % list.length];
  src.playbackRate.value = ev.rate || 1;
  const g = ctx.createGain();
  g.gain.value = ev.gain * gain;
  src.connect(g);
  g.connect(graph.sfx);
  src.start(Math.max(when, ctx.currentTime));
  track?.(src);
}

function startBed(ctx, bus, buffer, when, offset, loop, track) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = loop;
  src.connect(bus);
  src.start(Math.max(when, ctx.currentTime), loop ? offset % buffer.duration : offset);
  track?.(src);
  return src;
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.banks = new Map(); // profile -> { type: AudioBuffer[] }
    this.music = null; // { buffer, loop }
    this.volumes = { sfx: 1, music: 0.35 };
    this.sources = new Set();
    this.reset(0);
  }

  ensure() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx({ latencyHint: 'interactive' });
      this.graph = buildGraph(this.ctx);
      if (this.ctx.createMediaStreamDestination) {
        this.streamDest = this.ctx.createMediaStreamDestination();
        this.graph.master.connect(this.streamDest);
      }
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  get running() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  setBank(profile, raw) {
    const bank = {};
    for (const [name, list] of Object.entries(raw)) bank[name] = list.map((s) => monoBuffer(s, 48000));
    this.banks.set(profile, bank);
  }

  setMusic(buffer, loop = false) {
    this.music = buffer ? { buffer, loop } : null;
    this.musicStarted = false;
  }

  setVolumes(v) {
    Object.assign(this.volumes, v);
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.graph) return;
    this.graph.music.gain.value = this.volumes.music;
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
    this.musicStarted = false;
  }

  track = (src) => {
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
  };

  update(t, getEvents, duration) {
    if (!this.running || !this.enabled) return;
    const now = this.ctx.currentTime;
    if (this.music && !this.musicStarted && t < duration) {
      this.musicStarted = true;
      if (this.music.loop || t < this.music.buffer.duration) {
        const src = startBed(this.ctx, this.graph.music, this.music.buffer, now, t, this.music.loop, this.track);
        if (this.music.loop) src.stop(now + (duration - t));
      }
    }
    const ahead = t + 0.2;
    if (ahead <= this.scheduledUntil) return;
    const from = Math.max(this.scheduledUntil, t);
    for (const ev of getEvents(from, ahead)) playEvent(this.ctx, this.graph, this.banks, ev, now + (ev.t - t), this.volumes.sfx, this.track);
    this.scheduledUntil = ahead;
  }
}

// Whole soundtrack for export: knife events + music.
export async function renderOfflineAudio({ events, banks, music, volumes, duration, sampleRate = 48000 }) {
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
  const graph = buildGraph(ctx);
  graph.music.gain.value = volumes.music;
  for (const ev of eventsInWindow(events, 0, duration)) playEvent(ctx, graph, banks, ev, ev.t, volumes.sfx);
  if (music) {
    const src = startBed(ctx, graph.music, music.buffer, 0, 0, music.loop);
    if (music.loop) src.stop(duration);
    graph.music.gain.setValueAtTime(volumes.music, Math.max(0, duration - 1.6));
    graph.music.gain.linearRampToValueAtTime(0, duration);
  }
  const mix = await ctx.startRendering();
  capPeak(Array.from({ length: mix.numberOfChannels }, (_, c) => mix.getChannelData(c)), -1);
  return mix;
}
