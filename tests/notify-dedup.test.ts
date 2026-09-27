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
const NOT_TEMPLATES = new Set(['IN_APP', 'EMAIL', 'HHL_ADMIN', 'HHL_OPS', 'CARRIER_DISPATCH', 'CARRIER_USER', 'FORWARDER', 'CRITICAL', 'CARRIER', 'PAYER', 'PENDING', 'OPLACONA', 'KOSZT', 'PRZYCHOD', 'QUEUED', 'CLAIMED', 'FAILED']);

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
