// Builds round cube data off the main thread.
import { buildTimeline } from './timeline.js';
import { buildRoundCubes } from './cubes-data.js';

self.onmessage = (e) => {
  const { gen, params, index, budget } = e.data;
  try {
    const tl = buildTimeline(params);
    const data = buildRoundCubes(tl.rounds[index], { budget, seed: 1 });
    const buffers = [data.home.buffer, data.size.buffer, data.rest.buffer, data.motion.buffer, data.rot.buffer];
    self.postMessage({ gen, index, data }, buffers);
  } catch (err) {
    self.postMessage({ gen, index, error: String(err && err.stack ? err.stack : err) });
  }
};
