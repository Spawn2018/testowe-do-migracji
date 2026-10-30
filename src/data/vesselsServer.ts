/**
 * DP-8 — statki z tabeli `vessels` (RLS `vessels_read`: aktywne konto). Chunk leniwy, tylko produkcja.
 */
import { getSupabase } from '../auth/client';
import { groupVessels, type VesselGroup } from '../lib/vesselGroups';

export async function loadVesselGroups(): Promise<VesselGroup[]> {
  const sb = await getSupabase();
  const r = await sb.from('vessels').select('name,operator');
  if (r.error) throw new Error(r.error.message);
  return groupVessels((r.data ?? []) as { name: string | null; operator: string | null }[]);
}
