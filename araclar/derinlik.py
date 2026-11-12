"""Depth Anything V2 (ONNX) ile görselin derinlik haritasını çıkarır.

Çıktı: 16 bit PNG, 0 = en uzak, 65535 = en yakın. 2.5D kamera hareketi (parallax) için kullanılır.
Kullanım: python derinlik.py model.onnx girdi.png cikti.png
"""
import sys

import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image

MEAN, STD = np.array([0.485, 0.456, 0.406]), np.array([0.229, 0.224, 0.225])


def estimate(model_path: str, img: np.ndarray) -> np.ndarray:
    h, w = img.shape[:2]
    scale = 588 / max(h, w)
    th, tw = max(14, round(h * scale / 14) * 14), max(14, round(w * scale / 14) * 14)
    x = cv2.resize(img, (tw, th), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0
    x = ((x - MEAN) / STD).transpose(2, 0, 1)[None].astype(np.float32)
    sess = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])
    d = sess.run(None, {sess.get_inputs()[0].name: x})[0].squeeze()
    d = cv2.resize(d.astype(np.float32), (w, h), interpolation=cv2.INTER_CUBIC)
    d = (d - np.percentile(d, 1)) / (np.percentile(d, 99) - np.percentile(d, 1) + 1e-6)
    d = np.clip(d, 0, 1).astype(np.float32)
    guide = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    return cv2.ximgproc.guidedFilter(guide, d, 8, 1e-3) if hasattr(cv2, "ximgproc") else cv2.bilateralFilter(d, 9, 0.1, 9)


def main(model_path, src, dst):
    img = np.asarray(Image.open(src).convert("RGB"))
    d = estimate(model_path, img)
    Image.fromarray((np.clip(d, 0, 1) * 65535).astype(np.uint16)).save(dst)
    print("derinlik:", dst)


if __name__ == "__main__":
    main(*sys.argv[1:4])
