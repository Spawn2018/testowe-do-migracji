/**
 * A6 (27.09) — rk_generic to wyłącznie bezpiecznik. Żadna ścieżka w kodzie (baza: ostatnie definicje funkcji
 * w migracjach; Edge: supabase/functions) nie może kończyć się kluczem rk_generic: każde wywołanie raise_risk /
 * raise_integration_risk i każdy insert do risk_signals przekazuje jawny klucz rk_* istniejący w słowniku.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RISK_I18N } from '../src/i18n/risks';
import { FN, dbRiskCalls, latestFunctions, walk } from './helpers/riskCalls';

describe('rk_generic — żadna ścieżka w kodzie', () => {
  const calls = dbRiskCalls();
  const dict = new Set(Object.keys(RISK_I18N.pl));

  it('baza: każde raise_risk / raise_integration_risk / insert do risk_signals ma jawny klucz rk_* ze słownika', () => {
    expect(calls.length).toBeGreaterThanOrEqual(13);
    const bad = calls.filter((c) => c.keys.length === 0 || c.keys.includes('rk_generic') || c.keys.some((k) => !dict.has(k)));
    expect(bad).toEqual([]);
  });

  it('Edge: jedyne wejście do bazy to store.ts i zawsze przekazuje title_key; każdy titleKey to rk_* ze słownika', () => {
    const files = walk(FN);
    const rpc = files.filter((f) => /raise_integration_risk|raise_risk|from\('risk_signals'\)\.insert/.test(readFileSync(f, 'utf8')));
    expect(rpc).toEqual([join(FN, '_shared/integrations/store.ts')]);
    expect(readFileSync(rpc[0], 'utf8')).toMatch(/title_key:\s*r\.titleKey/);
    const keys = files.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/titleKey:\s*([^,\n]+)/g)].map((m) => m[1]))
      .filter((v) => !/^string\b/.test(v.trim()));
    expect(keys.length).toBeGreaterThanOrEqual(5);
    for (const v of keys) {
      const lits = [...v.matchAll(/'(rk_[a-z0-9_]+)'/g)].map((m) => m[1]);
      expect(lits.length, v).toBeGreaterThan(0);
      for (const k of lits) { expect(k).not.toBe('rk_generic'); expect(dict.has(k), k).toBe(true); }
    }
  });

  it('rk_generic zostaje jako bezpiecznik w wyzwalaczu', () => {
    expect(latestFunctions().get('risk_signals_title_key')?.body).toMatch(/rk_generic/);
  });
});
