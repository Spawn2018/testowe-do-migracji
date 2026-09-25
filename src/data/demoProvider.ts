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
import type { DataProvider, DataSnapshot } from './provider';

/** Deterministyczny zrzut demo — kolejność wywołań jak w dawnym init store (baseline). */
export function buildDemoSnapshot(): DataSnapshot {
  const seedLoads = buildSeedLoads();
  const seedRisks = buildSeedRisks(seedLoads);
  const loads = applyForceMajeureDelays(
    seedLoads.map((l) => applyEtaToLoad(l, '2026-09-23T01:00:00+02:00')),
    seedRisks,
  );
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
    invoices: buildSeedInvoices(loads),
    scheduleVersions: SCHEDULE_VERSIONS,
  };
}

export const demoProvider: DataProvider = {
  kind: 'demo',
  loadSnapshot: async () => buildDemoSnapshot(),
  apply: async () => undefined,
};
