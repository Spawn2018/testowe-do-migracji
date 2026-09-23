import type { Load } from '../types';
import {
  COLUMN_MAP_DEFAULT,
  diffSchedule,
  parseSchedule,
  type ColumnMap,
  type ParsedRow,
} from './scheduleParse';
import { readXlsxRows } from './xlsxRead';

export type ImportDiff = {
  added: Partial<Load>[];
  changed: { id: string; patch: Partial<Load>; criticalDate?: boolean }[];
  removedIds: string[];
  rejected: number;
  warnings: number;
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
    lengthM: l.dims.lengthM,
    widthM: l.dims.widthM,
    heightM: l.dims.heightM,
    unitWeightT: null,
    qty: l.qty,
    totalWeightT: l.dims.weightT,
    loadDate: l.plannedLoadDate,
    loadTime: null,
    deliveryDate: l.plannedDeliverDate,
    deliveryTime: null,
    orderNo: null,
    driverName: l.resources.driverName,
    driverPhone: l.resources.driverPhone,
    assemblySeq: null,
    hasAwizacja: l.awizacja.confirmed,
  };
}

function rowToPartialLoad(row: ParsedRow): Partial<Load> {
  return {
    code: row.shipmentCode,
    itemType: typeFromCode(row.shipmentCode, row.itemType),
    dims: {
      lengthM: row.lengthM,
      widthM: row.widthM,
      heightM: row.heightM,
      weightT: row.totalWeightT ?? row.unitWeightT ?? 0,
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

  // Schedule files are partial updates. Never infer deletion from a missing row;
  // removals require an explicit destructive operation outside this dry-run.
  return {
    added: parsed.stats.accepted === 0 ? [] : diff.added.map(rowToPartialLoad),
    changed: parsed.stats.accepted === 0 ? [] : changed,
    removedIds: [],
    rejected: parsed.stats.rejected,
    warnings: parsed.stats.warnings,
    filename,
    accepted: parsed.stats.accepted,
    total: parsed.stats.total,
    issues: parsed.issues
      .filter((i) => i.severity === 'ERROR')
      .slice(0, 12)
      .map((i) => ({ code: i.code, message: i.message, shipmentCode: i.shipmentCode })),
  };
}
