import type { Load, RoleId } from '../types';
import { getNowMs } from './frozenNow';
import { TZ_UNLOAD_SE, calendarDayNoonMs, parseInstant } from './time';
import { canSeeWorkflows } from './prodFacade';

export type NavKey =
  | 'dash'
  | 'map'
  | 'sched'
  | 'risk'
  | 'docs'
  | 'fin'
  | 'inv'
  | 'tasks'
  | 'wf'
  | 'geo'
  | 'options'
  | 'settings';

const NAV_BY_ROLE: Record<RoleId, NavKey[]> = {
  HHL: ['dash', 'map', 'sched', 'risk', 'docs', 'fin', 'inv', 'wf', 'geo', 'options'],
  KSH: ['dash', 'map', 'sched', 'risk', 'docs', 'fin', 'inv', 'settings'],
  SCX: ['dash', 'map', 'sched', 'risk', 'docs', 'fin', 'inv', 'tasks', 'settings'],
};

/** 9.4: moduł Automatyzacje (wf) w produkcji tylko dla HHL_ADMIN (lib/prodFacade canSeeWorkflows); demo bez zmian. */
export function navForRole(role: RoleId, prod?: boolean, userRole?: string | null): NavKey[] {
  const nav = NAV_BY_ROLE[role];
  const wf = userRole === undefined ? canSeeWorkflows(prod) : canSeeWorkflows(prod, userRole);
  return wf ? nav : nav.filter((k) => k !== 'wf');
}

export function canSeeCost(role: RoleId): boolean {
  return role === 'HHL' || role === 'SCX';
}

export function canSeeRevenue(role: RoleId): boolean {
  return role === 'HHL' || role === 'KSH';
}

export function canSeeMargin(role: RoleId): boolean {
  return role === 'HHL';
}

export function canEditGeofence(role: RoleId): boolean {
  return role === 'HHL';
}

export function canEditWorkflow(role: RoleId): boolean {
  return role === 'HHL';
}

/**
 * I-1 / I-2a: import harmonogramu wyłącznie HHL — tak samo jak baza (import_schedule: is_hhl()).
 * I-2a: także w demo (wcześniej demo pokazywało import KSH — niezgodnie z produkcją).
 */
export function canImportSchedule(role: RoleId, _prod?: boolean): boolean {
  return role === 'HHL';
}

export function canSubmitInvoice(role: RoleId): boolean {
  return role === 'SCX';
}

export function canMatchInvoice(role: RoleId): boolean {
  return role === 'HHL';
}

export function canEditResources(role: RoleId): boolean {
  return role === 'SCX' || role === 'HHL';
}


const MS_24H = 24 * 60 * 60 * 1000;

/** Instant used as "dostawa" for D6 phone window (unload start → ETA → planned noon SE). */
export function deliveryInstantMs(load: Pick<Load, 'plannedDeliverDate' | 'etaBoden' | 'awizacja'>): number | null {
  const unload = load.awizacja?.unloadWindowStart;
  if (unload) {
    const d = parseInstant(unload);
    if (d) return d.getTime();
  }
  if (load.etaBoden) {
    const d = parseInstant(load.etaBoden);
    if (d) return d.getTime();
  }
  return calendarDayNoonMs(load.plannedDeliverDate, TZ_UNLOAD_SE);
}

/**
 * D6 — driver phone visibility.
 * HHL / SCX: always (when present).
 * KSH: only within ±24 h of delivery instant.
 */
export function canSeeDriverPhone(
  role: RoleId,
  load: Pick<Load, 'plannedDeliverDate' | 'etaBoden' | 'awizacja' | 'resources'>,
  nowMs: number = getNowMs(),
): boolean {
  if (!load.resources?.driverPhone) return false;
  if (role === 'HHL' || role === 'SCX') return true;
  if (role !== 'KSH') return false;
  const at = deliveryInstantMs(load);
  if (at == null) return false;
  return Math.abs(nowMs - at) <= MS_24H;
}

/** Same phone string the schedule table shows — or null when masked. */
export function visibleDriverPhone(
  role: RoleId,
  load: Pick<Load, 'plannedDeliverDate' | 'etaBoden' | 'awizacja' | 'resources'>,
  nowMs: number = getNowMs(),
): string | null {
  if (!canSeeDriverPhone(role, load, nowMs)) return null;
  return load.resources.driverPhone;
}

/** First-paint / role-default theme (VISUAL_BRIEF §8 / START_UI_SPEC). */
export function defaultThemeForRole(role: RoleId): 'dark' | 'light' {
  if (role === 'KSH') return 'light';
  return 'dark'; // HHL, SCX
}

export function filterLoadsForRole<T extends { status: string; stage: string }>(
  loads: T[],
  _role: RoleId,
): T[] {
  return loads;
}

export const ROLE_META: Record<
  RoleId,
  { short: string; name: string; logoLight: string; logoDark: string }
> = {
  HHL: {
    short: 'HHL',
    name: 'H&H Logistics',
    logoLight: '/logos/hhl.png',
    logoDark: '/logos/hhl.png',
  },
  KSH: {
    short: 'KSH',
    name: 'KSH',
    logoLight: '/logos/ksh.svg',
    logoDark: '/logos/ksh-white.svg',
  },
  SCX: {
    short: 'SCX',
    name: 'Scandinavian Express',
    logoLight: '/logos/scx.png',
    logoDark: '/logos/scx-dark.png',
  },
};
