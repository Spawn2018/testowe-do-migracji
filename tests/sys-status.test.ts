/**
 * wyglad/P10b-c — Stan systemu: dane demo i źródło (E23 pkt 1–3, E47, E19 pkt 7, E46; E21 bez kodów; G-09).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { appErrors, perfResults, securityRows, sourceHealth, sourceThresholds } from '../src/lib/sysSource';

const NOW = '2026-09-23T14:32:00Z';

describe('Stan systemu — dane', () => {
  it('źródła: 5 stanów, nazwy po polsku, bez kodów zadań; przyczyna przy każdym stanie wymagającym uwagi', () => {
    const rows = sourceHealth(NOW)!;
    expect(new Set(rows.map((r) => r.state))).toEqual(new Set(['down', 'partial', 'nomeasure', 'ok', 'nosource']));
    for (const r of rows) {
      expect(`${r.name} ${r.cadence ?? ''} ${r.feeds} ${r.why ?? ''}`).not.toMatch(/emtrack-web|route-hazards|web-push|email-budget|fuel-prices|ferry-[a-z]+|_|\bE\d+\b/i);
      if (r.state !== 'ok') expect(r.why, r.id).toBeTruthy();
    }
  });

  it('progi „Nie działa” jak w E23 pkt 3: 10 min, 15 min, 30 min, 45 min, 3 h, 26 h, 8 dni; + wiatr SMHI 2 h (E49 Z5)', () => {
    expect(sourceThresholds()!.map((r) => `${r.value} ${r.unit}`)).toEqual(['10 min', '15 min', '30 min', '45 min', '3 h', '2 h', '26 h', '8 dni']);
    expect(sourceThresholds()!.find((r) => r.key === 'SRC_WIND_H')?.value).toBe(2);
  });

  it('wyglad/audyt-E (E-09): źródło „Wiatr — SMHI” z liczbą punktów; „Zagrożenia na trasie” bez „Próg 20 m/s nie jest sprawdzany”', () => {
    const rows = sourceHealth(NOW)!;
    const wind = rows.find((r) => r.id === 'wind')!;
    expect(wind.name).toBe('Wiatr — SMHI');
    expect(wind.why).toMatch(/\d+ punktów/);
    expect(wind.why).toMatch(/2 h/);
    expect(rows.find((r) => r.id === 'hazards')!.why).not.toMatch(/Brak serii wiatru|nie jest sprawdzany/);
  });

  it('błędy: grupy po treści, stany z listy; bezpieczeństwo 5 wierszy; wydajność z progami E46', () => {
    const e = appErrors(NOW)!;
    expect(e.groups.every((g) => ['new', 'back', 'watch', 'fixed', 'known'].includes(g.state))).toBe(true);
    const sec = securityRows(NOW)!;
    expect(sec.map((r) => r.id)).toEqual(['advisor', 'anon', 'test', 'mfa', 'passwords']);
    /* E19 pkt 7: ostatni test bezpieczeństwa z datą i commitem */
    expect(sec.find((r) => r.id === 'test')!.details).toMatch(/^Niedzielna brama 20\.09\.2026, 22:00, commit [0-9a-f]{7}:/);
    expect(perfResults(NOW)!.rows.some((r) => r.limit.includes('LCP ≤ 2,5 s'))).toBe(true);
  });

  it('produkcja przed podłączeniem: dzisiejszy panel stanu (warunek trybu wpisany wprost, I-0)', () => {
    const src = readFileSync('src/lib/sysSource.ts', 'utf8');
    expect(src.match(/import\.meta\.env\.VITE_AUTH_MODE !== 'supabase'/g)?.length).toBeGreaterThanOrEqual(7);
    const ov = readFileSync('src/views/OptionsView.tsx', 'utf8');
    expect(ov).toMatch(/sourceHealth\(getNowIso\(\)\)\s*\?\s*<StatusScreen/);
    expect(ov).toMatch(/SystemStatusPanel \? block\(<SystemStatusPanel \/>\)/);
  });
});
