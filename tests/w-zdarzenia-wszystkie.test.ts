/** 22.10.2026 (właściciel 21:38): oś Status zafakturowanych (SG-03) bez statusów — zrzut brał 500 najnowszych zdarzeń projektu. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildStatusAxis } from '../src/lib/statusAxis';
import type { LoadEvent } from '../src/types';

describe('zdarzenia transportu — wszystkie, nie 500 najnowszych', () => {
  it('provider czyta load_events stronami po 1000 bez stałego limitu 500', () => {
    const src = readFileSync('src/data/supabaseProvider.ts', 'utf8');
    expect(src).not.toContain('.limit(opts.eventLimit ?? 500)');
    expect(src).toContain('fetchAllEvents()');
    expect(src).toContain('.range(from, to)');
    expect(src).toContain("const cap = opts.eventLimit ?? Infinity;");
  });

  it('SG-03: statusy z GPS z października zostają na osi przy statusie Zafakturowany', () => {
    const ev = (id: number, type: string, at: string, payload: Record<string, unknown>) =>
      ({ id: `ev-${id}`, loadId: 'L', type, at, actor: null, note: null, payload } as unknown as LoadEvent);
    const events = [
      ev(1, 'STATUS_READY', '2026-10-05T09:10:20Z', { note: 'Zasoby uzupełnione', actor: 'HHL' }),
      ev(2, 'STATUS_AUTO', '2026-10-05T11:21:38Z', { to: 'IN_TRANSIT_SE', from: 'READY', lat: 62.5, lon: 17.6, zrodlo: 'TELM_PHASE_INFER' }),
      ev(3, 'STATUS_AUTO', '2026-10-07T06:35:47Z', { to: 'AT_SITE', from: 'IN_TRANSIT_SE', geofence_id: 'g' }),
      ev(4, 'STATUS_UNLOADING', '2026-10-14T01:25:52Z', { note: 'Rozładowano' }),
      ev(5, 'STATUS_AUTO', '2026-10-21T12:38:16Z', { to: 'READY_TO_INVOICE', from: 'DELIVERED', source: 'DOC' }),
      ev(6, 'STATUS_AUTO', '2026-10-22T09:21:36Z', { to: 'INVOICED', from: 'READY_TO_INVOICE', source: 'INVOICE' }),
    ];
    const axis = buildStatusAxis({ status: 'INVOICED', stage: 'DELIVERED', unloadedAt: null } as never, events);
    const route = axis.groups.find((g) => g.key === 'route')!;
    const done = route.rows.filter((r) => r.kind === 'done').flatMap((r) => r.statuses);
    expect(done).toEqual(['IN_TRANSIT_SE', 'APPROACHING_SITE', 'DELIVERED']);
  });
});
