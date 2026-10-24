/**
 * BK3 — warstwa danych. Jeden kontrakt, dwóch dostawców:
 *  - DemoProvider     — dane startowe (seed); źródło dla baseline.mjs i testów
 *  - SupabaseProvider — produkcja (RLS z 0001/0005/0006), ładowany leniwie
 * Zustand = pamięć podręczna: w trybie Supabase dane przychodzą z serwera przy
 * logowaniu, a zapisy idą przez `writeThrough` do serwera.
 */
import type {
  Bill, BillVerification, Document, ExceptionItem, Geofence, Invoice, Load, LoadEvent, LoadMessage, LoadStatus,
  LoadResources, Awizacja, FerryBooking, Notification, Risk, Sailing, ScheduleVersion, WorkflowRule, WorkflowRun,
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
  /** M6 — faktury v2 (MECHANIZM_PIENIEDZY §6). */
  bills: Bill[];
  /** M10 — rozkład rejsów */
  sailings: Sailing[];
  scheduleVersions: ScheduleVersion[];
}

export const DATA_SNAPSHOT_KEYS = [
  'loads', 'events', 'documents', 'messages', 'risks', 'exceptions', 'geofences',
  'workflows', 'workflowRuns', 'notifications', 'invoices', 'bills', 'scheduleVersions',
] as const satisfies readonly (keyof DataSnapshot)[];

export function emptySnapshot(): DataSnapshot {
  return {
    loads: [], events: [], documents: [], messages: [], risks: [], exceptions: [], geofences: [],
    workflows: [], workflowRuns: [], notifications: [], invoices: [], bills: [], sailings: [], scheduleVersions: [],
  };
}

/** Zapisy przekazywane do dostawcy (write-through ze store). */
export type DataMutation =
  /** E25: ręczna zmiana przez `load_status_set` (czas + notatka); `unloadedAt` = legacy alias czasu dostawy */
  | { type: 'load.status'; loadId: string; status: LoadStatus; unloadedAt?: string; occurredAt?: string; note?: string | null }
  /** M9 — pozycja z aplikacji kierowcy → report_position() → process_position() (strefy, automat statusów) */
  | { type: 'position.report'; loadId: string; lat: number; lng: number; at: string; accuracy: number | null; speedKmh: number | null; heading: number | null }
  | { type: 'load.resources'; loadId: string; patch: Partial<LoadResources> }
  | { type: 'load.awizacja'; loadId: string; patch: Partial<Awizacja> }
  | { type: 'load.ferry'; loadId: string; patch: Partial<FerryBooking> }
  | { type: 'event.append'; event: Omit<LoadEvent, 'id'> }
  | { type: 'message.send'; loadId: string; text: string; visibleTo?: 'ALL' | 'HHL_SCX' }
  | { type: 'geofence.save'; geofence: Geofence; reason?: string | null }
  | { type: 'geofence.delete'; id: string }
  | { type: 'prefs.save'; prefs: UserPrefsPatch }
  /** M5 — numer zlecenia własnej strony (HHL → hhl_order_no, przewoźnik → carrier_order_no) */
  | { type: 'load.orderNo'; loadId: string; side: 'HHL' | 'CARRIER'; value: string | null }
  /** M6 — faktury v2: rejestracja (PDF → Storage, potem RPC register_invoice), weryfikacja, płatność */
  | { type: 'bill.register'; bill: Bill; file: Blob | null }
  | { type: 'bill.verify'; billId: string; verification: BillVerification; note: string | null }
  /** A4 / D-20261020-0115-01 — edycja faktury (`update_invoice`): nowa treść, nowy PDF (opcjonalnie), powód zmiany */
  | { type: 'bill.update'; billId: string; bill: Bill; file: Blob | null; note: string | null }
  | { type: 'bill.paid'; billId: string; paidAt: string }
  | { type: 'bill.unpaid'; billId: string; reason: string }
  /** M7 — centrum powiadomień: przeczytane (własne wiersze IN_APP; id serwera bez prefiksu `srv-`) */
  | { type: 'notifications.read'; ids: number[] }
  /** M10 — rozkład rejsów (wyłącznie HHL): dodanie / opóźnienie / odwołanie */
  | { type: 'sailing.save'; sailing: Sailing; isNew: boolean }
  /** M10 — przypisanie rejsu do transportu (HHL i przewoźnik; po wypłynięciu wyłącznie HHL) */
  | { type: 'load.sailing'; loadId: string; sailingId: string | null; bookingRef: string | null }
  /** ANEKS 3 §2.1 — import: anulowanie (nigdy DELETE) → import_cancel_loads(); baza sprawdza status i faktury */
  | { type: 'loads.importCancel'; loadIds: string[]; reason: string }
  /** 9.4 — Automatyzacje (0094): zapis reguł przez API (RLS wf_all — HHL_ADMIN; walidacja wf_validate w bazie) */
  | { type: 'workflow.create'; rule: Omit<WorkflowRule, 'id' | 'runCount'>; reason?: string | null }
  | { type: 'workflow.update'; id: string; patch: Partial<Omit<WorkflowRule, 'id' | 'runCount'>>; reason?: string | null }
  | { type: 'workflow.delete'; id: string; reason?: string | null };

/** M4 — ustawienia użytkownika (`user_preferences`); motyw null = domyślny dla roli. B9: bez języka (panel tylko PL). */
export interface UserPrefsPatch {
  displayCurrency?: 'EUR' | 'PLN';
  theme?: 'light' | 'dark' | null;
}

export interface DataProvider {
  readonly kind: ProviderKind;
  /** Pełny odczyt danych widocznych dla bieżącego użytkownika. */
  loadSnapshot(): Promise<DataSnapshot>;
  /** Zapis; demo = no-op (store jest lokalnym źródłem). Zwraca nowe id dla wstawień. */
  /** `warning` — zapis się udał, ale krok dodatkowy nie (komunikat zamiast „Nie zapisano”). */
  apply(m: DataMutation): Promise<{ id?: string; warning?: string } | void>;
  /** M4 — zapisane ustawienia bieżącego użytkownika (null = brak wiersza / demo). */
  loadPreferences?(): Promise<UserPrefsPatch | null>;
}
