# Physics World Cup: Turnuva Motoru

48 ülke ve 104 maçlık turnuvanın tüm sonuçlarını, yayın takvimini ve video başlıklarını **tek bir seed'den** üretir. Aynı seed her zaman aynı turnuvayı verir.

> Güç puanları fiziği değil, **sonucu** etkiler. Model önce skoru belirler. Sonraki adımda fizik motoru bu skoru veren gerçek ve müdahale edilmemiş maçı bulacak (seed taraması).

## Kullanım

Node.js 20 veya üstü gerekir. Hiçbir paket kurulumu gerekmez.

```bash
cd tournament
node cli.js --seed season-1 --start 2026-12-01   # turnuvayı üret
node cli.js --odds 5000                           # şampiyonluk olasılıklarını hesapla
npm test                                          # testleri çalıştır
```

Çıktılar `output/` klasörüne yazılır. Bu klasör git'e eklenmez, çünkü seed'den her zaman yeniden üretilebilir.

| Dosya | İçerik |
|---|---|
| `summary.md` | Gruplar, puan tabloları, eleme ağacı, podyum, en dramatik 10 maç (**tüm sonuçları içerir**) |
| `schedule.csv` | 104 maçın yayın günü ve saati (UTC), skoru ve video başlığı |
| `tournament.json` | Bütün veriler (video üretim hattının girdisi) |

## Ayarlar

**`data/teams.json`:** 48 ülke. Her ülkenin güç puanı (`rating`), torbası (`pot`), reklam değeri (`adTier`: 3 yüksek, 1 düşük), konfederasyonu ve forma renkleri.

**`data/settings.json`:**

| Ayar | Anlamı |
|---|---|
| `model.baseGoals` | Takım başına ortalama gol (1.3) |
| `model.ratingFactor` | Favori etkisi. Artırırsan sürpriz azalır (0.02) |
| `model.penaltyBase` | Penaltı atışlarında gol olasılığı (0.75) |
| `model.penaltyEdgePerPoint` | Güç puanı farkının penaltılara etkisi |
| `format.confederationLimits` | Bir grupta en fazla 3 UEFA, diğer konfederasyonlardan en fazla 1 takım |
| `schedule.*SlotsUtc` | Yayın saatleri: grup aşamasında günde 4, elemelerde günde 3, son gün 2 |

Puanları değiştirdikten sonra `node cli.js --odds 5000` ile şampiyonluk olasılıklarını kontrol et.

## Format (2026 Dünya Kupası yapısı)

- 12 grup × 4 takım. Her grupta her torbadan bir takım olur.
- Her grubun ilk 2'si ve en iyi 8 üçüncü, son 32'ye çıkar.
- Grup sıralaması: puan, averaj, atılan gol, kura.
- Son 32 eşleşmeleri: grup birincileri, ikincileri ve en iyi üçüncüler kendi aralarında sıralanır (1. ile 32. eşleşir, 2. ile 31. eşleşir...). Aynı gruptan iki takım karşılaşmaz.
- Elemelerde beraberlik doğrudan penaltılarla sonuçlanır. Uzatma yok, böylece Short'lar kısa kalır.
- 29 günlük takvim: 18 gün grup aşaması, 10 gün eleme, son gün üçüncülük maçı ve final.

## Gerçekçilik kuralları (`settings.realism`)

Sonuçlar görülmeden önce belirlenen ve **her takıma eşit uygulanan** kurallar. Bir grup aşaması kurallardan birini bozarsa grup aşaması baştan simüle edilir. Hiçbir maç tek tek elle değiştirilmez.

- `minGroupPointsByPot: { "1": 1 }`: 1. torbadaki hiçbir takım grubu 0 puanla bitiremez.
- Bu kural turnuvaların yaklaşık %12'sinde devreye girer. Kaçıncı denemede geçerli bir grup aşaması bulunduğu çıktıda `groupStageAttempt` alanında yazar.
