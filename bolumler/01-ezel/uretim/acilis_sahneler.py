"""Ezel açılışı (0-17 sn): beş sahnenin kare kare çizimi.

Kaynak görseller 1024x1536; çıktı 1080x1920. Her sahne `render(t)` ile global zamana göre kare üretir.
"""
import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from gorsel import (H, W, Particles, add_light, affine, compose, cone, draw_dots, draw_streaks, ease_out,
                    load_rgb, load_rgba, over, radial, ramp, smooth, to_premult, warp, warp_rgba, blur)

EP = Path(__file__).resolve().parents[1]
IMG, LAY = EP / "gorseller", EP / "uretim" / "katmanlar"
FONT_DIR = Path(__file__).resolve().parent / "fontlar"
INTER_BOLD = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"
INTER_SEMI = "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"


def apply_pt(m, p):
    return m[0, 0] * p[0] + m[0, 1] * p[1] + m[0, 2], m[1, 0] * p[0] + m[1, 1] * p[1] + m[1, 2]


def inpaint(img: np.ndarray, mask: np.ndarray, radius: int = 9) -> np.ndarray:
    u8 = (np.clip(img, 0, 1) * 255).astype(np.uint8)
    out = cv2.inpaint(u8, mask.astype(np.uint8) * 255, radius, cv2.INPAINT_TELEA)
    return out.astype(np.float32) / 255.0


def dilate(mask: np.ndarray, px: int) -> np.ndarray:
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * px + 1, 2 * px + 1))
    return cv2.dilate(mask.astype(np.uint8), k) > 0


def text_sprite(text: str, font_path: str, size: int, color, tracking: int = 0, stroke: int = 0) -> np.ndarray:
    """Harf aralıklı metni ön çarpımlı RGBA sprite olarak çizer."""
    font = ImageFont.truetype(font_path, size)
    widths = [font.getbbox(ch)[2] - font.getbbox(ch)[0] if ch != " " else size // 3 for ch in text]
    w = sum(widths) + tracking * (len(text) - 1) + 2 * size
    img = Image.new("RGBA", (int(w), int(size * 2)), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x = size
    for ch, cw in zip(text, widths):
        if ch != " ":
            d.text((x - font.getbbox(ch)[0], size // 2), ch, font=font, fill=color,
                   stroke_width=stroke, stroke_fill=(10, 8, 6))
        x += cw + tracking
    arr = np.asarray(img.crop(img.getbbox()), np.float32) / 255.0
    arr[..., :3] *= arr[..., 3:4]
    return arr


def paste(frame, sprite, cx, cy, opacity=1.0, scale=1.0):
    if opacity <= 0.001:
        return frame
    m = affine(scale, (sprite.shape[1] / 2, sprite.shape[0] / 2), (cx, cy))
    return over(frame, warp_rgba(sprite, m), opacity)


# --------------------------------------------------------------------------------------------------
class ShotA1:
    """Hastane odası: sallanan ampul, kayan ışık, titreme, toz, derinlik."""
    PIVOT, BULB = (515.0, 0.0), (516.0, 282.0)
    T0 = 0.0

    def __init__(self, t1: float):
        self.T1 = t1
        img = load_rgb(IMG / "A1.png")
        man = load_rgba(LAY / "A1_adam_u2net.png")
        bulb = np.zeros(img.shape[:2], np.uint8)
        cv2.rectangle(bulb, (509, 0), (522, 194), 1, -1)
        cv2.rectangle(bulb, (497, 186), (535, 250), 1, -1)
        cv2.ellipse(bulb, (516, 281), (32, 35), 0, 0, 360, 1, -1)
        bulb_soft = cv2.GaussianBlur(dilate(bulb, 2).astype(np.float32), (0, 0), 1.0)
        self.bulb = to_premult(img, bulb_soft)
        self.man = man
        self.bg = inpaint(img, dilate(man[..., 3] > 0.3, 14) | dilate(bulb, 5))
        self.dust = Particles.spawn(90, (180, 150, 900, 1500), (3, -9), (5, 5), (1.0, 2.4), seed=11)

    @staticmethod
    def flicker(t):
        for a, b in ((0.95, 1.01), (1.52, 1.56), (1.60, 1.64)):
            if a <= t < b:
                return 0.3
        return 1.0

    def render(self, t):
        u = smooth((t - self.T0) / (self.T1 - self.T0))
        cam = affine(1.27 + 0.05 * u, (512, 760), (540, 960))
        frame = warp(self.bg, cam)
        fg = compose(affine(1 + 0.04 * u, (540, 1000), (540, 1000)), cam)
        frame = over(frame, warp_rgba(self.man, fg))
        ang = 5.5 * math.sin(2 * math.pi * t / 1.9 + 0.5)
        m_bulb = compose(cam, affine(1.0, self.PIVOT, self.PIVOT, ang))
        frame = over(frame, warp_rgba(self.bulb, m_bulb))
        bx, by = apply_pt(m_bulb, self.BULB)
        f = self.flicker(t)
        pool = radial(bx, by + 430, 560)
        frame = frame * (0.78 + 0.34 * pool[..., None] * f) * (0.55 + 0.45 * f)
        frame = add_light(frame, radial(bx, by, 80), strength=0.9 * f)
        dust = draw_dots(self.dust.at(t), self.dust.size, self.dust.bright)
        frame = add_light(frame, dust * pool * f, color=(1.0, 0.86, 0.6), strength=0.8)
        return frame * ramp(t, 0.05, 0.4)


# --------------------------------------------------------------------------------------------------
class ShotA2:
    """Ayna: çatlak büyür, 'değiştirip' anında kırılır, yeni yüz ani zoom ile belirir."""
    IMPACT = (690.0, 330.0)
    GLASS = (238, 218, 766, 1050)

    def __init__(self, t0, t_shatter, t1):
        self.T0, self.TS, self.T1 = t0, t_shatter, t1
        self.a = load_rgb(IMG / "A2a.png")
        self.b = load_rgb(IMG / "A2b.png")
        x0, y0, x1, y1 = self.GLASS
        mask = np.zeros(self.a.shape[:2], np.uint8)
        cv2.rectangle(mask, (x0, y0), (x1, y1), 1, -1)
        self.glass = mask.astype(np.float32)
        self.segs = self._cracks(np.random.default_rng(5))
        self.max_d = max(s[4] for s in self.segs)
        self.cracked = self._draw_cracks(self.a, 1e9)
        self.shards = self._shards(np.random.default_rng(9))
        self.glints = None

    def _walk(self, rng, x, y, ang, d, steps, out, depth=0):
        x0, y0, x1, y1 = self.GLASS
        for _ in range(steps):
            ln = rng.uniform(14, 34)
            ang += rng.normal(0, 0.3)
            nx, ny = x + math.cos(ang) * ln, y + math.sin(ang) * ln
            out.append((x, y, nx, ny, d + ln))
            if depth < 2 and rng.random() < 0.14:
                self._walk(rng, nx, ny, ang + rng.choice([-0.8, 0.8]), d + ln, int(rng.integers(3, 9)), out, depth + 1)
            x, y, d = nx, ny, d + ln
            if not (x0 - 20 < x < x1 + 20 and y0 - 20 < y < y1 + 20):
                break

    def _cracks(self, rng):
        segs = []
        for k in range(12):
            ang = 2 * math.pi * k / 12 + rng.uniform(-0.25, 0.25)
            self._walk(rng, *self.IMPACT, ang, 0.0, int(rng.integers(12, 34)), segs)
        cx, cy = self.IMPACT
        for r in (30, 58):
            pts = [(cx + math.cos(a) * r * rng.uniform(0.85, 1.15), cy + math.sin(a) * r * rng.uniform(0.85, 1.15))
                   for a in np.linspace(0, 2 * math.pi, 14)]
            for p, q in zip(pts, pts[1:]):
                segs.append((*p, *q, r * 3.0))
        return segs

    def _draw_cracks(self, base, reach):
        dark = np.zeros(base.shape[:2], np.float32)
        light = np.zeros(base.shape[:2], np.float32)
        for x0, y0, x1, y1, d in self.segs:
            if d <= reach:
                p, q = (int(x0), int(y0)), (int(x1), int(y1))
                cv2.line(dark, (p[0] + 1, p[1] + 1), (q[0] + 1, q[1] + 1), 1.0, 3, cv2.LINE_AA)
                cv2.line(light, p, q, 1.0, 1, cv2.LINE_AA)
        dark *= self.glass * 0.7
        light *= self.glass
        out = base * (1 - dark[..., None]) + light[..., None] * 0.95
        return out.astype(np.float32)

    def _shards(self, rng):
        x0, y0, x1, y1 = self.GLASS
        sub = cv2.Subdiv2D((x0 - 5, y0 - 5, x1 - x0 + 10, y1 - y0 + 10))
        for _ in range(46):
            r = abs(rng.normal(0, 210))
            a = rng.uniform(0, 2 * math.pi)
            px = float(np.clip(self.IMPACT[0] + math.cos(a) * r, x0 + 1, x1 - 1))
            py = float(np.clip(self.IMPACT[1] + math.sin(a) * r * 1.6, y0 + 1, y1 - 1))
            sub.insert((px, py))
        facets, centers = sub.getVoronoiFacetList([])
        shards = []
        for poly, c in zip(facets, centers):
            m = np.zeros(self.a.shape[:2], np.uint8)
            cv2.fillPoly(m, [poly.astype(np.int32)], 1)
            m = m * self.glass.astype(np.uint8)
            ys, xs = np.nonzero(m)
            if len(xs) < 50:
                continue
            bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
            alpha = cv2.GaussianBlur(m[by0:by1, bx0:bx1].astype(np.float32), (0, 0), 0.7)
            spr = to_premult(self.cracked[by0:by1, bx0:bx1], alpha)
            cx, cy = (bx0 + bx1) / 2, (by0 + by1) / 2
            vx, vy = cx - self.IMPACT[0], cy - self.IMPACT[1]
            n = math.hypot(vx, vy) + 1e-3
            speed = rng.uniform(260, 820) * (0.6 + 120 / (n + 120))
            shards.append({"spr": spr, "off": (bx0, by0), "c": (cx, cy), "v": (vx / n * speed, vy / n * speed),
                           "w": rng.uniform(-260, 260)})
        return shards

    def camera(self, t):
        u = smooth((t - self.T0) / (self.TS - self.T0))
        shake = 3.0 * u * u
        sx, sy = math.sin(t * 61) * shake, math.cos(t * 47) * shake
        if t < self.TS:
            return affine(1.27 + 0.05 * u, (512, 600), (540 + sx, 930 + sy))
        tau = t - self.TS
        s = 1.32 * (1 + 0.15 * ease_out(tau / 0.22)) + 0.025 * tau
        return affine(s, (512, 565), (540, 880))

    def render(self, t):
        cam = self.camera(t)
        if t < self.TS:
            reach = self.max_d * ((t - self.T0) / (self.TS - self.T0)) ** 1.7 if t > self.T0 + 0.12 else -1
            return warp(self._draw_cracks(self.a, reach), cam)
        tau = t - self.TS
        frame = warp(self.b, cam)
        pre_cam = self.camera(self.TS - 1e-3)
        frame = self._draw_shards(frame, pre_cam, tau)
        frame = self._draw_glints(frame, pre_cam, tau)
        return frame + 0.9 * math.exp(-tau / 0.05)

    def _draw_shards(self, frame, cam, tau):
        if tau > 0.75:
            return frame
        alpha = 1 - smooth(tau / 0.6)
        for s in self.shards:
            cx, cy = s["c"]
            dx, dy = s["v"][0] * tau, s["v"][1] * tau + 1300 * tau * tau
            local = affine(1 + 0.4 * tau, (cx - s["off"][0], cy - s["off"][1]), (cx + dx, cy + dy), s["w"] * tau)
            frame = over(frame, warp_rgba(s["spr"], compose(cam, local)), alpha)
        return frame

    def _draw_glints(self, frame, cam, tau):
        if tau > 0.8:
            return frame
        if self.glints is None:
            ix, iy = apply_pt(cam, self.IMPACT)
            rng = np.random.default_rng(4)
            ang = rng.uniform(0, 2 * math.pi, 90)
            spd = rng.uniform(300, 1700, 90)
            self.glints = (ix, iy, np.c_[np.cos(ang) * spd, np.sin(ang) * spd], rng.uniform(1, 3.2, 90))
        ix, iy, vel, size = self.glints
        pts = np.c_[ix + vel[:, 0] * tau, iy + vel[:, 1] * tau + 1500 * tau * tau]
        dots = draw_dots(pts, size, np.full(len(size), 1.0 - tau / 0.8))
        return add_light(frame, dots, color=(1.0, 0.95, 0.85), strength=1.4)


# --------------------------------------------------------------------------------------------------
class ShotA3:
    """Yağmurlu camın ardındaki davet; odak Ezel'den üçlüye kayar."""

    def __init__(self, t0, t_focus, t1):
        self.T0, self.TF, self.T1 = t0, t_focus, t1
        self.bg = load_rgb(IMG / "A3-BG.png")
        self.fg = load_rgba(LAY / "ezel_arka.png")
        self.rain = Particles.spawn(320, (-100, -200, W + 100, H), (140, 2000), (30, 300), (60, 120), seed=21)
        self.bg_blurs = {}

    def render(self, t):
        u = smooth((t - self.T0) / (self.T1 - self.T0))
        focus = smooth((t - self.TF + 0.15) / 0.7)
        cam = affine(1.40 + 0.04 * u, (630, 760), (540, 830))
        bg = warp(self.bg, cam)
        frame = blur(bg, 5.0 * (1 - focus))
        fg_cam = affine(1.00 + 0.07 * u, (510, 360), (300, 1400))
        fg = warp_rgba(self.fg, fg_cam)
        if focus > 0.05:
            fg = blur(fg, 3.0 * focus)
        frame = over(frame, fg)
        pts = self.rain.at(t - self.T0, wrap_box=(-100, -200, W + 100, H + 100))
        streaks = draw_streaks(pts, self.rain.size.mean(), 4.0, self.rain.bright * 0.3)
        frame = add_light(frame, streaks, color=(0.75, 0.9, 1.0), strength=0.9)
        fade = ramp(t, self.T0, self.T0 + 0.12) * (1 - ramp(t, self.T1 - 0.12, self.T1))
        return frame * fade


# --------------------------------------------------------------------------------------------------
class ShotA4:
    """Karanlık satranç tahtası; taşlar adları söylendikçe spotla aydınlanır."""
    # (taş dosyası, merkez x, taban y, ölçek, etiket)
    PIECES = [("tas_0.png", 255, 1130, 0.95, "CENGİZ"), ("tas_1.png", 540, 1090, 0.85, "ALİ"),
              ("tas_2.png", 825, 1130, 0.95, "EYŞAN")]

    def __init__(self, t0, reveals, t1):
        self.T0, self.R, self.T1 = t0, reveals, t1
        self.bg = load_rgb(IMG / "A4-BG.png")
        self.pieces = [load_rgba(LAY / f) for f, *_ in self.PIECES]
        self.labels = [text_sprite(p[4], INTER_BOLD, 46, (240, 190, 108), tracking=7, stroke=4) for p in self.PIECES]
        self.dust = Particles.spawn(140, (0, 0, W, 1300), (0, -6), (4, 4), (0.8, 2.0), seed=31)

    def render(self, t):
        u = smooth((t - self.T0) / (self.T1 - self.T0))
        drift = affine(1 + 0.04 * u, (540, 960), (540 - 18 * u, 960))
        frame = warp(self.bg, compose(drift, affine(1.42, (512, 940), (540, 1060))))
        lights = np.zeros((H, W), np.float32)
        lit = [smooth((t - r) / 0.25) for r in self.R]
        for (f, cx, base, sc, _), k in zip(self.PIECES, lit):
            if k > 0:
                lights = np.maximum(lights, cone(cx, -80, cx, base, 140, 420) * k)
        frame = frame * (0.28 + 0.95 * lights[..., None])
        pdrift = affine(1 + 0.05 * u, (540, 960), (540 - 32 * u, 960))
        for spr, (f, cx, base, sc, _), k, lab in zip(self.pieces, self.PIECES, lit, self.labels):
            frame = self._piece(frame, spr, compose(pdrift, affine(sc, (spr.shape[1] / 2, spr.shape[0]), (cx, base))),
                                k)
            frame = paste(frame, lab, cx - 32 * u, base + 70, opacity=smooth((k - 0.4) / 0.6))
        frame = add_light(frame, lights * 0.18, strength=1.0)
        dust = draw_dots(self.dust.at(t), self.dust.size, self.dust.bright) * lights
        frame = add_light(frame, dust, color=(1.0, 0.85, 0.55), strength=1.2)
        fade = ramp(t, self.T0, self.T0 + 0.15) * (1 - ramp(t, self.T1 - 0.08, self.T1))
        return frame * fade

    @staticmethod
    def _piece(frame, spr, m, k):
        layer = warp_rgba(spr, m)
        shadow = cv2.GaussianBlur(layer[..., 3], (0, 0), 9) * 0.55
        frame = frame * (1 - shadow[..., None] * 0.6)
        flash = 1 + 0.3 * math.sin(math.pi * min(1.0, k)) * (k < 1)
        lit = layer.copy()
        lit[..., :3] *= (0.10 + 0.95 * k) * flash
        return over(frame, lit)


# --------------------------------------------------------------------------------------------------
class ShotA5:
    """Başlık kartı: siyah piyon, 'EZEL' darbesi, ışık süpürmesi, yükselen korlar."""

    def __init__(self, t0, t_hit, t_fade, t1):
        self.T0, self.TH, self.TF, self.T1 = t0, t_hit, t_fade, t1
        bg = load_rgb(IMG / "A4-BG.png")
        self.bg = warp(bg, affine(1.42, (512, 940), (540, 1180))) * 0.30
        whites = [load_rgba(LAY / f"tas_{i}.png") for i in range(3)]
        for spr, x in zip(whites, (390, 540, 690)):
            layer = warp_rgba(spr, affine(0.38, (spr.shape[1] / 2, spr.shape[0]), (x, 1150)))
            layer[..., :3] *= 0.42
            self.bg = over(self.bg, blur(layer, 2.2))
        self.pawn = load_rgba(LAY / "tas_3.png")
        self.title = self._title()
        self.sub = text_sprite("BİR PİYONUN İNTİKAMI", INTER_SEMI, 44, (228, 186, 120), tracking=9)
        self.embers = Particles.spawn(110, (0, 600, W, H + 200), (0, -110), (25, 40), (1.0, 2.6), seed=41)

    def _title(self):
        spr = text_sprite("EZEL", str(FONT_DIR / "Cinzel-900.ttf"), 250, (255, 255, 255), tracking=40, stroke=0)
        a = spr[..., 3]
        h = a.shape[0]
        grad = np.linspace(0, 1, h)[:, None]
        top, bot = np.array([1.0, 0.86, 0.55]), np.array([0.62, 0.40, 0.16])
        rgb = (top * (1 - grad[..., None]) + bot * grad[..., None]) * a[..., None]
        out = np.dstack([rgb, a]).astype(np.float32)
        edge = cv2.dilate(a, np.ones((7, 7), np.uint8))
        shadow = np.dstack([np.zeros_like(rgb), edge * 0.85]).astype(np.float32)
        return shadow * (1 - a[..., None]) + out

    def render(self, t):
        if t < self.TH:
            return np.zeros((H, W, 3), np.float32)
        tau = t - self.TH
        shake = 11 * math.exp(-tau / 0.12)
        sx, sy = math.sin(tau * 90) * shake, math.cos(tau * 70) * shake
        push = affine(1 + 0.035 * smooth(tau / 4.5), (540, 960), (540 + sx, 960 + sy))
        frame = warp(self.bg, push)
        frame = add_light(frame, radial(540 + sx, 1500 + sy, 360) * 0.55)
        pawn = warp_rgba(self.pawn, compose(push, affine(1.55, (self.pawn.shape[1] / 2, self.pawn.shape[0]), (540, 1980))))
        frame = over(frame, pawn)
        s = 1 + 0.3 * (1 - ease_out(tau / 0.22))
        frame = paste(frame, self.title, 540 + sx, 690 + sy, opacity=min(1, tau / 0.05), scale=s)
        frame = self._sweep(frame, tau)
        frame = paste(frame, self.sub, 540, 860, opacity=smooth((tau - 0.35) / 0.4))
        emb = self.embers.at(tau)
        flick = 0.5 + 0.5 * np.sin(tau * 9 + self.embers.phase)
        frame = add_light(frame, draw_dots(emb, self.embers.size, self.embers.bright * flick), strength=1.3)
        frame = frame + 0.7 * math.exp(-tau / 0.06)
        return frame * (1 - ramp(t, self.TF, self.T1))

    def _sweep(self, frame, tau):
        p = (tau - 0.55) / 0.9
        if not 0 < p < 1:
            return frame
        xs = np.arange(W, dtype=np.float32)[None, :]
        ys = np.arange(H, dtype=np.float32)[:, None]
        band = np.exp(-(((xs + ys * 0.45) - (-200 + p * 1700)) / 70) ** 2)
        region = np.zeros((H, W), np.float32)
        region[560:820] = 1
        lum = frame.mean(axis=2)
        mask = band * region * np.clip((lum - 0.35) * 2.5, 0, 1)
        return add_light(frame, mask, color=(1.0, 0.92, 0.75), strength=0.8)
