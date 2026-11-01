/**
 * A6-T1 — klucze tekstów ryzyk: każdy klucz rk_* zapisywany przez bazę (0042) i funkcje Edge istnieje w słowniku PL;
 * enumeracje (metryki zużycia, źródła, zadania) mają teksty; dane demo: PL z klucza == dotychczasowy tekst.
 * Decyzja właściciela 17.10.2026 (8A, Konstytucja X): interfejs tylko po polsku — słowniki EN i SV ryzyk usunięte,
 * inny język dostaje tekst polski.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { RISK_I18N } from '../src/i18n/risks';
import { riskText, tp } from '../src/i18n/messages';
import { buildSeedLoads, buildSeedRisks } from '../src/data/seed';
import { orderNoRisks } from '../src/lib/orderNumbers';
import { riskFromRow } from '../src/data/mappers';

const LOCALES = ['pl'] as const;
const read = (p: string) => readFileSync(p, 'utf8');
const EDGE = 'supabase/functions/_shared/integrations/';
const sources = [
  read('supabase/migrations/0042_risk_title_key.sql'),
  ...readdirSync(EDGE).filter((f) => f.endsWith('.ts')).map((f) => read(EDGE + f)),
].join('\n');

describe('A6-T1 klucze ryzyk', () => {
  const keys = [...new Set([...sources.matchAll(/'(rk_[a-z0-9_]+)'/g)].map((m) => m[1]))]
    .filter((k) => !k.endsWith('_'));
  it('baza + Edge zapisują co najmniej 20 różnych kluczy', () => {
    expect(keys.length).toBeGreaterThanOrEqual(20);
  });
  it.each(LOCALES)('każdy klucz z bazy i Edge istnieje w %s', (loc) => {
    expect(keys.filter((k) => !RISK_I18N[loc][k])).toEqual([]);
  });
  it('8A: bez słowników EN i SV ryzyk', () => {
    expect(RISK_I18N.en).toEqual({});
    expect(RISK_I18N.sv).toEqual({});
  });
  it('enumeracje: metryki, źródła, zadania', () => {
    const metrics = /metric in \(([^)]+)\)/.exec(read('supabase/migrations/0024_usage_check.sql'))![1].match(/[A-Z_]+/g)!;
    const sql = read('supabase/migrations/0042_risk_title_key.sql');
    const jobs = [...sql.matchAll(/^\s+\('([a-z-]+)',\s+interval/gm)].map((m) => m[1]);
    // SourceId jest wieloliniowy (sync.ts). Lista źródeł II-5/II-6/II-8 + STENA_IRM — nie sama liczba.
    const srcBlock = /export type SourceId =([\s\S]*?);/.exec(read(EDGE + 'sync.ts'));
    const srcs = srcBlock![1].match(/'([A-Z0-9_]+)'/g)!.map((x) => x.slice(1, -1));
    const SOURCE_IDS = [
      'POLFERRIES_STATUS', 'POLFERRIES_SCHEDULE',
      'STENA_STATUS', 'STENA_SCHEDULE',
      'TALLINK_SCHEDULE', 'TALLINK_STATUS', 'VIKING_SCHEDULE', 'ECKERO_SCHEDULE', 'ECKERO_STATUS',
      'DFDS_SCHEDULE', 'DFDS_STATUS',
      'DIGITRAFFIC', 'DIGITRAFFIC_PORTCALL', 'DIGITRAFFIC_VIKING', 'DIGITRAFFIC_WINTER',
      'PORT_TALLINN', 'PORTS_STOCKHOLM',
      'STENA_IRM', 'TRAFIKVERKET', 'KPD_GDDKIA', 'TOMTOM',
      'FMI', 'DMI', 'SMHI', 'MARINE_WEATHER',
      'HERE_TRAFFIC_PL', 'HERE_ROADS', 'EMTRACK_WEB', 'RIO', 'KSH_SHAREPOINT',
    ];
    expect(metrics.length).toBe(4); expect(jobs.length).toBe(4); expect(srcs).toEqual(SOURCE_IDS);
    const need = [...metrics.map((m) => `usage_metric_${m}`), ...jobs.map((j) => `job_label_${j.replace(/-/g, '_')}`), ...srcs.map((x) => `rk_src_${x}`)];
    for (const loc of LOCALES) expect(need.filter((k) => !RISK_I18N[loc][k]), loc).toEqual([]);
  });
});

describe('A6-T1 dane demo', () => {
  const loads = buildSeedLoads();
  const risks = [...buildSeedRisks(loads), ...orderNoRisks(loads, '2026-09-26T12:00:00Z')];
  it('każde ryzyko demo ma klucz tytułu', () => {
    expect(risks.filter((r) => !r.titleKey).map((r) => r.id)).toEqual([]);
  });
  it('PL z klucza == dotychczasowy tytuł i meta', () => {
    for (const r of risks) {
      expect(riskText('pl', r.title, r.titleKey, r.titleParams).replace(/\u00a0/g, ' '), r.id).toBe(r.title.replace(/\u00a0/g, ' '));
      if (r.metaKey) expect(riskText('pl', r.meta ?? '', r.metaKey, r.metaParams).replace(/\u00a0/g, ' '), r.id).toBe((r.meta ?? '').replace(/\u00a0/g, ' '));
    }
  });
  it('8A: EN i SV dają tekst polski', () => {
    const f = risks.find((r) => r.id === 'risk-ferry')!;
    expect(riskText('en', f.title, f.titleKey, f.titleParams)).toBe(riskText('pl', f.title, f.titleKey, f.titleParams));
  });
});

describe('A6-T1 przewoźnik z językiem sv', () => {
  it('cisza GPS z bazy — po polsku (8A)', () => {
    const r = riskFromRow({
      id: 'r1', type: 'GPS', severity: 'HIGH', title: 'Brak pozycji pojazdu WGM 1234 od 45 min',
      title_key: 'rk_silent_vehicle', detail: { params: { plate: 'WGM 1234', minutes: 45 } },
      kind: 'GPS_SILENT', dedup_key: 'gps:x', load_id: null, detected_at: '2026-09-26T10:00:00Z', status: 'OPEN',
    } as never, '2026-09-26T11:00:00Z');
    /* 8A (17.10): przewoźnik z językiem sv dostaje tekst polski */
    const sv = riskText('sv', r.title, r.titleKey, r.titleParams);
    expect(sv).toBe(r.title);
    expect(sv).toContain('WGM 1234');
    expect(sv).toContain('45');
    expect(riskText('pl', r.title, r.titleKey, r.titleParams)).toBe(r.title);
  });
  it('generic zachowuje tekst', () => {
    expect(tp('sv', 'rk_generic', { title: 'X' })).toBe('X');
  });
});

describe('A6-T1 send-notifications: język odbiorcy', () => {
  it('app_users.locale odbiorcy wygrywa z payload.locale', async () => {
    const { recipientLocale, renderEmail } = await import('../supabase/functions/_shared/notifyTemplates');
    const users = [{ id: 'u1', email: 'Carrier@x.se', locale: 'sv' }, { id: 'u2', email: 'hhl@x.pl', locale: 'pl' }];
    expect(recipientLocale({ user_id: 'u1', recipient: 'carrier@x.se' }, users)).toBe('sv');
    expect(recipientLocale({ user_id: null, recipient: 'carrier@x.se' }, users)).toBe('sv');
    expect(recipientLocale({ user_id: null, recipient: 'nikt@x.pl' }, users)).toBeUndefined();
    const row = { template: 'INVOICE_NEW', payload: { locale: 'pl', number: 'F/1', gross: 1000, currency: 'EUR', week: '2026-W39', due: '2026-10-01' } };
    const sv = renderEmail(row, '', recipientLocale({ user_id: 'u1' }, users));
    const pl = renderEmail(row, '');
    expect(sv.subject).not.toBe(pl.subject);
  });
});
