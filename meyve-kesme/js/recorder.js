// Live recording of the canvas (with sound) through MediaRecorder.
const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.640028,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

export function pickRecorderMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

export class LiveRecorder {
  start(canvas, audioStream, fps = 60) {
    const mimeType = pickRecorderMime();
    if (mimeType === null || !canvas.captureStream) throw new Error('MediaRecorder desteklenmiyor');
    const stream = canvas.captureStream(fps);
    if (audioStream) for (const track of audioStream.getAudioTracks()) stream.addTrack(track);
    this.chunks = [];
    this.mimeType = mimeType || 'video/webm';
    this.rec = new MediaRecorder(stream, { mimeType: mimeType || undefined, videoBitsPerSecond: 24_000_000, audioBitsPerSecond: 192_000 });
    this.rec.ondataavailable = (e) => {
      if (e.data && e.data.size) this.chunks.push(e.data);
    };
    this.rec.start(500);
  }

  get active() {
    return !!this.rec && this.rec.state === 'recording';
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.rec) return resolve(null);
      this.rec.onstop = () => resolve(new Blob(this.chunks, { type: this.mimeType.split(';')[0] }));
      this.rec.stop();
    });
  }
}

const HOST_UNAVAILABLE = new Set(['unavailable', 'not_granted', 'capability_disabled', 'capability_removed']);

// Inside the Claude viewer, files go through its "downloads" capability (the
// viewer confirms the save); everywhere else a normal browser download.
export async function saveFile(blob, name) {
  const host = window.claude?.use ? await window.claude.use('downloads').catch(() => null) : null;
  if (host) {
    try {
      await host.save({ filename: name, data: blob });
      return 'saved';
    } catch (err) {
      if (err?.code === 'declined') return 'declined';
      if (!HOST_UNAVAILABLE.has(err?.code)) throw new Error(err?.message || String(err));
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'saved';
}
