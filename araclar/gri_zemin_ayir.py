"""Cut subjects off a flat grey background: flood-fill background from the borders, then feather."""
import sys, numpy as np, cv2
from PIL import Image
src, out_prefix, split = sys.argv[1], sys.argv[2], sys.argv[3] == "split"
img = np.asarray(Image.open(src).convert("RGB")).astype(np.int16)
H, W, _ = img.shape
border = np.concatenate([img[0], img[-1], img[:, 0], img[:, -1]])
bg = np.median(border, axis=0)
dist = np.abs(img - bg).max(axis=2)
near = (dist < 18).astype(np.uint8)
ff = near.copy(); mask = np.zeros((H + 2, W + 2), np.uint8)
for x in range(0, W, 8):
    for y in (0, H - 1):
        if ff[y, x] == 1: cv2.floodFill(ff, mask, (x, y), 2)
for y in range(0, H, 8):
    for x in (0, W - 1):
        if ff[y, x] == 1: cv2.floodFill(ff, mask, (x, y), 2)
fg = (ff != 2).astype(np.uint8)
fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
alpha = cv2.GaussianBlur(fg.astype(np.float32), (0, 0), 0.8)
alpha = np.clip(alpha * 1.15, 0, 1)
rgba = np.dstack([img.astype(np.uint8), (alpha * 255).astype(np.uint8)])
if not split:
    Image.fromarray(rgba, "RGBA").save(out_prefix + ".png"); print("saved", out_prefix + ".png", "fg ratio", round(fg.mean(), 3)); sys.exit()
n, lab, stats, _ = cv2.connectedComponentsWithStats(fg, 8)
parts = [i for i in range(1, n) if stats[i, cv2.CC_STAT_AREA] > 5000]
parts.sort(key=lambda i: stats[i, cv2.CC_STAT_LEFT])
for k, i in enumerate(parts):
    x, y, w, h = stats[i, :4]; pad = 6
    x0, y0, x1, y1 = max(0, x - pad), max(0, y - pad), min(W, x + w + pad), min(H, y + h + pad)
    sub = rgba[y0:y1, x0:x1].copy()
    keep = cv2.dilate((lab[y0:y1, x0:x1] == i).astype(np.uint8), np.ones((5, 5), np.uint8))
    sub[..., 3] = (sub[..., 3] * keep).astype(np.uint8)
    Image.fromarray(sub, "RGBA").save(f"{out_prefix}_{k}.png"); print("part", k, (x0, y0, x1 - x0, y1 - y0))
