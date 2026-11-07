/**
 * DP-233 (#861): filtr Harmonogramu Załadunki/Rozładunki · dziś/jutro
 * (Europe/Warsaw) + sortowanie po godzinie awizacji.
 */
import type { Load } from '../types';
import { todayPl } from './schedLayout';

export type SchedDayKind = 'loading' | 'unloading';
export type SchedDayOffset = 'today' | 'tomorrow';
export type ClientVariant = 'LOADING' | 'UNLOADING' | null;

const addDay = (ymd: string, n: number): string => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/** Data docelowa filtra (RRRR-MM-DD, Europe/Warsaw). */
export function schedDayYmd(nowIso: string, offset: SchedDayOffset): string {
  const today = todayPl(nowIso);
  return offset === 'today' ? today : addDay(today, 1);
}

export function defaultDayKind(variant: ClientVariant | undefined | null): SchedDayKind | null {
  if (variant === 'LOADING') return 'loading';
  if (variant === 'UNLOADING') return 'unloading';
  return null;
}

function planDay(l: Load, kind: SchedDayKind): string {
  return (kind === 'loading' ? l.plannedLoadDate : l.plannedDeliverDate ?? '').slice(0, 10);
}

function windowStart(l: Load, kind: SchedDayKind): string | null {
  if (kind === 'loading') {
    return l.planDates?.loadFrom ?? l.awizacja?.loadWindowStart ?? null;
  }
  return l.planDates?.deliveryFrom ?? l.awizacja?.unloadWindowStart ?? null;
}

/** Sort key godziny: ISO/czas → leksykograficznie; brak godziny → na końcu. */
function hourKey(iso: string | null | undefined): string {
  if (!iso) return '\uffff';
  const s = String(iso).trim();
  if (!s) return '\uffff';
  /* pełny ISO albo HH:MM — oba sortują się rosnąco jako string */
  const t = Date.parse(s);
  if (Number.isFinite(t)) return new Date(t).toISOString();
  return s;
}

function orderKey(l: Load): string {
  return (l.hhlOrderNo || l.orderNo || l.code || '').toString();
}

export function matchSchedDay(l: Load, kind: SchedDayKind, ymd: string): boolean {
  return planDay(l, kind) === ymd;
}

export function countSchedDay(list: readonly Load[], kind: SchedDayKind, ymd: string): number {
  return list.reduce((n, l) => n + (matchSchedDay(l, kind, ymd) ? 1 : 0), 0);
}

/** Filtr + sort: godzina rosnąco, bez godziny na końcu, potem nr zlecenia. */
export function applySchedDayFilter(
  list: readonly Load[],
  kind: SchedDayKind | null,
  ymd: string,
): Load[] {
  if (!kind) return [...list];
  const filtered = list.filter((l) => matchSchedDay(l, kind, ymd));
  return filtered.sort((a, b) => {
    const ha = hourKey(windowStart(a, kind));
    const hb = hourKey(windowStart(b, kind));
    if (ha !== hb) return ha < hb ? -1 : 1;
    const oa = orderKey(a);
    const ob = orderKey(b);
    if (oa !== ob) return oa < ob ? -1 : 1;
    return (a.code || '').localeCompare(b.code || '', 'pl');
  });
}
