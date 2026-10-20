/**
 * wyglad/P4-b (E44) — rozpoznanie dostawcy z pola „Link śledzenia”, tylko do opisu w panelu i w awizacji.
 * Samego linku nie pokazujemy: link RIO zawiera klucz (`secret`), który według E44 pkt 8 nie może trafiać do przeglądarki
 * ani do widoku („RIO · ••••”). Zapis, zapytanie testowe i przechowywanie klucza po stronie serwera — wykonawca (E44 pkt 1).
 */
import type { Load, TrackingLinkInfo } from '../types';
import { PROD_BUILD } from './prodFacade';

export type TrackerKind = 'emtrack' | 'rio' | 'other' | 'none';

export function trackerKind(ref: string | null | undefined): TrackerKind {
  const r = (ref ?? '').trim().toLowerCase();
  if (!r) return 'none';
  if (r.includes('position-sharing.rio.cloud') || r.startsWith('rio:')) return 'rio';
  if (r.includes('emtrack')) return 'emtrack';
  return 'other';
}

/**
 * Decyzja właściciela 20.10.2026, 20:01: śledzenie i lokalizacja tylko przy podanym linku śledzenia.
 * `true` = produkcja i transport bez linku (ani w transporcie, ani link RIO z serwera) — ekran nie mówi „Śledzenie trwa”.
 * W demo transporty nie mają linków — tam zostaje dotychczasowy opis.
 */
export function trackingNoLink(load: Pick<Load, 'resources'>, link: TrackingLinkInfo | null | undefined, prod: boolean = PROD_BUILD): boolean {
  return prod && !link && trackerKind(load.resources?.trackingRef) === 'none';
}
