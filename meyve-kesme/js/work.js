// Jobs that run off the main thread (or inline when workers are unavailable).
import { buildTimeline } from './timeline.js';
import { buildRoundCubes } from './cubes-data.js';
import { surfaceNets } from './mesher.js';
import { itemById } from './catalog/index.js';
import { shapeOf } from './object-info.js';
import { renderMusic } from './music.js';
import { eventBank } from './sfx.js';
import { encodeAac } from './aac-encoder.js';

const MESH_RES = 128;

export function runJob(job) {
  if (job.kind === 'cubes') {
    const tl = buildTimeline(job.params);
    const round = tl.rounds[job.index];
    const data = buildRoundCubes(round, { budget: job.budget, seed: 1 });
    const transfer = [data.home.buffer, data.size.buffer, data.rest.buffer, data.motion.buffer, data.rot.buffer];
    return { result: data, transfer };
  }
  if (job.kind === 'mesh') {
    const item = itemById(job.id);
    const [min, max] = item.bounds || [[-1.6, -1.4, -1.6], [1.6, 1.6, 1.6]];
    const mesh = surfaceNets(shapeOf(item).sdf, { min, max }, MESH_RES);
    return { result: mesh, transfer: [mesh.positions.buffer, mesh.normals.buffer, mesh.index.buffer] };
  }
  if (job.kind === 'music') {
    const m = renderMusic(job);
    return { result: m, transfer: [m.left.buffer, m.right.buffer] };
  }
  if (job.kind === 'bank') {
    const src = eventBank(job.profile);
    const bank = {};
    const transfer = [];
    for (const [name, list] of Object.entries(src)) {
      bank[name] = list.map((a) => a.slice());
      transfer.push(...bank[name].map((a) => a.buffer));
    }
    return { result: bank, transfer };
  }
  if (job.kind === 'aac') {
    // Frames go back as one byte array plus their sizes (two transfers, not thousands).
    const { frames, config, sampleRate, frameSize } = encodeAac(job);
    const sizes = Uint32Array.from(frames, (f) => f.length);
    const bytes = new Uint8Array(sizes.reduce((s, n) => s + n, 0));
    let at = 0;
    for (const f of frames) {
      bytes.set(f, at);
      at += f.length;
    }
    return { result: { bytes, sizes, config, sampleRate, frameSize }, transfer: [bytes.buffer, sizes.buffer] };
  }
  throw new Error(`unknown job ${job.kind}`);
}
