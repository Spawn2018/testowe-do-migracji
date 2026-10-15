/**
 * C2 / E5 / C16-N1+N3 — powiadomienie testowe na własne urządzenie (JWT użytkownika).
 * Body: { subscription_id: uuid }. Wysyłka od razu; CORS; nid/ack dla potwierdzenia.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { corsHeaders, corsJson, corsPreflight } from '../_shared/cors.ts';
import { signPushAck } from '../_shared/pushAck.ts';
import {
  pushFailReasonOf,
  pushServiceHost,
  pushStatusCodeOf,
} from '../_shared/pushFailReason.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight();
  if (req.method !== 'POST') {
    return new Response('method', { status: 405, headers: corsHeaders() });
  }

  const sentAt = new Date().toISOString();
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const pub = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
  const priv = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
  const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:sebastian@log-mar.pl';
  if (!url || !anon || !service || !pub || !priv) {
    return corsJson({ ok: false, status: 500, reason: 'service', sent_at: sentAt }, 500);
  }

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) {
    return corsJson({ ok: false, status: 401, reason: 'auth', sent_at: sentAt }, 401);
  }

  let body: { subscription_id?: string };
  try {
    body = await req.json();
  } catch {
    return corsJson({ ok: false, status: 400, reason: 'payload', sent_at: sentAt }, 400);
  }
  const subId = body.subscription_id?.trim();
  if (!subId) {
    return corsJson({ ok: false, status: 400, reason: 'payload', sent_at: sentAt }, 400);
  }

  const userSb = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await userSb.auth.getUser();
  if (userErr || !userData.user) {
    return corsJson({ ok: false, status: 401, reason: 'auth', sent_at: sentAt }, 401);
  }

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: appUser } = await admin
    .from('app_users')
    .select('id')
    .eq('auth_id', userData.user.id)
    .eq('active', true)
    .maybeSingle();
  if (!appUser) {
    return corsJson({ ok: false, status: 403, reason: 'auth', sent_at: sentAt }, 403);
  }

  const { data: sub } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, user_id')
    .eq('id', subId)
    .eq('user_id', appUser.id)
    .maybeSingle();
  if (!sub) {
    return corsJson({ ok: false, status: 404, reason: 'no_sub', sent_at: sentAt }, 404);
  }

  webpush.setVapidDetails(subject, pub, priv);
  const nid = `test:${sub.id}:${Date.parse(sentAt) || Date.now()}`;
  const ack = await signPushAck(nid, priv);
  const ackUrl = `${url.replace(/\/$/, '')}/functions/v1/web-push-ack`;
  const payload = JSON.stringify({
    title: 'Watch Tower',
    body: 'Powiadomienie testowe',
    url: '/#/opcje?panel=device',
    tag: 'push-test',
    nid,
    sid: sub.id,
    ack,
    ack_url: ackUrl,
    timestamp: Date.now(),
  });
  const host = pushServiceHost(sub.endpoint);
  try {
    const res = await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload,
      { urgency: 'high', TTL: 60 },
    );
    const status = typeof res?.statusCode === 'number' ? res.statusCode : 201;
    await admin.from('push_subscriptions').update({
      last_ok_at: sentAt,
      last_error: null,
      last_seen_at: sentAt,
    }).eq('id', sub.id);
    console.log(JSON.stringify({ event: 'web-push-test', ok: true, status, host }));
    return corsJson({ ok: true, status, sent_at: sentAt });
  } catch (e) {
    const status = pushStatusCodeOf(e);
    const reason = pushFailReasonOf(status);
    console.log(JSON.stringify({
      event: 'web-push-test',
      ok: false,
      status: status ?? null,
      reason,
      host,
    }));
    await admin.from('push_subscriptions').update({
      last_error: `push_${status ?? reason}`,
    }).eq('id', sub.id);
    if (reason === 'gone') {
      await admin.from('push_subscriptions').delete().eq('id', sub.id);
    }
    return corsJson(
      { ok: false, status: status ?? 0, reason, sent_at: sentAt },
      502,
    );
  }
});
