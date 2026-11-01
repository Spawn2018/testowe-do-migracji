/**
 * DP-139 — MMSI Victoria I / Sirena Seaways + alias AIS „VICTORIA 1”.
 * F7 #715; źródło Digitraffic AIS vessels 01.11.2026.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIG = readFileSync(
  resolve('supabase/migrations/0374_dp139_victoria_sirena_mmsi.sql'),
  'utf8',
);
const PORTNET = readFileSync(
  resolve('supabase/functions/_shared/ferry/digitrafficPortCalls.ts'),
  'utf8',
);
const TALLINN = readFileSync(
  resolve('supabase/functions/_shared/ferry/portTallinn.ts'),
  'utf8',
);

describe('DP-139 Victoria I / Sirena Seaways MMSI', () => {
  it('migracja 0374 ustawia MMSI/IMO z Digitraffic', () => {
    expect(MIG).toMatch(/mmsi = 276519000[\s\S]*imo = coalesce\(imo, 9281281\)[\s\S]*M\/F Victoria I/);
    expect(MIG).toMatch(/mmsi = 277569000[\s\S]*imo = coalesce\(imo, 9212163\)[\s\S]*M\/F Sirena Seaways/);
  });

  it('Portnet i Port Tallinn mapują AIS „victoria 1” → M/F Victoria I', () => {
    expect(PORTNET).toMatch(/'victoria 1':\s*'M\/F Victoria I'/);
    expect(TALLINN).toMatch(/'victoria 1':\s*'M\/F Victoria I'/);
  });
});
