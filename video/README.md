# Physics World Cup: Short Üretici

Turnuva motorunun ürettiği bir maçı, sesiyle birlikte dikey bir Short'a (1080×1920, 30 fps, MP4) dönüştürür.

## Nasıl çalışır

1. **Model skoru belirler.** Skor `tournament/output/tournament.json` dosyasından okunur.
2. **Seed taraması:** Fizik motoru arka planda maçları oynatır ve doğal sonucu bu skor olan ilk maçı seçer. Maçın içine hiçbir müdahale yapılmaz. İki takımın topu her zaman birebir aynı fiziğe sahiptir.
3. **Kareler çizilir.** Chromium içinde bir canvas'a çizilir. Akış: açılış kartı, maç, gol kutlamaları, "Full Time" ekranı, kapanış kartı (puan tablosu ve sıradaki maçlar).
4. **Ses üretilir.** Tribün uğultusu, top sesleri, gol coşkusu ve düdük tamamen kodla sentezlenir. Dışarıdan ses kullanılmadığı için telif (Content ID) riski yok.
5. **ffmpeg ile MP4 oluşturulur.**

## Kullanım

```bash
cd tournament && node cli.js --seed season-1      # önce turnuvayı üret
cd ../video && npm install                         # bayraklar ve font
# Kendi bilgisayarında ayrıca: npm install playwright && npx playwright install chromium
node make-short.js --match M007                    # tek bir maçı render al
node calibrate.js 3000                             # fiziğin doğal gol dağılımını ölç
npm test
```

Çıktılar `output/` klasörüne yazılır:
- `M007.mp4`: video
- `M007-thumb.jpg`: kapanış kartından alınan kapak görseli
- `M007.json`: başlık, açıklama ve fizik seed'i

Tek bir video yaklaşık 2–2,5 dakikada render edilir.

## Fizik ayarları (`src/sim.js` → `PHYSICS`)

Bu ayarları değiştirirsen `node calibrate.js` ile takım başına ortalama golün 1,5–1,7 civarında kaldığını kontrol et. Modelin ortalaması 1,3, favoriler için 2,5'e kadar çıkıyor.

## Henüz yapılmayanlar

- Elemelerde beraberlik halinde penaltı atışlarının canlandırılması. Şu an penaltı sonucu sadece kapanış kartında yazıyla gösteriliyor.
- Toplu render (bütün maçları tek komutla üretmek).
