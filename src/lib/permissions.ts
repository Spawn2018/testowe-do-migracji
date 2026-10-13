import type { Load, RoleId } from '../types';
import { getNowMs } from './frozenNow';
import { TZ_UNLOAD_SE, calendarDayNoonMs, parseInstant } from './time';
import { canSeeWorkflows, isPreviewReadOnly } from './prodFacade';

/** E9-7: w Podglądzie KSH/SCX (supabase) brak zapisu w UI. */
function allowWrite(role: RoleId): boolean {
  return !isPreviewReadOnly({ viewRole: role });
}

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
  // E9: „Moje zadania” SCX znika — praca w „Do zrobienia” (risk); widok tasks zostaje w kodzie bez pozycji menu
  SCX: ['dash', 'map', 'sched', 'risk', 'docs', 'fin', 'inv', 'settings'],
}

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
  return allowWrite(role) && role === 'HHL';
}

export function canEditWorkflow(role: RoleId): boolean {
  return allowWrite(role) && role === 'HHL';
}

/**
 * I-1 / I-2a: import harmonogramu wyłącznie HHL — tak samo jak baza (import_schedule: is_hhl()).
 * I-2a: także w demo (wcześniej demo pokazywało import KSH — niezgodnie z produkcją).
 */
export function canImportSchedule(role: RoleId, _prod?: boolean): boolean {
  return allowWrite(role) && role === 'HHL';
}

export function canSubmitInvoice(role: RoleId): boolean {
  return allowWrite(role) && role === 'SCX';
}

export function canMatchInvoice(role: RoleId): boolean {
  return allowWrite(role) && role === 'HHL';
}

export function canEditResources(role: RoleId): boolean {
  return allowWrite(role) && (role === 'SCX' || role === 'HHL');
}

/**
 * E25 — ręczna zmiana statusu: HHL_ADMIN + SCX (Dyspozytor/Użytkownik).
 * HHL_OPS i KSH — tylko podgląd (decyzja 07.10 17:46).
 * Demo (bez profilu bazy): HHL i SCX jak dziś.
 */
export function canChangeLoadStatus(role: RoleId, appRole?: string | null): boolean {
  if (!allowWrite(role)) return false;
  if (appRole) {
    return appRole === 'HHL_ADMIN' || appRole === 'CARRIER_DISPATCH' || appRole === 'CARRIER_USER';
  }
  return role === 'HHL' || role === 'SCX';
}


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
 * I-7a — widoczność telefonu kierowcy.
 * HHL / SCX / KSH: zawsze (gdy jest). KSH = własny projekt (RLS + load_driver_contacts).
 */
export function canSeeDriverPhone(
  role: RoleId,
  load: Pick<Load, 'plannedDeliverDate' | 'etaBoden' | 'awizacja' | 'resources'>,
  _nowMs: number = getNowMs(),
): boolean {
  if (!load.resources?.driverPhone) return false;
  if (role === 'HHL' || role === 'SCX' || role === 'KSH') return true;
  return false;
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
