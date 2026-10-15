import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { t } from '../src/i18n/messages';
import { etaConfidenceFromMinutes } from '../src/data/mappers';

/** SG-03 ETA „Jak działa” + strażnik U-31 (po decyzji B 05.10 — znaczniki przed/po/noc). */
describe('ETA „Jak działa” (SG-03)', () => {
  for (const loc of ['pl', 'en', 'sv'] as const) {
    it(`${loc}: punkty howto + progi 30/120 min (E15-3)`, () => {
      const items = t(loc, 'a6_dr_eta_howto').split('|').map((x) => x.trim()).filter(Boolean);
      expect(items.length).toBeGreaterThanOrEqual(7);
      const conf = items.find((x) => x.includes('±30') && x.includes('±120'));
      expect(conf).toBeTruthy();
    });
  }
  it('pl: znaczniki okna i noc', () => {
    const s = t('pl', 'a6_dr_eta_howto');
    expect(s).toContain('„w oknie”');
    expect(s).toContain('„przed terminem”');
    expect(s).toContain('„po terminie”');
    expect(s).toContain('„przyjazd nocą”');
    expect(s).toContain('Wysoka / Średnia / Niska');
  });
  it('progi pewności w kodzie = progi w opisie (H3.2)', () => {
    expect(etaConfidenceFromMinutes(30)).toBe('HIGH');
    expect(etaConfidenceFromMinutes(31)).toBe('MED');
    expect(etaConfidenceFromMinutes(120)).toBe('MED');
    expect(etaConfidenceFromMinutes(121)).toBe('LOW');
    expect(etaConfidenceFromMinutes(null)).toBe('LOW');
  });
});

describe('U-31: obsada jednoosobowa — ETA nie czyta pól C-SEP jako załogi', () => {
  it('najnowsza definicja compute_load_eta nie traktuje A|B jako dwóch kierowców w obsadzie', () => {
    const dir = join(__dirname, '..', 'supabase', 'migrations');
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    const withFn = files.filter((f) => /create or replace function public\.compute_load_eta/i.test(readFileSync(join(dir, f), 'utf8')));
    expect(withFn.length).toBeGreaterThan(0);
    const last = readFileSync(join(dir, withFn[withFn.length - 1]), 'utf8');
    const body = last.slice(last.search(/create or replace function public\.compute_load_eta/i));
    const fn = body.slice(0, body.indexOf('$function$', body.indexOf('$function$') + 1));
    // U-31: nie ma gałęzi „dwóch kierowców” / crew_size — A|B to przepięcie (C-SEP), nie obsada
    expect(fn).not.toMatch(/crew_size|dual.?driver|two.?driver|obsada.?2/i);
    expect(fn).toMatch(/SE_DAILY_REST|driver_hours|H-4|gps_rest|daily_rest/i);
  });
});
