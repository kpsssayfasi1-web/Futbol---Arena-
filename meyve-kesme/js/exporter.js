// Frame-by-frame MP4 export with WebCodecs: every frame is rendered at the exact
// time, so the file is perfectly smooth even on slow devices.
const VIDEO_CODECS = [
  { codec: 'avc1.640034', muxer: 'avc' },
  { codec: 'avc1.4d0034', muxer: 'avc' },
  { codec: 'avc1.42003e', muxer: 'avc' },
  { codec: 'vp09.00.50.08', muxer: 'vp9' },
  { codec: 'av01.0.12M.08', muxer: 'av1' },
];
const AUDIO_CODECS = [
  { codec: 'mp4a.40.2', muxer: 'aac' },
  { codec: 'opus', muxer: 'opus' },
];

export function canExport() {
  return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';
}

async function pickVideo(width, height, fps) {
  for (const c of VIDEO_CODECS) {
    const config = { codec: c.codec, width, height, bitrate: 24_000_000, framerate: fps };
    if (c.muxer === 'avc') config.avc = { format: 'avc' };
    try {
      const res = await VideoEncoder.isConfigSupported(config);
      if (res.supported) return { config, muxer: c.muxer };
    } catch {
      /* try next */
    }
  }
  return null;
}

async function pickAudio(sampleRate) {
  if (typeof AudioEncoder === 'undefined') return null;
  for (const c of AUDIO_CODECS) {
    const config = { codec: c.codec, sampleRate, numberOfChannels: 2, bitrate: 192_000 };
    try {
      const res = await AudioEncoder.isConfigSupported(config);
      if (res.supported) return { config, muxer: c.muxer };
    } catch {
      /* try next */
    }
  }
  return null;
}

const yieldToUi = () => new Promise((r) => setTimeout(r, 0));

async function encodeAudio(muxer, audio, buffer) {
  const enc = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: (e) => console.error(e) });
  enc.configure(audio.config);
  const frames = 2048;
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(buffer.numberOfChannels > 1 ? 1 : 0);
  for (let off = 0; off < buffer.length; off += frames) {
    const n = Math.min(frames, buffer.length - off);
    const planar = new Float32Array(n * 2);
    planar.set(left.subarray(off, off + n), 0);
    planar.set(right.subarray(off, off + n), n);
    const data = new AudioData({ format: 'f32-planar', sampleRate: buffer.sampleRate, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((off / buffer.sampleRate) * 1e6), data: planar });
    enc.encode(data);
    data.close();
  }
  await enc.flush();
  enc.close();
}

// renderFrame(t) must draw the frame and return the canvas synchronously.
export async function exportMp4({ width, height, fps, duration, renderFrame, prepare, audioBuffer, onProgress, isCancelled }) {
  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
  const video = await pickVideo(width, height, fps);
  if (!video) throw new Error('Bu tarayıcı video kodlamayı desteklemiyor');
  const audio = audioBuffer ? await pickAudio(audioBuffer.sampleRate) : null;
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: video.muxer, width, height, frameRate: fps },
    audio: audio ? { codec: audio.muxer, numberOfChannels: 2, sampleRate: audioBuffer.sampleRate } : undefined,
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });
  let failure = null;
  const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => (failure = e) });
  enc.configure(video.config);
  const total = Math.ceil(duration * fps);
  for (let i = 0; i < total; i++) {
    if (failure) throw failure;
    if (isCancelled?.()) {
      enc.close();
      return null;
    }
    const t = i / fps;
    if (prepare) await prepare(t);
    const canvas = renderFrame(t);
    const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
    enc.encode(frame, { keyFrame: i % (fps * 2) === 0 });
    frame.close();
    while (enc.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 4));
    if (i % 3 === 0) {
      onProgress?.(i / total);
      await yieldToUi();
    }
  }
  await enc.flush();
  enc.close();
  if (audio) await encodeAudio(muxer, audio, audioBuffer);
  muxer.finalize();
  onProgress?.(1);
  return { blob: new Blob([muxer.target.buffer], { type: 'video/mp4' }), codec: video.config.codec, audio: audio?.config.codec || null };
}
