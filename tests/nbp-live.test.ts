/**
 * M3 — kurs NBP na żywo. Uruchamiane wyłącznie z NBP_LIVE=1 (CI nie zależy od serwera NBP).
 * Bez flagi: testy przedziału (bez sieci).
 */
import { describe, expect, it } from 'vitest';
import { fxSnapshotForUnload, nbpRangeForDay, nbpRangeUrl } from '../src/lib/money/nbpSync';
import { fetchNbpEurRange } from '../src/lib/money/engine';
import { DEMO_NBP_RATES } from '../src/lib/money/demoFx';

describe('M3 przedział zapytania NBP', () => {
  it('zawsze przedział [dzień − 14, dzień − 1], nigdy pojedynczy dzień', () => {
    expect(nbpRangeForDay('2025-12-29')).toEqual({ from: '2025-12-15', to: '2025-12-28' });
    expect(nbpRangeUrl('2026-01-02')).toBe('https://api.nbp.pl/api/exchangerates/rates/a/eur/2025-12-19/2026-01-01/?format=json');
  });
});

describe.runIf(process.env.NBP_LIVE === '1')('M3 żywe API NBP', () => {
  it('rozładunek 29.12.2025 → 248/A/NBP/2025 z 23.12', async () => {
    const s = await fxSnapshotForUnload('2025-12-29T10:00:00Z');
    expect(s.rate.no).toBe('248/A/NBP/2025');
    expect(s.rate.effectiveDate).toBe('2025-12-23');
  });
  it('pułapka UTC: 2025-12-29T23:30Z = 30.12 lokalnie → 249/A', async () => {
    const s = await fxSnapshotForUnload('2025-12-29T23:30:00Z');
    expect(s.localDate).toBe('2025-12-30');
    expect(s.rate.no).toBe('249/A/NBP/2025');
  });
  it('2.01.2026 → ostatnia tabela 2025 (31.12), 001/A/NBP/2026 dopiero od 5.01', async () => {
    const a = await fxSnapshotForUnload('2026-01-02T09:00:00Z');
    expect(a.rate.effectiveDate).toBe('2025-12-31');
    const b = await fxSnapshotForUnload('2026-01-05T09:00:00Z');
    expect(b.rate.no).toBe('001/A/NBP/2026');
  });
  it('dane demo (tabele 2026-08/09) zgodne z żywym API', async () => {
    const live = await fetchNbpEurRange('2026-09-10', '2026-09-25');
    for (const r of live) {
      const d = DEMO_NBP_RATES.find((x) => x.effectiveDate === r.effectiveDate);
      expect(d?.no).toBe(r.no);
      expect(d?.mid).toBe(r.mid);
    }
  });
  it('pojedynczy dzień bez publikacji → 404 (dlatego zawsze przedział)', async () => {
    const res = await fetch('https://api.nbp.pl/api/exchangerates/rates/a/eur/2025-12-27/?format=json');
    expect(res.status).toBe(404);
  });
});
