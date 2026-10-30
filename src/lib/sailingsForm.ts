/**
 * DP-3 / DP-5 (F7 #649, #672): czyste reguły Harmonogram › Rejsy — testowane bez przeglądarki.
 */
import { isKnownRoute, OPERATOR_MATCH_ORDER, type FerryOperator } from './ferryCatalog';

/** U3: znacznik „nieznana trasa” według flagi z bazy (`routeUnknown`), także gdy kod da się rozłożyć na porty. */
export function showRouteUnknown(s: { routeUnknown?: boolean }): boolean {
  return s.routeUnknown === true;
}

/**
 * U2: ręczny rejs zapisuje tylko trasę ze słownika (katalog, Terminal A, kody z bazy). Kod spoza słownika
 * (np. „GDN-KAA”) → klucz komunikatu, bez zapisu i bez podmiany na GDN-NYN.
 */
export function manualRouteError(code: string): 'sv_route_unknown_err' | null {
  return isKnownRoute(code) ? null : 'sv_route_unknown_err';
}

/**
 * DP-20 (F7 r2 #668, decyzja 55): filtr armatora w Rejsach — zawsze wszyscy armatorzy ze słownika
 * (także Viking Line i DFDS bez rejsów), w kolejności katalogu.
 */
export function sailingLineOptions(): readonly FerryOperator[] {
  return OPERATOR_MATCH_ORDER;
}

/** DP-20: wybrany armator bez rejsów w zakresie → komunikat decyzji 55 zamiast ogólnego „brak rejsów”. */
export function emptyRowsKey(lineSel: FerryOperator | 'ALL', future: boolean, returns: boolean): 'sv_line_empty' | 'sv_none_future' | 'sv_none' {
  if (lineSel !== 'ALL') return 'sv_line_empty';
  return future && !returns ? 'sv_none_future' : 'sv_none';
}
