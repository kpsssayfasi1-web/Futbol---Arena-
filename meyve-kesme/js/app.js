// Glue: renders any moment of the timeline, drives playback, sound and export.
import { createStage, placeCamera, placeContactShadow } from './scene.js';
import { buildCameraPlan } from './camera.js';
import { ObjectModel } from './object-mesh.js';
import { createCutUniforms, objectMaterials, precompile } from './materials.js';
import { CubePile, cubeMaterialsFor, DETAILED_LIMIT } from './cubes-mesh.js';
import { Knife } from './knife.js';
import { Hud } from './hud.js';
import { buildTimeline, ROUND_PRESETS, roundIndexAt, roundState, TIMING } from './timeline.js';
import { knifePose } from './knife-pose.js';
import { displayedCubeTotal, displayGrid, COARSE_CELL_LIMIT } from './cubes-data.js';
import { itemById } from './catalog/index.js';
import { objectInfo } from './object-info.js';
import { formatCount, LABELS } from './format.js';
import { WorkerHub } from './worker-hub.js';
import { AudioEngine, renderOfflineAudio, toBuffer } from './audio.js';
import { roundEvents, eventsInWindow } from './events.js';
import { LiveRecorder, saveFile } from './recorder.js';
import { exportMp4 } from './exporter.js';
import { hookText } from './titles.js';

const FAST_STROKE = 0.1;
const SHUTTER = 1 / 30;
const GHOSTS = 12;
export const QUALITY_BUDGET = { low: 40000, medium: 100000, high: 400000 };
// Frame-by-frame export is not real time, so it can afford a much finer pile.
export const EXPORT_BUDGET = { desktop: 420000, mobile: 140000 };
const MIN_RENDER_SCALE = 0.75;

export function isMobileDevice() {
  return matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 700;
}

export class App {
  constructor(canvas, settings, hooks = {}) {
    this.canvas = canvas;
    this.settings = settings;
    this.hooks = hooks;
    Object.assign(this, createStage(canvas, { shadowSize: settings.shadowSize || (isMobileDevice() ? 1024 : 2048) }));
    this.cut = createCutUniforms();
    this.model = new ObjectModel(this.cut);
    this.scene.add(this.model.root);
    this.knife = new Knife();
    this.scene.add(this.knife.group);
    this.hud = new Hud();
    this.shared = { uProj: { value: this.camera.projectionMatrix } };
    this.hub = new WorkerHub();
    this.audio = new AudioEngine();
    this.piles = new Map();
    this.events = new Map();
    this.compiled = new Set();
    this.gen = 0;
    this.time = 0;
    this.playing = false;
    this.buffering = false;
    this.recorder = null;
    this.lastRound = -1;
    this.lastNow = 0;
    this.perf = { ema: 1 / 60, scale: 1, base: 1, cssW: 1, cssH: 1, calm: 0 };
    this.rebuild();
  }

  get duration() {
    return this.timeline.duration;
  }

  budget() {
    const q = this.settings.quality;
    const mobile = isMobileDevice();
    const live = QUALITY_BUDGET[q] || (mobile ? 60000 : 220000);
    return this.exportBoost ? Math.max(live, mobile ? EXPORT_BUDGET.mobile : EXPORT_BUDGET.desktop) : live;
  }

  // Switch between the live and the export cube budget; piles built for the
  // other budget are dropped and rebuilt on demand.
  setExportBoost(on) {
    if (!!this.exportBoost === on) return;
    const before = this.budget();
    this.exportBoost = on;
    if (this.budget() === before) return;
    for (const p of this.piles.values()) {
      this.scene.remove(p.mesh);
      p.dispose();
    }
    this.piles.clear();
    this.gen++; // results still in flight for the old budget are ignored
    this.hub.reset('cubes');
  }

  // ---------- data ----------
  rebuild() {
    const s = this.settings;
    this.gen++;
    this.params = { rounds: ROUND_PRESETS[s.preset] || ROUND_PRESETS.classic, item: s.item, speed: Number(s.speed) || 1, seed: Number(s.seed) || 0 };
    this.timeline = buildTimeline(this.params);
    this.refreshCamera();
    for (const p of this.piles.values()) {
      this.scene.remove(p.mesh);
      p.dispose();
    }
    this.piles.clear();
    this.events.clear();
    this.hub.reset('cubes');
    this.time = Math.min(this.time, this.duration);
    this.lastRound = -1;
    this.resetClock();
    this.prefetch(roundIndexAt(this.timeline, this.time));
    this.refreshMusic();
  }

  refreshCamera() {
    this.cameraPlan = buildCameraPlan(this.timeline, this.settings.camera, Number(this.settings.seed) || 1);
  }

  musicJob() {
    const s = this.settings;
    const duration = Math.ceil(this.duration * 10) / 10;
    return { key: `music:${s.music}:${s.seed}:${duration}`, job: { kind: 'music', style: s.music, seed: Number(s.seed) || 1, duration } };
  }

  refreshMusic() {
    const s = this.settings;
    this.audio.setVolumes({ music: s.music === 'off' ? 0 : Number(s.musicVolume ?? 0.35) });
    if (s.music === 'off') return Promise.resolve(this.audio.setMusic(null));
    if (s.music === 'custom') return Promise.resolve(this.audio.setMusic(this.customMusic || null, true));
    const { key, job } = this.musicJob();
    // Keep only the current score in memory (each one is tens of megabytes).
    if (this.musicKey && this.musicKey !== key) this.hub.forget(this.musicKey);
    this.musicKey = key;
    return this.hub.request(key, job).then((m) => {
      if (this.musicKey !== key) return;
      this.audio.setMusic(toBuffer(m));
      this.resetClock();
    });
  }

  setCustomMusic(buffer) {
    this.customMusic = buffer;
    return this.refreshMusic();
  }

  cubeKey(index) {
    return `cubes:${this.gen}:${this.budget()}:${index}`;
  }

  cubeJob(index) {
    return { kind: 'cubes', params: this.params, index, budget: this.budget() };
  }

  prefetch(ri) {
    for (const i of [ri, ri + 1]) {
      const round = this.timeline.rounds[i];
      if (!round) continue;
      const item = itemById(round.itemId);
      this.requestMesh(item);
      this.requestBank(item.sound?.cut || 'crisp');
      this.warmPrograms(item, round);
      if (!this.piles.has(i)) this.requestCubes(i);
    }
  }

  requestMesh(item) {
    if (this.model.hasGeometry(item.id)) return Promise.resolve();
    return this.hub.request(`mesh:${item.id}`, { kind: 'mesh', id: item.id }).then((mesh) => {
      this.model.addGeometry(item.id, mesh);
      this.hub.forget(`mesh:${item.id}`);
    });
  }

  requestBank(profile) {
    if (this.audio.banks.has(profile)) return Promise.resolve();
    return this.hub.request(`bank:${profile}`, { kind: 'bank', profile }).then((raw) => {
      if (!this.audio.banks.has(profile)) this.audio.setBank(profile, raw);
    });
  }

  requestCubes(index) {
    const gen = this.gen;
    return this.hub.request(this.cubeKey(index), this.cubeJob(index)).then((data) => {
      if (gen !== this.gen) return;
      if (Math.abs(index - (this.roundIndex ?? 0)) <= 1) this.addPile(index, data);
    });
  }

  // Predicts which cube program a round will use, so it can compile early.
  predictMode(round) {
    const info = objectInfo(itemById(round.itemId));
    const grid = displayGrid(round.split, this.budget(), info);
    const cells = grid.dims[0] * grid.dims[1] * grid.dims[2];
    if (cells <= COARSE_CELL_LIMIT) return 'boolean';
    return cells * 0.5 <= DETAILED_LIMIT ? 'detailed' : 'baked';
  }

  warmPrograms(item, round) {
    const mode = this.predictMode(round);
    const key = `${item.id}:${mode}`;
    if (this.compiled.has(key)) return;
    this.compiled.add(key);
    const m = objectMaterials(item, this.cut);
    precompile(this.renderer, this.camera, this.scene, [m.body, m.cap, m.capDepth, m.bodyDepth, cubeMaterialsFor(item, mode)]);
  }

  addPile(index, data) {
    if (this.piles.has(index)) return this.piles.get(index);
    const round = this.timeline.rounds[index];
    if (!round) return null;
    const pile = new CubePile(data, itemById(round.itemId), round, this.shared, this.renderer);
    pile.mesh.castShadow = pile.mode !== 'baked' || this.settings.quality === 'high';
    pile.mesh.visible = false;
    this.scene.add(pile.mesh);
    this.piles.set(index, pile);
    return pile;
  }

  async ensureRound(index) {
    const round = this.timeline.rounds[index];
    if (!round) return;
    const item = itemById(round.itemId);
    await Promise.all([this.requestMesh(item), this.requestBank(item.sound?.cut || 'crisp')]);
    if (!this.piles.has(index)) {
      const data = await this.hub.request(this.cubeKey(index), this.cubeJob(index));
      this.addPile(index, data);
    }
  }

  evict(ri) {
    for (const [index, pile] of this.piles) {
      if (index < ri - 1 || index > ri + 1) {
        this.scene.remove(pile.mesh);
        pile.dispose();
        this.piles.delete(index);
        this.hub.forget(this.cubeKey(index));
      }
    }
    for (const k of [...this.events.keys()]) if (k < ri - 1) this.events.delete(k);
    const keep = new Set([ri - 1, ri, ri + 1].map((i) => this.timeline.rounds[i]?.itemId).filter(Boolean));
    this.model.retain(keep);
  }

  eventsFor(from, to) {
    const out = [];
    for (const r of this.timeline.rounds) {
      if (r.end < from - 1 || r.start > to) continue;
      if (!this.events.has(r.index)) this.events.set(r.index, roundEvents(r));
      out.push(...eventsInWindow(this.events.get(r.index), from, to));
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
      if (ph.times[c - 1] > last) {
        last = ph.times[c - 1];
        interval = c > 1 ? last - ph.times[c - 2] : 1;
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

  hudValues(ri, round, state, T) {
    const labels = LABELS[this.settings.lang] || LABELS.en;
    let cuts = state.total;
    let pile = this.piles.get(ri);
    let at = T;
    if (ri > 0 && T < round.land) {
      // Keep the previous total on screen until the next item lands.
      const prev = this.timeline.rounds[ri - 1];
      cuts = prev.cuts;
      pile = this.piles.get(ri - 1);
      at = prev.end;
    }
    const cubes = pile ? displayedCubeTotal(pile.data, at) : 0;
    const hookOn = this.settings.hook !== false && ri === 0 && T < TIMING.hook;
    const hookAlpha = hookOn ? Math.min(1, T / 0.12 + 0.01) * Math.min(1, (TIMING.hook - T) / 0.3) : 0;
    return { cuts, cubesText: formatCount(cubes, pile ? !pile.data.exact : false, labels.locale), labels, handle: this.settings.handle, t: T, hook: hookOn ? hookText(this.settings, this.timeline) : '', hookAlpha };
  }

  renderAt(T) {
    const tl = this.timeline;
    const ri = roundIndexAt(tl, T);
    const round = tl.rounds[ri];
    const item = itemById(round.itemId);
    const { state, pose, samples } = this.knifeSamples(round, T);
    const hasItem = this.model.setItem(item);
    this.model.setIntro(round, T);
    const u = this.cut;
    u.uBMin.value.fromArray(round.bbox.min);
    u.uBMax.value.fromArray(round.bbox.max);
    u.uCutN.value.fromArray(round.split);
    u.uCutDone.value.fromArray(state.done);
    u.uClipZ.value = Number.isFinite(state.clipZ) ? state.clipZ : 1e6;
    if (state.active) {
      const a = state.active;
      u.uActive.value.set(a.axis, round.split[a.axis] - 1 - a.index, pose.edge, 1);
    } else u.uActive.value.set(0, 0, 0, 0);
    const zp = round.phases[2];
    const gone = T >= zp.times[zp.n - 1] + 0.13;
    this.model.setVisible(hasItem && !gone, Number.isFinite(state.clipZ) && !gone);
    // the contact shade appears once the item lands and follows what still stands
    placeContactShadow(this.contact, round, hasItem && !gone && T >= round.land, state.clipZ);
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
      if (!visible && pile.warm > 0) {
        // Draw once with every cube collapsed so buffers upload before they matter.
        pile.warm--;
        visible = true;
        pile.set(-1e3, 0);
      }
      pile.mesh.visible = visible;
    }
    this.knife.update(samples, -round.boardY);
    placeCamera(this.camera, T, this.shake(round, state, T), this.cameraPlan);
    this.hud.update(this.hudValues(ri, round, state, T));
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.hud.render(this.renderer);
    this.roundIndex = ri;
    if (ri !== this.lastRound) {
      this.lastRound = ri;
      this.prefetch(ri);
      this.evict(ri);
    }
    return { ri, round, state };
  }

  needsData(T) {
    const ri = roundIndexAt(this.timeline, T);
    const round = this.timeline.rounds[ri];
    if (!this.model.hasGeometry(round.itemId)) return true;
    return T >= round.phases[2].times[0] - 0.05 && !this.piles.has(ri);
  }

  // ---------- playback ----------
  resetClock() {
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

  // Playback runs on the display clock (smooth); audio is scheduled against it.
  advance(now) {
    const dt = Math.min(0.1, Math.max(0, (now - (this.lastNow || now)) / 1000));
    this.lastNow = now;
    this.adaptResolution(dt);
    if (!this.playing) return;
    const wasBuffering = this.buffering;
    this.buffering = this.needsData(this.time);
    if (this.buffering) {
      if (!wasBuffering) this.resetClock();
      return;
    }
    if (wasBuffering) this.resetClock();
    this.time += dt;
    if (this.time >= this.duration) {
      this.time = this.duration;
      if (this.recorder) this.finishRecording();
      else if (this.settings.loop) this.seek(0);
      else this.pause();
    }
    if (this.settings.sound) this.audio.update(this.time, (a, b) => this.eventsFor(a, b), this.duration);
  }

  frame(now) {
    if (this.exporting) return;
    this.advance(now);
    this.renderAt(this.time);
  }

  // Lower the pixel ratio when frames run long; raise it again once smooth.
  adaptResolution(dt) {
    const p = this.perf;
    if (this.recorder || this.exporting || !this.playing || dt <= 0) return;
    p.ema += (dt - p.ema) * 0.08;
    let next = p.scale;
    if (p.ema > 1 / 38 && p.scale > MIN_RENDER_SCALE) {
      next = Math.max(MIN_RENDER_SCALE, p.scale * 0.9);
      p.calm = 0;
    } else if (p.ema < 1 / 57) {
      p.calm += dt;
      if (p.calm > 2.5 && p.scale < 1) {
        next = Math.min(1, p.scale * 1.08);
        p.calm = 0;
      }
    }
    if (next !== p.scale) {
      p.scale = next;
      p.ema = 1 / 55;
      this.renderer.setPixelRatio(p.base * p.scale);
      this.renderer.setSize(p.cssW, p.cssH, false);
    }
  }

  resize(cssW, cssH, pixelRatio) {
    if (this.recorder || this.exporting) return;
    Object.assign(this.perf, { base: pixelRatio, cssW, cssH });
    this.renderer.setPixelRatio(pixelRatio * this.perf.scale);
    this.renderer.setSize(cssW, cssH, false);
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
    const sel = this.settings.item.replace('mix:', 'karisik-');
    return `${sel}-vs-${rounds[rounds.length - 1]}-kesim-${this.settings.seed}`;
  }

  async soundtrack(duration) {
    const events = [];
    for (const r of this.timeline.rounds) {
      await this.requestBank(itemById(r.itemId).sound?.cut || 'crisp');
      events.push(...roundEvents(r));
    }
    events.sort((a, b) => a.t - b.t);
    return renderOfflineAudio({ events, banks: this.audio.banks, music: this.settings.music === 'off' ? null : this.audio.music, volumes: this.audio.volumes, duration });
  }

  // The mixed soundtrack, AAC-encoded off the main thread.
  async encodedSoundtrack(duration, onStatus) {
    onStatus?.('Ses ve müzik hazırlanıyor…');
    const mix = await this.soundtrack(duration);
    onStatus?.('Ses AAC olarak kodlanıyor…');
    const key = `aac:${Date.now()}`;
    const job = { kind: 'aac', left: mix.getChannelData(0).slice(), right: mix.getChannelData(mix.numberOfChannels > 1 ? 1 : 0).slice(), sampleRate: mix.sampleRate };
    try {
      return await this.hub.request(key, job);
    } finally {
      this.hub.forget(key);
    }
  }

  async exportVideo({ fps = 30, width = 1080, height = 1920, onProgress, onStatus, isCancelled, duration = this.duration, save = true } = {}) {
    this.pause();
    this.exporting = true;
    this.setExportBoost(true);
    try {
      await this.refreshMusic();
      const aac = this.settings.sound ? await this.encodedSoundtrack(duration, onStatus) : null;
      this.setRenderSize(width, height);
      const result = await exportMp4({
        width, height, fps, duration, aac, onProgress, onStatus, isCancelled,
        prepare: async (t) => {
          const ri = roundIndexAt(this.timeline, t);
          const round = this.timeline.rounds[ri];
          if (t < round.land + TIMING.outro) await this.ensureRound(ri - 1);
          await this.ensureRound(ri);
          if (ri + 1 < this.timeline.rounds.length) this.prefetch(ri + 1);
        },
        renderFrame: (t) => {
          this.renderAt(t);
          return this.canvas;
        },
      });
      if (result && save) result.saved = await saveFile(result.blob, `${this.fileName()}.mp4`);
      return result;
    } finally {
      this.exporting = false;
      this.setExportBoost(false);
      this.prefetch(roundIndexAt(this.timeline, this.time));
      this.hooks.onResize?.();
    }
  }
}
