# Meyve vs Kesim

"Apple vs 1000 cuts" tarzı tatmin edici (satisfying / ASMR) Shorts videolarını tarayıcıda üreten Three.js sahnesi.
Bir meyve tahtaya düşer, bıçak önce dikey, sonra yatay, en son önden arkaya dilimler; her son dilimde öndeki parça
küplere ayrılıp yığına dökülür. Turlar 10 kesimden 1000'e (Efsane modunda 5000'e) çıkar.

## Çalıştırma

Klasörü herhangi bir statik sunucuyla açın (ES modülleri `file://` üzerinden çalışmaz):

```bash
cd meyve-kesme
python3 -m http.server 8000
# http://localhost:8000
```

GitHub Pages açıksa doğrudan `https://<kullanıcı>.github.io/Futbol---Arena-/meyve-kesme/` adresinden çalışır.
MP4 oluşturma güvenli bağlantı ister (https veya localhost).

## Özellikler

- **Gerçek kesim**: Az kesimli turlarda her parça meyve şekline göre ışın izlemeyle çizilir; kabuklu, eğri yüzeyli
  gerçek parçalar görünür. Çok kesimli turlarda yüz binlerce küp GPU'da canlandırılır.
- **Doğru sayaç**: Ekranda çizilen küp sayısı kaliteye göre sınırlanır, ama sayaç gerçek ızgaradaki küp sayısını
  gösterir (1000 kesimde ≈ 17,6 milyon). Kesim sayısı küçükken sayı birebir doğrudur.
- **4 meyve**: Elma, karpuz, portakal, kivi; her birinin kabuğu, iç dokusu ve çekirdekleri ayrı. "Karışık" her turda
  meyveyi değiştirir.
- **ASMR sesi**: Bıçağın tahtaya vuruşu, çıtırtı, yatay kesim sürtünmesi, düşen küplerin tıkırtısı ve binlerce minik
  küpün kum gibi dökülmesi tamamen kodla sentezlenir. Dış ses dosyası yoktur.
- **Hareket bulanıklığı**: Bıçak saniyede yüzlerce kesim yaptığında kare içi örneklerle bulanık iz bırakır.
- **Video çıktısı**:
  - *MP4 oluştur*: Her kare tam zamanında render edilir (WebCodecs); yavaş cihazda bile takılmayan 1080×1920 video,
    sesiyle birlikte. Chrome, Edge ve güncel Safari'de çalışır.
  - *Canlı kayıt*: Ekranı sesle birlikte MediaRecorder ile kaydeder.
  - *Temiz ekran*: Arayüzü gizler; telefonun ekran kaydı için.
- **Ayarlar**: tur seti, hız, ekran yazısı (KESİM/KÜP veya CUTS/CUBES), kanal adı, küp kalitesi, ses, döngü.

Tüm animasyon zamanın saf bir fonksiyonudur: aynı ayarlarla her render birebir aynıdır ve zaman çizelgesinde
istediğiniz ana atlayabilirsiniz.

## Yapı

| Dosya | Görev |
| --- | --- |
| `js/timeline.js` | Turlar, fazlar ve her kesimin zamanı |
| `js/fruits.js`, `js/fruit-glsl.js` | Meyve şekilleri (JS ve GLSL'de aynı formül), renkler |
| `js/cubes-data.js` | Küp ızgarası, kopma zamanları, yığın fiziği, gerçek küp sayısı tahmini |
| `js/cubes-mesh.js` | GPU'da küp uçuşu, büyük parçalar için ışın izleme |
| `js/knife-pose.js`, `js/knife.js` | Bıçak hareketi ve modeli |
| `js/sfx.js`, `js/events.js`, `js/audio.js` | Ses sentezi, ses olayları, WebAudio çalma ve çevrimdışı render |
| `js/exporter.js`, `js/recorder.js` | MP4 dışa aktarma ve canlı kayıt |
| `js/app.js`, `js/main.js` | Sahneyi birleştiren uygulama ve arayüz |

## Testler

```bash
cd meyve-kesme
npm test
```

Zaman çizelgesi, meyve şekilleri, küp yığını, bıçak hareketi ve ses olayları için Node'un yerleşik test
çalıştırıcısıyla 33 birim testi vardır; ek bağımlılık gerekmez.
