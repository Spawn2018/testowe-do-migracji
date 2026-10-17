/**
 * Dopasowanie naczepa (emtrack textId) → transport — jak TELM-2.
 */
import { normalizePlate, type EmtrackObjectFix } from './emtrackWeb.ts';

export interface LoadMatchRow {
  id: string;
  trailer_plate: string | null;
  telematics_vehicle_id: string | null;
  status: string | null;
  /** Dzień załadunku z planu KSH (L15). */
  plannedLoadDate?: string | null;
  /** Ustawione, gdy okno już się otworzyło — późniejsza zmiana daty go nie zamyka. */
  trackingOpenedAt?: string | null;
}

const CLOSED = new Set([
  'DONE', 'CANCELLED', 'CANCELED', 'ARCHIVED', 'ZAKONCZONY', 'ANULOWANY',
  'DELIVERED', 'UNLOADED', 'READY_TO_INVOICE', 'INVOICED',
]);

/** 03:00 czasu polskiego w dniu załadunku (L16). */
export function trackingWindowStartMs(planLoadDate: string): number {
  const day = planLoadDate.slice(0, 10);
  const [y, m, d] = day.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d, 3, 0, 0);
  const offset = (ms: number) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Warsaw', hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(ms));
    const map = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
    const asUtc = Date.UTC(+map.year, +map.month - 1, +map.day, +map.hour % 24, +map.minute, +map.second);
    return asUtc - ms;
  };
  let utc = wall - offset(wall);
  utc = wall - offset(utc);
  return utc;
}

/** E27 / A1: od 03:00 dnia załadunku do „Dostarczone”. */
export function loadInTrackingWindow(load: LoadMatchRow, atIso: string): boolean {
  const status = String(load.status ?? '').toUpperCase();
  if (CLOSED.has(status)) return false;
  const at = Date.parse(atIso);
  if (!Number.isFinite(at)) return false;
  if (load.trackingOpenedAt) {
    const opened = Date.parse(load.trackingOpenedAt);
    if (Number.isFinite(opened) && at >= opened) return true;
  }
  const day = load.plannedLoadDate?.slice(0, 10);
  if (!day) return false;
  return at >= trackingWindowStartMs(day);
}

/** Preferuj telematics_vehicle_id, potem rejestracja naczepy. Ta sama naczepa → wcześniejszy niedostarczony w oknie. */
export function matchFixToLoad(fix: EmtrackObjectFix, loads: LoadMatchRow[]): LoadMatchRow | null {
  const plate = normalizePlate(fix.textId);
  const idStr = String(fix.trackingObjectId);
  const at = fix.observedAt || new Date().toISOString();
  const active = loads
    .filter((l) => loadInTrackingWindow(l, at))
    .sort((a, b) => (a.plannedLoadDate ?? '').localeCompare(b.plannedLoadDate ?? '') || a.id.localeCompare(b.id));
  const hit = (l: LoadMatchRow) => {
    const t = String(l.telematics_vehicle_id ?? '');
    return t === plate || t === idStr || (plate !== '' && normalizePlate(t) === plate);
  };
  const byTel = active.find(hit);
  if (byTel) return byTel;
  if (!plate) return null;
  return active.find((l) => normalizePlate(l.trailer_plate) === plate) ?? null;
}
