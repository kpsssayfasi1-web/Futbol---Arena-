// Counter text: exact numbers while we really render every cube, "≈" rounded to
// thousands once the real count is estimated.
export function formatCount(value, approx, locale = 'en-US') {
  const n = Math.max(0, Math.round(value));
  const shown = approx && n >= 1000 ? Math.round(n / 1000) * 1000 : n;
  const text = shown.toLocaleString(locale);
  return approx && n > 0 ? `≈ ${text}` : text;
}

export const LABELS = {
  tr: { cuts: 'KESİM', cubes: 'KÜP', locale: 'tr-TR' },
  en: { cuts: 'CUTS', cubes: 'CUBES', locale: 'en-US' },
};
