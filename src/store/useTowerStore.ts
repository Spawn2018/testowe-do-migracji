import { withLoadCode } from '../lib/bellList';
import { bellOffForPerson } from '../lib/forMeSource';
import { create } from 'zustand';
import { paymentBlockedByDispute } from '../lib/invoiceDispute';
import { standardSkipMessage } from '../lib/standardSkipMessage';
import { persist } from 'zustand/middleware';
import { SE_ROUTE_ALTS } from '../lib/seRouteAlts';
import type { StageTile } from '../lib/stageTiles';
import type {
  Sailing,
  AppToast,
  Awizacja,
  Bill,
  BillVerification,
  BafParams,
  Document,
  FactoringOffer,
  FerryBooking,
  Geofence,
  GeofenceType,
  Invoice,
  InvoiceFactoring,
  Load,
  LoadEvent,
  LoadMessage,
  LoadResources,
  KshPlanDatesPatch,
  LoadStatus,
  Locale,
  Notification,
  RateRule,
  Risk,
  RoleId,
  ScheduleVersion,
  WorkflowRule,
  WorkflowRun,
} from '../types';
import type { NavKey as NK } from '../lib/permissions';
import { canEditResources } from '../lib/permissions';
import { setPreviewViewRole } from '../lib/previewGate';
import { redactResourcesPatch, redactTrackingRef } from '../lib/trackingRefSafe';
import { applyThemeToDom, systemTheme, type Theme } from '../lib/theme';
export type { Theme };
import {
  STORE_PERSIST_KEY,
  STORE_SCHEMA_VERSION,
  STORE_WIPE_MESSAGE_PL,
  consumePersistWipeNotice,
  createVersionedJSONStorage,
  migrateTowerPersistForZustand,
} from '../lib/storePersist';
import type { DisplayCurrency } from '../lib/money/engine';
import {
  BAF_PARAMS,
  DRIVER_TOKENS,
  RATE_COST,
  RATE_REV,
  applyForceMajeureDelays,
  buildSeedExceptions,
} from '../data/seed';
import { buildDemoSnapshot } from '../data/demoProvider';
import { emptySnapshot } from '../data/provider';
import { hasRemoteSink, writeThrough } from '../data/registry';
import { invoicedLoadIds, removalBlock } from '../lib/importRemoval';
import { getNowIso } from '../lib/frozenNow';
import { orderEditDeniedMessage, orderGateMessage, orderNoReminders, orderNoRisks, orderNumberGate, type OrderSide } from '../lib/orderNumbers';
import { t, tp } from '../i18n/messages';
import { localDateOf } from '../lib/money/engine';
import { withMoneyV2 } from '../lib/money/loadMoney';
import { milestoneAction, type DriverFix } from '../lib/driverTracking';
import { fmtLocal, cancelledSailingRisks, checkSailingDraft, ferryFromSailing, sailingAssignDenied, type SailingDraft, type SailingDraftError, type SailingDenied } from '../lib/sailings';
import { billDueDate, billParties, billPaymentToday, canMarkPaid, canRegisterBill, canVerifyBill, checkBill, verifyError, type BillDraft } from '../lib/invoices3';
import { SUPABASE_AUTH_ENABLED } from '../auth/config';
import { PROGRESS_OF, STATUS_TO_STAGE, positionAlong } from '../lib/status';
import { applyEtaToLoad } from '../lib/eta';
import { isReadyBlocked } from '../lib/permits';
import { currentActorLabel } from '../lib/historyActor';

export type ViewKey = NK;

export interface NotificationPrefs {
  workflowAlerts: boolean;
  geofenceAlerts: boolean;
  riskAlerts: boolean;
}

/**
 * BK3: w trybie Supabase store startuje PUSTY (dane przychodzą z serwera po
 * zalogowaniu) i nie czyta/zapisuje danych demo z localStorage v2.
 */
const SUPABASE_MODE = SUPABASE_AUTH_ENABLED;
const initialData = SUPABASE_MODE ? emptySnapshot() : buildDemoSnapshot();

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** E25: bez sztucznego −2 h (dawne replace Z→+02:00); prawdziwy czas UTC / zamrożony w testach. */
function nowIso() {
  return getNowIso();
}


function resourcesComplete(r: LoadResources | undefined | null): boolean {
  if (!r) return false;
  return Boolean(
    r.driverName?.trim() &&
      r.tractorPlate?.trim() &&
      r.trailerPlate?.trim(),
  );
}

function exceptionsFromRisks(risks: Risk[], loads: Load[]) {
  return risks.map((r) => ({
    id: `ex-${r.id}`,
    severity: r.severity,
    title: r.title,
    owner: r.owner,
    meta: r.meta,
    nextAction: r.nextAction,
    ageHours: r.ageHours,
    loadId: r.loadId,
    code: r.loadId ? loads.find((l) => l.id === r.loadId)?.code : undefined,
    titleKey: r.titleKey,
    titleParams: r.titleParams,
    metaKey: r.metaKey,
    metaParams: r.metaParams,
  }));
}

/** Drop OPS «Brak kierowcy…» risks once driver+tractor+trailer are filled. */
function clearResourceGapRisks(risks: Risk[], loadId: string, complete: boolean): Risk[] {
  if (!complete) return risks;
  return risks.filter(
    (r) =>
      !(
        r.loadId === loadId &&
        r.type === 'OPS' &&
        /Brak kierowcy|numerów rejestracyjnych|Uzupełnij zasoby/i.test(
          `${r.title} ${r.nextAction ?? ''}`,
        )
      ),
  );
}


/** HHL seed defaults — editable live in Faktury admin panel. */
/* wyglad/P5 (E4b, decyzja 07.10): przykład demo jak oferta HHL — 1 % od netto, wypłata 48 h po akceptacji */
export const DEFAULT_FACTORING_OFFER: FactoringOffer = {
  enabled: true,
  feePercent: 1,
  payoutDelayValue: 48,
  payoutDelayUnit: 'hours',
  label: 'SCX Factoring',
  notes: '',
};

export function computePayoutAt(
  fromIso: string,
  delayValue: number,
  delayUnit: FactoringOffer['payoutDelayUnit'],
): string {
  const d = new Date(fromIso);
  const ms = delayUnit === 'days' ? delayValue * 24 * 60 * 60 * 1000 : delayValue * 60 * 60 * 1000;
  const out = new Date(d.getTime() + ms);
  return out.toISOString().replace('Z', '+02:00');
}

export function buildFactoringSnapshot(
  offer: FactoringOffer,
  gross: number,
  fromIso: string,
): InvoiceFactoring {
  const feeAmount = Math.round((gross * offer.feePercent) / 100 * 100) / 100;
  const netPayout = Math.round((gross - feeAmount) * 100) / 100;
  return {
    selected: true,
    feePercent: offer.feePercent,
    feeAmount,
    netPayout,
    payoutAt: computePayoutAt(fromIso, offer.payoutDelayValue, offer.payoutDelayUnit),
    delayValue: offer.payoutDelayValue,
    delayUnit: offer.payoutDelayUnit,
  };
}

interface TowerState {
  role: RoleId;
  locale: Locale;
  displayCurrency: DisplayCurrency;
  theme: Theme;
  themeManual: boolean; // session: user toggled theme manually
  /** D18 — show DEMONSTRACYJNE marks on rates / BAF / SE road */
  showDemoMarks: boolean;
  view: ViewKey;
  /** wyglad/P4 (E28): filtr kafelka paska etapów — 10 kafelków według statusów E25 (src/lib/stageTiles.ts). */
  stageFilter: StageTile | null;
  search: string;
  selectedLoadId: string | null;
  hoverLoadId: string | null;
  focusMode: boolean;
  mapLayers: Record<string, boolean>;

  loads: Load[];
  events: LoadEvent[];
  documents: Document[];
  messages: LoadMessage[];
  risks: Risk[];
  exceptions: ReturnType<typeof buildSeedExceptions>;
  geofences: Geofence[];
  workflows: WorkflowRule[];
  workflowRuns: WorkflowRun[];
  notifications: Notification[];
  notificationPrefs: NotificationPrefs;
  invoices: Invoice[];
  /** M6 — faktury v2 (koszt SCX→HHL, przychód HHL→KSH). */
  bills: Bill[];
  /** M10 — rozkład rejsów */
  sailings: Sailing[];
  factoringOffer: FactoringOffer;
  scheduleVersions: ScheduleVersion[];
  rateCost: RateRule[];
  rateRev: RateRule[];
  baf: BafParams;
  toasts: AppToast[];

  navCollapsed: boolean;
  drawerTab: string | null;
  openDecisionId: string | null;
  openInvoiceId: string | null;
  accessMessage: string | null;
  entryOpen: boolean;
  smsEntry: { id: string; status: string; recipient: string; email: string; transport: string } | null;
  workflowFocus: string | null;
  riskFilter: string | null;
  docsFilter: 'missing' | null;
  /** Map POI / geofence / situation focus — 2nd click same key clears */
  mapFocusKey: string | null;

  setRole: (role: RoleId) => void;
  setNavCollapsed: (v: boolean, opts?: { persist?: boolean }) => void;
  setDrawerTab: (tab: string | null) => void;
  setOpenDecisionId: (id: string | null) => void;
  setOpenInvoiceId: (id: string | null) => void;
  setAccessMessage: (msg: string | null) => void;
  setEntryOpen: (open: boolean) => void;
  setSmsEntry: (entry: { id: string; status: string; recipient: string; email: string; transport: string } | null) => void;
  setWorkflowFocus: (id: string | null) => void;
  navigateTo: (opts: {
    view?: ViewKey;
    tab?: string | null;
    loadId?: string | null;
    stage?: StageTile | null;
    riskFilter?: string | null;
    docsFilter?: 'missing' | null;
  }) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: (role?: RoleId) => void;
  openNotification: (id: string) => void;
  /** @deprecated use setRole */
  setLocale: (locale: Locale) => void;
  setDisplayCurrency: (currency: DisplayCurrency) => void;
  setShowDemoMarks: (v: boolean) => void;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  /** Q-9 B: 'system' | light | dark */
  setThemePreference: (pref: 'system' | Theme) => void;
  /** M4 — ustawienia z serwera (bez write-through). */
  applyUserPrefs: (p: import('../data/provider').UserPrefsPatch) => void;
  setView: (view: ViewKey) => void;
  setStageFilter: (stage: StageTile | null) => void;
  setSearch: (q: string) => void;
  selectLoad: (id: string | null) => void;
  setHoverLoad: (id: string | null) => void;
  setFocusMode: (v: boolean) => void;
  toggleMapFocus: (key: string) => void;
  clearMapFocus: () => void;
  toggleLayer: (key: string) => void;
  pushToast: (message: string, severity?: AppToast['severity'], loadId?: string) => void;
  dismissToast: (id: string) => void;
  pushNotification: (n: Omit<Notification, 'id' | 'at' | 'read'> & Partial<Pick<Notification, 'id' | 'at' | 'read' | 'roleScope' | 'href'>>) => void;
  driverAttachDoc: (
    token: string,
    payload: {
      filename: string;
      bytes: number;
      dataUrl: string;
      mimeType?: string;
      category?: 'CMR' | 'POD';
    },
  ) => void;
  applyPlanB: (riskId: string, optionIndex?: number) => void;
  /** D25/L1 — choose SE road alternative; mutates risk + load. */
  applySeRouteAlt: (altIndex: number) => void;
  ensureRiskFromSituation: (situation: import('../lib/trafikverket').RoadSituation, loadId?: string) => string;

  updateResources: (loadId: string, patch: Partial<LoadResources>) => void;
  /** AUD-03 (tryb demo): KSH zmienia wyłącznie daty i godziny załadunku/rozładunku (prod: RPC ksh_confirm_dates). */
  kshEditPlanDates: (loadId: string, p: KshPlanDatesPatch) => boolean;
  updateAwizacja: (loadId: string, patch: Partial<Awizacja>) => void;
  updateFerry: (loadId: string, patch: Partial<FerryBooking>) => void;
  setLoadStatus: (loadId: string, status: LoadStatus, actor?: string, note?: string, occurredAt?: string) => void;
  /** M5 — numer zlecenia: HHL wpisuje swój, przewoźnik swój (W12; wymusza baza). */
  setOrderNo: (loadId: string, side: OrderSide, value: string | null) => boolean;
  appendEvent: (ev: Omit<LoadEvent, 'id'>) => void;
  /** E17: `visibleTo` tylko w demo (wybór „tylko HHL i SCX”); zapis na serwer bez zmian. */
  sendMessage: (loadId: string, text: string, visibleTo?: 'ALL' | 'HHL_SCX') => void;
  uploadDocument: (
    loadId: string,
    category: Document['category'],
    name: string,
    opts?: { dataUrl?: string; mimeType?: string; bytes?: number },
  ) => void;
  /** BK4: dokument już zapisany w Supabase Storage (bajty nie trafiają do przeglądarki). */
  addStoredDocument: (doc: Document, actor?: string) => void;

  saveGeofence: (g: Geofence) => void;
  deleteGeofence: (id: string) => void;
  assignScx: (loadId: string, rateNote?: string) => void;
  triggerGeofence: (loadId: string, geofenceId: string) => void;
  toggleWorkflow: (id: string) => void;
  createWorkflow: (rule: Omit<WorkflowRule, 'id' | 'runCount'>) => string;
  updateWorkflow: (id: string, patch: Partial<WorkflowRule>) => void;
  deleteWorkflow: (id: string) => void;
  runWorkflowNow: (id: string) => void;

  updateRate: (side: 'COST' | 'REVENUE', id: string, baseRate: number) => void;
  updateBaf: (patch: Partial<BafParams>) => void;
  updateNotificationPrefs: (patch: Partial<NotificationPrefs>) => void;

  commitImport: (diff: {
    added: Partial<Load>[];
    changed: { id: string; patch: Partial<Load>; criticalDate?: boolean }[];
    removedIds: string[];
    rejected: number;
    filename: string;
    /** Dry-run accepted row count — 0 must never mutate loads */
    accepted?: number;
    /** Destructive removal is opt-in; schedule UI intentionally never sets this. */
    allowRemovals?: boolean;
    /** B-8-IMP: pominięte wiersze TYP = STANDARD (nie błąd). */
    skippedStandard?: number;
  }) => void;

  updateFactoringOffer: (patch: Partial<FactoringOffer>) => void;
  submitInvoice: (
    weekLabel: string,
    loadIds: string[],
    billedAdjust: Record<string, number>,
    factoringSelected?: boolean,
  ) => void;
  resolveInvoice: (invoiceId: string, action: 'MATCHED' | 'DISPUTED') => void;
  /** M6 — rejestracja faktury przez wystawcę (kontrole jak w `register_invoice`). */
  /** M10 — rozkład (wyłącznie HHL) */
  addSailing: (d: SailingDraft) => { ok: true; id: string } | { ok: false; error: SailingDraftError | 'ROLE' };
  delaySailing: (id: string, departureAt: string, arrivalAt: string) => boolean;
  cancelSailing: (id: string) => boolean;
  /** M10 — przypisanie rejsu (HHL i przewoźnik; po wypłynięciu wyłącznie HHL) */
  assignSailing: (loadId: string, sailingId: string | null, bookingRef: string | null) => SailingDenied;
  registerBill: (draft: BillDraft, file?: Blob | null) => { ok: true; id: string } | { ok: false; errors: string[] };
  /** M6 — weryfikacja przez odbiorcę; SPORNA wymaga uzasadnienia. */
  verifyBill: (billId: string, next: BillVerification, note?: string | null) => boolean;
  /** M6 — „Opłacona” z datą (wyłącznie HHL) i cofnięcie z powodem. */
  markBillPaid: (billId: string, paidAt: string) => boolean;
  unmarkBillPaid: (billId: string, reason: string) => boolean;

  driverMilestone: (token: string, milestone: 'LOADED' | 'ON_FERRY' | 'UNLOADED' | 'PROBLEM') => void;
  driverSharePosition: (token: string) => void;
  /** M9 — pozycja ciągła (watchPosition, za zgodą) → report_position() */
  driverReportFix: (token: string, fix: DriverFix) => void;

  initTheme: () => void;
}

export const useTowerStore = create<TowerState>()(
  persist(
    (set, get) => ({
      role: 'HHL',
      locale: 'pl',
      displayCurrency: 'PLN',
      theme: 'dark',
      themeManual: false,
      showDemoMarks: true,
      // v4 premium: expanded labels (186) desktop default; session remembers collapse.
      navCollapsed:
        typeof sessionStorage !== 'undefined' && sessionStorage.getItem('wtNavCollapsed') === '1',
      drawerTab: null,
      openDecisionId: null,
      openInvoiceId: null,
      accessMessage: null,
      entryOpen: false,
      smsEntry: null,
      workflowFocus: null,
      riskFilter: null,
      docsFilter: null,
      mapFocusKey: null,
      view: 'dash',
      stageFilter: null,
      search: '',
      selectedLoadId: null,
      hoverLoadId: null,
      focusMode: false,
      mapLayers: {
        vehicles: true,
        trail: false,
        route: true,
        geofence: false,
        ferry: true,
        seEvents: false,
        poi: true,
      },

      loads: initialData.loads,
      events: initialData.events,
      documents: initialData.documents,
      messages: initialData.messages,
      risks: initialData.risks,
      exceptions: initialData.exceptions,
      geofences: initialData.geofences,
      workflows: initialData.workflows,
      workflowRuns: initialData.workflowRuns,
      notifications: initialData.notifications,
      notificationPrefs: { workflowAlerts: true, geofenceAlerts: true, riskAlerts: true },
      invoices: initialData.invoices,
      bills: initialData.bills,
      sailings: initialData.sailings,
      factoringOffer: { ...DEFAULT_FACTORING_OFFER },
      scheduleVersions: initialData.scheduleVersions,
      rateCost: RATE_COST,
      rateRev: RATE_REV,
      baf: BAF_PARAMS,
      toasts: [],

      initTheme: () => {
        const { theme, themeManual, role } = get();
        // Q-9 B: bez ręcznego wyboru — motyw systemu; po przełączeniu zostaje themeManual.
        const next = themeManual ? theme : systemTheme();
        if (!themeManual && next !== theme) set({ theme: next });
        applyThemeToDom(next);
      },

      setRole: (role) => {
        const { themeManual, theme } = get();
        // Q-9 B: bez ręcznego wyboru — motyw systemu.
        const nextTheme = themeManual ? theme : systemTheme();
        applyThemeToDom(nextTheme);
        const defaultView = 'dash';
        setPreviewViewRole(role); // E9-7 — strażnik Podglądu (writeThrough / isPreviewReadOnly)
        set({ role, theme: nextTheme, view: defaultView as ViewKey });
      },

      setLocale: (locale) => {
        set({ locale });
        writeThrough({ type: 'prefs.save', prefs: { locale } });
      },

      setDisplayCurrency: (displayCurrency) => {
        set({ displayCurrency });
        writeThrough({ type: 'prefs.save', prefs: { displayCurrency } });
      },

      setShowDemoMarks: (showDemoMarks) => set({ showDemoMarks }),

      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        applyThemeToDom(next);
        set({ theme: next, themeManual: true });
      },

      setTheme: (theme) => {
        applyThemeToDom(theme);
        set({ theme, themeManual: true });
        writeThrough({ type: 'prefs.save', prefs: { theme } });
      },

      setThemePreference: (pref) => {
        if (pref === 'system') {
          const next = systemTheme();
          applyThemeToDom(next);
          set({ theme: next, themeManual: false });
          writeThrough({ type: 'prefs.save', prefs: {} }); // system — bez wymuszenia motywu
          return;
        }
        applyThemeToDom(pref);
        set({ theme: pref, themeManual: true });
        writeThrough({ type: 'prefs.save', prefs: { theme: pref } });
      },

      applyUserPrefs: (p) => {
        const patch: Partial<TowerState> = {};
        if (p.locale) patch.locale = p.locale;
        if (p.displayCurrency) patch.displayCurrency = p.displayCurrency;
        if (p.theme) {
          applyThemeToDom(p.theme);
          patch.theme = p.theme;
          patch.themeManual = true;
        }
        set(patch);
      },

      setNavCollapsed: (navCollapsed, opts) => {
        if (opts?.persist !== false) {
          try {
            sessionStorage.setItem('wtNavCollapsed', navCollapsed ? '1' : '0');
          } catch { /* ignore */ }
        }
        set({ navCollapsed });
      },

      setDrawerTab: (drawerTab) => set({ drawerTab }),
      setOpenDecisionId: (openDecisionId) => set({ openDecisionId }),
      setOpenInvoiceId: (openInvoiceId) => set({ openInvoiceId }),
      setAccessMessage: (accessMessage) => set({ accessMessage }),
      setEntryOpen: (entryOpen) => set({ entryOpen }),
      setSmsEntry: (smsEntry) => set({ smsEntry }),
      setWorkflowFocus: (workflowFocus) => set({ workflowFocus }),

      navigateTo: (opts) => {
        set((s) => ({
          view: (opts.view as ViewKey) ?? s.view,
          drawerTab: opts.tab !== undefined ? opts.tab : s.drawerTab,
          selectedLoadId: opts.loadId !== undefined ? opts.loadId : s.selectedLoadId,
          stageFilter: opts.stage !== undefined ? opts.stage : s.stageFilter,
          riskFilter: opts.riskFilter !== undefined ? opts.riskFilter : s.riskFilter,
          docsFilter: opts.docsFilter !== undefined ? opts.docsFilter : s.docsFilter,
        }));
      },

      markNotificationRead: (id) => {
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n,
          ),
        }));
        /* M7 — powiadomienia z serwera: przeczytanie zapisywane (mark_notifications_read) */
        if (id.startsWith('srv-')) writeThrough({ type: 'notifications.read', ids: [Number(id.slice(4))] });
      },

      markAllNotificationsRead: (role) => {
        set((s) => ({
          notifications: s.notifications.map((n) => {
            const scoped =
              !role ||
              !n.roleScope ||
              n.roleScope.length === 0 ||
              n.roleScope.includes(role);
            return scoped ? { ...n, read: true } : n;
          }),
        }));
        const ids = get().notifications.filter((n) => n.id.startsWith('srv-')).map((n) => Number(n.id.slice(4)));
        if (ids.length) writeThrough({ type: 'notifications.read', ids });
      },

      openNotification: (id) => {
        const n = get().notifications.find((x) => x.id === id);
        if (!n) return;
        const href = n.href;
        // AUD-02: kod transportu z load_id (ładunki ryzyk/stref nie niosą kodu → było `/transport/brak`)
        const loadCode = n.loadId ? get().loads.find((l) => l.id === n.loadId)?.code : undefined;
        const path = href?.path ? withLoadCode(href.path, loadCode) : undefined;
        if (path) {
          const allowed = href?.allowed !== false;
          set({
            accessMessage: allowed ? null : 'Brak dostępu',
            entryOpen: path.startsWith('/szczegoly-wpisu'),
          });
          if (typeof window !== 'undefined') {
            const hash = path.startsWith('/') ? path : `/${path}`;
            window.location.hash = hash;
          }
        } else {
          const alias: Record<string, string> = {
            risk: 'risk', risks: 'risk', docs: 'docs', fin: 'fin', finance: 'fin',
            inv: 'inv', invoices: 'inv', map: 'map', geo: 'geo', geofence: 'geo',
            wf: 'wf', workflow: 'wf', sched: 'sched', schedule: 'sched', tasks: 'tasks', dash: 'dash',
          };
          const raw = href?.view ?? '';
          let view = (alias[raw] ?? raw) || undefined;
          if ((view === 'geo' || view === 'geofence') && (href?.loadId || n.loadId)) view = 'sched';
          get().navigateTo({
            view: view as never,
            tab: href?.tab ?? null,
            loadId: href?.loadId ?? n.loadId ?? null,
            riskFilter: href?.entityId && view === 'risk' ? href.entityId : undefined,
            docsFilter: view === 'docs' ? 'missing' : undefined,
          });
        }
        get().markNotificationRead(id);
      },

      setView: (view) => set({ view }),
      setStageFilter: (stage) =>
        set((s) => ({
          stageFilter: stage === null ? null : s.stageFilter === stage ? null : stage,
        })),
      setSearch: (search) => set({ search }),
      selectLoad: (id) => set({ selectedLoadId: id }),
      setHoverLoad: (id) => set({ hoverLoadId: id }),
      setFocusMode: (focusMode) => set({ focusMode }),
      toggleMapFocus: (key) =>
        set((s) => ({
          mapFocusKey: s.mapFocusKey === key ? null : key,
        })),
      clearMapFocus: () => set({ mapFocusKey: null }),
      toggleLayer: (key) =>
        set((s) => ({ mapLayers: { ...s.mapLayers, [key]: !s.mapLayers[key] } })),

      pushToast: (message, severity = 'MEDIUM', loadId) => {
        const t: AppToast = { id: uid('toast'), message, severity, loadId };
        set((s) => ({ toasts: [...s.toasts, t] }));
        setTimeout(() => get().dismissToast(t.id), 5000);
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      pushNotification: (n) => {
        const prefs = get().notificationPrefs ?? {
          workflowAlerts: true,
          geofenceAlerts: true,
          riskAlerts: true,
        };
        const view = n.href?.view ?? '';
        const blob = `${n.title ?? ''} ${n.body ?? ''}`.toLowerCase();
        const zoneKind = n.kind === 'ZONE_ENTER' || n.kind === 'ZONE_EXIT' || n.kind === 'GEOFENCE_ENTER' || n.kind === 'GEOFENCE_EXIT' || view === 'geo';
        if (get().role === 'KSH' && zoneKind) return;
        if (n.kind === 'DOC_MISSING' && get().role === 'KSH') return;
        if (bellOffForPerson(n.kind)) return;
        let allowed = true;
        if (view === 'wf' || /workflow|regu[lł]a|automatyz/.test(blob)) {
          allowed = prefs.workflowAlerts !== false;
        } else if (view === 'geo' || /geofence|stref/.test(blob)) {
          allowed = prefs.geofenceAlerts !== false;
        } else if (
          view === 'risk' ||
          n.severity === 'CRITICAL' ||
          n.severity === 'HIGH' ||
          /ryzyk|ferry|plan b|alternatywa se|force.?majeure/.test(blob)
        ) {
          allowed = prefs.riskAlerts !== false;
        }
        if (!allowed) return;
        const note: Notification = {
          id: n.id ?? uid('n'),
          at: n.at ?? nowIso(),
          title: n.title,
          body: n.body,
          severity: n.severity,
          read: n.read ?? false,
          loadId: n.loadId,
          roleScope: n.roleScope,
          href: n.href,
        };
        set((s) => ({ notifications: [note, ...s.notifications] }));
      },

      driverAttachDoc: (token, payload) => {
        const loadId = DRIVER_TOKENS[token];
        if (!loadId) {
          get().pushToast(tp(get().locale, 'a6_ts_bad_token', { token }), 'HIGH');
          return;
        }
        const load = get().loads.find((l) => l.id === loadId);
        if (!load) {
          get().pushToast(
            tp(get().locale, 'a6_ts_token_noload', { token, loadId }),
            'CRITICAL',
          );
          return;
        }
        const nameHint = payload.filename.toLowerCase();
        const category: Document['category'] =
          payload.category ??
          (nameHint.includes('pod') ||
          load.status === 'UNLOADING' ||
          load.status === 'DELIVERED'
            ? 'POD'
            : 'CMR');
        if (!payload.dataUrl || !String(payload.dataUrl).startsWith('data:')) {
          get().pushToast(t(get().locale, 'a6_ts_no_file'), 'HIGH', loadId);
          return;
        }
        const at = nowIso();
        const doc: Document = {
          id: uid('doc'),
          loadId,
          category,
          name: payload.filename,
          uploadedAt: at,
          deadline: load?.plannedLoadDate ? `${load.plannedLoadDate}T06:00:00+02:00` : null,
          status: 'UPLOADED',
          permitFits: null,
          visibleTo: ['HHL', 'KSH', 'SCX'],
          dataUrl: payload.dataUrl,
          mimeType: payload.mimeType ?? null,
          bytes: payload.bytes,
          source: 'driver',
        };
        set((s) => ({
          documents: [
            doc,
            ...s.documents.filter((d) => !(d.loadId === loadId && d.category === category)),
          ],
          loads: s.loads.map((l) =>
            l.id === loadId && category === 'CMR' ? { ...l, docMissing: false } : l,
          ),
        }));
        get().appendEvent({
          loadId,
          type: 'DOC_UPLOADED',
          at,
          actor: 'DRIVER',
          note: `${category}: ${payload.filename} (${payload.bytes} B) → vault`,
          payload: {
            category,
            filename: payload.filename,
            bytes: payload.bytes,
            mimeType: payload.mimeType,
            documentId: doc.id,
            hasDataUrl: true,
          },
        });
        get().pushToast(tp(get().locale, 'a6_ts_doc', { category, file: payload.filename }), 'MEDIUM', loadId);
        get().pushNotification({
          title: `Kierowca · ${category}`,
          body: `${load?.code ?? loadId}: ${payload.filename}`,
          severity: 'MEDIUM',
          loadId,
          roleScope: ['HHL', 'SCX', 'KSH'],
          href: { view: 'docs', loadId },
        });
      },

      appendEvent: (ev) => {
        const full: LoadEvent = { ...ev, id: uid('ev') };
        set((s) => ({ events: [full, ...s.events] }));
        writeThrough({ type: 'event.append', event: ev });
      },

      setLoadStatus: (loadId, status, actor = 'system', note, occurredAt) => {
        const systemActors = new Set(['system', 'import', 'geofence-engine', 'driver-pwa', 'DRIVER', 'auto']);
        const actorLabel = systemActors.has(actor) ? actor : currentActorLabel(actor);
        /* E25: UNLOADING = Dostarczone (UNLOADED scalony z DELIVERED) */
        if (status === 'UNLOADING') status = 'DELIVERED';
        {
          /* M5 — lustro enforce_order_numbers(): bez numeru HHL nie ma GOTOWY, bez numeru przewoźnika nie ma załadunku */
          const load = get().loads.find((l) => l.id === loadId);
          const reason = load ? orderNumberGate(load, status) : null;
          if (reason) {
            const msg = orderGateMessage(reason, get().locale);
            get().pushToast(msg, 'CRITICAL', loadId);
            get().appendEvent({ loadId, type: 'READY_BLOCKED', at: nowIso(), actor: actorLabel, note: msg });
            return;
          }
        }
        if (status === 'READY' || status === 'IN_TRANSIT_PL' || status === 'LOADING') {
          const load = get().loads.find((l) => l.id === loadId);
          if (load) {
            const gate = isReadyBlocked(load, get().documents);
            if (gate.blocked) {
              const label = status === 'READY' ? 'READY' : 'Wyjazd';
              get().pushToast(tp(get().locale, 'a6_ts_blocked', { label: status === 'READY' ? 'READY' : t(get().locale, 'a6_ts_departure'), reason: gate.reason }), 'CRITICAL', loadId);
              get().appendEvent({
                loadId,
                type: 'READY_BLOCKED',
                at: nowIso(),
                actor: actorLabel,
                note: `${label}: ${gate.reason}`,
              });
              return;
            }
          }
        }
        const progress = PROGRESS_OF[status];
        const pos = positionAlong(progress);
        const at = occurredAt ?? nowIso();
        const delivered = status === 'DELIVERED';
        set((s) => ({
          loads: s.loads.map((l) => {
            if (l.id !== loadId) return l;
            const next = {
              ...l,
              status,
              stage: STATUS_TO_STAGE[status],
              progress,
              lat: pos.lat,
              lng: pos.lng,
              heading: pos.heading,
              delayed: status === 'DELAYED',
              silentMinutes: status === 'SILENT' ? l.silentMinutes ?? 100 : l.silentMinutes,
              ...(delivered ? { unloadedAt: at } : {}),
            };
            const withEta = applyEtaToLoad(next, at);
            return delivered && !SUPABASE_AUTH_ENABLED ? withMoneyV2(withEta, localDateOf(at)) : withEta;
          }),
        }));
        writeThrough({
          type: 'load.status',
          loadId,
          status,
          occurredAt: at,
          note: note ?? null,
          ...(delivered ? { unloadedAt: at } : {}),
        });
        // E25 H2 (D-20261014-0640-01): jedno zdarzenie — z RPC (payload.actor); bez drugiego event.append
        if (SUPABASE_AUTH_ENABLED) {
          const full: LoadEvent = {
            id: uid('ev'),
            loadId,
            type: `STATUS_${status}`,
            at,
            actor: actorLabel,
            note,
          };
          set((s) => ({ events: [full, ...s.events] }));
        } else {
          get().appendEvent({ loadId, type: `STATUS_${status}`, at, actor: actorLabel, note });
        }
      },

      setOrderNo: (loadId, side, value) => {
        const role = get().role;
        const locale = get().locale;
        const allowed = (side === 'HHL' && role === 'HHL') || (side === 'CARRIER' && role === 'SCX');
        if (!allowed) {
          get().pushToast(orderEditDeniedMessage(side, locale), 'HIGH', loadId);
          return false;
        }
        const v = value && value.trim() ? value.trim() : null;
        const field = side === 'HHL' ? 'hhlOrderNo' : 'carrierOrderNo';
        const riskId = `risk-orderno-${side === 'HHL' ? 'hhl' : 'scx'}-${loadId}`;
        let raised: Risk | undefined;
        set((s) => {
          const loads = s.loads.map((l) => (l.id === loadId ? { ...l, [field]: v } : l));
          let risks = s.risks.filter((r) => r.id !== riskId);
          if (!v) {
            /* brak numeru przed terminem → ryzyko (lustro detect_missing_order_numbers) */
            raised = orderNoRisks(loads.filter((l) => l.id === loadId), getNowIso()).find((r) => r.id === riskId);
            if (raised) risks = [raised, ...risks];
          }
          return { loads, risks, exceptions: exceptionsFromRisks(risks, loads) };
        });
        if (raised) for (const n of orderNoReminders([raised], getNowIso())) get().pushNotification(n);
        writeThrough({ type: 'load.orderNo', loadId, side, value: v });
        get().appendEvent({
          loadId, type: 'ORDER_NO_UPDATED', at: nowIso(), actor: currentActorLabel(role),
          note: `${side === 'HHL' ? 'Nr zlecenia HHL' : 'Nr zlecenia przewoźnika'}: ${v ?? '—'}`,
        });
        get().pushToast(v ? tp(get().locale, 'a6_ts_order_saved', { v }) : t(get().locale, 'a6_ts_order_removed'), 'MEDIUM', loadId);
        return true;
      },

      kshEditPlanDates: (loadId, p) => {
        if (get().role !== 'KSH') return false;
        const load = get().loads.find((l) => l.id === loadId);
        if (!load || !p.loadDate || !p.deliveryDate || p.deliveryDate < p.loadDate) return false;
        if (p.loadFrom > p.loadTo || p.deliveryFrom > p.deliveryTo) return false;
        const at = nowIso();
        set((s) => ({
          loads: s.loads.map((l) => l.id !== loadId ? l : {
            ...l,
            plannedLoadDate: p.loadDate,
            plannedDeliverDate: p.deliveryDate,
            awizacja: { ...l.awizacja, loadWindowStart: p.loadFrom, loadWindowEnd: p.loadTo, unloadWindowStart: p.deliveryFrom, unloadWindowEnd: p.deliveryTo },
            ...(l.planDates ? { planDates: { ...l.planDates, status: 'POTWIERDZONA' as const, confirmedAt: at, loadFrom: p.loadFrom, loadTo: p.loadTo, deliveryFrom: p.deliveryFrom, deliveryTo: p.deliveryTo } } : {}),
          }),
        }));
        get().appendEvent({
          loadId,
          type: 'PLAN_DATES_CHANGED',
          at,
          actor: currentActorLabel('KSH'),
          payload: { by: 'KSH', load_date: p.loadDate, delivery_date: p.deliveryDate, before_load_date: load.plannedLoadDate, before_delivery_date: load.plannedDeliverDate },
        });
        get().pushToast(t(get().locale, 'b_ksh_saved'), 'MEDIUM', loadId);
        return true;
      },

      updateResources: (loadId, patch) => {
        const role = get().role;
        /* AUD-03: zasoby („Zmień ciągnik”, awizacja) — tylko przewoźnik i HHL; KSH nic nie zapisuje (baza też odmawia) */
        if (!canEditResources(role)) return;
        const at = nowIso();
        /* E44 pkt 8 / K2.1: do bazy może iść pełny link (wyzwalacz wycina secret); do UI i zdarzeń — bez secret */
        const safePatch = redactResourcesPatch(patch);
        const dbPatch = { ...patch };
        set((s) => {
          const loads = s.loads.map((l) => {
            if (l.id !== loadId) return l;
            const resources = { ...l.resources, ...safePatch };
            /* po zapisie RIO w stanie lokalnym zostaje rio:<uuid>, nie URL z kluczem */
            if ('trackingRef' in patch) resources.trackingRef = redactTrackingRef(patch.trackingRef);
            return { ...l, resources };
          });
          const updated = loads.find((l) => l.id === loadId);
          const complete = resourcesComplete(updated?.resources);
          const risks = clearResourceGapRisks(s.risks, loadId, complete);
          const exceptions = exceptionsFromRisks(risks, loads);
          return { loads, risks, exceptions };
        });
        writeThrough({ type: 'load.resources', loadId, patch: dbPatch });
        get().appendEvent({
          loadId,
          type: 'RESOURCES_UPDATED',
          at,
          actor: currentActorLabel(role),
          payload: safePatch as Record<string, unknown>,
        });
        get().pushToast(t(get().locale, 'a6_ts_res_saved'), 'MEDIUM', loadId);

        // Status: RESOURCES_PENDING / Brak auta → DOC_MISSING or READY by permit cover
        const load = get().loads.find((l) => l.id === loadId);
        if (!load) return;
        const complete = resourcesComplete(load.resources);
        if (
          complete &&
          (load.status === 'RESOURCES_PENDING' || load.status === 'PLANNED')
        ) {
          // Cover check ignores stale docMissing flag — resources close the «Brak auta» gap;
          // permit cover alone decides DOC_MISSING vs READY (isReadyBlocked without flag).
          const coverGate = isReadyBlocked({ ...load, docMissing: false }, get().documents);
          if (coverGate.blocked) {
            get().setLoadStatus(
              loadId,
              'DOC_MISSING',
              role,
              `Zasoby OK → cover: ${coverGate.reason}`,
            );
          } else {
            // Clear stale docMissing so READY gate in setLoadStatus accepts
            set((s) => ({
              loads: s.loads.map((l) => (l.id === loadId ? { ...l, docMissing: false } : l)),
            }));
            get().setLoadStatus(loadId, 'READY', role, 'Zasoby uzupełnione — cover OK');
          }
        }
      },

      updateAwizacja: (loadId, patch) => {
        const role = get().role;
        const at = nowIso();
        set((s) => ({
          loads: s.loads.map((l) =>
            l.id === loadId ? { ...l, awizacja: { ...l.awizacja, ...patch } } : l,
          ),
        }));
        writeThrough({ type: 'load.awizacja', loadId, patch });
        get().appendEvent({
          loadId,
          type: 'AWIZACJA_UPDATED',
          at,
          actor: currentActorLabel(role),
          payload: patch as Record<string, unknown>,
        });
        get().pushToast(t(get().locale, 'a6_ts_awiz_saved'), 'MEDIUM', loadId);

        const load = get().loads.find((l) => l.id === loadId);
        if (!load) return;
        const awi = load.awizacja;
        const hasWindow = Boolean(awi.loadWindowStart && awi.loadWindowEnd);
        const complete = resourcesComplete(load.resources);
        if (awi.confirmed && hasWindow && complete) {
          const coverGate = isReadyBlocked({ ...load, docMissing: false }, get().documents);
          if (!coverGate.blocked) {
            if (
              load.status === 'RESOURCES_PENDING' ||
              load.status === 'PLANNED' ||
              load.status === 'DOC_MISSING' ||
              load.status === 'READY'
            ) {
              if (load.status !== 'READY') {
                set((s) => ({
                  loads: s.loads.map((l) => (l.id === loadId ? { ...l, docMissing: false } : l)),
                }));
                get().setLoadStatus(
                  loadId,
                  'READY',
                  role,
                  'Awizacja potwierdzona + zasoby + cover OK',
                );
              }
            }
          }
        }
      },

      updateFerry: (loadId, patch) => {
        const at = nowIso();
        set((s) => ({
          loads: s.loads.map((l) => {
            if (l.id !== loadId) return l;
            return applyEtaToLoad({ ...l, ferry: { ...l.ferry, ...patch } }, at);
          }),
        }));
        writeThrough({ type: 'load.ferry', loadId, patch });
        get().appendEvent({ loadId, type: 'FERRY_UPDATED', at, actor: currentActorLabel(get().role) });
      },

      sendMessage: (loadId, text, visibleTo) => {
        const msg: LoadMessage = {
          id: uid('msg'),
          loadId,
          at: nowIso(),
          author: get().role,
          org: get().role,
          text,
          ...(visibleTo === 'HHL_SCX' ? { visibleTo } : {}),
        };
        set((s) => ({ messages: [...s.messages, msg] }));
        writeThrough({ type: 'message.send', loadId, text });
      },

      uploadDocument: (loadId, category, name, opts) => {
        const load = get().loads.find((l) => l.id === loadId);
        const mismatch =
          // I-0: niezgodność zezwolenia symulowana tylko dla transportów demo — nie w buildzie produkcyjnym
          import.meta.env.VITE_AUTH_MODE !== 'supabase' &&
          (category === 'PERMIT_PL' || category === 'PERMIT_SE') &&
          ['SG-07', 'SG-34'].includes(load?.code ?? '');
        const dataUrl = opts?.dataUrl && String(opts.dataUrl).startsWith('data:') ? opts.dataUrl : null;
        const doc: Document = {
          id: uid('doc'),
          loadId,
          category,
          name,
          uploadedAt: nowIso(),
          deadline: load?.plannedLoadDate ? `${load.plannedLoadDate}T06:00:00+02:00` : null,
          status: mismatch ? 'MISMATCH' : 'UPLOADED',
          permitFits: category.startsWith('PERMIT') ? !mismatch : null,
          visibleTo: ['HHL', 'KSH', 'SCX'],
          dataUrl,
          mimeType: opts?.mimeType ?? null,
          bytes: opts?.bytes ?? null,
          source: 'tower',
          // III-6: zastąpienie pliku tej samej kategorii = kolejna wersja (demo; produkcja: document_supersede)
          version: (get().documents.find((d) => d.loadId === loadId && d.category === category)?.version ?? 0) + 1,
        };
        set((s) => ({
          documents: [doc, ...s.documents.filter((d) => !(d.loadId === loadId && d.category === category))],
          loads: s.loads.map((l) =>
            l.id === loadId && category === 'CMR' && !mismatch ? { ...l, docMissing: false } : l,
          ),
        }));
        get().appendEvent({
          loadId,
          type: mismatch ? 'PERMIT_MISMATCH' : 'DOC_UPLOADED',
          at: nowIso(),
          actor: currentActorLabel(get().role),
          note: dataUrl ? `${name} (${opts?.bytes ?? 0} B)` : name,
          payload: { category, hasDataUrl: !!dataUrl, documentId: doc.id },
        });
        if (mismatch) {
          get().pushToast(t(get().locale, 'a6_ts_permit_mismatch'), 'CRITICAL', loadId);
        } else {
          get().pushToast(dataUrl ? tp(get().locale, 'a6_ts_doc_uploaded', { name }) : t(get().locale, 'a6_ts_doc_added'), 'MEDIUM', loadId);
        }
      },

      addStoredDocument: (doc, actor) => {
        const { loadId, category } = doc;
        set((s) => ({
          documents: [doc, ...s.documents.filter((d) => !(d.loadId === loadId && d.category === category))],
          loads: s.loads.map((l) => (l.id === loadId && category === 'CMR' ? { ...l, docMissing: false } : l)),
        }));
        get().appendEvent({
          loadId,
          type: 'DOC_UPLOADED',
          at: doc.uploadedAt ?? nowIso(),
          actor: actor ?? currentActorLabel(get().role),
          note: `${doc.name} (${doc.bytes ?? 0} B)`,
          payload: { category, documentId: doc.id, stored: true },
        });
        get().pushToast(t(get().locale, 'bk4_file_saved').replace('{name}', doc.name), 'MEDIUM', loadId);
      },

      saveGeofence: (g) => {
        set((s) => {
          const exists = s.geofences.some((x) => x.id === g.id);
          return {
            geofences: exists ? s.geofences.map((x) => (x.id === g.id ? g : x)) : [...s.geofences, g],
          };
        });
        writeThrough({ type: 'geofence.save', geofence: g });
        get().pushToast(tp(get().locale, 'a6_ts_zone_saved', { name: g.name }), 'MEDIUM');
        const roles: RoleId[] = [];
        if (g.notifyHhl) roles.push('HHL');
        if (g.notifyKsh) roles.push('KSH');
        if (g.notifyScx) roles.push('SCX');
        if (roles.length) {
          get().pushNotification({
            title: `Zapisano strefę · ${g.name}`,
            body: `r=${g.radiusM}m · hyst=${g.hysteresisM}m · dwell=${g.dwellMin}m · ${g.trigger}`,
            severity: 'MEDIUM',
            roleScope: roles,
            href: { view: 'geo', entityId: g.id },
          });
        }
      },

      deleteGeofence: (id) => {
        const g = get().geofences.find((x) => x.id === id);
        if (!g) return;
        set((s) => ({
          geofences: s.geofences.filter((x) => x.id !== id),
        }));
        writeThrough({ type: 'geofence.delete', id });
        get().pushToast(tp(get().locale, 'geo_deleted', { name: g.name }), 'MEDIUM');
      },

      assignScx: (loadId, rateNote) => {
        const at = nowIso();
        set((s) => ({
          loads: s.loads.map((l) =>
            l.id === loadId
              ? applyEtaToLoad(
                  {
                    ...l,
                    carrierId: 'org-scx',
                    status: l.status === 'PLANNED' ? 'RESOURCES_PENDING' : l.status,
                    stage: l.status === 'PLANNED' ? STATUS_TO_STAGE.RESOURCES_PENDING : l.stage,
                    progress: l.status === 'PLANNED' ? PROGRESS_OF.RESOURCES_PENDING : l.progress,
                  },
                  at,
                )
              : l,
          ),
        }));
        get().appendEvent({
          loadId,
          type: 'SCX_ASSIGNED',
          at,
          actor: currentActorLabel(get().role),
          note: rateNote ?? 'SCX + cennik',
          payload: { carrierId: 'org-scx', rateNote: rateNote ?? null },
        });
        get().pushToast(t(get().locale, 'a6_ts_scx_assigned'), 'MEDIUM', loadId);
        get().pushNotification({
          title: 'Przypisano SCX',
          body: rateNote ?? 'HHL przypisał SCX',
          severity: 'MEDIUM',
          loadId,
          roleScope: ['HHL', 'SCX'],
          href: { view: 'sched', loadId },
        });
      },

      triggerGeofence: (loadId, geofenceId) => {
        const g = get().geofences.find((x) => x.id === geofenceId);
        const load = get().loads.find((l) => l.id === loadId);
        if (!g || !load) return;
        const at = nowIso();
        const typeMap: Partial<Record<GeofenceType, LoadStatus>> = {
          LOADING: 'LOADING',
          PRE_PORT: 'AT_PORT',
          PORT_OUT: 'AT_PORT',
          PORT_IN: 'AT_PORT_SE',
          PRE_ARRIVAL: 'APPROACHING_SITE',
          SITE: 'UNLOADING',
          CHECKPOINT: load.status,
          REST: load.status,
        };
        const nextStatus = typeMap[g.type] ?? load.status;
        get().appendEvent({
          loadId,
          type: `GEOFENCE_${g.trigger}`,
          at,
          actor: 'geofence-engine',
          note: `${g.name} (${g.type})`,
          payload: { geofenceId: g.id, hysteresisM: g.hysteresisM, dwellMin: g.dwellMin },
        });
        if (nextStatus !== load.status) {
          get().setLoadStatus(loadId, nextStatus, 'geofence-engine', `Geofence ${g.type}`);
        } else {
          set((s) => ({
            loads: s.loads.map((l) => (l.id === loadId ? applyEtaToLoad(l, at) : l)),
          }));
        }
        const roles: RoleId[] = [];
        if (g.notifyHhl) roles.push('HHL');
        if (g.notifyKsh) roles.push('KSH');
        if (g.notifyScx) roles.push('SCX');
        if (roles.length) {
          get().pushNotification({
            title: `Strefa ${g.type}`,
            body: `${load.code} · ${g.name}`,
            severity: g.type === 'PRE_ARRIVAL' || g.type === 'SITE' ? 'HIGH' : 'MEDIUM',
            loadId,
            roleScope: roles,
            href: { view: 'sched', loadId },
          });
        }
        // ONE-MECH / D-29t: PRE_ARRIVAL → geofence + DEC-5 / macierz (nie auto-run demo wf-1)
        // DEC-CLICK (b): klik strefy → Transport (sched), nie geo
        get().pushToast(tp(get().locale, 'a6_ts_zone_event', { type: g.type, name: g.name }), 'MEDIUM', loadId);
      },

      toggleWorkflow: (id) => {
        const cur = get().workflows.find((w) => w.id === id);
        set((s) => ({
          workflows: s.workflows.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w)),
        }));
        // 9.4 — tryb Supabase: zapis `enabled` (RLS: HHL_ADMIN); błąd → komunikat i odświeżenie z serwera
        if (cur) writeThrough({ type: 'workflow.update', id, patch: { enabled: !cur.enabled } });
      },

      createWorkflow: (rule) => {
        const id = uid('wf');
        const workflow: WorkflowRule = { ...rule, id, runCount: 0 };
        set((s) => ({ workflows: [workflow, ...s.workflows] }));
        writeThrough({ type: 'workflow.create', rule }); // 9.4 — baza waliduje (wf_validate) i nadaje id
        get().pushToast(tp(get().locale, 'a6_ts_rule_added', { name: workflow.name }), 'MEDIUM');
        return id;
      },

      updateWorkflow: (id, patch) => {
        set((s) => ({
          workflows: s.workflows.map((w) => (w.id === id ? { ...w, ...patch } : w)),
        }));
        const { runCount: _rc, id: _id, ...dbPatch } = patch as Partial<WorkflowRule>;
        writeThrough({ type: 'workflow.update', id, patch: dbPatch });
        get().pushToast(t(get().locale, 'a6_ts_wf_updated'), 'MEDIUM');
      },

      deleteWorkflow: (id) => {
        const cur = get().workflows.find((w) => w.id === id);
        if (!cur) return;
        set((s) => ({ workflows: s.workflows.filter((w) => w.id !== id) }));
        writeThrough({ type: 'workflow.delete', id }); // B-5 — baza: RLS HHL_ADMIN, START-* nieusuwalne, audit_log
        get().pushToast(tp(get().locale, 'b5_ts_deleted', { name: cur.name }), 'MEDIUM');
      },

      runWorkflowNow: (id) => {
        const wf = get().workflows.find((w) => w.id === id);
        if (!wf) return;
        // 9.4 — dane prawdziwe: reguły uruchamia wyłącznie zdarzenie transportu (kolejka + workflow_worker);
        // bez fałszywego przebiegu i powiadomienia
        if (hasRemoteSink()) { get().pushToast(t(get().locale, 'a6_ts_wf_run_event_only'), 'LOW'); return; }
        const run: WorkflowRun = {
          id: uid('wr'),
          workflowId: id,
          at: nowIso(),
          status: 'OK',
          note: `Uruchomiono: ${wf.name}`,
          loadId: get().loads[0]?.id,
        };
        const note: Notification = {
          id: uid('n'),
          at: nowIso(),
          title: `Workflow: ${wf.name}`,
          body: wf.actions.join(' → '),
          severity: 'HIGH',
          read: false,
          loadId: run.loadId,
        };
        set((s) => ({
          workflowRuns: [run, ...s.workflowRuns],
          notifications: [note, ...s.notifications],
          workflows: s.workflows.map((w) => (w.id === id ? { ...w, runCount: w.runCount + 1 } : w)),
        }));
        get().pushToast(tp(get().locale, 'a6_ts_wf_run', { name: wf.name }), 'HIGH', run.loadId);
        if (id === 'wf-9') {
          const { SEED_SITUATIONS } = require('../lib/trafikverket') as typeof import('../lib/trafikverket');
          const sit =
            SEED_SITUATIONS.find((s) => s.severity === 'CRITICAL') ?? SEED_SITUATIONS[0];
          if (sit) get().ensureRiskFromSituation(sit);
        }
      },

      updateRate: (side, id, baseRate) => {
        if (side === 'COST') {
          set((s) => ({ rateCost: s.rateCost.map((r) => (r.id === id ? { ...r, baseRate } : r)) }));
        } else {
          set((s) => ({ rateRev: s.rateRev.map((r) => (r.id === id ? { ...r, baseRate } : r)) }));
        }
      },

      updateBaf: (patch) => set((s) => ({ baf: { ...s.baf, ...patch } })),

      updateNotificationPrefs: (patch) =>
        set((s) => ({ notificationPrefs: { ...s.notificationPrefs, ...patch } })),

      commitImport: ({ added, changed, removedIds, rejected, filename, accepted, allowRemovals, skippedStandard = 0 }) => {
        // Normal schedule imports are additive. Ignore any legacy/provided removals unless
        // a caller explicitly opts into the destructive path.
        // ANEKS 3 §2.1: usunięcie przez import = anulowanie, wyłącznie sprzed załadunku i spoza faktur
        // (ten sam werdykt co import_removal_check() w bazie); zablokowane zostają nietknięte.
        const invoiced = invoicedLoadIds(get().bills, get().invoices);
        const byId = new Map(get().loads.map((l) => [l.id, l]));
        const requested = allowRemovals ? removedIds : [];
        const effectiveRemovedIds = requested.filter((id) => {
          const l = byId.get(id);
          return !!l && removalBlock(l, invoiced) === null;
        });
        const blockedCount = requested.length - effectiveRemovedIds.length;
        if (blockedCount > 0) {
          get().pushToast(tp(get().locale, 'a6_ts_imp_blocked', { n: blockedCount }), 'HIGH');
        }
        if (removedIds.length > 0 && !allowRemovals) {
          get().pushToast(
            tp(get().locale, 'a6_ts_imp_skip', { n: removedIds.length }),
            'MEDIUM',
          );
        }
        // CRITICAL integrity: never mutate when dry-run accepted === 0
        if (accepted === 0) {
          get().pushToast(
            t(get().locale, 'a6_ts_imp_rejected'),
            'CRITICAL',
          );
          return;
        }
        // Defense: refuse wipe-all with zero productive rows (stale callers omitting accepted)
        if (
          accepted == null &&
          added.length === 0 &&
          changed.length === 0 &&
          removedIds.length > 0
        ) {
          get().pushToast(
            t(get().locale, 'a6_ts_imp_rejected'),
            'CRITICAL',
          );
          return;
        }
        set((s) => {
          let loads = s.loads.filter((l) => !effectiveRemovedIds.includes(l.id));
          for (const ch of changed) {
            loads = loads.map((l) => (l.id === ch.id ? { ...l, ...ch.patch } : l));
          }
          const newLoads: Load[] = added.map((a, i) => {
            const status: LoadStatus = 'PLANNED';
            const progress = PROGRESS_OF[status];
            const pos = positionAlong(progress);
            const code = a.code ?? `IMP-${Date.now()}-${i}`;
            return {
              id: uid('load'),
              code,
              itemType: a.itemType ?? 'SG',
              dims: a.dims ?? { lengthM: 16, widthM: 2.5, heightM: 2.5, weightT: 20 },
              qty: a.qty ?? 1,
              status,
              stage: STATUS_TO_STAGE[status],
              progress,
              plannedLoadDate: a.plannedLoadDate ?? '2026-09-28',
              plannedDeliverDate: a.plannedDeliverDate ?? '2026-10-01',
              carrierId: 'org-scx',
              resources: {
                driverName: null,
                driverPhone: null,
                tractorPlate: null,
                trailerPlate: null,
                escort: false,
                escortPlate: null,
                setLengthM: null,
                setWidthM: null,
                setHeightM: null,
                setWeightT: null,
              },
              awizacja: {
                loadWindowStart: null,
                loadWindowEnd: null,
                unloadWindowStart: null,
                unloadWindowEnd: null,
                confirmed: false,
              },
              ferry: { vessel: null, departureAt: null, arrivalAt: null, bookingRef: null, status: 'NONE' },
              pricing: {
                /* P6 — EUR (PLN ÷ 4,3900 · 186/A/NBP/2026) */
                costBase: 4328.02,
                costBaf: 259.68,
                costExtras: 182.23,
                costTotal: 4769.93,
                revBase: 5353.08,
                revBaf: 267.65,
                revExtras: 136.67,
                revTotal: 5757.4,
                margin: 987.47,
                marginPct: 0.1715,
                belowThreshold: false,
                currency: 'EUR',
              },
              etaSegments: [],
              etaBoden: null,
              etaConfidence: 'MED',
              etaEarliestHours: 0,
              etaLatestHours: 0,
              etaReasons: [],
              etaMethod: '',
              etaUpdatedAt: nowIso(),
              lat: pos.lat,
              lng: pos.lng,
              heading: pos.heading,
              silentMinutes: null,
              sequenceOrder: loads.length + i + 1,
              sequenceRisk: false,
              delayed: false,
              docMissing: false,
              ...a,
            } as Load;
          });
          /* M8 — każde wyliczenie przez niezmiennik (buildLoadMoney → assertSameMechanism); rozjazd przerywa */
          const today = localDateOf(getNowIso());
          loads = loads.map((l) => (changed.some((ch) => ch.id === l.id) ? withMoneyV2(l, today) : l));
          loads = [...loads, ...newLoads.map((l) => withMoneyV2(applyEtaToLoad(l, nowIso()), today))];
          const ver: ScheduleVersion = {
            id: uid('sv'),
            at: nowIso(),
            by: 'Marek KSH',
            filename,
            added: added.length,
            changed: changed.length,
            removed: effectiveRemovedIds.length,
            rejected,
            skippedStandard,
          };
          return {
            loads,
            scheduleVersions: [ver, ...s.scheduleVersions],
          };
        });
        if (effectiveRemovedIds.length > 0) {
          writeThrough({ type: 'loads.importCancel', loadIds: effectiveRemovedIds, reason: `Usunięty z harmonogramu (${filename})` });
        }
        const critical = changed.filter((c) => c.criticalDate);
        for (const ch of critical) {
          get().appendEvent({
            loadId: ch.id,
            type: 'SCHEDULE_DATE_CRITICAL',
            at: nowIso(),
            actor: 'import',
            note: 'Zmiana krytycznej daty na awizowanym — powiadom SCX',
          });
          get().pushToast(t(get().locale, 'a6_ts_crit_date'), 'HIGH', ch.id);
        }
        get().appendEvent({
          loadId: get().loads[0]?.id ?? 'load-001',
          type: 'SCHEDULE_IMPORTED',
          at: nowIso(),
          actor: 'KSH',
          note: filename,
        });
        get().pushToast(tp(get().locale, 'a6_ts_imp_sched', { filename }), 'MEDIUM');
        get().pushToast(standardSkipMessage(accepted ?? added.length, skippedStandard), 'MEDIUM');
      },

      updateFactoringOffer: (patch) => {
        set((s) => ({ factoringOffer: { ...s.factoringOffer, ...patch } }));
        get().pushToast(t(get().locale, 'a6_ts_fact_updated'), 'MEDIUM');
      },

      submitInvoice: (weekLabel, loadIds, billedAdjust, factoringSelected = false) => {
        const lines = loadIds.map((id) => {
          const l = get().loads.find((x) => x.id === id)!;
          const expected = l.pricing.costTotal;
          const billed = billedAdjust[id] ?? expected;
          return { loadId: id, code: l.code, expected, billed, diff: billed - expected };
        });
        const expectedTotal = lines.reduce((a, x) => a + x.expected, 0);
        const billedTotal = lines.reduce((a, x) => a + x.billed, 0);
        const disputed = lines.some((l) => Math.abs(l.diff) > 50);
        const createdAt = nowIso();
        const offer = get().factoringOffer;
        const useFactoring = Boolean(factoringSelected && offer.enabled);
        const factoring = useFactoring
          ? buildFactoringSnapshot(offer, billedTotal, createdAt)
          : undefined;
        const inv: Invoice = {
          id: uid('inv'),
          weekLabel,
          status: 'SUBMITTED',
          createdAt,
          expectedTotal,
          billedTotal,
          lines,
          note: disputed ? 'Wymaga weryfikacji HHL' : 'Do matchingu',
          factoring,
          payoutStatus: useFactoring ? 'NONE' : undefined,
        };
        set((s) => ({ invoices: [inv, ...s.invoices] }));
        get().pushToast(
          useFactoring
            ? tp(get().locale, 'a6_ts_inv_sent_f', { week: weekLabel, net: factoring!.netPayout })
            : tp(get().locale, 'a6_ts_inv_sent', { week: weekLabel }),
          'MEDIUM',
        );
      },

      resolveInvoice: (invoiceId, action) => {
        const acceptedAt = nowIso();
        set((s) => ({
          invoices: s.invoices.map((inv) => {
            if (inv.id !== invoiceId) return inv;
            if (action === 'MATCHED' && inv.factoring?.selected) {
              const payoutAt = computePayoutAt(
                acceptedAt,
                inv.factoring.delayValue,
                inv.factoring.delayUnit,
              );
              return {
                ...inv,
                status: action,
                payoutStatus: 'SCHEDULED' as const,
                factoring: { ...inv.factoring, payoutAt },
              };
            }
            return { ...inv, status: action };
          }),
        }));
        get().pushToast(t(get().locale, action === 'DISPUTED' ? 'a6_ts_inv_disputed' : 'a6_ts_inv_accepted'), action === 'DISPUTED' ? 'HIGH' : 'MEDIUM');
      },

      addSailing: (d) => {
        if (get().role !== 'HHL') return { ok: false, error: 'ROLE' };
        const error = checkSailingDraft(d, get().sailings);
        if (error) return { ok: false, error };
        const sailing: Sailing = {
          id: uid('sail'), vessel: d.vessel.trim(), route: d.route,
          departureAt: new Date(d.departureAt).toISOString(), arrivalAt: new Date(d.arrivalAt).toISOString(),
          delayedDepartureAt: null, delayedArrivalAt: null, status: 'ZAPLANOWANY', source: 'RECZNIE',
        };
        set((st) => ({ sailings: [...st.sailings, sailing] }));
        writeThrough({ type: 'sailing.save', sailing, isNew: true });
        return { ok: true, id: sailing.id };
      },

      delaySailing: (id, departureAt, arrivalAt) => {
        const cur = get().sailings.find((x) => x.id === id);
        if (get().role !== 'HHL' || !cur || cur.status === 'ODWOLANY') return false;
        const dep = Date.parse(departureAt); const arr = Date.parse(arrivalAt);
        if (!Number.isFinite(dep) || !Number.isFinite(arr) || arr <= dep) return false;
        /* M12: zmiana ręczna HHL → źródło RECZNIE (odczyt automatyczny jej nie nadpisze) */
        const next: Sailing = { ...cur, source: 'RECZNIE', status: 'OPOZNIONY', delayedDepartureAt: new Date(dep).toISOString(), delayedArrivalAt: new Date(arr).toISOString() };
        set((st) => ({
          sailings: st.sailings.map((x) => (x.id === id ? next : x)),
          loads: st.loads.map((l) => (l.sailingId === id ? { ...l, ferry: ferryFromSailing(next, l.ferry.bookingRef, l.ferry) } : l)),
        }));
        writeThrough({ type: 'sailing.save', sailing: next, isNew: false });
        return true;
      },

      cancelSailing: (id) => {
        const cur = get().sailings.find((x) => x.id === id);
        if (get().role !== 'HHL' || !cur || cur.status === 'ODWOLANY') return false;
        const next: Sailing = { ...cur, source: 'RECZNIE', status: 'ODWOLANY' };
        /* demo: ryzyko „rejs odwołany” od razu; w bazie — zadanie systemowe promote_ferry_departures */
        const risks = SUPABASE_AUTH_ENABLED ? [] : cancelledSailingRisks(next, get().loads);
        set((st) => ({
          sailings: st.sailings.map((x) => (x.id === id ? next : x)),
          loads: st.loads.map((l) => (l.sailingId === id ? { ...l, ferry: ferryFromSailing(next, l.ferry.bookingRef, l.ferry) } : l)),
          risks: [...risks.filter((r) => !st.risks.some((x) => x.id === r.id)), ...st.risks],
        }));
        writeThrough({ type: 'sailing.save', sailing: next, isNew: false });
        return true;
      },

      assignSailing: (loadId, sailingId, bookingRef) => {
        const st = get();
        const load = st.loads.find((l) => l.id === loadId);
        if (!load) return 'ROLE';
        const current = st.sailings.find((x) => x.id === load.sailingId);
        const target = sailingId ? st.sailings.find((x) => x.id === sailingId) ?? null : null;
        const denied = sailingAssignDenied(st.role, load, current, target, getNowIso());
        if (denied) return denied;
        const ref = bookingRef?.trim() || null;
        set((s2) => ({
          loads: s2.loads.map((l) => (l.id === loadId ? { ...l, sailingId: target?.id ?? null, ferry: ferryFromSailing(target ?? undefined, ref, l.ferry) } : l)),
        }));
        writeThrough({ type: 'load.sailing', loadId, sailingId: target?.id ?? null, bookingRef: ref });
        get().appendEvent({
          loadId, type: 'SAILING_ASSIGNED', at: nowIso(), actor: currentActorLabel(st.role),
          note: target ? `${target.vessel} · ${fmtLocal(target.departureAt)}${ref ? ` · ${ref}` : ''}` : 'rejs usunięty',
        });
        return null;
      },

      registerBill: (draft, file) => {
        const s = get();
        const today = localDateOf(getNowIso());
        if (!canRegisterBill(s.role, draft.direction)) {
          return { ok: false as const, errors: ['ROLE'] };
        }
        const chk = checkBill(draft, s.loads, s.bills, today);
        if (chk.errors.length) return { ok: false as const, errors: chk.errors };
        const { issuer, recipient } = billParties(draft.direction);
        const bill: Bill = {
          id: uid('bill'), direction: draft.direction, issuer, recipient, number: draft.number.trim(),
          issueDate: draft.issueDate, receiptDate: draft.receiptDate ?? null, weekKey: draft.weekKey, currency: draft.currency,
          net: draft.net!, vat: draft.vat!, gross: draft.gross!,
          dueDate: billDueDate(draft.direction, draft.issueDate, draft.dueDateFromDocument),
          dueFromDocument: Boolean(draft.dueDateFromDocument),
          verification: 'DO_WERYFIKACJI', disputeNote: null, payment: 'NIEOPLACONA', paidAt: null,
          pdfDocId: null, pdfName: draft.pdfName ?? null, lines: chk.lines,
          headerFlags: chk.headerFlags, missingLoadIds: chk.missingLoadIds, createdAt: nowIso(),
        };
        bill.payment = billPaymentToday(bill, today);
        set((st) => ({ bills: [bill, ...st.bills] }));
        /* Q13 — nowa faktura: powiadomienie odbiorcy (w bazie: notifications INVOICE_NEW) */
        get().pushNotification({
          title: t(s.locale, 'bill_notifyNew'),
          body: `${bill.number} · ${bill.weekKey} · ${bill.gross.toFixed(2)} ${bill.currency}`,
          severity: 'MEDIUM', roleScope: [recipient], href: { view: 'inv', entityId: bill.id },
        });
        writeThrough({ type: 'bill.register', bill, file: file ?? null });
        get().pushToast(`${t(s.locale, 'bill_registered')}: ${bill.number}`, 'MEDIUM');
        return { ok: true as const, id: bill.id };
      },

      verifyBill: (billId, next, note) => {
        const s = get();
        const b = s.bills.find((x) => x.id === billId);
        if (!b || !canVerifyBill(s.role, b)) {
          get().pushToast(t(s.locale, 'bill_verifyDenied'), 'HIGH');
          return false;
        }
        const err = verifyError(next, note);
        if (err) {
          get().pushToast(t(s.locale, 'bill_disputeNeedsNote'), 'HIGH');
          return false;
        }
        const disputeNote = next === 'SPORNA' ? (note ?? '').trim() : b.disputeNote ?? null;
        set((st) => ({ bills: st.bills.map((x) => (x.id === billId ? { ...x, verification: next, disputeNote } : x)) }));
        writeThrough({ type: 'bill.verify', billId, verification: next, note: disputeNote });
        return true;
      },

      markBillPaid: (billId, paidAt) => {
        const s = get();
        if (!canMarkPaid(s.role)) {
          get().pushToast(t(s.locale, 'bill_paidDenied'), 'HIGH');
          return false;
        }
        const bill = s.bills.find((x) => x.id === billId);
        if (bill && paymentBlockedByDispute(bill)) {
          get().pushToast(t(s.locale, 'iii7_pay_blocked'), 'HIGH');
          return false;
        }
        set((st) => ({ bills: st.bills.map((x) => (x.id === billId ? { ...x, payment: 'OPLACONA' as const, paidAt } : x)) }));
        writeThrough({ type: 'bill.paid', billId, paidAt });
        return true;
      },

      unmarkBillPaid: (billId, reason) => {
        const s = get();
        if (!canMarkPaid(s.role)) {
          get().pushToast(t(s.locale, 'bill_paidDenied'), 'HIGH');
          return false;
        }
        if (!reason.trim()) {
          get().pushToast(t(s.locale, 'bill_unpaidNeedsReason'), 'HIGH');
          return false;
        }
        const today = localDateOf(getNowIso());
        set((st) => ({
          bills: st.bills.map((x) => (x.id === billId ? { ...x, paidAt: null, payment: billPaymentToday({ ...x, paidAt: null, payment: 'NIEOPLACONA' }, today) } : x)),
        }));
        writeThrough({ type: 'bill.unpaid', billId, reason: reason.trim() });
        return true;
      },

      driverMilestone: (token, milestone) => {
        const loadId = DRIVER_TOKENS[token];
        if (!loadId) {
          get().pushToast(tp(get().locale, 'a6_ts_bad_token', { token }), 'HIGH');
          return;
        }
        /* M9 — STATUSY_AUTOMATYCZNE §6: „Załadowany” = MILESTONE_LOADED (bez zmiany statusu),
           „Rozładowany” = UNLOADED razem z datą; PROM ustawia wyłącznie zadanie systemowe rejsu */
        const act = milestoneAction(milestone);
        if (act.event) get().appendEvent({ loadId, type: act.event, at: nowIso(), actor: 'driver-pwa', note: `Kierowca: ${milestone}` });
        if (act.status) get().setLoadStatus(loadId, act.status, 'driver-pwa', `Milestone ${milestone}`);
        get().pushToast(tp(get().locale, 'a6_ts_driver_ms', { milestone, loadId }), 'MEDIUM', loadId);
      },

      driverReportFix: (token, fix) => {
        const loadId = DRIVER_TOKENS[token];
        if (!loadId) return;
        const first = !get().events.some((e) => e.loadId === loadId && e.type === 'POSITION_SHARED' && e.actor === 'driver-pwa');
        set((s) => ({ loads: s.loads.map((l) => (l.id === loadId ? { ...l, lat: fix.lat, lng: fix.lng, silentMinutes: 0 } : l)) }));
        writeThrough({ type: 'position.report', loadId, lat: fix.lat, lng: fix.lng, at: fix.at, accuracy: fix.accuracy, speedKmh: fix.speedKmh, heading: fix.heading });
        /* oś czasu: pierwsza pozycja z aplikacji (kolejne zasilają strefy, nie zaśmiecają historii) */
        if (first) {
          const ev = { loadId, type: 'POSITION_SHARED', at: fix.at, actor: 'driver-pwa', note: `GPS ${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}`, payload: { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, source: 'navigator.geolocation' } };
          set((s) => ({ events: [{ ...ev, id: uid('ev') }, ...s.events] }));
        }
      },

      driverSharePosition: (token) => {
        const loadId = DRIVER_TOKENS[token];
        if (!loadId) {
          get().pushToast(tp(get().locale, 'a6_ts_bad_token', { token }), 'HIGH');
          return;
        }
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          get().appendEvent({ loadId, type: 'POSITION_SHARE_DENIED', at: nowIso(), actor: 'driver-pwa', note: 'navigator.geolocation niedostępne' });
          get().pushToast(t(get().locale, 'a6_ts_geo_na'), 'HIGH', loadId);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const c = pos.coords;
            get().driverReportFix(token, {
              lat: c.latitude, lng: c.longitude, at: nowIso(),
              accuracy: Number.isFinite(c.accuracy) ? Math.round(c.accuracy) : null,
              speedKmh: c.speed != null ? Math.round(c.speed * 3.6) : null,
              heading: c.heading != null && Number.isFinite(c.heading) ? Math.round(c.heading) : null,
            });
            get().pushToast(tp(get().locale, 'a6_ts_pos', { lat: c.latitude.toFixed(4), lng: c.longitude.toFixed(4) }), 'MEDIUM', loadId);
          },
          (err) => {
            const msg =
              err.code === 1 ? 'Odmowa dostępu do lokalizacji'
                : err.code === 2 ? 'Pozycja niedostępna'
                  : err.code === 3 ? 'Timeout geolokalizacji'
                    : err.message || 'Błąd geolokalizacji';
            get().appendEvent({ loadId, type: 'POSITION_SHARE_DENIED', at: nowIso(), actor: 'driver-pwa', note: msg, payload: { code: err.code, message: err.message } });
            get().pushToast(err.code >= 1 && err.code <= 3 ? t(get().locale, err.code === 1 ? 'a6_ts_geo_denied' : err.code === 2 ? 'a6_ts_geo_unavail' : 'a6_ts_geo_timeout') : msg, 'HIGH', loadId);
          },
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
        );
      },


      ensureRiskFromSituation: (situation, loadId) => {
        const existing = get().risks.find((r) => r.situationId === situation.id);
        if (existing) return existing.id;
        const { riskTypeForSituation } = require('../lib/trafikverket') as typeof import('../lib/trafikverket');
        const type = riskTypeForSituation(situation.severity);
        const targetLoadId =
          loadId ??
          get().loads.find((l) => l.stage === 'SE_ROAD' || l.status === 'IN_TRANSIT_SE')?.id;
        const hours = Math.max(1, Math.round((situation.delayMin || 60) / 60));
        const id = `risk-tv-${situation.id}`;
        const risk = {
          id,
          type,
          severity: situation.severity,
          title:
            type === 'FORCE_MAJEURE'
              ? `Siła wyższa — ${situation.title} · +${hours} h`
              : `${situation.title} · +${situation.delayMin} min`,
          detail: situation.detail,
          loadId: targetLoadId,
          owner: 'HHL' as const,
          meta: `Odpowiada: H&H Logistics · Trafikverket · ${situation.kind}`,
          titleKey: type === 'FORCE_MAJEURE' ? 'rk_seed_tv_fm' : 'rk_seed_tv',
          titleParams: type === 'FORCE_MAJEURE' ? { title: situation.title, h: hours } : { title: situation.title, min: situation.delayMin },
          metaKey: 'rk_seed_tv_meta',
          metaParams: { kind: situation.kind },
          nextAction: type === 'FORCE_MAJEURE' ? 'Wymaga decyzji — hold / objazd' : 'Śledź checkpoint',
          ageHours: 0.1,
          delayImpactHours: hours,
          situationId: situation.id,
          causeCategory: situation.kind,
        };
        set((s) => {
          const risks = [risk, ...s.risks.filter((r) => r.id !== id)];
          const loads = applyForceMajeureDelays(s.loads, risks);
          const exceptions = exceptionsFromRisks(risks, loads);
          return { risks, loads, exceptions };
        });
        get().pushToast(risk.title, situation.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH', targetLoadId);
        return id;
      },
      applyPlanB: (riskId, optionIndex = 0) => {
        const risk = get().risks.find((r) => r.id === riskId);
        if (!risk?.ferryPlanB?.length) {
          get().pushToast(t(get().locale, 'a6_ts_no_planb'), 'HIGH');
          return;
        }
        const idx = Math.max(0, Math.min(optionIndex, risk.ferryPlanB.length - 1));
        const option = risk.ferryPlanB[idx];
        const loadId =
          risk.loadId ??
          get().loads.find((l) => l.status === 'ON_FERRY' || l.status === 'AT_PORT')?.id ??
          get().loads.find((l) => l.ferry?.status === 'BOOKED' || l.ferry?.vessel)?.id;
        if (!loadId) {
          get().pushToast(t(get().locale, 'a6_ts_planb_noload'), 'CRITICAL');
          return;
        }
        const at = nowIso();
        const lower = option.toLowerCase();
        const vessel: FerryBooking['vessel'] = lower.includes('nova')
          ? 'Nova Star'
          : lower.includes('wawel')
            ? 'Wawel'
            : 'Nova Star';
        const dep = new Date(Date.parse(at) + 24 * 3600 * 1000);
        dep.setHours(11, 0, 0, 0);
        const arr = new Date(dep.getTime() + 19 * 3600 * 1000);
        const bookingRef = `PLANB-${risk.id}-${idx + 1}`;
        if (loadId) {
          set((s) => ({
            loads: s.loads.map((l) => {
              if (l.id !== loadId) return l;
              return applyEtaToLoad(
                {
                  ...l,
                  ferry: {
                    ...l.ferry,
                    vessel,
                    departureAt: dep.toISOString(),
                    arrivalAt: arr.toISOString(),
                    bookingRef,
                    status: 'BOOKED',
                  },
                },
                at,
              );
            }),
            risks: s.risks.map((r) =>
              r.id === riskId
                ? {
                    ...r,
                    severity: 'MEDIUM' as const,
                    meta: `Plan B aktywny: ${option}`,
                    metaKey: 'rk_planb_meta',
                    metaParams: { option },
                    nextAction: `Plan B aktywny: ${option}`,
                    detail: `${r.detail} · Zastosowano: ${option}`,
                  }
                : r,
            ),
          }));
          get().appendEvent({
            loadId,
            type: 'PLAN_B_ACTIVATED',
            at,
            actor: currentActorLabel(get().role),
            note: option,
            payload: {
              riskId,
              optionIndex: idx,
              option,
              vessel,
              bookingRef,
              departureAt: dep.toISOString(),
            },
          });
        }
        get().pushNotification({
          title: 'Plan B · Prom',
          body: `${risk.title}: ${option}${loadId ? ` · booking ${bookingRef}` : ''}`,
          severity: 'HIGH',
          loadId,
          roleScope: ['SCX', 'HHL'],
          href: { view: 'risk', entityId: risk.id, loadId },
        });
        get().pushToast(tp(get().locale, 'a6_ts_planb', { option }), 'HIGH', loadId);
      },

      applySeRouteAlt: (altIndex) => {
        const idx = Math.max(0, Math.min(altIndex, SE_ROUTE_ALTS.length - 1));
        const alt = SE_ROUTE_ALTS[idx];
        const roadRisk =
          get().risks.find((r) => r.type === 'ROAD_SE' && r.severity !== 'LOW') ??
          get().risks.find((r) => r.type === 'ROAD_SE');
        const loadId =
          roadRisk?.loadId ??
          get().loads.find((l) => l.status === 'IN_TRANSIT_SE' || l.status === 'APPROACHING_SITE')?.id ??
          get().loads.find((l) => l.stage === 'SE_ROAD')?.id;
        if (!loadId) {
          get().pushToast(t(get().locale, 'a6_ts_alt_noload'), 'HIGH');
          return;
        }
        const at = nowIso();
        const delayH = Math.round((alt.delayMin / 60) * 10) / 10;
        set((s) => ({
          loads: s.loads.map((l) => {
            if (l.id !== loadId) return l;
            const eta = l.etaBoden ? new Date(Date.parse(l.etaBoden) + alt.delayMin * 60_000).toISOString() : l.etaBoden;
            return applyEtaToLoad(
              {
                ...l,
                delayed: true,
                etaBoden: eta,
              },
              at,
            );
          }),
          risks: s.risks.map((r) => {
            if (roadRisk && r.id === roadRisk.id) {
              return {
                ...r,
                severity: 'MEDIUM' as const,
                meta: `Alternatywa SE: ${alt.title}`,
                metaKey: 'rk_alt_se_meta',
                metaParams: { title: alt.title },
                nextAction: `Trasa: ${alt.title}`,
                detail: `${r.detail} · Wybrano: ${alt.title}`,
                delayImpactHours: delayH,
              };
            }
            return r;
          }),
        }));
        get().appendEvent({
          loadId,
          type: 'NOTE',
          at,
          actor: currentActorLabel(get().role),
          note: `Alternatywa SE: ${alt.title}`,
          payload: { altId: alt.id, altIndex: idx, delayMin: alt.delayMin },
        });
        get().pushNotification({
          title: 'Alternatywa SE',
          body: `${alt.title} · +${alt.delayMin} min`,
          severity: 'MEDIUM',
          loadId,
          roleScope: ['SCX', 'HHL'],
          href: { view: 'risk', loadId },
        });
        get().pushToast(tp(get().locale, 'a6_ts_alt', { title: alt.title }), 'MEDIUM', loadId);
      },
    }),
    {
      // BK3: tryb Supabase = osobny klucz; lokalny magazyn v2 (dane demo) nie jest czytany ani przenoszony.
      name: SUPABASE_MODE ? `${STORE_PERSIST_KEY}-supabase` : STORE_PERSIST_KEY,
      version: STORE_SCHEMA_VERSION,
      storage: createVersionedJSONStorage(),
      migrate: migrateTowerPersistForZustand,
      partialize: (s) => SUPABASE_MODE ? ({
        // BK3: w trybie Supabase tylko preferencje UI — dane są na serwerze (store = cache).
        locale: s.locale,
        displayCurrency: s.displayCurrency,
        theme: s.theme,
        themeManual: s.themeManual,
        showDemoMarks: s.showDemoMarks,
        notificationPrefs: s.notificationPrefs,
      }) : ({
        role: s.role,
        locale: s.locale,
        displayCurrency: s.displayCurrency,
        theme: s.theme,
        themeManual: s.themeManual,
        showDemoMarks: s.showDemoMarks,
        factoringOffer: s.factoringOffer,
        loads: s.loads,
        events: s.events,
        // BK4: bajty plików (zdjęcia kierowcy, skany) nie trafiają do localStorage — tylko metadane.
        documents: s.documents.map((d) => (d.dataUrl ? { ...d, dataUrl: null } : d)),
        messages: s.messages,
        notifications: s.notifications,
        notificationPrefs: s.notificationPrefs,
        invoices: s.invoices,
        bills: s.bills,
        sailings: s.sailings,
        geofences: s.geofences,
        workflows: s.workflows,
        workflowRuns: s.workflowRuns,
        scheduleVersions: s.scheduleVersions,
        rateCost: s.rateCost,
        rateRev: s.rateRev,
        baf: s.baf,
        risks: s.risks,
        exceptions: s.exceptions,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error || consumePersistWipeNotice()) {
          queueMicrotask(() => {
            try {
              useTowerStore.getState().pushToast(STORE_WIPE_MESSAGE_PL, 'HIGH');
            } catch {
              /* store may be mid-init in tests */
            }
          });
        }
        if (!state) return;
        if (state.role) setPreviewViewRole(state.role);
        // After persist merge: stale theme must not stick when user never toggled manually.
        const theme = state.themeManual
          ? state.theme
          : systemTheme();
        if (!state.themeManual && theme !== state.theme) {
          /* B-PERSIST-TOAST (06.10): przy pustym magazynie hydratacja biegnie synchronicznie wewnątrz create(),
             zanim `useTowerStore` jest przypisany — bezpośrednie setState rzucało TypeError, zustand wołał ten
             callback ponownie z `error` i każdy nowy użytkownik dostawał toast „stan uszkodzony” (regresja Q-9 B).
             Aktualizacja stanu w mikrozadaniu; motyw na DOM ustawiamy od razu. */
          queueMicrotask(() => {
            try {
              useTowerStore.setState({ theme });
            } catch {
              /* store may be mid-init in tests */
            }
          });
        }
        applyThemeToDom(theme);
      },
    },
  ),
);

setPreviewViewRole(useTowerStore.getState().role);

export { DRIVER_TOKENS };
