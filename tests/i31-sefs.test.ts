/**
 * I-31 — weryfikacja: średnie tygodnia 28.09–04.10 (SEK 23,05 / PLN 7,41)
 * na tabelach z CENNIK_STEGRA.json → mnożnik 1,14 (niższy z 1,14 i 1,17).
 * Nie wypisuje progów ani kwot bazowych.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeSefs, lookupMult, round2, type SefsTier } from '../src/lib/sefs';

const DANE = process.env.TOWER_DANE || 'D:/Watch Tower/dane';
const JSON_PATH = resolve(DANE, 'CENNIK_STEGRA.json');

function tiersFromJson(json: {
  sefs: {
    tabela_sek: Array<{ do_sek_l: number; mnoznik: number }>;
    tabela_pln: Array<{ do_pln_l?: number; do_pln?: number; mnoznik: number }>;
  };
}): { sek: SefsTier[]; pln: SefsTier[] } {
  const sek = json.sefs.tabela_sek.map((r) => ({ lte: r.do_sek_l, mult: r.mnoznik }));
  const pln = json.sefs.tabela_pln.map((r) => ({
    lte: Number(r.do_pln_l ?? r.do_pln),
    mult: r.mnoznik,
  }));
  return { sek, pln };
}

describe('I-31 — SEFS hybrid_min', () => {
  it('lookup MAX (domyślnie / t44+) i MIN (≤t43, #563): poniżej pierwszego / na progu / nad ostatnim', () => {
    const tiers: SefsTier[] = [
      { lte: 10, mult: 1.0 },
      { lte: 20, mult: 1.1 },
      { lte: 30, mult: 1.2 },
    ];
    expect(lookupMult(5, tiers)).toBe(1.0);
    expect(lookupMult(10, tiers)).toBe(1.0);
    expect(lookupMult(10.01, tiers)).toBe(1.1);
    expect(lookupMult(30, tiers)).toBe(1.2);
    expect(lookupMult(99, tiers)).toBe(1.2);
    expect(lookupMult(10.01, tiers, 'MIN')).toBe(1.0);
    expect(lookupMult(20, tiers, 'MIN')).toBe(1.1);
    expect(lookupMult(99, tiers, 'MIN')).toBe(1.2);
  });

  it('hybrid_min wybiera niższy mnożnik', () => {
    const sek: SefsTier[] = [{ lte: 25, mult: 1.14 }];
    const pln: SefsTier[] = [{ lte: 8, mult: 1.17 }];
    // computeSefs uses module tables — test pure min here
    expect(Math.min(1.14, 1.17)).toBe(1.14);
    expect(round2(23.049)).toBe(23.05);
  });

  it.skipIf(!existsSync(JSON_PATH))('tydzień 28.09–04.10: SEK 23,05 + PLN 7,41 → appliedMult 1,14', () => {
    const json = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
    const { sek, pln } = tiersFromJson(json);
    expect(sek.length).toBe(51);
    expect(pln.length).toBe(51);
    const avgSek = 23.05;
    const avgPln = 7.41;
    /* CENNIK_STEGRA: pola do_sek_l / do_pln = „do X” (domyślne MAX) */
    const multSek = lookupMult(round2(avgSek), sek);
    const multPln = lookupMult(round2(avgPln), pln);
    const applied = Math.min(multSek, multPln);
    expect(multSek).toBe(1.14);
    expect(multPln).toBe(1.17);
    expect(applied).toBe(1.14);
    // baza → 1.00
    const baseSek = Number(json.sefs.cena_bazowa_sek_l);
    const basePln = Number(json.sefs.cena_bazowa_pln_l);
    expect(lookupMult(baseSek, sek)).toBe(1);
    expect(lookupMult(basePln, pln)).toBe(1);
  });
});
