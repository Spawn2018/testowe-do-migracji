import { describe, expect, it } from 'vitest';
import type { Document, Load } from '../src/types';
import { DEFAULT_DOC_REQUIREMENTS, docDueMs, docStatusRows, docSummary, type DocRequirement } from '../src/lib/docRequirements';

const load = (id: string, extra: Partial<Load> = {}): Load =>
  ({ id, code: id, status: 'PLANNED', plannedLoadDate: '2026-10-05', plannedDeliverDate: '2026-10-08',
     ferry: { vessel: null, departureAt: null, arrivalAt: null, bookingRef: null, status: 'NONE' }, ...extra }) as unknown as Load;
const req = (c: DocRequirement['category']) => DEFAULT_DOC_REQUIREMENTS.find((r) => r.category === c)!;
const doc = (loadId: string, category: Document['category']): Document =>
  ({ id: `${loadId}-${category}`, loadId, category, name: 'x.pdf', uploadedAt: null, deadline: null, status: 'UPLOADED', permitFits: null, visibleTo: [] });

describe('III-6 wymagalność i terminy dokumentów', () => {
  it('terminy liczone od zdarzeń jak w SQL (strefy PL/SE)', () => {
    const l = load('A', { ferry: { vessel: 'Wawel', departureAt: '2026-10-06T16:00:00Z', arrivalAt: null, bookingRef: null, status: 'BOOKED' } });
    // zezwolenie PL: 24 h przed 06:00 czasu PL w dniu załadunku (CEST = UTC+2)
    expect(new Date(docDueMs(l, req('PERMIT_PL'))!).toISOString()).toBe('2026-10-04T04:00:00.000Z');
    // CMR (decyzja 18.10, 17:28 — tylko po rozładunku): 24 h po 23:59 dnia dostawy w Szwecji, jak POD
    expect(new Date(docDueMs(l, req('CMR'))!).toISOString()).toBe('2026-10-09T21:59:00.000Z');
    // zezwolenie SE: 24 h przed promem
    expect(new Date(docDueMs(l, req('PERMIT_SE'))!).toISOString()).toBe('2026-10-05T16:00:00.000Z');
    // POD: 24 h po 23:59 dnia dostawy w Szwecji
    expect(new Date(docDueMs(l, req('POD'))!).toISOString()).toBe('2026-10-09T21:59:00.000Z');
    // okno planu (0061) ma pierwszeństwo przed dniem
    const w = load('B', { planDates: { status: 'POTWIERDZONA', confirmedAt: null, loadFrom: '2026-10-05T08:00:00Z', loadTo: '2026-10-05T10:00:00Z', deliveryFrom: null, deliveryTo: null, preLoading: false } });
    expect(new Date(docDueMs(w, req('PERMIT_PL'))!).toISOString()).toBe('2026-10-04T08:00:00.000Z');
    // CMR po rozładunku: okno załadunku nie wpływa na termin
    expect(new Date(docDueMs(w, req('CMR'))!).toISOString()).toBe('2026-10-09T21:59:00.000Z');
    expect(docDueMs(load('C'), req('PERMIT_SE'))).toBeNull(); // brak rejsu → brak terminu (nie „po terminie”)
  });

  it('stan OK / OVERDUE / MISSING; dokument organizacyjny i kategoria nieobowiązkowa pominięte', () => {
    const now = Date.parse('2026-10-05T12:00:00Z');
    const reqs = DEFAULT_DOC_REQUIREMENTS.map((r) => (r.category === 'DRAWING' ? { ...r, required: false } : r));
    const rows = docStatusRows([load('A'), load('B')], [doc('A', 'PERMIT_PL')], reqs, now);
    const st = (l: string, c: string) => rows.find((r) => r.loadId === l && r.category === c)?.state;
    expect(st('A', 'PERMIT_PL')).toBe('OK');
    expect(st('B', 'PERMIT_PL')).toBe('OVERDUE');
    expect(st('B', 'CMR')).toBe('MISSING'); // termin po rozładunku jeszcze nie minął
    expect(rows.some((r) => r.category === 'INSURANCE' || r.category === 'DRAWING')).toBe(false);
    const s = docSummary(rows).get('PERMIT_PL')!;
    expect(s).toEqual({ ok: 1, overdue: 1, total: 2 });
  });
});
