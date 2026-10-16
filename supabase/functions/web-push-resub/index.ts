/**
 * C16 N5 — odświeżenie adresu urządzenia po pushsubscriptionchange (bez JWT).
 * Body: { old_endpoint, endpoint, p256dh, auth, ua? }.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, corsJson, corsPreflight } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight();
  if (req.method !== 'POST') {
    return new Response('method', { status: 405, headers: corsHeaders() });
  }

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !service) return corsJson({ ok: false, error: 'config' }, 500);

  let body: { old_endpoint?: string; endpoint?: string; p256dh?: string; auth?: string; ua?: string };
  try {
    body = await req.json();
  } catch {
    return corsJson({ ok: false, error: 'bad_json' }, 400);
  }
  const oldEp = typeof body.old_endpoint === 'string' ? body.old_endpoint.trim() : '';
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : '';
  const p256dh = typeof body.p256dh === 'string' ? body.p256dh.trim() : '';
  const auth = typeof body.auth === 'string' ? body.auth.trim() : '';
  if (oldEp.length < 8 || endpoint.length < 8 || p256dh.length < 8 || auth.length < 8) {
    return corsJson({ ok: false, error: 'payload' }, 400);
  }

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const now = new Date().toISOString();
  const { data: old } = await admin
    .from('push_subscriptions')
    .select('id, user_id')
    .eq('endpoint', oldEp)
    .maybeSingle();
  if (!old) return corsJson({ ok: false, error: 'gone' }, 404);

  if (oldEp === endpoint) {
    await admin.from('push_subscriptions').update({
      p256dh, auth, last_seen_at: now, user_agent: body.ua ? String(body.ua).slice(0, 300) : undefined,
    }).eq('id', old.id);
    return corsJson({ ok: true, id: old.id });
  }

  // Nowy adres: usuń stary (unique endpoint), wstaw nowy dla tego samego użytkownika
  await admin.from('push_subscriptions').delete().eq('id', old.id);
  const { data: inserted, error } = await admin.from('push_subscriptions').upsert({
    user_id: old.user_id,
    endpoint,
    p256dh,
    auth,
    user_agent: body.ua ? String(body.ua).slice(0, 300) : null,
    last_seen_at: now,
  }, { onConflict: 'endpoint' }).select('id').maybeSingle();
  if (error) return corsJson({ ok: false, error: 'db' }, 500);
  return corsJson({ ok: true, id: inserted?.id ?? null });
});
