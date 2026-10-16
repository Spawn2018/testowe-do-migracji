import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './index.css';
import App from './App';
import { SUPABASE_AUTH_ENABLED } from './auth/config';
import { registerPwa } from './lib/pwa';
import { applyThemeToDom, systemTheme } from './lib/theme';
import { captureInstallPrompt } from './lib/installPrompt';

applyThemeToDom(systemTheme());
/* wyglad/P6-f: propozycja instalacji przychodzi raz, przy starcie — „Ten telefon” pokaże „Zainstaluj aplikację” */
captureInstallPrompt();

// I-6: błędy przeglądarki do bazy — wyłącznie build produkcyjny (paczka demo bez tego kodu)
if (import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED) {
  void Promise.all([import('./lib/errorReport'), import('./lib/cspReport'), import('./auth/client')]).then(([err, csp, c]) => {
    err.installErrorReporter(c.getSupabase);
    csp.installCspReporter(c.getSupabase);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// §15: zdejmij ekran startowy po pierwszym renderze
queueMicrotask(() => {
  document.getElementById('wt-boot')?.remove();
});

registerPwa();

