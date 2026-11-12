"""Ezel açılışı: beş sahnenin kare kare çizimi (2.5D kamera + canlı ortam efektleri).

Kaynak görseller 1024x1536; çıktı 1080x1920. Her sahne `render(t)` ile global zamana göre kare üretir.
"""
import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from gorsel import (H, W, Particles, add_light, affine, blur, compose, cone, draw_dots, draw_streaks,
                    ease_out, load_rgb, load_rgba, over, radial, ramp, smooth, to_premult, warp, warp_rgba)
from hareket import (Clouds, DepthCam, Fog, RainOnGlass, breathe, draw_sparkles, flicker_value, light_mask,
                     lightning, rotate_region, shimmer, sparkle_points, src_mask, sway, to_scr, to_screen)

EP = Path(__file__).resolve().parents[1]
IMG, LAY = EP / "gorseller", EP / "uretim" / "katmanlar"
FONT_DIR = Path(__file__).resolve().parent / "fontlar"
INTER_BOLD = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"
INTER_SEMI = "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"


def load_depth(name: str) -> np.ndarray:
    return np.asarray(Image.open(LAY / f"{name}_derinlik.png"), np.float32) / 65535.0


def inpaint(img: np.ndarray, mask: np.ndarray, radius: int = 9) -> np.ndarray:
    u8 = (np.clip(img, 0, 1) * 255).astype(np.uint8)
    out = cv2.inpaint(u8, mask.astype(np.uint8) * 255, radius, cv2.INPAINT_TELEA)
    return out.astype(np.float32) / 255.0


def dilate(mask: np.ndarray, px: int) -> np.ndarray:
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * px + 1, 2 * px + 1))
    return cv2.dilate(mask.astype(np.uint8), k) > 0


def map_points(points: np.ndarray, m) -> np.ndarray:
    return points @ m[:, :2].T + m[:, 2]


def text_sprite(text: str, font_path: str, size: int, color, tracking: int = 0, stroke: int = 0) -> np.ndarray:
    """Harf aralıklı metni ön çarpımlı RGBA sprite olarak çizer (taban çizgisi sabit)."""
    font = ImageFont.truetype(font_path, size)
    widths = [font.getbbox(ch)[2] - font.getbbox(ch)[0] if ch != " " else size // 3 for ch in text]
    w = sum(widths) + tracking * (len(text) - 1) + 2 * size
    img = Image.new("RGBA", (int(w), int(size * 2)), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x = size
    for ch, cw in zip(text, widths):
        if ch != " ":
            d.text((x - font.getbbox(ch)[0], int(size * 1.5)), ch, font=font, fill=color, anchor="ls",
                   stroke_width=stroke, stroke_fill=(10, 8, 6))
        x += cw + tracking
    box = img.getbbox() or (0, 0, 1, 1)
    arr = np.asarray(img.crop(box), np.float32) / 255.0
    arr[..., :3] *= arr[..., 3:4]
    return arr


def paste(frame, sprite, cx, cy, opacity=1.0, scale=1.0):
    if opacity <= 0.001:
        return frame
    m = affine(scale, (sprite.shape[1] / 2, sprite.shape[0] / 2), (cx, cy))
    return over(frame, warp_rgba(sprite, m), opacity)


def tint_window(frame, mask, clouds):
    c = (mask * clouds)[..., None]
    return frame * (1 - 0.35 * c) + c * np.array([0.22, 0.30, 0.34], np.float32) * 0.6


# --------------------------------------------------------------------------------------------------
class ShotA1:
    """Hastane: kamera odaya girer, adam nefes alır ve başını çevirir, ampul sallanır, bulutlar akar."""
    PIVOT, BULB = (515.0, 0.0), (516.0, 282.0)

    def __init__(self, t1: float, t_turn: float):
        self.T1, self.TT = t1, t_turn
        img = load_rgb(IMG / "A1.png")
        bulb = np.zeros(img.shape[:2], np.uint8)
        cv2.rectangle(bulb, (509, 0), (522, 194), 1, -1)
        cv2.rectangle(bulb, (497, 186), (535, 250), 1, -1)
        cv2.ellipse(bulb, (516, 281), (32, 35), 0, 0, 360, 1, -1)
        self.bulb = to_premult(img, cv2.GaussianBlur(dilate(bulb, 2).astype(np.float32), (0, 0), 1.0))
        self.cam = DepthCam(inpaint(img, dilate(bulb, 5)), load_depth("A1"), focus=0.55)
        sh = img.shape
        self.m_chest = src_mask(sh, ellipses=[((512, 790), (175, 125))], feather=40)
        self.m_head = src_mask(sh, ellipses=[((514, 528), (82, 98))], feather=16)
        self.m_window = src_mask(sh, boxes=[(6, 40, 204, 640)], feather=5)
        self.clouds = Clouds(3)
        self.dust = Particles.spawn(90, (180, 150, 900, 1500), (3, -9), (5, 5), (1.0, 2.4), seed=11)

    @staticmethod
    def flicker(t):
        for a, b in ((0.95, 1.01), (1.52, 1.56), (1.60, 1.64)):
            if a <= t < b:
                return 0.3
        return 1.0

    def render(self, t):
        u = smooth(t / self.T1)
        m = affine(1.26 + 0.07 * u, (512, 760), (540, 960))
        s = m[0, 0]
        frame = self.cam.render(m, shift=(-24 * u, -6 * u), dolly=0.10 * u)
        frame = breathe(frame, to_scr(self.m_chest, m), to_screen((512, 790), m), (175 * s, 125 * s), t, 5.0, 0.4)
        turn = smooth((t - self.TT + 0.4) / 0.9)
        frame = rotate_region(frame, to_screen((514, 612), m), to_scr(self.m_head, m), -4.5 * turn)
        frame = tint_window(frame, to_scr(self.m_window, m), self.clouds.layer(t, 45))
        frame = self._drip(frame, m, t)
        ang = 5.5 * math.sin(2 * math.pi * t / 1.9 + 0.5)
        m_bulb = compose(m, affine(1.0, self.PIVOT, self.PIVOT, ang))
        frame = over(frame, warp_rgba(self.bulb, m_bulb))
        bx, by = to_screen(self.BULB, m_bulb)
        f = self.flicker(t)
        pool = radial(bx, by + 430, 560)
        frame = frame * (0.78 + 0.34 * pool[..., None] * f) * (0.55 + 0.45 * f)
        frame = add_light(frame, radial(bx, by, 80), strength=0.9 * f)
        dust = draw_dots(self.dust.at(t), self.dust.size, self.dust.bright)
        frame = add_light(frame, dust * pool * f, color=(1.0, 0.86, 0.6), strength=0.8)
        return frame * ramp(t, 0.05, 0.4)

    @staticmethod
    def _drip(frame, m, t):
        p = (t % 0.9) / 0.25
        if p > 1:
            return frame
        x, y = to_screen((876, 500 + 45 * p * p), m)
        return add_light(frame, radial(x, y, 3.5) * (1 - p * 0.5), color=(0.8, 0.95, 1.0), strength=1.5)


# --------------------------------------------------------------------------------------------------
class ShotA2:
    """Ayna: lamba titrer, bulutlar akar, havlu sallanır; çatlak büyür, ayna kırılır, yeni yüz belirir."""
    IMPACT = (690.0, 330.0)
    GLASS = (238, 218, 766, 1050)
    LAMP = (582.0, 165.0)

    def __init__(self, t0, t_shatter, t1):
        self.T0, self.TS, self.T1 = t0, t_shatter, t1
        self.a = load_rgb(IMG / "A2a.png")
        self.b = load_rgb(IMG / "A2b.png")
        self.cam_a = DepthCam(self.a, load_depth("A2a"), focus=0.35)
        self.cam_b = DepthCam(self.b, load_depth("A2b"), focus=0.35)
        x0, y0, x1, y1 = self.GLASS
        mask = np.zeros(self.a.shape[:2], np.uint8)
        cv2.rectangle(mask, (x0, y0), (x1, y1), 1, -1)
        self.glass = mask.astype(np.float32)
        sh = self.a.shape
        self.m_window = src_mask(sh, boxes=[(5, 36, 148, 594)], feather=4)
        self.m_towel = src_mask(sh, boxes=[(0, 780, 108, 1236)], feather=10)
        self.m_back = src_mask(sh, ellipses=[((905, 1180), (300, 290))], feather=60)
        self.clouds = Clouds(7)
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
        out = base * (1 - (dark * self.glass * 0.7)[..., None]) + (light * self.glass)[..., None] * 0.95
        return out.astype(np.float32)

    def _shards(self, rng):
        x0, y0, x1, y1 = self.GLASS
        sub = cv2.Subdiv2D((x0 - 5, y0 - 5, x1 - x0 + 10, y1 - y0 + 10))
        for _ in range(46):
            r, a = abs(rng.normal(0, 210)), rng.uniform(0, 2 * math.pi)
            sub.insert((float(np.clip(self.IMPACT[0] + math.cos(a) * r, x0 + 1, x1 - 1)),
                        float(np.clip(self.IMPACT[1] + math.sin(a) * r * 1.6, y0 + 1, y1 - 1))))
        facets, _ = sub.getVoronoiFacetList([])
        shards = []
        for poly in facets:
            m = np.zeros(self.a.shape[:2], np.uint8)
            cv2.fillPoly(m, [poly.astype(np.int32)], 1)
            m = m * self.glass.astype(np.uint8)
            ys, xs = np.nonzero(m)
            if len(xs) < 50:
                continue
            bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
            alpha = cv2.GaussianBlur(m[by0:by1, bx0:bx1].astype(np.float32), (0, 0), 0.7)
            cx, cy = (bx0 + bx1) / 2, (by0 + by1) / 2
            vx, vy = cx - self.IMPACT[0], cy - self.IMPACT[1]
            n = math.hypot(vx, vy) + 1e-3
            speed = rng.uniform(260, 820) * (0.6 + 120 / (n + 120))
            shards.append({"spr": to_premult(self.cracked[by0:by1, bx0:bx1], alpha), "off": (bx0, by0),
                           "c": (cx, cy), "v": (vx / n * speed, vy / n * speed), "w": rng.uniform(-260, 260)})
        return shards

    def camera(self, t):
        u = smooth((t - self.T0) / (self.TS - self.T0))
        shake = 3.0 * u * u
        if t < self.TS:
            return affine(1.27 + 0.05 * u, (512, 600), (540 + math.sin(t * 61) * shake, 930 + math.cos(t * 47) * shake))
        tau = t - self.TS
        return affine(1.32 * (1 + 0.15 * ease_out(tau / 0.22)) + 0.025 * tau, (512, 565), (540, 880))

    def _living(self, frame, m, t):
        s = m[0, 0]
        frame = tint_window(frame, to_scr(self.m_window, m), self.clouds.layer(t, 38))
        frame = sway(frame, to_scr(self.m_towel, m), t, 3.0, 0.3, top_y=to_screen((0, 780), m)[1], length=450 * s)
        frame = breathe(frame, to_scr(self.m_back, m), to_screen((905, 1180), m), (300 * s, 290 * s), t, 6.0, 0.33)
        f = flicker_value(t, seed=2, depth=0.22)
        lx, ly = to_screen(self.LAMP, m)
        frame = frame * (0.9 + 0.1 * f)
        return add_light(frame, radial(lx, ly, 70 * s), strength=0.45 * f)

    def render(self, t):
        m = self.camera(t)
        u = smooth((t - self.T0) / (self.T1 - self.T0))
        if t < self.TS:
            reach = self.max_d * ((t - self.T0) / (self.TS - self.T0)) ** 1.7 if t > self.T0 + 0.12 else -1
            frame = self.cam_a.render(m, shift=(16 * u, 0), dolly=0.06 * u, img=self._draw_cracks(self.a, reach))
            return self._living(frame, m, t)
        tau = t - self.TS
        frame = self._living(self.cam_b.render(m, shift=(16 * u, 0), dolly=0.06 * u), m, t)
        pre = self.camera(self.TS - 1e-3)
        frame = self._draw_shards(frame, pre, tau)
        frame = self._draw_glints(frame, pre, tau)
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
            ix, iy = to_screen(self.IMPACT, cam)
            rng = np.random.default_rng(4)
            ang, spd = rng.uniform(0, 2 * math.pi, 90), rng.uniform(300, 1700, 90)
            self.glints = (ix, iy, np.c_[np.cos(ang) * spd, np.sin(ang) * spd], rng.uniform(1, 3.2, 90))
        ix, iy, vel, size = self.glints
        pts = np.c_[ix + vel[:, 0] * tau, iy + vel[:, 1] * tau + 1500 * tau * tau]
        dots = draw_dots(pts, size, np.full(len(size), 1.0 - tau / 0.8))
        return add_light(frame, dots, color=(1.0, 0.95, 0.85), strength=1.4)


# --------------------------------------------------------------------------------------------------
class ShotA3:
    """Yağmurlu cam: şimşek, süzülen damlalar, dalgalanan perdeler, parıldayan avizeler, odak kayması."""
    WINDOW = (340, 180, 942, 1272)

    def __init__(self, t0, t_focus, t1, strikes):
        self.T0, self.TF, self.T1, self.strikes = t0, t_focus, t1, strikes
        bg = load_rgb(IMG / "A3-BG.png")
        self.cam = DepthCam(bg, load_depth("A3-BG"), focus=0.45)
        self.fg = load_rgba(LAY / "ezel_arka.png")
        sh = bg.shape
        self.m_curtain_l = src_mask(sh, boxes=[(338, 190, 472, 1010)], feather=14)
        self.m_curtain_r = src_mask(sh, boxes=[(848, 50, 948, 670)], feather=14)
        self.m_people = src_mask(sh, boxes=[(440, 745, 822, 1195)], feather=18)
        self.m_water = src_mask(sh, boxes=[(0, 905, 196, 1262)], feather=8)
        self.m_window = src_mask(sh, boxes=[self.WINDOW], feather=10)
        chand = src_mask(sh, boxes=[(680, 150, 880, 580), (840, 550, 950, 720), (410, 630, 520, 730),
                                    (345, 820, 435, 960)], feather=0)
        self.spark_pts, self.spark_ph = sparkle_points(bg, chand, 46, seed=3)
        bridge = src_mask(sh, boxes=[(0, 720, 196, 905)], feather=0)
        self.bridge_pts, self.bridge_ph = sparkle_points(bg, bridge, 18, seed=8)
        self.m_back = src_mask(self.fg.shape, ellipses=[((510, 980), (420, 380))], feather=70)
        self.rain = Particles.spawn(320, (-100, -200, W + 100, H), (140, 2000), (30, 300), (60, 120), seed=21)
        self.drops = None

    def render(self, t):
        u = smooth((t - self.T0) / (self.T1 - self.T0))
        focus = smooth((t - self.TF + 0.15) / 0.7)
        m = affine(1.40 + 0.05 * u, (630, 760), (540, 830))
        s = m[0, 0]
        frame = self.cam.render(m, shift=(-34 * u, 0), dolly=0.06 * u)
        frame = sway(frame, to_scr(self.m_curtain_l, m), t, 7.0, 0.22, 0.0, to_screen((0, 190), m)[1], 800 * s)
        frame = sway(frame, to_scr(self.m_curtain_r, m), t, 6.0, 0.27, 1.7, to_screen((0, 50), m)[1], 600 * s)
        frame = sway(frame, to_scr(self.m_people, m), t, 1.6, 0.45, 0.6, 0, 1)
        frame = shimmer(frame, to_scr(self.m_water, m), t, 3.0)
        lights = light_mask(frame, to_scr(self.m_window, m), thresh=0.62)
        frame = frame + lights[..., None] * (flicker_value(t, 4, 0.5) - 1) * np.array([1.0, 0.7, 0.35], np.float32)
        frame = add_light(frame, draw_sparkles(map_points(self.spark_pts, m), self.spark_ph, t, 10, 3.5),
                          color=(1.0, 0.92, 0.75), strength=1.3)
        frame = add_light(frame, draw_sparkles(map_points(self.bridge_pts, m), self.bridge_ph, t, 5, 2.2),
                          color=(1.0, 0.85, 0.6), strength=0.9)
        frame = blur(frame, 5.0 * (1 - focus))
        frame = self._rain(frame, m, t)
        frame = self._ezel(frame, t, u, focus)
        flash = lightning(t, self.strikes)
        frame = frame * (1 + 0.25 * flash) + flash * 0.45 * np.array([0.72, 0.84, 1.0], np.float32)
        fade = ramp(t, self.T0, self.T0 + 0.12) * (1 - ramp(t, self.T1 - 0.12, self.T1))
        return frame * fade

    def _rain(self, frame, m, t):
        if self.drops is None:
            x0, y0 = to_screen(self.WINDOW[:2], m)
            x1, y1 = to_screen(self.WINDOW[2:], m)
            self.drops = RainOnGlass((max(0, x0), max(0, y0), min(W, x1), min(H, y1)), 70, seed=5)
        frame = self.drops.render(frame, t - self.T0)
        pts = self.rain.at(t - self.T0, wrap_box=(-100, -200, W + 100, H + 100))
        streaks = draw_streaks(pts, self.rain.size.mean(), 4.0, self.rain.bright * 0.3)
        return add_light(frame, streaks, color=(0.75, 0.9, 1.0), strength=0.9)

    def _ezel(self, frame, t, u, focus):
        m_fg = affine(1.00 + 0.08 * u, (510, 360), (300, 1400))
        layer = warp_rgba(self.fg, m_fg)
        s = m_fg[0, 0]
        layer = breathe(layer, to_scr(self.m_back, m_fg), to_screen((510, 980), m_fg), (420 * s, 380 * s), t, 7.0, 0.3)
        if focus > 0.05:
            layer = blur(layer, 3.0 * focus)
        return over(frame, layer)


# --------------------------------------------------------------------------------------------------
class ShotA4:
    """Satranç: boş tahtaya her isimde bir taş spotun içine düşer, seker, toz kaldırır."""
    PIECES = [("tas_0.png", 255, 1130, 0.95, "CENGİZ"), ("tas_1.png", 540, 1090, 0.85, "ALİ"),
              ("tas_2.png", 825, 1130, 0.95, "EYŞAN")]
    FALL = 0.24

    def __init__(self, t0, reveals, t1):
        self.T0, self.R, self.T1 = t0, reveals, t1
        bg = load_rgb(IMG / "A4-BG.png")
        self.cam = DepthCam(bg, load_depth("A4-BG"), focus=0.6)
        self.pieces = [load_rgba(LAY / f) for f, *_ in self.PIECES]
        self.labels = [[text_sprite(p[4][:k], INTER_BOLD, 46, (240, 190, 108), tracking=7, stroke=4)
                        for k in range(1, len(p[4]) + 1)] for p in self.PIECES]
        self.dust = Particles.spawn(140, (0, 0, W, 1300), (0, -6), (4, 4), (0.8, 2.0), seed=31)
        self.fog = Fog(12)
        rng = np.random.default_rng(13)
        self.puff = [(rng.uniform(-1, 1, 40), rng.uniform(0.2, 1.0, 40)) for _ in self.PIECES]

    def render(self, t):
        u = smooth((t - self.T0) / (self.T1 - self.T0))
        shake = sum(5 * math.exp(-(t - r) / 0.1) for r in self.R if t >= r)
        sx, sy = math.sin(t * 80) * shake, math.cos(t * 67) * shake
        drift = affine(1 + 0.04 * u, (540, 960), (540 - 18 * u + sx, 960 + sy))
        frame = self.cam.render(compose(drift, affine(1.42, (512, 940), (540, 1060))), shift=(-40 * u, 0),
                                dolly=0.05 * u)
        lit = [smooth((t - (r - 0.2)) / 0.25) for r in self.R]
        lights = np.zeros((H, W), np.float32)
        for (f, cx, base, sc, _), k, i in zip(self.PIECES, lit, range(3)):
            if k > 0:
                lights = np.maximum(lights, cone(cx, -80, cx, base, 140, 420) * k * flicker_value(t, i, 0.06))
        frame = frame * (0.28 + 0.95 * lights[..., None])
        frame = add_light(frame, self.fog.layer(t, 22) * 0.10, color=(0.9, 0.8, 0.65))
        pdrift = affine(1 + 0.05 * u, (540, 960), (540 - 32 * u + sx, 960 + sy))
        for i, (spr, (f, cx, base, sc, _)) in enumerate(zip(self.pieces, self.PIECES)):
            frame = self._piece(frame, spr, pdrift, cx, base, sc, t, self.R[i])
            frame = self._puff(frame, i, cx - 32 * u, base, t - self.R[i])
            n = int(math.ceil(len(self.labels[i]) * float(np.clip((t - self.R[i] - 0.12) / 0.3, 0, 1))))
            if n > 0:
                frame = paste(frame, self.labels[i][n - 1], cx - 32 * u, base + 70)
        frame = add_light(frame, lights * 0.18)
        frame = add_light(frame, draw_dots(self.dust.at(t), self.dust.size, self.dust.bright) * lights,
                          color=(1.0, 0.85, 0.55), strength=1.2)
        fade = ramp(t, self.T0, self.T0 + 0.15) * (1 - ramp(t, self.T1 - 0.08, self.T1))
        return frame * fade

    def _piece(self, frame, spr, pdrift, cx, base, sc, t, r):
        if t < r - self.FALL:
            return frame
        if t < r:
            p = (t - (r - self.FALL)) / self.FALL
            y_off, squash, k = -300 * (1 - p * p), 1.0, 0.3
        else:
            d = t - r
            y_off = -16 * math.exp(-d / 0.09) * abs(math.sin(d * 28))
            squash, k = 1 - 0.07 * math.exp(-d / 0.05), 1.0
        m = compose(pdrift, affine(sc, (spr.shape[1] / 2, spr.shape[0]), (cx, base + y_off)))
        by = to_screen((spr.shape[1] / 2, spr.shape[0]), m)[1]
        m[1, :] = m[1, :] * squash + np.array([0, 0, (1 - squash) * by])
        layer = warp_rgba(spr, m)
        shadow = cv2.GaussianBlur(layer[..., 3], (0, 0), 9) * 0.55 * (1.0 if t >= r else 0.4)
        frame = frame * (1 - shadow[..., None] * 0.6)
        flash = 1 + 0.3 * math.exp(-max(0.0, t - r) / 0.12) * (t >= r)
        lit = layer.copy()
        lit[..., :3] *= (0.10 + 0.95 * k) * flash
        return over(frame, lit)

    def _puff(self, frame, i, cx, base, d):
        if not 0 <= d < 0.7:
            return frame
        dirs, spd = self.puff[i]
        pts = np.c_[cx + dirs * 170 * spd * ease_out(d / 0.7), base - 6 - 40 * spd * d + 10 * d * d]
        dots = draw_dots(pts, 3 + 6 * spd * d, np.full(len(dirs), 0.5 * (1 - d / 0.7)))
        return add_light(frame, cv2.GaussianBlur(dots, (0, 0), 4), color=(0.9, 0.78, 0.6), strength=1.0)


# --------------------------------------------------------------------------------------------------
class ShotA5:
    """Başlık: harfler sırayla düşer, piyon öne gelir, kalp atışı ışığı, sis ve korlar."""
    LETTERS = "EZEL"

    def __init__(self, t0, t_hit, t_fade, t1):
        self.T0, self.TH, self.TF, self.T1 = t0, t_hit, t_fade, t1
        bg = load_rgb(IMG / "A4-BG.png")
        self.bg = warp(bg, affine(1.42, (512, 940), (540, 1180))) * 0.30
        for i, x in zip(range(3), (390, 540, 690)):
            spr = load_rgba(LAY / f"tas_{i}.png")
            layer = warp_rgba(spr, affine(0.38, (spr.shape[1] / 2, spr.shape[0]), (x, 1150)))
            layer[..., :3] *= 0.42
            self.bg = over(self.bg, blur(layer, 2.2))
        self.pawn = load_rgba(LAY / "tas_3.png")
        self.letters, self.letter_x = self._letters()
        self.sub = text_sprite("BİR PİYONUN İNTİKAMI", INTER_SEMI, 44, (228, 186, 120), tracking=9)
        self.embers = Particles.spawn(110, (0, 600, W, H + 200), (0, -110), (25, 40), (1.0, 2.6), seed=41)
        self.fog = Fog(21)

    def _letters(self):
        font = str(FONT_DIR / "Cinzel-900.ttf")
        sprites = [self._brass(text_sprite(ch, font, 250, (255, 255, 255))) for ch in self.LETTERS]
        gap = 40
        total = sum(s.shape[1] for s in sprites) + gap * (len(sprites) - 1)
        xs, x = [], 540 - total / 2
        for s in sprites:
            xs.append(x + s.shape[1] / 2)
            x += s.shape[1] + gap
        return sprites, xs

    @staticmethod
    def _brass(spr):
        a = spr[..., 3]
        g = np.linspace(0, 1, a.shape[0])[:, None, None]
        rgb = (np.array([1.0, 0.86, 0.55]) * (1 - g) + np.array([0.62, 0.40, 0.16]) * g) * a[..., None]
        pad = 6
        a2 = np.pad(a, pad)
        rgb2 = np.pad(rgb, ((pad, pad), (pad, pad), (0, 0)))
        edge = cv2.dilate(a2, np.ones((7, 7), np.uint8))
        shadow = np.dstack([np.zeros_like(rgb2), edge * 0.85]) * (1 - a2[..., None])
        return (shadow + np.dstack([rgb2, a2])).astype(np.float32)

    def render(self, t):
        if t < self.TH:
            return np.zeros((H, W, 3), np.float32)
        tau = t - self.TH
        shake = 11 * math.exp(-tau / 0.12)
        sx, sy = math.sin(tau * 90) * shake, math.cos(tau * 70) * shake
        push = affine(1 + 0.035 * smooth(tau / 4.5), (540, 960), (540 + sx, 960 + sy))
        frame = warp(self.bg, push)
        beat = math.exp(-((tau * 66 / 60) % 1) / 0.12)
        frame = add_light(frame, radial(540 + sx, 1500 + sy, 360) * (0.45 + 0.3 * beat))
        frame = add_light(frame, self.fog.layer(tau, 26) * 0.12, color=(0.85, 0.75, 0.62))
        ps = 1.50 + 0.12 * smooth(tau / 4.5)
        pawn_m = compose(push, affine(ps, (self.pawn.shape[1] / 2, self.pawn.shape[0]), (540, 1985)))
        frame = over(frame, warp_rgba(self.pawn, pawn_m))
        for i, (spr, x) in enumerate(zip(self.letters, self.letter_x)):
            d = tau - i * 0.07
            if d > 0:
                frame = paste(frame, spr, x + sx, 690 + sy - 40 * (1 - ease_out(d / 0.2)),
                              opacity=min(1, d / 0.06), scale=1 + 0.5 * (1 - ease_out(d / 0.2)))
        frame = self._sweep(frame, tau)
        frame = paste(frame, self.sub, 540, 860, opacity=smooth((tau - 0.45) / 0.4))
        emb = self.embers.at(tau)
        flick = 0.5 + 0.5 * np.sin(tau * 9 + self.embers.phase)
        frame = add_light(frame, draw_dots(emb, self.embers.size, self.embers.bright * flick), strength=1.3)
        frame = frame + 0.7 * math.exp(-tau / 0.06)
        return frame * (1 - ramp(t, self.TF, self.T1))

    def _sweep(self, frame, tau):
        p = (tau - 0.65) / 0.9
        if not 0 < p < 1:
            return frame
        xs = np.arange(W, dtype=np.float32)[None, :]
        ys = np.arange(H, dtype=np.float32)[:, None]
        band = np.exp(-(((xs + ys * 0.45) - (-200 + p * 1700)) / 70) ** 2)
        region = np.zeros((H, W), np.float32)
        region[560:820] = 1
        mask = band * region * np.clip((frame.mean(axis=2) - 0.35) * 2.5, 0, 1)
        return add_light(frame, mask, color=(1.0, 0.92, 0.75), strength=0.8)
