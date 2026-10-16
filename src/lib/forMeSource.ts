/**
 * wyglad/audyt-E (E-05, W47 — właściciel 16.10, 13:58 i 14:09; D-20261016-1410-01 pkt 7) — jedno miejsce,
 * skąd „Dla mnie › Co dostaję” bierze i dokąd zapisuje ustawienia osoby: zdarzenie × kanał (dzwonek, telefon, e-mail).
 * Wartości startowe i to, które zdarzenia trafiają do rodzaju konta, daje „Kto co dostaje” (Administrator HHL);
 * ustawienie osoby obowiązuje tylko dla niej.
 *
 * Demo — magazyn strony (`forMeDemo.ts`). Produkcja — `null` = nie podłączone (ekran bez przełączników).
 * Gałąź produkcyjną podmienia wykonawca (C3): odczyt i zapis osoba × zdarzenie × kanał w bazie z „było → jest”
 * (C4), RLS — osoba zmienia tylko swoje; Podgląd HHL — `save: null` (tylko odczyt). Warunek
 * `import.meta.env.VITE_AUTH_MODE` wpisany wprost (strażnik I-0). Bez zapytań.
 */
import { useEffect, useState } from 'react';
import { demoMyNotify, demoSaveMyNotify } from './forMeDemo';

export type MyChannel = 'bell' | 'push' | 'mail';
/** rowId zdarzenia z „Kto co dostaje” → kanały, które osoba zmieniła (brak kanału = wartość startowa rodzaju konta). */
export type MyNotifyPrefs = Record<string, Partial<Record<MyChannel, boolean>>>;

export interface MyNotifySource {
  /** ustawienia osoby zapisane do tej pory */
  prefs: MyNotifyPrefs;
  /** zapis jednego kanału jednego zdarzenia; `true` = zapisane. `null` = tylko podgląd. */
  save: ((rowId: string, ch: MyChannel, on: boolean) => Promise<boolean>) | null;
}

/** `person` — kto ogląda (demo: rodzaj konta w Podglądzie; produkcja: id konta). */
export function myNotifyOf(person: string): MyNotifySource | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase'
    ? { prefs: demoMyNotify(person), save: (rowId, ch, on) => demoSaveMyNotify(person, rowId, ch, on) }
    : null;
}

const bellOff = new Set<string>();

/** Kanały wyłączone przez osobę (dzwonek) — filtr listy po odczycie z bazy. */
export function rememberMyBell(prefs: MyNotifyPrefs): void {
  bellOff.clear();
  for (const [key, ch] of Object.entries(prefs)) {
    if (ch.bell === false) bellOff.add(key);
  }
}

const BELL_KEY: Record<string, string> = {
  ZONE_ENTER: 'zone', ZONE_EXIT: 'zone', GEOFENCE_ENTER: 'zone', GEOFENCE_EXIT: 'zone',
  LOAD_CHAT_MESSAGE: 'chat', LOAD_STATUS_CHANGED: 'status', STATUS_CHANGE: 'status',
  DOC_MISSING: 'cmr', CMR_MISSING: 'cmr',
};

export function bellOffForPerson(template?: string): boolean {
  if (!template) return false;
  return bellOff.has(BELL_KEY[template] ?? template);
}

/**
 * Produkcja: odczyt i zapis osoba × zdarzenie × kanał (`my_notify_get` / `my_notify_set`).
 * Zwraca `null`, dopóki baza nie odpowie — ekran pokazuje wtedy „Brak źródła danych.”
 */
export function useLiveNotify(person: string): MyNotifySource | null {
  const [src, setSrc] = useState<MyNotifySource | null>(null);
  useEffect(() => {
    if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return undefined;
    let stop = false;
    void (async () => {
      try {
        const { getSupabase } = await import('../auth/client');
        const sb = await getSupabase();
        const q = await sb.rpc('my_notify_get');
        if (stop || q.error || !Array.isArray(q.data)) return;
        const prefs: MyNotifyPrefs = {};
        for (const row of q.data as { event_key: string; channel: MyChannel; on_value: boolean }[]) {
          prefs[row.event_key] = { ...prefs[row.event_key], [row.channel]: row.on_value };
        }
        rememberMyBell(prefs);
        const save = async (rowId: string, ch: MyChannel, on: boolean) => {
          const r = await sb.rpc('my_notify_set', { p_event_key: rowId, p_channel: ch, p_on: on });
          if (r.error) return false;
          rememberMyBell({ ...prefs, [rowId]: { ...prefs[rowId], [ch]: on } });
          prefs[rowId] = { ...prefs[rowId], [ch]: on };
          return true;
        };
        if (!stop) setSrc({ prefs, save });
      } catch {
        /* brak sesji */
      }
    })();
    return () => { stop = true; };
  }, [person]);
  return import.meta.env.VITE_AUTH_MODE === 'supabase' ? src : null;
}
