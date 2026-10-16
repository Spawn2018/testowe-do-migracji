/**
 * Tabela symboli w demo (E32 pkt 7, D-83) — z tabeli właściciela z 07.10 (`WYMIARY_PILOT_ZEZWOLENIA.md`: zestaw z ładunkiem,
 * pilot, rodzaj zezwolenia); „K” = Kratownice (KR), „P” = Płatwie (PL-A / PL-B po szerokości 3,40 m).
 * Moduł czysty (bez magazynu): używa go okno Awizacja i Przegląd (przez `p7Source.ts`) oraz dane demo (`seed.ts`) —
 * audyt-B B-13: zestaw w demo tylko z tej tabeli, jedno źródło.
 */
import type { Load } from '../types';
import type { SymbolSpec } from './p7Source';

const T = (symbol: string, kind: string, l: number, w: number, h: number, pilots: boolean, permit: 'FIRMA' | 'TRASA'): SymbolSpec =>
  ({ symbol, kind, set: { l, w, h }, pilots, permit });

const TABLE: Record<string, SymbolSpec> = {
  'BS-A': T('BS-A', 'Belki suwnicowe', 18.19, 2.45, 2.6, false, 'FIRMA'),
  'BS-B': T('BS-B', 'Belki suwnicowe', 18.19, 2.45, 3.1, false, 'FIRMA'),
  'BS-C': T('BS-C', 'Belki suwnicowe', 19.69, 2.45, 3.1, false, 'FIRMA'),
  KR: T('KR', 'Kratownice', 23.69, 3.52, 3.9, true, 'TRASA'),
  'PL-A': T('PL-A', 'Płatwie dachowe i stężenia', 18.19, 2.45, 3.75, false, 'FIRMA'),
  'PL-B': T('PL-B', 'Płatwie dachowe i stężenia', 18.19, 3.4, 3.75, true, 'FIRMA'),
  SG: T('SG', 'Słupy główne', 21.69, 2.45, 3.75, false, 'FIRMA'),
  SS: T('SS', 'Słupy skrajne oś A', 21.69, 3.0, 3.8, false, 'FIRMA'),
  T: T('T', 'Tężniki', 18.19, 2.45, 3.75, false, 'FIRMA'),
  TS: T('TS', 'Tężniki ściany A', 20.69, 2.45, 3.95, false, 'FIRMA'),
};

export function demoSymbolSpec(load: Pick<Load, 'code' | 'dims'>): SymbolSpec | null {
  const prefix = load.code.replace(/-\d.*$/, '').toUpperCase();
  if (prefix === 'K' || prefix === 'KR') return TABLE.KR;
  if (prefix === 'P' || prefix === 'PL') return load.dims.widthM >= 3.2 ? TABLE['PL-B'] : TABLE['PL-A'];
  return TABLE[prefix] ?? null;
}
