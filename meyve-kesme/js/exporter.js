// Frame-by-frame MP4 export: every frame is rendered at its exact time, so the
// file is perfectly smooth even on slow devices. Video goes through WebCodecs;
// the soundtrack is always AAC (what phones, QuickTime and YouTube expect). When
// the browser has no AAC encoder of its own (Linux Chrome, iOS WebViews, older
// Safari), a WebAssembly AAC encoder is loaded instead.
const VIDEO_CODECS = ['avc', 'vp9', 'av1'];
const VIDEO_BITRATE = 24_000_000;
const AUDIO_BITRATE = 192_000;
const KEY_FRAME_SECONDS = 2;
const PROBE_SECONDS = 0.1;
const yieldToUi = () => new Promise((r) => setTimeout(r, 0));

export function canExport() {
  return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';
}

let wasmAac = null;
function loadWasmAac() {
  wasmAac ??= import('@mediabunny/aac-encoder').then(({ registerAacEncoder }) => registerAacEncoder());
  return wasmAac;
}

// Encodes a moment of silence with `codec` into a throwaway file: an encoder
// that reports support but cannot run (blocked worker, broken platform codec)
// fails here instead of halfway through a long export.
async function audioCodecWorks(mb, codec, sampleRate) {
  try {
    if (!(await mb.canEncodeAudio(codec, { numberOfChannels: 2, sampleRate, bitrate: AUDIO_BITRATE }))) return false;
    const output = new mb.Output({ format: new mb.Mp4OutputFormat(), target: new mb.BufferTarget() });
    const source = new mb.AudioBufferSource({ codec, bitrate: AUDIO_BITRATE });
    output.addAudioTrack(source);
    await output.start();
    await source.add(new AudioBuffer({ length: Math.round(sampleRate * PROBE_SECONDS), numberOfChannels: 2, sampleRate }));
    await output.finalize();
    return output.target.buffer.byteLength > 0;
  } catch (err) {
    console.warn(`audio codec ${codec} unusable`, err);
    return false;
  }
}

// AAC (native, then WebAssembly), then Opus as a last resort; null = no audio encoder at all.
async function pickAudioCodec(mb, sampleRate) {
  if (await audioCodecWorks(mb, 'aac', sampleRate)) return 'aac';
  try {
    await loadWasmAac();
    if (await audioCodecWorks(mb, 'aac', sampleRate)) return 'aac';
  } catch (err) {
    console.warn('WebAssembly AAC encoder could not be loaded', err);
  }
  return (await audioCodecWorks(mb, 'opus', sampleRate)) ? 'opus' : null;
}

// renderFrame(t) must draw the frame and return the canvas synchronously.
export async function exportMp4({ width, height, fps, duration, renderFrame, prepare, audioBuffer, onProgress, onStatus, isCancelled }) {
  const mb = await import('mediabunny');
  const videoCodec = await mb.getFirstEncodableVideoCodec(VIDEO_CODECS, { width, height, bitrate: VIDEO_BITRATE, frameRate: fps });
  if (!videoCodec) throw new Error('Bu tarayıcı video kodlamayı desteklemiyor');
  let audioCodec = null;
  if (audioBuffer) {
    onStatus?.('Ses kodlayıcı hazırlanıyor…');
    audioCodec = await pickAudioCodec(mb, audioBuffer.sampleRate);
  }

  const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new mb.BufferTarget() });
  const canvas = renderFrame(0);
  const video = new mb.CanvasSource(canvas, { codec: videoCodec, bitrate: VIDEO_BITRATE, keyFrameInterval: KEY_FRAME_SECONDS });
  output.addVideoTrack(video, { frameRate: fps });
  const audio = audioCodec ? new mb.AudioBufferSource({ codec: audioCodec, bitrate: AUDIO_BITRATE }) : null;
  if (audio) output.addAudioTrack(audio);
  await output.start();

  // The whole soundtrack goes in first: it is small, and an encoder failure
  // then surfaces before any frame has been rendered.
  if (audio) {
    onStatus?.('Ses kodlanıyor…');
    await audio.add(audioBuffer);
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
  return { blob: new Blob([output.target.buffer], { type: 'video/mp4' }), codec: videoCodec, audio: audioCodec };
}
