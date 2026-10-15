/**
 * C2 / E5 — powiadomienie testowe na własne urządzenie (JWT użytkownika).
 * Body: { subscription_id: uuid }. Wysyła od razu (≤ 10 s), bez kolejki crona.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 });
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const pub = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
  const priv = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
  const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:sebastian@log-mar.pl';
  if (!url || !anon || !service || !pub || !priv) {
    return new Response('missing config', { status: 500 });
  }

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return new Response('unauthorized', { status: 401 });

  let body: { subscription_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response('bad json', { status: 400 });
  }
  const subId = body.subscription_id?.trim();
  if (!subId) return new Response('subscription_id', { status: 400 });

  const userSb = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await userSb.auth.getUser();
  if (userErr || !userData.user) return new Response('unauthorized', { status: 401 });

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: appUser } = await admin
    .from('app_users')
    .select('id')
    .eq('auth_id', userData.user.id)
    .eq('active', true)
    .maybeSingle();
  if (!appUser) return new Response('forbidden', { status: 403 });

  const { data: sub } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, user_id')
    .eq('id', subId)
    .eq('user_id', appUser.id)
    .maybeSingle();
  if (!sub) return new Response('not found', { status: 404 });

  webpush.setVapidDetails(subject, pub, priv);
  const payload = JSON.stringify({
    title: 'Watch Tower',
    body: 'Powiadomienie testowe',
    url: '/#/opcje?panel=device',
    tag: 'push-test',
  });
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('410') || msg.includes('404')) {
      await admin.from('push_subscriptions').delete().eq('id', sub.id);
    }
    return Response.json({ ok: false, error: 'push_fail' }, { status: 502 });
  }
  return Response.json({ ok: true });
});
