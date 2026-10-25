/**
 * A6 F7 #556 — kontrakt: parser frontu (`src/lib/scheduleParse`) i kopii Edge
 * (`supabase/functions/_shared/ksh/scheduleParse`) muszą dawać ten sam wynik.
 * Porównanie ciał (bez linii import) + ten sam fixture przez frontowy parseSchedule.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSchedule } from '../src/lib/scheduleParse';

const ROOT = resolve(import.meta.dirname, '..');

function stripImports(src: string): string {
  return src
    .split(/\r?\n/)
    .filter((l) => !/^\s*import\s/.test(l) && !/^\s*export\s\{/.test(l))
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim();
}

const hh = {
  Wysyłka: 'SG-C1',
  Typ: 'SG',
  'Rozmiar L x W x H': '18,00 x 2,50 x 2,50',
  'Waga elementu': 2.5,
  'Ilość elementów': 1,
  'Waga transport [t]': 2.5,
  'Data załadunku': '15.11.2026',
  Przewoźnik: 'HH',
  'Data dostawy na budowę': '20.11.2026',
};

const ntg = {
  ...hh,
  Wysyłka: 'SG-C2',
  Przewoźnik: 'NTG',
};

describe('A6 scheduleParse kontrakt (src ↔ _shared)', () => {
  it('ciała plików (bez importów) są identyczne', () => {
    const front = readFileSync(resolve(ROOT, 'src/lib/scheduleParse.ts'), 'utf8');
    const edge = readFileSync(resolve(ROOT, 'supabase/functions/_shared/ksh/scheduleParse.ts'), 'utf8');
    expect(stripImports(edge)).toBe(stripImports(front));
  });

  it('ten sam fixture → HH accepted, NTG skippedCarrier', () => {
    const parsed = parseSchedule([hh, ntg, {}]);
    expect(parsed.stats.accepted).toBe(1);
    expect(parsed.stats.skippedCarrier).toBe(1);
    expect(parsed.stats.skippedEmpty).toBe(1);
    expect(parsed.rows.map((r) => r.shipmentCode)).toEqual(['SG-C1']);
  });
});
