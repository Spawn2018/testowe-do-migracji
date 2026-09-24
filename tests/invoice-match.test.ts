import { describe, expect, it } from 'vitest';
import {
  INVOICE_MATCH_THRESHOLD_PLN,
  billedMapFromInvoiceLines,
  buildThreeWayMatch,
  isLoadCompleted,
  rateCardExpected,
} from '../src/lib/invoiceMatch';
import type { Load } from '../src/types';

function load(
  partial: Partial<Load> & Pick<Load, 'id' | 'code' | 'status' | 'stage'> & { cost: number },
): Load {
  const { cost, ...rest } = partial;
  return {
    itemType: 'Moduł',
    plannedDeliverDate: '2026-09-20',
    pricing: { costTotal: cost } as Load['pricing'],
    ferry: { vessel: null, departureAt: null, arrivalAt: null, bookingRef: null, status: 'NONE' },
    ...rest,
  } as Load;
}

describe('D20 three-way invoice match', () => {
  it('isLoadCompleted covers DELIVERED/UNLOADING and SITE/DELIVERED stages', () => {
    expect(isLoadCompleted({ status: 'DELIVERED', stage: 'DELIVERED' })).toBe(true);
    expect(isLoadCompleted({ status: 'UNLOADING', stage: 'SITE' })).toBe(true);
    expect(isLoadCompleted({ status: 'IN_TRANSIT_SE', stage: 'SE_ROAD' })).toBe(false);
  });

  it('computes line diffs from billed vs rate card — no index hardcodes', () => {
    const loads = [
      load({ id: 'a', code: 'A', status: 'DELIVERED', stage: 'DELIVERED', cost: 10000 }),
      load({ id: 'b', code: 'B', status: 'DELIVERED', stage: 'DELIVERED', cost: 20000 }),
      load({ id: 'c', code: 'C', status: 'DELIVERED', stage: 'DELIVERED', cost: 15000 }),
    ];
    const match = buildThreeWayMatch({
      loads,
      selectedIds: ['a', 'b', 'c'],
      billedByLoadId: { a: 10000, b: 21240, c: 15600 },
    });
    const byId = Object.fromEntries(match.lines.map((l) => [l.loadId, l]));
    expect(byId.a.diff).toBe(0);
    expect(byId.a.verdict).toBe('zgodna');
    expect(byId.b.diff).toBe(1240);
    expect(byId.b.verdict).toBe('poza_cennikiem');
    expect(byId.c.diff).toBe(600);
    expect(byId.c.verdict).toBe('poza_cennikiem');
    expect(match.diffTotal).toBe(1840);
    expect(match.aggregate.status).toBe('DISPUTED');
    expect(match.openCount).toBe(2);
  });

  it('flags selected-not-completed and completed-not-selected', () => {
    const loads = [
      load({ id: 'sel', code: 'S', status: 'IN_TRANSIT_SE', stage: 'SE_ROAD', cost: 5000 }),
      load({ id: 'done', code: 'D', status: 'DELIVERED', stage: 'DELIVERED', cost: 8000 }),
    ];
    const match = buildThreeWayMatch({
      loads,
      selectedIds: ['sel'],
      billedByLoadId: { sel: 5000 },
    });
    const byId = Object.fromEntries(match.lines.map((l) => [l.loadId, l]));
    expect(byId.sel.verdict).toBe('nie_zrealizowano');
    expect(byId.done.verdict).toBe('brak_na_fakturze');
    expect(byId.done.selected).toBe(false);
    expect(byId.done.billed).toBe(0);
  });

  it('within threshold → MATCHED aggregate; rateCardExpected reads costTotal', () => {
    const loads = [
      load({ id: 'x', code: 'X', status: 'DELIVERED', stage: 'DELIVERED', cost: 1000 }),
    ];
    expect(rateCardExpected(loads[0])).toBe(1000);
    const match = buildThreeWayMatch({
      loads,
      selectedIds: ['x'],
      billedByLoadId: { x: 1000 + INVOICE_MATCH_THRESHOLD_PLN },
    });
    expect(match.lines[0].verdict).toBe('zgodna');
    expect(match.aggregate.status).toBe('MATCHED');
    expect(billedMapFromInvoiceLines([{ loadId: 'x', code: 'X', expected: 1, billed: 2, diff: 1 }])).toEqual({
      x: 2,
    });
  });
});
