// Caches cube data per round, built in a worker (falls back to the main thread).
import { buildRoundCubes } from './cubes-data.js';
import { buildTimeline } from './timeline.js';

export class CubeStore {
  constructor(onReady) {
    this.onReady = onReady;
    this.gen = 0;
    this.data = new Map();
    this.pending = new Map();
    try {
      this.worker = new Worker(new URL('./cubes-worker.js', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e) => this.receive(e.data);
      this.worker.onerror = () => {
        this.worker = null;
        this.retryPending();
      };
    } catch {
      this.worker = null;
    }
  }

  configure(params, budget) {
    this.gen++;
    this.params = params;
    this.budget = budget;
    this.data.clear();
    for (const p of this.pending.values()) p.reject?.(new Error('reconfigured'));
    this.pending.clear();
  }

  get(index) {
    return this.data.get(index) || null;
  }

  request(index) {
    if (this.data.has(index)) return Promise.resolve(this.data.get(index));
    if (this.pending.has(index)) return this.pending.get(index).promise;
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    promise.catch(() => {});
    this.pending.set(index, { promise, resolve, reject });
    this.send(index);
    return promise;
  }

  send(index) {
    const msg = { gen: this.gen, params: this.params, index, budget: this.budget };
    if (this.worker) {
      this.worker.postMessage(msg);
      return;
    }
    setTimeout(() => {
      if (msg.gen !== this.gen) return;
      const tl = buildTimeline(this.params);
      this.receive({ gen: msg.gen, index, data: buildRoundCubes(tl.rounds[index], { budget: this.budget, seed: 1 }) });
    }, 0);
  }

  retryPending() {
    for (const index of this.pending.keys()) this.send(index);
  }

  receive({ gen, index, data, error }) {
    if (gen !== this.gen) return;
    const p = this.pending.get(index);
    if (error) {
      console.error(error);
      this.worker = null;
      this.send(index);
      return;
    }
    this.data.set(index, data);
    this.pending.delete(index);
    p?.resolve(data);
    this.onReady?.(index, data);
  }

  // Keep memory bounded: only rounds near the playhead stay cached.
  keepAround(index) {
    for (const k of [...this.data.keys()]) if (k < index - 1 || k > index + 1) this.data.delete(k);
  }
}
