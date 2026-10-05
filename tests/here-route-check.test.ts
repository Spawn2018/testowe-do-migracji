import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  buildRoutingUrl,
  budgetAllows,
  budgetLevel,
  classifySection,
  completeDims,
  decodeFlexiblePolyline,
  legsForRoute,
  needsRecheck,
  ownSummary,
  runRouteCheck,
  stripHereRaw,
  type CompleteDims,
  type RouteCheckDb,
  type SaveRow,
} from '../supabase/functions/_shared/here/routeCheck';

const DIMS: CompleteDims = {
  heightM: 4.5, widthM: 3.4, lengthM: 28, weightT: 60, axleCount: 8, axleLoadT: 10,
};

function emptyDb(over: Partial<RouteCheckDb> = {}): RouteCheckDb {
  return {
    enabled: async () => false,
    loads: async () => { throw new Error('nie wolno czytać transportów'); },
    latest: async () => null,
    monthSpendUsd: async () => 0,
    monthRoutingRequests: async () => 0,
    save: async () => undefined,
    noteUsage: async () => undefined,
    ...over,
  };
}

describe('H-1 kontrola trasy', () => {
  it('dekoder polilinii zgadza się z przykładem HERE', () => {
    expect(decodeFlexiblePolyline('BFoz5xJ67i1B1B7PzIhaxL7Y')).toEqual([
      [50.10228, 8.69821],
      [50.10201, 8.69567],
      [50.10063, 8.6915],
      [50.09878, 8.68752],
    ]);
  });

  it('puste wymiary zostają puste', () => {
    expect(completeDims({
      heightM: null, widthM: null, lengthM: null, weightT: null, axleCount: null, axleLoadT: null,
    })).toBeNull();
    expect(completeDims({
      heightM: 4.5, widthM: 3.4, lengthM: 28, weightT: 60, axleCount: null, axleLoadT: 10,
    })).toBeNull();
  });

  it('plik ścieżki nie zawiera wymiarów przykładowych z H-0', () => {
    const src = readFileSync('supabase/functions/_shared/here/routeCheck.ts', 'utf8');
    expect(src).not.toMatch(/4\.2/);
    expect(src).not.toMatch(/3\.0/);
    expect(src).not.toContain('25 m');
    expect(src).not.toMatch(/52 t/);
    expect(src).not.toMatch(/6 osi/);
  });

  it('migracja nie włącza flagi i nie zakłada crona', () => {
    const sql = readFileSync('supabase/migrations/0153_h1_route_check.sql', 'utf8');
    expect(sql).toMatch(/'H1_ROUTE_CHECK', false/);
    expect(sql).not.toMatch(/cron\.schedule/);
    expect(sql).not.toMatch(/net\.http_post/);
    expect(sql).not.toMatch(/resend/i);
  });

  it('flaga wyłączona: zero zapytań, nawet gdy transport ma wymiary', async () => {
    const fetch = vi.fn();
    const res = await runRouteCheck({
      db: emptyDb(),
      fetch,
      apiKey: 'klucz-testowy',
      now: () => new Date('2026-10-04T18:00:00Z'),
    });
    expect(res).toMatchObject({ mode: 'OFF', reason: 'wylaczone', queried: 0 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('flaga włączona, brak wymiarów: nie woła HERE', async () => {
    const fetch = vi.fn();
    const res = await runRouteCheck({
      db: emptyDb({
        enabled: async () => true,
        loads: async () => [{
          id: 'l1',
          route: 'GDN-NYN',
          dims: { heightM: null, widthM: null, lengthM: null, weightT: null, axleCount: null, axleLoadT: null },
        }],
      }),
      fetch,
      apiKey: 'klucz-testowy',
      now: () => new Date('2026-10-04T18:00:00Z'),
    });
    expect(res.skipped).toBe(1);
    expect(res.queried).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('limit województwa to zezwolenie, atrybut tunelu tego nie zmienia', () => {
    const out = classifySection({
      notices: [{
        code: 'violatedAdminWideVehicleRestriction',
        severity: 'info',
        details: [{ type: 'adminWideRestriction', maxHeight: 400 }],
      }],
      spans: [{
        notices: [0],
        stateCode: '30',
        countryCode: 'POL',
        names: [{ value: 'S5' }],
        streetAttributes: ['tunnel'],
      }],
    }, DIMS);
    expect(out.obstacles).toEqual([]);
    expect(out.permits).toEqual([expect.objectContaining({
      kind: 'zezwolenie',
      area: 'województwo wielkopolskie',
      stateCode: '30',
      limitText: '400 cm wysokości',
    })]);
    expect(ownSummary(out)).toContain('Wymaga zezwolenia');
    expect(ownSummary(out)).toContain('brak przeszkody fizycznej');
  });

  it('wiadukt z miejscem jest przeszkodą krytyczną, goła droga nie', () => {
    const bridge = classifySection({
      polyline: 'BFoz5xJ67i1B1B7PzIhaxL7Y',
      notices: [{
        code: 'violatedVehicleRestriction',
        severity: 'critical',
        details: [{ type: 'vehicleRestriction', maxHeight: 410 }],
      }],
      spans: [{ notices: [0], offset: 1, names: [{ value: 'Wiadukt nad S5' }], streetAttributes: ['bridge'] }],
    }, DIMS);
    expect(bridge.permits).toEqual([]);
    expect(bridge.obstacles).toHaveLength(1);
    expect(bridge.obstacles[0]).toMatchObject({
      kind: 'wiadukt',
      place: 'Wiadukt nad S5',
      lat: 50.10201,
      lng: 8.69567,
      critical: true,
      limitText: '410 cm wysokości',
      setText: '450 cm',
    });

    const road = classifySection({
      notices: [{
        code: 'violatedVehicleRestriction',
        severity: 'critical',
        details: [{ type: 'vehicleRestriction', maxHeight: 410 }],
      }],
      spans: [{ notices: [0], names: [{ value: 'S5' }], streetAttributes: ['motorway'] }],
    }, DIMS);
    expect(road.obstacles).toEqual([]);
    expect(road.permits).toEqual([]);
  });

  it('most niekrytyczny jest na liście, ale nie jest krytyczny', () => {
    const out = classifySection({
      notices: [{
        code: 'violatedVehicleRestriction',
        severity: 'info',
        details: [{ maxGrossWeight: 30000 }],
      }],
      spans: [{ notices: [0], names: [{ value: 'Most na E4' }], streetAttributes: ['bridge'] }],
    }, DIMS);
    expect(out.obstacles[0].critical).toBe(false);
    expect(out.obstacles[0].kind).toBe('most');
    expect(out.obstacles[0].limitText).toBe('30 t masy');
  });

  it('url nie prosi o myto i bierze wymiary z argumentu', () => {
    const url = buildRoutingUrl({
      apiKey: 'klucz-testowy',
      origin: [52.07391, 17.0246],
      destination: [54.40372, 18.6813],
      dims: DIMS,
    });
    expect(url).toContain('transportMode=truck');
    expect(url).toContain('vehicle%5Bheight%5D=450');
    expect(url).toContain('vehicle%5BaxleCount%5D=8');
    expect(url).not.toMatch(/toll/i);
    expect(url).not.toContain('420');
    const raw = stripHereRaw({ routes: [{ sections: [{ polyline: 'ABC', notices: [{ code: 'x' }] }] }] }, 'klucz-testowy');
    expect(JSON.stringify(raw)).not.toContain('polyline');
    expect(JSON.stringify(raw)).not.toContain('klucz-testowy');
  });

  it('ponowna kontrola co najwyżej co 30 dni albo przy zmianie wymiarów', () => {
    const now = new Date('2026-10-04T00:00:00Z');
    const key = '4.5|3.4|28|60|8|10';
    expect(needsRecheck(null, now, key)).toBe(true);
    expect(needsRecheck({ checkedAt: '2026-09-20T00:00:00Z', dimsKey: key }, now, key)).toBe(false);
    expect(needsRecheck({ checkedAt: '2026-09-01T00:00:00Z', dimsKey: key }, now, key)).toBe(true);
    expect(needsRecheck({ checkedAt: '2026-10-01T00:00:00Z', dimsKey: 'inne' }, now, key)).toBe(true);
  });

  it('budżet 100 USD (koszt ponad pule) zatrzymuje kolejne zapytanie', () => {
    expect(budgetAllows(100, 1)).toBe(false);
    // poza darmową pulą tras stawka z parametrów dolicza się do kosztu
    expect(budgetAllows(99.998, 1, undefined, 5000)).toBe(false);
    expect(budgetAllows(0, 1)).toBe(true);
    expect(budgetLevel(0, false)).toBe('off');
    expect(budgetLevel(80, true)).toBe('high');
    expect(budgetLevel(100, true)).toBe('stop');
  });

  it('korytarz: Gdańsk–Nynäshamn albo Gdynia–Karlskrona, bez rejsu nie ma trasy', () => {
    expect(legsForRoute('GDN-NYN')?.map((l) => l.leg)).toEqual(['PL', 'SE']);
    expect(legsForRoute('GDY-KAA')?.[1].origin).toEqual([56.1646, 15.6308]);
    expect(legsForRoute(null)).toBeNull();
  });

  it('brak klucza: zapis „bez danych HERE”, bez fetch', async () => {
    const saved: SaveRow[] = [];
    const fetch = vi.fn();
    const res = await runRouteCheck({
      db: emptyDb({
        enabled: async () => true,
        loads: async () => [{ id: 'l1', route: 'GDN-NYN', dims: DIMS }],
        save: async (row) => { saved.push(row); },
      }),
      fetch,
      apiKey: '',
      now: () => new Date('2026-10-04T18:00:00Z'),
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(res.mode).toBe('BEZ_HERE');
    expect(saved).toHaveLength(2);
    expect(saved.every((s) => s.summary.includes('Bez danych HERE'))).toBe(true);
    expect(saved.every((s) => s.obstacles.length === 0)).toBe(true);
  });

  it('żywe zapytanie zapisuje przeszkodę i nie wkłada klucza do surowych danych', async () => {
    const saved: SaveRow[] = [];
    const body = {
      routes: [{
        sections: [{
          polyline: 'BFoz5xJ67i1B1B7PzIhaxL7Y',
          notices: [{
            code: 'violatedVehicleRestriction',
            severity: 'critical',
            details: [{ maxHeight: 410 }],
          }, {
            code: 'violatedAdminWideVehicleRestriction',
            severity: 'info',
            details: [{ type: 'adminWideRestriction', maxHeight: 400 }],
          }],
          spans: [
            { notices: [0], offset: 1, names: [{ value: 'Tunel pod S5' }], streetAttributes: ['tunnel'] },
            { notices: [1], stateCode: '22', names: [{ value: 'A1' }], streetAttributes: ['bridge'] },
          ],
        }],
      }],
    };
    const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
    await runRouteCheck({
      db: emptyDb({
        enabled: async () => true,
        loads: async () => [{ id: 'l1', route: 'GDN-NYN', dims: DIMS }],
        save: async (row) => { saved.push(row); },
        noteUsage: async () => undefined,
      }),
      fetch,
      apiKey: 'klucz-testowy',
      now: () => new Date('2026-10-04T18:00:00Z'),
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(saved[0].obstacles).toHaveLength(1);
    expect(saved[0].obstacles[0].kind).toBe('tunel');
    expect(saved[0].permits).toHaveLength(1);
    expect(saved[0].permits[0].area).toBe('województwo pomorskie');
    expect(JSON.stringify(saved[0].raw)).not.toContain('klucz-testowy');
    expect(JSON.stringify(saved[0].raw)).not.toContain('polyline');
  });
});
