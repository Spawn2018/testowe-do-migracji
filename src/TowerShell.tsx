/**
 * #274 (pomiar Lighthouse 24.10: logowanie na telefonie 5,8 s, próg 2,5 s) — powłoka aplikacji (pasek, menu, widoki,
 * panel transportu) w osobnym kawałku. Ekran logowania (`AuthGate`) nie czeka już na kod powłoki: `App.tsx` ładuje ją leniwie.
 */
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { usePushOpen } from './lib/pushOpen';
import { NewVersionBar } from './components/shell/NewVersionBar';
import { PartBoundary } from './components/shell/PartBoundary';
import { applyThemeToDom } from './lib/theme';
import { useTowerStore } from './store/useTowerStore';
import { Topbar } from './components/shell/Topbar';
import { StageBar } from './components/shell/StageBar';
import { Nav } from './components/shell/Nav';
import { Toasts } from './components/shell/Toasts';
import { SystemBroadcastBanner } from './components/shell/SystemBroadcastBanner';
import { PhoneMissingBar } from './components/shell/PhoneMissingBar';
import { ImpersonationBanner } from './auth/ImpersonationBanner';
import { PreviewBanner } from './auth/PreviewBanner';
import { lazyRetry } from './lib/lazyRetry';
import { DashboardView } from './views/DashboardView';
import { MapViewLazy as MapView } from './views/mapLazy';
/* wyglad/P7-c: Harmonogram (E38, E30) ładowany osobno (budżet pierwszego wczytania) */
import { ScheduleViewLazy as ScheduleView } from './views/scheduleLazy';
/* wyglad/P6: Ryzyka (E7) ładowane osobno (budżet pierwszego wczytania) */
import { RisksViewLazy as RisksView } from './views/risksLazy';
import { DocsViewLazy as DocsView } from './views/docsLazy';
import { FinanceViewLazy as FinanceView } from './views/financeLazy';
import { InvoicesViewLazy as InvoicesView } from './views/invoicesLazy';
import { TasksView } from './views/TasksView';
import { WorkflowsViewLazy as WorkflowsView } from './views/workflowsLazy';
import { GeofenceView } from './views/GeofenceView';
import { ZonesViewLazy as ZonesView } from './views/zonesLazy';
import { zonesReady } from './lib/p8cReady';
/* wyglad/P3-c: Opcje i Ustawienia ładowane osobno (budżet pierwszego wczytania) */
import { OptionsViewLazy as OptionsView, SettingsViewLazy as SettingsView } from './views/optionsLazy';
import { navForRole } from './lib/permissions';
import { usePageSectionDnD } from './hooks/usePageSectionDnD';
import { useRouteSync } from './hooks/useRouteSync';
import { SUPABASE_AUTH_ENABLED } from './auth/config';
import { canSwitchView } from './lib/prodFacade';
import { switchViewRole } from './auth/previewSwitch';
import { ACCESS_OPEN_LOAD, accessNoteText, parseAccessNote } from './lib/accessNote';
import { t } from './i18n/messages';
import { usePhoneTableLabels } from './lib/phoneTableLabels';

const loadDrawerChunk = () => import('./components/drawer/LoadDrawer').then((m) => ({ default: m.LoadDrawer }));
const LoadDrawer = lazy(lazyRetry(loadDrawerChunk));
/* #594 B1: okno „Zmiany z pliku KSH” — osobny fragment, pobierany dopiero po kliknięciu powiadomienia (budżet D15) */
const KshImportSummaryModal = lazy(lazyRetry(() => import('./components/shell/KshImportSummaryModal').then((m) => ({ default: m.KshImportSummaryModal }))));
/* pobranie panelu transportu w tle, gdy przeglądarka jest wolna (pierwsze kliknięcie bez czekania) */
if (typeof window !== 'undefined') {
  const idle = (window as Window & { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback;
  const warm = () => { void loadDrawerChunk().catch(() => undefined); };
  if (idle) idle(warm); else window.setTimeout(warm, 1500);
}

export default function TowerShell() {
  const view = useTowerStore((s) => s.view);
  const role = useTowerStore((s) => s.role);
  const locale = useTowerStore((s) => s.locale);
  const importSummaryId = useTowerStore((s) => s.importSummaryId);
  const setView = useTowerStore((s) => s.setView);
  const initTheme = useTowerStore((s) => s.initTheme);
  const navCollapsed = useTowerStore((s) => s.navCollapsed);
  const setNavCollapsed = useTowerStore((s) => s.setNavCollapsed);
  const accessMessage = useTowerStore((s) => s.accessMessage);
  const setAccessMessage = useTowerStore((s) => s.setAccessMessage);
  const entryOpen = useTowerStore((s) => s.entryOpen);
  const setEntryOpen = useTowerStore((s) => s.setEntryOpen);

  usePageSectionDnD();
  useRouteSync();
  usePushOpen();
  usePhoneTableLabels();

  // D14: nowy widok zaczyna się od góry (przewinięcie poprzedniego widoku nie przechodzi dalej).
  const mainRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [view]);

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  // Claude v2.0 chrome keyboard shortcuts (nav / theme / esc) — not Opcje/rate editor
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) {
        if (e.key === 'Escape') (t as HTMLInputElement).blur?.();
        return;
      }
      const store = useTowerStore.getState();
      /* #594: przy otwartym oknie importu skróty (widoki, motyw, pomoc) nie działają — Esc obsługuje okno */
      if (store.importSummaryId) return;
      if (e.key === 'Escape') {
        store.selectLoad(null);
        store.setStageFilter(null);
        return;
      }
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        // help toggled in Topbar via button; dispatch custom event
        window.dispatchEvent(new CustomEvent('wt-toggle-help'));
        return;
      }
      if (e.key === 't' || e.key === 'T') {
        if (!e.metaKey && !e.ctrlKey) store.toggleTheme();
        return;
      }
      if (e.shiftKey && (e.key === 'R' || e.key === 'r') && canSwitchView()) {
        const order: Array<'HHL' | 'KSH' | 'SCX'> = ['HHL', 'KSH', 'SCX'];
        const i = order.indexOf(store.role);
        void switchViewRole(order[(i + 1) % order.length]);
        return;
      }
      const map: Record<string, typeof store.view> = {
        k: 'dash', K: 'dash',
        m: 'map', M: 'map',
        h: 'sched', H: 'sched',
        r: 'risk', R: 'risk',
        d: 'docs', D: 'docs',
        f: 'fin', F: 'fin',
      };
      const v = map[e.key];
      if (v && navForRole(store.role).includes(v)) store.setView(v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Q-9 B: śledź zmianę motywu systemu, póki użytkownik nie ustawi ręcznie
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => {
      const s = useTowerStore.getState();
      if (s.themeManual) return;
      const next = mq.matches ? 'light' : 'dark';
      applyThemeToDom(next);
      useTowerStore.setState({ theme: next });
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const allowed = navForRole(role);
    if (!allowed.includes(view)) setView(allowed[0]);
  }, [role, view, setView]);

  let body: ReactNode;
  switch (view) {
    case 'dash':
      body = <DashboardView />;
      break;
    case 'map':
      body = <MapView />;
      break;
    case 'sched':
      body = <ScheduleView />;
      break;
    case 'risk':
      body = <RisksView />;
      break;
    case 'docs':
      body = <DocsView />;
      break;
    case 'fin':
      body = <FinanceView />;
      break;
    case 'inv':
      body = <InvoicesView />;
      break;
    case 'tasks':
      body = <TasksView />;
      break;
    case 'wf':
      body = <WorkflowsView />;
      break;
    case 'geo':
      /* wyglad/P8-c (E34): nowa strona Stref, gdy jest źródło (demo; produkcja po podłączeniu w P8) */
      body = zonesReady() ? <ZonesView /> : <GeofenceView />;
      break;
    case 'options':
      body = <OptionsView />;
      break;
    case 'settings':
      body = <SettingsView />;
      break;
    default:
      body = <DashboardView />;
  }

  return (
    <div className={`app${navCollapsed ? ' nav-collapsed' : ''}`}>
      {/* wyglad/P3 (E37): pasek górny i paski pod nim — Podgląd albo „Działasz jako”, potem komunikat HHL. */}
      <div className="topstack">
        <Topbar />
        {/* wyglad/P10a-a (E22 pkt 3): nowa wersja po wdrożeniu */}
        <NewVersionBar />
        {import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? (
          <>
            <PreviewBanner />
            <ImpersonationBanner />
          </>
        ) : null}
        <SystemBroadcastBanner />
        {/* E6 (C11): konto bez telefonu — „Uzupełnij telefon” */}
        <PhoneMissingBar />
      </div>
      {/* wyglad/P4 (E28): pasek etapów — 10 kafelków z liczbami; na telefonie w Harmonogramie i na Mapie */}
      <StageBar variant="global" />
      <div className="body">
        <button
          type="button"
          className="nav-scrim"
          aria-label={t(locale, 'a6_dr_close')}
          onClick={() => setNavCollapsed(true, { persist: false })}
        />
        <Nav />
        <main ref={mainRef}>
          {accessMessage ? (() => {
            /* wyglad/P6-d (E37 „Komunikaty zdaniami”): sprawa zamknięta albo innej firmy — zdanie zamiast „Brak dostępu” */
            const note = parseAccessNote(accessMessage);
            const text = note ? accessNoteText(note) : null;
            const code = note?.kind === 'closed' ? note.code : null;
            return (
              <div className="note" role="alert" data-access-denied data-access-note={note?.kind ?? 'denied'}>
                {text ?? t(locale, 'click_denied')}
                {code ? (
                  <button
                    type="button"
                    className="btn"
                    data-access-open-load
                    onClick={() => { setAccessMessage(null); window.location.hash = `#/transport/${encodeURIComponent(code)}`; }}
                  >{ACCESS_OPEN_LOAD}</button>
                ) : null}
                <button type="button" className="btn ghost" onClick={() => setAccessMessage(null)}>OK</button>
              </div>
            );
          })() : null}
          {entryOpen ? (
            <div className="note" role="dialog" data-entry-detail>
              {t(locale, 'click_entry')}
              <button type="button" className="btn ghost" onClick={() => setEntryOpen(false)}>OK</button>
            </div>
          ) : null}
          {/* wyglad/P10a-a (E22 pkt 4): część, która się nie wczyta, pokazuje komunikat — pasek i menu zostają */}
          <PartBoundary key={view} name={view}>{body}</PartBoundary>
        </main>
      </div>
      {/* D15 (budżet 400 kB): panel transportu osobno — pobierany w tle po starcie, więc otwiera się od razu */}
      <Suspense fallback={null}><LoadDrawer /></Suspense>
      {importSummaryId ? <PartBoundary name="kis"><Suspense fallback={null}><KshImportSummaryModal /></Suspense></PartBoundary> : null}
      <Toasts />
    </div>
  );
}
