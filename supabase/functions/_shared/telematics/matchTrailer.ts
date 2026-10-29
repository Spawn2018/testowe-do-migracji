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

/** Separatory między numerami (#622 F7 / #623): myślnik tylko ze spacją z ≥1 strony; / , ; + */
const PLATE_SEP = /(?:\s[-–—]\s?|\s?[-–—]\s|\s*[/,;+]\s*)/;

/** Token A-Z0-9 (F7 r2: TS ≡ SQL — bez kropek itp.). */
export function alnumPlateToken(s: string): string {
  return String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Token ważny: ≥ 5 znaków alfanum. i ≥ 1 cyfra (F7 B2). */
export function isValidPlateToken(t: string): boolean {
  return t.length >= 5 && /\d/.test(t);
}

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
 * F7 r2 B1-bis — strona WT: tylko pełny człon między separatorami (bez sklejeń
 * fragmentów → bez tokenu z samych cyfr „12345” z „XX 12345”).
 */
export function plateTokens(s: string | null | undefined): string[] {
  const raw = String(s ?? '').trim();
  if (!raw) return [];
  const parts = raw.split(PLATE_SEP);
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const cand = alnumPlateToken(part);
    if (!isValidPlateToken(cand) || seen.has(cand)) continue;
    seen.add(cand);
    ordered.push(cand);
  }
  return ordered;
}

/**
 * F7 r2 B1-bis — strona textId: pełny człon + prefiksy od pierwszego fragmentu
 * („YY 12345” → YY, YY12345; nigdy sam „12345”).
 */
export function plateTokensEm(s: string | null | undefined): string[] {
  const raw = String(s ?? '').trim();
  if (!raw) return [];
  const parts = raw.split(PLATE_SEP);
  const ordered: string[] = [];
  const seen = new Set<string>();
  const push = (cand: string) => {
    if (!isValidPlateToken(cand) || seen.has(cand)) return;
    seen.add(cand);
    ordered.push(cand);
  };
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const frags = trimmed.split(/\s+/).map((f) => alnumPlateToken(f)).filter((t) => t.length > 0);
    let acc = '';
    for (const frag of frags) {
      acc += frag;
      push(acc);
    }
  }
  return ordered;
}

/** Numer naczepy WT: pierwszy token (przy jednym — on sam). */
export function primaryTrailerToken(trailerPlate: string | null | undefined): string {
  return plateTokens(trailerPlate)[0] ?? '';
}

/**
 * Ranking dopasowania (#622 F7 P1): 1 = pełna równość, 2 = token główny WT, 3 = dodatkowy.
 * null = brak. WT = pełne człony; textId = człony + prefiksy od pierwszego fragmentu (B1-bis).
 */
export function trailerMatchRank(
  trailerPlate: string | null | undefined,
  textId: string | null | undefined,
): 1 | 2 | 3 | null {
  const fullWt = alnumPlateToken(String(trailerPlate ?? ''));
  const fullEm = alnumPlateToken(String(textId ?? ''));
  if (fullWt && fullEm && fullWt === fullEm) return 1;
  const wt = plateTokens(trailerPlate);
  const em = plateTokensEm(textId);
  if (wt.length === 0 || em.length === 0) return null;
  const emSet = new Set(em);
  if (emSet.has(wt[0]!)) return 2;
  if (wt.some((t) => emSet.has(t))) return 3;
  return null;
}

/**
 * #622: pełna równość albo wspólny token (F7 B1).
 */
export function trailerPlateTokensMatch(
  trailerPlate: string | null | undefined,
  textId: string | null | undefined,
): boolean {
  return trailerMatchRank(trailerPlate, textId) != null;
}

/** Ile transportów w oknie ma tę samą naczepę (reguła tokenów #622). 0 albo 1 → 0. */
export function ambiguousMatchCount(fix: EmtrackObjectFix, loads: LoadMatchRow[]): number {
  if (!normalizePlate(fix.textId) && !plateTokensEm(fix.textId).length) return 0;
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
 * #622 F7 P1: pełna równość > token główny > dodatkowy; remis na najlepszym → null (sierota).
 */
export function matchFixToLoad(fix: EmtrackObjectFix, loads: LoadMatchRow[]): LoadMatchRow | null {
  const plate = normalizePlate(fix.textId);
  const idStr = String(fix.trackingObjectId);
  const at = fix.observedAt || new Date().toISOString();
  const active = loads
    .filter((l) => loadInTrackingWindow(l, at))
    .sort((a, b) => (a.plannedLoadDate ?? '').localeCompare(b.plannedLoadDate ?? '') || a.id.localeCompare(b.id));

  for (const l of active) {
    const t = String(l.telematics_vehicle_id ?? '').trim();
    if (!t) continue;
    if (t === plate || t === idStr || (plate !== '' && normalizePlate(t) === plate)) return l;
  }

  type Cand = { load: LoadMatchRow; rank: 1 | 2 | 3 };
  const cands: Cand[] = [];
  for (const l of active) {
    const t = String(l.telematics_vehicle_id ?? '').trim();
    if (!isEmtrackTrackingLink(t)) continue;
    const rank = trailerMatchRank(l.trailer_plate, fix.textId);
    if (rank != null) cands.push({ load: l, rank });
  }
  if (cands.length === 0) return null;
  const best = Math.min(...cands.map((c) => c.rank)) as 1 | 2 | 3;
  const top = cands.filter((c) => c.rank === best);
  if (top.length !== 1) return null;
  return top[0]!.load;
}
