/**
 * DP-8 (F7 #670): lista statków do „Dodaj rejs” z tabeli `vessels` (nowy statek armatora pojawia się sam).
 * Nazwy bez przedrostka „M/F”, armator rozpoznany z tekstu (`operatorFromText`). Zapas: stała lista BN9-b
 * (tryb demo, błąd odczytu, pusta tabela).
 */
import { FERRY_OPERATOR_CODES, LEGACY_OPERATORS, operatorFromText, outboundRoutesOf, type FerryOperator } from './ferryCatalog';

export interface VesselGroup { op: FerryOperator; names: readonly string[] }

/** BN9-b — statki wszystkich armatorów (zapas, gdy baza nie odpowie). */
export const VESSELS_FALLBACK: readonly VesselGroup[] = [
  { op: 'POLFERRIES', names: ['Wawel', 'Nova Star'] },
  { op: 'STENA', names: ['Stena Spirit', 'Stena Estelle', 'Stena Ebba'] },
  { op: 'TALLINK', names: ['Megastar', 'MyStar', 'Victoria I', 'Baltic Queen'] },
  { op: 'VIKING', names: ['Viking XPRS'] },
  { op: 'ECKERO', names: ['Finlandia', 'Finbo Cargo'] },
  { op: 'DFDS', names: ['Sirena Seaways'] },
];

/** Wiersze `vessels(name, operator)` → grupy armatorów w kolejności katalogu; statki bez rozpoznanego armatora pomijane. */
export function groupVessels(rows: readonly { name: string | null; operator: string | null }[]): VesselGroup[] {
  const by = new Map<FerryOperator, string[]>();
  for (const r of rows) {
    const name = (r.name ?? '').replace(/^M\/F\s+/i, '').trim();
    const op = operatorFromText(r.operator) ?? operatorFromText(name);
    if (!name || !op) continue;
    const list = by.get(op) ?? [];
    if (!list.includes(name)) list.push(name);
    by.set(op, list);
  }
  /* U4: kolejność armatorów jak w katalogu (Polferries, Stena, potem nowi) — także dla listy z bazy */
  return FERRY_OPERATOR_CODES.filter((op) => by.has(op)).map((op) => ({ op, names: by.get(op)! }));
}

/** Armator statku z listy (ręczny rejs zapamiętuje armatora statku, nie pierwszego armatora trasy). */
export function vesselOperator(groups: readonly VesselGroup[], vessel: string): FerryOperator | undefined {
  /* U7: bez względu na wielkość liter i przedrostek „M/F” (NOVA STAR → Polferries) */
  const key = vesselKeyOf(vessel);
  return groups.find((g) => g.names.some((n) => vesselKeyOf(n) === key))?.op;
}

/** Klucz nazwy statku: bez „M/F”, małe litery, pojedyncze spacje. */
export function vesselKeyOf(name: string | null | undefined): string {
  return (name ?? '').replace(/^M\/F\s+/i, '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * DP-4: trasa auta na promie bez przypisanego rejsu — z armatora statku.
 * U8: auto bez rejsu dostaje trasę wyjazdową armatora — to zachowanie jak dotąd dla Polferries (dawne domyślne
 * Gdańsk → Nynäshamn), teraz także dla Steny (Gdynia → Karlskrona).
 * B1: tylko armatorzy sprzed Korytarza bałtyckiego (`LEGACY_OPERATORS`: Polferries, Stena) — każdy z nich ma jedną
 * trasę wyjazdową. Nowi armatorzy (Viking: Terminal A, Tallink: kilka tras, Eckerö, DFDS) i statek nieznany → null,
 * bez zgadywania terminala i trasy.
 */
export function routeOfVessel(vessel: string | null | undefined, groups: readonly VesselGroup[] = VESSELS_FALLBACK): string | null {
  if (!vessel) return null;
  const op = vesselOperator(groups, vessel) ?? operatorFromText(vessel);
  if (!op || !LEGACY_OPERATORS.includes(op)) return null;
  const routes = outboundRoutesOf(op);
  return routes.length === 1 ? routes[0] : null;
}
