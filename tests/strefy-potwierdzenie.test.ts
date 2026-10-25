/**
 * wyglad/strefy-potwierdzenie (#557) — wyłączenie strefy w Opcjach tylko po potwierdzeniu.
 * 23.10 jednym kliknięciem na strefę wyłączono 6 stref portowych; T-12 i SG-21 utknęły w statusach portowych.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hasKey, t, tp } from '../src/i18n/messages';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

describe('strefy — potwierdzenie wyłączenia', () => {
  const v = read('src/views/OptionsView.tsx');

  it('przełącznik przy aktywnej strefie tylko otwiera pytanie, nie zapisuje', () => {
    expect(v).toMatch(/if \(g\.active\) \{ setZoneOffAsk\(g\.id\); return; \}/);
    expect(v).toMatch(/saveGeofence\(\{ \.\.\.g, active: true \}\)/);
    expect(v).not.toMatch(/saveGeofence\(\{ \.\.\.g, active: !g\.active \}\)/);
  });

  it('dopiero „Wyłącz strefę” zapisuje active: false', () => {
    expect(v).toMatch(/setZoneOffAsk\(null\); saveGeofence\(\{ \.\.\.g, active: false \}\)/);
    expect(v).toMatch(/data-zone-off-ask/);
  });

  it('strefy portowe i bufory mają ostrzeżenie o statusach', () => {
    expect(v).toMatch(/new Set<string>\(\['PORT_OUT', 'PORT_IN', 'PRE_PORT'\]\)/);
    for (const k of ['gf_off_ask', 'gf_off_ask_port', 'gf_off_ask_other', 'gf_off_yes', 'gf_off_no']) expect(hasKey('pl', k)).toBe(true);
    expect(tp('pl', 'gf_off_ask', { name: 'Terminal Nynäshamn' })).toBe('Wyłączyć strefę „Terminal Nynäshamn”?');
    expect(t('pl', 'gf_off_ask_port')).toMatch(/nie zmienią się same/);
  });
});
