/**
 * wyglad/P9-a (E24-1, typ K) — stan podkładu mapy. Podkład jest „wczytany” dopiero po pierwszym kafelku z obrazem
 * (wcześniej wystarczało zdarzenie Leaflet `load`, które przychodzi także wtedy, gdy wszystkie kafelki mają błąd).
 *
 * Przebieg = od `loading` do `load` warstwy kafelków. Przebieg bez żadnego kafelka z obrazem i z co najmniej jednym
 * błędem = nieudana próba. Po 1. i 2. nieudanej próbie warstwa jest rysowana od nowa (`redraw`) po 1 s i 2 s;
 * 3. nieudana próba = `failed` (komunikat zamiast szarej mapy). Pierwszy kafelek z obrazem = `ok` (komunikat znika).
 * W produkcji pierwsza próba obejmuje też przełączenie HERE wprost → serwer aplikacji (`applyBasemap.ts`, 3 błędy).
 */
export type TileHealthState = 'loading' | 'ok' | 'failed';
export type TileHealth = { state: TileHealthState; tries: number };

export const TILE_TRIES = 3;
export const TILE_RETRY_MS = (failedTries: number): number => 1000 * failedTries;

type Handler = (...args: unknown[]) => void;
export type TileEvented = {
  on(type: string, fn: Handler): unknown;
  off(type: string, fn: Handler): unknown;
  redraw?: () => unknown;
};

export type WatchOpts = {
  tries?: number;
  delay?: (failedTries: number) => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
};

export function watchTiles(layer: TileEvented, onChange: (h: TileHealth) => void, opts: WatchOpts = {}): () => void {
  const tries = opts.tries ?? TILE_TRIES;
  const delay = opts.delay ?? TILE_RETRY_MS;
  const setTimer = opts.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((id: unknown) => clearTimeout(id as ReturnType<typeof setTimeout>));
  let okInPass = 0;
  let errInPass = 0;
  let failed = 0;
  let state: TileHealthState = 'loading';
  let timer: unknown = null;
  let stopped = false;
  const emit = () => { if (!stopped) onChange({ state, tries: failed }); };

  const onLoading: Handler = () => { okInPass = 0; errInPass = 0; };
  const onTile: Handler = () => {
    okInPass += 1;
    if (state === 'ok') return;
    failed = 0;
    state = 'ok';
    emit();
  };
  const onError: Handler = () => { errInPass += 1; };
  const onLoad: Handler = () => {
    const passFailed = okInPass === 0 && errInPass > 0;
    okInPass = 0;
    errInPass = 0;
    if (!passFailed) return;
    failed += 1;
    if (failed >= tries) {
      if (state !== 'failed') { state = 'failed'; emit(); }
      return;
    }
    if (state === 'failed') return;
    state = 'loading';
    emit();
    if (timer !== null) clearTimer(timer);
    timer = setTimer(() => { timer = null; if (!stopped) layer.redraw?.(); }, delay(failed));
  };

  layer.on('loading', onLoading);
  layer.on('tileload', onTile);
  layer.on('tileerror', onError);
  layer.on('load', onLoad);
  return () => {
    stopped = true;
    if (timer !== null) clearTimer(timer);
    layer.off('loading', onLoading);
    layer.off('tileload', onTile);
    layer.off('tileerror', onError);
    layer.off('load', onLoad);
  };
}

/** Którą drogą szły próby — do przypisu komunikatu (`data-tile-path` mapy z `applyBasemap.ts`). */
export type TileVia = 'here-both' | 'here-proxy' | 'fallback';
export function tileVia(tilePath: string | undefined): TileVia {
  if (tilePath === 'here-direct') return 'here-both';
  if (tilePath === 'proxy') return 'here-proxy';
  return 'fallback';
}
