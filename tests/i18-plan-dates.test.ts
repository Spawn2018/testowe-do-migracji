import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderEmail } from '../supabase/functions/_shared/notifyTemplates';
import { hasKey } from '../src/i18n/messages';

describe('I-18 — status dat planu (0061)', () => {
  it('e-mail PLAN_DATES_CHANGED: PL, przed → po, autor; WSTĘPNA = prośba o ponowne potwierdzenie', () => {
    const m = renderEmail({ template: 'PLAN_DATES_CHANGED', payload: { code: 'SG-01', by: 'HHL', status: 'WSTEPNA',
      before_load_date: '2026-10-01', load_date: '2026-10-02', before_delivery_date: '2026-10-06', delivery_date: '2026-10-07' } }, 'https://tower.log-mar.pl');
    expect(m.subject).toBe('SG-01: zmiana potwierdzonych dat planu (HHL)');
    expect(m.text).toContain('Załadunek 01.10.2026 → 02.10.2026, dostawa 06.10.2026 → 07.10.2026. KSH musi ponownie potwierdzić daty.');
    const k = renderEmail({ template: 'PLAN_DATES_CHANGED', payload: { code: 'SG-01', by: 'KSH', status: 'POTWIERDZONA', locale: 'en',
      before_load_date: '2026-10-01', load_date: '2026-10-02', before_delivery_date: '2026-10-06', delivery_date: '2026-10-07' } }, 'https://tower.log-mar.pl');
    expect(k.text).not.toContain('confirm the dates again');
  });
  it('migracja: import bez zgody nie nadpisuje, RPC tylko KSH, ANEKS 2 bez zmian, N w tabeli parametrów', () => {
    const s = readFileSync('supabase/migrations/0061_plan_dates_confirm.sql', 'utf8');
    expect(s).toContain("p_file->'overwrite_confirmed'");
    expect(s).toContain("Daty potwierdza wyłącznie KSH");
    expect(s).toContain("Przewoźnik nie może zmieniać");
    expect(s).toMatch(/DATE_CONFIRM_DAYS/);
    expect(s).toContain("'PLAN_DATES_CONFIRMED', 'PLAN_DATES_CHANGED'");
  });
  it('i18n: klucze I-18 w PL, EN i SV', () => {
    for (const loc of ['pl', 'en', 'sv'] as const) {
      for (const key of ['i18_h', 'i18_confirmed', 'i18_provisional', 'i18_imp_warn', 'i18_imp_consent', 'rk_dates_unconfirmed']) {
        expect(hasKey(loc, key), `${loc}.${key}`).toBe(true);
      }
    }
  });
});
