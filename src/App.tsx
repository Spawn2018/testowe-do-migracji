import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { lazyRetry } from './lib/lazyRetry';
import { SUPABASE_AUTH_ENABLED } from './auth/config';
/* wyglad/P10b-d (E37 pkt 9): podgląd pierwszego wejścia w demo; produkcja — AuthGate */
import { DemoFirstEntry } from './auth/DemoFirstEntry';

/*
 * #274: pierwsze wczytanie = router + bramka logowania. Powłoka (`TowerShell`: pasek, menu, Kokpit, panel transportu)
 * i aplikacja kierowcy w osobnych kawałkach — logowanie na telefonie nie pobiera ich przed pierwszym widokiem.
 */
const loadShell = () => import('./TowerShell');
const TowerShell = lazy(lazyRetry(loadShell));
const DriverPwa = lazy(lazyRetry(() => import('./views/DriverPwa').then((m) => ({ default: m.DriverPwa }))));

// BK2: bramka logowania tylko w trybie Supabase (VITE_AUTH_MODE=supabase); demo bez zmian.
const AuthGate = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(lazyRetry(() => import('./auth/AuthGate'))) : null;

/* ekran startowy (logo, jak #wt-boot w index.html) na czas doczytania kawałka — zamiast pustego ekranu */
function BootScreen() {
  return (
    <div className="wt-boot" aria-busy="true" data-boot-wait>
      <img data-light src="/brand/watchtower-logo-full.png" alt="Watch Tower" width={360} height={120} />
      <img data-dark src="/brand/watchtower-logo-full-dark.png" alt="Watch Tower" width={360} height={120} />
    </div>
  );
}

/* powłoka pobierana w tle, gdy przeglądarka jest wolna (po zalogowaniu bez czekania) — nie konkuruje z ekranem logowania;
   link kierowcy (#/driver/…) powłoki nie potrzebuje */
if (typeof window !== 'undefined' && !window.location.hash.startsWith('#/driver/')) {
  const idle = (window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
  const warm = () => { void loadShell().catch(() => undefined); };
  if (idle) idle(warm, { timeout: 4000 }); else window.setTimeout(warm, 2000);
}

/* własna granica: czekanie na powłokę po zalogowaniu nie chowa bramki logowania (jej stan zostaje) */
const shell = <Suspense fallback={<BootScreen />}><TowerShell /></Suspense>;

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/driver/:token" element={<Suspense fallback={<BootScreen />}><DriverPwa /></Suspense>} />
        <Route
          path="/*"
          element={AuthGate ? <Suspense fallback={null}><AuthGate>{shell}</AuthGate></Suspense> : <DemoFirstEntry>{shell}</DemoFirstEntry>}
        />
      </Routes>
    </HashRouter>
  );
}
