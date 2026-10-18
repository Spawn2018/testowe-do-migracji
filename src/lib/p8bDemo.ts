/**
 * wyglad/P8-b — przykład demo ekranu „SMS przy miejscach” (E42, img/e42-after): w Śremie 1 osoba z 2, w Boden 0 z 2,
 * wysyłka w trybie testowym. Osoby i numery zmyślone (G-09, pula +48 000 000 0xx). Wywoływane wyłącznie z `p8bSource.ts`
 * za warunkiem trybu demo wpisanym wprost (strażnik I-0).
 */
import type { PlaceId, SmsPlacesState, ZonePerson, ZoneUser } from './p8bPlaces';

/* tworzone przy pierwszym użyciu (I-0) */
let store: SmsPlacesState | null = null;
function st(): SmsPlacesState {
  store ??= {
    sending: false,
    testTo: '+48 000 000 010',
    places: [
      { id: 'LOAD_SREM', people: [{ userId: 'demo-hhl-1', name: 'Anna Wiśniewska', country: 'PL', phone: '000000010', kinds: ['A', 'C', 'D'] }, null] },
      { id: 'UNLOAD_BODEN', people: [null, null] },
    ],
    gateway: { active: true, lastSignal: '2026-09-22T15:57:00Z', today: 0, limit: 150 },
  };
  return store;
}

const copy = (s: SmsPlacesState): SmsPlacesState => ({
  ...s,
  places: s.places.map((p) => ({ ...p, people: [...p.people] })) as SmsPlacesState['places'],
});

export function demoPlacesNow(): SmsPlacesState {
  return copy(st());
}

export async function demoPlacesState(): Promise<SmsPlacesState> {
  return copy(st());
}

export async function demoZoneUsers(): Promise<ZoneUser[]> {
  return [
    { id: 'demo-hhl-1', name: 'Anna Wiśniewska', phone: '+48 000 000 010' },
    { id: 'demo-hhl-2', name: 'Marek Lis', phone: '+48 000 000 003' },
    { id: 'demo-ksh-1', name: 'Piotr Zając', phone: null },
    { id: 'demo-scx-1', name: 'Jan Nowak', phone: '+48 000 000 001' },
  ];
}

export async function demoSavePerson(place: PlaceId, slot: 1 | 2, person: ZonePerson | null): Promise<{ ok: boolean }> {
  const p = st().places.find((x) => x.id === place);
  if (!p) return { ok: false };
  p.people[slot - 1] = person ? { ...person, kinds: [...person.kinds] } : null;
  return { ok: true };
}

export async function demoSetSending(on: boolean): Promise<{ ok: boolean }> {
  st().sending = on;
  return { ok: true };
}
