# Physics World Cup: Proje Notları

> **Yeni oturum için:** Bu dosya, önceki sohbette alınan bütün kararları ve projenin şu anki durumunu özetler. Çalışma dalı `claude/amazing-gauss-btfh8s`, 2. oturumda `claude/confident-sagan-ol1hgo` dalında devam edildi. Önce bu dosyayı, sonra `tournament/README.md` ve `video/README.md` dosyalarını oku. Buradaki kararları kullanıcıya yeniden sorma. Yeni bir karar gerekirse sor.

Son güncelleme: 13 Kasım 2026 (2. oturum: görüntü kalitesi, süre, dinamik roller, gol kartı)

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

- **Sokak futbolu motoru:** Maç 34 saniye oynanıyor (saatte 90 dakika olarak gösteriliyor). Takım başına ortalama 1,54 gol, model ortalaması 1,3. Seed taraması bir maçı yaklaşık 10 ms'de oynatıyor. Tipik bir skoru 100–1000 denemede buluyor, 5–0 gibi uç skorlar yaklaşık 1 dakika sürüyor. Maksimum 100.000 deneme.
- **Sabit rol yok (kullanıcı isteği):** Roller her 0,1 saniyede yeniden dağıtılıyor. Topa sahip takımda topa en yakın oyuncu topu taşıyor (presser), daha ilerideki takım arkadaşı ceza sahasına koşuyor (striker), diğeri karşı kanatta pas seçeneği oluyor (wide). Rakip topa sahipken topa en yakın oyuncu baskı yapıyor, diğer ikisi top dışındaki rakipleri adam adama markajlıyor. Top kendi kalesine 13 m'den yakınsa, daha az tehlikeli rakibi markajlayan oyuncu kale önüne düşüyor (cover). Her santrada oyuncuların dizilişi seed'e göre karıştırılıyor. Sonuç: goller üç oyuncuya eşit dağılıyor (yaklaşık %33'er), gollerin %28'i asistli, kendi kalesine gol oranı %7.
- **Maç koşulları:** Şut mesafesi (5,8–9,6 m) ve şut isabeti (sapma 0,12–0,26) her maç için seed'den çekiliyor. Bu değerler iki takım için her zaman aynı. Amaç skor çeşitliliğini artırmak, böylece 0–0 da çıkabiliyor 5 gollü maç da.
- **Gol kuralı:** Savunmacıya çarpıp giren şut, şutu çekenin golü sayılır (1,5 saniye kuralı). Bunun dışında son dokunuş rakipteyse kendi kalesine gol.
- **Video süresi:** Açılış 2 sn, maç 34 sn, her gol için 2,5 sn kutlama, "Full Time" 1 sn, kapanış 4,5 sn. 3 gollü bir maç yaklaşık 49 sn, 6 gollü bir maç yaklaşık 56 sn sürüyor.
- **Çıktı:** 1440×2560 MP4. YouTube 1440p ve üstü yüklemeleri daha iyi bir codec ve bit hızıyla yeniden kodluyor, bu yüzden video yüklendikten sonra da net kalıyor. Arayüz bu çözünürlükte doğrudan çiziliyor (1080×1920 ızgarada tasarlanıp ölçekleniyor). Kodlama: x264, `slow` preset, CRF 16, `tune animation`, kareler JPEG %96.
- **Render:** Bu bulut ortamında ekran kartı yok, WebGL işlemcide (SwiftShader) çalışıyor. 1440p'de kare başına yaklaşık 1,1 saniye, 56 saniyelik bir video yaklaşık 30 dakika. `renderScale` 0.75 yapılırsa 3D katman 1080p'de çiziliyor ve büyütülüyor, bu da yalnızca %25 hız kazandırıyor. Paralel tarayıcı neredeyse hız kazandırmıyor (4 çekirdek). Spot ışıklar kapalı (%15 tasarruf). Kalite ayarları `make-short3d.js` içindeki `QUALITY` değişkeninde.
- **Görsel:** Zemin dokusu metre başına 80 piksel. Projektör ışık havuzları dokuya işlenmiş, ince piksel gürültüsü yok (gürültü YouTube sıkıştırmasında bulanıklaşıyor). Yumuşak gölgeler, arkadan mavi kontur ışığı, kenar karartması (vinyet). Oyuncularda üç saç tipi ve yaka var. Pano yazıları yüksek çözünürlükte, panoların üst yüzü düz renk.
- **Kamera:** Ofset (0, 28, 25), görüş açısı 30°, gollerde 20°. Bakış noktası topu iki eksende takip ediyor (x: -3 ile 3, z: -8,5 ile 7 arası). Ayarlar `web3d/main.js` içindeki `CAM` değişkeninde. Denemek için: `--camera '{"fov":27}'`.
- **Gol kartı (2,5 sn):** Beyaz parlama, takım renklerinde konfeti, harf harf düşen "GOAL!" yazısı, ardından takım renklerinde çapraz bir bant. Bantta büyük forma numarası, bayrak, oyuncu adı, dakika, BRACE! veya HAT-TRICK! etiketi ve asist var. Kart ekranın alt yarısında duruyor, çünkü kamera golcüye ortadan yakınlaşıyor. Kendi kalesine gollerde "OWN GOAL" ve "off <oyuncu>" yazıyor. Kutlama sırasında alttaki tahmin yazısı gizleniyor.
- **Araştırma kısıtı:** Bu ortamdan yalnızca **Wikipedia** erişilebilir. football365, transfermarkt, uefa.com vb. ağ ayarları nedeniyle kapalı. Ham veri için `https://en.wikipedia.org/w/index.php?title=<Sayfa>&action=raw` kullan. `api.php` hızla istek sınırına takılıyor.

## 7. Açık işler (öncelik sırasıyla)

1. **Kullanıcının yeni test videosuna (M007-3d, 2. sürüm) geri bildirimi.** İlk sürüme gelen geri bildirimle şunlar yapıldı: görüntü kalitesi artırıldı, süre kısaltıldı, sabit savunmacı rolü kaldırıldı ve gol kartı yenilendi.
2. **Eksik forma numaraları:** Yunanistan, İrlanda ve Galler için kullanıcıdan istenecek.
3. **Render ortamı kararı:** Bulutta 104 video yaklaşık 38 saat sürer. Ekran kartı olan bir bilgisayarda (Chrome'u GPU ile çalıştırarak) test edilmeli. Alternatif olarak kalite düşürülebilir (`renderScale` 0.75 ile yaklaşık %25 daha hızlı).
4. **Video süresi:** Yapıldı, artık 60 saniyenin altında (bkz. bölüm 6).
5. **Penaltı atışları:** Elemelerde beraberlik bitince ayrı bir penaltı sahnesi yapılacak. Şu an sonuç sadece kapanış kartında yazıyla gösteriliyor.
6. **Toplu render:** Bütün maçları tek komutla sırayla üretmek, yarıda kalınca kaldığı yerden devam etmek.
7. **Uzun videolar:** Grup derlemeleri ve turnuvanın tamamı.
8. **Ek fikirler (henüz yapılmadı):** Gol tekrarı (ağır çekim), *"WHAT A SAVE!"* gibi dinamik yazılar, gol krallığı (Golden Boot) tablosu ve ayrı Short'lar, son dakika gerilimi efektleri.
9. **Yayın öncesi:** Gerçek yayın seed'ini sonuçlara bakmadan seç. Başlangıç tarihini belirle. Thumbnail ve oynatma listesi düzenini kur.

## 8. Test sezonu hakkında

`season-1` yalnızca test için kullanıldı. Brezilya kuralı eklendikten sonra şampiyon Arjantin oldu, finalde Yunanistan'ı yendi. Test videosu M007: Arjantin 4–2 Meksika (Grup D, 1. hafta). Motor değiştiği için fizik seed'i de değişti. Eski seed `street:season-1:M007:154`, yeni seed `street:season-1:M007:215`. Yeni sürümde golcüler: Messi 2, J. Álvarez 2, R. Jiménez 1, S. Giménez 1.
