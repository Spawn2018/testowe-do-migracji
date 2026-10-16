/**
 * wyglad/P6-c — zakładka „Status” według E17 (img/e17-after): kanał GPS / AIS przy statusie z automatu,
 * plan z różnicą przy Załadunku i „Na placu”, kamienie milowe ze stref pod statusem.
 * Dane jak SG-03 na produkcji (`load_events`; zmyślone numery — G-17).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildStatusAxis, hitChannel, statusHits } from '../src/lib/statusAxis';
import { axisMilestones, planNote } from '../src/lib/p6cAxis';
import type { Load, LoadEvent } from '../src/types';

const ev = (type: string, at: string, payload: Record<string, unknown> = {}, actor = 'system'): LoadEvent =>
  ({ id: `${type}-${at}-${String(payload.to ?? payload.geofence_id ?? '')}`, loadId: 'L1', type, at, actor, payload });

const SITE = 'gf-site';
const BUF = 'gf-buf50';
const geofences = [{ id: SITE, name: 'Plac budowy Stegra Boden' }, { id: BUF, name: 'Bufor 50 km przed Boden' }];
const events: LoadEvent[] = [
  ev('SCHEDULE_IMPORTED', '2026-10-01T19:43:00Z', { code: 'SG-03' }),
  ev('STATUS_READY', '2026-10-05T11:10:00Z', {}, 'HHL'),
  ev('STATUS_AUTO', '2026-10-05T11:21:00Z', { from: 'READY', to: 'IN_TRANSIT_SE', zrodlo: 'TELM_PHASE_INFER', tracker_on: 'NACZEPA', lat: 62.5, lon: 17.6 }),
  /* faza z pierwszej pozycji dopisała strefę — nie pokazujemy */
  ev('GEOFENCE_ENTER', '2026-10-05T11:21:30Z', { geofence_id: BUF, synthetic: true }),
  ev('GEOFENCE_ENTER', '2026-10-06T09:22:00Z', { geofence_id: BUF }),
  /* to zdarzenie samo zmieniło status — nie jest kamieniem milowym */
  ev('GEOFENCE_ENTER', '2026-10-07T06:35:00Z', { geofence_id: SITE }),
  ev('STATUS_AUTO', '2026-10-07T06:35:00Z', { from: 'IN_TRANSIT_SE', to: 'AT_SITE', geofence_id: SITE }),
  /* prod 07.10: postój na placu potwierdzony 06:49 UTC (08:49 w Polsce), nazwa strefy w payload */
  ev('GEOFENCE_DWELL', '2026-10-07T06:49:53Z', { geofence_id: 'gf-inna', geofence_name: 'Plac budowy Stegra Boden' }),
  ev('GEOFENCE_EXIT', '2026-10-07T10:19:00Z', { geofence_id: SITE }),
  /* strefa bez nazwy — pomijana */
  ev('GEOFENCE_ENTER', '2026-10-07T07:00:00Z', { geofence_id: 'gf-nieznana' }),
];
const load = (status: string): Pick<Load, 'status' | 'stage' | 'unloadedAt'> =>
  ({ status, stage: 'SITE', unloadedAt: null }) as unknown as Pick<Load, 'status' | 'stage' | 'unloadedAt'>;

afterEach(() => { vi.unstubAllEnvs(); });

describe('E17 — kanał przy statusie z automatu', () => {
  it('payload: AIS → AIS; GPS / emtrack / RIO / strefa / pozycja → GPS', () => {
    expect(hitChannel('STATUS_AUTO', { source: 'AIS' }, 'ON_FERRY')).toBe('AIS');
    expect(hitChannel('STATUS_AUTO', { zrodlo: 'TELM_PHASE_INFER' }, 'IN_TRANSIT_SE')).toBe('GPS');
    expect(hitChannel('STATUS_AUTO', { source: 'rio' }, 'IN_TRANSIT_PL')).toBe('GPS');
    expect(hitChannel('STATUS_AUTO', { geofence_id: SITE }, 'APPROACHING_SITE')).toBe('GPS');
    expect(hitChannel('STATUS_AUTO', { lat: 54.4 }, 'AT_PORT')).toBe('GPS');
  });

  it('całe słowa: PRIORITY ≠ RIO, RAISE ≠ AIS; pozycja promu (Digitraffic, Stena) → AIS mimo współrzędnych', () => {
    expect(hitChannel('STATUS_AUTO', { source: 'PRIORITY' }, 'IN_TRANSIT_PL')).toBeNull();
    expect(hitChannel('STATUS_AUTO', { powod: 'x', source: 'RAISE' }, 'IN_TRANSIT_PL')).toBeNull();
    expect(hitChannel('STATUS_AUTO', { source: 'DIGITRAFFIC', lat: 59.1 }, 'ON_FERRY')).toBe('AIS');
    expect(hitChannel('STATUS_AUTO', { source: 'STENA', lat: 57.6 }, 'ON_FERRY')).toBe('AIS');
    expect(hitChannel('STATUS_AUTO', { source: 'EMTRACK_WEB' }, 'IN_TRANSIT_SE')).toBe('GPS');
    expect(hitChannel('STATUS_AUTO', { source: 'GPS', provider: 'emtrack' }, 'IN_TRANSIT_SE')).toBe('GPS');
  });

  it('bez źródła w payload: przykład (demo) zgaduje z rodzaju zdarzenia', () => {
    expect(hitChannel('ON_FERRY', {}, 'ON_FERRY')).toBe('AIS');
    expect(hitChannel('LOADED', {}, 'LOADING')).toBe('GPS');
    expect(hitChannel('STATUS_AUTO', {}, 'IN_TRANSIT_PL')).toBeNull();
  });

  it('produkcja: bez źródła nic nie zgaduje (znacznik „AUTO”)', () => {
    vi.stubEnv('VITE_AUTH_MODE', 'supabase');
    expect(hitChannel('ON_FERRY', {}, 'ON_FERRY')).toBeNull();
    expect(hitChannel('LOADED', {}, 'LOADING')).toBeNull();
    expect(hitChannel('STATUS_AUTO', { source: 'AIS' }, 'ON_FERRY')).toBe('AIS');
  });

  it('statusHits: kanał tylko przy automacie; import i ręcznie bez kanału', () => {
    const hits = statusHits(events);
    const byStatus = new Map(hits.map((h) => [h.status, h]));
    expect(byStatus.get('PLANNED')?.channel).toBeNull();
    expect(byStatus.get('READY')?.channel).toBeNull();
    expect(byStatus.get('IN_TRANSIT_SE')?.channel).toBe('GPS');
    expect(byStatus.get('APPROACHING_SITE')?.channel).toBe('GPS');
  });
});

describe('E17 — plan przy Załadunku i „Na placu”', () => {
  const l = { plannedLoadDate: '2026-10-01', plannedDeliverDate: '2026-10-07' } as Pick<Load, 'plannedLoadDate' | 'plannedDeliverDate'>;
  it('na placu w dniu planu → w terminie (0); dzień później → +1; jeszcze nie → bez różnicy', () => {
    expect(planNote('APPROACHING_SITE', '2026-10-07T06:35:00Z', l)).toEqual({ plan: '2026-10-07', kind: 'deliver', diff: 0 });
    expect(planNote('APPROACHING_SITE', '2026-10-08T06:35:00Z', l)?.diff).toBe(1);
    expect(planNote('APPROACHING_SITE', null, l)).toEqual({ plan: '2026-10-07', kind: 'deliver', diff: null });
  });
  it('załadunek — dzień załadunku; pozostałe statusy bez planu; zły format daty → brak', () => {
    expect(planNote('LOADING', '2026-09-30T06:30:00Z', l)).toEqual({ plan: '2026-10-01', kind: 'load', diff: -1 });
    expect(planNote('ON_FERRY', '2026-10-02T10:00:00Z', l)).toBeNull();
    expect(planNote('LOADING', null, { plannedLoadDate: '', plannedDeliverDate: '' } as never)).toBeNull();
  });
  it('zła data zdarzenia nie psuje zakładki — plan bez różnicy', () => {
    expect(planNote('LOADING', 'nie-data', l)).toEqual({ plan: '2026-10-01', kind: 'load', diff: null });
  });
  it('dzień liczony w czasie polskim (23:30 UTC = następny dzień w Polsce)', () => {
    expect(planNote('APPROACHING_SITE', '2026-10-06T23:30:00Z', l)?.diff).toBe(0);
  });
});

describe('E17 — kamienie milowe pod statusem', () => {
  it('SG-03: „Bufor 50 km” pod „Droga SE”, wyjazd z placu pod „Na placu”; bez syntetycznych, zmian statusu i stref bez nazwy', () => {
    const axis = buildStatusAxis(load('APPROACHING_SITE'), events);
    const ms = axisMilestones(axis, events, geofences);
    expect(ms.get('IN_TRANSIT_SE')).toEqual([{ at: '2026-10-06T09:22:00Z', kind: 'enter', zone: 'Bufor 50 km przed Boden' }]);
    expect(ms.get('APPROACHING_SITE')).toEqual([
      { at: '2026-10-07T06:49:53Z', kind: 'dwell', zone: 'Plac budowy Stegra Boden' },
      { at: '2026-10-07T10:19:00Z', kind: 'exit', zone: 'Plac budowy Stegra Boden' },
    ]);
    expect([...ms.values()].flat().some((m) => m.at === '2026-10-05T11:21:30Z')).toBe(false);
  });

  it('ręczna zmiana statusu w tej samej minucie nie chowa postoju ze strefy', () => {
    const withManual = [
      ...events,
      ev('STATUS_DELIVERED', '2026-10-07T10:19:30Z', { to: 'DELIVERED', from: 'AT_SITE', manual: true, actor: 'HHL' }, 'HHL'),
    ];
    const ms = axisMilestones(buildStatusAxis(load('DELIVERED'), withManual), withManual, geofences);
    expect([...ms.values()].flat().some((m) => m.kind === 'exit' && m.at === '2026-10-07T10:19:00Z')).toBe(true);
  });

  it('najwyżej 3 ostatnie pod jednym statusem; zdarzenie przed pierwszym statusem pominięte', () => {
    const many = [
      ...events,
      ev('GEOFENCE_EXIT', '2026-10-06T10:00:00Z', { geofence_id: BUF }),
      ev('GEOFENCE_ENTER', '2026-10-06T11:00:00Z', { geofence_id: BUF }),
      ev('GEOFENCE_EXIT', '2026-10-06T12:00:00Z', { geofence_id: BUF }),
      ev('GEOFENCE_ENTER', '2026-09-01T12:00:00Z', { geofence_id: BUF }),
    ];
    const ms = axisMilestones(buildStatusAxis(load('APPROACHING_SITE'), many), many, geofences);
    expect(ms.get('IN_TRANSIT_SE')?.map((m) => m.at)).toEqual(['2026-10-06T10:00:00Z', '2026-10-06T11:00:00Z', '2026-10-06T12:00:00Z']);
    expect(ms.get('APPROACHING_SITE')?.length).toBe(2);
    expect([...ms.values()].flat().some((m) => m.at.startsWith('2026-09-01'))).toBe(false);
  });
});
