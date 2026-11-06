/**
 * DP-22 (#667 F7 r1 N5 / r2): Stan systemu — ostrzeżenie z `summary` odrzuconego legu
 * (checkRoads → withHereRoadsRejects), nie tylko „points not null”.
 */
import { describe, expect, it } from 'vitest';
import { LIVE_SOURCES, liveSourceRows, type RunRow } from '../src/auth/LiveStatus';
import { roadsRejectDetail, withHereRoadsRejects } from '../src/lib/hereRoadsStatus';

const NOW = '2026-11-06T10:00:00.000Z';
const run = (job: string, minAgo: number, ok = true): RunRow => ({
  job,
  ok,
  ran_at: new Date(Date.parse(NOW) - minAgo * 60_000).toISOString(),
});

describe('DP-22 HERE roads w Stanie systemu', () => {
  it('LIVE_SOURCES ma here-roads (job here-roads, próg 26 h)', () => {
    const s = LIVE_SOURCES.find((x) => x.id === 'here-roads');
    expect(s).toMatchObject({ jobs: ['here-roads'], maxMin: 26 * 60 });
  });

  it('liveSourceRows buduje wiersz here-roads', () => {
    const rows = liveSourceRows('pl', [run('here-roads', 30)], [], [], NOW);
    const row = rows.find((r) => r.id === 'here-roads')!;
    expect(row.name).toMatch(/HERE|tras/i);
    expect(row.state).toBe('ok');
  });

  it('roadsRejectDetail składa summary legów (jak checkRoads.rejected)', () => {
    expect(roadsRejectDetail([
      { leg: 'SE-KAA', why: 'odchyłka od SE_E22 — retry 24 h' },
    ])).toBe('SE-KAA: odchyłka od SE_E22 — retry 24 h');
  });

  it('withHereRoadsRejects → partial + why = summary legów', () => {
    const base = liveSourceRows('pl', [run('here-roads', 30)], [], [], NOW);
    const out = withHereRoadsRejects(base, [
      { leg: 'SE-KAA', why: 'odchyłka od SE_E22' },
      { leg: 'FI-HEL', why: 'HTTP 429' },
    ]);
    const row = out.find((r) => r.id === 'here-roads')!;
    expect(row.state).toBe('partial');
    expect(row.why).toContain('SE-KAA: odchyłka od SE_E22');
    expect(row.why).toContain('FI-HEL: HTTP 429');
  });

  it('withHereRoadsRejects przy down zostawia down i dopina summary', () => {
    const base = liveSourceRows('pl', [run('here-roads', 5, false)], [], [], NOW);
    const row0 = base.find((r) => r.id === 'here-roads')!;
    expect(row0.state).toBe('down');
    const out = withHereRoadsRejects(base, [{ leg: 'SE-KAA', why: 'odchyłka' }]);
    const row = out.find((r) => r.id === 'here-roads')!;
    expect(row.state).toBe('down');
    expect(row.why).toContain('odchyłka');
  });
});
