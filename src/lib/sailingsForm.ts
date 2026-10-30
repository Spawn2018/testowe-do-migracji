/**
 * DP-3 / DP-5 (F7 #649, #672): czyste reguły Harmonogram › Rejsy — testowane bez przeglądarki.
 */
import { isKnownRoute } from './ferryCatalog';

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
