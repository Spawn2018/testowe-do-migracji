import type { RoleId } from '../types';

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
  | 'options';

const NAV_BY_ROLE: Record<RoleId, NavKey[]> = {
  HHL: ['dash', 'map', 'sched', 'risk', 'docs', 'fin', 'inv', 'wf', 'geo', 'options'],
  KSH: ['dash', 'map', 'sched', 'risk', 'docs', 'fin'],
  SCX: ['dash', 'map', 'sched', 'risk', 'docs', 'fin', 'inv', 'tasks'],
};

export function navForRole(role: RoleId): NavKey[] {
  return NAV_BY_ROLE[role];
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

export function canImportSchedule(role: RoleId): boolean {
  return role === 'KSH';
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
