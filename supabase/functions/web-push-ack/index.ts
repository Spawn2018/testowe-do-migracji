/**
 * C16 N3 — potwierdzenie odbioru z service workera (bez JWT; tylko HMAC).
 * Body: { nid, ack, sid? }. nid = id notifications albo test:<subId>:<czas>.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, corsJson, corsPreflight } from '../_shared/cors.ts';
import { verifyPushAck } from '../_shared/pushAck.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight();
  if (req.method !== 'POST') {
    return new Response('method', { status: 405, headers: corsHeaders() });
  }

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const priv = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
  if (!url || !service || !priv) {
    return corsJson({ ok: false, error: 'config' }, 500);
  }

  let body: { nid?: string; ack?: string; sid?: string };
  try {
    body = await req.json();
  } catch {
    return corsJson({ ok: false, error: 'bad_json' }, 400);
  }
  const nid = typeof body.nid === 'string' ? body.nid.trim() : '';
  const ack = typeof body.ack === 'string' ? body.ack.trim() : '';
  const sid = typeof body.sid === 'string' ? body.sid.trim() : '';
  if (!nid || !ack) return corsJson({ ok: false, error: 'payload' }, 400);
  if (!(await verifyPushAck(nid, ack, priv))) {
    return corsJson({ ok: false, error: 'forbidden' }, 403);
  }

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const now = new Date().toISOString();

  if (nid.startsWith('test:')) {
    const parts = nid.split(':');
    const subId = parts[1] ?? sid;
    if (!subId) return corsJson({ ok: false, error: 'payload' }, 400);
    await admin.from('push_subscriptions').update({ last_ack_at: now, last_ok_at: now, last_error: null }).eq('id', subId);
    return corsJson({ ok: true, delivered_at: now });
  }

  const notifId = Number(nid);
  if (!Number.isFinite(notifId)) return corsJson({ ok: false, error: 'payload' }, 400);

  const { data: row } = await admin
    .from('notifications')
    .select('id, user_id, delivered_at')
    .eq('id', notifId)
    .eq('channel', 'WEB_PUSH')
    .maybeSingle();
  if (!row) return corsJson({ ok: false, error: 'not_found' }, 404);

  if (!row.delivered_at) {
    await admin.from('notifications').update({ delivered_at: now }).eq('id', notifId);
  }
  if (sid) {
    await admin.from('push_subscriptions').update({ last_ack_at: now, last_ok_at: now, last_error: null }).eq('id', sid);
  } else if (row.user_id) {
    await admin.from('push_subscriptions').update({ last_ack_at: now, last_ok_at: now, last_error: null }).eq('user_id', row.user_id);
  }
  return corsJson({ ok: true, delivered_at: row.delivered_at ?? now });
});
