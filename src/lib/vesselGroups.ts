/**
 * DP-8 (F7 #670): lista statków do „Dodaj rejs” z tabeli `vessels` (nowy statek armatora pojawia się sam).
 * Nazwy bez przedrostka „M/F”, armator rozpoznany z tekstu (`operatorFromText`). Zapas: stała lista BN9-b
 * (tryb demo, błąd odczytu, pusta tabela).
 */
import { OPERATOR_MATCH_ORDER, operatorFromText, type FerryOperator } from './ferryCatalog';

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
  return OPERATOR_MATCH_ORDER.filter((op) => by.has(op)).map((op) => ({ op, names: by.get(op)! }));
}

/** Armator statku z listy (ręczny rejs zapamiętuje armatora statku, nie pierwszego armatora trasy). */
export function vesselOperator(groups: readonly VesselGroup[], vessel: string): FerryOperator | undefined {
  return groups.find((g) => g.names.includes(vessel))?.op;
}
