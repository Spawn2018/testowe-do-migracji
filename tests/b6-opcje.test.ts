/**
 * B-6a…B-6i (część B, Opcje, 05.10.2026).
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { t } from '../src/i18n/messages';
import { OptionsHowTo } from '../src/components/settings/OptionsHowTo';
import { latestPerJob, KNOWN_JOBS } from '../src/auth/SystemStatusPanel';
import { uaLabel } from '../src/lib/userAgent';
import { prevWeekStatus, warsawDay } from '../src/lib/sefsWeek';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const HOWTO = ['b6_howto_notif', 'b6_howto_zones', 'b6_howto_thresh', 'b6_howto_sefs'] as const;

describe('B-6a/b/c: „Jak to działa” w Opcjach', () => {
  it('każda sekcja ma opis krok po kroku w PL, EN i SV (ta sama liczba kroków)', () => {
    for (const k of HOWTO) {
      const n = t('pl', k).split('|').length;
      expect(n).toBeGreaterThanOrEqual(4);
      expect(t('en', k).split('|')).toHaveLength(n);
      expect(t('sv', k).split('|')).toHaveLength(n);
    }
  });
  it('Opcje wstawiają blok w Powiadomieniach, Strefach, Progach i SEFS', () => {
    const src = read('src/views/OptionsView.tsx');
    for (const k of HOWTO) expect(src).toContain(`<OptionsHowTo locale={locale} k="${k}" />`);
    expect(src).not.toContain("'opt_notif_filter_note'");
  });
  it('blok renderuje się jako rozwijana lista kroków', () => {
    const html = renderToStaticMarkup(createElement(OptionsHowTo, { locale: 'pl', k: 'b6_howto_thresh' }));
    expect(html).toContain('<details class="opt-howto"');
    expect(html).toContain('<summary>Jak to działa</summary>');
    expect(html.match(/<li>/g)).toHaveLength(t('pl', 'b6_howto_thresh').split('|').length);
  });
  it('treść zgodna z mechanizmem: macierz, decyzja ostrzeżenie→krytyczne, SMS tylko Śrem i Boden, progi 48/12 h', () => {
    expect(t('pl', 'b6_howto_notif')).toMatch(/Tylko macierz decyduje/);
    expect(t('pl', 'b6_howto_notif')).toMatch(/Nowa automatyzacja/); // B-5 05.10: kreator reguł zamiast „nie dodaje się”
    expect(t('pl', 'b6_howto_zones')).toMatch(/Śremie i plac w Boden/);
    expect(t('pl', 'b6_howto_thresh')).toMatch(/48 h przed — ostrzeżenie, na 12 h — krytyczne/);
  });
});

describe('B-6d: Stan systemu jako pulpit', () => {
  it('ostatni przebieg każdego zadania, także rzadkiego', () => {
    const rows = [
      { id: 1, job: 'ferry-ais', ok: false, ran_at: '2026-10-05T06:00:00Z' },
      { id: 2, job: 'ferry-ais', ok: true, ran_at: '2026-10-05T06:03:00Z' },
      { id: 3, job: 'rodo', ok: true, ran_at: '2026-10-05T02:15:00Z' },
    ];
    const out = latestPerJob(rows);
    expect(out.map((r) => `${r.job}:${r.ok}`)).toEqual(['ferry-ais:true', 'rodo:true']);
    expect(KNOWN_JOBS).toContain('daily-admin-digest');
  });
  it('kafelki ze stanem zamiast list tekstu; bez „ostatnich 12 przebiegów”', () => {
    const src = read('src/auth/SystemStatusPanel.tsx');
    expect(src).toContain('className="sys-dash"');
    expect(src).toContain('data-state={state}');
    expect(src).not.toMatch(/\.limit\(12\)/);
    for (const k of ['data-email-budget', 'data-here-tile', 'data-deepl-usage', 'data-backup-list', 'data-sms-silent']) expect(src).toContain(k);
    expect(read('src/index.css')).toMatch(/\.sys-dash\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(200px,1fr\)\)/);
  });
});

describe('B-6e: dziennik logowań', () => {
  it('migracja 0164: tabela, wyzwalacz na auth.sessions, odczyt tylko HHL_ADMIN', () => {
    const sql = read('supabase/migrations/0164_b6e_login_log.sql');
    expect(sql).toMatch(/create table if not exists public\.auth_login_events/);
    expect(sql).toMatch(/after insert on auth\.sessions/);
    expect(sql).toMatch(/revoke all on table public\.auth_login_events from public, anon, authenticated/);
    expect(sql).toMatch(/revoke all on function public\.tower_log_auth_session\(\) from public, anon, authenticated/);
    expect(sql).toMatch(/current_app_role\(\) = 'HHL_ADMIN'\) is not true/);
  });
  it('panel: urządzenie z nagłówka przeglądarki, bez gołego licznika', () => {
    const src = read('src/auth/AuthLoginLog.tsx');
    expect(src).toContain('uaLabel(r.user_agent)');
    expect(src).not.toContain('<span className="note">{rows.length}</span>');
  });
  it('uaLabel', () => {
    expect(uaLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36')).toBe('Chrome · Windows');
    expect(uaLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1')).toBe('Safari · iOS');
    expect(uaLabel('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/129.0 Safari/537.36 Edg/129.0')).toBe('Edge · Windows');
    expect(uaLabel('Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0')).toBe('Firefox · Linux');
    expect(uaLabel(null)).toBe('');
  });
});

describe('B-6f: Historia zmian bez „200” obok przycisku', () => {
  it('goły licznik i notka z liczbą usunięte; limit pobrania zostaje', () => {
    const src = read('src/auth/ChangeHistoryPanel.tsx');
    expect(src).not.toContain('<span className="note">{rows.length}</span>');
    expect(src).not.toContain("tp(locale, 'b6_hist_capped'");
    expect(src).not.toContain('data-history-capped');
    expect(src).toContain('p_limit: HISTORY_LIMIT');
  });
});

describe('B-6g / B-6i: bez rozjazdu w prawo', () => {
  it('Cennik: tabela na całą szerokość formularza, przewijana w poziomie', () => {
    const src = read('src/auth/RateCardForm.tsx');
    expect(src).toContain('<div className="full-row" data-rate-card="rows">');
    expect(src).toContain('<div className="rate-table-wrap"><table className="rate-table">');
    const css = read('src/index.css');
    expect(css).toContain('.baf-form>.full-row{grid-column:1/-1;min-width:0}');
    expect(css).toContain('.rate-table-wrap{max-width:100%;overflow-x:auto');
  });
  it('Wymóg zezwoleń: notatka bez ujemnych marginesów w sekcji, stan obok przycisku', () => {
    expect(read('src/index.css')).toContain('.opt-acc-body .option-note{margin:0 0 10px}');
    const src = read('src/auth/PermitRequirement.tsx');
    expect(src).toContain('data-permit-state');
    expect(src).toContain('className="permit-row"');
  });
});

describe('B-6h: SEFS — średnia poprzedniego tygodnia', () => {
  const r = (index_code: string, period: string, value: number, corrects_id: number | null = null) => ({ index_code, period, value, corrects_id });
  const tiers = { sek: [{ lte: 19.47, mult: 1 }, { lte: 20.5, mult: 1.05 }], pln: [{ lte: 5.7, mult: 1 }, { lte: 6.2, mult: 1.04 }] };
  it('okno pon–niedz poprzedniego tygodnia (05.10.2026 → 28.09–04.10)', () => {
    const w = prevWeekStatus([], '2026-10-05', tiers);
    expect([w.from, w.to]).toEqual(['2026-09-28', '2026-10-04']);
    expect(prevWeekStatus([], '2026-10-11', tiers).from).toBe('2026-09-28');
    expect(w.mult).toBeNull();
  });
  it('liczą się tylko odczyty dzienne z okna, jak w sefs_week_calc; stosowany niższy mnożnik', () => {
    const w = prevWeekStatus([
      r('SEK', '2026-09-28', 20.0), r('SEK', '2026-10-02', 20.4), r('SEK', '2026-10-05', 30), r('SEK', '2026-W40', 25), r('SEK', '2026-09', 25),
      r('PLN', '2026-09-30', 5.6), r('PLN', '2026-10-01', 5.7, 7),
    ], '2026-10-05', tiers);
    expect([w.nSek, w.nPln]).toEqual([2, 1]);
    expect(w.avgSek).toBeCloseTo(20.2, 6);
    expect(w.mult).toBe(1);
  });
  it('formularz zapisuje odczyt dzienny (okres = data odczytu) i pokazuje stan tygodnia', () => {
    const src = read('src/auth/BafForm.tsx');
    expect(src).toContain('p_period: rf.corrects ? rf.period.trim() : rf.reading_date');
    expect(src).not.toContain('placeholder="2026-10 / 2026-W41"');
    expect(src).toContain('data-sefs-week=');
  });
  it('dzień w Warszawie', () => {
    expect(warsawDay(new Date('2026-10-04T22:30:00Z'))).toBe('2026-10-05');
  });
});
