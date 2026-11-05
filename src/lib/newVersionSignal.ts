/**
 * DP-224 C / #817 B2: sygnał „jest nowa wersja” dla NewVersionBar — zamiast cichego reload() w lazyRetry.
 * Bez danych osobowych. Sesja: sessionStorage, żeby pasek został po nawigacji w tej samej karcie.
 */
const KEY = 'wt_new_version';
const EVT = 'wt-new-version';

type Listener = () => void;
const listeners = new Set<Listener>();

export function isNewVersionSignaled(): boolean {
  try {
    return typeof sessionStorage !== 'undefined' && !!sessionStorage.getItem(KEY);
  } catch {
    return false;
  }
}

/** Powód trafia do client_errors (E) — krótki kod, bez ścieżek z tokenami. */
export function signalNewVersion(reason = 'chunk'): void {
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(KEY, reason.slice(0, 40));
  } catch { /* brak sessionStorage */ }
  for (const fn of listeners) {
    try { fn(); } catch { /* słuchacz nie może psuć sygnalizacji */ }
  }
  if (typeof window !== 'undefined') {
    try { window.dispatchEvent(new CustomEvent(EVT, { detail: { reason: reason.slice(0, 40) } })); }
    catch { /* stare środowiska */ }
  }
}

export function clearNewVersionSignal(): void {
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(KEY);
  } catch { /* brak sessionStorage */ }
  for (const fn of listeners) {
    try { fn(); } catch { /* j.w. */ }
  }
}

export function subscribeNewVersion(fn: Listener): () => void {
  listeners.add(fn);
  if (typeof window !== 'undefined') {
    const onEvt = () => { try { fn(); } catch { /* j.w. */ } };
    window.addEventListener(EVT, onEvt);
    return () => {
      listeners.delete(fn);
      window.removeEventListener(EVT, onEvt);
    };
  }
  return () => { listeners.delete(fn); };
}

export function newVersionReason(): string | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(KEY) : null;
  } catch {
    return null;
  }
}
