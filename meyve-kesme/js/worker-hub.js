// Sends jobs to two module workers (geometry and audio, so a long music render
// never delays the next item's mesh), with an inline fallback. Results are
// cached by key until the hub is reset (settings change).
import { runJob } from './work.js';

export class WorkerHub {
  constructor() {
    this.nextId = 1;
    this.waiting = new Map();
    this.cache = new Map();
    this.gen = 0;
    try {
      this.workers = [0, 1].map(() => {
        const w = new Worker(new URL('./cubes-worker.js', import.meta.url), { type: 'module' });
        w.onmessage = (e) => this.receive(e.data);
        w.onerror = () => this.fallback();
        return w;
      });
    } catch {
      this.workers = null;
    }
  }

  fallback() {
    if (!this.workers) return;
    this.workers.forEach((w) => w.terminate());
    this.workers = null;
    for (const [id, w] of this.waiting) this.runInline(id, w.job);
  }

  workerFor(job) {
    return this.workers[job.kind === 'music' || job.kind === 'bank' ? 1 : 0];
  }

  // Drop cached results of a kind (e.g. cubes after a settings change).
  reset(kind) {
    this.gen++;
    for (const key of [...this.cache.keys()]) if (key.startsWith(`${kind}:`)) this.cache.delete(key);
  }

  get(key) {
    const c = this.cache.get(key);
    return c && c.done ? c.value : null;
  }

  forget(key) {
    this.cache.delete(key);
  }

  request(key, job) {
    const hit = this.cache.get(key);
    if (hit) return hit.promise;
    const id = this.nextId++;
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    promise.catch(() => {});
    const entry = { promise, done: false, value: null, gen: this.gen };
    this.cache.set(key, entry);
    this.waiting.set(id, { job, key, entry, resolve, reject });
    if (this.workers) this.workerFor(job).postMessage({ id, job });
    else setTimeout(() => this.runInline(id, job), 0);
    return promise;
  }

  runInline(id, job) {
    try {
      this.receive({ id, result: runJob(job).result });
    } catch (err) {
      this.receive({ id, error: String(err) });
    }
  }

  receive({ id, result, error }) {
    const w = this.waiting.get(id);
    if (!w) return;
    this.waiting.delete(id);
    if (error) {
      console.error(error);
      if (this.cache.get(w.key) === w.entry) this.cache.delete(w.key);
      w.reject(new Error(error));
      return;
    }
    w.entry.done = true;
    w.entry.value = result;
    w.resolve(result); // callers compare generations; a stale result is simply unused
  }
}
