/**
 * E49-b cz.1 (DP-206 / D-20261104-0105-01 Z3): plan sprawy SCX i HERE avoid — czyste funkcje.
 */
import { describe, expect, it } from 'vitest';
import {
  avoidBboxAround,
  classifyClosureReason,
  closureSourceOf,
  detourDedupKey,
  looksLikeRoadClosure,
  permitDetourRisk,
  planHold,
} from '../supabase/functions/_shared/e49/detourPlan.ts';
import {
  buildDetourRoutingUrl,
  noDetourWhy,
  simplifyLine,
  summarizeHereRoute,
} from '../supabase/functions/_shared/e49/detourHere.ts';

describe('detourPlan', () => {
  it('dedup: transport + zamknięcie', () => {
    expect(detourDedupKey('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'SE:SIT:123')).toBe(
      'E49_DETOUR:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee:SE:SIT:123',
    );
  });

  it('źródło per kraj', () => {
    expect(closureSourceOf('SE')).toBe('TRAFIKVERKET');
    expect(closureSourceOf('PL')).toBe('HERE');
    expect(closureSourceOf('LT')).toBe('EISMOINFO');
    expect(closureSourceOf('LV')).toBe('LVC');
    expect(closureSourceOf('EE')).toBe('TARKTEE');
    expect(closureSourceOf('FI')).toBe('DIGITRAFFIC');
  });

  it('klasyfikacja przyczyny i zamknięcia', () => {
    expect(classifyClosureReason('Högakustenbron avstängd — vind 31 m/s')).toBe('WIND');
    expect(classifyClosureReason('olycka E4')).toBe('ACCIDENT');
    expect(classifyClosureReason('vägarbete')).toBe('WORKS');
    expect(classifyClosureReason('utrudnienie')).toBe('OTHER');
    expect(looksLikeRoadClosure('Vägen är avstängd')).toBe(true);
    expect(looksLikeRoadClosure('roboty wahadłowe', false)).toBe(false);
    expect(looksLikeRoadClosure('x', true)).toBe(true);
  });

  it('postój: koniec + 30 min; bez końca — untilIso null', () => {
    const withEnd = planHold({
      nowIso: '2026-11-04T10:00:00Z',
      decideByIso: '2026-11-04T12:00:00Z',
      untilIso: '2026-11-04T18:00:00Z',
      baseEtaIso: '2026-11-05T06:00:00Z',
    });
    expect(withEnd.untilIso).toBe('2026-11-04T18:30:00.000Z');
    expect(withEnd.addMin).toBe(6 * 60 + 30); // 12:00 → 18:30
    expect(withEnd.etaIso).toBe('2026-11-05T12:30:00.000Z');

    const open = planHold({
      nowIso: '2026-11-04T10:00:00Z',
      decideByIso: '2026-11-04T12:00:00Z',
      untilIso: null,
      baseEtaIso: '2026-11-05T06:00:00Z',
      unknownFallbackH: 6,
    });
    expect(open.untilIso).toBeNull();
    expect(open.addMin).toBeGreaterThan(0);
  });

  it('avoid bbox i ryzyko zezwolenia (TRASA / UNKNOWN / FIRMA PL)', () => {
    const b = avoidBboxAround(62.8, 17.9, 0.01);
    expect(b.param).toMatch(/^bbox:/);
    expect(b.west).toBeLessThan(17.9);
    expect(permitDetourRisk({ country: 'SE', permitMode: 'TRASA' }).level).toBe('warn');
    expect(permitDetourRisk({ country: 'LV', permitMode: 'UNKNOWN' }).text).toContain('LV');
    expect(permitDetourRisk({ country: 'PL', permitMode: 'FIRMA' }).level).toBe('ok');
  });
});

describe('detourHere', () => {
  const dims = {
    lengthM: 16, widthM: 3.5, heightM: 4.2, weightT: 40, axleCount: 7, axleLoadT: 10,
  };

  it('URL truck + avoid[areas]', () => {
    const url = buildDetourRoutingUrl({
      apiKey: 'test-key',
      origin: [54.5, 18.6],
      destination: [55.0, 19.0],
      dims,
      avoidAreas: ['bbox:18.7,54.6,18.8,54.7'],
    });
    expect(url).toContain('transportMode=truck');
    expect(url).toContain('avoid%5Bareas%5D=bbox');
    expect(url).toContain('vehicle%5Bheight%5D=420');
    expect(url).toContain('apiKey=test-key');
  });

  it('summary / simplify / noDetourWhy', () => {
    expect(summarizeHereRoute({ routes: [] })).toBeNull();
    const sum = summarizeHereRoute({
      routes: [{
        sections: [{
          summary: { length: 31000, duration: 2100 },
          spans: [{ notices: [{ code: 'violatedVehicleRestriction', title: 'height' }] }],
        }],
      }],
    });
    expect(sum?.lengthM).toBe(31000);
    expect(sum?.durationSec).toBe(2100);
    expect(sum?.notices[0]).toContain('height');
    expect(simplifyLine([[1, 2], [3, 4], [5, 6]], 2).length).toBeGreaterThanOrEqual(2);
    expect(noDetourWhy(['routingFailed noRoute'], '3,52 m')).toMatch(/Brak objazdu/);
    expect(noDetourWhy(['ok'], '3,52 m')).toBeNull();
  });
});
