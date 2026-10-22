/** #437 E44 — wiersz „Pozycje z linku RIO” w Opcje › Stan systemu (job `rio-links`, cron tower-rio-links). */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { LIVE_SOURCES, RUN_LIMIT, liveSourceRows, type RunRow } from '../src/auth/LiveStatus';
import { P3C_I18N } from '../src/i18n/p3c';

describe('Stan systemu: RIO', () => {
  it('źródło telematics-rio czyta job rio-links, próg 10 min, zaraz po emtrack', () => {
    const i = LIVE_SOURCES.findIndex((s) => s.id === 'telematics-rio');
    expect(i).toBe(LIVE_SOURCES.findIndex((s) => s.id === 'telematics') + 1);
    expect(LIVE_SOURCES[i]).toMatchObject({ jobs: ['rio-links'], maxMin: 10 });
  });

  it('teksty PL i job na liście przebiegów', () => {
    const pl = P3C_I18N.pl;
    expect(pl.ol2_src_telematics_rio).toBe('Pozycje z linku RIO');
    expect(pl.ol2_src_telematics_rio_cad).toContain('co 2 min');
    expect(pl.ol2_src_telematics_rio_feeds).toContain('podwykonawców');
    expect(readFileSync('src/auth/SystemStatusPanel.tsx', 'utf8')).toContain("'rio-links'");
  });

  it('#446: przebieg z result.disabled → „Brak pomiaru” z powodem „Wyłączone przełącznikiem”, nie „działa”', () => {
    const now = '2026-10-22T13:00:00.000Z';
    const runs: RunRow[] = [
      { job: 'rio-links', ok: true, ran_at: '2026-10-22T12:58:00.000Z', disabled: true },
      { job: 'rio-links', ok: true, ran_at: '2026-10-22T12:56:00.000Z', disabled: true },
      { job: 'rio-links', ok: true, ran_at: '2026-10-22T12:54:00.000Z', disabled: null },
    ];
    const row = liveSourceRows('pl', runs, [], [], now).find((r) => r.id === 'telematics-rio')!;
    expect(row.state).toBe('nomeasure');
    expect(row.since).toBe('2026-10-22T12:56:00.000Z');
    expect(row.lastAt).toBe('2026-10-22T12:54:00.000Z');
    expect(row.why).toBe(P3C_I18N.pl.ol2_src_why_off);
    const on = liveSourceRows('pl', [{ job: 'rio-links', ok: true, ran_at: '2026-10-22T12:58:00.000Z', disabled: null }], [], [], now)
      .find((r) => r.id === 'telematics-rio')!;
    expect(on.state).toBe('ok');
    expect(readFileSync('src/auth/LiveStatus.tsx', 'utf8')).toMatch(/disabled:result->disabled/);
  });

  it('F7 #451 P1: całe okno przebiegów wyłączone → bez „od” i bez „dane z”', () => {
    const now = '2026-10-22T13:00:00.000Z';
    const runs: RunRow[] = Array.from({ length: RUN_LIMIT }, (_, i) => ({
      job: 'rio-links', ok: true, ran_at: new Date(Date.parse(now) - (i + 1) * 120_000).toISOString(), disabled: true,
    }));
    const row = liveSourceRows('pl', runs, [], [], now).find((r) => r.id === 'telematics-rio')!;
    expect(row).toMatchObject({ state: 'nomeasure', since: null, lastAt: null });
  });

  it('F7 #451 D1: po włączeniu flagi błąd — „dane z” nie wskazuje przebiegu przy wyłączonej fladze', () => {
    const now = '2026-10-22T13:00:00.000Z';
    const runs: RunRow[] = [
      { job: 'rio-links', ok: false, ran_at: '2026-10-22T12:58:00.000Z', disabled: null },
      { job: 'rio-links', ok: true, ran_at: '2026-10-22T12:56:00.000Z', disabled: true },
      { job: 'rio-links', ok: true, ran_at: '2026-10-22T10:00:00.000Z', disabled: null },
    ];
    const row = liveSourceRows('pl', runs, [], [], now).find((r) => r.id === 'telematics-rio')!;
    expect(row.state).toBe('down');
    expect(row.lastAt).toBe('2026-10-22T10:00:00.000Z');
  });
});
