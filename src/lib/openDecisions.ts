/** DEC-2 — liczba otwartych decyzji (kokpit / menu). */
import { getSupabase } from '../auth/client';

export async function countOpenDecisions(): Promise<number> {
  const sb = await getSupabase();
  const q = await sb
    .from('decisions')
    .select('id', { count: 'exact', head: true })
    .in('status', ['NEW', 'ASSIGNED', 'SNOOZED']);
  if (q.error) return 0;
  return q.count ?? 0;
}
