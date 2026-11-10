# Demo videolar

| Dosya | Ne gösteriyor |
|---|---|
| `demo-a-hareketli-cizgi-roman.mp4` | Senin gönderdiğin illüstrasyon (`referans.png`), 2.5B "motion comic" tekniğiyle canlandırıldı: kamera hareketi, ampul titreşimi, dönen sayaç, gözlerin büyümesi, damlalar, toz, film greni |
| `demo-b-kodla-cizilmis.mp4` | Hiç hazır görsel kullanılmadan tamamen kodla çizilen mürekkep/çizgi roman sahnesi: sallanan ampul, hareketli gölgeler, odak kaydırma, çizgi titreşimi |

Seslerin hepsi `ses_tasarimi.py` ile sentezlendi; hiçbir hazır ses dosyası kullanılmadı.

## Yeniden üretmek için
```bash
node render.js sahne-a.html kareler-a 30 8.5   # kareleri üretir
python3 ses_tasarimi.py a ses-a.wav            # sesi üretir
ffmpeg -framerate 30 -i kareler-a/f%05d.png -i ses-a.wav \
  -c:v libx264 -crf 23 -tune grain -pix_fmt yuv420p -c:a aac -b:a 192k -shortest demo-a.mp4
```
Demo B için `sahne-b.html`, `b` ve süre olarak `9` kullan.
