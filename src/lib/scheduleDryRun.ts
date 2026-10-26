import type { Load } from '../types';
import {
  COLUMN_MAP_DEFAULT,
  diffSchedule,
  parseSchedule,
  type ColumnMap,
  type ParsedRow,
} from './scheduleParse';
import { readXlsxRows } from './xlsxRead';
import { splitRemovals, type RemovalBlocked } from './importRemoval';

export type ImportDiff = {
  added: Partial<Load>[];
  changed: { id: string; patch: Partial<Load>; criticalDate?: boolean }[];
  removedIds: string[];
  /**
   * D26 — pozycje obecne w harmonogramie, a nieobecne w pliku. NIE są usuwane domyślnie (pliki bywają
   * częściowe); usunięcie wyłącznie po zaznaczeniu zgody w podglądzie (`allowRemovals`), z liczbą i kodami.
   */
  removalCandidates: { id: string; code: string }[];
  /** ANEKS 3 §2.1 — nieobecne w pliku, ale nie do anulowania przez import (powód). */
  removalBlocked: RemovalBlocked[];
  rejected: number;
  warnings: number;
  skippedStandard: number;
  /**
   * wyglad/W-naprawy-2 · A6 (audyt 17.10): liczniki z parsera wykonawcy — wiersze innego przewoźnika (NTG), puste wiersze
   * i transporty ze sprawą „Daty KSH do sprawdzenia” (KR-03). Brak pola = parser jeszcze ich nie liczy (widok ich nie pokazuje).
   */
  skippedCarrier?: number;
  skippedEmpty?: number;
  datesToCheck?: number;
  filename: string;
  accepted: number;
  total: number;
  issues: { code: string; message: string; shipmentCode: string | null }[];
};

function typeFromCode(code: string, itemType: string | null): string {
  if (itemType && String(itemType).trim()) return String(itemType).trim();
  const m = code.match(/^([A-Za-z]+)/);
  return m ? m[1].toUpperCase() : 'SG';
}

function loadToParsed(l: Load): ParsedRow & { hasAwizacja?: boolean } {
  return {
    shipmentCode: l.code,
    itemType: l.itemType,
    cargoClass: l.dims.cargoClass === 'STANDARD' ? 'STANDARD' : 'DIMENSIONED',
    lengthM: l.dims.cargoClass === 'STANDARD' ? null : l.dims.lengthM,
    widthM: l.dims.cargoClass === 'STANDARD' ? null : l.dims.widthM,
    heightM: l.dims.cargoClass === 'STANDARD' ? null : l.dims.heightM,
    unitWeightT: null,
    qty: l.qty,
    totalWeightT: l.dims.weightT,
    loadDate: l.plannedLoadDate,
    loadTime: null,
    deliveryDate: l.plannedDeliverDate,
    deliveryTime: null,
    scxOrderNo: l.carrierOrderNo ?? null,
    hhlOrderNo: l.hhlOrderNo ?? null,
    driverName: l.resources.driverName,
    driverPhone: l.resources.driverPhone,
    driverNameSe: l.resources.driverDeliveryName ?? null,
    driverPhoneSe: l.resources.driverDeliveryPhone ?? null,
    tractorPlate: l.resources.tractorPlate,
    tractorPlateSe: l.resources.tractorDeliveryPlate ?? null,
    trailerPlate: l.resources.trailerPlate,
    comment: null,
    assemblySeq: null,
    hasAwizacja: l.awizacja.confirmed,
  };
}

function rowToPartialLoad(row: ParsedRow): Partial<Load> {
  return {
    code: row.shipmentCode,
    itemType: typeFromCode(row.shipmentCode, row.itemType),
    dims: {
      lengthM: row.lengthM ?? 0,
      widthM: row.widthM ?? 0,
      heightM: row.heightM ?? 0,
      weightT: row.totalWeightT ?? row.unitWeightT ?? 0,
      ...(row.cargoClass === 'STANDARD' ? { cargoClass: 'STANDARD' as const } : {}),
    },
    qty: row.qty,
    plannedLoadDate: row.loadDate ?? undefined,
    plannedDeliverDate: row.deliveryDate ?? undefined,
  };
}

/** Parse XLSX bytes against current loads → dry-run diff for commitImport. */
export async function dryRunFromXlsx(
  buf: ArrayBuffer,
  filename: string,
  loads: Load[],
  map: ColumnMap = COLUMN_MAP_DEFAULT as unknown as ColumnMap,
  invoiced: ReadonlySet<string> = new Set(),
): Promise<ImportDiff> {
  const raw = await readXlsxRows(buf);
  const parsed = parseSchedule(raw, map);
  const existing = loads.map(loadToParsed);
  const diff = diffSchedule(parsed.rows, existing);

  const byCode = new Map(loads.map((l) => [l.code, l]));
  const criticalCodes = new Set(diff.criticalDateChanges.map((c) => c.code));

  const changed = diff.changed
    .map((ch) => {
      const load = byCode.get(ch.code);
      if (!load) return null;
      const after = ch.after;
      const patch: Partial<Load> = {};
      if (after.deliveryDate != null) patch.plannedDeliverDate = String(after.deliveryDate);
      if (after.loadDate != null) patch.plannedLoadDate = String(after.loadDate);
      if (after.lengthM != null || after.widthM != null || after.heightM != null || after.totalWeightT != null) {
        patch.dims = {
          lengthM: Number(after.lengthM ?? load.dims.lengthM),
          widthM: Number(after.widthM ?? load.dims.widthM),
          heightM: Number(after.heightM ?? load.dims.heightM),
          weightT: Number(after.totalWeightT ?? load.dims.weightT),
        };
      }
      if (after.qty != null) patch.qty = Number(after.qty);
      if (after.itemType != null) patch.itemType = String(after.itemType);
      return {
        id: load.id,
        patch,
        criticalDate: criticalCodes.has(ch.code),
      };
    })
    .filter(Boolean) as ImportDiff['changed'];

  // Schedule files are partial updates. Never infer deletion from a missing row:
  // removedIds stays empty; missing rows are only *candidates* (D26) — removed solely with explicit consent.
  // No accepted rows (empty / broken file) → no candidates at all (P9: 72→1 wipe).
  // ANEKS 3 §2.1: kandydaci = wyłącznie transporty, które import może anulować (sprzed załadunku,
  // spoza faktur); pozostałe trafiają do `removalBlocked` z powodem — podgląd je pokazuje.
  const missing = parsed.stats.accepted === 0 ? [] : diff.removed
    .map((code) => byCode.get(code))
    .filter((l): l is Load => !!l)
    // B-8-IMP: istniejące STANDARD (NTG) nie są „brakiem w pliku” — nie proponujemy anulowania
    .filter((l) => l.dims.cargoClass !== 'STANDARD');
  const { cancellable: removalCandidates, blocked: removalBlocked } = splitRemovals(missing, invoiced);
  return {
    added: parsed.stats.accepted === 0 ? [] : diff.added.map(rowToPartialLoad),
    changed: parsed.stats.accepted === 0 ? [] : changed,
    removedIds: [],
    removalCandidates,
    removalBlocked,
    rejected: parsed.stats.rejected,
    warnings: parsed.stats.warnings,
    skippedStandard: parsed.stats.skippedStandard,
    skippedCarrier: parsed.stats.skippedCarrier,
    skippedEmpty: parsed.stats.skippedEmpty,
    datesToCheck: parsed.stats.datesToCheck,
    filename,
    accepted: parsed.stats.accepted,
    total: parsed.stats.total,
    issues: parsed.issues
      .filter((i) => i.severity === 'ERROR')
      .slice(0, 12)
      .map((i) => ({ code: i.code, message: i.message, shipmentCode: i.shipmentCode })),
  };
}
