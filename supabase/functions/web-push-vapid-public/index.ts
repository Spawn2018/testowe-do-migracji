/** Q-11b — publiczny klucz VAPID (bez sekretu). */
import { corsHeaders, corsPreflight } from '../_shared/cors.ts';

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return corsPreflight();
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
  if (!publicKey) {
    return Response.json({ error: 'no_vapid' }, { status: 503, headers: corsHeaders() });
  }
  return Response.json({ publicKey }, { headers: corsHeaders() });
});
