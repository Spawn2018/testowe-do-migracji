/**
 * BK3 — warstwa danych. Jeden kontrakt, dwóch dostawców:
 *  - DemoProvider     — dane startowe (seed); źródło dla baseline.mjs i testów
 *  - SupabaseProvider — produkcja (RLS z 0001/0005/0006), ładowany leniwie
 * Zustand = pamięć podręczna: w trybie Supabase dane przychodzą z serwera przy
 * logowaniu, a zapisy idą przez `writeThrough` do serwera.
 */
import type {
  Document, ExceptionItem, Geofence, Invoice, Load, LoadEvent, LoadMessage, LoadStatus,
  LoadResources, Awizacja, FerryBooking, Notification, Risk, ScheduleVersion, WorkflowRule, WorkflowRun,
} from '../types';

export type ProviderKind = 'demo' | 'supabase';

/** Wycinek stanu, który dostarcza dostawca (reszta store = UI / konfiguracja). */
export interface DataSnapshot {
  loads: Load[];
  events: LoadEvent[];
  documents: Document[];
  messages: LoadMessage[];
  risks: Risk[];
  exceptions: ExceptionItem[];
  geofences: Geofence[];
  workflows: WorkflowRule[];
  workflowRuns: WorkflowRun[];
  notifications: Notification[];
  invoices: Invoice[];
  scheduleVersions: ScheduleVersion[];
}

export const DATA_SNAPSHOT_KEYS = [
  'loads', 'events', 'documents', 'messages', 'risks', 'exceptions', 'geofences',
  'workflows', 'workflowRuns', 'notifications', 'invoices', 'scheduleVersions',
] as const satisfies readonly (keyof DataSnapshot)[];

export function emptySnapshot(): DataSnapshot {
  return {
    loads: [], events: [], documents: [], messages: [], risks: [], exceptions: [], geofences: [],
    workflows: [], workflowRuns: [], notifications: [], invoices: [], scheduleVersions: [],
  };
}

/** Zapisy przekazywane do dostawcy (write-through ze store). */
export type DataMutation =
  | { type: 'load.status'; loadId: string; status: LoadStatus }
  | { type: 'load.resources'; loadId: string; patch: Partial<LoadResources> }
  | { type: 'load.awizacja'; loadId: string; patch: Partial<Awizacja> }
  | { type: 'load.ferry'; loadId: string; patch: Partial<FerryBooking> }
  | { type: 'event.append'; event: Omit<LoadEvent, 'id'> }
  | { type: 'message.send'; loadId: string; text: string }
  | { type: 'geofence.save'; geofence: Geofence };

export interface DataProvider {
  readonly kind: ProviderKind;
  /** Pełny odczyt danych widocznych dla bieżącego użytkownika. */
  loadSnapshot(): Promise<DataSnapshot>;
  /** Zapis; demo = no-op (store jest lokalnym źródłem). Zwraca nowe id dla wstawień. */
  apply(m: DataMutation): Promise<{ id?: string } | void>;
}
