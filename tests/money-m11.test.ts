/** M11 — rozbicie marży w Finansach: zafakturowana + zrealizowana niezafakturowana + prognozowana = marża łączna. */
import { describe, expect, it } from 'vitest';
import { buildDemoSnapshot } from '../src/data/demoProvider';
import { applyInvoiceToSide, loadMarginV2, marginSplit, marginV2 } from '../src/lib/money/loadMoney';
import type { Load } from '../src/types';

const r2 = (n: number) => Math.round(n * 100) / 100;
const snap = buildDemoSnapshot();

describe('M11 rozbicie marży (totalsByTier)', () => {
  it('seed demo: suma trzech wierszy = marża łączna (EUR i PLN), wszystkie 72 transporty w sumie', () => {
    const s = marginSplit(snap.loads);
    const t = s.tiers;
    expect(s.total.count).toBe(snap.loads.length);
    expect(t.FAKTURA.count + t.REALIZACJA.count + t.PROGNOZA.count).toBe(s.total.count);
    expect(r2(t.FAKTURA.marginEur + t.REALIZACJA.marginEur + t.PROGNOZA.marginEur)).toBe(s.total.marginEur);
    expect(r2(t.FAKTURA.marginPln + t.REALIZACJA.marginPln + t.PROGNOZA.marginPln)).toBe(s.total.marginPln);
    expect(t.PROGNOZA.count).toBeGreaterThan(0);
    expect(t.REALIZACJA.count).toBeGreaterThan(0);
  });

  it('marża łączna = suma marż transportów liczona niezależnie (marginV2)', () => {
    const direct = r2(snap.loads.reduce((a, l) => a + (l.pricing.money?.v === 2 ? marginV2(l.pricing.money).marginEur : 0), 0));
    expect(marginSplit(snap.loads).total.marginEur).toBe(direct);
  });

  it('faktura przesuwa marżę do wiersza „zafakturowana” — suma się nie rozjeżdża', () => {
    const l = snap.loads.find((x) => x.pricing.money?.tier === 'REALIZACJA')!;
    const m = l.pricing.money!;
    const inv: Load = { ...l, pricing: { ...l.pricing, money: { ...m, tier: 'FAKTURA', cost: applyInvoiceToSide(m.cost, m.cost.computedEur + 10), rev: applyInvoiceToSide(m.rev, m.rev.computedEur) } } };
    const s = marginSplit([inv]);
    expect(s.tiers.FAKTURA).toMatchObject({ count: 1, marginEur: r2(marginV2(m).marginEur - 10) });
    expect(s.tiers.REALIZACJA.count).toBe(0);
    expect(s.total.marginEur).toBe(s.tiers.FAKTURA.marginEur);
  });

  it('PLN per transport, każda strona swoim kursem NBP (nie kursem demo), zaokrąglenie per transport', () => {
    const m = snap.loads[0].pricing.money!;
    const lm = loadMarginV2(m);
    expect(lm.pln.revenue).toBe(r2(r2(m.rev.invoicedEur ?? m.rev.computedEur) * m.rev.fx.mid));
    expect(lm.pln.margin).toBe(r2(lm.pln.revenue - lm.pln.cost));
  });

  it('transport z przerwanym wyliczeniem (moneyError) poza sumą, liczony w skipped', () => {
    const bad: Load = { ...snap.loads[1], pricing: { ...snap.loads[1].pricing, moneyError: 'Różne mnożniki paliwowe' } };
    const s = marginSplit([snap.loads[0], bad]);
    expect(s.total.count).toBe(1);
    expect(s.skipped).toBe(1);
  });
});
