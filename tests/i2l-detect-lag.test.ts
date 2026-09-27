/** I-2l — kafelek „czas wykrycia odchylenia”: w produkcji z bazy (kpi_detection_lag) albo „—”; nigdy „8 min”. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { detectionLagFromRow } from '../src/lib/detectLag';

describe('I-2l — czas wykrycia z risk_signals', () => {
  it('wiersz RPC → próbki i mediana; 0 próbek → brak mediany (kafelek „—”)', () => {
    expect(detectionLagFromRow({ samples: 3, median_min: 20 })).toEqual({ samples: 3, medianMin: 20 });
    expect(detectionLagFromRow({ samples: 0, median_min: null })).toEqual({ samples: 0, medianMin: null });
    expect(detectionLagFromRow(undefined)).toEqual({ samples: 0, medianMin: null });
    expect(detectionLagFromRow({ samples: 0, median_min: 5 })).toEqual({ samples: 0, medianMin: null });
  });
  it('kokpit: w produkcji wartość z bazy albo „—”; „8 min” wyłącznie w gałęzi demo (shows)', () => {
    const src = readFileSync('src/views/DashboardView.tsx', 'utf8');
    expect(src).toContain("import('../lib/detectLag')");
    expect(src).toContain("`${detectLag.medianMin} min` : '—'");
    const demo = src.indexOf("shows('detectTimeKpi')");
    const eight = src.indexOf('value="8 min"');
    const prodTile = src.indexOf('detectLag.medianMin != null');
    expect(demo).toBeGreaterThan(0);
    expect(eight).toBeGreaterThan(demo);
    expect(prodTile).toBeGreaterThan(eight);
  });
  it('migracja 0055: SECURITY INVOKER (zakres RLS), anon bez EXECUTE, lista dozwolonych', () => {
    const m = readFileSync('supabase/migrations/0055_detection_lag.sql', 'utf8');
    expect(m).toMatch(/kpi_detection_lag[\s\S]*security invoker set search_path = public/);
    expect(m).toContain('revoke all on function public.kpi_detection_lag(uuid, int) from public, anon;');
    expect(readFileSync('tests/db/function-allowlist.txt', 'utf8')).toContain('authenticated kpi_detection_lag');
  });
});
