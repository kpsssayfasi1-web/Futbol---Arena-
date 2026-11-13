// Opening question and ready-to-paste Shorts title, description and hashtags.
import { itemById, CATEGORIES } from './catalog/index.js';

const lowerTr = (s) => s.toLocaleLowerCase('tr-TR');
const lowerEn = (s) => s.toLowerCase();

function maxCuts(timeline) {
  return timeline.rounds[timeline.rounds.length - 1].cuts;
}

function subject(settings, timeline, lang) {
  const sel = settings.item || 'apple';
  if (sel.startsWith('mix:')) {
    const cat = CATEGORIES.find((c) => c.id === sel.slice(4));
    if (lang === 'tr') return { name: (cat ? cat.trPlural : 'Hepsi').toLocaleUpperCase('tr-TR'), plural: true };
    return { name: (cat ? cat.enPlural : 'Everything').toUpperCase(), plural: true };
  }
  const it = itemById(timeline.rounds[0].itemId);
  return { name: lang === 'tr' ? it.tr : it.en, plural: false, proper: !!it.proper };
}

export function hookText(settings, timeline) {
  const lang = settings.lang === 'tr' ? 'tr' : 'en';
  const n = maxCuts(timeline).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US');
  const s = subject(settings, timeline, lang);
  const cap = (t) => t.charAt(0).toLocaleUpperCase(lang === 'tr' ? 'tr-TR' : 'en-US') + t.slice(1);
  if (lang === 'tr') {
    if (s.plural || s.proper) return `${cap(lowerTr(s.name))} ${n} kesime dayanabilir mi?`;
    return `Bu ${lowerTr(s.name)} ${n} kesime dayanabilir mi?`;
  }
  if (s.plural) return `Can ${lowerEn(s.name)} survive ${n} cuts?`;
  return `Can ${s.proper ? 'the' : 'this'} ${lowerEn(s.name)} survive ${n} cuts?`;
}

export function shortsCopy(settings, timeline, finalCubes) {
  const lang = settings.lang === 'tr' ? 'tr' : 'en';
  const n = maxCuts(timeline);
  const s = subject(settings, timeline, lang);
  const cubes = finalCubes ? finalCubes.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US') : '';
  const tags = new Set(lang === 'tr' ? ['#asmr', '#satisfying', '#keşfet', '#shorts', '#rahatlatıcı'] : ['#asmr', '#satisfying', '#oddlysatisfying', '#shorts', '#cutting']);
  for (const r of timeline.rounds) {
    const it = itemById(r.itemId);
    tags.add(`#${(lang === 'tr' ? lowerTr(it.tr) : lowerEn(it.en)).replace(/\s+/g, '')}`);
  }
  if (lang === 'tr') {
    return {
      title: `${s.name} vs ${n.toLocaleString('tr-TR')} KESİM 🔪 Sonunda kaç küp çıktı?`,
      description: `${hookText(settings, timeline)} Her turda bıçak daha hızlı kesiyor${cubes ? `, son turda ≈ ${cubes} küp` : ''}. Sence sıradaki ne olsun? 👇`,
      tags: [...tags].slice(0, 10).join(' '),
    };
  }
  return {
    title: `${s.name} vs ${n.toLocaleString('en-US')} CUTS 🔪 How many cubes?`,
    description: `${hookText(settings, timeline)} The knife gets faster every round${cubes ? `, ending at ≈ ${cubes} cubes` : ''}. What should I cut next? 👇`,
    tags: [...tags].slice(0, 10).join(' '),
  };
}
