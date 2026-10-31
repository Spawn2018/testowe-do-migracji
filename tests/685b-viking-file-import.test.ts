/**
 * #685-b / decyzja 63b+74 + #685-c — applyVikingFileSchedule (≠ applySailings).
 * ±3 h digitraffic delete/adopt; RECZNIE nietykalne; ≥30 d → SOURCE_DOWN.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseVikingTimetableHtml } from '../supabase/functions/_shared/ferry/vikingline.ts';
import {
  applyVikingFileSchedule,
  previewVikingFileSailings,
  isDigitrafficSourceRef,
  VIKING_FILE_COVERAGE_DAYS_CLOSE,
  VIKING_FILE_SCHEDULE_WIN_MS,
  type VikingFileImportDeps,
  type VikingFileImportStore,
} from '../supabase/functions/_shared/ferry/vikingFileImport.ts';
import type { DbSailing, VesselRow } from '../supabase/functions/_shared/integrations/sync.ts';

const VIKING_CARGO_HTML = readFileSync(
  new URL('./fixtures/viking-cargo-helsinki-tallinn-sample.html', import.meta.url),
  'utf8',
);

const VESSEL_XPRS = 'ves-xprs';
const vessels: VesselRow[] = [
  { id: VESSEL_XPRS, name: 'M/F Viking XPRS', mmsi: 230705000 },
];

type Mem = VikingFileImportStore & {
  sailings: DbSailing[];
  resolved: string[];
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
  const loadCounts = new Map<string, number>();
  const store: Mem = {
    sailings,
    resolved,
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
    async raiseRisk() { return true; },
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
  it('fixture Cargo → preview ≥30 d', () => {
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

  it('#685-c: horyzont ≥ 30 d → resolve SOURCE_DOWN', async () => {
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
  });

  it('isDigitrafficSourceRef', () => {
    expect(isDigitrafficSourceRef('digitraffic:portcall:1:TLLA-HEL')).toBe(true);
    expect(isDigitrafficSourceRef(null)).toBe(false);
  });
});
