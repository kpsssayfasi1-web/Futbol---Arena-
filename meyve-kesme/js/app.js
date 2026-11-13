// Glue: renders any moment of the timeline, drives playback, sound and export.
import { createStage, placeCamera } from './scene.js';
import { FruitModel, createFruitUniforms } from './fruit-mesh.js';
import { CubePile } from './cubes-mesh.js';
import { Knife } from './knife.js';
import { Hud } from './hud.js';
import { buildTimeline, ROUND_PRESETS, roundIndexAt, roundState, TIMING } from './timeline.js';
import { knifePose } from './knife-pose.js';
import { displayedCubeTotal } from './cubes-data.js';
import { fruitById } from './fruits.js';
import { formatCount, LABELS } from './format.js';
import { CubeStore } from './cube-store.js';
import { AudioEngine, renderOfflineAudio } from './audio.js';
import { roundEvents, eventsInWindow } from './events.js';
import { LiveRecorder, saveFile } from './recorder.js';
import { exportMp4 } from './exporter.js';

const FAST_STROKE = 0.1;
const SHUTTER = 1 / 30;
const GHOSTS = 12;
export const QUALITY_BUDGET = { low: 40000, medium: 110000, high: 240000 };
const SKIN_ROUGHNESS = { apple: 0.3, watermelon: 0.42, orange: 0.55, kiwi: 0.85 };

export function isMobileDevice() {
  return matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 700;
}

export class App {
  constructor(canvas, settings, hooks = {}) {
    this.canvas = canvas;
    this.settings = settings;
    this.hooks = hooks;
    Object.assign(this, createStage(canvas, { shadowSize: settings.shadowSize || (isMobileDevice() ? 1024 : 2048) }));
    this.fruitUniforms = createFruitUniforms();
    this.fruit = new FruitModel(this.fruitUniforms);
    this.scene.add(this.fruit.root);
    this.knife = new Knife();
    this.scene.add(this.knife.group);
    this.hud = new Hud();
    this.shared = { uProj: { value: this.camera.projectionMatrix } };
    this.piles = new Map();
    this.events = new Map();
    this.store = new CubeStore((index, data) => this.onCubeData(index, data));
    this.audio = new AudioEngine();
    this.recorder = null;
    this.time = 0;
    this.playing = false;
    this.buffering = false;
    this.clockRef = null;
    this.lastRound = -1;
    this.lastNow = 0;
    this.rebuild();
  }

  get duration() {
    return this.timeline.duration;
  }

  budget() {
    const q = this.settings.quality;
    if (QUALITY_BUDGET[q]) return QUALITY_BUDGET[q];
    return isMobileDevice() ? 70000 : 150000;
  }

  rebuild() {
    const s = this.settings;
    this.params = { rounds: ROUND_PRESETS[s.preset] || ROUND_PRESETS.classic, fruit: s.fruit, speed: Number(s.speed) || 1 };
    this.timeline = buildTimeline(this.params);
    for (const p of this.piles.values()) {
      this.scene.remove(p.mesh);
      p.dispose();
    }
    this.piles.clear();
    this.events.clear();
    this.store.configure(this.params, this.budget());
    this.time = Math.min(this.time, this.duration);
    this.lastRound = -1;
    this.resetClock();
    this.prefetch(roundIndexAt(this.timeline, this.time));
  }

  prefetch(ri) {
    for (const i of [ri, ri + 1]) if (i < this.timeline.rounds.length && !this.piles.has(i)) this.store.request(i);
  }

  // Only rounds next to the playhead get GPU buffers; others just feed the sound.
  onCubeData(index, data) {
    const round = this.timeline.rounds[index];
    if (!round) return;
    if (Math.abs(index - (this.roundIndex ?? 0)) <= 1) this.addPile(index, data);
    else this.events.set(index, roundEvents(round, data));
  }

  addPile(index, data) {
    if (this.piles.has(index)) return this.piles.get(index);
    const round = this.timeline.rounds[index];
    if (!round) return null;
    const f = fruitById(round.fruitId);
    const pile = new CubePile(
      data,
      { glsl: f.glsl, skinThickness: f.skinThickness, bbox: round.bbox, boardY: round.boardY, stemColor: f.stem?.color, skinRoughness: SKIN_ROUGHNESS[f.id] },
      this.shared,
    );
    pile.mesh.visible = false;
    this.scene.add(pile.mesh);
    this.piles.set(index, pile);
    this.events.set(index, roundEvents(round, data));
    return pile;
  }

  async ensurePile(index) {
    if (index < 0 || index >= this.timeline.rounds.length) return;
    if (this.piles.has(index)) return;
    const data = await this.store.request(index);
    this.addPile(index, data);
  }

  evictPiles(ri) {
    for (const [index, pile] of this.piles) {
      if (index < ri - 1 || index > ri + 1) {
        this.scene.remove(pile.mesh);
        pile.dispose();
        this.piles.delete(index);
      }
    }
  }

  eventsFor(from, to) {
    const out = [];
    for (const r of this.timeline.rounds) {
      if (r.end < from - 1 || r.start > to) continue;
      let evs = this.events.get(r.index);
      if (!evs) {
        evs = roundEvents(r, null);
        this.events.set(r.index, evs);
      }
      out.push(...eventsInWindow(evs, from, to));
    }
    return out;
  }

  // ---------- rendering ----------
  knifeSamples(round, T) {
    const state = roundState(round, T);
    const pose = knifePose(round, state, T);
    const samples = [pose];
    if (state.active && pose.interval < FAST_STROKE) {
      for (let j = 1; j < GHOSTS; j++) {
        const tj = T - (SHUTTER * j) / (GHOSTS - 1);
        if (tj < round.start) break;
        samples.push(knifePose(round, roundState(round, tj), tj));
      }
    }
    return { state, pose, samples };
  }

  shake(round, state, T) {
    let last = -1;
    let interval = 1;
    for (const a of [0, 2]) {
      const c = state.done[a];
      if (c === 0) continue;
      const ph = round.phases[a];
      const t = ph.times[c - 1];
      if (t > last) {
        last = t;
        interval = c > 1 ? t - ph.times[c - 2] : 1;
      }
    }
    let s = 0;
    if (last > 0) {
      const k = T - last;
      s += (interval > 0.15 ? 0.016 : 0.004) * Math.exp(-k * 22) * Math.cos(k * 70);
    }
    const kl = T - round.land;
    if (kl >= 0) s += 0.03 * Math.exp(-kl * 14) * Math.cos(kl * 60);
    return s;
  }

  renderAt(T) {
    const tl = this.timeline;
    const ri = roundIndexAt(tl, T);
    const round = tl.rounds[ri];
    const { state, pose, samples } = this.knifeSamples(round, T);
    this.fruit.setFruit(fruitById(round.fruitId));
    this.fruit.setIntro(round, T, round.boardY);
    const u = this.fruitUniforms;
    u.uBMin.value.fromArray(round.bbox.min);
    u.uBMax.value.fromArray(round.bbox.max);
    u.uCutN.value.fromArray(round.split);
    u.uCutDone.value.fromArray(state.done);
    u.uClipZ.value = Number.isFinite(state.clipZ) ? state.clipZ : 1e6;
    if (state.active) {
      const a = state.active;
      const fromMin = a.axis === 0 ? a.index : round.split[a.axis] - 1 - a.index;
      u.uActive.value.set(a.axis, fromMin, pose.edge, 1);
    } else {
      u.uActive.value.set(0, 0, 0, 0);
    }
    const zp = round.phases[2];
    const gone = T >= zp.times[zp.n - 1] + 0.13;
    this.fruit.setVisible(!gone, Number.isFinite(state.clipZ) && !gone);
    for (const [index, pile] of this.piles) {
      let visible = false;
      if (index === ri) {
        visible = T >= zp.times[0] - 0.02;
        pile.set(T, 0);
      } else if (index === ri - 1) {
        const k = T - round.start;
        visible = k < TIMING.outro + 0.1;
        pile.set(T, k);
      }
      pile.mesh.visible = visible;
    }
    this.knife.update(samples, -round.boardY);
    placeCamera(this.camera, T, this.shake(round, state, T));
    const pile = this.piles.get(ri);
    const labels = LABELS[this.settings.lang] || LABELS.en;
    const cubes = pile ? displayedCubeTotal(pile.data, T) : 0;
    this.hud.update({ cuts: state.total, cubesText: formatCount(cubes, pile ? !pile.data.exact : false, labels.locale), labels, handle: this.settings.handle, t: T });
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.hud.render(this.renderer);
    if (ri !== this.lastRound) {
      this.lastRound = ri;
      this.prefetch(ri);
      this.evictPiles(ri);
      this.store.keepAround(ri);
    }
    this.roundIndex = ri;
    return { ri, round, state };
  }

  // Round data must exist before its cubes start falling; pause the clock if not.
  needsData(T) {
    const ri = roundIndexAt(this.timeline, T);
    const zp = this.timeline.rounds[ri].phases[2];
    return T >= zp.times[0] - 0.05 && !this.piles.has(ri);
  }

  // ---------- playback ----------
  resetClock() {
    this.clockRef = null;
    this.audio.reset(this.time);
  }

  play() {
    if (this.settings.sound) this.audio.ensure();
    if (this.time >= this.duration - 0.01) this.time = 0;
    this.playing = true;
    this.resetClock();
  }

  pause() {
    this.playing = false;
    this.resetClock();
  }

  seek(t) {
    this.time = Math.max(0, Math.min(this.duration, t));
    this.resetClock();
  }

  advance(now) {
    const dt = Math.min(0.1, Math.max(0, (now - (this.lastNow || now)) / 1000));
    this.lastNow = now;
    if (!this.playing) return;
    const wasBuffering = this.buffering;
    this.buffering = this.needsData(this.time);
    if (this.buffering) {
      this.resetClock();
      return;
    }
    if (wasBuffering) this.resetClock();
    if (this.settings.sound && this.audio.running) {
      const at = this.audio.now;
      if (!this.clockRef) this.clockRef = { audio: at, t: this.time };
      this.time = this.clockRef.t + (at - this.clockRef.audio);
    } else {
      this.time += dt;
    }
    if (this.time >= this.duration) {
      this.time = this.duration;
      if (this.recorder) {
        this.finishRecording();
      } else if (this.settings.loop) {
        this.time = 0;
        this.resetClock();
      } else {
        this.pause();
      }
    }
    if (this.settings.sound) this.audio.update(this.time, (a, b) => this.eventsFor(a, b));
  }

  frame(now) {
    if (this.exporting) return;
    this.advance(now);
    this.renderAt(this.time);
  }

  resize(cssW, cssH, pixelRatio) {
    if (this.recorder || this.exporting) return;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(cssW, cssH, false);
    this.hud.invalidate();
  }

  setRenderSize(w, h) {
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h, false);
  }

  // ---------- recording / export ----------
  startRecording() {
    this.audio.ensure();
    this.setRenderSize(1080, 1920);
    this.seek(0);
    this.recorder = new LiveRecorder();
    this.recorder.start(this.canvas, this.settings.sound ? this.audio.streamDest?.stream : null, 60);
    this.play();
    this.hooks.onRecording?.(true);
  }

  async finishRecording() {
    const rec = this.recorder;
    if (!rec) return;
    this.recorder = null;
    this.pause();
    const blob = await rec.stop();
    this.hooks.onRecording?.(false);
    this.hooks.onResize?.();
    if (blob) this.hooks.onSaved?.(await saveFile(blob, `${this.fileName()}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`));
  }

  fileName() {
    const rounds = this.params.rounds;
    return `${this.settings.fruit}-vs-${rounds[rounds.length - 1]}-kesim`;
  }

  async allEvents() {
    const all = [];
    for (const r of this.timeline.rounds) {
      const pile = this.piles.get(r.index);
      const data = pile ? pile.data : await this.store.request(r.index);
      all.push(...roundEvents(r, data));
      this.store.keepAround(this.roundIndex ?? 0);
    }
    return all.sort((a, b) => a.t - b.t);
  }

  async exportVideo({ fps = 30, width = 1080, height = 1920, onProgress, isCancelled, duration = this.duration } = {}) {
    this.pause();
    this.exporting = true;
    try {
      const audioBuffer = this.settings.sound ? await renderOfflineAudio(await this.allEvents(), duration) : null;
      this.setRenderSize(width, height);
      const result = await exportMp4({
        width,
        height,
        fps,
        duration,
        audioBuffer,
        onProgress,
        isCancelled,
        prepare: async (t) => {
          const ri = roundIndexAt(this.timeline, t);
          const round = this.timeline.rounds[ri];
          if (t - round.start < TIMING.outro + 0.1) await this.ensurePile(ri - 1);
          if (t >= round.phases[2].times[0] - 0.05) await this.ensurePile(ri);
          if (ri + 1 < this.timeline.rounds.length) this.store.request(ri + 1);
        },
        renderFrame: (t) => {
          this.renderAt(t);
          return this.canvas;
        },
      });
      if (result) result.saved = await saveFile(result.blob, `${this.fileName()}.mp4`);
      return result;
    } finally {
      this.exporting = false;
      this.hooks.onResize?.();
    }
  }
}
