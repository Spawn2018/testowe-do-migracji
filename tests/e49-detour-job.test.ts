/**
 * E49-b cz.2 (DP-206): plan sprawy z zamknięcia + przebieg joba (mock store/HERE).
 * F7 #791 r2: B3–B6, B8–B9.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  buildDetourPayload,
  buildNineRisks,
  corridorFromRoadKind,
  corridorMatchesLeg,
  countryFromRoadKind,
  estimateDecideByIso,
  isOnRouteClosure,
  placeFromRoadTitle,
  projectKmOnCorridor,
  runDetourCases,
  viaFromHereNotices,
} from '../supabase/functions/_shared/e49/detourCaseJob.ts';
import {
  maskHereApiKey,
  summarizeHereRoute,
  viaFromHereSummary,
} from '../supabase/functions/_shared/e49/detourHere.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('detourCaseJob helpers', () => {
  it('filtr on-route: obok trasy i bez roadClosed → false', () => {
    expect(isOnRouteClosure({
      title: 'Warunki drogowe E4 · obok trasy: roboty',
      detailText: 'roboty',
      obokTrasy: true,
    })).toBe(false);
    expect(isOnRouteClosure({
      title: 'Warunki drogowe E4: Högakustenbron avstängd',
      detailText: 'Vägen är avstängd',
      roadClosed: true,
    })).toBe(true);
  });

  it('kraj / korytarz / place', () => {
    expect(countryFromRoadKind('ROAD_SE')).toBe('SE');
    expect(countryFromRoadKind('ROAD_LV')).toBe('LV');
    expect(corridorFromRoadKind('ROAD_SE', 'E22')).toBe('SE_E22');
    expect(corridorFromRoadKind('ROAD_PL')).toBe('PL_ROAD');
    expect(placeFromRoadTitle('Warunki drogowe E4: Högakustenbron avstängd', 'E4')).toContain('Högakustenbron');
  });

  it('B3: ROAD_LT/LV/EE → PL_EE_E67; FI → FI_E75; SE_E4 → SE_E4_STO; tylko korytarz=on', () => {
    expect(corridorMatchesLeg({ corridor: 'ROAD_LV', country: 'LV', korytarzDroga: 'on' }, 'PL_EE_E67')).toBe(true);
    expect(corridorMatchesLeg({ corridor: 'ROAD_LT', country: 'LT', korytarzDroga: 'on' }, 'PL_EE_E67')).toBe(true);
    expect(corridorMatchesLeg({ corridor: 'ROAD_EE', country: 'EE', korytarzDroga: 'on' }, 'PL_EE_E67')).toBe(true);
    expect(corridorMatchesLeg({ corridor: 'ROAD_FI', country: 'FI', korytarzDroga: 'on' }, 'FI_E75')).toBe(true);
    expect(corridorMatchesLeg({ corridor: 'SE_E4', country: 'SE', korytarzDroga: 'on' }, 'SE_E4_STO')).toBe(true);
    expect(corridorMatchesLeg({ corridor: 'SE_E4', country: 'SE', korytarzDroga: 'on' }, 'SE_E18_KPS')).toBe(true);
    expect(corridorMatchesLeg({ corridor: 'SE_E4', country: 'SE', korytarzDroga: 'on' }, 'SE_KAA_INLAND')).toBe(true);
    expect(corridorMatchesLeg({ corridor: 'ROAD_LV', country: 'LV', korytarzDroga: 'off' }, 'PL_EE_E67')).toBe(false);
    expect(corridorMatchesLeg({ corridor: 'ROAD_LV', country: 'LV', korytarzDroga: 'unknown' }, 'PL_EE_E67')).toBe(false);
    expect(corridorMatchesLeg({ corridor: 'ROAD_LV', country: 'LV' }, 'PL_EE_E67')).toBe(false);
    expect(corridorMatchesLeg({ corridor: 'ROAD_LV', country: 'LV', korytarzDroga: 'on' }, 'SE_E4')).toBe(false);
  });

  it('B4: projectKmOnCorridor + decideBy', () => {
    const line: Array<[number, number]> = [
      [17.0, 62.0],
      [17.5, 62.5],
      [18.0, 63.0],
    ];
    const km = projectKmOnCorridor(line, 62.5, 17.5);
    expect(km).not.toBeNull();
    expect(km!).toBeGreaterThan(0);
    const by = estimateDecideByIso({ nowIso: '2026-11-04T10:00:00Z', fromKm: 0, atKm: 70 });
    expect(Date.parse(by) - Date.parse('2026-11-04T10:00:00Z')).toBe(3600_000);
  });

  it('B9: via z names/roadNumbers; fallback notices', () => {
    expect(viaFromHereNotices(['names E4', 'road 90'])).toMatch(/przez/i);
    expect(viaFromHereSummary({
      names: ['Kramfors', 'Sandöbron'],
      roadNumbers: ['90'],
      notices: [],
    })).toBe('przez Kramfors i Sandöbron (droga 90)');
  });

  it('B8: 9 rodzajów — brak danych = warn „sprawdź …”, nie ok', () => {
    const hold = buildNineRisks({ side: 'hold', country: 'SE', permitMode: 'TRASA' });
    const det = buildNineRisks({ side: 'detour', country: 'SE', permitMode: 'TRASA', hereNotices: [] });
    expect(hold.map((r) => r.kind)).toEqual([
      'PERMIT', 'LIMITS', 'BAN', 'WORKS', 'WIND', 'HOURS', 'FERRY', 'WINDOW', 'PILOT',
    ]);
    expect(det).toHaveLength(9);
    expect(hold.every((r) => r.text.length > 0)).toBe(true);
    const missingKinds = ['LIMITS', 'BAN', 'WORKS', 'WIND', 'HOURS', 'FERRY', 'WINDOW', 'PILOT'];
    for (const k of missingKinds) {
      const row = hold.find((r) => r.kind === k)!;
      expect(row.level).toBe('warn');
      expect(row.text).toMatch(/sprawdź/i);
    }
    const withData = buildNineRisks({
      side: 'detour',
      country: 'SE',
      permitMode: 'FIRMA',
      hereNotices: ['ok'],
      wind: { kind: 'WIND', level: 'ok', text: 'wiatr 12 m/s — OK' },
      hours: { kind: 'HOURS', level: 'warn', text: 'zostało 1 h jazdy' },
    });
    expect(withData.find((r) => r.kind === 'WIND')).toEqual({
      kind: 'WIND', level: 'ok', text: 'wiatr 12 m/s — OK',
    });
    expect(withData.find((r) => r.kind === 'HOURS')?.level).toBe('warn');
    expect(withData.find((r) => r.kind === 'LIMITS')?.level).toBe('ok');
  });

  it('payload: brak HERE → none; z trasą → nadwyżka km/min (B6)', () => {
    const none = buildDetourPayload({
      nowIso: '2026-11-04T10:00:00Z',
      decideByIso: '2026-11-04T12:00:00Z',
      untilIso: '2026-11-04T18:00:00Z',
      baseEtaIso: '2026-11-05T06:00:00Z',
      country: 'SE',
      permitMode: 'TRASA',
      lat: 62.8,
      lon: 17.9,
      corridor: 'SE_E4',
      atKm: 100,
      here: null,
      noDetourWhy: 'Brak objazdu dla tego zestawu — tylko postój',
    });
    expect('none' in none.detour && none.detour.none).toBe(true);
    expect(none.hold.risks).toHaveLength(9);

    const ok = buildDetourPayload({
      nowIso: '2026-11-04T10:00:00Z',
      decideByIso: '2026-11-04T12:00:00Z',
      untilIso: null,
      baseEtaIso: '2026-11-05T06:00:00Z',
      country: 'PL',
      permitMode: 'FIRMA',
      lat: 53.1,
      lon: 18.0,
      corridor: 'PL_ROAD',
      atKm: 50,
      here: {
        lengthM: 40_000,
        durationSec: 3000,
        notices: [],
        names: ['Toruń'],
        roadNumbers: ['10'],
        line: null,
      },
      noDetourWhy: null,
      baseLengthM: 25_000,
      baseDurationSec: 1800,
    });
    expect(!('none' in ok.detour)).toBe(true);
    if (!('none' in ok.detour)) {
      expect(ok.detour.addKm).toBe(15);
      expect(ok.detour.addMin).toBe(20);
      expect(ok.detour.via).toMatch(/Toruń/);
      expect(ok.detour.risks).toHaveLength(9);
    }
  });
});

describe('summarizeHereRoute B5/B9', () => {
  it('czyta sections[].notices i spans.names', () => {
    const sum = summarizeHereRoute({
      routes: [{
        sections: [{
          summary: { length: 1000, duration: 60 },
          notices: [{ code: 'violatedVehicleRestriction', title: 'height' }],
          spans: [
            { names: [{ name: 'Kramfors' }], roadNumbers: ['90'], notices: [] },
          ],
        }],
      }],
    });
    expect(sum?.notices.some((n) => /violatedVehicleRestriction/i.test(n))).toBe(true);
    expect(sum?.names).toContain('Kramfors');
    expect(sum?.roadNumbers).toContain('90');
  });
});

describe('runDetourCases', () => {
  it('upsert sprawy dla load na korytarzu; maskuje apiKey; zamyka stale', async () => {
    const upserted: string[] = [];
    let closedKeep: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      const avoid = String(url).includes('avoid');
      return new Response(JSON.stringify({
        routes: [{
          sections: [{
            summary: { length: avoid ? 40000 : 25000, duration: avoid ? 2400 : 1500 },
            spans: [{ names: [{ name: 'Kramfors' }, { name: 'Sandöbron' }], roadNumbers: ['90'] }],
          }],
        }],
      }), { status: 200 });
    });

    const res = await runDetourCases({
      now: new Date('2026-11-04T10:00:00Z'),
      hereApiKey: 'secret-key-xyz',
      fetch: fetchMock as unknown as typeof fetch,
      store: {
        listOpenRoadClosures: async () => [{
          closureRef: 'ROAD_SE:SIT:1',
          country: 'SE',
          place: 'Högakustenbron (E4)',
          title: 'Warunki drogowe E4: Högakustenbron avstängd',
          detailText: 'Vägen är avstängd',
          lat: 62.8,
          lon: 17.9,
          noticeIso: '2026-11-04T09:00:00Z',
          untilIso: '2026-11-04T18:00:00Z',
          roadClosed: true,
          corridor: 'SE_E4',
          atKm: 120,
          korytarzDroga: 'on',
        }],
        e49DetourLoadLegs: async () => [{
          loadId: 'a0000000-0000-4000-8000-000000000001',
          code: 'SE_E4_STO',
          fromKm: 10,
          currentLeg: true,
          status: 'IN_TRANSIT_SE',
          baseEtaIso: '2026-11-05T08:00:00Z',
          dims: {
            lengthM: 25, widthM: 3.2, heightM: 4.0, weightT: 60, axleCount: 8, axleLoadT: 10,
          },
          position: [62.5, 17.5],
          permitMode: 'TRASA',
        }],
        upsertE49DetourCase: async (row) => {
          upserted.push(row.dedupKey);
          expect(row.payload.hereUrlMasked).toContain('apiKey=***');
          expect(row.payload.hereUrlMasked).not.toContain('secret-key');
          if (!('none' in row.payload.detour)) {
            expect(row.payload.detour.risks).toHaveLength(9);
            expect(row.payload.detour.addKm).toBe(15);
          }
          return true;
        },
        closeStaleE49DetourCases: async (keep) => {
          closedKeep = keep;
          return 0;
        },
        noteHereUsage: async () => {},
        hereMonthSpend: async () => 0,
      },
    });

    expect(res.upserts).toBe(1);
    expect(res.hereCalls).toBeGreaterThanOrEqual(1);
    expect(upserted[0]).toContain('E49_DETOUR:');
    expect(closedKeep).toEqual(upserted);
    expect(maskHereApiKey('https://x?apiKey=secret-key-xyz')).toContain('***');
  });

  it('B4: zamknięcie za autem (atKm < fromKm) — 0 upsertów', async () => {
    const upserted: string[] = [];
    await runDetourCases({
      now: new Date('2026-11-04T10:00:00Z'),
      hereApiKey: null,
      fetch: vi.fn() as unknown as typeof fetch,
      store: {
        listOpenRoadClosures: async () => [{
          closureRef: 'ROAD_SE:SIT:behind',
          country: 'SE',
          place: 'za autem',
          title: 'closed',
          detailText: 'avstängd',
          lat: 62.0,
          lon: 17.0,
          noticeIso: '2026-11-04T09:00:00Z',
          untilIso: null,
          roadClosed: true,
          corridor: 'SE_E4',
          atKm: 5,
        }],
        e49DetourLoadLegs: async () => [{
          loadId: 'a0000000-0000-4000-8000-000000000001',
          code: 'SE_E4',
          fromKm: 50,
          currentLeg: true,
          status: 'IN_TRANSIT_SE',
          baseEtaIso: null,
          dims: {
            lengthM: 25, widthM: 3.2, heightM: 4.0, weightT: 60, axleCount: 8, axleLoadT: 10,
          },
          position: null,
          permitMode: 'UNKNOWN',
        }],
        upsertE49DetourCase: async (row) => {
          upserted.push(row.dedupKey);
          return true;
        },
        closeStaleE49DetourCases: async () => 0,
      },
    });
    expect(upserted).toEqual([]);
  });

  it('B3: ROAD_LV × PL_EE_E67 → upsert', async () => {
    const upserted: string[] = [];
    await runDetourCases({
      now: new Date('2026-11-04T10:00:00Z'),
      hereApiKey: null,
      fetch: vi.fn() as unknown as typeof fetch,
      store: {
        listOpenRoadClosures: async () => [{
          closureRef: 'ROAD_LV:1',
          country: 'LV',
          place: 'most LV',
          title: 'ceļš slēgts',
          detailText: 'closed',
          lat: 56.9,
          lon: 24.1,
          noticeIso: '2026-11-04T09:00:00Z',
          untilIso: null,
          roadClosed: true,
          corridor: 'ROAD_LV',
          atKm: 200,
          korytarzDroga: 'on',
        }],
        e49DetourLoadLegs: async () => [{
          loadId: 'a0000000-0000-4000-8000-000000000002',
          code: 'PL_EE_E67',
          fromKm: 100,
          currentLeg: true,
          status: 'IN_TRANSIT_PL',
          baseEtaIso: null,
          dims: {
            lengthM: null, widthM: null, heightM: null, weightT: null, axleCount: null, axleLoadT: null,
          },
          position: [54.5, 23.5],
          permitMode: 'UNKNOWN',
        }],
        upsertE49DetourCase: async (row) => {
          upserted.push(row.dedupKey);
          return true;
        },
        closeStaleE49DetourCases: async () => 0,
      },
    });
    expect(upserted).toHaveLength(1);
  });
});

describe('TodoPanel B10/B11', () => {
  it('supabase: decyzja bez lokalnego appendEvent; canDecide SCX|HHL_ADMIN', () => {
    const src = readFileSync(resolve('src/components/risks/TodoPanel.tsx'), 'utf8');
    expect(src).toMatch(/VITE_AUTH_MODE !== 'supabase'/);
    expect(src).toMatch(/F7 #791 B10/);
    expect(src).toMatch(/canDecide: role === 'SCX' \|\| accountRole\(role\) === 'HHL_ADMIN'/);
    const block = src.slice(src.indexOf('detourHandlers'), src.indexOf('detourHandlers') + 1800);
    expect(block).toMatch(/VITE_AUTH_MODE !== 'supabase'/);
    expect(block).toMatch(/appendEvent/);
  });
});
