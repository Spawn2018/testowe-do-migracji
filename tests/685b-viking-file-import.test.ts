/**
 * #685-b / decyzja 63b+74 + #685-c + F7 #690 r1 — applyVikingFileSchedule (≠ applySailings).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseVikingTimetableHtml } from '../supabase/functions/_shared/ferry/vikingline.ts';
import {
  applyVikingFileSchedule,
  previewVikingFileSailings,
  isDigitrafficSourceRef,
  isVikingFileTouchCandidate,
  vikingScheduleCoverageDaysFromNow,
  VIKING_FILE_COVERAGE_DAYS_CLOSE,
  VIKING_FILE_SCHEDULE_WIN_MS,
  type VikingFileImportDeps,
  type VikingFileImportStore,
} from '../supabase/functions/_shared/ferry/vikingFileImport.ts';
import type { DbSailing, VesselRow } from '../supabase/functions/_shared/integrations/sync.ts';

/** Przycięty zapis właściciela 31.10 (encje &#x2013;, li.c-accordion__item) — DP-21 / #685-b. */
const VIKING_CARGO_HTML = readFileSync(
  new URL('./fixtures/viking-cargo-hel-tll-saved-sample.html', import.meta.url),
  'utf8',
);

const VESSEL_XPRS = 'ves-xprs';
const VESSEL_CIND = 'ves-cind';
const vessels: VesselRow[] = [
  { id: VESSEL_XPRS, name: 'M/F Viking XPRS', mmsi: 230705000 },
  { id: VESSEL_CIND, name: 'M/F Viking Cinderella', mmsi: 230184000 },
];

type Mem = VikingFileImportStore & {
  sailings: DbSailing[];
  resolved: string[];
  risks: string[];
  setLoads(id: string, n: number): void;
};

function sailing(partial: Partial<DbSailing> & Pick<DbSailing, 'id' | 'departure_at' | 'arrival_at'>): DbSailing {
  return {
    vessel_id: VESSEL_XPRS,
    route: 'TLLA-HEL',
    delayed_departure_at: null,
    delayed_arrival_at: null,
    status: 'ZAPLANOWANY',
    source: 'VIKING',
    source_ref: null,
    ...partial,
  };
}

function memStore(seed: DbSailing[] = []): Mem {
  const sailings = [...seed];
  const resolved: string[] = [];
  const risks: string[] = [];
  const loadCounts = new Map<string, number>();
  const store: Mem = {
    sailings,
    resolved,
    risks,
    setLoads(id, n) { loadCounts.set(id, n); },
    async projectId() { return 'proj'; },
    async vessels() { return vessels; },
    async sailingsSince() { return sailings; },
    async insertSailings(rows) {
      for (const r of rows) {
        sailings.push({
          id: `ins-${sailings.length}`,
          vessel_id: r.vessel_id,
          route: r.route,
          departure_at: r.departure_at,
          arrival_at: r.arrival_at,
          delayed_departure_at: r.delayed_departure_at,
          delayed_arrival_at: r.delayed_arrival_at,
          status: r.status,
          source: r.source,
          source_ref: r.source_ref ?? null,
        });
      }
    },
    async updateSailing(id, patch) {
      const s = sailings.find((x) => x.id === id);
      if (!s || s.source === 'RECZNIE') return false;
      Object.assign(s, patch);
      return true;
    },
    async sailingAssignedLoadCount(id) { return loadCounts.get(id) ?? 0; },
    async deleteSailing(id) {
      const ix = sailings.findIndex((x) => x.id === id && x.source !== 'RECZNIE');
      if (ix < 0) return false;
      sailings.splice(ix, 1);
      return true;
    },
    async raiseRisk(r) {
      risks.push(r.dedup);
      return true;
    },
    async resolveRisks(prefix) {
      resolved.push(prefix);
      return 1;
    },
  };
  return store;
}

function deps(store: Mem, now = new Date('2026-10-31T12:00:00.000Z')): VikingFileImportDeps {
  return { store, now: () => now };
}

describe('#685-b applyVikingFileSchedule', () => {
  it('fixture Cargo (encje &#x2013;, li.accordion) → preview ≥30 d', () => {
    expect(VIKING_CARGO_HTML).toMatch(/&#x2013;/);
    expect(VIKING_CARGO_HTML).toMatch(/<li class="c-accordion__item"/);
    const parsed = parseVikingTimetableHtml(VIKING_CARGO_HTML, {
      fromYmd: '2026-10-30',
      days: 60,
    });
    expect(parsed.sailings.length).toBeGreaterThan(10);
    const p = previewVikingFileSailings(parsed.sailings);
    expect(p.sailingCount).toBe(parsed.sailings.length);
    expect(p.horizonDays).toBeGreaterThanOrEqual(VIKING_FILE_COVERAGE_DAYS_CLOSE);
  });

  it('digitraffic bez transportów w ±3 h → delete + insert', async () => {
    const st = memStore([
      sailing({
        id: 'dt-1',
        departure_at: '2026-11-01T10:00:00.000Z',
        arrival_at: '2026-11-01T12:30:00.000Z',
        source_ref: 'digitraffic:portcall:1:TLLA-HEL',
      }),
    ]);
    const r = await applyVikingFileSchedule(deps(st), [{
      route: 'TLLA-HEL',
      vessel: 'M/F Viking XPRS',
      departureUtc: '2026-11-01T10:15:00.000Z',
      arrivalUtc: '2026-11-01T12:45:00.000Z',
    }], { sinceIso: '2026-10-31T00:00:00.000Z' });
    expect(r.removed).toBe(1);
    expect(r.inserted).toBe(1);
    expect(st.sailings.some((s) => s.source_ref?.startsWith('digitraffic:'))).toBe(false);
    expect(Math.abs(Date.parse('2026-11-01T10:00:00.000Z') - Date.parse('2026-11-01T10:15:00.000Z')))
      .toBeLessThanOrEqual(VIKING_FILE_SCHEDULE_WIN_MS);
  });

  it('digitraffic z transportem → przejmij czasy + source_ref null', async () => {
    const st = memStore([
      sailing({
        id: 'dt-2',
        departure_at: '2026-11-01T10:00:00.000Z',
        arrival_at: '2026-11-01T12:30:00.000Z',
        source_ref: 'digitraffic:portcall:2:TLLA-HEL',
      }),
    ]);
    st.setLoads('dt-2', 1);
    const r = await applyVikingFileSchedule(deps(st), [{
      route: 'TLLA-HEL',
      vessel: 'M/F Viking XPRS',
      departureUtc: '2026-11-01T10:20:00.000Z',
      arrivalUtc: '2026-11-01T12:50:00.000Z',
    }], { sinceIso: '2026-10-31T00:00:00.000Z' });
    expect(r.takenOver).toBe(1);
    expect(r.inserted).toBe(0);
    const row = st.sailings.find((s) => s.id === 'dt-2')!;
    expect(row.departure_at).toBe('2026-11-01T10:20:00.000Z');
    expect(row.source_ref).toBeNull();
  });

  it('RECZNIE w ±30 min → nietykalne', async () => {
    const st = memStore([
      sailing({
        id: 'man-1',
        departure_at: '2026-11-01T12:15:00.000Z',
        arrival_at: '2026-11-01T14:45:00.000Z',
        source: 'RECZNIE',
      }),
    ]);
    const r = await applyVikingFileSchedule(deps(st), [{
      route: 'TLLA-HEL',
      vessel: 'M/F Viking XPRS',
      departureUtc: '2026-11-01T12:40:00.000Z',
      arrivalUtc: '2026-11-01T15:10:00.000Z',
    }], { sinceIso: '2026-10-31T00:00:00.000Z' });
    expect(r.manualKept).toBe(1);
    expect(r.inserted).toBe(0);
    expect(st.sailings).toHaveLength(1);
    expect(st.sailings[0]!.source).toBe('RECZNIE');
  });

  it('#685-c / B5: pokrycie od teraz ≥ 30 d → resolve SOURCE_DOWN', async () => {
    const st = memStore();
    const now = new Date('2026-10-31T12:00:00.000Z');
    const r = await applyVikingFileSchedule(deps(st, now), [
      {
        route: 'HELA-TLL',
        vessel: 'M/F Viking XPRS',
        departureUtc: '2026-11-01T08:30:00.000Z',
        arrivalUtc: '2026-11-01T11:10:00.000Z',
      },
      {
        route: 'HELA-TLL',
        vessel: 'M/F Viking XPRS',
        departureUtc: '2026-12-05T08:30:00.000Z',
        arrivalUtc: '2026-12-05T11:10:00.000Z',
      },
    ], { sinceIso: '2026-10-31T00:00:00.000Z', now });
    expect(r.horizonDays).toBeGreaterThanOrEqual(VIKING_FILE_COVERAGE_DAYS_CLOSE);
    expect(r.sourceDownClosed).toBe(true);
    expect(st.resolved).toContain('SOURCE_DOWN:VIKING_SCHEDULE:');
    expect(vikingScheduleCoverageDaysFromNow(st.sailings, now.getTime()))
      .toBeGreaterThanOrEqual(VIKING_FILE_COVERAGE_DAYS_CLOSE);
  });

  it('isDigitrafficSourceRef / isVikingFileTouchCandidate', () => {
    expect(isDigitrafficSourceRef('digitraffic:portcall:1:TLLA-HEL')).toBe(true);
    expect(isDigitrafficSourceRef(null)).toBe(false);
    const now = Date.parse('2026-10-31T12:00:00.000Z');
    expect(isVikingFileTouchCandidate(sailing({
      id: 'a', departure_at: '2026-11-01T10:00:00.000Z', arrival_at: '2026-11-01T12:00:00.000Z',
    }), now)).toBe(true);
    expect(isVikingFileTouchCandidate(sailing({
      id: 'b', departure_at: '2026-11-01T10:00:00.000Z', arrival_at: '2026-11-01T12:00:00.000Z',
      status: 'ODWOLANY',
    }), now)).toBe(false);
    expect(isVikingFileTouchCandidate(sailing({
      id: 'c', departure_at: '2026-10-30T10:00:00.000Z', arrival_at: '2026-10-30T12:00:00.000Z',
    }), now)).toBe(false);
  });

  it('F7 B2: ODWOLANY w ±3 h → bez insert / bez kasowania', async () => {
    const st = memStore([
      sailing({
        id: 'odw',
        departure_at: '2026-11-01T10:00:00.000Z',
        arrival_at: '2026-11-01T12:30:00.000Z',
        status: 'ODWOLANY',
        source_ref: 'digitraffic:portcall:9:TLLA-HEL',
      }),
    ]);
    const r = await applyVikingFileSchedule(deps(st), [{
      route: 'TLLA-HEL',
      vessel: 'M/F Viking XPRS',
      departureUtc: '2026-11-01T10:30:00.000Z',
      arrivalUtc: '2026-11-01T13:00:00.000Z',
    }], { sinceIso: '2026-10-31T00:00:00.000Z' });
    expect(r.inserted).toBe(0);
    expect(r.removed).toBe(0);
    expect(st.sailings).toHaveLength(1);
    expect(st.sailings[0]!.status).toBe('ODWOLANY');
    expect(r.warnings.some((w) => /nietykalny/i.test(w))).toBe(true);
  });

  it('F7 B3: W_REJSIE z transportem → bez przejęcia', async () => {
    const st = memStore([
      sailing({
        id: 'wr',
        departure_at: '2026-11-01T10:00:00.000Z',
        arrival_at: '2026-11-01T12:30:00.000Z',
        status: 'W_REJSIE',
        source_ref: 'digitraffic:portcall:8:TLLA-HEL',
      }),
    ]);
    st.setLoads('wr', 1);
    const r = await applyVikingFileSchedule(deps(st), [{
      route: 'TLLA-HEL',
      vessel: 'M/F Viking XPRS',
      departureUtc: '2026-11-01T10:20:00.000Z',
      arrivalUtc: '2026-11-01T12:50:00.000Z',
    }], { sinceIso: '2026-10-31T00:00:00.000Z' });
    expect(r.takenOver).toBe(0);
    expect(r.inserted).toBe(0);
    expect(st.sailings[0]!.departure_at).toBe('2026-11-01T10:00:00.000Z');
  });

  it('F7 B4: sezon — stary VIKING bez transportu → usuń; z transportem → ryzyko', async () => {
    const now = new Date('2026-10-31T12:00:00.000Z');
    const st = memStore([
      sailing({
        id: 'old-free',
        departure_at: '2026-11-01T10:00:00.000Z',
        arrival_at: '2026-11-01T12:30:00.000Z',
      }),
      sailing({
        id: 'old-load',
        departure_at: '2026-11-01T14:00:00.000Z',
        arrival_at: '2026-11-01T16:30:00.000Z',
      }),
    ]);
    st.setLoads('old-load', 1);
    /* Nowy plik: tylko 12:00 — stare 10:00 i 14:00 poza ±30 min. */
    const r = await applyVikingFileSchedule(deps(st, now), [{
      route: 'TLLA-HEL',
      vessel: 'M/F Viking XPRS',
      departureUtc: '2026-11-01T12:00:00.000Z',
      arrivalUtc: '2026-11-01T14:30:00.000Z',
    }], { sinceIso: '2026-10-31T00:00:00.000Z', now });
    expect(st.sailings.some((s) => s.id === 'old-free')).toBe(false);
    expect(st.sailings.some((s) => s.id === 'old-load')).toBe(true);
    expect(st.risks.some((d) => d.startsWith('VIKING_FILE_MISSING:'))).toBe(true);
    expect(r.risks).toBeGreaterThanOrEqual(1);
  });

  it('F7 B6: granica 2,5 h / 3,5 h; inna trasa / inny statek; 29/30 d', async () => {
    const now = new Date('2026-10-31T12:00:00.000Z');
    const winOk = memStore([
      sailing({
        id: 'dt-25',
        departure_at: '2026-11-01T10:00:00.000Z',
        arrival_at: '2026-11-01T12:00:00.000Z',
        source_ref: 'digitraffic:portcall:25:TLLA-HEL',
      }),
    ]);
    const rOk = await applyVikingFileSchedule(deps(winOk, now), [{
      route: 'TLLA-HEL',
      vessel: 'M/F Viking XPRS',
      departureUtc: '2026-11-01T12:30:00.000Z',
      arrivalUtc: '2026-11-01T14:30:00.000Z',
    }], { sinceIso: '2026-10-31T00:00:00.000Z', now });
    expect(rOk.removed).toBe(1);

    const winNo = memStore([
      sailing({
        id: 'dt-35',
        departure_at: '2026-11-01T10:00:00.000Z',
        arrival_at: '2026-11-01T12:00:00.000Z',
        source_ref: 'digitraffic:portcall:35:TLLA-HEL',
      }),
    ]);
    const rNo = await applyVikingFileSchedule(deps(winNo, now), [{
      route: 'TLLA-HEL',
      vessel: 'M/F Viking XPRS',
      departureUtc: '2026-11-01T13:30:00.000Z',
      arrivalUtc: '2026-11-01T15:30:00.000Z',
    }], { sinceIso: '2026-10-31T00:00:00.000Z', now });
    expect(rNo.removed).toBe(0);
    expect(winNo.sailings.some((s) => s.id === 'dt-35')).toBe(true);

    const otherRoute = memStore([
      sailing({
        id: 'dt-rt',
        route: 'HELA-TLL',
        departure_at: '2026-11-01T10:00:00.000Z',
        arrival_at: '2026-11-01T12:00:00.000Z',
        source_ref: 'digitraffic:portcall:rt:HELA-TLL',
      }),
    ]);
    const rRt = await applyVikingFileSchedule(deps(otherRoute, now), [{
      route: 'TLLA-HEL',
      vessel: 'M/F Viking XPRS',
      departureUtc: '2026-11-01T10:15:00.000Z',
      arrivalUtc: '2026-11-01T12:15:00.000Z',
    }], { sinceIso: '2026-10-31T00:00:00.000Z', now });
    expect(rRt.removed).toBe(0);
    expect(otherRoute.sailings.some((s) => s.id === 'dt-rt')).toBe(true);

    const otherShip = memStore([
      sailing({
        id: 'dt-sh',
        vessel_id: VESSEL_CIND,
        departure_at: '2026-11-01T10:00:00.000Z',
        arrival_at: '2026-11-01T12:00:00.000Z',
        source_ref: 'digitraffic:portcall:sh:TLLA-HEL',
      }),
    ]);
    const rSh = await applyVikingFileSchedule(deps(otherShip, now), [{
      route: 'TLLA-HEL',
      vessel: 'M/F Viking XPRS',
      departureUtc: '2026-11-01T10:15:00.000Z',
      arrivalUtc: '2026-11-01T12:15:00.000Z',
    }], { sinceIso: '2026-10-31T00:00:00.000Z', now });
    expect(rSh.removed).toBe(0);

    const cov29 = vikingScheduleCoverageDaysFromNow([
      sailing({
        id: 'c29',
        departure_at: '2026-11-29T12:00:00.000Z',
        arrival_at: '2026-11-29T14:00:00.000Z',
      }),
    ], now.getTime());
    expect(cov29).toBe(29);
    expect(cov29 < VIKING_FILE_COVERAGE_DAYS_CLOSE).toBe(true);
    const cov30 = vikingScheduleCoverageDaysFromNow([
      sailing({
        id: 'c30',
        departure_at: '2026-11-30T12:00:00.000Z',
        arrival_at: '2026-11-30T14:00:00.000Z',
      }),
    ], now.getTime());
    expect(cov30).toBe(30);
    expect(cov30 >= VIKING_FILE_COVERAGE_DAYS_CLOSE).toBe(true);
  });

  it('idempotencja: drugi apply bez nowych insertów', async () => {
    const now = new Date('2026-10-31T12:00:00.000Z');
    const inc = [{
      route: 'TLLA-HEL' as const,
      vessel: 'M/F Viking XPRS',
      departureUtc: '2026-11-02T10:00:00.000Z',
      arrivalUtc: '2026-11-02T12:30:00.000Z',
    }];
    const st = memStore();
    const r1 = await applyVikingFileSchedule(deps(st, now), inc, {
      sinceIso: '2026-10-31T00:00:00.000Z', now,
    });
    expect(r1.inserted).toBe(1);
    const n = st.sailings.length;
    const r2 = await applyVikingFileSchedule(deps(st, now), inc, {
      sinceIso: '2026-10-31T00:00:00.000Z', now,
    });
    expect(r2.inserted).toBe(0);
    expect(st.sailings).toHaveLength(n);
  });
});
