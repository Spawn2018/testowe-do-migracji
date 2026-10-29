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

/** D-1710: niepusty link śledzenia (telematics_vehicle_id). */
export function hasTrackingLink(load: LoadMatchRow): boolean {
  return Boolean(String(load.telematics_vehicle_id ?? '').trim());
}

/** E27 / A1: od 03:00 dnia załadunku do „Dostarczone”; D-1710: tylko przy linku. */
export function loadInTrackingWindow(load: LoadMatchRow, atIso: string): boolean {
  const status = String(load.status ?? '').toUpperCase();
  if (CLOSED.has(status)) return false;
  if (!hasTrackingLink(load)) return false;
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

/**
 * #622: tokeny tablicy — separatory między numerami: ` - `, `/`, `,`
 * (spacje wewnątrz jednego nr zostawia normalizePlate). Pełny numer, bez fragmentów.
 */
export function plateTokens(s: string | null | undefined): string[] {
  const raw = String(s ?? '').trim();
  if (!raw) return [];
  const parts = raw.split(/\s*[-/,]\s*/)
    .map((t) => normalizePlate(t))
    .filter((t) => t.length > 0);
  return [...new Set(parts)];
}

/** Numer naczepy WT: pierwszy token (przy jednym — on sam). */
export function primaryTrailerToken(trailerPlate: string | null | undefined): string {
  return plateTokens(trailerPlate)[0] ?? '';
}

/**
 * #622: primary WT ∈ tokenów textId, albo textId (jeden token) = któryś token WT.
 * Przypadek SG-21: WT „A - B”, textId „A” → true; textId z dwoma vs WT z jednym → true.
 */
export function trailerPlateTokensMatch(
  trailerPlate: string | null | undefined,
  textId: string | null | undefined,
): boolean {
  const wt = plateTokens(trailerPlate);
  const em = plateTokens(textId);
  if (wt.length === 0 || em.length === 0) return false;
  if (em.includes(wt[0]!)) return true;
  if (em.length === 1 && wt.includes(em[0]!)) return true;
  return false;
}

/** Ile transportów w oknie ma tę samą naczepę (reguła tokenów #622). 0 albo 1 → 0. */
export function ambiguousMatchCount(fix: EmtrackObjectFix, loads: LoadMatchRow[]): number {
  if (!plateTokens(fix.textId).length) return 0;
  const at = fix.observedAt || new Date().toISOString();
  const n = loads.filter(
    (l) => loadInTrackingWindow(l, at) && trailerPlateTokensMatch(l.trailer_plate, fix.textId),
  ).length;
  return n > 1 ? n : 0;
}

/** Link emtrack (adres aplikacji / WS) — na produkcji często `https://emtrack.eu/app/`. */
export function isEmtrackTrackingLink(link: string): boolean {
  return /emtrack\.eu/i.test(String(link ?? '').trim());
}

/**
 * D-1710 / #368: dopasowanie tylko przy niepustym linku.
 * Równość z id/naczepą w polu linku; albo link emtrack + naczepa ↔ textId (tokeny #622).
 * Bez dopasowania po samej naczepie przy pustym linku (SG-15/16).
 */
export function matchFixToLoad(fix: EmtrackObjectFix, loads: LoadMatchRow[]): LoadMatchRow | null {
  const plate = normalizePlate(fix.textId);
  const idStr = String(fix.trackingObjectId);
  const at = fix.observedAt || new Date().toISOString();
  const active = loads
    .filter((l) => loadInTrackingWindow(l, at))
    .sort((a, b) => (a.plannedLoadDate ?? '').localeCompare(b.plannedLoadDate ?? '') || a.id.localeCompare(b.id));
  const hit = (l: LoadMatchRow) => {
    const t = String(l.telematics_vehicle_id ?? '').trim();
    if (!t) return false;
    if (t === plate || t === idStr || (plate !== '' && normalizePlate(t) === plate)) return true;
    if (isEmtrackTrackingLink(t) && trailerPlateTokensMatch(l.trailer_plate, fix.textId)) return true;
    return false;
  };
  return active.find(hit) ?? null;
}
