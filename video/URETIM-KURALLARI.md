# Üretim kuralları (kanal sahibinin kesin talimatları)

1. **ElevenLabs YALNIZCA konuşma seslerini (TTS) üretmek ve indirmek için kullanılır.**
   Ses efektleri, arka plan müziği, görsel ve video üretimi ASLA ElevenLabs ile yapılmaz;
   bunların tamamı kodla (canvas animasyon, numpy ses sentezi, ffmpeg) üretilir.
2. Her replik için **tek kayıt** üretilir (generations_count = 1), alternatif kayıt yok.
3. Kanal logosu (`marka/kanal-logo.png`) video boyunca sabit bir köşede, şeffaf olarak durur.
