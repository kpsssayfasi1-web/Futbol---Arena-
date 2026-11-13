// Item registry: every shape the studio can cut, grouped by category.
import { FRUITS } from './fruits.js';
import { VEGGIES } from './veggies.js';
import { FOODS } from './foods.js';
import { OBJECTS, FIGURES, SPACE } from './objects.js';

export const CATEGORIES = [
  { id: 'fruit', tr: 'Meyve', en: 'Fruit', trPlural: 'Meyveler', enPlural: 'Fruits' },
  { id: 'veg', tr: 'Sebze', en: 'Vegetable', trPlural: 'Sebzeler', enPlural: 'Vegetables' },
  { id: 'food', tr: 'Yiyecek', en: 'Food', trPlural: 'Yiyecekler', enPlural: 'Foods' },
  { id: 'object', tr: 'Obje', en: 'Object', trPlural: 'Objeler', enPlural: 'Objects' },
  { id: 'figure', tr: 'Figür', en: 'Figure', trPlural: 'Figürler', enPlural: 'Figures' },
  { id: 'space', tr: 'Uzay', en: 'Space', trPlural: 'Gezegenler', enPlural: 'Planets' },
];

export const ITEMS = [...FRUITS, ...VEGGIES, ...FOODS, ...OBJECTS, ...FIGURES, ...SPACE];
const BY_ID = new Map(ITEMS.map((it) => [it.id, it]));

export function itemById(id) {
  return BY_ID.get(id) || ITEMS[0];
}

export function itemsInCategory(cat) {
  return ITEMS.filter((it) => it.cat === cat);
}

// Selection syntax: an item id, "mix:<category>" or "mix:all".
export function itemForRound(selection, index, seed = 0) {
  if (!selection || !selection.startsWith('mix:')) return itemById(selection).id;
  const cat = selection.slice(4);
  const pool = cat === 'all' ? ITEMS : itemsInCategory(cat);
  if (!pool.length) return ITEMS[0].id;
  // Deterministic shuffle per seed so mixed videos differ but never repeat back to back.
  const order = pool.map((it, i) => ({ it, k: Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453 % 1 }));
  order.sort((a, b) => a.k - b.k);
  return order[index % order.length].it.id;
}

export function isValidSelection(sel) {
  if (BY_ID.has(sel)) return true;
  if (!sel || !sel.startsWith('mix:')) return false;
  const cat = sel.slice(4);
  return cat === 'all' || CATEGORIES.some((c) => c.id === cat);
}
