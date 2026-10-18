/**
 * wyglad/P8-c — przykład demo strony Strefy (E34, img/e34-after): 10 stref według trasy, historia placu Boden
 * (08.09 utworzona 1 500 m, 22.09 15:52 i 15:55 przesunięcia), ostatnie pozycje T-11 przy placu (rozładunek 22.09).
 * Przegląd 18.10 (B5): daty przed zegarem demo 23.09.2026, 16:32, ostatnie zdarzenia stref z tych samych transportów co
 * Mapa i oś Status (D-01 wyjazd z placu 16:07, SG-32 bufor przed Gdańskiem 10:30, SG-28 wjazd na załadunek 07:42). Liczby jak w raporcie
 * (przesunięcia 1 449 m i 726 m; SG-03 9 m poza strefą po zmianie, ok. 740 m przed nią). Wywoływane wyłącznie
 * z `p8cSource.ts` za warunkiem trybu demo wpisanym wprost (strażnik I-0).
 */
import type { ZoneChange, ZoneRow } from './p8cZones';
import type { NearPos, ZoneDraft } from './p8cSource';

const base = { shape: 'circle' as const, notifyHhl: false, notifyKsh: false, notifyScx: false, active: true, trigger: 'ENTER' as const };
const Z = (z: Partial<ZoneRow> & Pick<ZoneRow, 'id' | 'name' | 'type' | 'lat' | 'lng' | 'radiusM'>): ZoneRow =>
  ({ ...base, hysteresisM: 200, samplesRequired: 2, dwellMin: 10, country: z.lat > 56 ? 'SE' : 'PL', route: null, last: null, ...z });

/* tworzone przy pierwszym użyciu (I-0) */
let store: { zones: ZoneRow[]; hist: Map<string, ZoneChange[]> } | null = null;
function st() {
  store ??= {
    zones: [
      Z({ id: 'z-srem-buf', name: 'Bufor 50 km przed Śremem', type: 'PRE_ARRIVAL', lat: 52.07391, lng: 17.0246, radiusM: 50_000, hysteresisM: 500, samplesRequired: 2, dwellMin: 0 }),
      Z({ id: 'z-srem', name: 'KSH Śrem · Grunwaldzka 27C', type: 'LOADING', lat: 52.07391, lng: 17.0246, radiusM: 600, hysteresisM: 150, dwellMin: 5, last: { code: 'SG-28', kind: 'ENTER', at: '2026-09-23T05:42:00Z' } }),
      Z({ id: 'z-gda-buf', name: 'Bufor 20 km przed Gdańskiem', type: 'PRE_PORT', lat: 54.3, lng: 18.55, radiusM: 20_000, hysteresisM: 500, samplesRequired: 2, dwellMin: 0, route: 'POLFERRIES', last: { code: 'SG-32', kind: 'ENTER', at: '2026-09-23T08:30:00Z' } }),
      Z({ id: 'z-gda', name: 'Terminal Polferries Gdańsk', type: 'PORT_OUT', lat: 54.40372, lng: 18.6813, radiusM: 600, dwellMin: 15, route: 'POLFERRIES' }),
      Z({ id: 'z-gdy-buf', name: 'Bufor 20 km przed Gdynią', type: 'PRE_PORT', lat: 54.45, lng: 18.4, radiusM: 20_000, hysteresisM: 500, dwellMin: 0, route: 'STENA' }),
      Z({ id: 'z-gdy', name: 'Terminal Stena Line Gdynia', type: 'PORT_OUT', lat: 54.5335, lng: 18.5155, radiusM: 800, dwellMin: 10, route: 'STENA' }),
      Z({ id: 'z-nyn', name: 'Terminal Nynäshamn', type: 'PORT_IN', lat: 58.903, lng: 17.948, radiusM: 800, dwellMin: 10, route: 'POLFERRIES' }),
      Z({ id: 'z-kaa', name: 'Terminal Stena Line Karlskrona', type: 'PORT_IN', lat: 56.1611, lng: 15.5869, radiusM: 800, dwellMin: 10, route: 'STENA' }),
      Z({ id: 'z-bod-buf', name: 'Bufor 50 km przed Boden', type: 'PRE_ARRIVAL', lat: 65.7, lng: 21.9, radiusM: 50_000, hysteresisM: 800, dwellMin: 0, last: { code: 'D-01', kind: 'ENTER', at: '2026-09-23T03:22:00Z' } }),
      Z({ id: 'z-bod', name: 'Plac budowy Stegra Boden', type: 'SITE', lat: 65.80539, lng: 21.75914, radiusM: 1_000, hysteresisM: 300, samplesRequired: 2, dwellMin: 10, last: { code: 'D-01', kind: 'EXIT', at: '2026-09-23T14:07:00Z' } }),
    ],
    hist: new Map([
      ['z-bod', [
        { at: '2026-09-22T13:55:00Z', who: 'Administrator HHL', before: { lat: 65.800041, lng: 21.750004, radiusM: 1_000 }, after: { lat: 65.80539, lng: 21.75914, radiusM: 1_000 }, notify: ['KSH', 'SCX', 'HHL'], reason: null },
        { at: '2026-09-22T13:52:00Z', who: 'Administrator HHL', before: { lat: 65.807551, lng: 21.72402, radiusM: 1_500 }, after: { lat: 65.800041, lng: 21.750004, radiusM: 1_000 }, reason: null },
        { at: '2026-09-08T10:00:00Z', who: 'Administrator HHL', before: null, after: { lat: 65.807551, lng: 21.72402, radiusM: 1_500 }, reason: null },
      ]],
      ['z-gda', [
        { at: '2026-09-19T07:27:00Z', who: 'Administrator HHL', before: { lat: 54.40372, lng: 18.6813, radiusM: 800 }, after: { lat: 54.40372, lng: 18.6813, radiusM: 600 }, reason: null },
      ]],
    ]),
  };
  return store;
}

const copyZ = (z: ZoneRow): ZoneRow => ({ ...z, last: z.last ? { ...z.last } : null });

export function demoZonesNow(): ZoneRow[] {
  return st().zones.map(copyZ);
}

export async function demoZones(): Promise<ZoneRow[]> {
  return demoZonesNow();
}

export async function demoZoneHistory(id: string): Promise<ZoneChange[]> {
  return [...(st().hist.get(id) ?? [])];
}

export async function demoZoneNear(id: string): Promise<NearPos[]> {
  if (id !== 'z-bod') return [];
  return [
    { code: 'T-11', lat: 65.812823, lng: 21.771843, at: '2026-09-22T04:15:00Z', label: 'postój' },
    { code: 'T-11', lat: 65.812543, lng: 21.771365, at: '2026-09-22T06:35:00Z', label: 'rozładunek' },
  ];
}

export async function demoZoneSave(id: string | null, z: ZoneDraft, reason: string): Promise<{ ok: boolean; zone?: ZoneRow }> {
  const s = st();
  const old = id ? s.zones.find((x) => x.id === id) : null;
  const zone: ZoneRow = { ...(old ?? { ...base, id: `z-new-${s.zones.length + 1}`, last: null }), ...z };
  if (old) s.zones = s.zones.map((x) => (x.id === id ? zone : x));
  else s.zones = [...s.zones, zone];
  const h = s.hist.get(zone.id) ?? [];
  s.hist.set(zone.id, [{
    at: new Date().toISOString(), who: 'Anna Wiśniewska',
    before: old ? { lat: old.lat, lng: old.lng, radiusM: old.radiusM } : null,
    after: { lat: zone.lat, lng: zone.lng, radiusM: zone.radiusM }, reason,
  }, ...h]);
  return { ok: true, zone: copyZ(zone) };
}

export async function demoZoneSetActive(id: string, active: boolean, reason: string): Promise<{ ok: boolean }> {
  const s = st();
  const z = s.zones.find((x) => x.id === id);
  if (!z) return { ok: false };
  z.active = active;
  const h = s.hist.get(id) ?? [];
  s.hist.set(id, [{ at: new Date().toISOString(), who: 'Anna Wiśniewska', before: null, after: { lat: z.lat, lng: z.lng, radiusM: z.radiusM }, reason, active }, ...h]);
  return { ok: true };
}
