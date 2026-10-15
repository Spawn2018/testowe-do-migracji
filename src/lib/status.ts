import type { CorridorStage, LoadStatus } from '../types';
import { CORRIDOR_REF_COORDS, positionAlongCorridor } from './corridor';

export const STATUS_TO_STAGE: Record<LoadStatus, CorridorStage> = {
  PLANNED: 'PLAN',
  RESOURCES_PENDING: 'PLAN',
  READY: 'PLAN',
  LOADING: 'LOADING',
  IN_TRANSIT_PL: 'TO_PORT',
  AT_PORT: 'GDANSK',
  ON_FERRY: 'FERRY',
  AT_PORT_SE: 'APPROACH',
  IN_TRANSIT_SE: 'SE_ROAD',
  APPROACHING_SITE: 'APPROACH',
  UNLOADING: 'SITE',
  DELIVERED: 'DELIVERED',
  READY_TO_INVOICE: 'DELIVERED',
  INVOICED: 'DELIVERED',
  CANCELLED: 'PLAN',
  DELAYED: 'SE_ROAD',
  SILENT: 'SE_ROAD',
  DOC_MISSING: 'PLAN',
};

export const PROGRESS_OF: Record<LoadStatus, number> = {
  PLANNED: 0,
  RESOURCES_PENDING: 0.02,
  READY: 0.05,
  LOADING: 0.08,
  IN_TRANSIT_PL: 0.22,
  AT_PORT: 0.35,
  ON_FERRY: 0.48,
  AT_PORT_SE: 0.55,
  IN_TRANSIT_SE: 0.68,
  APPROACHING_SITE: 0.88,
  UNLOADING: 0.95,
  DELIVERED: 1,
  READY_TO_INVOICE: 1,
  INVOICED: 1,
  CANCELLED: 0,
  DELAYED: 0.7,
  SILENT: 0.65,
  DOC_MISSING: 0.04,
};

/** Real corridor anchors: KSH Śrem → Polferries GDN → Nynäshamn → E4 → Stalverket 20 Boden */
export const SITES = {
  loading: {
    name: 'KSH Śrem · Grunwaldzka 27C',
    address: 'Grunwaldzka 27C, 63-100 Śrem, Polska',
    lat: 52.07391,
    lng: 17.0246,
  },
  portOut: {
    name: 'Polferries Gdańsk · Terminal Ferry',
    address: 'ul. Mjr. Sucharskiego 70, Gdańsk',
    lat: 54.39,
    lng: 18.72,
  },
  portIn: {
    name: 'Terminal Nynäshamn',
    address: 'Skyttens Hälls Väg 10, Nynäshamn',
    lat: 58.9,
    lng: 17.95,
  },
  site: {
    name: 'Stegra · Stalverket 20, Boden',
    address: 'Stalverket 20, 96140 Boden, Sverige',
    lat: 65.80539,
    lng: 21.75914,
  },
} as const;

/** Permit/reference corridor polyline [lng, lat] — NOT ORS legal route */
export const CORRIDOR: [number, number][] = CORRIDOR_REF_COORDS;

export function positionAlong(progress: number): { lng: number; lat: number; heading: number } {
  const p = positionAlongCorridor(progress);
  return { lng: p.lng, lat: p.lat, heading: p.heading };
}

export function statusColor(status: LoadStatus): string {
  switch (status) {
    case 'PLANNED':
    case 'RESOURCES_PENDING':
    case 'READY':
    case 'DOC_MISSING':
      return 'var(--wt-plan)';
    case 'ON_FERRY':
      return 'var(--wt-ferry)';
    case 'DELIVERED':
    case 'READY_TO_INVOICE':
    case 'INVOICED':
      return 'var(--wt-ok)';
    case 'DELAYED':
    case 'SILENT':
      return 'var(--wt-crit)';
    case 'APPROACHING_SITE':
    case 'UNLOADING':
      return 'var(--wt-med)';
    default:
      return 'var(--wt-ok)';
  }
}

export function statusTone(status: LoadStatus): 'plan' | 'ok' | 'warn' | 'crit' | 'ferry' | 'done' {
  if (['DELAYED', 'SILENT', 'DOC_MISSING'].includes(status)) return 'crit';
  if (status === 'ON_FERRY') return 'ferry';
  if (status === 'DELIVERED' || status === 'READY_TO_INVOICE' || status === 'INVOICED') return 'done';
  if (['APPROACHING_SITE', 'UNLOADING', 'AT_PORT', 'AT_PORT_SE'].includes(status)) return 'warn';
  if (['PLANNED', 'RESOURCES_PENDING', 'READY'].includes(status)) return 'plan';
  return 'ok';
}

export const STAGE_ORDER: CorridorStage[] = [
  'PLAN',
  'LOADING',
  'TO_PORT',
  'GDANSK',
  'FERRY',
  'APPROACH',
  'SE_ROAD',
  'SITE',
  'DELIVERED',
];
