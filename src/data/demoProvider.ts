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

/** Dzień „dziś” danych startowych (zegar zamrożony baseline: 2026-09-23). */
export const DEMO_TODAY_LOCAL = '2026-09-23';
import type { DataProvider, DataSnapshot } from './provider';

/** Deterministyczny zrzut demo — kolejność wywołań jak w dawnym init store (baseline). */
export function buildDemoSnapshot(): DataSnapshot {
  const seedLoads = buildSeedLoads();
  const seedRisks = buildSeedRisks(seedLoads);
  const loadsV1 = applyForceMajeureDelays(
    seedLoads.map((l) => applyEtaToLoad(l, '2026-09-23T01:00:00+02:00')),
    seedRisks,
  );
  const invoices = buildSeedInvoices(loadsV1);
  /* M2 — dane v2 (poziom, obie wartości, migawki mnożnika i kursu) */
  const loads = attachMoneyV2(loadsV1, invoices, DEMO_TODAY_LOCAL);
  return {
    loads,
    events: buildSeedEvents(loads),
    documents: buildSeedDocuments(loads),
    messages: buildSeedMessages(loads),
    risks: seedRisks,
    exceptions: buildSeedExceptions(loads, seedRisks),
    geofences: GEOFENCES,
    workflows: WORKFLOWS,
    workflowRuns: INITIAL_WORKFLOW_RUNS,
    notifications: INITIAL_NOTIFICATIONS,
    invoices,
    scheduleVersions: SCHEDULE_VERSIONS,
  };
}

export const demoProvider: DataProvider = {
  kind: 'demo',
  loadSnapshot: async () => buildDemoSnapshot(),
  apply: async () => undefined,
};
