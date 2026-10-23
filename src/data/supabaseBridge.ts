/**
 * BK3 — spięcie SupabaseProvider ze store (tylko tryb Supabase, chunk leniwy).
 * Logowanie → zrzut z serwera zastępuje dane w store; zapisy store → writeThrough → serwer.
 * Błąd zapisu → komunikat PL + ponowne pobranie (serwer = źródło prawdy).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { useTowerStore } from '../store/useTowerStore';
import { createSupabaseProvider } from './supabaseProvider';
import { emptySnapshot, type DataMutation } from './provider';
import { registerAfterFileUpload, registerFileSink, registerRemoteSink } from './registry';
import { createStorageSink } from './storageFiles';
import { friendlyDbError } from '../lib/orderNumbers';
import { mergeBellRefresh } from '../lib/bellList';

let active: ReturnType<typeof createSupabaseProvider> | null = null;

/** keepSelection — I-18: szuflada zostaje otwarta na tym samym transporcie (o ile nadal jest widoczny). */
export async function refreshFromServer(opts: { keepSelection?: boolean; background?: boolean } = {}): Promise<void> {
  if (!active) return;
  const p = active;
  const seq = writesSeq;
  /* wersja PRZED zrzutem: zmiana w trakcie zrzutu da przy następnym sprawdzeniu nowszą wersję, więc nie zginie */
  const v = await p.loadsVersion().catch(() => null);
  const snap = await p.loadSnapshot();
  if (p !== active) return;
  /* odświeżenie w tle: zapis użytkownika w trakcie zrzutu — zrzut może być starszy niż ekran; następne sprawdzenie ponowi */
  if (opts.background && ((writesPending > 0 && Date.now() - writesSince < WRITE_STUCK_MS) || writesSeq !== seq)) return;
  if (v != null) lastLoadsVersion = v;
  const sel = useTowerStore.getState().selectedLoadId;
  const keep = opts.keepSelection && sel != null && snap.loads.some((l) => l.id === sel) ? sel : null;
  if (opts.background) {
    /* dzwonek scalony jak przy samym dzwonku (przeczytane lokalnie zostają przeczytane, wpisy z push zostają) */
    useTowerStore.setState((s) => ({ ...snap, notifications: mergeBellRefresh(s.notifications, snap.notifications), selectedLoadId: keep }));
    return;
  }
  useTowerStore.setState({ ...snap, selectedLoadId: keep });
}

/** Właściciel 21.10.2026 20:14 (pkt 5): sam dzwonek z serwera (telefon: aplikacja wraca z tła bez przeładowania). */
let bellInFlight: Promise<void> | null = null;

/** Jedno zapytanie naraz — kolejne wywołania w trakcie czekają na to samo (22.10: przeciążenie bazy). */
export function refreshNotifications(): Promise<void> {
  if (bellInFlight) return bellInFlight;
  bellInFlight = doRefreshNotifications().finally(() => { bellInFlight = null; });
  return bellInFlight;
}

async function doRefreshNotifications(): Promise<void> {
  const p = active;
  if (!p) return;
  const server = await p.loadNotifications();
  /* w trakcie zapytania zmieniło się konto (wylogowanie, „Działaj jako”) — nie mieszaj dzwonków */
  if (p !== active) return;
  useTowerStore.setState((s) => ({ notifications: mergeBellRefresh(s.notifications, server) }));
}

/**
 * Właściciel 23.10.2026 13:43 (SG-17, SG-23): status zmieniony przez automat (GPS, AIS) — ekran sam pobiera nowy stan
 * (pasek etapów, „Kierowcy i zestaw” · teraz, „Zadzwoń”), bez przeładowania. Co 2 min, gdy karta widoczna,
 * i po powrocie do aplikacji (najwyżej raz na 30 s) — jedno lekkie zapytanie o wersję; pełny zrzut tylko po zmianie.
 */
let lastLoadsVersion: string | null = null;
let writesPending = 0;
/** start najstarszego zapisu w toku — zawieszony zapis (sieć) nie blokuje odświeżania w tle na stałe */
let writesSince = 0;
const WRITE_STUCK_MS = 2 * 60_000;
let writesSeq = 0;
let liveInFlight: Promise<void> | null = null;
export function refreshIfLoadsChanged(): Promise<void> {
  if (liveInFlight) return liveInFlight;
  liveInFlight = (async () => {
    const p = active;
    if (!p) return;
    const v = await p.loadsVersion();
    if (p !== active || v == null) return;
    if (lastLoadsVersion == null) { lastLoadsVersion = v; return; }
    if (v === lastLoadsVersion) return;
    /* własny zapis w toku — odświeży się po nim (nie nadpisuj zmiany, która jeszcze idzie na serwer) */
    if (writesPending > 0 && Date.now() - writesSince < WRITE_STUCK_MS) return;
    await refreshFromServer({ keepSelection: true, background: true });
  })().finally(() => { liveInFlight = null; });
  return liveInFlight;
}
const LIVE_EVERY_MS = 2 * 60_000;

let bellTimer: ReturnType<typeof setInterval> | null = null;
let bellUnlisten: (() => void) | null = null;
let liveTimer: ReturnType<typeof setInterval> | null = null;
/* 22.10.2026: co 60 s przeciążało bazę — co 5 min; powrót do aplikacji najwyżej raz na 30 s. */
const BELL_EVERY_MS = 5 * 60_000;
const BELL_RETURN_MIN_MS = 30_000;

/** Powrót do karty / aplikacji (visibilitychange, pageshow, focus) i co 5 min, gdy widoczna — odśwież dzwonek. */
function startBellRefresh(): void {
  stopBellRefresh();
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  let last = Date.now();
  const tick = (force = false) => {
    if (document.visibilityState !== 'visible') return;
    if (!force && Date.now() - last < BELL_RETURN_MIN_MS) return;
    last = Date.now();
    void refreshNotifications().catch(() => undefined);
    void refreshIfLoadsChanged().catch(() => undefined);
  };
  const onVis = () => tick();
  const onShow = () => tick();
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('pageshow', onShow);
  window.addEventListener('focus', onShow);
  bellTimer = setInterval(() => tick(true), BELL_EVERY_MS);
  liveTimer = setInterval(() => {
    if (document.visibilityState === 'visible') void refreshIfLoadsChanged().catch(() => undefined);
  }, LIVE_EVERY_MS);
  bellUnlisten = () => {
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('pageshow', onShow);
    window.removeEventListener('focus', onShow);
  };
}

function stopBellRefresh(): void {
  if (bellTimer) clearInterval(bellTimer);
  bellTimer = null;
  if (liveTimer) clearInterval(liveTimer);
  liveTimer = null;
  bellUnlisten?.();
  bellUnlisten = null;
}

export async function connectSupabaseData(sb: SupabaseClient): Promise<void> {
  active = createSupabaseProvider(sb);
  registerFileSink(createStorageSink(sb)); // BK4: pliki → prywatne koszyki Storage
  registerAfterFileUpload(() => refreshFromServer({ keepSelection: true }));
  lastLoadsVersion = null;
  await refreshFromServer();
  startBellRefresh();
  // M4: ustawienia użytkownika z serwera (waluta, motyw; język — zawsze polski, B9) — bez ponownego zapisu
  try {
    const prefs = active.loadPreferences ? await active.loadPreferences() : null;
    if (prefs) useTowerStore.getState().applyUserPrefs(prefs);
  } catch (e) {
    useTowerStore.getState().pushToast(`Nie wczytano ustawień: ${e instanceof Error ? e.message : String(e)}`, 'MEDIUM');
  }
  // Kolejka: zapisy wykonywane po kolei (status przed zdarzeniem itd.).
  let chain: Promise<unknown> = Promise.resolve();
  registerRemoteSink((m: DataMutation) => {
    const provider = active;
    if (!provider) return;
    writesPending += 1;
    writesSeq += 1;
    chain = chain.then(async () => {
      /* start zapisu, który teraz trwa (nie najstarszego w serii) — próg „zawieszony” liczony od niego */
      writesSince = Date.now();
      try {
        const res = await provider.apply(m);
        if (m.type === 'geofence.save' && res && res.id && res.id !== m.geofence.id) {
          const localId = m.geofence.id;
          useTowerStore.setState((s) => ({ geofences: s.geofences.map((g) => (g.id === localId ? { ...g, id: res.id! } : g)) }));
        }
        // M6: faktury — serwer liczy kontrole, termin, Z1; odśwież zrzut (id, flagi, poziom FAKTURA)
        if (m.type.startsWith('bill.')) await refreshFromServer();
        /* M9 — zdarzenie strefy mogło zmienić status; rozładunek zapisał migawkę ceny */
        if (m.type === 'position.report' && res && res.id && res.id !== '0') await refreshFromServer();
        if (m.type === 'load.status' && m.status === 'UNLOADING') await refreshFromServer();
        /* D-20261018-1215-01 §3: zapis z panelu (awizacja, numer, status) odświeża „Do zrobienia”. */
        if (m.type === 'load.awizacja' || m.type === 'load.orderNo' || (m.type === 'load.status' && m.status !== 'UNLOADING')) {
          await refreshFromServer({ keepSelection: true });
        }
        /* M10 — nowy rejs dostaje id z serwera; rezerwacja transportu z rejsu (jedno źródło prawdy) */
        if (m.type === 'sailing.save' || m.type === 'load.sailing') await refreshFromServer();
        /* 9.4 — reguła: id, walidacja i liczniki z bazy */
        if (m.type.startsWith('workflow.')) await refreshFromServer();
      } catch (e) {
        useTowerStore.getState().pushToast(`Nie zapisano na serwerze: ${friendlyDbError(e instanceof Error ? e.message : String(e), useTowerStore.getState().locale)}`, 'HIGH');
        await refreshFromServer().catch(() => undefined);
      } finally {
        writesPending = Math.max(0, writesPending - 1);
      }
    });
  });
}

export function disconnectSupabaseData(): void {
  stopBellRefresh();
  lastLoadsVersion = null;
  writesPending = 0;
  registerRemoteSink(null);
  registerFileSink(null);
  registerAfterFileUpload(null);
  active = null;
  useTowerStore.setState({ ...emptySnapshot(), selectedLoadId: null });
}
