/**
 * M9 — aplikacja kierowcy: pozycja ciągła (watchPosition) za zgodą, zdarzenia etapów
 * (STATUSY_AUTOMATYCZNE §6). Czyste funkcje + cienka warstwa nad navigator.geolocation.
 *
 * Zgoda: pytamy przy pierwszym uruchomieniu na urządzeniu, w języku kierowcy; bez zgody
 * działają wyłącznie przyciski etapów (żadnej pozycji w tle).
 */
import type { Locale, LoadStatus } from '../types';

export const DRIVER_CONSENT_KEY = 'wt-driver-geo-consent';
export type DriverConsent = 'granted' | 'denied' | null;

export function readDriverConsent(storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): DriverConsent {
  const v = storage?.getItem(DRIVER_CONSENT_KEY);
  return v === 'granted' || v === 'denied' ? v : null;
}
export function writeDriverConsent(v: 'granted' | 'denied', storage: Pick<Storage, 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): void {
  storage?.setItem(DRIVER_CONSENT_KEY, v);
}

/** Język kierowcy z przeglądarki telefonu (sv / en, domyślnie pl). */
export function driverLocaleFrom(lang: string | undefined | null): Locale {
  const l = (lang ?? '').toLowerCase();
  if (l.startsWith('sv')) return 'sv';
  if (l.startsWith('en')) return 'en';
  return 'pl';
}

export interface DriverFix { lat: number; lng: number; at: string; accuracy: number | null; speedKmh: number | null; heading: number | null }

export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371008.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * ANEKS 4 PR5 — budżet bazy 500 MB: pozycja co 2 min w ruchu, co 15 min na postoju (prędkość < 5 km/h).
 * Silnik stref potrzebuje dwóch kolejnych punktów — przy 2 min wjazd w strefę wykrywany w kilka minut.
 * Prędkość z GPS; bez niej — z przesunięcia względem poprzedniego wysłanego punktu.
 */
export const SEND_MOVING_MS = 120_000;
export const SEND_STOPPED_MS = 900_000;
export const STOPPED_BELOW_KMH = 5;
/** Fix słabszy niż 250 m nie otwiera ani nie zamyka stref (baza odrzuca go tak samo — report_position). */
export const MAX_ACCURACY_M = 250;

export function fixSpeedKmh(prev: DriverFix | null, next: DriverFix): number | null {
  if (next.speedKmh != null) return next.speedKmh;
  if (!prev) return null;
  const dt = (Date.parse(next.at) - Date.parse(prev.at)) / 1000;
  return dt > 0 ? (distanceM(prev, next) / dt) * 3.6 : null;
}

export function shouldSendFix(prev: DriverFix | null, next: DriverFix): boolean {
  if (next.accuracy != null && next.accuracy > MAX_ACCURACY_M) return false;
  if (!prev) return true;
  const dt = Date.parse(next.at) - Date.parse(prev.at);
  if (!(dt > 0)) return false;
  const v = fixSpeedKmh(prev, next);
  const moving = v != null && v >= STOPPED_BELOW_KMH;
  return dt >= (moving ? SEND_MOVING_MS : SEND_STOPPED_MS);
}

export function fixFromPosition(p: GeolocationPosition, at: string): DriverFix {
  const c = p.coords;
  return {
    lat: c.latitude, lng: c.longitude, at,
    accuracy: Number.isFinite(c.accuracy) ? Math.round(c.accuracy) : null,
    speedKmh: c.speed != null && Number.isFinite(c.speed) ? Math.round(c.speed * 3.6) : null,
    heading: c.heading != null && Number.isFinite(c.heading) ? Math.round(c.heading) : null,
  };
}

export type DriverMilestone = 'LOADED' | 'ON_FERRY' | 'UNLOADED' | 'PROBLEM';

/**
 * STATUSY_AUTOMATYCZNE §6 — co wysyła przycisk:
 * „Załadowany” → zdarzenie MILESTONE_LOADED (warunek wyjazdu ze strefy załadunku), bez zmiany statusu;
 * „Rozładowany” → status UNLOADED razem z datą rozładunku (jedna zmiana);
 * „Na promie” → zdarzenie informacyjne (PROM ustawia wyłącznie zadanie systemowe rejsu);
 * „Problem” → flaga opóźnienia + zdarzenie.
 */
export function milestoneAction(m: DriverMilestone): { event: string | null; status: LoadStatus | null } {
  switch (m) {
    case 'LOADED': return { event: 'MILESTONE_LOADED', status: null };
    case 'UNLOADED': return { event: null, status: 'UNLOADING' };
    case 'ON_FERRY': return { event: 'DRIVER_ON_FERRY', status: null };
    case 'PROBLEM': return { event: null, status: 'DELAYED' };
  }
}

/** Ciągła pozycja; zwraca funkcję zatrzymującą. Brak API → onError(0). */
export function watchDriverPosition(
  onFix: (p: GeolocationPosition) => void,
  onError: (code: number, message: string) => void,
  geo: Geolocation | undefined = typeof navigator === 'undefined' ? undefined : navigator.geolocation,
): () => void {
  if (!geo) {
    onError(0, 'navigator.geolocation niedostępne');
    return () => undefined;
  }
  const id = geo.watchPosition(onFix, (e) => onError(e.code, e.message), {
    enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000,
  });
  return () => geo.clearWatch(id);
}
