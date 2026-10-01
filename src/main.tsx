import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './index.css';
import App from './App';
import { SUPABASE_AUTH_ENABLED } from './auth/config';

// I-6: błędy przeglądarki do bazy — wyłącznie build produkcyjny (paczka demo bez tego kodu)
if (import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED) {
  void Promise.all([import('./lib/errorReport'), import('./auth/client')]).then(([m, c]) => m.installErrorReporter(c.getSupabase));
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

// §15 / §14: service worker (ikony + manifest); wersja w public/sw.js
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
