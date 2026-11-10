"""Demo videoları için sentetik ses tasarımı (yalnızca numpy).

Kullanım: python3 ses_tasarimi.py <a|b> <cikti.wav>
Sahne zamanlamaları sahne-a.html / sahne-b.html ile aynıdır.
"""
import sys
import wave

import numpy as np

SR = 48000
rand = np.random.default_rng(17)

SCENES = {
    "a": {
        "dur": 8.5, "tick": 3.4, "spin": 3.45, "title": 5.9,
        "flicker": [(3.33, 3.95), (5.45, 5.75)],
        "drips": [1.9, 3.6, 5.3, 7.0, 3.2, 5.5, 7.8, 4.5, 7.4],
        "clock": [1.0, 2.0, 3.0],
        "whoosh": [(0.2, 2.6, 0.25), (4.5, 6.6, 0.6)],
    },
    "b": {
        "dur": 9.0, "tick": 4.6, "spin": 4.65, "title": 6.55,
        "flicker": [(4.55, 5.2), (6.0, 6.25)],
        "drips": [1.3, 2.9, 6.8, 5.6, 7.9],
        "clock": [1.0, 2.0, 3.0, 4.0],
        "whoosh": [(3.2, 4.5, 0.35), (4.6, 7.0, 0.6)],
    },
}


def band(x, lo, hi):
    """FFT ile bant geçiren filtre (yumuşak kenarlı)."""
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    mask = np.clip((f - lo * 0.8) / (lo * 0.2 + 1e-9), 0, 1) if lo > 0 else np.ones_like(f)
    mask *= np.clip((hi * 1.25 - f) / (hi * 0.25), 0, 1)
    return np.fft.irfft(spec * mask, len(x))


def env_at(n, t0, attack, decay):
    t = np.arange(n) / SR - t0
    e = np.where(t < 0, 0, np.where(t < attack, t / max(attack, 1e-6), np.exp(-(t - attack) / decay)))
    return e


def reverb(x, seconds=1.4, mix=0.25):
    n = int(seconds * SR)
    ir = rand.standard_normal(n) * np.exp(-np.arange(n) / (SR * seconds / 6))
    ir = band(ir, 200, 6000)
    ir /= np.sqrt(np.sum(ir ** 2))
    size = len(x) + n
    wet = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)]
    return x * (1 - mix) + wet * mix


def flicker_curve(t, bursts):
    c = np.zeros_like(t)
    for a, b in bursts:
        inside = (t >= a) & (t <= b)
        c[inside] = np.sin((t[inside] - a) / (b - a) * np.pi)
    return c


def build(s):
    n = int(s["dur"] * SR)
    t = np.arange(n) / SR
    L = np.zeros(n)
    R = np.zeros(n)

    def add(sig, gain=1.0, pan=0.0):
        nonlocal L, R
        L += sig * gain * np.sqrt((1 - pan) / 2)
        R += sig * gain * np.sqrt((1 + pan) / 2)

    # Oda tonu: kahverengi gürültü, iki kanal ayrı
    for pan in (-0.8, 0.8):
        brown = np.cumsum(rand.standard_normal(n))
        brown -= np.convolve(brown, np.ones(4801) / 4801, mode="same")
        add(band(brown, 30, 900) / 900, 0.16, pan)

    # Derin drone: yavaş kabaran
    swell = 0.5 + 0.5 * np.clip((t - s["spin"]) / 3, 0, 1)
    drone = (np.sin(2 * np.pi * 55 * t) + 0.6 * np.sin(2 * np.pi * 55.4 * t + 1)
             + 0.35 * np.sin(2 * np.pi * 82.4 * t) + 0.2 * np.sin(2 * np.pi * 110.7 * t))
    add(drone * swell * (0.9 + 0.1 * np.sin(2 * np.pi * 0.2 * t)), 0.05)

    # Ampul vızıltısı (100 Hz şebeke) + titreşimde cızırtı
    fl = flicker_curve(t, s["flicker"])
    hum = sum(np.sin(2 * np.pi * 100 * k * t) / k for k in range(1, 6))
    add(hum * (0.018 + 0.05 * fl), 1.0, 0.2)
    sparks = (rand.random(n) < 0.0004 + 0.004 * fl).astype(float)
    sparks = np.convolve(sparks, np.exp(-np.arange(240) / 40), mode="full")[:n]
    add(band(rand.standard_normal(n), 1500, 9000) * np.clip(sparks, 0, 1) * fl, 0.45, 0.2)

    # Saat tıkırtıları ve 03:17 anındaki "klonk"
    for ct in s["clock"]:
        click = band(rand.standard_normal(n), 1500, 7000) * env_at(n, ct, 0.0005, 0.006)
        add(click, 0.25, -0.3)
    k = s["tick"]
    clunk = np.sin(2 * np.pi * 140 * (t - k)) * env_at(n, k, 0.002, 0.09)
    clunk += band(rand.standard_normal(n), 300, 3000) * env_at(n, k, 0.001, 0.03)
    add(clunk, 0.5)

    # Sayaç: hızlanan tık dizisi + vınlama + borudaki su akışı
    sp = np.clip((t - s["spin"]) / 1.5, 0, 1) ** 3
    rate = 3 + sp * 55
    phase = np.cumsum(rate) / SR
    ticks = (np.diff(np.floor(phase), prepend=0) > 0).astype(float)
    tickbuf = np.convolve(ticks, np.exp(-np.arange(400) / 50) * np.sin(np.arange(400) * 0.33), mode="full")[:n]
    add(tickbuf * (t > s["spin"]) * (0.4 + 0.6 * sp), 0.22, 0.35)
    whine_f = 120 + 600 * sp
    whine_phase = 2 * np.pi * np.cumsum(whine_f) / SR
    whine = np.sin(whine_phase) + 0.4 * np.sin(2 * whine_phase) + 0.2 * np.sin(3.01 * whine_phase)
    add(whine * sp * 0.035, 1.0, 0.35)
    water = band(rand.standard_normal(n), 250, 2500) * (0.2 + 0.8 * sp) * (t > s["spin"])
    add(water, 0.05, 0.3)

    # Damlalar: perdesi düşen kısa ton
    for dt in s["drips"]:
        if dt >= s["dur"]:
            continue
        tt = np.clip(t - dt, 0, None)
        f = 900 + 1100 * np.exp(-tt * 60)
        ph = 2 * np.pi * np.cumsum(f) / SR
        drop = np.sin(ph) * env_at(n, dt, 0.001, 0.035)
        add(drop, 0.3, rand.uniform(-0.6, 0.6))

    # Kamera hareketlerinde "whoosh"
    for a, b, g in s["whoosh"]:
        shape = np.clip((t - a) / (b - a), 0, 1)
        shape = np.sin(shape * np.pi) ** 2
        add(band(rand.standard_normal(n), 300, 3000) * shape, 0.06 * g)

    # Başlık: ters kabarma + alt frekans vuruşu
    T = s["title"] + 0.1
    rise = np.clip((t - (T - 0.7)) / 0.7, 0, 1) ** 3 * (t < T)
    add(band(rand.standard_normal(n), 200, 8000) * rise, 0.18)
    tt = np.clip(t - T, 0, None)
    boom = np.sin(2 * np.pi * np.cumsum(55 - 20 * np.minimum(tt, 1)) / SR) * env_at(n, T, 0.005, 0.9)
    boom += band(rand.standard_normal(n), 40, 600) * env_at(n, T, 0.002, 0.12) * 0.6
    add(boom, 0.6)
    tail = sum(np.sin(2 * np.pi * f * t) for f in (73.4, 110, 146.8, 174.6)) * env_at(n, T, 0.4, 2.5)
    add(tail, 0.04)

    L, R = reverb(L), reverb(R)
    fade = np.minimum(np.clip(t / 0.4, 0, 1), np.clip((s["dur"] - t) / 0.5, 0, 1))
    out = np.stack([L * fade, R * fade], axis=1)
    out *= 0.89 / np.max(np.abs(out))
    return out


def write_wav(path, data):
    pcm = (np.clip(data, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] not in SCENES:
        sys.exit("Kullanım: python3 ses_tasarimi.py <a|b> <cikti.wav>")
    write_wav(sys.argv[2], build(SCENES[sys.argv[1]]))
