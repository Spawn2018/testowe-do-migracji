/**
 * D-20261020-1118-01 (#353) — zapis pilotów z okna „Uzupełnij awizację”: `awiz_pilots_set` (wykonawca).
 * Pilot PL i pilot SE: numer rejestracyjny, imię i nazwisko; puste pola dozwolone. Konwój KR — ci sami piloci.
 * Moduł leniwy (paczka demo go nie wczytuje).
 */
import { getSupabase } from '../auth/client';
import { useTowerStore } from '../store/useTowerStore';
import type { Pilots } from '../lib/p7Awiz';
import { isPreviewReadOnly } from '../lib/prodFacade';

export async function savePilotsServer(codes: readonly string[], p: Pilots): Promise<void> {
  /* B5 (D-20261019-1525-01): Podgląd nic nie zmienia w danych — także piloci (F7 D-1501) */
  if (isPreviewReadOnly()) return;
  const st = useTowerStore.getState();
  const ids = st.loads.filter((l) => codes.includes(l.code)).map((l) => l.id);
  const sb = await getSupabase();
  const v = (x: string | null) => (x ?? '').trim() || null;
  for (const id of ids) {
    const { error } = await sb.rpc('awiz_pilots_set', {
      p_load: id,
      p_pl_plate: v(p.pl.plate)?.toUpperCase() ?? null, p_pl_name: v(p.pl.name),
      p_se_plate: v(p.se.plate)?.toUpperCase() ?? null, p_se_name: v(p.se.name),
    });
    if (error) { st.pushToast(error.message, 'HIGH', id); return; }
  }
  const { refreshFromServer } = await import('./supabaseBridge');
  await refreshFromServer({ keepSelection: true });
}
