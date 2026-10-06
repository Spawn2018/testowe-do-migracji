/**
 * AUD-01d (decyzja właściciela 06.10 16:28, HERE Platform Terms §1.3, §6.4 l): kafelki HERE wprost z przeglądarki
 * kluczem przeglądarkowym ograniczonym w panelu HERE do domeny (`VITE_HERE_BROWSER_KEY`). Bez klucza — pośrednik
 * `/tiles` (zapas). Licznik D-78: przeglądarka liczy pobrania kafelków HERE i wysyła je zbiorczo (co 60 s oraz przy
 * `pagehide`/ukryciu karty, `fetch keepalive` — jak `sendBeacon`, ale z nagłówkami autoryzacji Supabase) do RPC
 * `here_tiles_report`, które zwiększa `here_usage.tiles` i zwraca stan budżetu. Stan budżetu czytany najwyżej raz na
 * minutę (odpowiedź tego samego wywołania); `tiles_open=false` (≥ 80% budżetu) → podkład zapasowy do końca sesji.
 */
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../../auth/config';
import { TILE_LANG } from '../../../supabase/functions/_shared/map/tilePolicy';

export const HERE_BROWSER_KEY = String(import.meta.env.VITE_HERE_BROWSER_KEY ?? '').trim();
export const HERE_TILE_HOST = 'https://maps.hereapi.com';
const STYLE = { light: 'logistics.day', dark: 'logistics.night' } as const;

/** Raster v3 — te same parametry co `here-raster` (png, 256 px, AUD-04: napisy po polsku `lang=pl`), ale wprost z sieci HERE. */
export function directTileTemplate(theme: 'light' | 'dark', key: string): string {
  return `${HERE_TILE_HOST}/v3/base/mc/{z}/{x}/{y}/png?style=${STYLE[theme]}&size=256&lang=${TILE_LANG}&apiKey=${encodeURIComponent(key)}`;
}

/**
 * Czy kafelek przyszedł z pamięci przeglądarki. `true` tylko gdy to widać (Resource Timing: `transferSize` 0 przy
 * niezerowym `decodedBodySize` — wymaga `Timing-Allow-Origin` od HERE); `false` gdy widać transfer; `null` gdy nie da
 * się stwierdzić (brak wpisu, bufor pełny, brak TAO) — wtedy kafelek jest LICZONY (licznik zawyża, nie zaniża).
 */
export function servedFromCache(url: string, perf: Pick<Performance, 'getEntriesByName'> | undefined = globalThis.performance): boolean | null {
  try {
    const list = perf?.getEntriesByName(url) as PerformanceResourceTiming[] | undefined;
    const e = list && list.length ? list[list.length - 1] : undefined;
    if (!e) return null;
    if (e.transferSize === 0 && e.decodedBodySize > 0) return true;
    if (e.transferSize > 0) return false;
    return null;
  } catch {
    return null;
  }
}

/** Wynik zgłoszenia: stan budżetu (`true`/`false`) albo `null`, gdy wywołanie się nie udało. */
export type TileReport = (n: number, final: boolean) => Promise<boolean | null>;

export function createTileMeter(opts: { report: TileReport; intervalMs?: number; now?: () => number }) {
  const interval = opts.intervalMs ?? 60_000;
  const now = opts.now ?? Date.now;
  let pending = 0;
  let lastRead = -Infinity;
  let closed = false;
  let inFlight = false;
  const listeners = new Set<() => void>();
  const close = () => {
    if (closed) return;
    closed = true;
    for (const f of [...listeners]) f();
  };
  return {
    get pending() { return pending; },
    get closed() { return closed; },
    add(n = 1) { if (n > 0) pending += n; },
    onClosed(f: () => void): () => void {
      listeners.add(f);
      if (closed) f();
      return () => listeners.delete(f);
    },
    /** Zwykłe zgłoszenie: najwyżej raz na `interval` (zgłoszenie = jedyny odczyt budżetu). */
    async tick(): Promise<void> {
      if (inFlight || now() - lastRead < interval) return;
      inFlight = true;
      lastRead = now();
      const n = Math.min(pending, 5000);
      pending -= n;
      try {
        const open = await opts.report(n, false);
        if (open === null) pending += n;
        else if (open === false) close();
      } finally {
        inFlight = false;
      }
    },
    /** `pagehide`/ukrycie karty: wysyła resztę bez czekania na odpowiedź (keepalive). */
    final(): void {
      const n = Math.min(pending, 5000);
      if (n <= 0) return;
      pending -= n;
      void opts.report(n, true);
    },
  };
}

export type TileMeter = ReturnType<typeof createTileMeter>;

/** Token sesji zapamiętany przy zwykłym zgłoszeniu — `pagehide` nie może czekać na `getSession()`. */
let token = '';

export async function reportToSupabase(n: number, final: boolean, fetcher: typeof fetch = fetch): Promise<boolean | null> {
  try {
    if (!final) {
      const { getSupabase } = await import('../../auth/client');
      const sb = await getSupabase();
      const { data } = await sb.auth.getSession();
      token = data.session?.access_token ?? '';
    }
    if (!token) return null;
    const res = await fetcher(`${SUPABASE_URL}/rest/v1/rpc/here_tiles_report`, {
      method: 'POST',
      keepalive: final,
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_n: n }),
    });
    if (final) return null;
    if (!res.ok) return null;
    const body = (await res.json()) as { tiles_open?: boolean } | null;
    return typeof body?.tiles_open === 'boolean' ? body.tiles_open : null;
  } catch {
    return null;
  }
}

/** Jeden licznik na stronę (wspólny dla wszystkich map), uruchamiany przy pierwszej warstwie HERE wprost. */
let shared: TileMeter | null = null;
export function sharedTileMeter(): TileMeter {
  if (shared) return shared;
  const meter = createTileMeter({ report: (n, final) => reportToSupabase(n, final) });
  shared = meter;
  if (typeof window !== 'undefined') {
    void meter.tick();
    window.setInterval(() => { void meter.tick(); }, 15_000);
    const bye = () => meter.final();
    window.addEventListener('pagehide', bye);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') bye(); });
  }
  return meter;
}

export function __resetSharedTileMeter(): void { shared = null; token = ''; }
