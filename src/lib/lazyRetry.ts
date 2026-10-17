/** Lazy import z ponowieniem przy stale chunku po deployu (Failed to fetch dynamically imported module). */
export function lazyRetry<T>(factory: () => Promise<{ default: T }>, retries = 1): () => Promise<{ default: T }> {
  return async () => {
    try {
      const mod = await factory();
      /* audyt 17.10 (N4): udane wczytanie zdejmuje znacznik — przy następnym wdrożeniu znów jedno odświeżenie */
      try { if (typeof window !== 'undefined') sessionStorage.removeItem('wt_chunk_reload'); } catch { /* brak sessionStorage */ }
      return mod;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (retries > 0 && /Failed to fetch dynamically imported module|Loading chunk|Importing a module script failed/i.test(msg)) {
        // Jednorazowe twarde odświeżenie — stary HTML wskazuje na usunięty hash assetu.
        if (typeof window !== 'undefined' && !sessionStorage.getItem('wt_chunk_reload')) {
          sessionStorage.setItem('wt_chunk_reload', '1');
          window.location.reload();
          return new Promise(() => {});
        }
        return factory();
      }
      throw e;
    }
  };
}
