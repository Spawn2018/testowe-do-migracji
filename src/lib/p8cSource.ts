/**
 * wyglad/P8-c — skąd strona Strefy (E34) bierze strefy, historię zmian i ostatnie pozycje przy strefie oraz jak zapisuje
 * zmianę z powodem. Produkcja: `null` = nie podłączone — menu Strefy zostaje przy dzisiejszej tabeli do Twojego
 * podłączenia w P8 (dopisek do PR wyglad/P8-c). Demo: zapis w pamięci strony.
 * Warunek `import.meta.env.VITE_AUTH_MODE` wpisany wprost (strażnik I-0). Bez zapytań.
 */
import { demoZoneHistory, demoZoneNear, demoZoneSave, demoZoneSetActive, demoZones, demoZonesNow } from './p8cDemo';
import type { GeofenceType } from '../types';
import type { ZoneChange, ZoneRoute, ZoneRow } from './p8cZones';

/** Ostatnia pozycja transportu przy strefie (mapa karty i podgląd wpływu): „SG-03 · postój 06.10 12:35”. */
export interface NearPos { code: string; lat: number; lng: number; at: string; label: string }

export interface ZoneDraft {
  name: string;
  type: GeofenceType;
  country: 'PL' | 'SE';
  route: ZoneRoute | null;
  lat: number;
  lng: number;
  radiusM: number;
  hysteresisM: number;
  samplesRequired: number;
  dwellMin: number;
}

export interface ZonesSource {
  zones: () => Promise<ZoneRow[]>;
  /** strefy od razu (demo); produkcja — brak, strona czeka na `zones()` */
  initial?: ZoneRow[];
  /** historia zmian strefy (najnowsze pierwsze): kto, kiedy, kształt przed i po, powód */
  history: (id: string) => Promise<ZoneChange[]>;
  /** ostatnie pozycje transportów w oknie śledzenia przy strefie (do 5 km od granicy) */
  near: (id: string) => Promise<NearPos[]>;
  /** zapis strefy (id null — nowa) z powodem; tylko Administrator HHL; wpis w Historii zmian; po zapisie sprawdzenie
   *  ostatnich pozycji z dopiskiem „zmiana strefy”, bez SMS (E34 pytanie 1 B) */
  saveZone: ((id: string | null, z: ZoneDraft, reason: string) => Promise<{ ok: boolean; zone?: ZoneRow; error?: string }>) | null;
  /** wyłączenie / włączenie strefy (strefy ze zdarzeniami się nie usuwa) z powodem */
  setActive: ((id: string, active: boolean, reason: string) => Promise<{ ok: boolean }>) | null;
}

export function zonesOf(): ZonesSource | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase'
    ? { zones: demoZones, initial: demoZonesNow(), history: demoZoneHistory, near: demoZoneNear, saveZone: demoZoneSave, setActive: demoZoneSetActive }
    : null;
}

