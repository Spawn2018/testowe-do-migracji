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
import { alignDemoRisks, withDemoEta } from './demoEta';
import { attachMoneyV2 } from '../lib/money/loadMoney';
import { orderNoReminders, orderNoRisks } from '../lib/orderNumbers';
import { demoChatNotices } from '../lib/p6eDemo';
import { buildSeedBills } from '../lib/invoices3';
import { invoiceOverdueRisks } from '../lib/invoiceOverdue';
import { getNowIso } from '../lib/frozenNow';
import { localDateOf } from '../lib/money/engine';
import { buildSeedSailings, linkSeedSailings } from '../lib/sailings';
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
    /* audyt 17.10 (E15): transporty w oknie śledzenia z ETA i szczegółami jak z serwera */
    seedLoads.map((l) => withDemoEta(applyEtaToLoad(l, DEMO_NOW))),
    seedRisks,
  );
  const invoices = buildSeedInvoices(loadsV1);
  /* M2 — dane v2 (poziom, obie wartości, migawki mnożnika i kursu) */
  const loads = attachMoneyV2(loadsV1, invoices, DEMO_TODAY_LOCAL);
  /* M5 — brak numeru zlecenia przed terminem → kolejka ryzyk (lustro detect_missing_order_numbers) */
  /* audyt 17.10 (F7): teksty spraw z tych samych liczb co transport (okno, cisza GPS, załadunek) */
  const bills = buildSeedBills(loads, DEMO_TODAY_LOCAL);
  /* A4 (wyglad/W-faktura-termin): faktura nieopłacona po terminie → sprawa HHL (lustro bazy). Przy zegarze baseline
     (23.09) żadna faktura demo nie jest po terminie; widać ją przy późniejszej dacie (?now=…) */
  const nowIso = getNowIso();
  const risks = [...alignDemoRisks(seedRisks, loads), ...orderNoRisks(loads, DEMO_NOW), ...invoiceOverdueRisks(bills, localDateOf(nowIso), nowIso)];
  const sailings = buildSeedSailings();
  const messages = buildSeedMessages(loads);
  return {
    loads: linkSeedSailings(loads, sailings),
    events: buildSeedEvents(loads),
    documents: buildSeedDocuments(loads),
    messages,
    risks,
    exceptions: buildSeedExceptions(loads, risks),
    geofences: GEOFENCES,
    workflows: WORKFLOWS,
    workflowRuns: INITIAL_WORKFLOW_RUNS,
    notifications: [...orderNoReminders(risks, '2026-09-23T00:30:00+02:00'), ...INITIAL_NOTIFICATIONS, ...demoChatNotices(loads, messages)],
    invoices,
    /* M6 — faktury v2 (osobny wycinek; nie zmienia poziomu/marży transportów do G4) */
    bills,
    /* M10 — rozkład rejsów (dane startowe); transport ↔ rejs tylko przy zgodnej rezerwacji */
    sailings,
    scheduleVersions: SCHEDULE_VERSIONS,
  };
}

export const demoProvider: DataProvider = {
  kind: 'demo',
  loadSnapshot: async () => buildDemoSnapshot(),
  apply: async () => undefined,
};
