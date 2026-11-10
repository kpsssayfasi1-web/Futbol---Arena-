"""Kuzgun Feneri ses miksi: seslendirme işleme + ortam sesleri + efektler + sentez müzik.
Tüm efekt ve müzik numpy ile sentezlenir (ElevenLabs yalnızca konuşma sesleri için kullanıldı).
Çıktı: ses/miks.wav   Kullanım: python3 miks.py
"""
import json
import subprocess
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).parent
SR = 48000
TL = json.load(open(ROOT / "film" / "zaman.json"))
N = int(TL["total"] * SR) + SR
rand = np.random.default_rng(7)
L_ = {l["id"]: l for l in TL["lines"]}


# ---------------- yardımcılar ----------------
def band(x, lo, hi, soft=0.25):
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(f)
    if lo > 0:
        m *= np.clip((f - lo * (1 - soft)) / (lo * soft + 1e-9), 0, 1)
    if hi:
        m *= np.clip((hi * (1 + soft) - f) / (hi * soft), 0, 1)
    return np.fft.irfft(spec * m, len(x)).astype(np.float32)


def noise_loop(seconds, lo, hi, kind="white"):
    n = int(seconds * SR)
    x = rand.standard_normal(n).astype(np.float32)
    if kind == "brown":
        x = np.cumsum(x); x -= np.convolve(x, np.ones(2001) / 2001, mode="same")
    y = band(x, lo, hi)
    fade = int(0.5 * SR)  # döngü dikişi için çapraz geçiş
    y[:fade] = y[:fade] * np.linspace(0, 1, fade) + y[-fade:] * np.linspace(1, 0, fade)
    y = y[:-fade]
    return y / (np.sqrt(np.mean(y ** 2)) + 1e-9)


def tile(loop, n):
    reps = n // len(loop) + 1
    return np.tile(loop, reps)[:n]


def env(n, attack, decay):
    t = np.arange(n) / SR
    return np.where(t < attack, t / max(attack, 1e-4), np.exp(-(t - attack) / decay)).astype(np.float32)


def add(buf, sig, t, gain=1.0):
    i = int(t * SR)
    if i >= len(buf) or i + len(sig) <= 0:
        return
    s0 = max(0, -i); i = max(0, i)
    seg = sig[s0: s0 + len(buf) - i]
    buf[i: i + len(seg)] += seg * gain


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype="<f4").copy()


def reverb(x, seconds=1.2, mix=0.2, lo=200, hi=6000):
    n = int(seconds * SR)
    ir = rand.standard_normal(n).astype(np.float32) * np.exp(-np.arange(n) / (SR * seconds / 6)).astype(np.float32)
    ir = band(ir, lo, hi); ir /= np.sqrt(np.sum(ir ** 2))
    size = 1 << int(np.ceil(np.log2(len(x) + n)))
    wet = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)].astype(np.float32)
    return x * (1 - mix) + wet * mix


def rms_norm(x, target_db=-20):
    r = np.sqrt(np.mean(x[np.abs(x) > 1e-3] ** 2)) + 1e-9
    return x * (10 ** (target_db / 20) / r)


# ---------------- 1) seslendirme ----------------
voice = np.zeros(N, np.float32)
radio_fx = np.zeros(N, np.float32)
for ln in TL["lines"]:
    x = rms_norm(load(ROOT / "ses" / "ham" / f"{ln['id']}.mp3"))
    sp = ln["speaker"]
    if sp in ("HASAN", "KÜÇÜK NUR"):
        y = band(x, 380, 3000)
        y = np.tanh(y * 3.0) / np.tanh(3.0) * 0.55
        st = band(rand.standard_normal(len(y)).astype(np.float32), 1200, 7000) * 0.02
        y = y + st
        burst = band(rand.standard_normal(int(0.18 * SR)).astype(np.float32), 800, 6000) * env(int(0.18 * SR), 0.005, 0.06) * 0.25
        add(radio_fx, burst, ln["start"] - 0.12); add(radio_fx, burst, ln["start"] + ln["dur"] + 0.02)
        x = y * 1.25
    elif sp == "NUR" and ln["id"] in ("05", "07"):
        x = np.tanh(band(x, 320, 3400) * 1.6) * 0.8
    elif ln["id"] >= "53":
        x = reverb(x, 0.6, 0.08)
    else:
        x = reverb(x, 0.5, 0.06)
    add(voice, x, ln["start"])

# konuşma zarfı (müzik/ortam kısma için)
vabs = np.abs(voice)
k = int(0.25 * SR)
duck = np.convolve(vabs[::48], np.ones(k // 48) / (k // 48), mode="same")
duck = np.repeat(duck, 48)[:N]
duck = np.clip(duck / (np.percentile(duck[duck > 1e-4], 90) + 1e-9), 0, 1)

# ---------------- 2) sahne tabanlı ortam ----------------
EXT = {"storm", "station_ext", "rowboat", "rocks"}
INT = {"station_int", "deniz", "enes", "radio", "radar", "monitor", "phone", "calendar", "whistle", "window", "photo"}
CAVE, LANTERN, DAWN = {"cave"}, {"lantern"}, {"home", "nur"}


def curve(pred, xfade=0.35):
    c = np.zeros(N, np.float32)
    for s in TL["shots"]:
        if pred(s):
            a, b = int(s["t0"] * SR), int(s["t1"] * SR)
            c[a:b] = 1
    w = int(xfade * SR)
    c = np.convolve(c[::48], np.ones(w // 48) / (w // 48), mode="same")
    return np.repeat(c, 48)[:N].astype(np.float32)


def is_dawn(s):
    return s["set"] in DAWN or s["p"].get("dawn") or (s["line"] and s["line"] >= "53" and s["set"] != "end")


ext_c = curve(lambda s: s["set"] in EXT and not is_dawn(s))
int_c = curve(lambda s: s["set"] in INT and not is_dawn(s))
cave_c = curve(lambda s: s["set"] in CAVE)
lant_c = curve(lambda s: s["set"] in LANTERN)
dawn_c = curve(lambda s: bool(is_dawn(s)))
calm_c = curve(lambda s: s["p"].get("calm") or s["p"].get("lateLight"))

wind = tile(noise_loop(31, 60, 900, "brown"), N)
rainx = tile(noise_loop(23, 2500, 12000), N)
waves = tile(noise_loop(37, 40, 500, "brown"), N)
t = np.arange(N, dtype=np.float32) / SR
lfo = (0.6 + 0.4 * np.sin(2 * np.pi * 0.07 * t) * np.sin(2 * np.pi * 0.023 * t + 1)).astype(np.float32)
swell = (0.5 + 0.5 * np.sin(2 * np.pi * 0.11 * t) ** 2).astype(np.float32)
storm_full = (wind * 0.05 * lfo + rainx * 0.035 + waves * 0.06 * swell) * 0.75
storm_muff = band(storm_full[: 40 * SR].copy(), 0, 700)
storm_muff = tile(storm_muff / (np.sqrt(np.mean(storm_muff ** 2)) + 1e-9), N) * 0.026
amb = storm_full * (ext_c * (1 - 0.6 * calm_c) + lant_c * 0.7) + storm_muff * (int_c + cave_c * 0.8 + lant_c * 0.3)
hum = sum(np.sin(2 * np.pi * 100 * h * t) / h for h in range(1, 5)).astype(np.float32) * 0.002
amb += hum * int_c
amb += tile(noise_loop(29, 30, 400, "brown"), N) * 0.018 * dawn_c * (0.6 + 0.4 * swell)  # sakin dalgalar

# ---------------- 3) efektler ----------------
fx = np.zeros(N, np.float32)


def mulberry(seed):
    s = seed & 0xFFFFFFFF

    def nxt():
        nonlocal s
        s = (s + 0x6D2B79F5) & 0xFFFFFFFF
        x = s
        x = (((x ^ (x >> 15)) * (x | 1)) & 0xFFFFFFFF)
        x ^= (x + (((x ^ (x >> 7)) * (x | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((x ^ (x >> 14)) & 0xFFFFFFFF) / 4294967296
    return nxt


def thunder(t0, power, muffled):
    n = int(4.5 * SR)
    x = band(rand.standard_normal(n).astype(np.float32), 25, 700 if muffled else 2500)
    e = env(n, 0.04, 1.1) * (1 + 0.6 * np.sin(np.arange(n) / SR * 9) ** 2)
    add(fx, x * e, t0, 0.3 * power * (0.45 if muffled else 1))


LIGHT = {"storm": (5, 0.18, False), "station_ext": (9, 0.12, False), "rowboat": (21, 0.25, False), "rocks": (33, 0.25, False),
         "cave": (41, 0.2, True), "station_int": (9, 0.15, True), "calendar": (9, 0.15, True), "window": (12, 0.15, True), "lantern": (27, 0.25, False)}
for s in TL["shots"]:
    if s["set"] not in LIGHT or s["p"].get("calm") or s["p"].get("flare") or s["p"].get("lateLight"):
        continue
    seed, rate, muff = LIGHT[s["set"]]
    for slot in range(int(s["t0"] * rate), int(s["t1"] * rate) + 1):
        r = mulberry(slot * 97 + seed)()
        if r > 0.55:
            continue
        tf = slot / rate + r * 2
        if s["t0"] <= tf < s["t1"]:
            thunder(tf + 0.25 + r * 1.2, 0.6 + r * 0.8, muff)


def squelch(t0, dur=0.25, g=0.3):
    n = int(dur * SR)
    add(fx, band(rand.standard_normal(n).astype(np.float32), 600, 7000) * env(n, 0.005, dur / 3), t0, g)


for s in TL["shots"]:
    p, t0, t1 = s["p"], s["t0"], s["t1"]
    if s["set"] == "radio":
        squelch(t0, 0.3, 0.25)
        if p.get("mode") == "static":
            n = int((t1 - t0) * SR); add(fx, band(rand.standard_normal(n).astype(np.float32), 500, 6000) * 0.05 * (0.5 + 0.5 * np.abs(np.sin(np.arange(n) / SR * 13))), t0)
        if p.get("mode") == "dead":
            n = int(2.6 * SR); add(fx, band(rand.standard_normal(n).astype(np.float32), 400, 7000) * 0.09, t0)
    if s["set"] in ("radar", "station_int"):
        for k in np.arange(t0 + 0.4, t1, 2.6):
            n = int(0.5 * SR); add(fx, np.sin(2 * np.pi * 1250 * np.arange(n) / SR).astype(np.float32) * env(n, 0.003, 0.09), k, 0.025)
    if s["set"] == "phone":
        for k in np.arange(t0 + 0.2, t1, 1.25):
            n = int(0.6 * SR); tt = np.arange(n) / SR
            buzz = np.sin(2 * np.pi * 150 * tt) * (np.sin(2 * np.pi * 8 * tt) > 0) * env(n, 0.01, 0.5)
            mel = sum(np.sin(2 * np.pi * f * tt) * env(n, 0.002, 0.18) * ((tt >= d) & (tt < d + 0.2)) for f, d in ((988, 0), (1319, 0.15), (1175, 0.3)))
            add(fx, (buzz * 0.4 + mel * 0.25).astype(np.float32), k, 0.35)
    if s["set"] == "monitor":
        stop = t0 + (1.8 if p.get("mode") == "registry" else (0 if p.get("hl") else t1 - t0 - 1.0))
        r = rng = np.random.default_rng(int(t0 * 10))
        for k in np.arange(t0 + (0.2 if p.get("mode") == "registry" else 6.8), stop, 0.085):
            n = int(0.03 * SR); add(fx, band(rng.standard_normal(n).astype(np.float32), 1500, 8000) * env(n, 0.001, 0.008), k + rng.random() * 0.03, 0.12)
    if s["set"] == "station_int" and p.get("door"):
        n = int(1.6 * SR); tt = np.arange(n) / SR
        creak = np.sin(2 * np.pi * np.cumsum(300 + 120 * np.sin(tt * 7)) / SR) * band(rand.standard_normal(n).astype(np.float32), 200, 3000) * 0.5
        add(fx, (creak * env(n, 0.3, 0.6)).astype(np.float32), t0 + 0.1, 0.15)
        squelch(t0 + 0.05, 0.05, 0.4)
    if s["set"] == "window" and "flicker" in p:
        n = int(0.5 * SR); tt = np.arange(n) / SR
        add(fx, (np.sign(np.sin(2 * np.pi * 100 * tt)) * band(rand.standard_normal(n).astype(np.float32), 200, 5000)).astype(np.float32) * env(n, 0.002, 0.15), t0 + p["flicker"], 0.08)
    if s["set"] == "rowboat":
        for k in np.arange(t0 + 0.5, t1, 1.96):
            n = int(0.7 * SR); add(fx, band(rand.standard_normal(n).astype(np.float32), 200, 4000) * env(n, 0.02, 0.2), k, 0.18)
    if s["set"] == "rocks" and p.get("flare"):
        n = int((t1 - t0) * SR); hiss = band(rand.standard_normal(n).astype(np.float32), 1500, 9000) * (0.6 + 0.4 * rand.random(n).astype(np.float32))
        hiss *= np.minimum(1, np.arange(n) / (0.15 * SR)); add(fx, hiss, t0, 0.07)
        mot = np.sin(2 * np.pi * 45 * np.arange(n) / SR) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 9 * np.arange(n) / SR)))
        add(fx, band(mot.astype(np.float32), 30, 400) * np.linspace(0.2, 1, n).astype(np.float32), t0, 0.08)
    if p.get("chapter"):
        n = int(1.2 * SR); add(fx, band(rand.standard_normal(n).astype(np.float32), 300, 4000) * np.sin(np.linspace(0, np.pi, n)).astype(np.float32) ** 2, t0, 0.05)

# düdük sesi: kurtarma teknesi mağarayı düdükten bulur
l51 = L_["51"]
for k in range(3):
    n = int(0.45 * SR); tt = np.arange(n) / SR
    wh = (np.sin(2 * np.pi * 2900 * tt + 4 * np.sin(2 * np.pi * 30 * tt)) * 0.6 + band(rand.standard_normal(n).astype(np.float32), 2000, 5000) * 0.3) * env(n, 0.03, 0.2)
    add(fx, reverb(wh.astype(np.float32), 1.5, 0.5), l51["start"] + l51["dur"] + 0.3 + k * 0.6, 0.06)


def boom(t0, g=0.6, tail=2.5):
    n = int(tail * SR); tt = np.arange(n) / SR
    b = np.sin(2 * np.pi * np.cumsum(60 - 28 * np.minimum(tt, 1)) / SR) * env(n, 0.005, 0.8)
    b += band(rand.standard_normal(n).astype(np.float32), 30, 500) * env(n, 0.002, 0.15) * 0.6
    rise = int(0.8 * SR)
    add(fx, band(rand.standard_normal(rise).astype(np.float32), 300, 8000) * np.linspace(0, 1, rise).astype(np.float32) ** 3, t0 - 0.8, g * 0.25)
    add(fx, b.astype(np.float32), t0, g)


title = next(s for s in TL["shots"] if s["set"] == "title")
boom(title["t0"] + 0.4, 0.7)
boom(L_["58"]["start"] + 16.7, 0.75, 3.5)
boom(L_["30"]["start"] + 3.0, 0.4)
boom(L_["20"]["start"] + 3.0, 0.3)

# ---------------- 4) sentez müzik ----------------
mus = np.zeros(N, np.float32)
NOTE = lambda m: 440 * 2 ** ((m - 69) / 12)


def pad(freqs, t0, dur, g=0.05, bright=8, att=1.5, rel=2.0):
    n = int((dur + rel) * SR); tt = np.arange(n) / SR
    e = np.clip(tt / att, 0, 1) * np.clip((dur + rel - tt) / rel, 0, 1)
    y = np.zeros(n, np.float32)
    for f in freqs:
        for det in (-0.12, 0.0, 0.11):
            for h in range(1, bright + 1):
                y += (np.sin(2 * np.pi * f * h * (1 + det / 100) * tt + h) / (h ** 1.3)).astype(np.float32)
    y *= (e / (len(freqs) * 3)).astype(np.float32)
    add(mus, y, t0, g)


def piano(m, t0, g=0.08, dur=3.0):
    f = NOTE(m); n = int(dur * SR); tt = np.arange(n) / SR
    y = sum(np.sin(2 * np.pi * f * h * (1 + 0.0004 * h * h) * tt) * np.exp(-tt * (1.2 + h * 0.9)) / h ** 1.2 for h in range(1, 9))
    y = y * np.clip(tt / 0.004, 0, 1)
    add(mus, y.astype(np.float32), t0, g)


def heart(t0, t1, bpm=62, g=0.18):
    g *= 0.6
    n = int(0.35 * SR); tt = np.arange(n) / SR
    k = np.sin(2 * np.pi * np.cumsum(70 - 30 * tt / 0.35) / SR) * np.exp(-tt * 18)
    for b in np.arange(t0, t1, 60 / bpm):
        add(mus, k.astype(np.float32), b, g); add(mus, k.astype(np.float32), b + 0.28, g * 0.6)


def drone(t0, t1, f=36.7, g=0.05):
    g *= 0.45
    n = int((t1 - t0) * SR); tt = np.arange(n) / SR
    e = np.clip(tt / 3, 0, 1) * np.clip((t1 - t0 - tt) / 3, 0, 1)
    y = (np.sin(2 * np.pi * f * tt) + 0.5 * np.sin(2 * np.pi * f * 2.003 * tt) + 0.25 * np.sin(2 * np.pi * f * 3.01 * tt)) * e
    add(mus, y.astype(np.float32), t0, g)


S = lambda i: L_[i]["start"]
E = lambda i: L_[i]["start"] + L_[i]["dur"]
# C1: soğuk açılış
drone(0, title["t1"], 36.7, 0.06); pad([NOTE(50), NOTE(51)], 2, S("03") - 2 + L_["03"]["dur"], 0.03, 5)
# C2: Deniz ve anne – melankolik piyano
chords = [[50, 53, 57], [46, 50, 53], [41, 45, 48], [45, 49, 52]]
motif = [74, 77, 76, 72, 74, 69, 70, 72]
t = S("04")
while t < E("09"):
    for c in chords:
        if t >= E("09"): break
        pad([NOTE(m) for m in c], t, 4.0, 0.022, 6, 1.0, 1.5)
        for j, m in enumerate(motif[:4] if int(t) % 2 else motif[4:]):
            piano(m, t + j * 1.0, 0.035)
        t += 4.0
# C3: gerilim
drone(S("10") - 1, E("30"), 36.7, 0.07); heart(S("10"), E("30"), 58, 0.12)
for i in ("20", "22", "28", "30"):
    pad([NOTE(57), NOTE(58), NOTE(64)], S(i), L_[i]["dur"], 0.025, 4, 2.5, 2)
# C4: ikilem
t = S("31")
for c in [[50, 53, 57], [43, 46, 50], [46, 50, 53], [45, 49, 52]] * 4:
    if t >= S("37"): break
    pad([NOTE(m) for m in c], t, 5.0, 0.03, 6, 1.5, 2); t += 5.0
heart(S("32"), S("37"), 72, 0.16)
# C5: kurtarma – sürükleyici nabız ve ostinato
drone(S("37"), E("46"), 36.7, 0.06)
bass = [38, 38, 41, 38, 36, 38, 43, 41]
t, j = S("37"), 0
while t < E("46"):
    piano(bass[j % 8], t, 0.07, 0.6); heart(t, t + 0.1, 600, 0.1); t += 0.33; j += 1
pad([NOTE(62), NOTE(65), NOTE(69)], S("38"), E("46") - S("38"), 0.02, 5, 6, 2)
# C6: sessizlik (47-48): ince tek nota
pad([NOTE(81)], S("47"), E("48") - S("47"), 0.008, 2, 3, 2)
# C7: duygusal tema
theme = [69, 72, 74, 72, 69, 67, 65, 67, 69, 65, 64, 62]
t = S("49")
for c in [[53, 57, 60], [48, 52, 55], [50, 53, 57], [46, 50, 53]] * 3:
    if t >= S("51") + 2.5: break
    pad([NOTE(m) for m in c], t, 4.5, 0.03, 6, 1.5, 2); t += 4.5
for j, m in enumerate(theme):
    if S("49") + j * 1.5 < S("51"): piano(m, S("49") + j * 1.5, 0.05)
pad([NOTE(53), NOTE(57), NOTE(60)], S("51") + 5.0, E("52") - S("51") - 5.0, 0.03, 6, 3, 3)
# C8: şafak
t = S("53")
for c in [[53, 57, 60], [46, 50, 53], [48, 52, 55], [53, 57, 60]] * 6:
    if t >= S("58") + 16.0: break
    pad([NOTE(m) for m in c], t, 5.0, 0.016, 4, 2, 2)
    for j, m in enumerate([77, 76, 72, 74]):
        piano(m, t + j * 1.25, 0.022)
    t += 5.0
# C9: büyük ters köşe ve final
t = S("58") + 16.7
for c in [[50, 53, 57], [46, 50, 53], [41, 45, 48], [45, 49, 52], [50, 54, 57]] * 6:
    if t >= TL["total"] - 2: break
    pad([NOTE(m) for m in c] + [NOTE(c[0] - 12)], t, 5.0, 0.04, 7, 1.5, 2.5)
    t += 5.0
for j, m in enumerate(theme + theme[:6]):
    piano(m, S("58") + 17.5 + j * 1.6, 0.045)

# ---------------- 5) miks ----------------
mus_d = mus * 1.45 * (1 - 0.55 * duck)
amb_d = amb * (1 - 0.35 * duck)
mix = voice * 1.0 + radio_fx + fx + amb_d + mus_d
r = lambda x: 20 * np.log10(np.sqrt(np.mean(x[int(40*SR):int(400*SR)] ** 2)) + 1e-9)
print(f'ses {r(voice):.1f} dB | ortam {r(amb_d):.1f} | efekt {r(fx + radio_fx):.1f} | müzik {r(mus_d):.1f}')
stereo = np.stack([mix + 0.15 * np.roll(amb_d, 480), mix + 0.15 * np.roll(amb_d, -480)], axis=1)
stereo = np.tanh(stereo * 1.2) / 1.2
stereo /= np.max(np.abs(stereo)) / 0.95
out = ROOT / "ses" / "miks_ham.wav"
with wave.open(str(out), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(stereo, -1, 1) * 32767).astype("<i2").tobytes())
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(out), "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000", str(ROOT / "ses" / "miks.wav")], check=True)
print("tamam:", ROOT / "ses" / "miks.wav")
