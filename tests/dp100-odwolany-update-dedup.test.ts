/**
 * DP-100 / F7 #683: updateSailing(status=ODWOLANY) → `.neq('status','ODWOLANY')`
 * (dedup AUTO w update, bez partial unique — po PRZYWROCONY wolno drugi ODWOLANY).
 */
import { describe, expect, it, vi } from 'vitest';
import { supabaseStore } from '../supabase/functions/_shared/integrations/store.ts';

type Call = { method: string; args: unknown[] };

function mockSb(selectResult: unknown[] = [{ id: 's1' }]) {
  const calls: Call[] = [];
  const chain: Record<string, unknown> = {};
  const track = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args });
    return chain;
  };
  chain.update = track('update');
  chain.eq = track('eq');
  chain.neq = track('neq');
  chain.select = vi.fn(async () => {
    calls.push({ method: 'select', args: ['id'] });
    return { data: selectResult, error: null };
  });
  const sb = {
    from: vi.fn((table: string) => {
      calls.push({ method: 'from', args: [table] });
      return chain;
    }),
  };
  return { sb, calls, chain };
}

describe('DP-100 updateSailing ODWOLANY dedup', () => {
  it('status=ODWOLANY → neq source RECZNIE + neq status ODWOLANY; pusty select → false', async () => {
    const { sb, calls } = mockSb([]);
    const store = supabaseStore(sb);
    expect(await store.updateSailing('s1', { status: 'ODWOLANY' })).toBe(false);
    expect(calls.filter((c) => c.method === 'neq')).toEqual([
      { method: 'neq', args: ['source', 'RECZNIE'] },
      { method: 'neq', args: ['status', 'ODWOLANY'] },
    ]);
  });

  it('status=ZAPLANOWANY (przywrócenie) → tylko neq source, bez neq status', async () => {
    const { sb, calls } = mockSb([{ id: 's1' }]);
    const store = supabaseStore(sb);
    expect(await store.updateSailing('s1', { status: 'ZAPLANOWANY' })).toBe(true);
    expect(calls.filter((c) => c.method === 'neq')).toEqual([
      { method: 'neq', args: ['source', 'RECZNIE'] },
    ]);
  });

  it('ODWOLANY gdy wiersz istnieje → true (pierwszy przebieg)', async () => {
    const { sb, calls } = mockSb([{ id: 's1' }]);
    const store = supabaseStore(sb);
    expect(await store.updateSailing('s1', { status: 'ODWOLANY' })).toBe(true);
    expect(calls.some((c) => c.method === 'neq' && c.args[0] === 'status' && c.args[1] === 'ODWOLANY')).toBe(true);
  });
});
