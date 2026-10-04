import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STOPPED_TYPES, clickTarget, emailUrl, isHomePath, tableTypes } from '../supabase/functions/_shared/clickTargets';

function codeTypes(): string[] {
  const notes = readFileSync('supabase/functions/_shared/notifyTemplates.ts', 'utf8');
  const templates = [...notes.matchAll(/case '([A-Z0-9_]+)':/g)].map((m) => m[1]);
  const mig = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).map((f) => readFileSync(`supabase/migrations/${f}`, 'utf8')).join('\n');
  const enumMatch = mig.match(/create type risk_kind as enum \(([\s\S]*?)\);/);
  const kinds = enumMatch ? [...enumMatch[1].matchAll(/'([A-Z0-9_]+)'/g)].map((m) => m[1]) : [];
  const added = [...mig.matchAll(/alter type risk_kind add value if not exists '([A-Z0-9_]+)'/g)].map((m) => m[1]);
  const decisions = [...mig.matchAll(/\('([A-Z0-9_]+)', 'dec_type_/g)].map((m) => m[1]);
  return [...new Set([...templates, ...kinds, ...added, ...decisions])];
}

const sources = ['cockpit', 'risk', 'bell', 'email'] as const;

describe('L-4 cele kliknięć', () => {
  it('żaden cel z tabeli nie jest stroną główną', () => {
    for (const type of tableTypes()) {
      for (const source of sources) {
        const t = clickTarget({ source, type, decisionId: 'd1', loadCode: 'SG-01', invoiceId: 'inv1', allowed: true });
        expect(isHomePath(t.path), type).toBe(false);
      }
    }
  });

  it('cztery źródła dają ten sam cel', () => {
    for (const type of tableTypes()) {
      const paths = sources.map((source) => clickTarget({
        source, type, decisionId: 'd1', loadCode: 'SG-01', invoiceId: 'inv1', allowed: true,
      }).path);
      expect(new Set(paths).size, type).toBe(1);
    }
  });

  it('decyzja, transport, faktura i stan systemu mają ścieżki z polecenia', () => {
    expect(clickTarget({ type: 'DWELL_OVER_FREE', decisionId: 'abc' }).path).toBe('/decyzje/abc');
    expect(clickTarget({ type: 'GEOFENCE_ENTER', loadCode: 'SG-01' }).path).toBe('/transport/SG-01?zakladka=status');
    expect(clickTarget({ type: 'INVOICE_NEW', invoiceId: 'f1' }).path).toBe('/finanse/faktury/f1');
    expect(clickTarget({ type: 'SMS_GATEWAY_SILENT' }).path).toBe('/opcje/stan-systemu#bramka-sms');
  });

  it('status i strefa idą na transport, nie na mini-akcję', () => {
    for (const type of ['STATUS_CHANGE', 'GEOFENCE_EXIT', 'GEOFENCE_DWELL']) {
      expect(clickTarget({ type, loadCode: 'SG-01' }).path).toContain('zakladka=status');
      expect(clickTarget({ type, loadCode: 'SG-01' }).path).not.toContain('geo');
    }
  });

  it('typ nieznany → szczegóły wpisu i test tego wymaga', () => {
    const t = clickTarget({ type: 'NIE_MA_TAKIEGO' });
    expect(t.kind).toBe('entry');
    expect(t.path).toBe('/szczegoly-wpisu');
    expect(isHomePath(t.path)).toBe(false);
  });

  it('brak uprawnień → Brak dostępu, nie strona główna', () => {
    const t = clickTarget({ type: 'ETA_AFTER_LATEST', decisionId: 'd1', allowed: false });
    expect(t.message).toBe('Brak dostępu');
    expect(t.path).toBe('/brak-dostepu');
    expect(isHomePath(t.path)).toBe(false);
  });

  it('e-mail nie linkuje strony głównej', () => {
    const url = emailUrl('https://tower.log-mar.pl', { type: 'SCHEDULE_DATE_CRITICAL', loadCode: 'SG-01' });
    expect(url.startsWith('https://tower.log-mar.pl/#/')).toBe(true);
    expect(url).not.toBe('https://tower.log-mar.pl/#/');
    expect(url).toContain('/decyzje/');
  });

  it('każdy typ z kodu jest w tabeli albo na liście STOP', () => {
    const known = new Set([...tableTypes(), ...STOPPED_TYPES]);
    const missing = codeTypes().filter((t) => !known.has(t));
    expect(missing).toEqual([]);
  });

  it('typy STOP nie dostają wymyślonego celu', () => {
    for (const type of STOPPED_TYPES) {
      expect(clickTarget({ type, loadCode: 'SG-01', decisionId: 'd1' }).path).toBe('/szczegoly-wpisu');
    }
  });
});
