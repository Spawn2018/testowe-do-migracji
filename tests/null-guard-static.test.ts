// I-2A (0049): test statyczny strażników NULL — reguła i stan migracji repo.
import { describe, expect, it } from 'vitest';
// @ts-expect-error — moduł .mjs bez typów
import { lastDefinitions, scanBody } from './db/null-guard-static.mjs';

describe('I-2A null-guard (statyczny)', () => {
  it('„if not is_hhl()” i złożony „if not (is_hhl() or …)” = czerwone', () => {
    expect(scanBody('f', "  if not is_hhl() then raise exception 'x'; end if;")).toHaveLength(1);
    expect(scanBody('f', "  if not (is_hhl() or (current_org_kind() = 'CARRIER' and a = b)) then")).toHaveLength(1);
    expect(scanBody('f', '  if auth.uid() is not null and not is_hhl()')).toHaveLength(1);
    expect(scanBody('f', '  elsif not v_ok then')).toHaveLength(1);
  });
  it('„is not true”, „not exists”, „not found”, „not coalesce(…)” i komentarze = zielone', () => {
    expect(scanBody('f', "  if is_hhl() is not true then raise exception 'x'; end if;")).toEqual([]);
    expect(scanBody('f', '  if not exists (select 1 from t) then')).toEqual([]);
    expect(scanBody('f', '  if not found then')).toEqual([]);
    expect(scanBody('f', '  if not coalesce(v, false) then')).toEqual([]);
    expect(scanBody('f', '  -- dawniej: if not is_hhl() then')).toEqual([]);
  });
  it('ostatnie definicje wszystkich funkcji w supabase/migrations: 0 naruszeń', () => {
    const defs = lastDefinitions();
    expect(defs.size).toBeGreaterThan(90);
    const bad: string[] = [];
    for (const [name, d] of defs) if (name !== 'rls_auto_enable') bad.push(...scanBody(name, d.body));
    expect(bad).toEqual([]);
  });
});
