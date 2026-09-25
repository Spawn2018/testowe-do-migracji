import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SE_ROUTE_ALTS } from '../lib/seRouteAlts';
import type {
  AppToast,
  Awizacja,
  BafParams,
  CorridorStage,
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
import { defaultThemeForRole } from '../lib/permissions';
import { applyThemeToDom, type Theme } from '../lib/theme';
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
import { writeThrough } from '../data/registry';
import { t } from '../i18n/messages';
import { SUPABASE_AUTH_ENABLED } from '../auth/config';
import { PROGRESS_OF, STATUS_TO_STAGE, positionAlong } from '../lib/status';
import { applyEtaToLoad } from '../lib/eta';
import { isReadyBlocked } from '../lib/permits';

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

function nowIso() {
  return new Date().toISOString().replace('Z', '+02:00');
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
export const DEFAULT_FACTORING_OFFER: FactoringOffer = {
  enabled: true,
  feePercent: 2.5,
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
  stageFilter: CorridorStage | null;
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
  factoringOffer: FactoringOffer;
  scheduleVersions: ScheduleVersion[];
  rateCost: RateRule[];
  rateRev: RateRule[];
  baf: BafParams;
  toasts: AppToast[];

  navCollapsed: boolean;
  drawerTab: string | null;
  riskFilter: string | null;
  docsFilter: 'missing' | null;
  /** Map POI / geofence / situation focus — 2nd click same key clears */
  mapFocusKey: string | null;

  setRole: (role: RoleId) => void;
  setNavCollapsed: (v: boolean, opts?: { persist?: boolean }) => void;
  setDrawerTab: (tab: string | null) => void;
  navigateTo: (opts: {
    view?: ViewKey;
    tab?: string | null;
    loadId?: string | null;
    stage?: CorridorStage | null;
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
  setView: (view: ViewKey) => void;
  setStageFilter: (stage: CorridorStage | null) => void;
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
  updateAwizacja: (loadId: string, patch: Partial<Awizacja>) => void;
  updateFerry: (loadId: string, patch: Partial<FerryBooking>) => void;
  setLoadStatus: (loadId: string, status: LoadStatus, actor?: string, note?: string) => void;
  appendEvent: (ev: Omit<LoadEvent, 'id'>) => void;
  sendMessage: (loadId: string, text: string) => void;
  uploadDocument: (
    loadId: string,
    category: Document['category'],
    name: string,
    opts?: { dataUrl?: string; mimeType?: string; bytes?: number },
  ) => void;
  /** BK4: dokument już zapisany w Supabase Storage (bajty nie trafiają do przeglądarki). */
  addStoredDocument: (doc: Document, actor?: string) => void;

  saveGeofence: (g: Geofence) => void;
  assignScx: (loadId: string, rateNote?: string) => void;
  triggerGeofence: (loadId: string, geofenceId: string) => void;
  toggleWorkflow: (id: string) => void;
  createWorkflow: (rule: Omit<WorkflowRule, 'id' | 'runCount'>) => string;
  updateWorkflow: (id: string, patch: Partial<WorkflowRule>) => void;
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
  }) => void;

  updateFactoringOffer: (patch: Partial<FactoringOffer>) => void;
  submitInvoice: (
    weekLabel: string,
    loadIds: string[],
    billedAdjust: Record<string, number>,
    factoringSelected?: boolean,
  ) => void;
  resolveInvoice: (invoiceId: string, action: 'MATCHED' | 'DISPUTED') => void;

  driverMilestone: (token: string, milestone: 'LOADED' | 'ON_FERRY' | 'UNLOADED' | 'PROBLEM') => void;
  driverSharePosition: (token: string) => void;

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
      factoringOffer: { ...DEFAULT_FACTORING_OFFER },
      scheduleVersions: initialData.scheduleVersions,
      rateCost: RATE_COST,
      rateRev: RATE_REV,
      baf: BAF_PARAMS,
      toasts: [],

      initTheme: () => {
        const { theme, themeManual, role } = get();
        // Fala-1-D16: role default wins until user toggles (themeManual).
        const next = themeManual ? theme : defaultThemeForRole(role);
        if (!themeManual && next !== theme) set({ theme: next });
        applyThemeToDom(next);
      },

      setRole: (role) => {
        const { themeManual, theme } = get();
        // VISUAL_BRIEF §8: if user did NOT manually override, apply role default.
        // Manual toggle wins for rest of session (themeManual stays true).
        const nextTheme = themeManual ? theme : defaultThemeForRole(role);
        applyThemeToDom(nextTheme);
        const defaultView = role === 'SCX' ? 'tasks' : 'dash';
        set({ role, theme: nextTheme, view: defaultView as ViewKey });
      },

      setLocale: (locale) => set({ locale }),

      setDisplayCurrency: (displayCurrency) => set({ displayCurrency }),

      setShowDemoMarks: (showDemoMarks) => set({ showDemoMarks }),

      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        applyThemeToDom(next);
        set({ theme: next, themeManual: true });
      },

      setTheme: (theme) => {
        applyThemeToDom(theme);
        set({ theme, themeManual: true });
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
      },

      openNotification: (id) => {
        const n = get().notifications.find((x) => x.id === id);
        if (!n) return;
        const href = n.href;
        const alias: Record<string, string> = {
          risk: 'risk',
          risks: 'risk',
          docs: 'docs',
          fin: 'fin',
          finance: 'fin',
          inv: 'inv',
          invoices: 'inv',
          map: 'map',
          geo: 'geo',
          geofence: 'geo',
          wf: 'wf',
          workflow: 'wf',
          sched: 'sched',
          schedule: 'sched',
          tasks: 'tasks',
          dash: 'dash',
        };
        const raw = href?.view ?? '';
        const view = (alias[raw] ?? raw) || undefined;
        get().navigateTo({
          view: view as any,
          tab: href?.tab ?? null,
          loadId: href?.loadId ?? n.loadId ?? null,
          riskFilter: href?.entityId?.startsWith('risk') ? href.entityId : href?.entityId && view === 'risk' ? href.entityId : undefined,
          docsFilter: view === 'docs' ? 'missing' : undefined,
        });
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
          get().pushToast(`Nieznany token kierowcy: ${token}`, 'HIGH');
          return;
        }
        const load = get().loads.find((l) => l.id === loadId);
        if (!load) {
          get().pushToast(
            `Token OK (${token}) ale brak ładunku ${loadId} w bazie — import mógł usunąć transport`,
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
          get().pushToast('Brak danych pliku — aparat nie zapisał zawartości', 'HIGH', loadId);
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
        get().pushToast(`Dokument: ${category} · ${payload.filename}`, 'MEDIUM', loadId);
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

      setLoadStatus: (loadId, status, actor = 'system', note) => {
        if (status === 'READY' || status === 'IN_TRANSIT_PL' || status === 'LOADING') {
          const load = get().loads.find((l) => l.id === loadId);
          if (load) {
            const gate = isReadyBlocked(load, get().documents);
            if (gate.blocked) {
              const label = status === 'READY' ? 'READY' : 'Wyjazd';
              get().pushToast(`${label} zablokowane: ${gate.reason}`, 'CRITICAL', loadId);
              get().appendEvent({
                loadId,
                type: 'READY_BLOCKED',
                at: nowIso(),
                actor,
                note: `${label}: ${gate.reason}`,
              });
              return;
            }
          }
        }
        const progress = PROGRESS_OF[status];
        const pos = positionAlong(progress);
        const at = nowIso();
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
            };
            return applyEtaToLoad(next, at);
          }),
        }));
        writeThrough({ type: 'load.status', loadId, status });
        get().appendEvent({ loadId, type: `STATUS_${status}`, at, actor, note });
        if (status === 'UNLOADING' || note?.includes('UNLOADED')) {
          get().pushNotification({
            title: 'Zadanie POD 24h',
            body: `Po rozładunku — wgraj POD w 24h`,
            severity: 'HIGH',
            loadId,
            roleScope: ['HHL', 'SCX'],
            href: { view: 'tasks', loadId },
          });
        }
      },

      updateResources: (loadId, patch) => {
        const role = get().role;
        const at = nowIso();
        set((s) => {
          const loads = s.loads.map((l) =>
            l.id === loadId ? { ...l, resources: { ...l.resources, ...patch } } : l,
          );
          const updated = loads.find((l) => l.id === loadId);
          const complete = resourcesComplete(updated?.resources);
          const risks = clearResourceGapRisks(s.risks, loadId, complete);
          const exceptions = exceptionsFromRisks(risks, loads);
          return { loads, risks, exceptions };
        });
        writeThrough({ type: 'load.resources', loadId, patch });
        get().appendEvent({
          loadId,
          type: 'RESOURCES_UPDATED',
          at,
          actor: role,
          payload: patch as Record<string, unknown>,
        });
        get().pushToast('Zasoby zapisane', 'MEDIUM', loadId);

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
          actor: role,
          payload: patch as Record<string, unknown>,
        });
        get().pushToast('Awizacja zapisana', 'MEDIUM', loadId);

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
        get().appendEvent({ loadId, type: 'FERRY_UPDATED', at, actor: get().role });
      },

      sendMessage: (loadId, text) => {
        const msg: LoadMessage = {
          id: uid('msg'),
          loadId,
          at: nowIso(),
          author: get().role,
          org: get().role,
          text,
        };
        set((s) => ({ messages: [...s.messages, msg] }));
        writeThrough({ type: 'message.send', loadId, text });
      },

      uploadDocument: (loadId, category, name, opts) => {
        const load = get().loads.find((l) => l.id === loadId);
        const mismatch =
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
          actor: get().role,
          note: dataUrl ? `${name} (${opts?.bytes ?? 0} B)` : name,
          payload: { category, hasDataUrl: !!dataUrl, documentId: doc.id },
        });
        if (mismatch) {
          get().pushToast('Zezwolenie nie pasuje do wymiarów — READY zablokowane', 'CRITICAL', loadId);
        } else {
          get().pushToast(dataUrl ? `Dokument wgrany · ${name}` : 'Dokument dodany', 'MEDIUM', loadId);
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
          actor: actor ?? get().role,
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
        get().pushToast(`Strefa zapisana: ${g.name}`, 'MEDIUM');
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
          actor: get().role,
          note: rateNote ?? 'SCX + cennik',
          payload: { carrierId: 'org-scx', rateNote: rateNote ?? null },
        });
        get().pushToast('Przypisano SCX i cennik', 'MEDIUM', loadId);
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
          PORT_IN: 'IN_TRANSIT_SE',
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
            href: { view: 'geo', loadId, entityId: g.id },
          });
        }
        // Auto-run PRE_ARRIVAL workflow if enabled
        if (g.type === 'PRE_ARRIVAL') {
          const wf = get().workflows.find((w) => w.id === 'wf-1' && w.enabled);
          if (wf) get().runWorkflowNow(wf.id);
        }
        get().pushToast(`Strefa ${g.type}: ${g.name}`, 'MEDIUM', loadId);
      },

      toggleWorkflow: (id) => {
        set((s) => ({
          workflows: s.workflows.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w)),
        }));
      },

      createWorkflow: (rule) => {
        const id = uid('wf');
        const workflow: WorkflowRule = { ...rule, id, runCount: 0 };
        set((s) => ({ workflows: [workflow, ...s.workflows] }));
        get().pushToast(`Dodano regułę: ${workflow.name}`, 'MEDIUM');
        return id;
      },

      updateWorkflow: (id, patch) => {
        set((s) => ({
          workflows: s.workflows.map((w) => (w.id === id ? { ...w, ...patch } : w)),
        }));
        get().pushToast('Workflow zaktualizowany', 'MEDIUM');
      },

      runWorkflowNow: (id) => {
        const wf = get().workflows.find((w) => w.id === id);
        if (!wf) return;
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
        get().pushToast(`Uruchomiono: ${wf.name}`, 'HIGH', run.loadId);
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

      commitImport: ({ added, changed, removedIds, rejected, filename, accepted, allowRemovals }) => {
        // Normal schedule imports are additive. Ignore any legacy/provided removals unless
        // a caller explicitly opts into the destructive path.
        const effectiveRemovedIds = allowRemovals ? removedIds : [];
        if (removedIds.length > 0 && !allowRemovals) {
          get().pushToast(
            `Import: pominięto usuwanie ${removedIds.length} pozycji (tryb dopisywania)`,
            'MEDIUM',
          );
        }
        // CRITICAL integrity: never mutate when dry-run accepted === 0
        if (accepted === 0) {
          get().pushToast(
            'Import odrzucony — brak poprawnych wierszy, baza nietknięta',
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
            'Import odrzucony — brak poprawnych wierszy, baza nietknięta',
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
          loads = [...loads, ...newLoads.map((l) => applyEtaToLoad(l, nowIso()))];
          const ver: ScheduleVersion = {
            id: uid('sv'),
            at: nowIso(),
            by: 'Marek KSH',
            filename,
            added: added.length,
            changed: changed.length,
            removed: effectiveRemovedIds.length,
            rejected,
          };
          return {
            loads,
            scheduleVersions: [ver, ...s.scheduleVersions],
          };
        });
        const critical = changed.filter((c) => c.criticalDate);
        for (const ch of critical) {
          get().appendEvent({
            loadId: ch.id,
            type: 'SCHEDULE_DATE_CRITICAL',
            at: nowIso(),
            actor: 'import',
            note: 'Zmiana krytycznej daty na awizowanym — powiadom SCX',
          });
          get().pushToast('Krytyczna data → powiadomienie SCX', 'HIGH', ch.id);
        }
        get().appendEvent({
          loadId: get().loads[0]?.id ?? 'load-001',
          type: 'SCHEDULE_IMPORTED',
          at: nowIso(),
          actor: 'KSH',
          note: filename,
        });
        get().pushToast(`Import harmonogramu · ${filename}`, 'MEDIUM');
      },

      updateFactoringOffer: (patch) => {
        set((s) => ({ factoringOffer: { ...s.factoringOffer, ...patch } }));
        get().pushToast('Oferta factoringu zaktualizowana', 'MEDIUM');
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
            ? `Faktura ${weekLabel} wysłana (factoring · net ${factoring!.netPayout})`
            : `Faktura ${weekLabel} wysłana`,
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
        get().pushToast(action === 'DISPUTED' ? 'Faktura w sporze' : 'Faktura zaakceptowana', action === 'DISPUTED' ? 'HIGH' : 'MEDIUM');
      },

      driverMilestone: (token, milestone) => {
        const loadId = DRIVER_TOKENS[token];
        if (!loadId) {
          get().pushToast(`Nieznany token kierowcy: ${token}`, 'HIGH');
          return;
        }
        const map: Record<typeof milestone, LoadStatus> = {
          LOADED: 'LOADING',
          ON_FERRY: 'ON_FERRY',
          UNLOADED: 'UNLOADING',
          PROBLEM: 'DELAYED',
        };
        const status = map[milestone];
        get().setLoadStatus(loadId, status, 'driver-pwa', `Milestone ${milestone}`);
        get().pushToast(`Kierowca: ${milestone} → ${loadId}`, 'MEDIUM', loadId);
      },

      driverSharePosition: (token) => {
        const loadId = DRIVER_TOKENS[token];
        if (!loadId) {
          get().pushToast(`Nieznany token kierowcy: ${token}`, 'HIGH');
          return;
        }
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          get().appendEvent({
            loadId,
            type: 'POSITION_SHARE_DENIED',
            at: nowIso(),
            actor: 'driver-pwa',
            note: 'navigator.geolocation niedostępne',
          });
          get().pushToast('Geolokalizacja niedostępna w tej przeglądarce', 'HIGH', loadId);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const at = nowIso();
            set((s) => ({
              loads: s.loads.map((l) => (l.id === loadId ? { ...l, lat, lng } : l)),
            }));
            get().appendEvent({
              loadId,
              type: 'POSITION_SHARED',
              at,
              actor: 'driver-pwa',
              note: `GPS ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
              payload: {
                lat,
                lng,
                accuracy: pos.coords.accuracy,
                source: 'navigator.geolocation',
              },
            });
            get().pushToast(
              `Pozycja: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
              'MEDIUM',
              loadId,
            );
          },
          (err) => {
            const msg =
              err.code === 1
                ? 'Odmowa dostępu do lokalizacji'
                : err.code === 2
                  ? 'Pozycja niedostępna'
                  : err.code === 3
                    ? 'Timeout geolokalizacji'
                    : err.message || 'Błąd geolokalizacji';
            get().appendEvent({
              loadId,
              type: 'POSITION_SHARE_DENIED',
              at: nowIso(),
              actor: 'driver-pwa',
              note: msg,
              payload: { code: err.code, message: err.message },
            });
            get().pushToast(msg, 'HIGH', loadId);
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
          nextAction: type === 'FORCE_MAJEURE' ? 'Wymaga decyzji — hold / objazd' : 'Śledź checkpoint',
          ageHours: 0.1,
          delayImpactHours: hours,
          situationId: situation.id,
          causeCategory: situation.kind,
        };
        set((s) => {
          const risks = [risk, ...s.risks.filter((r) => r.id !== id)];
          const loads = applyForceMajeureDelays(s.loads, risks);
          const exceptions = risks.map((r) => ({
            id: `ex-${r.id}`,
            severity: r.severity,
            title: r.title,
            owner: r.owner,
            meta: r.meta,
            nextAction: r.nextAction,
            ageHours: r.ageHours,
            loadId: r.loadId,
            code: r.loadId ? loads.find((l) => l.id === r.loadId)?.code : undefined,
          }));
          return { risks, loads, exceptions };
        });
        get().pushToast(risk.title, situation.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH', targetLoadId);
        return id;
      },
      applyPlanB: (riskId, optionIndex = 0) => {
        const risk = get().risks.find((r) => r.id === riskId);
        if (!risk?.ferryPlanB?.length) {
          get().pushToast('Brak opcji Plan B dla tego ryzyka', 'HIGH');
          return;
        }
        const idx = Math.max(0, Math.min(optionIndex, risk.ferryPlanB.length - 1));
        const option = risk.ferryPlanB[idx];
        const loadId =
          risk.loadId ??
          get().loads.find((l) => l.status === 'ON_FERRY' || l.status === 'AT_PORT')?.id ??
          get().loads.find((l) => l.ferry?.status === 'BOOKED' || l.ferry?.vessel)?.id;
        if (!loadId) {
          get().pushToast('Plan B: brak transportu do przypisania', 'CRITICAL');
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
            actor: get().role,
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
        get().pushToast(`Plan B: ${option}`, 'HIGH', loadId);
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
          get().pushToast('Brak transportu SE do przypisania alternatywy', 'HIGH');
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
          actor: get().role,
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
        get().pushToast(`Alternatywa SE: ${alt.title}`, 'MEDIUM', loadId);
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
        // After persist merge: stale theme must not stick when user never toggled manually.
        const theme = state.themeManual
          ? state.theme
          : defaultThemeForRole(state.role);
        if (!state.themeManual && theme !== state.theme) {
          useTowerStore.setState({ theme });
        }
        applyThemeToDom(theme);
      },
    },
  ),
);

export { DRIVER_TOKENS };
