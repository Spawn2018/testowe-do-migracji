import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { hasKey } from '../src/i18n/messages';

describe('I-13 — zakres wersji SEFS (0063, D-10)', () => {
  it('RLS: przewoźnik COST+BOTH tylko uzgodnione, KSH REVENUE+BOTH, HHL wszystko; domyślnie BOTH', () => {
    const s = readFileSync('supabase/migrations/0063_sefs_applies_to.sql', 'utf8');
    expect(s).toContain("applies_to text not null default 'BOTH'");
    expect(s).toMatch(/current_org_kind\(\) = 'CARRIER' and applies_to in \('COST', 'BOTH'\) and agreed_with_carrier/);
    expect(s).toMatch(/current_org_kind\(\) = 'CLIENT' and applies_to in \('REVENUE', 'BOTH'\)/);
    expect(s).toContain('is_hhl()');
    expect(s).not.toMatch(/for (insert|update|delete)/);
  });
  it('widok tylko do odczytu jest leniwy i wyłącznie produkcyjny; teksty PL/EN/SV', () => {
    const v = readFileSync('src/views/SettingsView.tsx', 'utf8');
    /* W-opcje-live-2 (5B): ekran z audytu z danymi z bazy, wersje z SefsReadOnly rozwijane pod nim */
    expect(v).toContain("import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(lazyRetry(() => import('../auth/LiveFuel')))");
    expect(readFileSync('src/auth/LiveFuel.tsx', 'utf8')).toContain("import('./SefsReadOnly')");
    const c = readFileSync('src/auth/SefsReadOnly.tsx', 'utf8');
    expect(c).not.toContain('.rpc(');
    for (const loc of ['pl', 'en', 'sv'] as const) for (const k of ['i13_applies', 'i13_COST', 'i13_REVENUE', 'i13_BOTH', 'i13_ro_h', 'i13_ro_empty']) expect(hasKey(loc, k), `${loc}.${k}`).toBe(true);
  });
});
