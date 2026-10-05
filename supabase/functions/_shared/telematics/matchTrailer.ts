/**
 * Dopasowanie naczepa (emtrack textId) → transport — jak TELM-2.
 */
import { normalizePlate, type EmtrackObjectFix } from './emtrackWeb.ts';

export interface LoadMatchRow {
  id: string;
  trailer_plate: string | null;
  telematics_vehicle_id: string | null;
  status: string | null;
}

/** Preferuj telematics_vehicle_id, potem rejestracja naczepy; pomiń zakończone. */
export function matchFixToLoad(fix: EmtrackObjectFix, loads: LoadMatchRow[]): LoadMatchRow | null {
  const plate = normalizePlate(fix.textId);
  const idStr = String(fix.trackingObjectId);
  const active = loads.filter((l) => {
    const s = String(l.status ?? '').toUpperCase();
    return !['DONE', 'CANCELLED', 'CANCELED', 'ARCHIVED', 'ZAKONCZONY', 'ANULOWANY'].includes(s);
  });
  const byTel = active.find((l) => {
    const t = String(l.telematics_vehicle_id ?? '');
    return t === plate || t === idStr || normalizePlate(t) === plate;
  });
  if (byTel) return byTel;
  if (!plate) return null;
  return active.find((l) => normalizePlate(l.trailer_plate) === plate) ?? null;
}
