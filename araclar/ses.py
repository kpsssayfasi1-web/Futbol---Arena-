"""Telifsiz ses efektleri ve müzik sentezi (numpy/scipy).

Her fonksiyon 48 kHz mono float32 dizi döndürür. Kurgu, bunları bir zaman çizelgesine
yerleştirip stereo olarak karıştırır.
"""
import numpy as np
from scipy import signal

SR = 48000
RNG = np.random.default_rng(7)


def _t(dur: float) -> np.ndarray:
    return np.arange(int(dur * SR)) / SR


def _noise(dur: float) -> np.ndarray:
    return RNG.standard_normal(int(dur * SR)).astype(np.float32)


def _band(x: np.ndarray, lo: float, hi: float, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return signal.sosfilt(sos, x).astype(np.float32)


def _low(x: np.ndarray, hz: float, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, hz, btype="low", fs=SR, output="sos")
    return signal.sosfilt(sos, x).astype(np.float32)


def _high(x: np.ndarray, hz: float, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, hz, btype="high", fs=SR, output="sos")
    return signal.sosfilt(sos, x).astype(np.float32)


def _norm(x: np.ndarray, peak: float = 1.0) -> np.ndarray:
    m = np.max(np.abs(x)) + 1e-9
    return (x / m * peak).astype(np.float32)


def boom(dur: float = 3.0) -> np.ndarray:
    """Sinematik alçak frekans darbesi."""
    t = _t(dur)
    freq = 32 + 48 * np.exp(-t * 3.0)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    body = np.sin(phase) * np.exp(-t * 1.6)
    hit = _low(_noise(dur), 300) * np.exp(-t * 25)
    return _norm(np.tanh(1.8 * (body + 0.6 * hit)))


def tinnitus(dur: float = 2.6, hz: float = 7200) -> np.ndarray:
    t = _t(dur)
    env = np.minimum(t / 0.05, 1) * np.exp(-t * 1.2)
    return (np.sin(2 * np.pi * hz * t) * env).astype(np.float32)


def bulb_buzz(dur: float) -> np.ndarray:
    t = _t(dur)
    x = sum(np.sin(2 * np.pi * 100 * k * t) / k for k in range(1, 7))
    flutter = 0.75 + 0.25 * np.sin(2 * np.pi * 9 * t) * np.sin(2 * np.pi * 0.7 * t)
    return _norm(np.tanh(2 * x) * flutter, 0.6)


def glass_stress(dur: float = 1.2) -> np.ndarray:
    """Çatlak büyürken gelen cam gerilme çıtırtıları (giderek sıklaşır)."""
    n = int(dur * SR)
    out = np.zeros(n, np.float32)
    count = 40
    times = np.sort(dur * (1 - (1 - RNG.random(count)) ** 2))
    for tc in times:
        out = _add(out, _tick(RNG.uniform(2500, 7000), RNG.uniform(0.01, 0.04)), tc, RNG.uniform(0.2, 0.7))
    return _norm(_high(out, 1500), 0.7)


def _tick(hz: float, decay: float) -> np.ndarray:
    t = _t(decay * 6)
    return (np.sin(2 * np.pi * hz * t) * np.exp(-t / decay)).astype(np.float32)


def _add(dst: np.ndarray, src: np.ndarray, at: float, gain: float = 1.0) -> np.ndarray:
    i = int(at * SR)
    if i >= len(dst):
        return dst
    j = min(len(dst), i + len(src))
    dst[i:j] += src[: j - i] * gain
    return dst


def crack_snap() -> np.ndarray:
    t = _t(0.25)
    click = _high(_noise(0.25), 2000) * np.exp(-t * 90)
    ring = np.sin(2 * np.pi * 4300 * t) * np.exp(-t * 35)
    return _norm(click + 0.5 * ring)


def shatter(dur: float = 1.8) -> np.ndarray:
    """Cam kırılması: patlama + yüzlerce küçük cam şıngırtısı."""
    n = int(dur * SR)
    out = np.zeros(n, np.float32)
    t = _t(dur)
    out += _high(_noise(dur), 800) * np.exp(-t * 18) * 0.9
    out += _low(_noise(dur), 200) * np.exp(-t * 12) * 0.8
    for _ in range(260):
        at = dur * 0.85 * RNG.random() ** 2.2
        grain = _tick(RNG.uniform(2800, 11000), RNG.uniform(0.006, 0.05))
        out = _add(out, grain, at, RNG.uniform(0.05, 0.35) * np.exp(-at * 2))
    return _norm(out)


def whoosh(dur: float = 0.7, lo: float = 250, hi: float = 3500) -> np.ndarray:
    n = int(dur * SR)
    x = _noise(dur)
    out = np.zeros(n, np.float32)
    seg = 512
    for i in range(0, n, seg):
        f = lo * (hi / lo) ** (i / n)
        out[i:i + seg] = _band(x[max(0, i - 2048):i + seg], f * 0.7, f * 1.4)[-len(x[i:i + seg]):]
    env = np.sin(np.pi * np.linspace(0, 1, n)) ** 2
    return _norm(out * env)


def rain(dur: float) -> np.ndarray:
    base = _band(_noise(dur), 400, 7000) * 0.5
    n = len(base)
    for _ in range(int(dur * 70)):
        base = _add(base, _tick(RNG.uniform(1500, 5000), 0.004), RNG.random() * dur, RNG.uniform(0.1, 0.5))
    return _norm(base[:n], 0.8)


def muffled_party(dur: float) -> np.ndarray:
    t = _t(dur)
    babble = _low(_noise(dur), 500) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.6 * t + np.sin(2 * np.pi * 0.23 * t)))
    for _ in range(int(dur * 1.2)):
        babble = _add(babble, _tick(RNG.uniform(2200, 3200), 0.06) * 0.15, RNG.random() * dur)
    return _norm(babble, 0.6)


def riser(dur: float) -> np.ndarray:
    t = _t(dur)
    n = len(t)
    noise = whoosh(dur, 300, 6000)[:n]
    freq = 110 * (8 ** (t / dur))
    tone = np.sin(2 * np.pi * np.cumsum(freq) / SR)
    env = (t / dur) ** 2.5
    return _norm((0.7 * noise + 0.4 * tone) * env)


def reverse_swell(dur: float = 1.0) -> np.ndarray:
    t = _t(dur)
    x = _high(_noise(dur), 2500) * np.exp((t - dur) * 5)
    return _norm(x)


def switch_thunk() -> np.ndarray:
    t = _t(0.35)
    thunk = np.sin(2 * np.pi * 85 * t) * np.exp(-t * 22)
    click = _high(_noise(0.35), 3000) * np.exp(-t * 200)
    return _norm(thunk + 0.5 * click)


def wood_clack() -> np.ndarray:
    """Satranç taşının tahtaya konma sesi."""
    t = _t(0.3)
    body = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, d in ((950, 45), (1750, 60), (2600, 80)))
    hit = _band(_noise(0.3), 900, 4000) * np.exp(-t * 120)
    return _norm(body * 0.6 + hit)


def heartbeat(dur: float, bpm: float = 64) -> np.ndarray:
    n = int(dur * SR)
    out = np.zeros(n, np.float32)
    t = _t(0.25)
    lub = np.sin(2 * np.pi * 52 * t) * np.exp(-t * 20)
    dub = np.sin(2 * np.pi * 44 * t) * np.exp(-t * 26) * 0.7
    period = 60 / bpm
    beat = 0.0
    while beat < dur:
        out = _add(out, lub, beat)
        out = _add(out, dub, beat + 0.27)
        beat += period
    return _norm(_low(out, 160))


def piano_note(midi: int, dur: float = 4.0, vel: float = 1.0) -> np.ndarray:
    """Basit additive piyano tonu (hafif inharmonik kısmi sesler + çekiç sesi)."""
    f0 = 440 * 2 ** ((midi - 69) / 12)
    t = _t(dur)
    b = 0.0004
    x = np.zeros_like(t)
    for k in range(1, 10):
        fk = f0 * k * np.sqrt(1 + b * k * k)
        if fk > SR / 2.2:
            break
        x += np.sin(2 * np.pi * fk * t) * (1 / k ** 1.4) * np.exp(-t * (0.9 + 0.55 * k))
    hammer = _band(_noise(dur), 800, 5000) * np.exp(-t * 80) * 0.05
    attack = np.minimum(t / 0.004, 1)
    return (_norm((x + hammer) * attack) * vel).astype(np.float32)


def drone(dur: float, roots=(45, 52, 57)) -> np.ndarray:
    """Alçak, yavaş nefes alan yaylı/pad dokusu (A minör)."""
    t = _t(dur)
    x = np.zeros_like(t)
    for m in roots:
        f = 440 * 2 ** ((m - 69) / 12)
        for det in (-0.12, 0.0, 0.11):
            ph = 2 * np.pi * f * (1 + det / 100) * t
            x += signal.sawtooth(ph) * 0.3
    x = _low(x.astype(np.float32), 700, 4)
    breath = 0.65 + 0.35 * np.sin(2 * np.pi * 0.11 * t - np.pi / 2)
    return _norm(x * breath, 0.8)


def reverb(x: np.ndarray, seconds: float = 2.2, wet: float = 0.3) -> np.ndarray:
    t = _t(seconds)
    ir = _noise(seconds) * np.exp(-t * 6.9 / seconds)
    ir = _low(ir, 6000)
    ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
    tail = signal.fftconvolve(x, ir)[: len(x) + len(ir) // 2].astype(np.float32)
    dry = np.zeros_like(tail)
    dry[: len(x)] = x
    return dry * (1 - wet) + tail * wet


class Timeline:
    """Stereo zaman çizelgesi: ses parçalarını belirli zamana, kazanç ve pan ile yerleştirir."""

    def __init__(self, dur: float):
        self.buf = np.zeros((int(dur * SR), 2), np.float32)

    def put(self, clip: np.ndarray, at: float, gain_db: float = 0.0, pan: float = 0.0):
        g = 10 ** (gain_db / 20)
        left, right = g * np.sqrt((1 - pan) / 2), g * np.sqrt((1 + pan) / 2)
        i = int(at * SR)
        if i >= len(self.buf):
            return
        j = min(len(self.buf), i + len(clip))
        self.buf[i:j, 0] += clip[: j - i] * left
        self.buf[i:j, 1] += clip[: j - i] * right

    def put_stereo(self, left: np.ndarray, right: np.ndarray, at: float, gain_db: float = 0.0):
        self.put(left, at, gain_db, -1.0)
        self.put(right, at, gain_db, 1.0)


def thunder(dur: float = 3.2) -> np.ndarray:
    """Gök gürültüsü: kısa çatırtı + yuvarlanan alçak gürleme."""
    t = _t(dur)
    crack = _high(_noise(dur), 1500) * np.exp(-t * 14)
    rumble = _low(_noise(dur), 120) * np.minimum(t / 0.15, 1) * np.exp(-t * 1.1)
    roll = _low(_noise(dur), 400) * (0.5 + 0.5 * np.sin(2 * np.pi * 1.7 * t)) * np.exp(-t * 1.5)
    return _norm(0.5 * crack + rumble + 0.5 * roll)
