import { lazy, Suspense, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { useTowerStore } from './store/useTowerStore';
import { Topbar } from './components/shell/Topbar';
import { CorridorSpine } from './components/shell/CorridorSpine';
import { Nav } from './components/shell/Nav';
import { Toasts } from './components/shell/Toasts';
import { LoadDrawer } from './components/drawer/LoadDrawer';
import { DashboardView } from './views/DashboardView';
import { MapView } from './views/MapView';
import { ScheduleView } from './views/ScheduleView';
import { RisksView } from './views/RisksView';
import { DocsView } from './views/DocsView';
import { FinanceView } from './views/FinanceView';
import { InvoicesView } from './views/InvoicesView';
import { TasksView } from './views/TasksView';
import { WorkflowsView } from './views/WorkflowsView';
import { GeofenceView } from './views/GeofenceView';
import { DriverPwa } from './views/DriverPwa';
import { OptionsView } from './views/OptionsView';
import { SettingsView } from './views/SettingsView';
import { navForRole } from './lib/permissions';
import { usePageSectionDnD } from './hooks/usePageSectionDnD';
import { useRouteSync } from './hooks/useRouteSync';
import { SUPABASE_AUTH_ENABLED } from './auth/config';

// BK2: bramka logowania tylko w trybie Supabase (VITE_AUTH_MODE=supabase); demo bez zmian.
const AuthGate = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('./auth/AuthGate')) : null;

function TowerShell() {
  const view = useTowerStore((s) => s.view);
  const role = useTowerStore((s) => s.role);
  const setView = useTowerStore((s) => s.setView);
  const initTheme = useTowerStore((s) => s.initTheme);
  const navCollapsed = useTowerStore((s) => s.navCollapsed);

  usePageSectionDnD();
  useRouteSync();

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
      if (e.shiftKey && (e.key === 'R' || e.key === 'r')) {
        const order: Array<'HHL' | 'KSH' | 'SCX'> = ['HHL', 'KSH', 'SCX'];
        const i = order.indexOf(store.role);
        store.setRole(order[(i + 1) % order.length]);
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
      body = <GeofenceView />;
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
      <Topbar />
      <CorridorSpine />
      <div className="body">
        <Nav />
        <main ref={mainRef}>{body}</main>
      </div>
      <LoadDrawer />
      <Toasts />
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/driver/:token" element={<DriverPwa />} />
        <Route
          path="/*"
          element={AuthGate ? <Suspense fallback={null}><AuthGate><TowerShell /></AuthGate></Suspense> : <TowerShell />}
        />
      </Routes>
    </HashRouter>
  );
}
