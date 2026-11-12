"""Durağan illüstrasyonlara hayat veren hareket efektleri.

- DepthCam: derinlik haritasıyla 2.5D kamera (yakın nesneler uzaktakilerden farklı kayar)
- Bölgesel çarpıtmalar: sallanma (perde, havlu), nefes alma, baş hareketi, su dalgası
- Işık: titreyen lambalar/mumlar, kristal parıltıları, şimşek
- Atmosfer: akan bulutlar, camdan süzülen yağmur damlaları, yer sisi

Tüm çarpıtmalar ekran uzayında (W x H) çalışır; bölgeler ekran koordinatında maske olarak verilir.
"""
import math

import cv2
import numpy as np

from gorsel import H, W

_XS, _YS = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))


def to_screen(pt, m):
    return (m[0, 0] * pt[0] + m[0, 1] * pt[1] + m[0, 2], m[1, 0] * pt[0] + m[1, 1] * pt[1] + m[1, 2])


def box_mask(m, box, feather: float = 25.0) -> np.ndarray:
    """Kaynak görseldeki (x0,y0,x1,y1) kutusunu kameraya göre ekrana taşıyıp yumuşak maske yapar."""
    x0, y0 = to_screen(box[:2], m)
    x1, y1 = to_screen(box[2:], m)
    mask = np.zeros((H, W), np.float32)
    cv2.rectangle(mask, (int(x0), int(y0)), (int(x1), int(y1)), 1.0, -1)
    return cv2.GaussianBlur(mask, (0, 0), feather) if feather > 0 else mask


def ellipse_mask(center, axes, feather: float = 30.0) -> np.ndarray:
    mask = np.zeros((H, W), np.float32)
    cv2.ellipse(mask, (int(center[0]), int(center[1])), (int(axes[0]), int(axes[1])), 0, 0, 360, 1.0, -1)
    return cv2.GaussianBlur(mask, (0, 0), feather)


def src_mask(shape, boxes=(), ellipses=(), feather: float = 20.0) -> np.ndarray:
    """Kaynak görsel uzayında bir kez hazırlanan yumuşak maske (kutular ve elipsler)."""
    mask = np.zeros(shape[:2], np.float32)
    for x0, y0, x1, y1 in boxes:
        cv2.rectangle(mask, (int(x0), int(y0)), (int(x1), int(y1)), 1.0, -1)
    for (cx, cy), (ax, ay) in ellipses:
        cv2.ellipse(mask, (int(cx), int(cy)), (int(ax), int(ay)), 0, 0, 360, 1.0, -1)
    return cv2.GaussianBlur(mask, (0, 0), feather) if feather > 0 else mask


def to_scr(mask_src: np.ndarray, m) -> np.ndarray:
    """Kaynak uzayındaki maskeyi kamera matrisiyle ekrana taşır."""
    return cv2.warpAffine(mask_src, m, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)


def displace(frame: np.ndarray, dx: np.ndarray, dy: np.ndarray) -> np.ndarray:
    mx = (_XS - dx).astype(np.float32)
    my = (_YS - dy).astype(np.float32)
    return cv2.remap(frame, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


class DepthCam:
    """Derinlik haritasıyla parallax kamera. focus derinliğindeki düzlem sabit kalır."""

    def __init__(self, img: np.ndarray, depth: np.ndarray, focus: float = 0.5, depth_blur: float = 3.0):
        self.img = img
        self.depth = cv2.GaussianBlur(depth, (0, 0), depth_blur)
        self.focus = focus

    def render(self, m, shift=(0.0, 0.0), dolly: float = 0.0, center=(W / 2, H / 2), img=None) -> np.ndarray:
        img = self.img if img is None else img
        d = cv2.warpAffine(self.depth, m, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        k = d - self.focus
        qx = _XS - k * (shift[0] + dolly * (_XS - center[0]))
        qy = _YS - k * (shift[1] + dolly * (_YS - center[1]))
        inv = cv2.invertAffineTransform(m)
        mx = inv[0, 0] * qx + inv[0, 1] * qy + inv[0, 2]
        my = inv[1, 0] * qx + inv[1, 1] * qy + inv[1, 2]
        return cv2.remap(img, mx.astype(np.float32), my.astype(np.float32), cv2.INTER_LINEAR,
                         borderMode=cv2.BORDER_REPLICATE)

    def depth_screen(self, m) -> np.ndarray:
        return cv2.warpAffine(self.depth, m, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


# --- bölgesel çarpıtmalar -------------------------------------------------------------------------

def sway(frame, mask, t, amp: float, freq: float, phase: float = 0.0, top_y: float = 0.0, length: float = 600.0):
    """Asılı nesne (perde, havlu) gibi: üstü sabit, aşağı indikçe artan yatay salınım."""
    k = np.clip((_YS - top_y) / length, 0, 1)
    wave = np.sin(2 * math.pi * freq * t + phase + _YS * 0.012)
    return displace(frame, mask * k * amp * wave, np.zeros_like(mask))


def breathe(frame, mask, center, axes, t, amp: float = 4.0, rate: float = 0.28, phase: float = 0.0):
    """Göğüs bölgesinde yavaş genişleme/daralma (nefes). mask: ekran uzayında yumuşak maske."""
    s = amp * (0.5 - 0.5 * math.cos(2 * math.pi * rate * t + phase))
    dy = -mask * s * np.clip((center[1] + axes[1] - _YS) / (2 * axes[1]), 0, 1)
    dx = mask * s * 0.25 * (_XS - center[0]) / axes[0]
    return displace(frame, dx, dy)


def rotate_region(frame, pivot, mask, angle_deg: float):
    """Maskeli bölgeyi pivot etrafında döndürür (baş kaldırma, kafa çevirme)."""
    a = math.radians(angle_deg)
    px, py = pivot
    rx = (_XS - px) * math.cos(a) - (_YS - py) * math.sin(a) + px
    ry = (_XS - px) * math.sin(a) + (_YS - py) * math.cos(a) + py
    return displace(frame, mask * (_XS - rx), mask * (_YS - ry))


def shimmer(frame, mask, t, amp: float = 3.0, scale: float = 0.06, speed: float = 2.5):
    """Su yüzeyi: yatay akan dalgacıklar."""
    dx = mask * amp * np.sin(_YS * scale * 3 + t * speed * 2) * np.sin(_XS * scale + t * speed)
    dy = mask * amp * 0.5 * np.sin(_XS * scale * 1.7 - t * speed * 1.3)
    return displace(frame, dx, dy)


# --- ışık ------------------------------------------------------------------------------------------

def light_mask(frame, region=None, thresh: float = 0.72, warm: bool = True, blur: float = 6.0):
    """Görseldeki parlak (ve sıcak tonlu) ışık kaynaklarını maskeler."""
    lum = frame.mean(axis=2)
    m = np.clip((lum - thresh) / (1 - thresh), 0, 1)
    if warm:
        m *= np.clip((frame[..., 0] - frame[..., 2]) * 3, 0, 1)
    if region is not None:
        m *= region
    return cv2.GaussianBlur(m.astype(np.float32), (0, 0), blur)


def flicker_value(t: float, seed: int = 0, depth: float = 0.25) -> float:
    """Mum/lamba titremesi için yumuşak, düzensiz değer (1 civarı)."""
    s = seed * 1.7
    n = (math.sin(t * 13.1 + s) * 0.5 + math.sin(t * 7.3 + s * 2) * 0.3 + math.sin(t * 23.7 + s * 3) * 0.2)
    return 1 + depth * n


def sparkle_points(frame, region, count: int = 40, seed: int = 0):
    """Bölgedeki en parlak noktalardan parıltı konumları seçer."""
    lum = frame.mean(axis=2) * region
    idx = np.argsort(lum.ravel())[-count * 30:]
    rng = np.random.default_rng(seed)
    pick = rng.choice(idx, size=min(count, len(idx)), replace=False)
    ys, xs = np.unravel_index(pick, lum.shape)
    return np.c_[xs, ys].astype(np.float32), rng.uniform(0, 6.28, len(xs)).astype(np.float32)


def draw_sparkles(points, phases, t, size: float = 9.0, speed: float = 3.0) -> np.ndarray:
    layer = np.zeros((H, W), np.float32)
    for (x, y), ph in zip(points, phases):
        a = max(0.0, math.sin(t * speed + ph)) ** 6
        if a < 0.05:
            continue
        r = size * a
        cv2.line(layer, (int(x - r), int(y)), (int(x + r), int(y)), a, 1, cv2.LINE_AA)
        cv2.line(layer, (int(x), int(y - r)), (int(x), int(y + r)), a, 1, cv2.LINE_AA)
        cv2.circle(layer, (int(x), int(y)), 2, a, -1, cv2.LINE_AA)
    return cv2.GaussianBlur(layer, (0, 0), 0.8)


def lightning(t: float, strikes) -> float:
    """Şimşek parlaklığı: her çakma iki hızlı flaş + sönüm."""
    v = 0.0
    for s in strikes:
        d = t - s
        if 0 <= d < 0.6:
            v = max(v, math.exp(-d / 0.05) + 0.7 * math.exp(-max(0.0, d - 0.12) / 0.07) * (d >= 0.12))
    return min(v, 1.2)


# --- atmosfer --------------------------------------------------------------------------------------

def _fbm(shape, seed, octaves=4):
    rng = np.random.default_rng(seed)
    out = np.zeros(shape, np.float32)
    amp, total = 1.0, 0.0
    for o in range(octaves):
        g = rng.random((max(2, shape[0] // (64 >> o)), max(2, shape[1] // (64 >> o)))).astype(np.float32)
        out += cv2.resize(g, (shape[1], shape[0]), interpolation=cv2.INTER_CUBIC) * amp
        total += amp
        amp *= 0.5
    return out / total


class Clouds:
    """Pencere ardında yavaş akan bulut katmanı."""

    def __init__(self, seed: int = 1):
        self.tex = _fbm((H, W * 2), seed)

    def layer(self, t, speed: float = 25.0, density: float = 0.55) -> np.ndarray:
        off = int(t * speed) % W
        tex = self.tex[:, off:off + W]
        return np.clip((tex - density) * 3.0, 0, 1)


class Fog:
    """Yerden yükselen, yavaş akan sis."""

    def __init__(self, seed: int = 2):
        self.tex = _fbm((H, W * 2), seed, octaves=3)
        self.vert = np.clip((_YS - H * 0.45) / (H * 0.55), 0, 1) ** 1.5

    def layer(self, t, speed: float = 18.0) -> np.ndarray:
        off = int(t * speed) % W
        return np.clip(self.tex[:, off:off + W] - 0.35, 0, 1) * self.vert


class RainOnGlass:
    """Cam yüzeyinde duran, ara ara aşağı kayan ve iz bırakan damlalar."""

    def __init__(self, box, count: int = 70, seed: int = 5):
        rng = np.random.default_rng(seed)
        x0, y0, x1, y1 = box
        self.box = box
        self.x = rng.uniform(x0, x1, count).astype(np.float32)
        self.y0 = rng.uniform(y0, y1, count).astype(np.float32)
        self.r = rng.uniform(2.0, 5.5, count).astype(np.float32)
        self.start = rng.uniform(0, 3.0, count).astype(np.float32)
        self.speed = rng.uniform(80, 420, count).astype(np.float32)

    def render(self, frame, t):
        light = np.zeros((H, W), np.float32)
        dark = np.zeros((H, W), np.float32)
        y1 = self.box[3]
        for x, y0, r, st, sp in zip(self.x, self.y0, self.r, self.start, self.speed):
            moving = max(0.0, t - st)
            y = y0 + sp * moving * (0.6 + 0.4 * math.sin(moving * 3 + x)) if r > 3.2 else y0
            y = y0 + (y - y0) % max(1.0, y1 - y0)
            if moving > 0 and r > 3.2:
                cv2.line(light, (int(x), int(max(y0, y - 120))), (int(x), int(y)), 0.18, 1, cv2.LINE_AA)
            cv2.circle(dark, (int(x + 1), int(y + 1)), int(r), 0.45, -1, cv2.LINE_AA)
            cv2.circle(light, (int(x - r * 0.3), int(y - r * 0.3)), max(1, int(r * 0.45)), 0.9, -1, cv2.LINE_AA)
        frame = frame * (1 - cv2.GaussianBlur(dark, (0, 0), 1.2)[..., None] * 0.6)
        return frame + cv2.GaussianBlur(light, (0, 0), 0.9)[..., None] * np.array([0.8, 0.9, 1.0], np.float32)
