/**
 * E21 (P2) — jedyny moduł formatów widocznych na ekranie.
 * Daty listy: „01.10, 12:00” (czas warszawski, bez sekund). Liczby ze spacją od 1 000 i przecinkiem.
 * Procent: „4,8%” (E21-2).
 */
import { plPlural } from './plPlural';
import { formatCompactInZone, formatCalendarDay, parseInstant, refYearInOps, TZ_OPS, type CorridorZone } from './time';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function zoneParts(at: Date, timeZone: string): { y: number; mo: number; d: number; h: number; mi: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(at);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  return { y: g('year'), mo: g('month'), d: g('day'), h: g('hour'), mi: g('minute') };
}

/** „07.10, 12:00”; inny rok: „07.10.2025, 12:00”. Sam dzień kalendarza bez godziny. */
export function formatListDateTime(
  iso: string | null | undefined,
  timeZone: CorridorZone = TZ_OPS,
  refYear: number = refYearInOps(),
): string {
  if (!iso) return '—';
  const raw = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const full = formatCalendarDay(raw);
    const y = Number(raw.slice(0, 4));
    return y === refYear ? full.slice(0, 5) : full;
  }
  const d = parseInstant(raw);
  if (!d) return raw;
  const p = zoneParts(d, timeZone);
  const day = p.y === refYear ? `${pad(p.d)}.${pad(p.mo)}` : `${pad(p.d)}.${pad(p.mo)}.${p.y}`;
  return `${day}, ${pad(p.h)}:${pad(p.mi)}`;
}

/** Zwięzła data ze strefy — zostawione dla miejsc, które już wołają time.ts. */
export function formatListCompact(iso: string | null | undefined, timeZone: CorridorZone = TZ_OPS): string {
  const c = formatCompactInZone(iso, timeZone);
  return c.includes(' ') ? c.replace(' ', ', ') : c;
}

/** Przecinek dziesiętny, spacja co 3 cyfry od 1 000. */
export function formatPlNumber(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return '—';
  const neg = n < 0;
  const [i, f] = Math.abs(n).toFixed(digits).split('.');
  const grouped = i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${neg ? '-' : ''}${grouped}${f ? `,${f}` : ''}`;
}

/** „4,8%” — wartość już w punktach procentowych (4,8), nie ułamek. */
export function formatPercentPoints(points: number, digits = 1): string {
  return `${formatPlNumber(points, digits)}%`;
}

/** „1 726,59 PLN”. */
export function formatPlMoney(amount: number, currency: string, digits = 2): string {
  return `${formatPlNumber(amount, digits)} ${currency}`;
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
