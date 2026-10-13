/**
 * P2-poprawki — tytuł ROAD_SE w kształcie generatora (road.ts + describeDeviation).
 * Miejsce: plSeLocation. Czas: formatListDateTime (E21). Rodzaj z detail.rodzaj.
 */
import { formatListDateTime } from '../format';
import { plSeLocation } from './seLocation';

const FORBIDDEN = /\b(från|till|mellan|och|båda|riktning|vid|län|kommun)\b/iu;

export function roadSeTitleHasForbidden(title: string): boolean {
  return FORBIDDEN.test(title);
}

export function roadSeRepairTitle(input: {
  /** Obecny tytuł — z niego bierzemy numer drogi, gdy opis miejsca go nie zawiera. */
  currentTitle: string;
  rodzaj: string;
  event: string;
  od: string;
  doAt: string;
  refYear?: number;
}): string {
  const kind = input.rodzaj === 'zamkniecie' ? 'zamknięcie drogi' : 'roboty drogowe';
  const placed = plSeLocation(input.event.trim());
  const lead = placed.match(/^(E\d{1,3})(?::\s+|\s+)(.*)$/u);
  const fromTitle = input.currentTitle.match(/\b(E\d{1,3})\b/);
  const road = lead?.[1] ?? fromTitle?.[1] ?? 'E4';
  const place = (lead ? lead[2] : placed).replace(/\s+/g, ' ').trim().replace(/,\s*$/, '');
  const from = formatListDateTime(input.od, 'Europe/Warsaw', input.refYear);
  const to = formatListDateTime(input.doAt, 'Europe/Warsaw', input.refYear);
  const bits = [kind, place, `od ${from} do ${to}`].filter((x) => x.length > 0);
  return `Warunki drogowe ${road}: ${bits.join(', ')}`;
}
