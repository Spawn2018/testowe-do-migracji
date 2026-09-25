/**
 * BK3 — spięcie SupabaseProvider ze store (tylko tryb Supabase, chunk leniwy).
 * Logowanie → zrzut z serwera zastępuje dane w store; zapisy store → writeThrough → serwer.
 * Błąd zapisu → komunikat PL + ponowne pobranie (serwer = źródło prawdy).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { useTowerStore } from '../store/useTowerStore';
import { createSupabaseProvider } from './supabaseProvider';
import { emptySnapshot, type DataMutation } from './provider';
import { registerRemoteSink } from './registry';

let active: ReturnType<typeof createSupabaseProvider> | null = null;

export async function refreshFromServer(): Promise<void> {
  if (!active) return;
  const snap = await active.loadSnapshot();
  useTowerStore.setState({ ...snap, selectedLoadId: null });
}

export async function connectSupabaseData(sb: SupabaseClient): Promise<void> {
  active = createSupabaseProvider(sb);
  await refreshFromServer();
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
      } catch (e) {
        useTowerStore.getState().pushToast(`Nie zapisano na serwerze: ${e instanceof Error ? e.message : String(e)}`, 'HIGH');
        await refreshFromServer().catch(() => undefined);
      }
    });
  });
}

export function disconnectSupabaseData(): void {
  registerRemoteSink(null);
  active = null;
  useTowerStore.setState({ ...emptySnapshot(), selectedLoadId: null });
}
