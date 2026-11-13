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

- **34 nesne, 6 kategori**: Meyve (elma, karpuz, portakal, kivi, limon, şeftali, avokado, çilek), Sebze (domates,
  kırmızı soğan, havuç, salatalık, balkabağı, patlıcan), Yiyecek (katlı pasta, donut, hamburger, suşi, delikli
  peynir, haşlanmış yumurta), Obje (sabun, kinetik kum, gökkuşağı mum, altın külçe, zeka küpü, şeker topu),
  Figür (lastik ördek, kardan adam, oyuncak ayı, gülen surat, kalp, futbol topu), Uzay (katmanlı Dünya, Ay).
  Her biri kategorisinde ya da tüm katalogdan "karışık" oynatılabilir.
- **Gerçek kesitler**: İçi katmanlı nesneler (Dünya'nın çekirdeği, soğan halkaları, pasta katları, yumurta sarısı,
  şeftali ve avokado çekirdeği, peynir delikleri) kesildikçe görünür. Az kesimli turlarda parçalar ışın izlemeyle
  gerçek kabuk şekliyle çizilir.
- **Doğru sayaç**: Ekranda çizilen küp sayısı kaliteye göre sınırlanır, sayaç gerçek ızgaradaki sayıyı gösterir.
- **ASMR sesi**: Küp düşüşleri tahtanın rezonans modlarıyla (modal sentez) üretilir; büyük parça tok ve uzun,
  minik parça kum gibi; yığına düşen daha yumuşak. Her nesnenin kendi kesim sesi var (çıtır, sulu, yumuşak,
  çatırtılı, metal, kum, lastik, taş). Her küp, ekranda yere değdiği anda ve konumuna göre stereo duyulur.
- **Arka fon müziği**: Her video için yeniden bestelenen gramofon tadında müzik: Gramofon Valsi (obua + arp),
  Kafe Caz (obua, yürüyen bas, fırçalı davul), Barok Çay Saati (obua + klavsen), Paris Musette (akordeon).
  Plak cızırtısı ve gramofon dalgalanması dahil. Telifsiz; "Yeni varyasyon" yeni melodi üretir.
  İstersen kendi müzik dosyanı yükleyebilirsin.
- **Akıcılık**: Küp renkleri GPU'da bir kez pişirilir, sayaç rakamları doku yüklemeden çizilir, sonraki nesnenin
  shader'ı ve verisi önceden hazırlanır, kare hızı düşerse çözünürlük kendini ayarlar.
- **Video çıktısı**: *MP4 oluştur* (her kare tam zamanında, 1080×1920, sesli), *Seri üret* (açık kategoriden
  3 farklı nesne, 3 farklı müzikle arka arkaya), *Canlı kayıt*, *Temiz ekran*.
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
| `js/catalog/*` | 34 nesne: şekil, renk, ses profili; önceden hesaplanmış ölçümler (`meta.js`) |
| `js/timeline.js` | Turlar, fazlar ve her kesimin zamanı |
| `js/cubes-data.js`, `js/cubes-mesh.js` | Küp ızgarası, yığın fiziği, GPU'da küp uçuşu ve üç çizim modu |
| `js/materials.js`, `js/object-glsl.js` | Nesne başına shader programları |
| `js/sfx.js`, `js/landing.js`, `js/music.js` | Ses sentezi, küp düşüş izi, müzik bestecisi |
| `js/audio.js`, `js/events.js` | WebAudio çalma ve çevrimdışı ses render'ı |
| `js/work.js`, `js/worker-hub.js` | Ağır işleri (mesh, küp, ses, müzik) arka planda çalıştırma |
| `js/app.js`, `js/main.js`, `js/titles.js` | Uygulama, arayüz, Shorts metinleri |

## Testler

```bash
cd meyve-kesme
npm test
```

Node'un yerleşik test çalıştırıcısıyla şekil dili, katalog, zaman çizelgesi, küp yığını, bıçak hareketi, ses ve
müzik için birim testleri vardır; ek bağımlılık gerekmez.
