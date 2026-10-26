/** 25.10 — karta „Kurs NBP” w Finansach: aktualny kurs z `fx_rates`, nie najnowszy zapisany przy transporcie. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nbpFromRow } from '../src/lib/nbpLive';
import { financeOf } from '../src/lib/p5Source';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

describe('Kurs NBP — aktualny', () => {
  it('wiersz fx_rates → kurs karty', () => {
    expect(nbpFromRow({ rate_date: '2026-10-23', rate_pln: '4.391700', table_no: '207/A/NBP/2026' }))
      .toEqual({ tableNo: '207/A/NBP/2026', date: '2026-10-23', mid: 4.3917 });
    expect(nbpFromRow(null)).toBeNull();
    expect(nbpFromRow({ rate_date: '2026-10-23', rate_pln: 0, table_no: 'x' })).toBeNull();
  });
  it('financeOf: kurs bieżący wygrywa nad kursem z transportów; bez niego — jak dotąd', () => {
    const live = { tableNo: '207/A/NBP/2026', date: '2026-10-23', mid: 4.3917 };
    expect(financeOf([], 'both', live).nbpLatest).toEqual(live);
    expect(financeOf([], 'both').nbpLatest).toBeNull();
  });
  it('FinanceView czyta kurs z fx_rates', () => {
    const v = read('src/views/FinanceView.tsx');
    expect(v).toMatch(/const nbpLive = useLatestNbp\(\);/);
    expect(v).toMatch(/financeOf\(loads, side, nbpLive\)/);
    /* F7 #564: lista „poniżej progu” liczy PLN tym samym kursem co karta i sumy */
    expect(v).toMatch(/belowOf\(loads, threshold, nbpLive\)/);
    expect(read('src/lib/p5Source.ts')).toMatch(/return belowThreshold\(loads, thresholdPct, live \?\? latestNbp\(loads\)\);/);
    expect(read('src/lib/nbpLive.ts')).toMatch(/from\('fx_rates'\)[\s\S]*eq\('currency', 'EUR'\)[\s\S]*order\('rate_date', \{ ascending: false \}\)/);
  });
});
