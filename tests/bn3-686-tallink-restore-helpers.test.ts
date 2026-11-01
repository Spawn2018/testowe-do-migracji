/**
 * BN3 #686 F7 r1 — pure helpers (B1–B3 / pkt 1) bez Edge.
 */
import { describe, expect, it } from 'vitest';
import {
  filterLoadsReassignedFromSailing,
  isTallinkAlertAutoCancel,
  loadIdsFromSailingCancelledDedups,
  restoreStatusAfterCancel,
  sailingCancelledRiskLike,
  tallinkAlertLooksLikeRestore,
} from '../supabase/functions/_shared/ferry/tallinkRestore';
import {
  SAILING_CANCELLED_RISK_MAX_PAGES,
  SAILING_CANCELLED_RISK_PAGE_SIZE,
  fetchSailingCancelledRiskRowsPaged,
} from '../supabase/functions/_shared/integrations/store';

describe('BN3 #686 tallinkRestore helpers', () => {
  it('B1: isTallinkAlertAutoCancel — tylko AUTO + tallink.com', () => {
    expect(isTallinkAlertAutoCancel({
      source: 'AUTO', operator: 'TALLINK', sourceUrl: 'https://www.tallink.com/',
    })).toBe(true);
    expect(isTallinkAlertAutoCancel({
      source: 'AUTO', operator: 'TALLINK', sourceUrl: 'https://www.ts.ee/en/',
    })).toBe(false);
    expect(isTallinkAlertAutoCancel({
      source: 'AUTO', operator: 'TALLINK', sourceUrl: null,
    })).toBe(false);
    expect(isTallinkAlertAutoCancel(null)).toBe(false);
    expect(isTallinkAlertAutoCancel({
      source: 'RECZNIE', operator: 'TALLINK', sourceUrl: 'https://www.tallink.com/',
    })).toBe(false);
  });

  it('B3: sailingCancelledRiskLike filtruje po sailingId (bez pobierania całej puli)', () => {
    const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    expect(sailingCancelledRiskLike(id)).toBe(`SAILING_CANCELLED:%:${id}`);
    expect(sailingCancelledRiskLike('a_b')).toBe('SAILING_CANCELLED:%:a\\_b');
  });

  it('B2: loadIds + filterLoadsReassignedFromSailing (także po zamknięciu ryzyka)', () => {
    const ids = loadIdsFromSailingCancelledDedups([
      { load_id: 'L1', dedup_key: 'SAILING_CANCELLED:L1:s1' },
      { load_id: 'L1', dedup_key: 'SAILING_CANCELLED:L1:s1' },
      { load_id: 'L2', dedup_key: 'SAILING_CANCELLED:L2:s1' },
      { load_id: null, dedup_key: 'SAILING_CANCELLED::s1' },
    ]);
    expect(ids.sort()).toEqual(['L1', 'L2']);
    expect(filterLoadsReassignedFromSailing(
      ids,
      [
        { id: 'L1', sailing_id: 's-other' },
        { id: 'L2', sailing_id: 's1' },
      ],
      's1',
    )).toEqual(['L1']);
  });

  it('pkt 1: restoreStatusAfterCancel — delayed_* → OPOZNIONY', () => {
    expect(restoreStatusAfterCancel({
      delayed_departure_at: null, delayed_arrival_at: null,
    })).toBe('ZAPLANOWANY');
    expect(restoreStatusAfterCancel({
      delayed_departure_at: '2026-11-02T15:00:00.000Z', delayed_arrival_at: null,
    })).toBe('OPOZNIONY');
  });

  it('pkt 5: tallinkAlertLooksLikeRestore — bez „will not operate”', () => {
    expect(tallinkAlertLooksLikeRestore(
      'Correction: the departure will operate as planned.',
    )).toBe(true);
    expect(tallinkAlertLooksLikeRestore(
      'The MyStar will not operate as planned.',
    )).toBe(false);
  });

  it('B3: fetchSailingCancelledRiskRowsPaged — filtr like + page cap', async () => {
    const sid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const likeWant = sailingCancelledRiskLike(sid);
    const rows = Array.from({ length: 3 }, (_, i) => ({
      id: `r${i}`, load_id: `L${i}`, dedup_key: `SAILING_CANCELLED:L${i}:${sid}`,
    }));
    let likeArg = '';
    const fromTable = () => {
      const api = {
        select() { return api; },
        like(_c: string, v: string) { likeArg = v; return api; },
        is() { return api; },
        order() { return api; },
        async range(from: number, to: number) {
          return { data: rows.slice(from, to + 1), error: null };
        },
      };
      return api;
    };
    const got = await fetchSailingCancelledRiskRowsPaged(fromTable as never, sid);
    expect(likeArg).toBe(likeWant);
    expect(got.map((r) => r.id)).toEqual(['r0', 'r1', 'r2']);

    const n = SAILING_CANCELLED_RISK_MAX_PAGES * SAILING_CANCELLED_RISK_PAGE_SIZE + 1;
    const huge = Array.from({ length: n }, (_, i) => ({
      id: `x${String(i).padStart(6, '0')}`, load_id: null, dedup_key: `SAILING_CANCELLED::${sid}`,
    }));
    const fromHuge = () => {
      const api = {
        select() { return api; },
        like() { return api; },
        is() { return api; },
        order() { return api; },
        async range(from: number, to: number) {
          return { data: huge.slice(from, to + 1), error: null };
        },
      };
      return api;
    };
    await expect(
      fetchSailingCancelledRiskRowsPaged(fromHuge as never, sid),
    ).rejects.toThrow(/sailing-cancelled risk page cap exceeded/);
  });
});
