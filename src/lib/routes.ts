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
  | { kind: 'unknown' };

export function parseRoute(pathname: string): ParsedRoute {
  const p = (pathname || '/').replace(/\/+$/, '') || '/';
  if (p === '/') return { kind: 'root' };
  const view = PATH_VIEW[p.toLowerCase()];
  if (view) return { kind: 'view', view };
  const m = /^\/transport\/([^/]+)$/i.exec(p);
  if (m) return { kind: 'transport', code: decodeURIComponent(m[1]).toUpperCase() };
  return { kind: 'unknown' };
}

export function buildRoute(view: NavKey, loadCode: string | null): string {
  return loadCode ? `/transport/${encodeURIComponent(loadCode)}` : VIEW_PATH[view] ?? '/kokpit';
}
