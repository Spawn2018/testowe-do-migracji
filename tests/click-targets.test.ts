import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STOPPED_TYPES, clickFromPayload, clickTarget, emailUrl, isHomePath, smsFallbackVisible, tableTypes } from '../supabase/functions/_shared/clickTargets';
import { notificationFromRow } from '../src/data/mappers';
import { bellAfterClick, bellVisible } from '../src/lib/bellList';

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
    expect(clickTarget({ type: 'FUEL_READING_MISSING' }).path).toBe('/opcje/cennik');
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

  it('brama odrzuca typ bez celu — lista STOP jest pusta', () => {
    expect([...STOPPED_TYPES]).toEqual([]);
    expect(tableTypes()).toContain('SMS_FALLBACK');
    expect(tableTypes()).toContain('WORKFLOW_ALERT');
    const known = new Set(tableTypes());
    expect(known.has('NIE_MA_TAKIEGO')).toBe(false);
    expect(clickTarget({ type: 'NIE_MA_TAKIEGO' }).kind).toBe('entry');
  });

  it('SMS_FALLBACK: cztery źródła, wpis bramki, nie strona główna', () => {
    const input = {
      type: 'SMS_FALLBACK',
      smsId: 'abc',
      status: 'FAILED',
      recipient: '567',
      email: 'ops@log-mar.pl',
      loadCode: 'SG-01',
      role: 'HHL',
      allowed: true as const,
    };
    const paths = sources.map((source) => clickTarget({ ...input, source }).path);
    expect(new Set(paths).size).toBe(1);
    const path = paths[0];
    expect(path.startsWith('/opcje/stan-systemu/bramka-sms/abc?')).toBe(true);
    expect(path).toContain('status=FAILED');
    expect(path).toContain('odbiorca=567');
    expect(path).toContain('email=ops%40log-mar.pl');
    expect(path).toContain('transport=SG-01');
    expect(isHomePath(path)).toBe(false);
    expect(path).not.toBe('/szczegoly-wpisu');
    const mail = emailUrl('https://tower.log-mar.pl', { ...input, source: 'email' });
    expect(mail).toBe(`https://tower.log-mar.pl/#${path}`);
    expect(clickTarget({ ...input, role: 'HHL_ADMIN' }).path).toBe(path);
    for (const role of ['SCX', 'KSH']) {
      const denied = clickTarget({ ...input, role, source: 'bell' });
      expect(denied.message).toBe('Brak dostępu');
      expect(denied.path).toBe('/brak-dostepu');
      expect(isHomePath(denied.path)).toBe(false);
    }
    expect(smsFallbackVisible('HHL')).toBe(true);
    expect(smsFallbackVisible('SCX')).toBe(false);
    const row = notificationFromRow({
      id: 7,
      template: 'SMS_FALLBACK',
      payload: { sms_id: 'abc', status: 'FAILED', to_tail: '567', fallback_email: 'ops@log-mar.pl', code: 'SG-01' },
      load_id: null,
      created_at: '2026-10-04T12:00:00Z',
      read_at: null,
    });
    expect(row.roleScope).toEqual(['HHL']);
    expect(row.href?.path).toBe(path);
    expect(bellVisible([row], 'SCX')).toEqual([]);
    expect(bellVisible([row], 'HHL').map((n) => n.id)).toEqual([row.id]);
  });

  it('WORKFLOW_ALERT: transport albo podgląd reguły, ten sam cel z czterech źródeł', () => {
    const withLoad = { type: 'WORKFLOW_ALERT', loadCode: 'SG-01', ruleId: 'START-7', allowed: true as const };
    const transportPaths = sources.map((source) => clickTarget({ ...withLoad, source }).path);
    expect(new Set(transportPaths).size).toBe(1);
    expect(transportPaths[0]).toBe('/transport/SG-01?zakladka=status');
    expect(isHomePath(transportPaths[0])).toBe(false);
    const bare = { type: 'WORKFLOW_ALERT', ruleId: 'START-7', allowed: true as const };
    const rulePaths = sources.map((source) => clickTarget({ ...bare, source }).path);
    expect(new Set(rulePaths).size).toBe(1);
    expect(rulePaths[0]).toBe('/automatyzacje/START-7');
    expect(rulePaths[0]).not.toContain('/transport/');
    expect(isHomePath(rulePaths[0])).toBe(false);
    expect(emailUrl('https://tower.log-mar.pl', bare)).toBe('https://tower.log-mar.pl/#/automatyzacje/START-7');
    const denied = clickTarget({ ...bare, allowed: false });
    expect(denied.message).toBe('Brak dostępu');
    expect(isHomePath(denied.path)).toBe(false);
    const fromPayload = clickTarget(clickFromPayload('WORKFLOW_ALERT', { rule_code: 'START-7', code: '' }, 'risk'));
    expect(fromPayload.path).toBe('/automatyzacje/START-7');
  });

  it('L-5: klik zdejmuje pozycję z dzwonka i otwiera cel, bez napisu przeczytane', () => {
    const bell = readFileSync('src/components/shell/NotificationBell.tsx', 'utf8');
    expect(bell).not.toContain('mark_read');
    expect(bell).not.toContain('Przeczytane');
    const items = [
      { id: 'a', read: false, roleScope: undefined as string[] | undefined },
      { id: 'b', read: false },
    ];
    expect(bellVisible(items, 'HHL')).toHaveLength(2);
    const after = bellAfterClick(items, 'a');
    const left = bellVisible(after, 'HHL');
    expect(left.map((n) => n.id)).toEqual(['b']);
    expect(left.length).toBe(1);
    const entry = clickTarget({ source: 'bell', type: 'CLIENT' });
    expect(entry.path).toBe('/szczegoly-wpisu');
    expect(isHomePath(entry.path)).toBe(false);
  });
});
