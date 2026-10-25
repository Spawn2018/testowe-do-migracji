/** Edge: tylko formatPlNumber (bez i18n/time). */
export function formatPlNumber(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return '—';
  const neg = n < 0;
  const [i, f] = Math.abs(n).toFixed(digits).split('.');
  const grouped = i.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  const body = f != null && digits > 0 ? `${grouped},${f}` : grouped;
  return neg ? `-${body}` : body;
}
