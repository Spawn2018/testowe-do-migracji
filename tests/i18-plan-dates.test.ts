import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderEmail } from '../supabase/functions/_shared/notifyTemplates';
import { hasKey } from '../src/i18n/messages';

describe('DATY-67 / I-18 — daty planu z pliku KSH', () => {
  it('e-mail PLAN_DATES_CHANGED: PL, przed → po, autor', () => {
    const m = renderEmail({ template: 'PLAN_DATES_CHANGED', payload: { code: 'SG-01', by: 'HHL', status: 'POTWIERDZONA',
      before_load_date: '2026-10-01', load_date: '2026-10-02', before_delivery_date: '2026-10-06', delivery_date: '2026-10-07' } }, 'https://tower.log-mar.pl');
    expect(m.subject).toMatch(/SG-01/);
    expect(m.text).toContain('01.10.2026');
    expect(m.text).toContain('02.10.2026');
  });
  it('0061 historyczna miała overwrite; 0113 = plik źródłem + LATE_DATE_CHANGE', () => {
    const old = readFileSync('supabase/migrations/0061_plan_dates_confirm.sql', 'utf8');
    const neu = readFileSync('supabase/migrations/0113_daty67_ksh_file_dates.sql', 'utf8');
    expect(old).toContain("p_file->'overwrite_confirmed'");
    expect(old).toMatch(/DATE_CONFIRM_DAYS/);
    expect(neu).toMatch(/LATE_DATE_CHANGE/);
    expect(neu).toMatch(/schedule_cell_ts/);
    expect(neu).toMatch(/DATY-67/);
  });
  it('i18n: klucze DATY-67 w PL, EN i SV', () => {
    for (const loc of ['pl', 'en', 'sv'] as const) {
      for (const key of ['i18_imp_dates', 'i18_imp_dates_note', 'rk_late_date_change', 'rk_late_date_change_next']) {
        expect(hasKey(loc, key), `${loc}.${key}`).toBe(true);
      }
    }
  });
});
