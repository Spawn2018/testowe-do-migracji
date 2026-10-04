/**
 * I-23 (SCOPE 9.8) — odsiewanie duplikatów powiadomień dla wszystkich szablonów.
 * Dla OSTATNIEJ definicji każdej funkcji SQL (migracje po kolei), która wstawia do `notifications`:
 * każdy INSERT podaje `dedup_key` i kończy się `on conflict … do nothing` (unikalny indeks
 * notifications_dedup_key_idx, test bazy i2 „[I-23]”). Każdy szablon z bazy ma tekst w notifyTemplates.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { renderNotice } from '../supabase/functions/_shared/notifyTemplates';

const DIR = 'supabase/migrations/';
const latest = new Map<string, { file: string; body: string }>();
for (const f of readdirSync(DIR).filter((x) => x.endsWith('.sql')).sort()) {
  const s = readFileSync(DIR + f, 'utf8');
  const re = /create or replace function\s+(?:public\.)?(\w+)\s*\(.*?\$(\w*)\$(.*?)\$\2\$/gis;
  for (const m of s.matchAll(re)) latest.set(m[1].toLowerCase(), { file: f, body: m[3] });
}
const inserts: { fn: string; file: string; stmt: string }[] = [];
for (const [fn, { file, body }] of latest) {
  for (const m of body.matchAll(/insert into notifications\s*\(([^)]*)\)([\s\S]*?);/gi)) {
    inserts.push({ fn, file, stmt: m[0] });
  }
}
const templates = new Set<string>();
for (const { stmt } of inserts) {
  for (const m of stmt.matchAll(/'([A-Z][A-Z0-9_]{5,})'/g)) templates.add(m[1]);
}
const NOT_TEMPLATES = new Set(['IN_APP', 'EMAIL', 'HHL_ADMIN', 'HHL_OPS', 'CARRIER_DISPATCH', 'CARRIER_USER', 'FORWARDER', 'CRITICAL', 'CARRIER', 'PAYER', 'PENDING', 'OPLACONA', 'KOSZT', 'PRZYCHOD', 'QUEUED', 'CLAIMED', 'FAILED', 'DIGEST', 'SUPPRESSED']);

describe('I-23 odsiewanie duplikatów powiadomień', () => {
  it('co najmniej 8 miejsc w bazie wstawia powiadomienia', () => {
    expect(inserts.length).toBeGreaterThanOrEqual(8);
  });
  it.each(inserts.map((i) => [i.fn, i.file, i.stmt] as const))('%s (%s): dedup_key + on conflict do nothing', (_fn, _f, stmt) => {
    expect(stmt).toMatch(/\(\s*[^)]*\bdedup_key\b[^)]*\)/i);
    expect(stmt).toMatch(/on conflict[\s\S]*do nothing/i);
  });
  it('każdy szablon z bazy ma własny tekst (nie ogólny) w PL, EN i SV', () => {
    const tpl = [...templates].filter((t) => !NOT_TEMPLATES.has(t) && !t.startsWith('YYYY'));
    expect(tpl.length).toBeGreaterThanOrEqual(5);
    for (const t of tpl) {
      for (const locale of ['pl', 'en', 'sv'] as const) {
        const r = renderNotice({ template: t, payload: { code: 'SG-01', due: '2026-10-01', locale } }, locale);
        expect(r.subject, `${t}/${locale}`).toBeTruthy();
        expect(r.subject, `${t}/${locale}: brak własnego tekstu (gałąź default)`).not.toBe(t);
      }
    }
  });
});

/* 9.8 — to samo dla sygnałów ryzyka i kolejki SMS: każdy INSERT podaje dedup_key i albo kończy się
 * `on conflict … do nothing`, albo stoi za sprawdzeniem otwartego sygnału z tym kluczem (unikalny
 * indeks risk_signals(dedup_key) where resolved_at is null jest ostatnią zaporą — i2 „[9.8]”). */
const other: { table: string; fn: string; file: string; stmt: string; before: string }[] = [];
for (const [fn, { file, body: raw }] of latest) {
  const body = raw.replace(/'(?:[^']|'')*'/g, "''"); // literały tekstowe mogą zawierać „;”
  for (const table of ['risk_signals', 'sms_outbox']) {
    for (const m of body.matchAll(new RegExp(`insert into (?:public\\.)?${table}\\s*\\(([^)]*)\\)([\\s\\S]*?);`, 'gi'))) {
      other.push({ table, fn, file, stmt: m[0], before: body.slice(Math.max(0, (m.index ?? 0) - 900), m.index) });
    }
  }
}
describe('9.8 odsiewanie duplikatów: risk_signals i sms_outbox', () => {
  it('co najmniej 10 miejsc wstawia sygnały ryzyka lub SMS', () => {
    expect(other.filter((o) => o.table === 'risk_signals').length).toBeGreaterThanOrEqual(10);
    expect(other.some((o) => o.table === 'sms_outbox')).toBe(true);
  });
  it.each(other.map((o) => [o.table, o.fn, o.file, o] as const))('%s w %s (%s): dedup_key i odsiew', (_t, _fn, _f, o) => {
    expect(o.stmt).toMatch(/\(\s*[^)]*\bdedup_key\b[^)]*\)/i);
    const onConflict = /on conflict[\s\S]*do nothing/i.test(o.stmt);
    const checked = /where\s+dedup_key\s*=\s*v_key\s+and\s+resolved_at\s+is\s+null/i.test(o.before);
    expect(onConflict || checked, 'brak on conflict do nothing i brak sprawdzenia otwartego sygnału').toBe(true);
  });
});
