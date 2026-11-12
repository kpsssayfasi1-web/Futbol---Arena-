import sys, numpy as np, onnxruntime as ort, cv2
from PIL import Image
model, src, out = sys.argv[1], sys.argv[2], sys.argv[3]
img = Image.open(src).convert("RGB"); W, H = img.size
x = np.asarray(img.resize((320, 320), Image.LANCZOS)).astype(np.float32) / 255.0
x = (x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
x = x.transpose(2, 0, 1)[None].astype(np.float32)
sess = ort.InferenceSession(model, providers=["CPUExecutionProvider"])
pred = sess.run(None, {sess.get_inputs()[0].name: x})[0][0, 0]
pred = (pred - pred.min()) / (pred.max() - pred.min() + 1e-8)
mask = cv2.resize(pred, (W, H), interpolation=cv2.INTER_CUBIC)
mask = np.clip(mask, 0, 1)
rgba = np.dstack([np.asarray(img), (mask * 255).astype(np.uint8)])
Image.fromarray(rgba, "RGBA").save(out)
# preview: cutout over magenta to judge edges
prev = np.asarray(img).astype(np.float32) * mask[..., None] + np.array([255, 0, 255]) * (1 - mask[..., None])
Image.fromarray(prev.astype(np.uint8)).resize((W // 2, H // 2)).save(out.replace(".png", "_preview.jpg"))
print("ok", W, H, "mask mean", round(float(mask.mean()), 3))
