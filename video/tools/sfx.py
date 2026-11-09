"""Kodla ses üretimi: fon müziği (gerilim drone) ve efektler.

ElevenLabs kredisi harcamadan, tamamen numpy ile sentezlenir.
Kullanım:  python3 tools/sfx.py <çıktı_klasörü>
"""

import sys
import wave
from pathlib import Path

import numpy as np

SR = 44100
RNG = np.random.default_rng(7)


# ---------- yardımcılar ----------

def t_axis(seconds):
    return np.arange(int(seconds * SR)) / SR


def noise(seconds):
    return RNG.uniform(-1, 1, int(seconds * SR))


def spectral_filter(x, low=0.0, high=SR / 2):
    """FFT ile yumuşak kenarlı bant geçiren filtre."""
    spec = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(len(x), 1 / SR)
    mask = 1 / (1 + (freqs / max(high, 1)) ** 4)
    if low > 0:
        mask *= 1 - 1 / (1 + (freqs / low) ** 4)
    return np.fft.irfft(spec * mask, len(x))


def sweep_filter(x, lows, highs, block=2048):
    """Zamanla değişen filtre: bloklara bölüp her bloğu ayrı filtreler."""
    hop = block // 2
    win = np.hanning(block)
    out = np.zeros(len(x) + block)
    padded = np.concatenate([x, np.zeros(block)])
    n_blocks = len(x) // hop + 1
    for i in range(n_blocks):
        start = i * hop
        frac = min(start / max(len(x) - 1, 1), 1.0)
        lo = np.interp(frac, np.linspace(0, 1, len(lows)), lows)
        hi = np.interp(frac, np.linspace(0, 1, len(highs)), highs)
        out[start:start + block] += spectral_filter(padded[start:start + block] * win, lo, hi)
    return out[:len(x)]


def reverb(x, seconds=2.0, mix=0.35, damp=3000):
    ir = spectral_filter(noise(seconds), high=damp) * np.exp(-t_axis(seconds) * (6 / seconds))
    ir /= np.abs(ir).sum() / 8
    n = len(x) + len(ir)
    wet = np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(ir, n), n)
    dry = np.concatenate([x, np.zeros(len(ir))])
    return dry * (1 - mix) + wet * mix


def normalize(x, peak=0.9):
    m = np.abs(x).max()
    return x if m == 0 else x / m * peak


def fade(x, fade_in=0.0, fade_out=0.0):
    y = x.copy()
    a, b = int(fade_in * SR), int(fade_out * SR)
    if a:
        y[:a] *= np.linspace(0, 1, a)
    if b:
        y[-b:] *= np.linspace(1, 0, b)
    return y


def save_wav(path, x):
    stereo = np.clip(x, -1, 1)
    if stereo.ndim == 1:
        stereo = np.stack([stereo, stereo], axis=1)
    data = (stereo * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes(data.tobytes())


# ---------- sesler ----------

def drone(seconds, root=36.71):
    """Karanlık gerilim fonu: alçak akor + rüzgâr + uzak ürkütücü tonlar."""
    t = t_axis(seconds)
    bed = np.zeros_like(t)
    for ratio, gain in [(1, 1.0), (1.5, 0.5), (2, 0.35), (2.4, 0.15)]:
        for detune in (-0.4, 0.4):
            f = root * ratio + detune
            for h in range(1, 6):
                bed += gain / h * np.sin(2 * np.pi * f * h * t + RNG.uniform(0, 6))
    bed = spectral_filter(bed, high=420) * (0.75 + 0.25 * np.sin(2 * np.pi * 0.07 * t))

    wind = sweep_filter(noise(seconds), [150, 300, 200, 350, 180], [500, 1100, 700, 1300, 600])
    wind *= 0.6 + 0.4 * np.sin(2 * np.pi * 0.11 * t + 1)

    eerie = np.zeros_like(t)
    for start in np.arange(2.0, seconds - 4, 6.5):
        seg = (t >= start) & (t < start + 4)
        tt = t[seg] - start
        env = np.sin(np.pi * tt / 4) ** 2
        eerie[seg] += env * (np.sin(2 * np.pi * 587.3 * tt) + 0.6 * np.sin(2 * np.pi * 622.3 * tt))
    eerie = reverb(eerie, 3.0, 0.6)[:len(t)]

    mix = normalize(bed) * 0.55 + normalize(wind) * 0.25 + normalize(eerie) * 0.12
    return fade(normalize(mix, 0.7), 2.0, 2.5)


def heartbeat(beats=6, bpm=68):
    period = 60 / bpm
    out = np.zeros(int((beats * period + 0.5) * SR))
    t = t_axis(0.25)
    for i in range(beats):
        for offset, gain in [(0.0, 1.0), (0.22, 0.7)]:
            f = 55 * np.exp(-t * 6)
            thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 18) * gain
            s = int((i * period + offset) * SR)
            out[s:s + len(thump)] += thump
    return normalize(spectral_filter(out, high=200))


def whoosh(seconds=0.9):
    t = t_axis(seconds)
    env = np.sin(np.pi * t / seconds) ** 3
    x = sweep_filter(noise(seconds), [200, 900, 300], [800, 4500, 900]) * env
    return normalize(reverb(x, 0.8, 0.25))


def impact(seconds=2.5):
    t = t_axis(seconds)
    f = 70 * np.exp(-t * 1.5) + 28
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    crack = spectral_filter(noise(seconds), 80, 2500) * np.exp(-t * 14)
    return normalize(reverb(boom + 0.5 * crack, 2.5, 0.3))


def riser(seconds=3.0):
    t = t_axis(seconds)
    swell = (t / seconds) ** 2.5
    tone = np.sin(2 * np.pi * np.cumsum(110 + 500 * (t / seconds) ** 2) / SR)
    hiss = sweep_filter(noise(seconds), [300, 2000], [1500, 9000])
    return normalize((0.4 * tone + hiss) * swell)


def knock(count=3, gap=0.28):
    out = np.zeros(int((count * gap + 0.6) * SR))
    t = t_axis(0.18)
    for i in range(count):
        body = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, d in [(110, 40), (190, 55), (420, 80)])
        tap = spectral_filter(noise(0.18), 300, 3500) * np.exp(-t * 120)
        s = int(i * gap * SR)
        out[s:s + len(t)] += (body + 0.6 * tap) * (1.0 if i < count - 1 else 1.15)
    return normalize(reverb(out, 0.6, 0.2, damp=2000))


def click():
    t = t_axis(0.12)
    x = spectral_filter(noise(0.12), 1500, 7000) * np.exp(-t * 300)
    x += 0.4 * np.sin(2 * np.pi * 2200 * t) * np.exp(-t * 200)
    return normalize(reverb(x, 0.4, 0.25))


def place(track, clip, at, gain=1.0):
    s = int(at * SR)
    e = min(len(track), s + len(clip))
    track[s:e] += clip[:e - s] * gain


def demo(seconds=22.0):
    """Örnek miks: fon + efektler bir sahne akışında."""
    mix = drone(seconds) * 0.8
    place(mix, whoosh(), 0.5, 0.6)
    place(mix, riser(), 3.2, 0.5)
    place(mix, impact(), 6.2, 0.9)
    place(mix, heartbeat(), 8.5, 0.8)
    place(mix, click(), 13.2, 0.7)
    place(mix, knock(), 15.0, 0.9)
    place(mix, knock(4, 0.22), 16.6, 1.0)
    place(mix, whoosh(), 19.0, 0.5)
    return normalize(mix, 0.85)


if __name__ == "__main__":
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "public/audio")
    out.mkdir(parents=True, exist_ok=True)
    clips = {
        "fon-gerilim": drone(90.0),
        "kalp-atisi": heartbeat(),
        "whoosh": whoosh(),
        "darbe": impact(),
        "yukselis": riser(),
        "kapi-vurma": knock(),
        "isik-klik": click(),
        "demo": demo(),
    }
    for name, clip in clips.items():
        save_wav(out / f"{name}.wav", clip)
        print(f"{name}.wav  {len(clip) / SR:.1f} sn")
