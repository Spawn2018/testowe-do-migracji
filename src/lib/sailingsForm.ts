/**
 * DP-3 / DP-5 (F7 #649, #672): czyste reguły Harmonogram › Rejsy — testowane bez przeglądarki.
 */
import { FERRY_OPERATOR_CODES, isKnownRoute, type FerryOperator } from './ferryCatalog';

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
 * (także Viking Line i DFDS bez rejsów). N2 (F7 #674): kolejność katalogu — Polferries pierwsze, jak awizacja i lista statków.
 */
export function sailingLineOptions(): readonly FerryOperator[] {
  return FERRY_OPERATOR_CODES;
}

/**
 * DP-20: komunikat pustej listy. N3 (F7 #674): decyzja 55 tylko gdy wybrany armator nie ma żadnego rejsu
 * w rozkładzie (`lineHasAny = false`); gdy rejsy są, ale ukryte przez „Przyszłe” / „Pokaż powroty” — zwykły komunikat.
 */
export function emptyRowsKey(lineSel: FerryOperator | 'ALL', lineHasAny: boolean, future: boolean, returns: boolean): 'sv_line_empty' | 'sv_none_future' | 'sv_none' {
  if (lineSel !== 'ALL' && !lineHasAny) return 'sv_line_empty';
  return future && !returns ? 'sv_none_future' : 'sv_none';
}

/**
 * N5 (F7 #674) / DP-28: klucz pola „Statek” — zmiana listy (zapas → baza) montuje pole od nowa,
 * żeby domyślny „Wawel” z bazy był wybrany już przy pierwszym otwarciu formularza.
 */
export function vesselSelectKey(groups: readonly unknown[], fallback: readonly unknown[]): 'zapas' | 'baza' {
  return groups === fallback ? 'zapas' : 'baza';
}

/**
 * N6 (F7 #674) / DP-28: wejście z wiersza promu — co ustawić, żeby rejs był widoczny i wyróżniony.
 * `null` = rejsu nie ma w rozkładzie (nic nie zmieniamy). Filtr armatora zawsze wraca do „Wszyscy”;
 * gdy rejsu nie widać przy bieżących przełącznikach — pokazujemy też minione i powroty.
 */
export function sailingFocusPlan(
  focusId: string | null,
  sailingIds: readonly string[],
  visibleIds: readonly string[],
): { focusId: string; lineSel: 'ALL'; showAll: boolean } | null {
  if (!focusId || !sailingIds.includes(focusId)) return null;
  return { focusId, lineSel: 'ALL', showAll: !visibleIds.includes(focusId) };
}
