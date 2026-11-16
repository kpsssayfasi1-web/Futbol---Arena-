# 1000 Kesim Stüdyosu

"Apple vs 1000 cuts" tarzı tatmin edici (satisfying / ASMR) Shorts videolarını tarayıcıda üreten Three.js stüdyosu.
Video ~0,85 sn'lik "10 vs 1,000 CUTS" kartıyla açılır. Bir nesne tahtaya düşer, bıçak önce dikey, sonra yatay, en
son önden arkaya dilimler; her son dilimde öndeki parça küplere ayrılıp yığına dökülür. Turlar 10 kesimden 1000'e
(Efsane modunda 5000'e) çıkar, arada bekleme yoktur ve video son yığın oturur oturmaz biter.

## Çalıştırma

```bash
cd meyve-kesme
python3 -m http.server 8000
# http://localhost:8000
```

GitHub Pages açıksa doğrudan `https://<kullanıcı>.github.io/Futbol---Arena-/meyve-kesme/` adresinden çalışır.
MP4 oluşturma güvenli bağlantı ister (https veya localhost).

## Neler var

- **52 nesne, 6 kategori**: Meyve (elma, karpuz, portakal, kivi, limon, şeftali, avokado, çilek, ananas, muz,
  armut, nar, ejder meyvesi), Sebze (domates, kırmızı soğan, havuç, salatalık, balkabağı, patlıcan, kırmızı biber,
  mor lahana, patates, mısır), Yiyecek (katlı pasta, donut, hamburger, suşi, delikli peynir, haşlanmış yumurta,
  pizza, kurabiye, çikolata, ekmek, makaron), Obje (sabun, kinetik kum, gökkuşağı mum, altın külçe, zeka küpü,
  şeker topu, oyuncak tuğla, zar), Figür (lastik ördek, kardan adam, oyuncak ayı, gülen surat, kalp, futbol topu,
  tenis topu, basketbol topu), Uzay (katmanlı Dünya, Ay). Yeni nesnelerin içi de gerçeğine benzer: narın
  zarlar arasındaki taneleri, mor lahananın beyaz damarlı yaprak katları, biberin boş içi ve çekirdek yatağı,
  mısırın taneleri ve koçanı, tenis ve basketbol topunun içi boş kabuğu.
  Her biri kategorisinde ya da tüm katalogdan "karışık" oynatılabilir.
- **Gerçek kesitler**: İçi katmanlı nesneler (Dünya'nın çekirdeği, soğan halkaları, pasta katları, yumurta sarısı,
  şeftali ve avokado çekirdeği, peynir delikleri) kesildikçe görünür. Az kesimli turlarda parçalar ışın izlemeyle
  gerçek kabuk şekliyle çizilir.
- **Doğru sayaç**: Ekranda çizilen küp sayısı kaliteye göre sınırlanır, sayaç gerçek ızgaradaki sayıyı gösterir.
- **Bıçak sesi** (referans Shorts'a göre ayarlandı): Bıçağın tahtaya değdiği an parlak, çıtır bir "şık"tır.
  Enerjinin ~%80'i 3–13 kHz arasındadır, ~30 ms sürer ve ~60 ms'de 10 dB düşer. İçinde bıçağın 4,4–4,6 kHz ve
  6,6–7,2 kHz civarındaki metalik kısmi tonları ~0,1 sn çınlar; altta zayıf, kısa bir 450 Hz tahta vuruşu ve
  hafif 1 kHz gövde vardır. Vuruştan önceki "fıss" çok kısıktır. Satır daha pes (×0,8), santoku biraz daha tiz
  (×1,08) çınlar. Yatay kesimde yalnızca kayma sesi vardır; küpler düşerken ses çıkmaz. Her nesnenin kendi
  kesim dokusu var (çıtır, sulu, yumuşak, çatırtılı, metal, kum, lastik, taş).
- **Arka fon müziği**: Referans videodaki küçük caz grubu tarzında altı stil, hepsi kontrbas, elektrikli piyano,
  vibrafon / pizzicato ve hafif davulla, temiz mastering ve küçük oda yankısıyla:
  - **Gizemli Caz** (varsayılan): minör, ~148 BPM swing, yürüyen kontrbas, vibrafon melodi, fırçalı davul.
  - **Sinsi Pizzicato**: ~160 BPM, A bölümlerinde iki vuruşlu bas ve pizzicato melodi, parmak şıklatma.
  - **Gece Cazı**: ~123 BPM, daha geniş swing, uzun vibrafon notaları, yumuşak ride.
  - **Hızlı Swing**: ~173 BPM, sürükleyici yürüyen bas, kısa vibrafon notaları, daha sık akorlar.
  - **Bossa Nova**: ~132 BPM, düz sekizlikler, kök-beşli bas, senkoplu akorlar, parmak şıklatma.
  - **Cool Caz**: ~101 BPM, ağır ve havadar, pizzicato melodi, uzun akorlar.
  Telifsiz; "Yeni varyasyon" yeni ton, tempo ve melodi üretir; "Seri üret" stilleri sırayla kullanır.
  İstersen kendi müzik dosyanı yükleyebilir ya da müziği kapatıp yalnızca kesim sesini kullanabilirsin.
- **Kamera**: "Değişen açılar" (varsayılan) her tura kendi açısını verir, nesne düşerken yumuşakça yeni açıya
  geçer, kesim boyunca yavaşça yaklaşır, finalde geri çekilir. Düz nesnelere daha yukarıdan bakar. "Sabit" tek
  açıda kalır.
- **Kesim düzeni**: Bıçak önce sağdan sola dikey, sonra yukarıdan aşağı yatay, en son önden arkaya keser.
  Pizza, kurabiye, donut gibi ince nesnelerde (yükseklik / taban < 0,4) yatay kesim yapılmaz; kesimler dikey ve
  önden arkaya paylaşılır. Parçalar iğneye dönüşecek kadar inceldiğinde ekranda küp oranında çizilir.
- **Kesme hızı**: Bıçak her aşamada eşit aralıkla keser. Aralık turun kesim sayısından gelir (`cutBeat`): ilk
  turda saniyede ~2 kesim, 1000 kesimlik turda saniyede ~86 kesim. Klasik video ~61 sn.
- **Sahneler ve bıçaklar**: Dört sahne: Klasik (açık akçaağaç tahta, koyu taş, koyu fayans duvar), Ceviz (uzun
  ceviz tahta, açık beton, sıcak kırmızı-kahve duvar), Mermer (bambu tahta, beyaz mermer, adaçayı yeşili duvar),
  Arduvaz (arduvaz tahta, koyu meşe masa, petrol yeşili fayans). Üç bıçak: şef bıçağı, satır ve santoku.
  İkisi de ayarlardan anında değişir (`js/sets.js`, `js/textures.js`, `js/knife.js`).
- **Gölgeler** (referans Shorts'tan esinlenildi): Yumuşak kenarlı ve belirgin gölgeler (PCF, yarıçap 3,5).
  Nesne tahtaya indiğinde altında, ayakta kalan kısmını izleyen bir temas gölgesi belirir. Bıçak hızlı
  kesimlerde bulanık çizilirken bile tahtaya gölge düşürür. Her kesik, ince koyu bir oluk ve ışığın ters
  tarafına düşen yumuşak bir gölgeyle çizilir; oluklar sıklaşınca kaybolmaz, ortalama koyuluğa dönüşür.
  Küpler arasında koyu boşluklar vardır ve yığının tabana yakın kısmı daha gölgelidir.
- **Gerçekçi iç ve dış görünüş**: Kesit yüzleri nesneye göre ıslak parlaklık, hafif ışık geçirgenliği ve
  ince hücre dokusu alır (`lookOf`, `fleshShade`). Narenciyede uzun meyve suyu keseleri ve beyaz zarlar,
  kivide ışınsal çizgiler, tohum halkası ve gözyaşı biçimli tohumlar, çilekte açık renkli göbekten yayılan
  lifler, domateste kırmızı duvarlar ve turuncu jöleli odacıklar; kek, ekmek ve hamurda gözenekli iç doku.
  Kabuklarda yağ bezesi çukurları, şeftali ve kivide kadife parıltı (sheen). Futbol topu gerçek kesik
  ikosahedron düzeninde: 12 siyah beşgen, 20 beyaz altıgen.
- **Renkler**: Katalog renkleri ekran (sRGB) değerleriyle yazılır; shader bunları ışıklandırmadan önce doğrusal
  ışığa çevirir (`vivid`, γ 1,6 + hafif doygunluk). Ton eşleme renk tonunu ve doygunluğu koruyan Neutral
  eşlemedir, böylece kesit yüzleri soluk ya da beyaz görünmez.
- **Görüntü kalitesi**: Kesim çizgileri kenarları yumuşatılmış (anti-aliased) çizilir; sıklaşınca ortalama
  koyuluğa geçtiği için yoğun turlarda yüzeyde moiré / merdiven deseni oluşmaz. MP4 çıktısı canlı önizlemeden çok daha ince bir yığınla
  (masaüstünde 420 bine kadar küp) ve 24 Mbit/s ile kodlanır.
- **Akıcılık**: Küp renkleri GPU'da bir kez pişirilir, sayaç rakamları doku yüklemeden çizilir, sonraki nesnenin
  shader'ı ve verisi önceden hazırlanır, kare hızı düşerse çözünürlük en fazla %75'e kadar iner.
- **Video çıktısı**: *MP4 oluştur* (her kare tam zamanında, 1080×1920, H.264 + AAC ses), *Seri üret* (açık
  kategoriden 3 farklı nesne, 3 farklı müzikle arka arkaya), *Canlı kayıt*, *Temiz ekran*. Dosya
  [Mediabunny](https://mediabunny.dev) ile yazılır. Ses, projenin kendi AAC-LC kodlayıcısıyla (`js/aac-encoder.js`)
  ses işçisinde kodlanır: tarayıcının ses kodlayıcısına ya da WebAssembly'ye ihtiyaç yoktur, her cihaz telefon
  galerilerinin, QuickTime'ın ve YouTube'un çaldığı aynı AAC izini yazar. Kodlayıcı ffmpeg'in çözücüsüyle
  doğrulanır (seviye, örnek düzeyinde zamanlama, sinyal/gürültü oranı).
- **Shorts metni**: Her video için başlık, açıklama ve etiketler; tek dokunuşla kopyalanır.

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
| `js/catalog/*` | 52 nesne: şekil, renk, ses profili; önceden hesaplanmış ölçümler (`meta.js`) |
| `js/timeline.js` | Turlar, fazlar ve her kesimin zamanı (ince nesne kuralı dahil) |
| `js/camera.js` | Tur başına kamera açıları ve geçişler |
| `js/cubes-data.js`, `js/cubes-mesh.js` | Küp ızgarası, yığın fiziği, GPU'da küp uçuşu ve üç çizim modu |
| `js/materials.js`, `js/object-glsl.js` | Nesne başına shader programları |
| `js/sfx.js` | Kesim, kayma ve bıçak vuruşu sesi sentezi |
| `js/scene.js`, `js/sets.js`, `js/textures.js` | Işıklar, değiştirilebilir sahneler, prosedürel dokular |
| `js/knife.js`, `js/knife-pose.js` | Bıçak modelleri (şef, satır, santoku) ve kesim hareketi |
| `js/hud.js` | Sayaçlar ve açılış kartı |
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
