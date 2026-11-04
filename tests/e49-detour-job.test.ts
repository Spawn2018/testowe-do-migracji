/**
 * E49-b cz.2 (DP-206): plan sprawy z zamknięcia + przebieg joba (mock store/HERE).
 */
import { describe, expect, it, vi } from 'vitest';
import {
  buildDetourPayload,
  countryFromRoadKind,
  corridorFromRoadKind,
  estimateDecideByIso,
  isOnRouteClosure,
  placeFromRoadTitle,
  runDetourCases,
  viaFromHereNotices,
} from '../supabase/functions/_shared/e49/detourCaseJob.ts';
import { maskHereApiKey } from '../supabase/functions/_shared/e49/detourHere.ts';

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

  it('decideBy z atKm; via z notices', () => {
    const by = estimateDecideByIso({ nowIso: '2026-11-04T10:00:00Z', fromKm: 0, atKm: 70 });
    expect(Date.parse(by) - Date.parse('2026-11-04T10:00:00Z')).toBe(3600_000);
    expect(viaFromHereNotices(['names E4', 'road 90'])).toMatch(/przez/i);
  });

  it('payload: brak HERE → none; z trasą → addKm/addMin', () => {
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
    expect(none.hold.addMin).toBeGreaterThan(0);

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
      here: { lengthM: 35_000, durationSec: 2100, notices: [], line: null },
      noDetourWhy: null,
      baseLengthM: 0,
    });
    expect(!('none' in ok.detour)).toBe(true);
    if (!('none' in ok.detour)) {
      expect(ok.detour.addKm).toBe(35);
      expect(ok.detour.addMin).toBe(35);
    }
  });
});

describe('runDetourCases', () => {
  it('upsert sprawy dla load na korytarzu; maskuje apiKey; zamyka stale', async () => {
    const upserted: string[] = [];
    let closedKeep: string[] = [];
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      routes: [{ sections: [{ summary: { length: 40000, duration: 2400 }, spans: [] }] }],
    }), { status: 200 }));

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
        }],
        e49DetourLoadLegs: async () => [{
          loadId: 'a0000000-0000-4000-8000-000000000001',
          code: 'SE_E4',
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
    expect(res.hereCalls).toBe(1);
    expect(upserted[0]).toContain('E49_DETOUR:');
    expect(closedKeep).toEqual(upserted);
    expect(maskHereApiKey('https://x?apiKey=secret-key-xyz')).toContain('***');
  });
});
