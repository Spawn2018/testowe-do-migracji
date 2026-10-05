import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { t } from '../src/i18n/messages';
import { etaConfidenceFromMinutes } from '../src/data/mappers';

/** Poczekalnia SG-03 (05.10): definicje etykiet ETA w „Jak działa” + strażnik U-31 vs C-SEP. */
describe('ETA „Jak działa” (SG-03)', () => {
  for (const loc of ['pl', 'en', 'sv'] as const) {
    it(`${loc}: 6 punktów, progi 60/240 min zgodne z etaConfidenceFromMinutes`, () => {
      const items = t(loc, 'a6_dr_eta_howto').split('|').map((x) => x.trim()).filter(Boolean);
      expect(items).toHaveLength(6);
      const conf = items.find((x) => x.includes('±60') && x.includes('±240'));
      expect(conf).toBeTruthy();
    });
  }
  it('pl: definicja „w oknie” mówi o wcześniejszym przyjeździe', () => {
    const s = t('pl', 'a6_dr_eta_howto');
    expect(s).toContain('„w oknie”');
    expect(s).toContain('nie ostrzega o przyjeździe przed terminem');
    expect(s).toContain('Wysoka / Średnia / Niska');
  });
  it('progi pewności w kodzie = progi w opisie', () => {
    expect(etaConfidenceFromMinutes(60)).toBe('HIGH');
    expect(etaConfidenceFromMinutes(61)).toBe('MED');
    expect(etaConfidenceFromMinutes(240)).toBe('MED');
    expect(etaConfidenceFromMinutes(241)).toBe('LOW');
    expect(etaConfidenceFromMinutes(null)).toBe('LOW');
  });
});

describe('U-31: obsada jednoosobowa — ETA nie czyta pól C-SEP', () => {
  it('najnowsza definicja compute_load_eta nie odwołuje się do kierowców ani przepięcia', () => {
    const dir = join(__dirname, '..', 'supabase', 'migrations');
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    const withFn = files.filter((f) => /create or replace function public\.compute_load_eta/i.test(readFileSync(join(dir, f), 'utf8')));
    expect(withFn.length).toBeGreaterThan(0);
    const last = readFileSync(join(dir, withFn[withFn.length - 1]), 'utf8');
    const body = last.slice(last.search(/create or replace function public\.compute_load_eta/i));
    const fn = body.slice(0, body.indexOf('$function$', body.indexOf('$function$') + 1));
    expect(fn).not.toMatch(/driver_delivery|driver_name|trailer_swap|tractor_delivery/i);
    // odpoczynek dobowy zawsze wliczony (11 h, I-15) — brak gałęzi „dwóch kierowców”
    expect(fn).toMatch(/SE_DAILY_REST/);
    expect(fn).toMatch(/h_se := h_road_eff \+ h_rest \+ h_brk/);
  });
});
