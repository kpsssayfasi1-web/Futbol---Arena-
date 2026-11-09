# Futbol---Arena-
Football Arena Animation

## MP4 video oluşturma (Remotion)

`index.html` tarayıcıda canlı oynanan sürümdür. `src/` klasöründe aynı fizik ve çizimin
[Remotion](https://www.remotion.dev) ile videoya dönüştürülebilen, kare tabanlı (deterministik) sürümü bulunur.

Gereksinim: Node.js 18+ (önerilen 22).

```bash
npm install            # bağımlılıkları kur (ilk seferde)
npm run studio         # tarayıcıda önizleme: http://localhost:3000
npm run render         # out/football-arena.mp4 (1080x1920, 30 fps, 20 sn)
npm run render:short   # sadece ilk 3 saniye, hızlı deneme
npm run still          # out/preview.png tek kare
npm test               # simülasyon testleri
```

- İlk render'da Remotion, Chrome Headless Shell'i otomatik indirir (internet gerekir).
- Farklı bir maç için seed değiştirin: `npx remotion render src/index.ts FootballArena out/mac2.mp4 --props='{"seed":7}'`
- Süre, çözünürlük ve fps `src/Root.tsx` içindedir.
