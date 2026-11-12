"""Kelime kelime animasyonlu altyazı.

Kelimeler 1-3'lük gruplara bölünür; her kelime seslendirmedeki başlangıç anında
yaylanarak (pop) belirir. İsimler pirinç, ölüm/ihanet kelimeleri kırmızı renklidir.
"""
import re

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from hizala import normalize

NAMES = ("ezel", "omer", "ömer", "eyşan", "cengiz", "ali", "ramiz", "kenan", "birkan", "bayraktar",
         "uçar", "bahar", "istanbul")
DARK = ("öldü", "ölmüştü", "ölmek", "öldür", "katil", "mahveden", "ihanet", "tutuklan", "dayak", "bıçak")
WHITE, BRASS, CRIMSON = (255, 255, 255), (240, 182, 92), (255, 84, 84)
END_PUNCT = re.compile(r"[.?!:;…]$")


def word_color(text: str):
    n = normalize(text)
    if any(n == nm or (n.startswith(nm) and len(nm) >= 4) for nm in NAMES):
        return BRASS
    if any(n.startswith(d) for d in DARK):
        return CRIMSON
    return WHITE


CONJUNCTIONS = {"ve", "ile", "ama", "ya", "da", "de", "ki", "bir"}


def chunk_words(words: list[dict], max_words: int = 3, max_chars: int = 19) -> list[dict]:
    """Kelimeleri altyazı gruplarına böler; grup sınırı kelime eklenmeden önce kontrol edilir,
    bağlaçlar satır sonunda bırakılmaz, noktalama grubu kapatır."""
    chunks, cur = [], []

    def length(ws):
        return sum(len(x["text"]) for x in ws) + max(0, len(ws) - 1)

    for w in words:
        if cur and (length(cur + [w]) > max_chars or len(cur) >= max_words):
            carry = cur.pop() if len(cur) > 1 and normalize(cur[-1]["text"]) in CONJUNCTIONS else None
            chunks.append(cur)
            cur = [carry] if carry else []
        cur.append(w)
        if END_PUNCT.search(w["text"]) or (w["text"].endswith(",") and len(cur) >= 2):
            chunks.append(cur)
            cur = []
    if cur:
        chunks.append(cur)
    out = []
    for i, c in enumerate(chunks):
        nxt = chunks[i + 1][0]["start"] - 0.04 if i + 1 < len(chunks) else c[-1]["end"] + 0.6
        out.append({"words": c, "start": c[0]["start"] - 0.04, "end": min(c[-1]["end"] + 0.35, nxt)})
    return out


class CaptionRenderer:
    def __init__(self, font_path: str, size: int = 80, center_y: int = 1270, max_width: int = 960):
        self.font = ImageFont.truetype(font_path, size)
        self.size, self.center_y, self.max_width = size, center_y, max_width
        self.cache: dict[str, np.ndarray] = {}

    def sprite(self, text: str) -> np.ndarray:
        if text in self.cache:
            return self.cache[text]
        stroke, pad = max(4, self.size // 11), self.size // 2
        bbox = self.font.getbbox(text, stroke_width=stroke)
        w, h = bbox[2] - bbox[0] + 2 * pad, bbox[3] - bbox[1] + 2 * pad
        shadow = Image.new("L", (w, h), 0)
        ImageDraw.Draw(shadow).text((pad - bbox[0], pad - bbox[1] + 7), text, font=self.font, fill=170,
                                    stroke_width=stroke, stroke_fill=170)
        shadow = shadow.filter(ImageFilter.GaussianBlur(7))
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        img.putalpha(shadow)
        ImageDraw.Draw(img).text((pad - bbox[0], pad - bbox[1]), text, font=self.font, fill=word_color(text),
                                 stroke_width=stroke, stroke_fill=(12, 10, 10))
        arr = np.asarray(img, np.float32) / 255.0
        arr[..., :3] *= arr[..., 3:4]
        self.cache[text] = arr
        return arr

    def _layout(self, chunk):
        sprites = [self.sprite(w["text"]) for w in chunk["words"]]
        pad = self.size // 2
        gap = int(0.26 * self.size) - 2 * pad
        space = int(0.26 * self.size)
        lines, cur, width = [], [], 0
        for s in sprites:
            vis = s.shape[1] - 2 * pad
            add = vis + (space if cur else 0)
            if cur and width + add > self.max_width:
                lines.append(cur)
                cur, width = [], 0
                add = vis
            cur.append(s)
            width += add
        lines.append(cur)
        return lines, gap

    def draw(self, frame: np.ndarray, chunks: list[dict], t: float, center_y: int | None = None) -> np.ndarray:
        live = [c for c in chunks if c["start"] <= t < c["end"]]
        if not live:
            return frame
        chunk = live[-1]
        lines, gap = self._layout(chunk)
        line_h = int(self.size * 1.05)
        y = (center_y or self.center_y) - (len(lines) - 1) * line_h // 2
        k = 0
        for line in lines:
            total = sum(s.shape[1] for s in line) + gap * (len(line) - 1)
            x = (frame.shape[1] - total) / 2
            for s in line:
                frame = self._blit_word(frame, s, x, y, t - chunk["words"][k]["start"])
                x += s.shape[1] + gap
                k += 1
            y += line_h
        return frame

    @staticmethod
    def _blit_word(frame, sprite, x, y_center, dt):
        if dt < -0.03:
            return frame
        p = float(np.clip((dt + 0.03) / 0.13, 0, 1))
        scale = 0.78 + 0.22 * (1 - (1 - p) ** 3) + 0.06 * np.sin(np.pi * p) * (p < 1)
        alpha = min(1.0, (dt + 0.03) / 0.07)
        h, w = sprite.shape[:2]
        sw, sh = max(1, int(w * scale)), max(1, int(h * scale))
        spr = cv2.resize(sprite, (sw, sh), interpolation=cv2.INTER_LINEAR)
        x0 = int(x + (w - sw) / 2)
        y0 = int(y_center - sh / 2 + (1 - p) * 14)
        x1, y1 = max(0, x0), max(0, y0)
        x2, y2 = min(frame.shape[1], x0 + sw), min(frame.shape[0], y0 + sh)
        if x2 <= x1 or y2 <= y1:
            return frame
        sub = spr[y1 - y0:y2 - y0, x1 - x0:x2 - x0]
        a = sub[..., 3:4] * alpha
        frame[y1:y2, x1:x2] = frame[y1:y2, x1:x2] * (1 - a) + sub[..., :3] * alpha
        return frame
