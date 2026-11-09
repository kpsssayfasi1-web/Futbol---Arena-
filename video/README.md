# Football Arena — Remotion

Football Arena için React ile programatik video üretimi ([Remotion](https://www.remotion.dev)).

## Kurulum

```bash
cd video
npm install
```

## Komutlar

| Komut | Açıklama |
|-------|----------|
| `npm run dev` | Remotion Studio'yu tarayıcıda açar (canlı önizleme) |
| `npm run render` | `out/futbol-arena-intro.mp4` dosyasını üretir |
| `npm run still` | 60. kareden `out/thumbnail.png` küçük resmi üretir |
| `npm run upgrade` | Remotion paketlerini günceller |

## Yapı

- `src/index.ts` — giriş noktası (`registerRoot`)
- `src/Root.tsx` — kompozisyonlar (1080×1920, 30 fps, 5 sn)
- `src/FutbolArenaIntro.tsx` — örnek intro animasyonu

Yeni bir video eklemek için `src/` altına bir bileşen yazıp `Root.tsx` içinde yeni bir `<Composition>` olarak kaydedin.

> Not: Remotion ilk render'da kendi Chrome Headless Shell'ini indirir. İnternet erişimi kısıtlı ortamlarda
> `--browser-executable=/path/to/chromium` ile mevcut bir Chromium kullanılabilir.
