/**
 * wyglad/P4-b (E44) — rozpoznanie dostawcy z pola „Link śledzenia”, tylko do opisu w panelu i w awizacji.
 * Samego linku nie pokazujemy: link RIO zawiera klucz (`secret`), który według E44 pkt 8 nie może trafiać do przeglądarki
 * ani do widoku („RIO · ••••”). Zapis, zapytanie testowe i przechowywanie klucza po stronie serwera — wykonawca (E44 pkt 1).
 */
import type { Load, TrackingLinkInfo } from '../types';
import { PROD_BUILD } from './prodFacade';

export type TrackerKind = 'emtrack' | 'rio' | 'safefleet' | 'other' | 'none';

/** #662: pełny link tymczasowy SafeFleet (32 hex). */
const SAFEFLEET_LINK_RE =
  /^https:\/\/portal\.safefleet\.pl\/safefleet\/temporary_link\/view\/[0-9a-f]{32}\/?$/i;

export function isSafefleetTrackingRef(ref: string | null | undefined): boolean {
  const r = (ref ?? '').trim();
  return SAFEFLEET_LINK_RE.test(r) || /^safefleet:[0-9a-f]{6}$/i.test(r);
}

/** Wygląda na SafeFleet, ale wzór niepasujący — komunikat walidacji w awizacji. */
export function isBrokenSafefleetTrackingRef(ref: string | null | undefined): boolean {
  const r = (ref ?? '').trim().toLowerCase();
  if (!r || isSafefleetTrackingRef(r)) return false;
  return r.includes('safefleet.pl') || r.includes('temporary_link');
}

export function trackerKind(ref: string | null | undefined): TrackerKind {
  const r = (ref ?? '').trim().toLowerCase();
  if (!r) return 'none';
  if (r.includes('position-sharing.rio.cloud') || r.startsWith('rio:')) return 'rio';
  if (isSafefleetTrackingRef(r) || r.includes('safefleet.pl')) return 'safefleet';
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
