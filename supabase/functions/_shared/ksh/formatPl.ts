/** Edge: tylko formatPlNumber (lustro src/lib/format.ts — kontrakt F7 #556). */
export function formatPlNumber(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return '—';
  const neg = n < 0;
  const [i, f] = Math.abs(n).toFixed(digits).split('.');
  const grouped = i.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  return `${neg ? '-' : ''}${grouped}${f ? `,${f}` : ''}`;
}
