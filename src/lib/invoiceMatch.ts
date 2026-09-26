/**
 * D20 — three-way invoice match:
 *   selected (carrier invoice lines) ↔ completed (realized loads) ↔ rate-card expected.
 * Diffs are computed — never hardcoded index bonuses (+1240/+600).
 */
import type { InvoiceLine, Load, LoadStatus } from '../types';
import { matchInvoice } from './pricing';

export const INVOICE_MATCH_THRESHOLD_PLN = 50;

const COMPLETED_STATUSES: ReadonlySet<LoadStatus> = new Set(['DELIVERED', 'UNLOADING']);

export function isLoadCompleted(l: Pick<Load, 'status' | 'stage'>): boolean {
  return (
    COMPLETED_STATUSES.has(l.status) ||
    l.stage === 'DELIVERED' ||
    l.stage === 'SITE'
  );
}

/** Rate-card amount for matching (SCX cost side on the load snapshot). */
export function rateCardExpected(l: Pick<Load, 'pricing'>): number {
  return l.pricing.costTotal;
}

export type ThreeWayVerdict =
  | 'zgodna'
  | 'poza_cennikiem'
  | 'nie_zrealizowano'
  | 'brak_na_fakturze';

export interface ThreeWayLine {
  loadId: string;
  code: string;
  itemType: string;
  deliverDate: string;
  selected: boolean;
  completed: boolean;
  expected: number;
  billed: number;
  diff: number;
  verdict: ThreeWayVerdict;
}

export interface ThreeWayMatchResult {
  lines: ThreeWayLine[];
  expectedTotal: number;
  billedTotal: number;
  diffTotal: number;
  /** Lines that are not `zgodna`. */
  openCount: number;
  threshold: number;
  aggregate: ReturnType<typeof matchInvoice>;
}

function verdictFor(args: {
  selected: boolean;
  completed: boolean;
  diff: number;
  threshold: number;
}): ThreeWayVerdict {
  const { selected, completed, diff, threshold } = args;
  if (selected && completed) {
    return Math.abs(diff) <= threshold ? 'zgodna' : 'poza_cennikiem';
  }
  if (selected && !completed) return 'nie_zrealizowano';
  return 'brak_na_fakturze';
}

/**
 * Build line-by-line three-way match.
 * - `selectedIds`: transporty zaznaczone na fakturze
 * - `billedByLoadId`: kwoty zafakturowane (brak klucza → expected, gdy selected)
 * - completed derived from load status/stage
 */
export function buildThreeWayMatch(opts: {
  loads: readonly Load[];
  selectedIds: readonly string[];
  billedByLoadId?: Record<string, number>;
  threshold?: number;
}): ThreeWayMatchResult {
  const threshold = opts.threshold ?? INVOICE_MATCH_THRESHOLD_PLN;
  const billedMap = opts.billedByLoadId ?? {};
  const byId = new Map(opts.loads.map((l) => [l.id, l]));
  const selectedSet = new Set(opts.selectedIds);

  const completedIds = opts.loads.filter(isLoadCompleted).map((l) => l.id);
  const unionIds = [...new Set([...opts.selectedIds, ...completedIds])];

  const lines: ThreeWayLine[] = unionIds.map((id) => {
    const l = byId.get(id);
    const selected = selectedSet.has(id);
    const completed = l ? isLoadCompleted(l) : false;
    const expected = l ? rateCardExpected(l) : 0;
    const billed = selected ? (billedMap[id] ?? expected) : 0;
    const diff = selected ? billed - expected : completed ? -expected : 0;
    return {
      loadId: id,
      code: l?.code ?? id,
      itemType: l?.itemType ?? '—',
      deliverDate: l?.plannedDeliverDate ?? '—',
      selected,
      completed,
      expected,
      billed,
      diff,
      verdict: verdictFor({ selected, completed, diff, threshold }),
    };
  });

  // Stable: code then id
  lines.sort((a, b) => a.code.localeCompare(b.code, 'pl') || a.loadId.localeCompare(b.loadId));

  const expectedTotal = lines.reduce((s, x) => s + (x.selected || x.completed ? x.expected : 0), 0);
  // For totals: expected = rate card for all lines in union that are selected OR completed
  // billed = only selected lines
  const expectedOnSelected = lines.filter((x) => x.selected).reduce((s, x) => s + x.expected, 0);
  const billedTotal = lines.filter((x) => x.selected).reduce((s, x) => s + x.billed, 0);
  const expectedTotalForAgg = expectedOnSelected;
  const diffTotal = billedTotal - expectedTotalForAgg;
  const openCount = lines.filter((x) => x.verdict !== 'zgodna').length;

  return {
    lines,
    expectedTotal: expectedTotalForAgg,
    billedTotal,
    diffTotal,
    openCount,
    threshold,
    aggregate: matchInvoice(expectedTotalForAgg, billedTotal, threshold),
  };
}

/** Map invoice lines → billedByLoadId for three-way. */
export function billedMapFromInvoiceLines(lines: readonly InvoiceLine[]): Record<string, number> {
  return Object.fromEntries(lines.map((ln) => [ln.loadId, ln.billed]));
}

/** Build InvoiceLine[] from a three-way result (selected lines only). */
export function invoiceLinesFromThreeWay(match: ThreeWayMatchResult): InvoiceLine[] {
  return match.lines
    .filter((l) => l.selected)
    .map((l) => ({
      loadId: l.loadId,
      code: l.code,
      expected: l.expected,
      billed: l.billed,
      diff: l.diff,
    }));
}

const THREE_WAY_LABEL: Record<ThreeWayVerdict, Record<'pl' | 'en' | 'sv', string>> = {
  zgodna: { pl: 'zgodna', en: 'matched', sv: 'stämmer' },
  poza_cennikiem: { pl: 'poza cennikiem', en: 'outside rate card', sv: 'utanför prislistan' },
  nie_zrealizowano: { pl: 'nie zrealizowano', en: 'not delivered', sv: 'ej utfört' },
  brak_na_fakturze: { pl: 'brak na fakturze', en: 'missing on invoice', sv: 'saknas på fakturan' },
};

export function threeWayVerdictLabel(v: ThreeWayVerdict, locale: 'pl' | 'en' | 'sv' = 'pl'): string {
  return THREE_WAY_LABEL[v][locale];
}

export function threeWayVerdictPill(v: ThreeWayVerdict): string {
  if (v === 'zgodna') return 'p-go';
  if (v === 'brak_na_fakturze') return 'p-amber';
  return 'p-red';
}
