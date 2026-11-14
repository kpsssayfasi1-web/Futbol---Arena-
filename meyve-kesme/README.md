# 1000 Kesim Stüdyosu

"Apple vs 1000 cuts" tarzı tatmin edici (satisfying / ASMR) Shorts videolarını tarayıcıda üreten Three.js stüdyosu.
Bir nesne tahtaya düşer, bıçak önce dikey, sonra yatay, en son önden arkaya dilimler; her son dilimde öndeki parça
küplere ayrılıp yığına dökülür. Turlar 10 kesimden 1000'e (Efsane modunda 5000'e) çıkar ve arada bekleme yoktur.

## Çalıştırma

```bash
cd meyve-kesme
python3 -m http.server 8000
# http://localhost:8000
```

GitHub Pages açıksa doğrudan `https://<kullanıcı>.github.io/Futbol---Arena-/meyve-kesme/` adresinden çalışır.
MP4 oluşturma güvenli bağlantı ister (https veya localhost).

## Neler var

- **36 nesne, 6 kategori**: Meyve (elma, karpuz, portakal, kivi, limon, şeftali, avokado, çilek), Sebze (domates,
  kırmızı soğan, havuç, salatalık, balkabağı, patlıcan), Yiyecek (katlı pasta, donut, hamburger, suşi, delikli
  peynir, haşlanmış yumurta, pizza, kurabiye), Obje (sabun, kinetik kum, gökkuşağı mum, altın külçe, zeka küpü, şeker topu),
  Figür (lastik ördek, kardan adam, oyuncak ayı, gülen surat, kalp, futbol topu), Uzay (katmanlı Dünya, Ay).
  Her biri kategorisinde ya da tüm katalogdan "karışık" oynatılabilir.
- **Gerçek kesitler**: İçi katmanlı nesneler (Dünya'nın çekirdeği, soğan halkaları, pasta katları, yumurta sarısı,
  şeftali ve avokado çekirdeği, peynir delikleri) kesildikçe görünür. Az kesimli turlarda parçalar ışın izlemeyle
  gerçek kabuk şekliyle çizilir.
- **Doğru sayaç**: Ekranda çizilen küp sayısı kaliteye göre sınırlanır, sayaç gerçek ızgaradaki sayıyı gösterir.
- **ASMR sesi**: Dikey ve önden arkaya kesimlerde bıçağın yükselen parlak "fıss"ı (8–12 kHz), temas anında
  malzemenin çıtırtısı ve tahtanın "tok"u duyulur. Tok fiziksel bir modelle üretilir: tezgâhta duran sert
  ahşap tahtanın 160 Hz–3.8 kHz arasındaki sık ve hızla sönen eğilme modları (kayıp katsayısı 0,035), altta
  tezgâhın kısa, alçak gümlemesi, çeliğin küçük tıkı ve bıçağın çok hafif çınlaması. Yatay kesimde bıçak
  tahtaya değmez: yalnızca kayma sesi (fıss + yumuşak sürtünme) vardır, vuruş ya da tık yoktur. Küpler
  dağılırken ve yere düşerken ses çıkmaz. Hızlı kesimlerde ses hızlandırılmaz, kısa fıss varyantları
  kullanılır; yoğun pasajlarda fıss öne çıkar, tok geri çekilir. Her nesnenin kendi kesim sesi var (çıtır,
  sulu, yumuşak, çatırtılı, metal, kum, lastik, taş).
- **Arka fon müziği**: Referans videodaki küçük caz grubu tarzında üç stil, hepsi kontrbas, elektrikli piyano,
  vibrafon / pizzicato ve hafif davulla, temiz mastering ve küçük oda yankısıyla:
  - **Gizemli Caz** (varsayılan): minör, ~148 BPM swing, yürüyen kontrbas, vibrafon melodi, fırçalı davul.
  - **Sinsi Pizzicato**: ~160 BPM, A bölümlerinde iki vuruşlu bas ve pizzicato melodi, parmak şıklatma.
  - **Gece Cazı**: ~123 BPM, daha geniş swing, uzun vibrafon notaları, yumuşak ride.
  Telifsiz; "Yeni varyasyon" yeni ton, tempo ve melodi üretir; "Seri üret" üç stili sırayla kullanır.
  İstersen kendi müzik dosyanı yükleyebilirsin.
- **Kamera**: "Değişen açılar" (varsayılan) her tura kendi açısını verir, nesne düşerken yumuşakça yeni açıya
  geçer, kesim boyunca yavaşça yaklaşır, finalde geri çekilir. Düz nesnelere daha yukarıdan bakar. "Sabit" tek
  açıda kalır.
- **Kesim düzeni**: Bıçak önce sağdan sola dikey, sonra yukarıdan aşağı yatay, en son önden arkaya keser.
  Pizza, kurabiye, donut gibi ince nesnelerde (yükseklik / taban < 0,4) yatay kesim yapılmaz; kesimler dikey ve
  önden arkaya paylaşılır. Parçalar iğneye dönüşecek kadar inceldiğinde ekranda küp oranında çizilir.
- **Renkler**: Katalog renkleri ekran (sRGB) değerleriyle yazılır; shader bunları ışıklandırmadan önce doğrusal
  ışığa çevirir (`vivid`, γ 1,6 + hafif doygunluk). Ton eşleme renk tonunu ve doygunluğu koruyan Neutral
  eşlemedir, böylece kesit yüzleri soluk ya da beyaz görünmez.
- **Görüntü kalitesi**: Kesim çizgileri kenarları yumuşatılmış (anti-aliased) çizilir ve sıklaştıkça solar; yoğun
  turlarda yüzeyde moiré / merdiven deseni oluşmaz. MP4 çıktısı canlı önizlemeden çok daha ince bir yığınla
  (masaüstünde 420 bine kadar küp) ve 24 Mbit/s ile kodlanır.
- **Akıcılık**: Küp renkleri GPU'da bir kez pişirilir, sayaç rakamları doku yüklemeden çizilir, sonraki nesnenin
  shader'ı ve verisi önceden hazırlanır, kare hızı düşerse çözünürlük en fazla %75'e kadar iner.
- **Video çıktısı**: *MP4 oluştur* (her kare tam zamanında, 1080×1920, H.264 + AAC ses), *Seri üret* (açık
  kategoriden 3 farklı nesne, 3 farklı müzikle arka arkaya), *Canlı kayıt*, *Temiz ekran*. Dosya
  [Mediabunny](https://mediabunny.dev) ile yazılır. Ses her zaman AAC'dir (telefonlar, QuickTime ve YouTube
  bunu bekler). Tarayıcının kendi AAC kodlayıcısı yoksa (Linux'ta Chrome, iOS WebView'ları, eski Safari)
  WebAssembly AAC kodlayıcı (`@mediabunny/aac-encoder`) yüklenir. Kodlayıcı, kareler işlenmeden önce kısa bir
  sessizlikle denenir; hiçbiri çalışmazsa not satırı videonun neden sessiz olduğunu söyler.
- **Shorts metni**: Her video için başlık, açıklama ve etiketler; tek dokunuşla kopyalanır. Açılış sorusu
  ("Bu elma 1000 kesime dayanabilir mi?") ilk saniyede izleyiciyi yakalar.

Tüm animasyon zamanın saf bir fonksiyonudur: aynı ayarlarla her render birebir aynıdır.

## Yeni nesne eklemek

1. `js/catalog/` altındaki dosyalardan birine bir nesne ekle: `shape` (küre, elipsoid, kutu, silindir, koni,
   kapsül, torus ve birleşim/çıkarma işlemleri), `glsl` içinde `itemSkin` ve `itemInner` renk fonksiyonları,
   `sound` profili.
2. Ölçümleri yenile: `node tools/build-meta.mjs`
3. `npm test`

## Yapı

| Dosya | Görev |
| --- | --- |
| `js/sdf.js`, `js/mesher.js` | Şekil dili (JS ve GLSL'e derlenir), şekilden mesh üretimi |
| `js/catalog/*` | 36 nesne: şekil, renk, ses profili; önceden hesaplanmış ölçümler (`meta.js`) |
| `js/timeline.js` | Turlar, fazlar ve her kesimin zamanı (ince nesne kuralı dahil) |
| `js/camera.js` | Tur başına kamera açıları ve geçişler |
| `js/cubes-data.js`, `js/cubes-mesh.js` | Küp ızgarası, yığın fiziği, GPU'da küp uçuşu ve üç çizim modu |
| `js/materials.js`, `js/object-glsl.js` | Nesne başına shader programları |
| `js/sfx.js` | Kesim, kayma ve tahta sesi sentezi |
| `js/music.js`, `js/music-jazz.js`, `js/music-instruments.js` | Müzik bestecileri, enstrüman sentezi, mastering |
| `js/audio.js`, `js/events.js` | WebAudio çalma ve çevrimdışı ses render'ı |
| `js/exporter.js` | Kare kare MP4 (Mediabunny), AAC ses ve WASM yedeği |
| `js/work.js`, `js/worker-hub.js` | Ağır işleri (mesh, küp, ses, müzik) arka planda çalıştırma |
| `js/app.js`, `js/main.js`, `js/titles.js` | Uygulama, arayüz, Shorts metinleri |

## Testler

```bash
cd meyve-kesme
npm test
```

Node'un yerleşik test çalıştırıcısıyla şekil dili, katalog, zaman çizelgesi, küp yığını, bıçak hareketi, ses ve
müzik için birim testleri vardır; ek bağımlılık gerekmez.
