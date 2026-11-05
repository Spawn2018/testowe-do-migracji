/**
 * E49-b cz.2 (DP-206): plan sprawy z zamknięcia + przebieg joba (mock store/HERE).
 * F7 #791 r2: B3–B6, B8–B9.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  buildDetourPayload,
  buildNineRisks,
  riskBanForEta,
  riskWorksOnCorridor,
  looksLikeRoadWorks,
  banDriveWindow,
  worksOnDetourGeometry,
  corridorFromRoadKind,
  corridorMatchesLeg,
  countryFromRoadKind,
  estimateDecideByIso,
  isOnRouteClosure,
  placeFromRoadTitle,
  projectKmOnCorridor,
  hoursLeftFromH4Segments,
  riskFerryVsEta,
  riskHoursFromLeft,
  riskPilotForCountry,
  etaPortForVariant,
  riskWindFromGust,
  riskWindowVsEta,
  peakGustInDriveWindow,
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
  });

  it('DP-212: WIND — szczyt w oknie jazdy wariantu (nie cały horyzont)', () => {
    const rows = [{
      km: 100,
      samples: [
        { at: '2026-11-05T08:00:00Z', gustMs: 14 },
        { at: '2026-11-05T14:00:00Z', gustMs: 28 }, // poza oknem objazdu
        { at: '2026-11-05T09:00:00Z', gustMs: 18 },
      ],
    }];
    // Okno objazdu 08:00–10:00 → szczyt 18, nie 28.
    expect(peakGustInDriveWindow({
      rows,
      fromIso: '2026-11-05T08:00:00Z',
      toIso: '2026-11-05T10:00:00Z',
    })).toBe(18);
    expect(peakGustInDriveWindow({
      rows,
      fromIso: '2026-11-05T12:00:00Z',
      toIso: '2026-11-05T13:00:00Z',
    })).toBeNull();

    const win = banDriveWindow({
      side: 'detour',
      nowIso: '2026-11-05T08:00:00Z',
      decideByIso: '2026-11-05T08:00:00Z',
      driveMin: 120,
    })!;
    const wired = buildNineRisks({
      side: 'detour',
      country: 'SE',
      permitMode: 'TRASA',
      hereNotices: ['ok'],
      banFromIso: win.fromIso,
      banToIso: win.toIso,
      riskCtx: { windRows: rows },
    });
    expect(wired.find((r) => r.kind === 'WIND')?.text).toMatch(/18 m\/s/);
    expect(wired.find((r) => r.kind === 'WIND')?.level).toBe('ok');
    // Bez próbek w oknie → warn (nie bierze szczytu spoza okna).
    const emptyWin = buildNineRisks({
      side: 'detour',
      country: 'SE',
      permitMode: 'TRASA',
      hereNotices: ['ok'],
      banFromIso: '2026-11-05T12:00:00Z',
      banToIso: '2026-11-05T13:00:00Z',
      riskCtx: { windRows: rows },
    });
    expect(emptyWin.find((r) => r.kind === 'WIND')?.level).toBe('warn');
    expect(emptyWin.find((r) => r.kind === 'WIND')?.text).toMatch(/sprawdź/i);
  });

  it('B8 r4/r5: WIND/HOURS/FERRY/WINDOW/PILOT — ok i warn z wartościami', () => {
    expect(riskWindFromGust(14).text).toMatch(/14 m\/s — bez wpływu/);
    expect(riskWindFromGust(14).level).toBe('ok');
    expect(riskWindFromGust(22).level).toBe('warn');
    expect(riskWindFromGust(null).text).toMatch(/sprawdź/i);

    expect(hoursLeftFromH4Segments([
      { code: 'EU_DRIVE', hours: 2 },
      { code: 'EU_BREAK_45', hours: 0.75 },
      { code: 'EU_DRIVE', hours: 1 },
      { code: 'EU_DAILY_REST', hours: 11 },
    ])).toBe(180);
    expect(hoursLeftFromH4Segments([])).toBeNull();

    expect(riskHoursFromLeft(180, 60).level).toBe('ok');
    expect(riskHoursFromLeft(180, 60).text).toMatch(/3 h/);
    expect(riskHoursFromLeft(30, 90).level).toBe('warn');
    expect(riskHoursFromLeft(null, null).text).toMatch(/sprawdź/i);

    // F7 r5 B8a: auto 3 h przed rejsem, objazd +35 → zdąży; postój +4 h → nie zdąży.
    const portBase = '2026-11-04T18:30:00Z'; // 3 h przed 21:30
    const detourPort = etaPortForVariant(portBase, 35)!;
    const holdPort = etaPortForVariant(portBase, 4 * 60)!;
    const ferryOk = riskFerryVsEta({
      operator: 'Tallink',
      depIso: '2026-11-04T21:30:00Z',
      etaIso: detourPort,
    });
    expect(ferryOk.level).toBe('ok');
    expect(ferryOk.text).toMatch(/Tallink 21:30/);
    expect(ferryOk.text).toMatch(/zapas/);
    expect(riskFerryVsEta({
      operator: 'Tallink',
      depIso: '2026-11-04T21:30:00Z',
      etaIso: holdPort,
      nextDepIso: '2026-11-05T06:00:00Z',
    }).text).toMatch(/nie zdąży; następny 06:00/);
    expect(riskFerryVsEta({
      operator: 'Tallink',
      depIso: '2026-11-04T21:30:00Z',
      pastFerry: true,
    }).text).toMatch(/za transportem/);
    expect(riskFerryVsEta({
      operator: 'Tallink',
      depIso: '2026-11-04T21:30:00Z',
      etaIso: detourPort,
      syntheticEta: true,
    }).level).toBe('warn');
    expect(riskFerryVsEta({ operator: null, depIso: null, etaIso: null }).text).toMatch(/sprawdź/i);

    const winOk = riskWindowVsEta({
      windowEndIso: '2026-11-05T12:00:00Z',
      etaIso: '2026-11-05T10:00:00Z',
    });
    expect(winOk.level).toBe('ok');
    expect(winOk.text).toMatch(/oknie/);
    expect(riskWindowVsEta({
      windowEndIso: '2026-11-05T12:00:00Z',
      etaIso: '2026-11-05T14:00:00Z',
    }).level).toBe('warn');
    expect(riskWindowVsEta({ windowEndIso: null, etaIso: null }).text).toMatch(/sprawdź/i);

    expect(riskPilotForCountry({ country: 'SE', pilotCountries: ['SE', 'PL'] }).level).toBe('ok');
    expect(riskPilotForCountry({ country: 'SE', pilotCountries: ['PL'] }).level).toBe('warn');
    expect(riskPilotForCountry({ country: 'SE', pilotCountries: null }).text).toMatch(/sprawdź/i);

    // DP-210 / decyzja 105 (#809): EE/LV/LT/FI — ok „pilot niewymagany”, bez awizacji.
    for (const c of ['EE', 'LV', 'LT', 'FI'] as const) {
      const row = riskPilotForCountry({ country: c, pilotCountries: null });
      expect(row.level).toBe('ok');
      expect(row.text).toBe(`pilot niewymagany (${c})`);
    }
    expect(riskPilotForCountry({ country: 'EE', pilotCountries: ['SE'] }).text)
      .toBe('pilot niewymagany (EE)');

    const wired = buildNineRisks({
      side: 'detour',
      country: 'SE',
      permitMode: 'TRASA',
      hereNotices: ['ok'],
      etaIso: '2026-11-04T20:20:00Z',
      needDriveMin: 60,
      riskCtx: {
        windGustMs: 14,
        hoursLeftMin: 180,
        ferryOperator: 'Tallink',
        ferryDepIso: '2026-11-04T21:30:00Z',
        windowEndIso: '2026-11-05T12:00:00Z',
        pilotCountries: ['SE'],
      },
    });
    expect(wired.find((r) => r.kind === 'WIND')?.level).toBe('ok');
    expect(wired.find((r) => r.kind === 'HOURS')?.level).toBe('ok');
    expect(wired.find((r) => r.kind === 'FERRY')?.level).toBe('ok');
    expect(wired.find((r) => r.kind === 'WINDOW')?.level).toBe('ok');
    expect(wired.find((r) => r.kind === 'PILOT')?.level).toBe('ok');
  });

  it('DP-211: BAN/WORKS — źródła → ok/warn; brak → sprawdź', () => {
    // BAN: SE sobota → warn; wtorek + holiday false → ok; LT bez kalendarza → sprawdź.
    expect(riskBanForEta({
      country: 'SE',
      etaIso: '2026-11-07T12:00:00Z', // sobota
      holidayHit: false,
    }).level).toBe('warn');
    expect(riskBanForEta({
      country: 'SE',
      etaIso: '2026-11-07T12:00:00Z',
      holidayHit: false,
    }).text).toMatch(/Zakaz czasowy SE/i);
    expect(riskBanForEta({
      country: 'PL',
      etaIso: '2026-11-03T12:00:00Z', // wtorek
      holidayHit: false,
    })).toEqual({
      kind: 'BAN',
      level: 'ok',
      text: 'brak zakazu czasowego PL w czasie objazdu',
    });
    expect(riskBanForEta({
      country: 'PL',
      etaIso: '2026-11-03T12:00:00Z',
      holidayHit: true,
    }).level).toBe('warn');
    expect(riskBanForEta({ country: 'LT', etaIso: '2026-11-03T12:00:00Z' }).text)
      .toMatch(/sprawdź/i);
    expect(riskBanForEta({ country: 'SE', etaIso: null }).text).toMatch(/sprawdź/i);

    // F7 #805 B2 / N1: holidayHit null (brak danych lub błąd RPC) → warn (nigdy ok).
    expect(riskBanForEta({
      country: 'PL',
      etaIso: '2026-11-03T12:00:00Z',
      holidayHit: null,
    })).toMatchObject({
      kind: 'BAN',
      level: 'warn',
      text: expect.stringMatching(/święta nie sprawdzono/i),
    });
    // N1: truckBanHolidayHit przy r.error → null → merge → holidayBan null → ten sam warn.
    expect(riskBanForEta({
      country: 'SE',
      etaIso: '2026-11-03T12:00:00Z', // wtorek SE
      holidayHit: null, // symulacja RPC error
    }).level).toBe('warn');

    // F7 #805 B4(a): okno objazdu PL w niedzielę (zakaz), ETA placu we wtorek → BAN warn.
    // (F7 pisało „sobota”; PL zakaz H-12 = niedziela — to samo: punkt placu ≠ okno jazdy.)
    const win = banDriveWindow({
      side: 'detour',
      nowIso: '2026-11-08T18:00:00Z', // niedziela
      decideByIso: '2026-11-08T19:00:00Z', // 20:00 PL
      driveMin: 120,
    })!;
    expect(riskBanForEta({
      country: 'PL',
      fromIso: win.fromIso,
      toIso: win.toIso,
      holidayHit: false,
    }).level).toBe('warn');
    // Sam ETA placu we wtorek byłby ok — stąd B1.
    expect(riskBanForEta({
      country: 'PL',
      etaIso: '2026-11-10T12:00:00Z',
      holidayHit: false,
    }).level).toBe('ok');

    // WORKS: null → sprawdź; true → warn z tytułem; false → ok.
    expect(riskWorksOnCorridor({ hit: null }).text).toMatch(/sprawdź/i);
    expect(riskWorksOnCorridor({ hit: true, title: 'Roboty E4 Sundsvall' }).text)
      .toMatch(/Roboty E4 Sundsvall/);
    expect(riskWorksOnCorridor({ hit: false })).toEqual({
      kind: 'WORKS',
      level: 'ok',
      text: 'brak otwartych robót ROAD_* na trasie objazdu',
    });
    expect(looksLikeRoadWorks({
      title: 'Roboty drogowe E4',
      detailText: 'vägarbete',
      roadClosed: false,
    })).toBe(true);
    expect(looksLikeRoadWorks({
      title: 'Most zamknięty',
      detailText: 'bridge closed',
      roadClosed: true,
    })).toBe(false);

    // F7 #805 B3/B4(c)(d): bieżące zamknięcie WORKS wykluczone; poza linią → ok; brak linii → null.
    const closureWorks = {
      closureRef: 'ROAD_SE:bridge-1',
      country: 'SE' as const,
      place: 'Sundsvall',
      title: 'Most zamknięty — roboty',
      detailText: 'vägarbete bridge',
      lat: 62.39,
      lon: 17.31,
      noticeIso: '2026-11-04T08:00:00Z',
      untilIso: null,
      corridor: 'SE_E4',
      atKm: 100,
      korytarzDroga: 'on',
      roadClosed: false,
    };
    const otherFar = {
      ...closureWorks,
      closureRef: 'ROAD_SE:works-far',
      title: 'Roboty boczna droga',
      lat: 63.5,
      lon: 18.5,
    };
    const otherNear = {
      ...closureWorks,
      closureRef: 'ROAD_SE:works-near',
      title: 'Roboty na objazd',
      lat: 62.40,
      lon: 17.32,
    };
    const line: Array<[number, number]> = [
      [62.38, 17.30],
      [62.40, 17.32],
      [62.42, 17.34],
    ];
    expect(worksOnDetourGeometry({
      works: [closureWorks, otherFar],
      lineLatLon: line,
      excludeRef: 'ROAD_SE:bridge-1',
    })).toEqual({ hit: false, title: null });
    expect(worksOnDetourGeometry({
      works: [closureWorks, otherNear],
      lineLatLon: line,
      excludeRef: 'ROAD_SE:bridge-1',
    })).toEqual({ hit: true, title: 'Roboty na objazd' });
    expect(worksOnDetourGeometry({
      works: [closureWorks],
      lineLatLon: null,
      excludeRef: 'ROAD_SE:bridge-1',
    }).hit).toBeNull();

    const wired = buildNineRisks({
      side: 'detour',
      country: 'SE',
      permitMode: 'TRASA',
      hereNotices: [],
      banFromIso: '2026-11-03T12:00:00Z', // wtorek
      banToIso: '2026-11-03T14:00:00Z',
      etaIso: '2026-11-03T15:00:00Z',
      riskCtx: {
        holidayBan: false,
        worksHit: false,
        worksDetourHit: false,
      },
    });
    expect(wired.find((r) => r.kind === 'BAN')?.level).toBe('ok');
    expect(wired.find((r) => r.kind === 'WORKS')?.level).toBe('ok');

    // Objazd: worksHit korytarza z tytułem zamknięcia nie może przebić worksDetourHit.
    const detourWorks = buildNineRisks({
      side: 'detour',
      country: 'SE',
      permitMode: 'TRASA',
      banFromIso: '2026-11-03T12:00:00Z',
      banToIso: '2026-11-03T14:00:00Z',
      riskCtx: {
        holidayBan: false,
        worksHit: true,
        worksTitle: 'Most zamknięty — roboty',
        worksDetourHit: false,
        worksDetourTitle: null,
      },
    });
    expect(detourWorks.find((r) => r.kind === 'WORKS')).toEqual({
      kind: 'WORKS',
      level: 'ok',
      text: 'brak otwartych robót ROAD_* na trasie objazdu',
    });
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

  it('B4 r4: READY / brak pozycji — 0 upsertów; IN_TRANSIT bez pozycji trzyma keep', async () => {
    const upserted: string[] = [];
    let keep: string[] = [];
    await runDetourCases({
      now: new Date('2026-11-04T10:00:00Z'),
      hereApiKey: null,
      fetch: vi.fn() as unknown as typeof fetch,
      store: {
        listOpenRoadClosures: async () => [{
          closureRef: 'ROAD_SE:SIT:ready',
          country: 'SE',
          place: 'most',
          title: 'closed',
          detailText: 'avstängd',
          lat: 62.8,
          lon: 17.9,
          noticeIso: '2026-11-04T09:00:00Z',
          untilIso: null,
          roadClosed: true,
          corridor: 'SE_E4',
          atKm: 120,
          korytarzDroga: 'on',
        }],
        e49DetourLoadLegs: async () => [{
          loadId: 'a0000000-0000-4000-8000-000000000099',
          code: 'SE_E4_STO',
          fromKm: 10,
          currentLeg: true,
          status: 'READY',
          baseEtaIso: null,
          dims: {
            lengthM: 25, widthM: 3.2, heightM: 4.0, weightT: 60, axleCount: 8, axleLoadT: 10,
          },
          position: [62.5, 17.5],
          permitMode: 'TRASA',
        }, {
          loadId: 'a0000000-0000-4000-8000-000000000098',
          code: 'SE_E4_STO',
          fromKm: 10,
          currentLeg: true,
          status: 'IN_TRANSIT_SE',
          baseEtaIso: null,
          dims: {
            lengthM: 25, widthM: 3.2, heightM: 4.0, weightT: 60, axleCount: 8, axleLoadT: 10,
          },
          position: null,
          permitMode: 'TRASA',
        }],
        upsertE49DetourCase: async (row) => {
          upserted.push(row.dedupKey);
          return true;
        },
        closeStaleE49DetourCases: async (k) => {
          keep = k;
          return 0;
        },
      },
    });
    expect(upserted).toEqual([]);
    expect(keep.some((k) => k.includes('000000000098'))).toBe(true);
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

  it('B6 r4: pamięć HERE — drugi przebieg bez nowych zapytań przy pozycji <10 km', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const avoid = String(url).includes('avoid');
      return new Response(JSON.stringify({
        routes: [{
          sections: [{
            summary: { length: avoid ? 40000 : 25000, duration: avoid ? 2400 : 1500 },
            spans: [{ names: [{ name: 'Kramfors' }], roadNumbers: ['90'] }],
          }],
        }],
      }), { status: 200 });
    });
    const cachedPayload = buildDetourPayload({
      nowIso: '2026-11-04T10:00:00Z',
      decideByIso: '2026-11-04T12:00:00Z',
      untilIso: null,
      baseEtaIso: '2026-11-05T08:00:00Z',
      country: 'SE',
      permitMode: 'TRASA',
      lat: 62.8,
      lon: 17.9,
      corridor: 'SE_E4_STO',
      atKm: 120,
      here: {
        lengthM: 40000, durationSec: 2400, notices: [], names: ['Kramfors'], roadNumbers: ['90'], line: null,
      },
      noDetourWhy: null,
      baseLengthM: 25000,
      baseDurationSec: 1500,
    });
    cachedPayload.positionAtCalc = [62.5, 17.5];
    cachedPayload.hereCalculatedAt = '2026-11-04T10:00:00Z';
    cachedPayload.hereNotices = ['TruckAttributes'];

    const upserted: Array<{ positionAtCalc?: readonly [number, number] | null; notices?: string[] | null }> = [];
    const res = await runDetourCases({
      now: new Date('2026-11-04T10:30:00Z'),
      hereApiKey: 'secret-key-xyz',
      fetch: fetchMock as unknown as typeof fetch,
      store: {
        listOpenRoadClosures: async () => [{
          closureRef: 'ROAD_SE:SIT:1',
          country: 'SE',
          place: 'Högakustenbron (E4)',
          title: 'closed',
          detailText: 'avstängd',
          lat: 62.8,
          lon: 17.9,
          noticeIso: '2026-11-04T09:00:00Z',
          untilIso: null,
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
          // ~2 km od kotwicy — pamięć; kotwica nie może się przesunąć na tę pozycję.
          position: [62.52, 17.51],
          permitMode: 'TRASA',
        }],
        getOpenDetourCache: async () => ({
          payload: cachedPayload,
          position: [62.5, 17.5],
          closureLat: 62.8,
          closureLon: 17.9,
        }),
        upsertE49DetourCase: async (row) => {
          upserted.push({
            positionAtCalc: row.payload.positionAtCalc,
            notices: row.payload.hereNotices,
          });
          return true;
        },
        closeStaleE49DetourCases: async () => 0,
        noteHereUsage: async () => {},
        hereMonthSpend: async () => 0,
      },
    });
    expect(res.hereCalls).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(upserted[0]?.positionAtCalc?.[0]).toBe(62.5);
    expect(upserted[0]?.positionAtCalc?.[1]).toBe(17.5);
    expect(upserted[0]?.notices).toEqual(['TruckAttributes']);
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

describe('TodoPanel B10/B11/B13', () => {
  it('supabase: decyzja bez lokalnego appendEvent; canDecide SCX|HHL_ADMIN (bez demo HHL bez roli)', () => {
    const src = readFileSync(resolve('src/components/risks/TodoPanel.tsx'), 'utf8');
    expect(src).toMatch(/VITE_AUTH_MODE !== 'supabase'/);
    expect(src).toMatch(/F7 #791 B10/);
    expect(src).toMatch(/canDecide: role === 'SCX' \|\| accountRole\(role\) === 'HHL_ADMIN'/);
    expect(src).not.toMatch(/role === 'HHL' && accountRole\(role\) == null/);
    const block = src.slice(src.indexOf('detourHandlers'), src.indexOf('detourHandlers') + 1800);
    expect(block).toMatch(/VITE_AUTH_MODE !== 'supabase'/);
    expect(block).toMatch(/appendEvent/);
  });
});
