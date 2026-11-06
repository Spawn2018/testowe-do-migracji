/**
 * @vitest-environment jsdom
 * DP-228 / F7 #841: odrzucenie nowego pobrania HERE przy zachowanej starej linii
 * — mapa rysuje (geom_ok=true), Stan systemu partial (geom_reject).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkRoads } from '../src/components/map/applyBasemap.ts';
import { withHereRoadsRejects } from '../src/lib/hereRoadsStatus';
import { liveSourceRows, type RunRow } from '../src/auth/LiveStatus';

const NOW = '2026-11-06T18:00:00.000Z';
const run = (job: string, minAgo: number, ok = true): RunRow => ({
  job,
  ok,
  ran_at: new Date(Date.parse(NOW) - minAgo * 60_000).toISOString(),
});

function shortLine(): [number, number][] {
  return [
    [56.16, 15.63],
    [58.5, 16.2],
    [60.7, 17.1],
    [65.8, 21.76],
  ];
}

describe('DP-228 checkRoads — stara linia + odrzut', () => {
  it('geom_ok=true + geom_reject → accepted i rejected', () => {
    const line = shortLine();
    const { accepted, rejected } = checkRoads([
      {
        leg: 'SE-KAA',
        points: line,
        spec: 'loose',
        geom_ok: true,
        geom_reject: 'odrzut — odchyłka od SE_E22',
        summary: 'odrzut — odchyłka od SE_E22',
      },
    ]);
    expect(accepted).toHaveLength(1);
    expect(accepted[0]!.length).toBe(line.length);
    expect(rejected).toEqual([{ leg: 'SE-KAA', why: 'odrzut — odchyłka od SE_E22' }]);
  });

  it('geom_ok=true bez geom_reject → tylko accepted', () => {
    const { accepted, rejected } = checkRoads([
      {
        leg: 'SE-KAA',
        points: shortLine(),
        spec: 'loose',
        geom_ok: true,
        summary: 'OK',
      },
    ]);
    expect(accepted).toHaveLength(1);
    expect(rejected).toEqual([]);
  });

  it('withHereRoadsRejects → partial w Stanie systemu', () => {
    const base = liveSourceRows('pl', [run('here-roads', 30)], [], [], NOW);
    const { rejected } = checkRoads([
      {
        leg: 'SE-KAA',
        points: shortLine(),
        spec: 'loose',
        geom_ok: true,
        geom_reject: 'HTTP 429',
        summary: 'Trasa — HTTP 429',
      },
    ]);
    const out = withHereRoadsRejects(base, rejected);
    const row = out.find((r) => r.id === 'here-roads')!;
    expect(row.state).toBe('partial');
    expect(row.why).toContain('SE-KAA: HTTP 429');
  });

  it('migracja 0425: here_store_road null → geom_reject; wersja liczy reject', () => {
    const sql = readFileSync(
      resolve(__dirname, '../supabase/migrations/0425_dp228_here_reject_keep_line.sql'),
      'utf8',
    );
    expect(sql).toMatch(/DP-228/);
    expect(sql).toMatch(/geom_reject = excluded\.geom_reject/);
    expect(sql).toMatch(/coalesce\(g\.geom_reject, ''\)/);
  });
});
