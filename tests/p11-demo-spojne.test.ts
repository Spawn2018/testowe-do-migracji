/**
 * P11 pkt 7 partia 5 — dane demo spójne (POROWNANIE P11-zgodnosc, „Dane demo”):
 *  - panel › Ceny: fracht + opłata paliwowa + dopłaty = „Razem”, opłata paliwowa = fracht × (mnożnik − 1);
 *  - etap „Zafakturowane” strony = transport na fakturze tej strony na stronie Faktury.
 */
import { describe, expect, it } from 'vitest';
import { buildDemoSnapshot } from '../src/data/demoProvider';
import { sefsForLoadDate } from '../src/lib/sefs';

describe('P11 pkt 7 partia 5 — dane demo spójne', () => {
  const snap = buildDemoSnapshot();

  it('panel › Ceny: wiersze sumują się do „Razem”, opłata paliwowa z mnożnika tygodnia załadunku', () => {
    expect(snap.loads.length).toBeGreaterThan(60);
    for (const l of snap.loads) {
      const p = l.pricing;
      const m = sefsForLoadDate(l.plannedLoadDate).appliedMult;
      expect(Math.abs(p.costBase + p.costSefs + p.costExtras - p.costTotal), `${l.code} koszt`).toBeLessThan(0.006);
      expect(Math.abs(p.revBase + p.revSefs + p.revExtras - p.revTotal), `${l.code} przychód`).toBeLessThan(0.006);
      expect(Math.abs(p.costSefs - p.costBase * (m - 1)), `${l.code} paliwo koszt`).toBeLessThan(0.011);
      expect(Math.abs(p.revSefs - p.revBase * (m - 1)), `${l.code} paliwo przychód`).toBeLessThan(0.011);
      expect(Math.abs(p.revTotal - p.costTotal - p.margin), `${l.code} marża`).toBeLessThan(0.006);
    }
  });

  it('transporty „poniżej progu” mają marżę ok. 3 % (poniżej progu 4 %) z tych samych wierszy', () => {
    const below = snap.loads.filter((l) => ['SG-15', 'SG-22', 'SS-02', 'SG-08'].includes(l.code));
    expect(below.length).toBe(4);
    for (const l of below) {
      expect(l.pricing.belowThreshold, l.code).toBe(true);
      expect(l.pricing.marginPct, l.code).toBeGreaterThan(0.025);
      expect(l.pricing.marginPct, l.code).toBeLessThan(0.035);
    }
  });

  it('etap „Zafakturowane” strony = transport na fakturze tej strony (Faktury)', () => {
    const on = (id: string, dir: 'KOSZT' | 'PRZYCHOD') => snap.bills.some((b) => b.direction === dir && b.lines.some((x) => x.loadId === id));
    expect(snap.bills.some((b) => b.direction === 'PRZYCHOD')).toBe(true);
    expect(snap.bills.some((b) => b.direction === 'KOSZT')).toBe(true);
    let both = 0;
    for (const l of snap.loads) {
      const m = l.pricing.money;
      expect(m?.cost.tier === 'FAKTURA', `${l.code} koszt`).toBe(on(l.id, 'KOSZT'));
      expect(m?.rev.tier === 'FAKTURA', `${l.code} przychód`).toBe(on(l.id, 'PRZYCHOD'));
      if (on(l.id, 'KOSZT') && on(l.id, 'PRZYCHOD')) { both++; expect(m?.tier, l.code).toBe('FAKTURA'); }
    }
    expect(both).toBeGreaterThan(0);
  });
});
