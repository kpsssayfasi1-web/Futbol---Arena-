"""Zaman çizelgesi: replik zamanları, çekim listesi, ekran yazıları, efekt olayları ve altyazı.
Çıktı: film/zaman.json, kuzgun-feneri.srt
Kullanım: python3 zaman.py
"""
import json
import subprocess
from pathlib import Path

import numpy as np

ROOT = Path(__file__).parent
FPS = 24
LINES = json.load(open(ROOT / "replikler.json"))

# Replikten ÖNCEKİ boşluk (saniye). Varsayılan 0.35
GAP = {"02": 0.5, "03": 0.8, "04": 6.0, "05": 1.8, "09": 0.5, "10": 1.6, "11": 0.5, "13": 0.6,
       "16": 0.6, "17": 0.5, "18": -0.25, "19": 0.5, "22": 0.4, "23": 0.7, "24": 0.6, "25": 0.8,
       "27": 0.5, "28": 0.6, "29": 0.6, "30": 0.6, "31": 1.0, "32": 0.7, "33": 0.6, "34": 0.6,
       "35": 0.8, "36": 0.7, "37": 0.8, "38": 1.6, "39": 0.5, "40": 0.6, "43": 0.6, "44": 0.6,
       "45": 0.6, "46": 0.5, "47": 0.8, "48": 2.2, "49": 0.6, "50": 0.6, "51": 2.4, "52": 1.0,
       "53": 4.0, "55": 0.6, "56": 0.6, "57": 0.5, "58": 0.5, "59": 1.2, "60": 0.6, "61": 1.2}
END_CARD = 8.0

# Çekim listesi: replik -> [(replik içi saniye, set, parametreler)]
S = {
    "01": [(0, "void", {})],
    "02": [(0, "storm", {"era": 1987, "lit": 1, "ship": 1, "z": [1.0, 1.18]})],
    "03": [(0, "station_ext", {"cap": "14 KASIM · 02:40 · KUZEY EGE"}),
           (7.6, "storm", {"era": 0, "lit": 0, "cap": "KUZGUN FENERİ · 1987'DEN BERİ OTOMATİK", "z": [1.15, 1.4]}),
           (13.6, "photo", {"cap": "HASAN KAYA · 1919 – 1987"}),
           (17.6, "radio", {"mode": "mic"})],
    "gap04": [(0, "title", {})],
    "04": [(0, "station_int", {"shot": "wide"}), (6.6, "deniz", {"expr": "calm", "look": [0.5, 0.1]}),
           (12.5, "window", {}), (17.7, "phone", {"ring": 1})],
    "05": [(0, "deniz", {"expr": "listen", "phone": 1})],
    "06": [(0, "deniz", {"expr": "smile", "phone": 1})],
    "07": [(0, "deniz", {"expr": "listen", "phone": 1}), (6.0, "whistle", {})],
    "08": [(0, "deniz", {"expr": "smile", "phone": 1})],
    "09": [(0, "whistle", {"hand": 1}), (7.7, "deniz", {"expr": "smile"}), (11.7, "radar", {}),
           (21.8, "radio", {"mode": "static"})],
    "10": [(0, "radio", {"mode": "live", "chapter": "I · ÇAĞRI"})],
    "11": [(0, "deniz", {"expr": "surprised", "headset": 1})],
    "12": [(0, "lantern", {"expr": "shout"})],
    "13": [(0, "radar", {}), (4.0, "monitor", {"mode": "registry"})],
    "14": [(0, "deniz", {"expr": "cautious", "headset": 1})],
    "15": [(0, "lantern", {"expr": "angry"})],
    "16": [(0, "deniz", {"expr": "hesitant", "headset": 1}), (8.9, "storm", {"era": 1987, "lit": 1, "ship": 1, "z": [1.3, 1.5]}),
           (17.3, "station_int", {"shot": "wide", "door": 1}), (22.1, "enes", {"expr": "stern", "chapter": "II · KOMUTAN"})],
    "17": [(0, "station_int", {"shot": "two"})],
    "18": [(0, "radio", {"mode": "live"})],
    "19": [(0, "enes", {"expr": "frozen"})],
    "20": [(0, "enes", {"expr": "shock"})],
    "21": [(0, "deniz", {"expr": "curious", "headset": 1})],
    "22": [(0, "enes", {"expr": "soft"}), (7.2, "photo", {}), (9.8, "storm", {"era": 1987, "lit": 1, "rowboat": 1, "z": [1.1, 1.25]}),
           (18.2, "enes", {"expr": "soft"})],
    "23": [(0, "calendar", {})],
    "24": [(0, "enes", {"expr": "sad"}), (10.4, "radio", {"mode": "broken"}), (14.5, "enes", {"expr": "sad", "tears": 0.6})],
    "25": [(0, "station_int", {"shot": "two"}), (5.5, "deniz", {"expr": "determined", "headset": 1})],
    "26": [(0, "deniz", {"expr": "cautious", "headset": 1})],
    "27": [(0, "lantern", {"expr": "shout", "flicker": 1})],
    "28": [(0, "window", {"flicker": 6.8}), (9.0, "deniz", {"expr": "shock", "headset": 1}),
           (15.4, "monitor", {"mode": "report", "chapter": "III · RAPOR"})],
    "29": [(0, "enes", {"expr": "whisper"})],
    "30": [(0, "deniz", {"expr": "realize", "headset": 1, "z": [1.0, 1.35]})],
    "31": [(0, "storm", {"era": 1987, "lit": 1, "wreck": 1, "z": [1.2, 1.35]})],
    "32": [(0, "monitor", {"mode": "report", "hl": "cave", "chapter": "IV · SEÇİM"}), (7.2, "monitor", {"mode": "report", "hl": "body"}),
           (10.5, "deniz", {"expr": "dilemma", "headset": 1})],
    "33": [(0, "deniz", {"expr": "tremble", "headset": 1, "tears": 0.4})],
    "34": [(0, "enes", {"expr": "soft"})],
    "35": [(0, "deniz", {"expr": "cry", "headset": 1, "tears": 1})],
    "36": [(0, "lantern", {"expr": "soft"}), (9.1, "storm", {"era": 1987, "lit": 1, "rowboat": 1, "z": [1.2, 1.3]})],
    "37": [(0, "rowboat", {"chapter": "V · FIRTINA"}), (10.4, "station_int", {"shot": "two", "tense": 1})],
    "38": [(0, "cave", {"shot": "wide"})],
    "39": [(0, "station_int", {"shot": "two", "relief": 1})],
    "40": [(0, "cave", {"shot": "two", "give": 1})],
    "41": [(0, "cave", {"shot": "girl"})],
    "42": [(0, "cave", {"shot": "two"})],
    "43": [(0, "whistle", {"hand": 1})],
    "44": [(0, "cave", {"shot": "hasan"})],
    "45": [(0, "monitor", {"mode": "report", "hl": "body"}), (4.9, "rocks", {"empty": 1})],
    "46": [(0, "deniz", {"expr": "cry", "headset": 1, "tears": 1})],
    "47": [(0, "radio", {"mode": "silent"})],
    "48": [(0, "cave", {"shot": "hasan", "calm": 1}), (9.6, "cave", {"shot": "two"})],
    "49": [(0, "deniz", {"expr": "cry", "headset": 1, "tears": 1})],
    "50": [(0, "cave", {"shot": "girl"}), (5.3, "rocks", {"climb": 1})],
    "51": [(0, "radio", {"mode": "dead"}), (5.0, "rocks", {"flare": 1, "boat": 1})],
    "52": [(0, "enes", {"expr": "tears", "tears": 1})],
    "53": [(0, "home", {"shot": "wide", "chapter": "VI · ŞAFAK"})],
    "54": [(0, "home", {"shot": "two"})],
    "55": [(0, "nur", {"expr": "silent"})],
    "56": [(0, "nur", {"expr": "sad"}), (11.4, "whistle", {"dawn": 1})],
    "57": [(0, "whistle", {"dawn": 1, "finger": 1})],
    "58": [(0, "nur", {"expr": "tremble"}), (16.7, "deniz", {"expr": "shock", "dawn": 1})],
    "59": [(0, "deniz", {"expr": "shock", "dawn": 1, "tears": 0.5})],
    "60": [(0, "nur", {"expr": "cry", "tears": 1})],
    "61": [(0, "home", {"shot": "two", "hug": 1}), (4.9, "whistle", {"dawn": 1}),
           (7.3, "storm", {"era": 0, "lit": 0, "calm": 1, "z": [1.0, 1.2]}),
           (13.3, "radio", {"mode": "flicker"}), (19.6, "station_ext", {"lateLight": 1})],
    "end": [(0, "end", {})],
}

SPEAKER_CHAR = {"DENİZ": "deniz", "ENES": "enes", "HASAN": "hasan", "NUR": "nur", "KÜÇÜK NUR": "kucukNur"}


def duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=True).stdout
    return float(out)


def envelope(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", "24000", "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    a = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768
    hop = 24000 // FPS
    n = len(a) // hop
    rms = np.sqrt(np.mean(a[: n * hop].reshape(n, hop) ** 2, axis=1))
    rms = rms / (np.percentile(rms, 95) + 1e-6)
    return [round(float(min(v, 1.5)), 3) for v in rms]


def build():
    t = 1.0
    lines, shots = [], []
    for ln in LINES:
        lid = ln["id"]
        gap = GAP.get(lid, 0.35)
        if f"gap{lid}" in S:
            for off, name, p in S[f"gap{lid}"]:
                shots.append({"t0": round(t + off, 3), "set": name, "p": p, "line": None})
        t += gap
        path = ROOT / "ses" / "ham" / f"{lid}.mp3"
        dur = duration(path)
        lines.append({"id": lid, "speaker": ln["speaker"], "who": SPEAKER_CHAR.get(ln["speaker"]),
                      "start": round(t, 3), "dur": round(dur, 3), "env": envelope(path), "text": ln["text"]})
        for off, name, p in S[lid]:
            shots.append({"t0": round(t + off, 3), "set": name, "p": p, "line": lid})
        t += dur
    t += 1.0
    shots.append({"t0": round(t, 3), "set": "end", "p": {}, "line": None})
    total = t + END_CARD
    for i, s in enumerate(shots):
        s["t1"] = shots[i + 1]["t0"] if i + 1 < len(shots) else total
    return {"fps": FPS, "total": round(total, 3), "lines": lines, "shots": shots}


def clean(text):
    import re
    return re.sub(r"\s+", " ", re.sub(r"\[[^\]]*\]", "", text)).strip()


def srt(tl):
    """Altyazı: her repliği ~70 karakterlik parçalara böler, süreyi karakter oranıyla dağıtır."""
    import re
    out, k = [], 1
    fmt = lambda s: f"{int(s // 3600):02d}:{int(s % 3600 // 60):02d}:{int(s % 60):02d},{int(s * 1000 % 1000):03d}"
    for ln in tl["lines"]:
        text = clean(ln["text"])
        parts = [p.strip() for p in re.split(r"(?<=[.!?…])\s+", text) if p.strip()]
        chunks, cur = [], ""
        for p in parts:
            if len(cur) + len(p) > 80 and cur:
                chunks.append(cur); cur = p
            else:
                cur = (cur + " " + p).strip()
        if cur:
            chunks.append(cur)
        total = sum(len(c) for c in chunks)
        t = ln["start"]
        for c in chunks:
            d = ln["dur"] * len(c) / total
            out.append(f"{k}\n{fmt(t)} --> {fmt(t + d - 0.05)}\n{c}\n")
            k += 1
            t += d
    return "\n".join(out)


if __name__ == "__main__":
    tl = build()
    (ROOT / "film").mkdir(exist_ok=True)
    json.dump(tl, open(ROOT / "film" / "zaman.json", "w"), ensure_ascii=False)
    open(ROOT / "kuzgun-feneri.srt", "w").write(srt(tl))
    print(f"toplam: {tl['total']:.1f} sn ({tl['total'] / 60:.2f} dk), çekim: {len(tl['shots'])}")
