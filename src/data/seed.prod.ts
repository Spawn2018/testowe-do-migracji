/**
 * I-0 — build produkcyjny (VITE_AUTH_MODE=supabase): zamiennik `src/data/seed.ts` BEZ danych demo.
 * Podstawiany przez wtyczkę Vite `i0-demo-swap` (vite.config.ts). Te same eksporty, puste wartości —
 * dane produkcyjne przychodzą z Supabase (store startuje pusty, BK3).
 */
import type {
  BafParams,
  Document,
  DemoUser,
  Geofence,
  Invoice,
  Load,
  LoadEvent,
  LoadMessage,
  Notification,
  Organization,
  RateRule,
  Risk,
  ScheduleVersion,
  WorkflowRule,
  WorkflowRun,
} from '../types';
export { DEMO_FX_META } from '../lib/money/demoFx';
export { applyForceMajeureDelays, buildSeedExceptions } from '../lib/seedLogic';

export const ORGS: Organization[] = [];
export const USERS: DemoUser[] = [];
export const GEOFENCES: Geofence[] = [];
export const WORKFLOWS: WorkflowRule[] = [];
export const RATE_COST: RateRule[] = [];
export const RATE_REV: RateRule[] = [];
/** Brak parametrów BAF w buildzie produkcyjnym (fasada F2.4 — prawdziwy formularz w I-2). */
export const BAF_PARAMS: BafParams = {
  indexSource: '',
  baseValue: 0,
  baseDate: '',
  currentValue: 0,
  valueDate: '',
  fuelShare: 0,
  triggerThreshold: 0,
  roundingStep: 0.01,
  floorPct: 0,
  capPct: 0,
  sourceUrl: '',
}
export function buildSeedLoads(): Load[] { return [] }
export function buildSeedEvents(_loads: Load[]): LoadEvent[] { return [] }
export function buildSeedDocuments(_loads: Load[]): Document[] { return [] }
export function buildSeedMessages(_loads: Load[]): LoadMessage[] { return [] }
export function buildSeedRisks(_loads: Load[]): Risk[] { return [] }
export function buildSeedInvoices(_loads: Load[]): Invoice[] { return [] }
export const SCHEDULE_VERSIONS: ScheduleVersion[] = [];
export const INITIAL_NOTIFICATIONS: Notification[] = [];
export const INITIAL_WORKFLOW_RUNS: WorkflowRun[] = [];
export const DRIVER_TOKENS: Record<string, string> = {};
