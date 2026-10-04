/**
 * D14 — trasy adresowalne (HashRouter: `#/harmonogram`, `#/transport/SG-32`, …).
 *
 * HashRouter zostaje świadomie: hosting statyczny bez przepisań (vercel.json/tunel/podgląd),
 * linki kierowcy `#/driver/<token>` i kontrakt zamrożenia czasu `#/…?now=` (baseline, testy).
 * Widok i otwarty transport żyją w sklepie (Zustand) — ścieżka jest ich odbiciem w obie strony
 * (`useRouteSync`). Rola i język są w trwałym ustawieniu (persist; w Supabase rola z konta,
 * język z `user_preferences`), więc adres ich nie niesie.
 */
import type { NavKey } from './permissions';

export const VIEW_PATH: Record<NavKey, string> = {
  dash: '/kokpit',
  map: '/mapa',
  sched: '/harmonogram',
  risk: '/ryzyka',
  docs: '/dokumenty',
  fin: '/finanse',
  inv: '/faktury',
  tasks: '/zadania',
  wf: '/automatyzacje',
  geo: '/strefy',
  options: '/opcje',
  settings: '/ustawienia',
};

const PATH_VIEW: Record<string, NavKey> = Object.fromEntries(
  Object.entries(VIEW_PATH).map(([k, p]) => [p, k as NavKey]),
);

export type ParsedRoute =
  | { kind: 'root' }
  | { kind: 'view'; view: NavKey }
  | { kind: 'transport'; code: string }
  | { kind: 'decision'; id: string }
  | { kind: 'invoice'; id: string }
  | { kind: 'system' }
  | { kind: 'options'; section: string }
  | { kind: 'denied' }
  | { kind: 'entry' }
  | { kind: 'sms'; id: string }
  | { kind: 'workflow'; id: string }
  | { kind: 'unknown' };

export function parseRoute(pathname: string): ParsedRoute {
  const p = (pathname || '/').replace(/\/+$/, '') || '/';
  if (p === '/') return { kind: 'root' };
  const view = PATH_VIEW[p.toLowerCase()];
  if (view) return { kind: 'view', view };
  const m = /^\/transport\/([^/]+)$/i.exec(p);
  if (m) return { kind: 'transport', code: decodeURIComponent(m[1]).toUpperCase() };
  const d = /^\/decyzje\/([^/]+)$/i.exec(p);
  if (d) return { kind: 'decision', id: decodeURIComponent(d[1]) };
  const inv = /^\/finanse\/faktury\/([^/]+)$/i.exec(p);
  if (inv) return { kind: 'invoice', id: decodeURIComponent(inv[1]) };
  if (p.toLowerCase() === '/opcje/stan-systemu') return { kind: 'system' };
  if (p.toLowerCase() === '/opcje/odbiorcy-sms') return { kind: 'options', section: 'sms' };
  if (p.toLowerCase() === '/opcje/cennik') return { kind: 'options', section: 'cennik' };
  if (p.toLowerCase() === '/brak-dostepu') return { kind: 'denied' };
  if (p.toLowerCase() === '/szczegoly-wpisu') return { kind: 'entry' };
  const sms = /^\/opcje\/stan-systemu\/bramka-sms\/([^/]+)$/i.exec(p);
  if (sms) return { kind: 'sms', id: decodeURIComponent(sms[1]) };
  const wf = /^\/automatyzacje\/([^/]+)$/i.exec(p);
  if (wf) return { kind: 'workflow', id: decodeURIComponent(wf[1]) };
  return { kind: 'unknown' };
}

export function buildRoute(view: NavKey, loadCode: string | null): string {
  return loadCode ? `/transport/${encodeURIComponent(loadCode)}` : VIEW_PATH[view] ?? '/kokpit';
}
