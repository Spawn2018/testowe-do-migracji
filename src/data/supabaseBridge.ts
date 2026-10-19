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

let active: ReturnType<typeof createSupabaseProvider> | null = null;

/** keepSelection — I-18: szuflada zostaje otwarta na tym samym transporcie (o ile nadal jest widoczny). */
export async function refreshFromServer(opts: { keepSelection?: boolean } = {}): Promise<void> {
  if (!active) return;
  const snap = await active.loadSnapshot();
  const sel = useTowerStore.getState().selectedLoadId;
  const keep = opts.keepSelection && sel != null && snap.loads.some((l) => l.id === sel) ? sel : null;
  useTowerStore.setState({ ...snap, selectedLoadId: keep });
}

export async function connectSupabaseData(sb: SupabaseClient): Promise<void> {
  active = createSupabaseProvider(sb);
  registerFileSink(createStorageSink(sb)); // BK4: pliki → prywatne koszyki Storage
  registerAfterFileUpload(() => refreshFromServer({ keepSelection: true }));
  await refreshFromServer();
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
    chain = chain.then(async () => {
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
      }
    });
  });
}

export function disconnectSupabaseData(): void {
  registerRemoteSink(null);
  registerFileSink(null);
  registerAfterFileUpload(null);
  active = null;
  useTowerStore.setState({ ...emptySnapshot(), selectedLoadId: null });
}
