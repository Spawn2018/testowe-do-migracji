/** Q-11b — publiczny klucz VAPID (bez sekretu). */
function cors(): HeadersInit {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, apikey, content-type',
  };
}
Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() });
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
  if (!publicKey) {
    return Response.json({ error: 'no_vapid' }, { status: 503, headers: cors() });
  }
  return Response.json({ publicKey }, { headers: cors() });
});
