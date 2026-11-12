import json, sys, time, subprocess
import numpy as np
from faster_whisper import WhisperModel
audio, out = sys.argv[1], sys.argv[2]
t0 = time.time()
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", audio, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                     check=True, capture_output=True).stdout
pcm = np.frombuffer(raw, dtype=np.float32)
model = WhisperModel("small", device="cpu", compute_type="int8")
segs, info = model.transcribe(pcm, language="tr", word_timestamps=True, beam_size=5, vad_filter=False)
words = []
for s in segs:
    for w in s.words:
        words.append({"text": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3), "p": round(w.probability, 3)})
json.dump({"words": words, "duration": len(pcm) / 16000}, open(out, "w"), ensure_ascii=False, indent=0)
print("ok", len(words), "kelime", round(time.time() - t0, 1), "sn")
