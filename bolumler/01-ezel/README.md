# Bölüm 01 — EZEL · "Bir Piyonun İntikamı"

| | |
|---|---|
| Format | YouTube Shorts, dikey 1080×1920, 30 fps |
| Tahmini süre | ~2:00–2:10 (net süre seslendirme gelince belli olur) |
| Seslendirme | ElevenLabs **Eleven v4**, metin: [`seslendirme-v4.txt`](seslendirme-v4.txt) |
| Görseller | ChatGPT (aşağıdaki promptlar) |
| Kurgu, animasyon, müzik, efekt, altyazı | Claude (kod tabanlı üretim hattı) |

---

## 1. Açılış — ilk 13 saniye

Amaç: 1. saniyede şok cümlesi ve gizemli bir görüntü vermek. İlk 6 saniyede twist ve intikam vaadi gelir. 10. saniyeye kadar üç hain tanıtılır. Ardından başlık kartı gelir. **Hiçbir kare durağan kalmaz.** Her sahnede en az bir kamera hareketi, bir ortam animasyonu ve bir ses efekti bulunur.

| # | Zaman* | Seslendirme | Görsel | Hareket / animasyon | Ses efekti / müzik |
|---|---|---|---|---|---|
| A1 | 0:00–0:02 | "Bu adam… öldü." | Loş hastane odası, tek çıplak ampul. Sandalyede yüzü tamamen sargılı bir adam. | Ampul sallanır, ışık odada sağa sola süpürür. 3 katmanlı parallax ile içeri yaklaşma. Havada toz. | 0.0 sn'de derin "boom" ve kulak çınlaması. Ampul cızırtısı. |
| A2 | 0:02–0:04.5 | "Sonra bir gün, başka bir yüzle geri döndü." | Omuz üstünden aynaya bakış. Yansımada sargılı yüz var. Çatlak büyür, ayna kırılır ve yansımada takım elbiseli yeni yüz belirir. | Çatlak büyüme animasyonu, cam kırıkları (parçacık), beyaz flaş, ani zoom. | Cam gerilme sesi, ardından kırılma ve whoosh. Ezel piyano motifinin ilk notası. |
| A3 | 0:04.5–0:06.5 | "Onu öldürenlerin karşısına." | Arkadan Ezel. Yağmurlu camın ardında yalıda bir davet ve üç figür. | Odak kayması (Ezel'den üçlüye), camdan akan yağmur damlaları, yavaş ilerleme. | Cama vuran yağmur, boğuk davet uğultusu, yükselen gerilim sesi (riser) başlar. |
| A4 | 0:06.5–0:10.5 | "Peki kim öldürdü onu? En yakın iki arkadaşı… ve hayatının kadını." | Karanlıkta satranç tahtası. Spotlar sırayla yanar: beyaz fil (**CENGİZ**), beyaz at (**ALİ**), beyaz vezir (**EYŞAN**). | Her spot yandığında isim etiketi belirir. Kamera tahtanın etrafında yavaşça döner, ışık hüzmelerinde toz uçuşur. | Her spotta şalter sesi ve tahta taş "tak" sesi. Altta kalp atışı. |
| A5 | 0:10.5–0:13 | *(sessiz, `[long pause]`)* | Ön planda tek **siyah piyon** üçüne bakar. **EZEL** başlığı gelir, altında "Bir piyonun intikamı" yazar. | Pirinç harflerde ışık parlaması, kor parçacıkları, darbe sarsıntısı. | Büyük sinematik darbe ve yankı. 0.3 sn sessizlik, sonra "Bak şimdi." |

\* Zamanlar tahminidir. Gerçek seslendirme gelince her kesme sesin ritmine göre ayarlanır.

---

## 2. Görsel kimlik (referans videodan ayrışan kendi dilimiz)

- **Stil:** Sinematik 2.5D. Fırça dokulu, grafik roman havasında illüstrasyonlar katmanlara ayrılıp derinlikli kamera hareketleriyle canlandırılır. Düz vektör ya da siluet kullanılmaz.
- **Ezel paleti:** gece mavisi/petrol `#0E1A24`, pirinç/amber `#C8913A`, idareli kullanılan koyu kan kırmızısı `#8E1B1B`. Üstüne film greni ve vinyet.
- **Ana motif — satranç:** Her karakterin bir taşı var. Bölüm geçişleri tahtada bir hamleyle yapılır, imza sesimiz taşın tahtaya vuruşudur.

| Karakter | Taş | Hikâyedeki karşılığı |
|---|---|---|
| Ömer → Ezel | Siyah **piyon** → siyah **vezir** | Piyon tahtanın sonuna ulaşıp vezire terfi eder (2005: kaçış ve yeni yüz) |
| Cengiz | Beyaz **fil** | |
| Ali | Beyaz **at** | Finalde at, Ezel'in tarafına geçer |
| Eyşan | Beyaz **vezir** | Ezel'in "aynadaki" karşılığı |
| Ramiz Dayı | Yıpranmış ahşap siyah **şah** | |
| Kenan Birkan | Beyaz **şah** | Savaşın öbür kralı |

- **Altyazı:** Montserrat ExtraBold (Türkçe karakter desteği tam). Ekrana 1–3 kelimelik gruplar halinde, aşağıdan yaylanarak gelir. İsimler pirinç rengi, ölüm ve şiddet kelimeleri koyu kırmızı olur. Shorts arayüzünün altına kalmasın diye yazılar ekran yüksekliğinin %55–72 bandında durur.
- **Müzik ve efektler:** Kodla sentezlenir, telif riski yoktur. Ezel'in 4 notalık minör piyano motifi, alçak yaylı dokusu, gerilim anlarında kalp atışı, açılışlarda yükselen gerilim sesleri ve darbe vuruşları kullanılır.

---

## 3. ChatGPT görsel promptları — açılış seti

**Kurallar:**
1. Her promptun başına aşağıdaki **STİL** bloğunu yapıştır.
2. Görselleri **PNG** ve en yüksek çözünürlükte indir. Dosya adı olarak koddaki kimliği kullan (`A1-BG.png` gibi).
3. "Transparent background" isteyen görseller **şeffaf PNG** olmalı. ChatGPT şeffaf veremezse sonuna `on a solid pure green #00FF00 background` ekle, arka planı ben temizlerim.
4. Görsellerde yazı istemiyoruz. Gazete manşeti, isimler ve başlık gibi bütün yazıları kurguda ben ekleyeceğim.

**STİL bloğu:**
```
Cinematic painterly digital illustration in a dark graphic-novel style. Visible brush and ink texture, dramatic single-source lighting with volumetric light beams, deep midnight-teal shadows, warm brass/amber highlights, rare deep-crimson accents, subtle film grain. Semi-realistic stylized proportions. All characters are original and must NOT resemble any real actor or real person. Absolutely no text, letters, numbers, logos or watermarks. Vertical 2:3 portrait. Keep the main subject centered with generous empty margin on all sides (the image will be cropped and animated).
```

**A1-BG** (arka plan, insan yok)
```
Empty, dim hospital recovery room at night in Istanbul in the early 2000s. Peeling pale-green walls, the edge of a metal hospital bed on the left, an empty open space in the center of the room. A single bare light bulb hangs on a cord from the ceiling at the top center and glows warm amber, casting a soft pool of light on the floor; everything else falls into teal darkness. No people, no furniture in the center.
```

**A1-CHAR** (karakter katmanı)
```
A man sitting on a simple wooden chair, facing the viewer, his whole head and face wrapped in white surgical bandages, only two dark eye openings in shadow. Plain dark shirt, slumped shoulders, hands resting on his knees. Full body including the chair, lit from directly above by a warm bare bulb. Transparent background (PNG).
```

**A2a** (ayna, sargılı hâli)
```
Over-the-shoulder view from behind a man whose head is wrapped in white surgical bandages, looking into an old cracked bathroom mirror with a tarnished brass frame. In the mirror we see his reflection: the face completely wrapped in bandages, eyes hidden in shadow. A single bare bulb above, teal shadows, amber highlights.
```

**A2b** (aynı sohbette, A2a üretildikten hemen sonra; aynı kadrajın düzenlenmiş hâli)
```
Edit this exact image. Keep the composition, mirror, frame, lighting and camera angle identical. Change only the man: no bandages anymore. In the mirror his reflection now shows a man in his early 40s with short dark hair, a sharp jawline and light stubble, wearing a black tailored suit and black shirt. Half of his face is in deep shadow, one eye catches warm amber light, cold determined gaze. The man in the foreground, seen from behind, now has short dark hair and the same black suit.
```
> ⭐ **A2b, Ezel'in yüz referansı olacak.** Sonraki bütün Ezel sahnelerinde bu görseli ChatGPT'ye referans olarak vereceğiz.

**A3-BG** (yağmurlu camın ardındaki davet)
```
Night view through a tall rain-streaked window into a warmly lit luxurious waterfront mansion on the Bosphorus during an elegant party: crystal chandeliers, soft golden bokeh. In the middle distance, three figures stand together holding drinks: two men in suits and a woman in a deep crimson evening dress. Their faces are small and softly out of focus. The outside of the window is dark and cold teal. No person in the foreground.
```

**A3-FG** (ön planda arkası dönük Ezel)
```
Back view of a man in a black tailored overcoat, from the waist up, standing and looking away from the viewer. Only the back of his head and shoulders are visible, short dark hair, rim-lit by warm amber light from the front. Transparent background (PNG).
```

**A4-BG** (boş satranç tahtası)
```
An old, worn wooden chessboard on a dark table in an otherwise pitch-black room, low camera angle close to the board surface, the board receding in perspective toward the top of the frame. The board is completely empty. Faint dust floating in the air, teal ambient shadows, a very soft amber glow on the near edge.
```

**A4-PIECES** (taşlar; ayrı ayrı keseceğim. **Bu görsel yatay 3:2 olsun**, STİL bloğundaki "vertical" ifadesini sil)
```
Five hand-carved antique wooden chess pieces standing side by side in a single row, evenly spaced with clear empty gaps between them: a white bishop, a white knight, a white queen, a black pawn, a black queen. White pieces are aged ivory, black pieces are dark ebony with subtle brass details. Same eye-level camera angle and the same soft top lighting for all pieces. Transparent background (PNG). Horizontal 3:2 image.
```

A5 başlık kartı için görsel gerekmiyor. Başlığı, pirinç efektini ve kor parçacıklarını kodla üretiyorum. Piyon A4-PIECES'tan alınacak.

---

## 4. ElevenLabs seslendirme ayarları

- **Model:** Eleven v4
- **Ses:** Batuhan Altınova (ilk tercih). Beğenmezsen Ahmet Akyalçın Pro'yu dene.
- **Metin:** [`seslendirme-v4.txt`](seslendirme-v4.txt) dosyasını **tek parça**, etiketleriyle birlikte yapıştır (~2.450 karakter). Arayüz karakter sınırına takılırsan metni `[dramatically] 2005.` satırından ikiye böl.
- **2–3 deneme** üret ve en doğal olanı seç. Tek bir cümle kötü çıktıysa sadece o paragrafı yeniden üret, iki dosyayı da bana gönder. Birleştirmeyi ben yaparım.
- **Çıktı:** WAV ya da en yüksek kalite MP3. ElevenLabs'te müzik veya efekt **ekleme**, bana temiz ses lazım.

---

## 5. Yayından önce teyit listesi

Metin, dizinin bilinen olay örgüsüne ve referans videodaki bilgilere dayanıyor. Dizi hayranları hataları hemen yakalar, bu yüzden şunları kontrol et:

1. **Tarihler:** Soygun 1997, kaçış 2005.
2. **Başlık kartı:** 2 sezon, 71 bölüm.
3. **Kenan Birkan, Eyşan'ın babası mı?** Hatırladığım kadarıyla öyle. Ama emin olmadığım için metne koymadım. Doğruysa çok güçlü bir twist olur. O durumda Kenan satırının arkasına şunu eklerim:
   `[surprised] Ve işin en büyük sürprizi… Kenan Birkan, Eyşan'ın babası.`

---

## 6. Sıradaki adımlar

1. Sen **seslendirmeyi** ve **açılış görsellerini** (A1–A4, toplam 8 görsel) üretip bana gönderirsin.
2. Ben önce **13 saniyelik açılışı** tamamen bitmiş hâliyle kurgularım: animasyon, müzik, efekt ve altyazı dahil. Bu, kalite testi olur.
3. Açılışı onaylarsan videonun geri kalanının sahne listesini ve promptlarını çıkarırım, ardından bütün bölümü kurgularım.
