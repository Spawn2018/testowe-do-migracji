/**
 * A2 / L14 — odpowiedź na sprawę „czy dostarczono?” (RPC `delivered_check_resolve`).
 * Warunek `VITE_AUTH_MODE` wpisany wprost (strażnik I-0).
 */
export async function deliveredCheckResolve(
  loadId: string,
  yes: boolean,
  note: string | null = null,
): Promise<{ ok: boolean; error: string | null }> {
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return { ok: true, error: null };
  const { getSupabase } = await import('../auth/client');
  const sb = await getSupabase();
  const { error } = await sb.rpc('delivered_check_resolve', {
    p_load: loadId,
    p_yes: yes,
    p_note: note,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}
