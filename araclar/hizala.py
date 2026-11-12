"""Senaryo kelimelerini Whisper kelime zamanlarıyla eşleştirir.

Altyazıda senaryodaki doğru yazım kullanılır; zamanlar Whisper'dan gelir.
Eşleşmeyen kelimelerin zamanı, komşu eşleşmeler arasında harf sayısına göre dağıtılır.
"""
import difflib
import json
import re
import sys

TR_LOWER = str.maketrans("İIÂÎÛ", "iıâîû")


def normalize(word: str) -> str:
    w = word.translate(TR_LOWER).lower()
    w = w.replace("â", "a").replace("î", "i").replace("û", "u")
    return re.sub(r"[^0-9a-zçğıöşü]", "", w)


def script_words(text: str) -> list[str]:
    text = re.sub(r"\[[^\]]+\]", " ", text)
    return [w for w in text.split() if normalize(w)]


def _fill_gap(result, lo, hi, t0, t1):
    """lo..hi aralığındaki zamansız kelimelere t0..t1 arasını harf sayısına göre böl."""
    lengths = [max(1, len(normalize(result[k]["text"]))) for k in range(lo, hi)]
    total = sum(lengths)
    t = t0
    for k, n in zip(range(lo, hi), lengths):
        d = (t1 - t0) * n / total
        result[k]["start"], result[k]["end"] = round(t, 3), round(t + d, 3)
        t += d


def align(script: list[str], whisper: list[dict]) -> list[dict]:
    a = [normalize(w) for w in script]
    b = [normalize(w["text"]) for w in whisper]
    result = [{"text": w, "start": None, "end": None} for w in script]
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            src = whisper[blk.b + k]
            result[blk.a + k]["start"], result[blk.a + k]["end"] = src["start"], src["end"]
    i = 0
    while i < len(result):
        if result[i]["start"] is not None:
            i += 1
            continue
        j = i
        while j < len(result) and result[j]["start"] is None:
            j += 1
        t0 = result[i - 1]["end"] if i > 0 else 0.0
        t1 = result[j]["start"] if j < len(result) else t0 + 0.35 * (j - i)
        _fill_gap(result, i, j, t0, t1)
        i = j
    return result


def main(script_path, whisper_path, out_path):
    script = script_words(open(script_path, encoding="utf-8").read())
    whisper = json.load(open(whisper_path, encoding="utf-8"))["words"]
    aligned = align(script, whisper)
    matched = sum(1 for s, w in zip(script, aligned) if w["start"] is not None)
    json.dump(aligned, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print(f"{len(script)} senaryo kelimesi, {matched} zamanlandı -> {out_path}")


if __name__ == "__main__":
    main(*sys.argv[1:4])


def detect_silences(audio_path: str, noise_db: int = -35, min_dur: float = 0.25) -> list[tuple[float, float]]:
    """ffmpeg silencedetect ile sessiz aralıkları döndürür."""
    import subprocess
    proc = subprocess.run(
        ["ffmpeg", "-i", audio_path, "-af", f"silencedetect=n={noise_db}dB:d={min_dur}", "-f", "null", "-"],
        capture_output=True, text=True, check=True)
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", proc.stderr)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", proc.stderr)]
    return list(zip(starts, ends))


def snap_to_silences(words: list[dict], silences: list[tuple[float, float]]) -> list[dict]:
    """Başlangıcı sessizliğin içine düşen kelimeyi sessizliğin sonuna, bitişi düşeni başına taşır."""
    out = []
    for w in words:
        s, e = w["start"], w["end"]
        for a, b in silences:
            if a < s < b:
                s = b
            if a < e < b:
                e = a
        out.append({**w, "start": round(s, 3), "end": round(max(e, s + 0.08), 3)})
    return out
