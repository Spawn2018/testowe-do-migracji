/**
 * I-22 (SCOPE 3.2) — kreator mapowania kolumn importu: rozpoznanie układu pliku (podpis nagłówków), propozycja
 * mapowania (zapisany szablon → dokładna nazwa domyślna → dopasowanie po znormalizowanej nazwie) i braki pól wymaganych.
 * Szablon zapisuje HHL (produkcja: import_template_save, 0077; demo: pamięć przeglądarki).
 */
import { COLUMN_MAP_DEFAULT } from './importColumnMap';

export type MapField = keyof typeof COLUMN_MAP_DEFAULT;
export type PartialColumnMap = Partial<Record<MapField, string>>;
export interface ImportTemplate { id?: string; name: string; column_map: PartialColumnMap; header_signature: string }

export const MAP_FIELDS = Object.keys(COLUMN_MAP_DEFAULT) as MapField[];
/** Kreator mapowania (A6 F7): bez loadDay/delivDay — import ich nie czyta; zostają w COLUMN_MAP_DEFAULT. */
export const MAP_FIELDS_CREATOR: MapField[] = MAP_FIELDS.filter((f) => f !== 'loadDay' && f !== 'delivDay');
export const REQUIRED_FIELDS: MapField[] = ['shipmentCode', 'qty'];

export const normHeader = (h: string): string =>
  h.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Podpis układu: posortowane, znormalizowane, niepuste nagłówki. */
export function headerSignature(headers: string[]): string {
  return [...new Set(headers.map(normHeader).filter(Boolean))].sort().join('|');
}

/** Czy plik ma wszystkie nagłówki domyślnego układu KSH dla pól wymaganych (wtedy kreator niepotrzebny). */
export function defaultLayoutFits(headers: string[]): boolean {
  const set = new Set(headers);
  return REQUIRED_FIELDS.every((f) => set.has(COLUMN_MAP_DEFAULT[f]));
}

export function suggestMap(headers: string[], templates: ImportTemplate[] = []): { map: PartialColumnMap; template: ImportTemplate | null } {
  const sig = headerSignature(headers);
  const tpl = templates.find((t) => t.header_signature === sig) ?? null;
  const present = new Set(headers);
  if (tpl) {
    const map: PartialColumnMap = {};
    for (const f of MAP_FIELDS) { const h = tpl.column_map[f]; if (h && present.has(h)) map[f] = h; }
    return { map, template: tpl };
  }
  const byNorm = new Map(headers.map((h) => [normHeader(h), h]));
  const map: PartialColumnMap = {};
  for (const f of MAP_FIELDS) {
    const def = COLUMN_MAP_DEFAULT[f];
    if (present.has(def)) { map[f] = def; continue; }
    const n = byNorm.get(normHeader(def));
    if (n) map[f] = n;
  }
  return { map, template: null };
}

export function missingRequired(map: PartialColumnMap): MapField[] {
  return REQUIRED_FIELDS.filter((f) => !map[f]);
}

/** Pełna mapa dla parseSchedule: pola niezmapowane → nagłówek, którego nie ma w pliku (wartość pusta). */
export function toFullMap(map: PartialColumnMap): Record<MapField, string> {
  const out = {} as Record<MapField, string>;
  for (const f of MAP_FIELDS) out[f] = map[f] ?? `\u0000brak:${f}`;
  return out;
}

const DEMO_KEY = 'tower_import_templates_v1';
/** Demo: szablony w pamięci przeglądarki (produkcja: tabela import_column_templates). */
export function demoTemplates(): ImportTemplate[] {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY) ?? '[]') as ImportTemplate[]; } catch { return []; }
}
export function demoSaveTemplate(t: ImportTemplate): void {
  const rest = demoTemplates().filter((x) => x.header_signature !== t.header_signature);
  localStorage.setItem(DEMO_KEY, JSON.stringify([...rest, t]));
}
