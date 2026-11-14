# 1000 Kesim Stüdyosu

"Apple vs 1000 cuts" tarzı tatmin edici (satisfying / ASMR) Shorts videolarını tarayıcıda üreten Three.js stüdyosu.
Her tur, tahtada hazır bekleyen yeni bir nesneyle ve üstüne konmuş bıçakla açılır. Bıçak kesimlerin yarısını dikey
atar, tek bir yavaş yatay geçiş yapar, kalanını önden arkaya keser; her önden arkaya kesimde öndeki dilim küplere
ayrılıp olduğu yere dökülür. Tur, yığına kısa bir bakışla biter ve sert geçişle bir sonrakine atlanır. Turlar 10
kesimden 1000'e (Efsane modunda 5000'e) çıkar.

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
- **Kesme sesi** (referans Shorts'lardaki gibi): her dikey ve önden arkaya kesimde bıçağın nesneden geçişi (geniş
  bantlı, 1–14 kHz), tahtaya kalın bir "tok" ve hemen ardından bıçağın metalik çınlaması: 1,25 ve 1,6 kHz'de iki
  net kısmi ton, ~0,2 sn'de söner. Tek bıçak olduğu için ton her vuruşta aynıdır; hızlı turlarda çınlamalar
  üst üste binip o videolardaki sürekli metalik parıltıyı verir. Yatay geçiş ve tur geçişleri sessizdir; küpler
  dökülürken ses çıkmaz. Her nesnenin kendi kesim dokusu var (çıtır, sulu, yumuşak, çatırtılı, metal, kum,
  lastik, taş). İlk turların ses dengesi referans videoyla bant bant karşılaştırılarak ayarlandı.
- **Arka fon müziği**: Referans videodaki küçük caz grubu tarzında üç stil, hepsi kontrbas, elektrikli piyano,
  vibrafon / pizzicato ve hafif davulla, temiz mastering ve küçük oda yankısıyla:
  - **Gizemli Caz** (varsayılan): minör, ~148 BPM swing, yürüyen kontrbas, vibrafon melodi, fırçalı davul.
  - **Sinsi Pizzicato**: ~160 BPM, A bölümlerinde iki vuruşlu bas ve pizzicato melodi, parmak şıklatma.
  - **Gece Cazı**: ~123 BPM, daha geniş swing, uzun vibrafon notaları, yumuşak ride.
  Telifsiz; "Yeni varyasyon" yeni ton, tempo ve melodi üretir; "Seri üret" üç stili sırayla kullanır.
  İstersen kendi müzik dosyanı yükleyebilir ya da müziği kapatıp yalnızca kesim sesini kullanabilirsin.
- **Kamera**: "Değişen açılar" (varsayılan) her tura kendi açısını verir; yeni açı, yeni nesneyle birlikte sert
  geçişle gelir, kesim boyunca yavaşça yaklaşır, finalde geri çekilir. Düz nesnelere daha yukarıdan bakar.
  "Sabit" bütün videoyu tek açıdan çeker.
- **Kesim düzeni ve tempo**: Kesimlerin yarısı sağdan sola dikey, ardından ortadan tek bir yatay geçiş (sayaçta 1
  kesim), kalanı önden arkaya. Bıçak her aşamada eşit aralıkla keser. İlk tur saniyede ~2 kesimle ~6 sn, sonraki
  turlar 10–13 sn sürer; klasik video ~69 sn. Tek yatay geçiş bütün katmanları temsil eder: parçalar küp olur
  (`cubeLayers`), sayaç çizilen küp ızgarasından gelir. Pizza, kurabiye, donut gibi ince nesnelerde (yükseklik /
  taban < 0,4) yatay geçiş yapılmaz.
- **Yığın**: Küpler kesildikleri yerde neredeyse dik düşer; yığın nesnenin taban izini korur, tahtaya yayılmaz ve
  nesnenin boyunu geçmez.
- **Sahne ve gölgeler**: Koyu ceviz tahta (kadrajdan taşan uzun bir plaka), açık gri beton tezgâh, sıcak ve
  odak dışı kırmızı-kahve duvar, alt kısımda sayacın okunması için koyu bir degrade. Gölgeler yumuşak kenarlı ve
  belirgin (PCF, yarıçap 3,5); nesnenin altında, ayakta kalan kısmını izleyen bir temas gölgesi var.
- **Gerçekçi iç ve dış görünüş**: Kesit yüzleri nesneye göre ıslak parlaklık, hafif ışık geçirgenliği ve
  ince hücre dokusu alır (`lookOf`, `fleshShade`). Narenciyede uzun meyve suyu keseleri ve beyaz zarlar,
  kivide ışınsal çizgiler, tohum halkası ve gözyaşı biçimli tohumlar, çilekte açık renkli göbekten yayılan
  lifler, domateste kırmızı duvarlar ve turuncu jöleli odacıklar; kek, ekmek ve hamurda gözenekli iç doku.
  Kabuklarda yağ bezesi çukurları, şeftali ve kivide kadife parıltı (sheen). Futbol topu gerçek kesik
  ikosahedron düzeninde: 12 siyah beşgen, 20 beyaz altıgen.
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
  [Mediabunny](https://mediabunny.dev) ile yazılır. Ses, projenin kendi AAC-LC kodlayıcısıyla (`js/aac-encoder.js`)
  ses işçisinde kodlanır: tarayıcının ses kodlayıcısına ya da WebAssembly'ye ihtiyaç yoktur, her cihaz telefon
  galerilerinin, QuickTime'ın ve YouTube'un çaldığı aynı AAC izini yazar. Kodlayıcı ffmpeg'in çözücüsüyle
  doğrulanır (seviye, örnek düzeyinde zamanlama, sinyal/gürültü oranı).
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
| `js/exporter.js` | Kare kare MP4 (Mediabunny) |
| `js/aac-encoder.js`, `js/aac-tables.js` | JavaScript AAC-LC kodlayıcı (MDCT, maskeleme, Huffman tabloları) |
| `js/work.js`, `js/worker-hub.js` | Ağır işleri (mesh, küp, ses, müzik) arka planda çalıştırma |
| `js/app.js`, `js/main.js`, `js/titles.js` | Uygulama, arayüz, Shorts metinleri |

## Testler

```bash
cd meyve-kesme
npm test
```

Node'un yerleşik test çalıştırıcısıyla şekil dili, katalog, zaman çizelgesi, küp yığını, bıçak hareketi, ses ve
müzik için birim testleri vardır; ek bağımlılık gerekmez.
