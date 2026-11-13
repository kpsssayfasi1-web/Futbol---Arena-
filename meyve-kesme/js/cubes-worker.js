// Worker entry: runs jobs from work.js and transfers the typed arrays back.
import { runJob } from './work.js';

self.onmessage = (e) => {
  const { id, job } = e.data;
  try {
    const { result, transfer } = runJob(job);
    self.postMessage({ id, result }, transfer);
  } catch (err) {
    self.postMessage({ id, error: String(err && err.stack ? err.stack : err) });
  }
};
