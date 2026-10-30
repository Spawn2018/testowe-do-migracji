/**
 * wyglad/P7-d — Harmonogram › Rejsy według E30 pkt 7 (makieta `makiety_html/E30/harm.html`, raport `img/e30-after`):
 * domyślnie tylko rejsy do Szwecji („Pokaż powroty”), źródło „Stena Line” zamiast klucza, kolumna „Transporty”
 * z kodami (kliknięcie filtruje Harmonogram), pod tabelą zasięg rozkładów. Same obliczenia widoku (F8).
 */
import type { FerryRoute, Load, Sailing } from '../types';
import {
  FERRY_ROUTES, isOutbound as isOutboundRoute, OPERATOR_MATCH_ORDER, operatorFromText, operatorsForRoute,
  routeShortLabel, type FerryOperator,
} from './ferryCatalog';
import { effArrival, effDeparture } from './sailings';
import { fmtDate, fmtDateTime } from './time';

export type SailLine = FerryOperator;

/** Kierunek do Szwecji (E30 pkt 7: domyślnie tylko te); BN9-a — z katalogu promów (też wyjazdowe z Estonii). */
export const isOutbound = (route: FerryRoute): boolean => isOutboundRoute(route);

/** Armator: z `vessels.operator`, a bez niego z trasy (Gdynia ⇄ Karlskrona = Stena Line; pierwszy armator z katalogu). */
export function lineOf(s: Pick<Sailing, 'route' | 'operator'>): SailLine {
  return operatorFromText(s.operator) ?? operatorsForRoute(s.route)[0] ?? 'POLFERRIES';
}

/**
 * „GDN → NYN” — z katalogu; #666 C: Proxy na `routeShortLabel` (Terminal A + trasy z RPC).
 * Indeksacja `ROUTE_SHORT[code]` dla nieznanego kodu zwraca etykietę z helpera.
 */
export const ROUTE_SHORT: Record<string, string> = new Proxy(
  Object.fromEntries([
    ...FERRY_ROUTES.map((r) => [r.code, routeShortLabel(r.code)] as const),
    ['TLLA-HEL', routeShortLabel('TLLA-HEL')] as const,
    ['HELA-TLL', routeShortLabel('HELA-TLL')] as const,
  ]),
  { get: (t, prop) => (typeof prop === 'string' ? (t[prop] ?? routeShortLabel(prop)) : undefined) },
);

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

/** Zasięg rozkładów w bazie: ostatnie odejście (bez odwołanych) na armatora — Stena, potem Polferries (makieta E30), potem nowi (BN9-a, tylko z rejsami). */
export function reachOf(sailings: Sailing[]): Reach[] {
  const last = new Map<SailLine, string>();
  for (const s of sailings) {
    if (s.status === 'ODWOLANY') continue;
    const line = lineOf(s);
    const dep = effDeparture(s);
    const cur = last.get(line);
    if (!cur || Date.parse(dep) > Date.parse(cur)) last.set(line, dep);
  }
  return OPERATOR_MATCH_ORDER.flatMap((line) => (last.has(line) ? [{ line, untilIso: last.get(line)! }] : []));
}

/** Klucz tekstu źródła (E30: „Stena Line” zamiast „sail_src_STENA”). */
export const sourceKey = (src: Sailing['source']): string => `sv_src_${src}`;
