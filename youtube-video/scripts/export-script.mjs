// Senaryoyu ElevenLabs'e yapıştırılacak tek parça metin olarak dışa aktarır.
// Kullanım: npm run script:export  →  SESLENDIRME-METNI.txt
import {writeFileSync} from 'node:fs';
import {SCENES} from '../src/data/script.ts';

const paragraphs = [];
let current = [];
let lastChapter = SCENES[0].chapter;
for (const scene of SCENES) {
  if (scene.chapter !== lastChapter) {
    paragraphs.push(current.join(' '));
    current = [];
    lastChapter = scene.chapter;
  }
  current.push(scene.text.trim());
}
paragraphs.push(current.join(' '));

const fullText = paragraphs.join('\n\n') + '\n';
const spoken = fullText.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
writeFileSync(new URL('../SESLENDIRME-METNI.txt', import.meta.url), fullText);
console.log(`Karakter (etiketli): ${fullText.length}`);
console.log(`Kelime (konuşulan): ${spoken.split(' ').length}`);
console.log(`Tahmini süre: ~${Math.round(spoken.split(' ').length / 2.3)} sn`);
