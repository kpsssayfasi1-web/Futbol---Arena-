// Frame-by-frame MP4 export: every frame is rendered at its exact time, so the
// file is perfectly smooth even on slow devices. Video goes through WebCodecs.
// The soundtrack arrives already encoded as AAC by our own encoder
// (aac-encoder.js), so it never depends on the browser's audio codecs: every
// device writes the same AAC track that phone galleries, QuickTime and
// YouTube play.
const VIDEO_CODECS = ['avc', 'vp9', 'av1'];
const VIDEO_BITRATE = 24_000_000;
const KEY_FRAME_SECONDS = 2;
const yieldToUi = () => new Promise((r) => setTimeout(r, 0));

export function canExport() {
  return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';
}

// aac: { bytes, sizes, config, sampleRate, frameSize } from the 'aac' worker job.
async function addAac(mb, source, aac) {
  const dur = aac.frameSize / aac.sampleRate;
  const meta = { decoderConfig: { codec: 'mp4a.40.2', sampleRate: aac.sampleRate, numberOfChannels: 2, description: aac.config } };
  let at = 0;
  for (let k = 0; k < aac.sizes.length; k++) {
    const data = aac.bytes.subarray(at, at + aac.sizes[k]);
    at += aac.sizes[k];
    await source.add(new mb.EncodedPacket(data, 'key', k * dur, dur), k === 0 ? meta : undefined);
  }
}

// renderFrame(t) must draw the frame and return the canvas synchronously.
export async function exportMp4({ width, height, fps, duration, renderFrame, prepare, aac, onProgress, onStatus, isCancelled }) {
  const mb = await import('mediabunny');
  const videoCodec = await mb.getFirstEncodableVideoCodec(VIDEO_CODECS, { width, height, bitrate: VIDEO_BITRATE, frameRate: fps });
  if (!videoCodec) throw new Error('Bu tarayıcı video kodlamayı desteklemiyor');

  const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new mb.BufferTarget() });
  const canvas = renderFrame(0);
  const video = new mb.CanvasSource(canvas, { codec: videoCodec, bitrate: VIDEO_BITRATE, keyFrameInterval: KEY_FRAME_SECONDS });
  output.addVideoTrack(video, { frameRate: fps });
  const audio = aac ? new mb.EncodedAudioPacketSource('aac') : null;
  if (audio) output.addAudioTrack(audio);
  await output.start();

  if (audio) {
    onStatus?.('Ses dosyaya yazılıyor…');
    await addAac(mb, audio, aac);
    audio.close();
  }

  onStatus?.('Kareler işleniyor…');
  const total = Math.ceil(duration * fps);
  for (let i = 0; i < total; i++) {
    if (isCancelled?.()) {
      await output.cancel();
      return null;
    }
    const t = i / fps;
    if (prepare) await prepare(t);
    renderFrame(t);
    await video.add(t, 1 / fps);
    if (i % 3 === 0) {
      onProgress?.(i / total);
      await yieldToUi();
    }
  }
  video.close();
  await output.finalize();
  onProgress?.(1);
  return { blob: new Blob([output.target.buffer], { type: 'video/mp4' }), codec: videoCodec, audio: aac ? 'aac' : null };
}
