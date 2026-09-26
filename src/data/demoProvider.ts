/**
 * BK3 — DemoProvider: dane startowe (seed). Źródło dla baseline.mjs, testów
 * wizualnych i trybu bez Supabase. Zapisy = no-op (store jest lokalnym źródłem,
 * utrwalanym w localStorage v2). Dane demo NIGDY nie są wysyłane na serwer.
 */
import {
  GEOFENCES,
  INITIAL_NOTIFICATIONS,
  INITIAL_WORKFLOW_RUNS,
  SCHEDULE_VERSIONS,
  WORKFLOWS,
  applyForceMajeureDelays,
  buildSeedDocuments,
  buildSeedEvents,
  buildSeedExceptions,
  buildSeedInvoices,
  buildSeedLoads,
  buildSeedMessages,
  buildSeedRisks,
} from './seed';
import { applyEtaToLoad } from '../lib/eta';
import { attachMoneyV2 } from '../lib/money/loadMoney';
import { orderNoReminders, orderNoRisks } from '../lib/orderNumbers';
import type { Load } from '../types';

/** Dzień „dziś” danych startowych (zegar zamrożony baseline: 2026-09-23). */
export const DEMO_TODAY_LOCAL = '2026-09-23';
import type { DataProvider, DataSnapshot } from './provider';

/** Zegar danych startowych (jak ETA). */
const DEMO_NOW = '2026-09-23T01:00:00+02:00';

/**
 * M5 — transporty demo bez numeru zlecenia. Pusto do G4: dane startowe mają trzy numery (D12),
 * a ryzyko „brak numeru” powstaje w demo po usunięciu numeru w szufladzie (store → orderNoRisks).
 * Wpis tutaj zmienia kokpit (kolejka wyjątków) — tylko razem z przeliczeniem wzorca wizualnego.
 */
const DEMO_MISSING_ORDER_NO: Record<string, Partial<Pick<Load, 'hhlOrderNo' | 'carrierOrderNo'>>> = {};

/** Deterministyczny zrzut demo — kolejność wywołań jak w dawnym init store (baseline). */
export function buildDemoSnapshot(): DataSnapshot {
  const seedLoads = buildSeedLoads().map((l) => (DEMO_MISSING_ORDER_NO[l.code] ? { ...l, ...DEMO_MISSING_ORDER_NO[l.code] } : l));
  const seedRisks = buildSeedRisks(seedLoads);
  const loadsV1 = applyForceMajeureDelays(
    seedLoads.map((l) => applyEtaToLoad(l, DEMO_NOW)),
    seedRisks,
  );
  const invoices = buildSeedInvoices(loadsV1);
  /* M2 — dane v2 (poziom, obie wartości, migawki mnożnika i kursu) */
  const loads = attachMoneyV2(loadsV1, invoices, DEMO_TODAY_LOCAL);
  /* M5 — brak numeru zlecenia przed terminem → kolejka ryzyk (lustro detect_missing_order_numbers) */
  const risks = [...seedRisks, ...orderNoRisks(loads, DEMO_NOW)];
  return {
    loads,
    events: buildSeedEvents(loads),
    documents: buildSeedDocuments(loads),
    messages: buildSeedMessages(loads),
    risks,
    exceptions: buildSeedExceptions(loads, risks),
    geofences: GEOFENCES,
    workflows: WORKFLOWS,
    workflowRuns: INITIAL_WORKFLOW_RUNS,
    notifications: [...orderNoReminders(risks, '2026-09-23T00:30:00+02:00'), ...INITIAL_NOTIFICATIONS],
    invoices,
    scheduleVersions: SCHEDULE_VERSIONS,
  };
}

export const demoProvider: DataProvider = {
  kind: 'demo',
  loadSnapshot: async () => buildDemoSnapshot(),
  apply: async () => undefined,
};
