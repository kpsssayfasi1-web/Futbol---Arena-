# Physics World Cup: Proje Notları

> **Yeni oturum için:** Bu dosya, önceki sohbette alınan bütün kararları ve projenin şu anki durumunu özetler. Çalışma dalı `claude/amazing-gauss-btfh8s`. Önce bu dosyayı, sonra `tournament/README.md` ve `video/README.md` dosyalarını oku. Buradaki kararları kullanıcıya yeniden sorma. Yeni bir karar gerekirse sor.

Son güncelleme: 13 Kasım 2026

---

## 1. Amaç

Yüz ve ses kullanmadan, otomatik üretilen bir YouTube kanalı:
- **Global kitle.** Başlıklar İngilizce, Studio'dan başka dillere çeviri eklenecek.
- **YPP'ye uygun ve özgün içerik.** Her maç gerçekten benzersiz, hepsi tek bir turnuva hikâyesinin parçası.
- **Shorts ile büyüme, uzun videolarla gelir.** Uzun videolar grup derlemeleri ve turnuvanın tamamı olacak.
- Kullanıcı çalışıyor, bu yüzden haftada birkaç saatlik emekle yürüyebilmeli.

## 2. Format: "Physics World Cup"

- **3D, kalecisiz 3'e 3 sokak futbolu.** Gece, şehir içinde bir kafes saha.
- Her takımda ülkenin **gerçek 3 yıldız oyuncusu** var. Ekranda isim ve forma numarası görünüyor.
- **48 ülke, gerçek 2026 Dünya Kupası formatı:** 12 grup × 4 takım, ilk 2'ler ve en iyi 8 üçüncü son 32'ye çıkar. Toplam 104 maç.
- **Her maç ayrı bir Short.** Videolar tek başına izlenebilir, ama hepsi aynı turnuvanın parçası. Her Short bağlamını kendi verir: açılışta "ne tehlikede", kapanışta puan tablosu ve "Next up".
- **Yayın takvimi (29 gün):**
  - Grup aşaması: günde 4 Short (06:00, 12:00, 18:00, 23:00 UTC)
  - Elemeler: günde 3 Short (12:00, 18:00, 23:00 UTC)
  - Son gün: üçüncülük maçı 12:00, final 18:00 UTC
- **Uzun videolar:** Her grup bitince "Group X: All Matches", turnuva sonunda tamamı. Henüz yapılmadı.

## 3. Alınan kararlar (değiştirmeden önce kullanıcıya sor)

### Ülkeler ve güç puanları (`tournament/data/teams.json`)
- 48 ülke, futbol gücü, izleyici kitlesi ve reklam değeri (`adTier`: 3 yüksek, 1 düşük) dengelenerek seçildi. Dağılım: 23 yüksek, 12 orta, 13 düşük.
- **Bilerek dahil edilmeyenler:**
  - Rusya: YouTube orada reklam göstermiyor.
  - Çin ve İran: YouTube erişime kapalı.
  - Hindistan, Pakistan, Bangladeş, Filipinler: reklam değeri düşük, futbol ilgisi az.
- Güç puanları 0–100 arası. Kullanıcı onayladı.

### Sonuç modeli: dürüstlük ilkesi
- **Güç puanları fiziği değil, sonucu etkiler.** Model (Poisson, `baseGoals` 1.3, `ratingFactor` 0.02) önce skoru belirler.
- **Seed taraması:** Fizik motoru, doğal sonucu bu skor olan maçı arar. Maçın içine asla müdahale edilmez. İki takımın fiziği ve yapay zekâsı birebir aynı.
- **Gerçekçilik kuralı** (`settings.realism`): 1. torba takımları grubu 0 puanla bitiremez. Kural bozulursa grup aşamasının **tamamı** yeniden simüle edilir. Tek bir maç elle değiştirilmez.
- **Yayın seed'i sonuçlara bakmadan seçilecek** ve değiştirilmeyecek. Beğenilmeyen sonuç yüzünden seed değiştirmek elle müdahale sayılır. `season-1` sonuçları görüldüğü için **yayında kullanılmamalı.**
- Açıklamalarda iki ibare var: *"real, unedited physics simulation, team ratings shape the odds"* ve *"Fan-made simulation, not affiliated with any player, club or federation."*
- Tahmin anketleri "Sence kim kazanır?" şeklinde olacak. "Sonucu siz belirleyin" gibi bir ifade yanıltıcı olur, kullanılmayacak.

### Gerçek oyuncu isimleri: kullanıcı onayladı, güvenlik önlemleriyle
- Sadece **isim ve forma numarası.** Karakterler stilize ve genel. Gerçek oyunculara yüz, saç ya da görünüş benzerliği yok. Kulüp ve sponsor logosu yok.
- Video başlıkları **ülke odaklı**, oyuncu adı başlığa yazılmaz.
- Kadrolar `tournament/data/rosters.json` dosyasında. Gerekirse hayali isimlere geçmek kolay olmalı.

### Kadrolar ve forma numaraları (`tournament/data/rosters.json`)
- Takım başına 3 saha oyuncusu (kaleci yok). Her numaranın kaynağı `source` alanında yazıyor:
  - `wc2026`: 2026 Dünya Kupası resmi kadroları (33 takım)
  - `squad-2026-11`: Kasım 2026 milli takım kadrosu (İtalya, Finlandiya, BAE, Endonezya, Malezya)
  - `euro2024`, `copa2024`, `afcon2025`: En son numaralı turnuva kadrosu. Güncel kadrolarda numara yazmayan takımlar için kullanıldı (Danimarka, Sırbistan, Ukrayna, Polonya, Macaristan, Şili, Nijerya). Bu numaralar değişmiş olabilir.
- **⚠️ Doğrulanamayanlar** (`number: null`): Yunanistan (Pavlidis, Bakasetas, Tzolis), İrlanda (Parrott, Idah, Collins), Galler (H. Wilson, B. Johnson, D. James). Numaraları kullanıcıdan istenecek. Tahmin edilmeyecek.

### Görsel ve ses
- Kalecisiz 3'e 3, kullanıcı onayladı.
- Takip kamerası kullanılıyor, gollerde golcüye yakınlaşıyor.
- Ekranda golcü ve asist yapan oyuncu yazıyor. Kapanış kartında golcüler ve dakikaları, puan tablosu ve sıradaki maçlar var.
- Ses tamamen kodla sentezleniyor (tribün, vuruş, duvar, direk, gol, düdük). Telif riski yok.
- **Eski 2D daire formatı** (`video/make-short.js`, `video/web/`) yalnızca karşılaştırma için duruyor. Kullanıcı 3D formatı seçti, eski format ileride silinebilir.

## 4. Klasör yapısı

```
tournament/            Turnuva motoru (Node, bağımlılık yok)
  data/teams.json      48 ülke: puan, torba, reklam değeri, renkler, ISO kodu
  data/settings.json   Model, format, takvim, gerçekçilik kuralı
  data/rosters.json    3 yıldız oyuncu ve numaralar (kaynaklarıyla)
  src/                 rng, model, draw, groups, knockout, schedule, titles, drama, odds, report
  cli.js               node cli.js --seed X --start YYYY-MM-DD  |  --odds 5000
video/
  src/street/          3'e 3 motor: pitch.js (geometri), ai.js (yapay zekâ), engine.js
  src/seed-search.js   Modelin skorunu veren fizik seed'ini bulur
  src/context.js       Maç bağlamı: puan tablosu, sıradaki maçlar, "ne tehlikede" metni
  src/audio.js         Ses sentezi
  src/host.js          Tarayıcı ve ffmpeg yönetimi (renderVideo, renderStills)
  web3d/               Three.js sahnesi (scene.js), oyuncular (players.js), arayüz (hud.js), main.js
  make-short3d.js      Güncel üretim betiği
  calibrate-street.js  Fiziğin doğal gol dağılımı
```

## 5. Komutlar

```bash
# Turnuva
cd tournament
node cli.js --seed <SEED> --start 2026-12-01   # çıktılar output/ klasörüne (git'e eklenmez)
node cli.js --odds 5000                        # şampiyonluk olasılıkları
npm test                                       # 42 test

# Video (ilk kurulum: cd video && npm install)
cd video
node make-short3d.js --match M007                    # tam MP4 → output/M007-3d.mp4
node make-short3d.js --match M007 --stills 400,600   # birkaç saniyede önizleme kareleri
node calibrate-street.js 500
npm test                                             # 17 test
```

Playwright bu ortamda global olarak kurulu ve `createRequire` ile yükleniyor. Kullanıcının kendi bilgisayarında `npm install playwright` ve `npx playwright install chromium` gerekir.

## 6. Teknik notlar ve ayarlar

- **Sokak futbolu motoru:** Maç 50 saniye oynanıyor (saatte 90 dakika olarak gösteriliyor). Takım başına ortalama 1,21 gol, model ortalaması 1,3. Seed taraması bir maçı 12 ms'de oynatıyor, tipik bir skoru 100–1000 denemede buluyor. Maksimum 100.000 deneme.
- **Gol kuralı:** Savunmacıya çarpıp giren şut, şutu çekenin golü sayılır (1,5 saniye kuralı). Bunun dışında son dokunuş rakipteyse kendi kalesine gol.
- **Render:** Bu bulut ortamında ekran kartı yok, WebGL işlemcide (SwiftShader) çalışıyor. Kare başına yaklaşık 0,6 saniye, 72 saniyelik bir video yaklaşık 22 dakika. Paralel tarayıcı neredeyse hız kazandırmıyor (4 çekirdek). Spot ışıklar kapalı (%15 tasarruf). Kalite ayarları `make-short3d.js` içindeki `QUALITY` değişkeninde.
- **Kamera:** Ofset (0, 52, 37), görüş açısı 26°, gollerde 18°. Bakış noktası topu takip ediyor (z ekseninde -5 ile 4 arası).
- **Araştırma kısıtı:** Bu ortamdan yalnızca **Wikipedia** erişilebilir. football365, transfermarkt, uefa.com vb. ağ ayarları nedeniyle kapalı. Ham veri için `https://en.wikipedia.org/w/index.php?title=<Sayfa>&action=raw` kullan. `api.php` hızla istek sınırına takılıyor.

## 7. Açık işler (öncelik sırasıyla)

1. **Kullanıcının test videosuna (M007-3d) geri bildirimi.** Görünüm, kamera, oyun akışı ve ses değerlendirilecek.
2. **Eksik forma numaraları:** Yunanistan, İrlanda ve Galler için kullanıcıdan istenecek.
3. **Render ortamı kararı:** Bulutta 104 video yaklaşık 38 saat sürer. Ekran kartı olan bir bilgisayarda (Chrome'u GPU ile çalıştırarak) test edilmeli. Alternatif olarak kalite düşürülebilir (`renderScale` 0.75 ile yaklaşık %25 daha hızlı).
4. **Video süresi:** Bir maç yaklaşık 65–75 saniye sürüyor. 60 saniyenin altı istenirse gol sevinci (2,2 sn), açılış (3 sn) ve kapanış (5 sn) kısaltılabilir.
5. **Penaltı atışları:** Elemelerde beraberlik bitince ayrı bir penaltı sahnesi yapılacak. Şu an sonuç sadece kapanış kartında yazıyla gösteriliyor.
6. **Toplu render:** Bütün maçları tek komutla sırayla üretmek, yarıda kalınca kaldığı yerden devam etmek.
7. **Uzun videolar:** Grup derlemeleri ve turnuvanın tamamı.
8. **Ek fikirler (henüz yapılmadı):** Gol tekrarı (ağır çekim), *"WHAT A SAVE!"* gibi dinamik yazılar, gol krallığı (Golden Boot) tablosu ve ayrı Short'lar, son dakika gerilimi efektleri.
9. **Yayın öncesi:** Gerçek yayın seed'ini sonuçlara bakmadan seç. Başlangıç tarihini belirle. Thumbnail ve oynatma listesi düzenini kur.

## 8. Test sezonu hakkında

`season-1` yalnızca test için kullanıldı. Brezilya kuralı eklendikten sonra şampiyon Arjantin oldu, finalde Yunanistan'ı yendi. Test videosu M007: Arjantin 4–2 Meksika (Grup D, 1. hafta). Fizik seed'i `street:season-1:M007:154`.
