/**
 * BN3 #686 F7 r1/r2 — pure helpers + supabaseStore(fakeSb) (B1–B3 / B-r2-2).
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
  supabaseStore,
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

/**
 * F7 #698 r2 B-r2-2: prawdziwa logika supabaseStore — filtry like/is/range + loads.
 * Mutacje przeżywające bez tego: B2a (tylko otwarte), B2c (bez loads.sailing_id), B1c (bez source_url).
 */
describe('BN3 #686 supabaseStore restore (fakeSb)', () => {
  const SID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  function fakeSbForRestore(opts: {
    notices?: { source: string; operator: string; source_url: string | null }[];
    risks?: { id: string; load_id: string | null; dedup_key: string; resolved_at: string | null }[];
    loads?: { id: string; sailing_id: string | null }[];
  }) {
    const calls: {
      table: string;
      like?: string;
      isResolvedNull?: boolean;
      range?: [number, number];
      select?: string;
      inIds?: string[];
    }[] = [];
    const notices = opts.notices ?? [];
    const risks = opts.risks ?? [];
    const loads = opts.loads ?? [];
    const sb = {
      from(table: string) {
        const call: (typeof calls)[number] = { table };
        calls.push(call);
        const api = {
          select(cols: string) {
            call.select = cols;
            return api;
          },
          eq() { return api; },
          like(_c: string, v: string) {
            call.like = v;
            return api;
          },
          is(col: string, val: null) {
            if (col === 'resolved_at' && val === null) call.isResolvedNull = true;
            return api;
          },
          in(_c: string, ids: string[]) {
            call.inIds = ids;
            return api;
          },
          order() { return api; },
          limit() { return api; },
          update() { return api; },
          async range(from: number, to: number) {
            call.range = [from, to];
            if (table === 'risk_signals') {
              const filtered = risks.filter((r) => {
                if (call.like && !r.dedup_key.endsWith(`:${SID}`)) return false;
                if (call.isResolvedNull && r.resolved_at != null) return false;
                return true;
              });
              return { data: filtered.slice(from, to + 1), error: null };
            }
            return { data: [], error: null };
          },
          async then(resolve: (v: unknown) => void) {
            if (table === 'operator_notices') {
              resolve({ data: notices.slice(0, 1), error: null });
              return;
            }
            if (table === 'loads') {
              const ids = new Set(call.inIds ?? []);
              resolve({
                data: loads.filter((l) => ids.size === 0 || ids.has(l.id)),
                error: null,
              });
              return;
            }
            if (table === 'risk_signals' && call.select === 'id' && !call.like) {
              resolve({ data: [], error: null });
              return;
            }
            resolve({ data: [], error: null });
          },
        };
        return api;
      },
    };
    return { sb, calls };
  }

  it('B1c: latestCancelNotice mapuje source_url', async () => {
    const { sb, calls } = fakeSbForRestore({
      notices: [{
        source: 'AUTO', operator: 'TALLINK',
        source_url: 'https://www.tallink.com/alert',
      }],
    });
    const store = supabaseStore(sb);
    const n = await store.latestCancelNotice!(SID);
    expect(n).toEqual({
      source: 'AUTO', operator: 'TALLINK', sourceUrl: 'https://www.tallink.com/alert',
    });
    expect(calls.some((c) => c.table === 'operator_notices' && c.select?.includes('source_url'))).toBe(true);
  });

  it('B2a+B2c: reassignedLoadsAfterCancel — także zamknięte ryzyka + filtr loads.sailing_id', async () => {
    const likeWant = sailingCancelledRiskLike(SID);
    const { sb, calls } = fakeSbForRestore({
      risks: [
        {
          id: 'r-open', load_id: 'L-stay', dedup_key: `SAILING_CANCELLED:L-stay:${SID}`,
          resolved_at: null,
        },
        {
          id: 'r-closed', load_id: 'L-moved', dedup_key: `SAILING_CANCELLED:L-moved:${SID}`,
          resolved_at: '2026-11-01T10:00:00Z',
        },
      ],
      loads: [
        { id: 'L-stay', sailing_id: SID },
        { id: 'L-moved', sailing_id: 'other-sailing' },
      ],
    });
    const store = supabaseStore(sb);
    const got = await store.reassignedLoadsAfterCancel!(SID);
    expect(got).toEqual(['L-moved']);
    const riskCalls = calls.filter((c) => c.table === 'risk_signals' && c.like);
    expect(riskCalls.length).toBeGreaterThan(0);
    expect(riskCalls.every((c) => c.like === likeWant)).toBe(true);
    // B2a: bez .is(resolved_at, null) — inaczej zamknięte znikają (błąd r1).
    expect(riskCalls.every((c) => c.isResolvedNull !== true)).toBe(true);
    const loadCall = calls.find((c) => c.table === 'loads');
    expect(loadCall?.select).toMatch(/sailing_id/);
    expect(loadCall?.inIds?.sort()).toEqual(['L-moved', 'L-stay'].sort());
  });

  it('B3: resolveSailingCancelledRisks — openOnly + like sailingId; expire też like', async () => {
    const likeWant = sailingCancelledRiskLike(SID);
    const { sb, calls } = fakeSbForRestore({
      risks: [
        {
          id: 'r1', load_id: 'L1', dedup_key: `SAILING_CANCELLED:L1:${SID}`,
          resolved_at: null,
        },
      ],
    });
    const store = supabaseStore(sb);
    await store.resolveSailingCancelledRisks!(SID);
    const resolveRisk = calls.filter((c) => c.table === 'risk_signals' && c.like === likeWant);
    expect(resolveRisk.some((c) => c.isResolvedNull === true)).toBe(true);

    const { sb: sb2, calls: calls2 } = fakeSbForRestore({
      risks: [
        {
          id: 'r2', load_id: 'L2', dedup_key: `SAILING_CANCELLED:L2:${SID}`,
          resolved_at: '2026-11-01T10:00:00Z',
        },
      ],
    });
    // decisions.update → then; atrapa zwraca puste.
    const sbExpire = {
      from(table: string) {
        if (table === 'decisions') {
          const api = {
            update() { return api; },
            in() { return api; },
            select() { return api; },
            then(resolve: (v: unknown) => void) {
              resolve({ data: [], error: null });
            },
          };
          return api;
        }
        return sb2.from(table);
      },
    };
    const store2 = supabaseStore(sbExpire);
    await store2.expireFerryCancelledDecisions!(SID);
    const expireRisk = calls2.filter((c) => c.table === 'risk_signals' && c.like === likeWant);
    expect(expireRisk.length).toBeGreaterThan(0);
    expect(expireRisk.every((c) => c.isResolvedNull !== true)).toBe(true);
  });
});
