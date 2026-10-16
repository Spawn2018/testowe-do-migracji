/**
 * wyglad/P8-b — skąd ekran „SMS przy miejscach” (E42) bierze odbiorców i stan wysyłki oraz jak je zapisuje.
 * Produkcja: `null` = nie podłączone — ekran Opcji zostaje przy dzisiejszych formularzach (odbiorcy, bramka) do Twojego
 * podłączenia w P8 (dopisek do PR wyglad/P8-b). Demo: zapis w pamięci strony.
 * Warunek `import.meta.env.VITE_AUTH_MODE` wpisany wprost (strażnik I-0). Bez zapytań.
 */
import { demoPlacesNow, demoPlacesState, demoSavePerson, demoSetSending, demoZoneUsers } from './p8bDemo';
import type { PlaceId, SmsPlacesState, ZonePerson, ZoneUser } from './p8bPlaces';

export interface SmsPlacesSource {
  state: () => Promise<SmsPlacesState>;
  /** stan dostępny od razu (demo); produkcja — brak, ekran czeka na `state()` */
  initial?: SmsPlacesState;
  /** konta z telefonem (E6) do wyboru „Wybierz z użytkowników” */
  users: () => Promise<ZoneUser[]>;
  /** zapis osoby w miejscu i pozycji (1 albo 2); null — usuń osobę. Tylko Administrator HHL; wpis w Historii zmian. */
  savePerson: ((place: PlaceId, slot: 1 | 2, person: ZonePerson | null) => Promise<{ ok: boolean; error?: string }>) | null;
  /**
   * „Wysyłka do odbiorców” (E42 „Włączenie”) — przełącza tylko właściciel (AGENTS §6, lista STOP); null — przełącznika nie ma
   * (inne konta, Operacje HHL). Baza i tak odmawia innym kontom.
   */
  setSending: ((on: boolean) => Promise<{ ok: boolean }>) | null;
}

export function smsPlacesOf(): SmsPlacesSource | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase'
    ? { state: demoPlacesState, initial: demoPlacesNow(), users: demoZoneUsers, savePerson: demoSavePerson, setSending: demoSetSending }
    : null;
}

/** Czy ekran E42 ma źródło (demo: tak; produkcja: po podłączeniu w P8 — do tego czasu Opcje pokazują dzisiejsze formularze). */
export function smsPlacesReady(): boolean {
  return smsPlacesOf() !== null;
}
