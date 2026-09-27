/** I-10 — e-mail o zmianie daty awizowanego transportu: treść PL (domyślnie), odnośnik, podpis; migracja 0056. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderEmail } from '../supabase/functions/_shared/notifyTemplates';

describe('I-10 — SCHEDULE_DATE_CRITICAL e-mail', () => {
  it('PL: temat z kodem, nowe daty, odnośnik do aplikacji, podpis', () => {
    const m = renderEmail({ template: 'SCHEDULE_DATE_CRITICAL', payload: { code: 'SG-01', load_date: '2026-10-01', delivery_date: '2026-10-06' } }, 'https://tower.log-mar.pl');
    expect(m.subject).toBe('SG-01: zmiana daty w harmonogramie na awizowanym transporcie');
    expect(m.text).toContain('Nowy plan: załadunek 01.10.2026, dostawa 06.10.2026. Sprawdź okno awizacji.');
    expect(m.text).toContain('https://tower.log-mar.pl/#/');
    expect(m.html).toContain('— Tower · H&amp;H Logistics');
  });
  it('0056: wyzwalacz tylko dla IN_APP SCHEDULE_DATE_CRITICAL, klucz EMAIL:<dedup>, aktywne konto z adresem', () => {
    const s = readFileSync('supabase/migrations/0056_schedule_critical_email.sql', 'utf8');
    expect(s).toContain("when (new.channel = 'IN_APP' and new.template = 'SCHEDULE_DATE_CRITICAL')");
    expect(s).toContain("'EMAIL:' || coalesce(new.dedup_key, new.id::text)");
    expect(s).toMatch(/u\.active and coalesce\(btrim\(u\.email::text\), ''\) <> ''/);
    expect(s).toContain('security definer set search_path = public');
  });
});
