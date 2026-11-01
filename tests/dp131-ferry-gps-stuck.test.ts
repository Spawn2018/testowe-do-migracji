/**
 * DP-131 / F7 #703 — klucz i18n ryzyka „transport nie wypłynął?”.
 * Logika detekcji: migracja 0365 + tests/db/status.sh.
 */
import { describe, expect, it } from 'vitest';
import { RISK_I18N } from '../src/i18n/risks';

describe('DP-131 rk_ferry_not_departed', () => {
  it('ma polski szablon z {code}', () => {
    const t = RISK_I18N.pl.rk_ferry_not_departed;
    expect(t).toMatch(/nie wypłynął/);
    expect(t).toContain('{code}');
  });
});
