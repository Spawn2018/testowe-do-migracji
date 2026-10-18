/**
 * wyglad/W-audyt (D-20261017-0730-01 §4; audyt 17.10): teksty o automatach mówią prawdę.
 * Pomoc „Jak pracuję”, „Działa samo” i dopisek pod mapą opisują automat jako działający dopiero wtedy,
 * gdy działa na serwerze. W demo — zawsze tak (demo pokazuje docelową aplikację). Na produkcji wykonawca
 * przestawia na `true` tylko klucz pozycji, którą właśnie wdrożył (jak `otherDocsOn()` w `p5Source.ts`):
 * - `TRACKING_WINDOW` — okno śledzenia od 03:00 w dniu załadunku do „Dostarczone” na serwerze (A1);
 * - `SITE_EXIT_DELIVERED` — wyjazd z placu po ≥ 10 min → „Dostarczone”, krócej sprawa „czy dostarczono?” (A2);
 * - `WIND_E49` — wiatr i śliskość w ETA (P6 E49 Z1);
 * - `DETOUR_E49` — sprawa SCX „Objazd czy postój?” (P6 E49 Z3);
 * - `ROAD_PL_HERE` — utrudnienia drogowe PL z HERE co 15 min (P6 E2, cron `tower-road-pl`);
 * - `ROAD_SITUATIONS_MAP` — warstwa „Utrudnienia drogowe” na mapie z danych produkcji (P9 E29 pkt 3);
 * - `INVOICE_A4` — faktura co do grosza i „pominięty” tylko z CMR w `register_invoice` (A4; wyglad/W-naprawy).
 */
export type ServerRule = 'TRACKING_WINDOW' | 'SITE_EXIT_DELIVERED' | 'WIND_E49' | 'DETOUR_E49' | 'ROAD_PL_HERE' | 'ROAD_SITUATIONS_MAP' | 'INVOICE_A4';

/** Stan na produkcji. Zmienia tylko wykonawca, przy wdrożeniu pozycji z nawiasu. */
const ON_IN_PRODUCTION: Record<ServerRule, boolean> = {
  TRACKING_WINDOW: true /* A1 */,
  SITE_EXIT_DELIVERED: true /* A2 */,
  WIND_E49: false /* P6 E49 Z1 */,
  DETOUR_E49: false /* P6 E49 Z3 */,
  ROAD_PL_HERE: false /* P6 E2 */,
  ROAD_SITUATIONS_MAP: false /* P9 E29 pkt 3 */,
  INVOICE_A4: false /* A4 register_invoice */,
};

export function serverRuleOn(rule: ServerRule): boolean {
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return true;
  return ON_IN_PRODUCTION[rule];
}

/** Dopisek przy automacie, który jeszcze nie działa na serwerze. */
export const SOON = 'włączamy wkrótce';
