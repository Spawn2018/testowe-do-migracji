/**
 * wyglad/P7-d — Harmonogram › Rejsy według E30 pkt 7 (makieta `makiety_html/E30/harm.html`, raport `img/e30-after`):
 * domyślnie tylko rejsy do Szwecji („Pokaż powroty”), źródło „Stena Line” zamiast klucza, kolumna „Transporty”
 * z kodami (kliknięcie filtruje Harmonogram), pod tabelą zasięg rozkładów. Same obliczenia widoku (F8).
 */
import type { FerryRoute, Load, Sailing } from '../types';
import { effArrival, effDeparture } from './sailings';
import { fmtDate, fmtDateTime } from './time';

export type SailLine = 'POLFERRIES' | 'STENA';

/** Kierunek do Szwecji (E30 pkt 7: domyślnie tylko te). */
export const isOutbound = (route: FerryRoute): boolean => route === 'GDN-NYN' || route === 'GDY-KAA';

/** Armator: z `vessels.operator`, a bez niego z trasy (Gdynia ⇄ Karlskrona = Stena Line). */
export function lineOf(s: Pick<Sailing, 'route' | 'operator'>): SailLine {
  const op = (s.operator ?? '').toLowerCase();
  if (op.includes('stena')) return 'STENA';
  if (op.includes('polferries')) return 'POLFERRIES';
  return s.route === 'GDY-KAA' || s.route === 'KAA-GDY' ? 'STENA' : 'POLFERRIES';
}

export const ROUTE_SHORT: Record<FerryRoute, string> = {
  'GDN-NYN': 'GDN → NYN',
  'NYN-GDN': 'NYN → GDN',
  'GDY-KAA': 'GDY → KAA',
  'KAA-GDY': 'KAA → GDY',
};

const TZ = 'Europe/Warsaw';

/** „08.10.2026, 18:00” — rok zawsze (właściciel 16.10.2026). Czas polski. */
export function sailTime(iso: string): string {
  return fmtDateTime(iso, TZ);
}

/** „18.10.2026” (zasięg rozkładu) — rok zawsze. */
export function sailDay(iso: string): string {
  return fmtDate(iso, TZ);
}

const byCode = (a: string, b: string) => a.localeCompare(b, 'pl', { numeric: true });

export interface SailRow {
  sailing: Sailing;
  line: SailLine;
  dep: string;
  arr: string;
  delayed: boolean;
  gone: boolean;
  /** Kody transportów przypisanych do rejsu (`loads.sailing_id`), rosnąco. */
  codes: string[];
}

export interface SailOpts { future: boolean; returns: boolean }

/**
 * Wiersze tabeli: „Przyszłe” = odejście (po opóźnieniu) od teraz; bez „Pokaż powroty” tylko kierunek do Szwecji;
 * od najbliższego odejścia.
 */
export function sailRows(sailings: Sailing[], loads: Pick<Load, 'code' | 'sailingId'>[], nowIso: string, opts: SailOpts): SailRow[] {
  const nowMs = Date.parse(nowIso);
  const codesOf = new Map<string, string[]>();
  for (const l of loads) {
    if (!l.sailingId) continue;
    const a = codesOf.get(l.sailingId) ?? [];
    a.push(l.code);
    codesOf.set(l.sailingId, a);
  }
  return sailings
    .filter((s) => (opts.returns || isOutbound(s.route)) && (!opts.future || Date.parse(effDeparture(s)) >= nowMs))
    .sort((a, b) => Date.parse(effDeparture(a)) - Date.parse(effDeparture(b)))
    .map((s) => ({
      sailing: s,
      line: lineOf(s),
      dep: effDeparture(s),
      arr: effArrival(s),
      delayed: s.delayedDepartureAt != null || s.delayedArrivalAt != null,
      gone: Date.parse(effDeparture(s)) <= nowMs,
      codes: [...(codesOf.get(s.id) ?? [])].sort(byCode),
    }));
}

export interface Reach { line: SailLine; untilIso: string }

/** Zasięg rozkładów w bazie: ostatnie odejście (bez odwołanych) na armatora — Stena, potem Polferries (makieta E30). */
export function reachOf(sailings: Sailing[]): Reach[] {
  const last = new Map<SailLine, string>();
  for (const s of sailings) {
    if (s.status === 'ODWOLANY') continue;
    const line = lineOf(s);
    const dep = effDeparture(s);
    const cur = last.get(line);
    if (!cur || Date.parse(dep) > Date.parse(cur)) last.set(line, dep);
  }
  return (['STENA', 'POLFERRIES'] as const).flatMap((line) => (last.has(line) ? [{ line, untilIso: last.get(line)! }] : []));
}

/** Klucz tekstu źródła (E30: „Stena Line” zamiast „sail_src_STENA”). */
export const sourceKey = (src: Sailing['source']): string => `sv_src_${src}`;
