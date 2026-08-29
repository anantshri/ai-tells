// Formats a page's match count into text for the toolbar action badge.
// An empty string hides the badge (used when there are no matches); large
// counts are capped so they stay legible in the small toolbar badge.

export function badgeText(count) {
  const n = Number(count);
  if (!Number.isFinite(n) || n <= 0) return '';
  const whole = Math.floor(n);
  return whole > 999 ? '999+' : String(whole);
}
