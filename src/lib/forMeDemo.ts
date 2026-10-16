/**
 * wyglad/audyt-E (E-05, W47 — właściciel 16.10, 13:58 i 14:09; D-20261016-1410-01 pkt 7) — TYLKO tryb demo:
 * ustawienia osoby w „Dla mnie › Co dostaję” (zdarzenie × kanał) w magazynie strony (zustand, bez zapisu
 * w przeglądarce — E11: w przeglądarce zostaje tylko motyw i waluta). Osoba demo = rodzaj konta w Podglądzie.
 * Na produkcji zapis do bazy podłącza wykonawca (`forMeSource.ts`).
 */
import { create } from 'zustand';
import type { MyChannel, MyNotifyPrefs } from './forMeSource';

type DemoState = { byPerson: Record<string, MyNotifyPrefs> };

const useDemoForMe = create<DemoState>(() => ({ byPerson: {} }));

export function demoMyNotify(person: string): MyNotifyPrefs {
  return useDemoForMe.getState().byPerson[person] ?? {};
}

export async function demoSaveMyNotify(person: string, rowId: string, ch: MyChannel, on: boolean): Promise<boolean> {
  useDemoForMe.setState((s) => {
    const mine = s.byPerson[person] ?? {};
    return { byPerson: { ...s.byPerson, [person]: { ...mine, [rowId]: { ...mine[rowId], [ch]: on } } } };
  });
  return true;
}
