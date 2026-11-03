/**
 * BN9-c6 (ekrany po BN8, #720 §3 pkt 5) — czyste pomocniki widoku: trasa transportu, kraj przypłynięcia,
 * armator startowy awizacji. Bez zapytań i zapisów; reguły ze słownika promów (`ferryCatalog`) i `routeOfLoad`.
 */
import type { Load, Sailing } from '../../types';
import { operatorsForRoute, portByCode, routeEnds, type FerryCountry, type FerryOperator } from '../../lib/ferryCatalog';
import { crossingLine } from '../../lib/sailings';
import { routeOfLoad, sessionDemoRoutes } from '../../lib/map/routeLegs';
import { PROD_BUILD } from '../../lib/prodFacade';

/** Trasa promu transportu: rejs przypięty, statek o godzinie rejsu; demo — także `demoRoute=` z adresu (jak Mapa). */
export function transportRoute(
  load: Pick<Load, 'code' | 'sailingId' | 'ferry'>,
  sailings: readonly Sailing[],
): string | null {
  return routeOfLoad(load, sailings, undefined, sessionDemoRoutes(import.meta.env.VITE_AUTH_MODE !== 'supabase' && !PROD_BUILD));
}

/** Kraj portu wyjścia trasy (PL / EE …); trasa spoza słownika — null. */
export function departureCountry(route: string | null | undefined): FerryCountry | null {
  return portByCode(routeEnds(route)?.from ?? null)?.country ?? null;
}

/** Kraj przypłynięcia trasy (SE / FI); trasa spoza słownika — null. */
export function arrivalCountry(route: string | null | undefined): FerryCountry | null {
  return portByCode(routeEnds(route)?.to ?? null)?.country ?? null;
}

/** Trasa bałtycka = wyjście z Estonii (Tallinn, Muuga, Paldiski). Polska – Szwecja i trasy nieznane — nie. */
export function isBalticRoute(route: string | null | undefined): boolean {
  return departureCountry(route) === 'EE';
}

/**
 * Armator, od którego startuje okno awizacji: armator przypiętego rejsu, potem pierwszy armator trasy transportu,
 * na końcu Polferries (jak dotąd). Rejs z danych startowych (demo) — armator jego trasy.
 */
export function initialAwizOperator(cur: Sailing | null | undefined, route: string | null | undefined): FerryOperator {
  if (cur) {
    const op = crossingLine(cur) ?? operatorsForRoute(cur.route)[0];
    if (op) return op;
  }
  return operatorsForRoute(route)[0] ?? 'POLFERRIES';
}
