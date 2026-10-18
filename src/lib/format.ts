/**
 * E21 (P2) — jedyny moduł formatów widocznych na ekranie.
 * Daty listy: „01.10.2026, 12:00” (czas warszawski, bez sekund; rok zawsze — właściciel 16.10.2026). Liczby ze spacją od 1 000 i przecinkiem.
 * Procent: „4,8%” (E21-2).
 */
import { plPlural } from './plPlural';
import { fmtDateTime, formatCompactInZone, formatCalendarDay, parseInstant, TZ_OPS, type CorridorZone } from './time';

/** „07.10.2026, 12:00” (czas warszawski, bez sekund); sam dzień kalendarza „07.10.2026”. Rok zawsze (właściciel 16.10.2026). */
export function formatListDateTime(iso: string | null | undefined, timeZone: CorridorZone = TZ_OPS): string {
  if (!iso) return '—';
  const raw = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return formatCalendarDay(raw);
  const d = parseInstant(raw);
  if (!d) return raw;
  return fmtDateTime(d, timeZone);
}

/** Zwięzła data ze strefy — zostawione dla miejsc, które już wołają time.ts („07.10.2026, 12:00”). */
export function formatListCompact(iso: string | null | undefined, timeZone: CorridorZone = TZ_OPS): string {
  return formatCompactInZone(iso, timeZone);
}

/** Przecinek dziesiętny, spacja co 3 cyfry od 1 000. */
/* wyglad/W-przed-wydaniem-2: separator tysięcy = twarda spacja (U+00A0) — liczba nie łamie się w środku („18” / „245,92”, E8) */
export function formatPlNumber(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return '—';
  const neg = n < 0;
  const [i, f] = Math.abs(n).toFixed(digits).split('.');
  const grouped = i.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  return `${neg ? '-' : ''}${grouped}${f ? `,${f}` : ''}`;
}

/** „4,8%” — wartość już w punktach procentowych (4,8), nie ułamek. */
export function formatPercentPoints(points: number, digits = 1): string {
  return `${formatPlNumber(points, digits)}%`;
}

/** „1 726,59 PLN”. */
export function formatPlMoney(amount: number, currency: string, digits = 2): string {
  return `${formatPlNumber(amount, digits)}\u00a0${currency}`;
}

/** „800 m” / „2,3 km”. */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return '—';
  const m = Math.abs(meters);
  if (m < 1000) return `${formatPlNumber(m, 0)} m`;
  return `${formatPlNumber(m / 1000, 1)} km`;
}

export function vehiclesInMotion(n: number): string {
  const v = Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
  return `${v} ${plPlural(v, 'pojazd', 'pojazdy', 'pojazdów')} w ruchu`;
}

/** E21: „Nieznany kod źródła drogowego” tylko w Stanie systemu (P10a), nie w dzwonku i Ryzykach. */
export function isTechnicalRoadNotice(text: string | null | undefined): boolean {
  return (text ?? '').includes('Nieznany kod źródła drogowego');
}
