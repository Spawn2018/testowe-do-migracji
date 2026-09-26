/** G4 (odłożone z M8) — oznaczenie poziomu i kursu tymczasowego przy sumach kokpitu. */
import { describe, expect, it } from 'vitest';
import { buildDemoSnapshot } from '../src/data/demoProvider';
import { aggregateTier, moneyViewFor, tierSummary } from '../src/lib/money/loadMoney';

const snap = buildDemoSnapshot();

describe('G4 aggregateTier (kokpit)', () => {
  it('poziom sumy = najmniej pewny składnik; liczba kursów tymczasowych = tierSummary', () => {
    for (const role of ['HHL', 'KSH', 'SCX'] as const) {
      const agg = aggregateTier(snap.loads, role);
      const sum = tierSummary(snap.loads, role);
      expect(agg.provisional).toBe(sum.provisional);
      const expected = sum.counts.PROGNOZA ? 'PROGNOZA' : sum.counts.REALIZACJA ? 'REALIZACJA' : 'FAKTURA';
      expect(agg.tier).toBe(expected);
    }
  });
  it('jeden transport → jego poziom; pusta lista → brak oznaczenia', () => {
    const l = snap.loads.find((x) => x.pricing?.money?.v === 2)!;
    expect(aggregateTier([l], 'HHL').tier).toBe(moneyViewFor('HHL', l.pricing.money!).tier);
    expect(aggregateTier([], 'HHL')).toEqual({ tier: null, provisional: 0, count: 0 });
  });
  it('transport z moneyError nie wchodzi do oznaczenia (jest na liście wyjątków)', () => {
    const l = snap.loads.find((x) => x.pricing?.money?.v === 2)!;
    const bad = { ...l, pricing: { ...l.pricing, moneyError: 'x' } };
    expect(aggregateTier([bad], 'HHL').count).toBe(0);
  });
});
