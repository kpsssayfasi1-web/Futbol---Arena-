# Dizi Özeti Videosu — Muhteşem Yüzyıl

YouTube için yatay (16:9), yaklaşık 10 dakikalık "dizi özeti + Dizi mi, Tarih mi?" videosu. Video Remotion ile üretilecek.

## Dosyalar
- `SESLENDIRME-METNI.txt`: ElevenLabs'e yapıştırılacak tek parça metin (duygu etiketleri dahil).
- `src/data/script.ts`: Senaryonun kaynağı. Sahneler, vurgulanacak kelimeler ve görsel notları burada.
- `KAYNAKLAR.md`: Her bilgi iddiası, kaynağı ve güven düzeyi.

## Metni değiştirdiysen
```bash
npm install
npm run script:export   # SESLENDIRME-METNI.txt dosyasını yeniden üretir
```

## Durum
- [x] Senaryo + seslendirme metni (doğrulanmış)
- [ ] Seslendirme (ElevenLabs)
- [ ] Görsel stil kararı
- [ ] Sahnelerin Remotion ile üretimi + ses/altyazı senkronu
