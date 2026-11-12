"""Kare kare kompozisyon yardımcıları: katman yerleştirme, kamera, parçacıklar, doku efektleri.

Tüm kareler float32 RGB [0,1], boyut (H, W, 3). RGBA katmanlar ön çarpımlı (premultiplied) tutulur.
"""
from dataclasses import dataclass

import cv2
import numpy as np
from PIL import Image

W, H, FPS = 1080, 1920, 30


def load_rgb(path: str) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGB"), np.float32) / 255.0


def load_rgba(path: str) -> np.ndarray:
    """RGBA'yı ön çarpımlı float32 olarak yükler."""
    a = np.asarray(Image.open(path).convert("RGBA"), np.float32) / 255.0
    a[..., :3] *= a[..., 3:4]
    return a


def to_premult(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    return np.dstack([rgb * alpha[..., None], alpha]).astype(np.float32)


# --- yumuşatma eğrileri -------------------------------------------------------

def clamp01(x):
    return np.clip(x, 0.0, 1.0)


def smooth(x):
    x = clamp01(x)
    return x * x * (3 - 2 * x)


def ease_out(x, p: float = 3):
    return 1 - (1 - clamp01(x)) ** p


def ramp(t: float, t0: float, t1: float) -> float:
    return float(clamp01((t - t0) / max(1e-6, t1 - t0)))


# --- geometri ----------------------------------------------------------------

def affine(scale: float, src_pt, dst_pt, angle_deg: float = 0.0) -> np.ndarray:
    """src_pt noktasını dst_pt'ye götüren, ölçek+döndürme içeren 2x3 matris."""
    m = cv2.getRotationMatrix2D((float(src_pt[0]), float(src_pt[1])), angle_deg, scale)
    m[0, 2] += dst_pt[0] - src_pt[0]
    m[1, 2] += dst_pt[1] - src_pt[1]
    return m


def compose(outer: np.ndarray, inner: np.ndarray) -> np.ndarray:
    """outer ∘ inner (önce inner uygulanır)."""
    a = np.vstack([outer, [0, 0, 1]])
    b = np.vstack([inner, [0, 0, 1]])
    return (a @ b)[:2]


def warp(img: np.ndarray, m: np.ndarray, size=(W, H), border=cv2.BORDER_REPLICATE) -> np.ndarray:
    return cv2.warpAffine(img, m, size, flags=cv2.INTER_LINEAR, borderMode=border)


def warp_rgba(img: np.ndarray, m: np.ndarray, size=(W, H)) -> np.ndarray:
    return cv2.warpAffine(img, m, size, flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)


def over(dst: np.ndarray, layer: np.ndarray, opacity: float = 1.0) -> np.ndarray:
    """Ön çarpımlı RGBA katmanı dst üzerine yerleştirir."""
    a = layer[..., 3:4] * opacity
    return dst * (1 - a) + layer[..., :3] * opacity


def add_light(dst: np.ndarray, light: np.ndarray, color=(1.0, 0.72, 0.38), strength: float = 1.0) -> np.ndarray:
    return dst + light[..., None] * np.asarray(color, np.float32) * strength


def radial(cx: float, cy: float, radius: float, size=(W, H)) -> np.ndarray:
    xs = np.arange(size[0], dtype=np.float32)[None, :]
    ys = np.arange(size[1], dtype=np.float32)[:, None]
    d2 = (xs - cx) ** 2 + (ys - cy) ** 2
    return np.exp(-d2 / (2 * radius * radius)).astype(np.float32)


def cone(top_x: float, top_y: float, bottom_x: float, bottom_y: float, top_w: float, bottom_w: float,
         size=(W, H)) -> np.ndarray:
    """Yukarıdan aşağı inen yumuşak spot ışığı hüzmesi maskesi."""
    xs = np.arange(size[0], dtype=np.float32)[None, :]
    ys = np.arange(size[1], dtype=np.float32)[:, None]
    k = np.clip((ys - top_y) / max(1.0, bottom_y - top_y), 0, 1)
    cx = top_x + (bottom_x - top_x) * k
    half = (top_w + (bottom_w - top_w) * k) / 2
    lateral = np.exp(-((xs - cx) / (half + 1e-3)) ** 2 * 2.2)
    vertical = np.where(ys < top_y, 0, 1) * (0.35 + 0.65 * k) * np.where(ys > bottom_y, np.exp(-(ys - bottom_y) / 60), 1)
    return (lateral * vertical).astype(np.float32)


def blur(img: np.ndarray, sigma: float) -> np.ndarray:
    if sigma < 0.3:
        return img
    return cv2.GaussianBlur(img, (0, 0), sigma)


# --- parçacıklar --------------------------------------------------------------

@dataclass
class Particles:
    """Basit parçacık sistemi (toz, kor, yağmur, cam kırıntısı)."""
    pos: np.ndarray
    vel: np.ndarray
    size: np.ndarray
    bright: np.ndarray
    phase: np.ndarray

    @classmethod
    def spawn(cls, n, box, vel_mean, vel_jitter, size_rng, seed=0):
        rng = np.random.default_rng(seed)
        x0, y0, x1, y1 = box
        pos = np.c_[rng.uniform(x0, x1, n), rng.uniform(y0, y1, n)].astype(np.float32)
        vel = (np.asarray(vel_mean, np.float32) + rng.normal(0, 1, (n, 2)) * np.asarray(vel_jitter, np.float32))
        return cls(pos, vel.astype(np.float32), rng.uniform(*size_rng, n).astype(np.float32),
                   rng.uniform(0.3, 1.0, n).astype(np.float32), rng.uniform(0, 6.28, n).astype(np.float32))

    def at(self, t: float, wrap_box=None) -> np.ndarray:
        p = self.pos + self.vel * t + np.c_[np.sin(t * 0.9 + self.phase) * 6, np.cos(t * 0.7 + self.phase) * 4]
        if wrap_box is not None:
            x0, y0, x1, y1 = wrap_box
            p[:, 0] = x0 + np.mod(p[:, 0] - x0, x1 - x0)
            p[:, 1] = y0 + np.mod(p[:, 1] - y0, y1 - y0)
        return p


def draw_dots(points: np.ndarray, sizes: np.ndarray, bright: np.ndarray, size=(W, H)) -> np.ndarray:
    layer = np.zeros((size[1], size[0]), np.float32)
    for (x, y), s, b in zip(points, sizes, bright):
        if -10 < x < size[0] + 10 and -10 < y < size[1] + 10:
            cv2.circle(layer, (int(x), int(y)), max(1, int(s)), float(b), -1, lineType=cv2.LINE_AA)
    return cv2.GaussianBlur(layer, (0, 0), 1.2)


def draw_streaks(points: np.ndarray, length: float, angle_deg: float, alpha: np.ndarray, size=(W, H)) -> np.ndarray:
    layer = np.zeros((size[1], size[0]), np.float32)
    dx, dy = np.sin(np.radians(angle_deg)) * length, np.cos(np.radians(angle_deg)) * length
    for (x, y), a in zip(points, alpha):
        cv2.line(layer, (int(x), int(y)), (int(x + dx), int(y + dy)), float(a), 1, lineType=cv2.LINE_AA)
    return layer


# --- doku ve son işlem ------------------------------------------------------

class Finisher:
    """Çizgi titreşimi (line boil), film greni ve vinyet."""

    def __init__(self, boil_px: float = 0.9, grain: float = 0.022, seed: int = 3):
        rng = np.random.default_rng(seed)
        ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
        self.fields = []
        for _ in range(4):
            dx = cv2.resize(rng.normal(0, 1, (48, 27)).astype(np.float32), (W, H), interpolation=cv2.INTER_CUBIC)
            dy = cv2.resize(rng.normal(0, 1, (48, 27)).astype(np.float32), (W, H), interpolation=cv2.INTER_CUBIC)
            self.fields.append((xs + dx * boil_px, ys + dy * boil_px))
        r = np.sqrt(((xs - W / 2) / (W * 0.75)) ** 2 + ((ys - H / 2) / (H * 0.7)) ** 2)
        self.vignette = (1 - 0.38 * smooth(r))[..., None].astype(np.float32)
        self.grain = grain
        self.rng = rng

    def boil(self, frame: np.ndarray, index: int) -> np.ndarray:
        mx, my = self.fields[(index // 3) % len(self.fields)]
        return cv2.remap(frame, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)

    def finish(self, frame: np.ndarray, index: int = 0) -> np.ndarray:
        if index % 2 == 0 or not hasattr(self, "_g"):
            g = self.rng.normal(0, self.grain, (H // 2, W // 2)).astype(np.float32)
            self._g = cv2.resize(g, (W, H), interpolation=cv2.INTER_LINEAR)[..., None]
        return np.clip(frame * self.vignette + self._g, 0, 1)


def to_bytes(frame: np.ndarray) -> bytes:
    return (np.clip(frame, 0, 1) * 255 + 0.5).astype(np.uint8).tobytes()
