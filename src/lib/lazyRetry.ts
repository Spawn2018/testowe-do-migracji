/** Lazy import z obsługą stale chunku po deployu (Failed to fetch dynamically imported module). */
import { signalNewVersion } from './newVersionSignal';

const FLAG = 'wt_chunk_reload';
/**
 * #274: okno po odświeżeniu (ms). W tym czasie żaden kawałek nie odświeża strony drugi raz i nie zdejmuje znacznika —
 * inaczej udane wczytanie innego kawałka (powłoka, panel transportu) zaraz po odświeżeniu zdejmowało znacznik,
 * a ta sama brakująca część (np. Ryzyka) odświeżała stronę w kółko zamiast pokazać komunikat „Odśwież”.
 */
const FRESH_MS = 15_000;

export type LazyRetryStale = 'reload' | 'bar';

export type LazyRetryOpts = {
  retries?: number;
  /** `reload` — start/logowanie (AuthGate, powłoka). `bar` — reszta: pasek NewVersionBar, bez cichego reload (#817 B2). */
  stale?: LazyRetryStale;
};

function flagFresh(): boolean {
  try {
    const v = sessionStorage.getItem(FLAG);
    if (!v) return false;
    const at = Number(v);
    /* stara wartość „1” (sprzed zmiany) — bez czasu: nie blokuje zdjęcia znacznika po udanym wczytaniu */
    if (!Number.isFinite(at) || at < 1e12) return false;
    return Date.now() - at < FRESH_MS;
  } catch {
    return false;
  }
}

function hasFlag(): boolean {
  try { return !!sessionStorage.getItem(FLAG); } catch { return true; /* bez sessionStorage — bez pętli odświeżeń */ }
}

function normalize(retriesOrOpts: number | LazyRetryOpts | undefined): Required<LazyRetryOpts> {
  if (typeof retriesOrOpts === 'number' || retriesOrOpts === undefined) {
    return { retries: retriesOrOpts ?? 1, stale: 'bar' };
  }
  return { retries: retriesOrOpts.retries ?? 1, stale: retriesOrOpts.stale ?? 'bar' };
}

export function lazyRetry<T>(
  factory: () => Promise<{ default: T }>,
  retriesOrOpts: number | LazyRetryOpts = 1,
): () => Promise<{ default: T }> {
  const { retries, stale } = normalize(retriesOrOpts);
  return async () => {
    try {
      const mod = await factory();
      /* audyt 17.10 (N4): udane wczytanie zdejmuje znacznik — przy następnym wdrożeniu znów jedno odświeżenie
         (poza oknem tuż po odświeżeniu, #274) */
      try { if (typeof window !== 'undefined' && !flagFresh()) sessionStorage.removeItem('wt_chunk_reload'); } catch { /* brak sessionStorage */ }
      return mod;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (retries > 0 && /Failed to fetch dynamically imported module|Loading chunk|Importing a module script failed/i.test(msg)) {
        // Jednorazowa reakcja na stary HTML po wdrożeniu.
        if (typeof window !== 'undefined' && !hasFlag()) {
          try { sessionStorage.setItem(FLAG, String(Date.now())); } catch { /* brak sessionStorage */ }
          if (stale === 'reload') {
            // Start / logowanie: twarde odświeżenie.
            window.location.reload();
            return new Promise(() => {});
          }
          // DP-224 C / #817 B2: pasek „Jest nowa wersja” zamiast cichego reload na otwartej karcie.
          signalNewVersion('chunk');
          return new Promise(() => {});
        }
        return factory();
      }
      throw e;
    }
  };
}
