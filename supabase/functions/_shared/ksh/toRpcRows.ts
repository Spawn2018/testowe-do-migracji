/** A6 — ParsedRow → argument import_schedule(p_rows). Lustro src/lib/scheduleImportRpc.ts. */
import type { ParsedRow } from './scheduleParse.ts';

export type RpcRow = {
  code: string;
  item_type: string | null;
  cargo_class?: 'STANDARD';
  length_m: number | null;
  width_m: number | null;
  height_m: number | null;
  unit_weight_t: number | null;
  qty: number;
  total_weight_t: number | null;
  load_date: string | null;
  load_time: string | null;
  delivery_date: string | null;
  delivery_time: string | null;
  carrier_order_no: string | null;
  hhl_order_no: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  driver_delivery_name: string | null;
  driver_delivery_phone: string | null;
  tractor_plate: string | null;
  tractor_delivery_plate: string | null;
  trailer_plate: string | null;
  comment: string | null;
  dates_to_check: boolean;
  assembly_seq: number | null;
};

export function toRpcRows(rows: readonly ParsedRow[]): RpcRow[] {
  return rows.map((r) => ({
    code: r.shipmentCode,
    item_type: r.itemType == null ? null : String(r.itemType).trim() || null,
    ...(r.cargoClass === 'STANDARD' ? { cargo_class: 'STANDARD' as const } : {}),
    length_m: r.lengthM,
    width_m: r.widthM,
    height_m: r.heightM,
    unit_weight_t: r.unitWeightT,
    qty: r.qty,
    total_weight_t: r.totalWeightT,
    load_date: r.loadDate,
    load_time: r.loadTime,
    delivery_date: r.deliveryDate,
    delivery_time: r.deliveryTime,
    carrier_order_no: r.scxOrderNo,
    hhl_order_no: r.hhlOrderNo,
    driver_name: r.driverName,
    driver_phone: r.driverPhone,
    driver_delivery_name: r.driverNameSe,
    driver_delivery_phone: r.driverPhoneSe,
    tractor_plate: r.tractorPlate,
    tractor_delivery_plate: r.tractorPlateSe,
    trailer_plate: r.trailerPlate,
    comment: r.comment,
    dates_to_check: Boolean(r.datesToCheck),
    assembly_seq: r.assemblySeq,
  }));
}
