"""Ezel açılışını (0-17.3 sn) üretir: görüntü + seslendirme + müzik + efekt + altyazı.

Kullanım:  python acilis.py [cikti.mp4] [--kareler 0.5,3.0,...]   (--kareler: sadece önizleme kareleri)
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[2] / "araclar"))
sys.path.insert(0, str(HERE))

import ses  # noqa: E402
from altyazi import CaptionRenderer, chunk_words  # noqa: E402
from gorsel import FPS, H, W, Finisher, to_bytes  # noqa: E402
from hizala import normalize  # noqa: E402
from acilis_sahneler import ShotA1, ShotA2, ShotA3, ShotA4, ShotA5  # noqa: E402

EP = HERE.parent
VO_OFFSET = 0.35  # açılış patlaması sesten önce gelsin
WORDS = [{**w, "start": w["start"] + VO_OFFSET, "end": w["end"] + VO_OFFSET}
         for w in json.load(open(HERE / "kelimeler.json", encoding="utf-8"))]


def word_at(prefix: str, after: float = 0.0) -> dict:
    p = normalize(prefix)
    return next(w for w in WORDS if w["start"] >= after and normalize(w["text"]).startswith(p))


# --- zamanlama (seslendirmeden) ----------------------------------------------------------------
T_A2 = word_at("ama")["start"] - 0.12
T_SHATTER = word_at("değiştirip")["start"]
T_A3 = word_at("onu", 5.0)["start"] - 0.16
T_FOCUS = word_at("mahvedenlerden")["start"]
T_A4 = word_at("kim")["start"] - 0.15
REVEALS = [word_at("yakın")["start"], word_at("arkadaşı")["start"], word_at("evlenmek")["start"]]
T_HIT = word_at("kız")["end"] + 0.22
T_A5 = T_HIT - 0.12
T_FADE = word_at("anlatayım")["end"] + 0.3
T_END = T_FADE + 0.65
CUTS = [(0.0, "a1"), (T_A2, "a2"), (T_A3, "a3"), (T_A4, "a4"), (T_A5, "a5")]


def shot_name(t: float) -> str:
    name = CUTS[0][1]
    for start, n in CUTS:
        if t >= start:
            name = n
    return name


def build_shots():
    return {"a1": ShotA1(T_A2), "a2": ShotA2(T_A2, T_SHATTER, T_A3), "a3": ShotA3(T_A3, T_FOCUS, T_A4),
            "a4": ShotA4(T_A4, REVEALS, T_A5), "a5": ShotA5(T_A5, T_HIT, T_FADE, T_END)}


CAPTION_Y = {"a4": 1330}


# --- ses ----------------------------------------------------------------------------------------------
def build_sfx_music() -> np.ndarray:
    tl = ses.Timeline(T_END + 3)
    tl.put(ses.boom(1.8), 0.0, -10)
    tl.put(ses.tinnitus(2.4), 0.05, -28)
    tl.put(ses.bulb_buzz(T_A2), 0.0, -32)
    for t in (0.95, 1.52, 1.60):
        tl.put(ses.crack_snap(), t, -30, 0.1)
    tl.put(ses.whoosh(0.5), T_A2 - 0.2, -22)
    stress = ses.glass_stress(T_SHATTER - T_A2 - 0.15)
    tl.put(stress, T_A2 + 0.15, -19, 0.3)
    for k, t in enumerate(np.linspace(T_A2 + 0.5, T_SHATTER - 0.2, 4)):
        tl.put(ses.crack_snap(), float(t), -21 + 2 * k, 0.25)
    tl.put(ses.reverse_swell(0.5), T_SHATTER - 0.5, -22)
    tl.put(ses.reverb(ses.shatter(1.8), 1.6, 0.25), T_SHATTER, -11)
    tl.put(ses.boom(2.0), T_SHATTER, -15)
    tl.put(ses.reverb(ses.piano_note(45, 4) + ses.piano_note(57, 4) * 0.7, 2.6, 0.35), T_SHATTER + 0.05, -16)
    tl.put(ses.whoosh(0.6, 400, 2500), T_A3 - 0.3, -22)
    rain_l, rain_r = ses.rain(T_A4 - T_A3 + 0.3), ses.rain(T_A4 - T_A3 + 0.3)
    tl.put_stereo(rain_l, rain_r, T_A3, -23)
    tl.put(ses.muffled_party(T_A4 - T_A3), T_A3, -32, -0.2)
    for midi, t in ((57, T_A3 + 0.2), (60, T_A3 + 1.0), (59, T_A3 + 1.8)):
        tl.put(ses.reverb(ses.piano_note(midi, 3.5, 0.8), 2.4, 0.4), t, -22)
    tl.put(ses.riser(T_HIT - T_A3 - 0.4), T_A3 + 0.4, -25)
    tl.put(ses.heartbeat(T_A5 - T_A4 + 0.2, 66), T_A4, -19)
    for (t, pan), midi in zip(zip(REVEALS, (-0.45, 0.0, 0.45)), (64, 62, 60)):
        tl.put(ses.switch_thunk(), t, -17, pan)
        tl.put(ses.reverb(ses.wood_clack(), 1.2, 0.3), t + 0.04, -16, pan)
        tl.put(ses.reverb(ses.piano_note(midi, 3, 0.7), 2.2, 0.4), t + 0.05, -24, pan)
    tl.put(ses.reverse_swell(1.1), T_HIT - 1.1, -16)
    tl.put(ses.boom(2.5), T_HIT, -4)
    chord = sum(ses.piano_note(m, 4, v) for m, v in ((33, 1.0), (45, 0.9), (52, 0.7), (60, 0.55)))
    tl.put(ses.reverb(chord, 3.0, 0.4), T_HIT, -13)
    tl.put(ses.reverb(ses.wood_clack(), 2.0, 0.4), T_HIT, -10)
    for midi, t in ((57, T_HIT + 1.7), (60, T_HIT + 2.5), (64, T_HIT + 3.3)):
        tl.put(ses.reverb(ses.piano_note(midi, 4, 0.75), 2.8, 0.45), t, -24)
    drone = ses.drone(T_END + 2 - 2.2)
    env = np.clip(np.arange(len(drone)) / ses.SR / 2.0, 0, 1)
    tl.put(drone * env, 2.2, -30)
    tl.put(ses.drone(T_END - T_HIT + 2, (33, 45, 52)), T_HIT, -29)
    return tl.buf[: int(T_END * ses.SR)]


def load_voice() -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(EP / "ses" / "seslendirme.mp3"), "-t", str(T_END - VO_OFFSET),
                          "-ac", "1", "-ar", str(ses.SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    v = np.frombuffer(raw, np.float32).copy()
    out = np.zeros(int(T_END * ses.SR), np.float32)
    i = int(VO_OFFSET * ses.SR)
    n = min(len(v), len(out) - i)
    out[i:i + n] = v[:n] * 2.0  # +6 dB
    return out


def write_mix(path: Path) -> None:
    import wave
    from scipy import signal
    voice = load_voice()
    bed = build_sfx_music()
    env = np.abs(voice)
    sos = signal.butter(2, 4, fs=ses.SR, output="sos")
    env = signal.sosfiltfilt(sos, env)
    duck = 1 - 0.65 * np.clip(env / (np.percentile(env, 90) + 1e-6), 0, 1)
    out = bed * duck[:, None] + voice[:, None]
    fade = np.clip((T_END - np.arange(len(out)) / ses.SR) / 0.6, 0, 1)
    out *= fade[:, None]
    out /= max(1.0, np.max(np.abs(out)) / 0.97)
    pcm = (out * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(ses.SR)
        w.writeframes(pcm.tobytes())


# --- görüntü --------------------------------------------------------------------------------------------
def render_frame(shots, fin, captions, chunks, i: int) -> np.ndarray:
    t = i / FPS
    name = shot_name(t)
    frame = shots[name].render(t)
    frame = fin.boil(np.clip(frame, 0, 1.5), i)
    frame = fin.finish(frame, i)
    return captions.draw(frame, chunks, t, CAPTION_Y.get(name))


def main():
    args = sys.argv[1:]
    out = Path(args[0]) if args and not args[0].startswith("--") else HERE / "cikti" / "ezel_acilis.mp4"
    out.parent.mkdir(parents=True, exist_ok=True)
    shots, fin = build_shots(), Finisher()
    captions = CaptionRenderer("/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf", 88, 1270, max_width=1000)
    chunks = chunk_words([w for w in WORDS if w["start"] < T_FADE])
    print(f"kırılma {T_SHATTER:.2f}  A3 {T_A3:.2f}  A4 {T_A4:.2f}  açılış {REVEALS}  başlık {T_HIT:.2f}")
    if "--kareler" in args:
        from PIL import Image
        times = [float(x) for x in args[args.index("--kareler") + 1].split(",")]
        for t in times:
            img = render_frame(shots, fin, captions, chunks, int(round(t * FPS)))
            Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).save(out.parent / f"kare_{t:05.2f}.jpg", quality=90)
        print("önizleme kareleri:", out.parent)
        return
    wav = out.with_suffix(".wav")
    write_mix(wav)
    cmd = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", str(wav), "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-pix_fmt", "yuv420p",
           "-af", "loudnorm=I=-14:TP=-1.0:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-shortest",
           "-movflags", "+faststart", str(out)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(int(T_END * FPS)):
        proc.stdin.write(to_bytes(render_frame(shots, fin, captions, chunks, i)))
        if i % 60 == 0:
            print(f"  kare {i}/{int(T_END * FPS)}", flush=True)
    proc.stdin.close()
    proc.wait()
    print("bitti:", out)


if __name__ == "__main__":
    main()
