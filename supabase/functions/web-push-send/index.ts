/**
 * Q-11b A — wysyłka WEB_PUSH (PENDING) + promocja DIGEST 1×/dzień.
 * Sekrety: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { isServiceRequest } from '../_shared/serviceAuth.ts';

Deno.serve(async (req) => {
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  if (!service || !(await isServiceRequest(req, { url, service }))) {
    return new Response('forbidden', { status: 403 });
  }
  const pub = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
  const priv = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
  const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:sebastian@log-mar.pl';
  if (!pub || !priv) return new Response('missing VAPID', { status: 500 });
  webpush.setVapidDetails(subject, pub, priv);

  const sb = createClient(url, service, { auth: { persistSession: false } });

  // E5-2 / D-20261014-0015-01 R2: telefon tylko krytyczne — nie promuj DIGEST na telefon.
  // Stare wiersze WEB_PUSH/DIGEST zamykane jako SENT bez wysyłki (bez DAILY_DIGEST).
  const { data: digests } = await sb.from('notifications')
    .select('id')
    .eq('channel', 'WEB_PUSH').eq('status', 'DIGEST').limit(200);
  if (digests?.length) {
    await sb.from('notifications').update({ status: 'SENT', sent_at: new Date().toISOString() })
      .in('id', digests.map((r) => r.id));
  }

  const { data: rows } = await sb.from('notifications')
    .select('id,user_id,template,payload')
    .eq('channel', 'WEB_PUSH').eq('status', 'PENDING').order('created_at', { ascending: true }).limit(40);

  let sent = 0, failed = 0;
  for (const r of rows ?? []) {
    const { data: subs } = await sb.from('push_subscriptions').select('*').eq('user_id', r.user_id);
    if (!subs?.length) {
      await sb.from('notifications').update({ status: 'ERROR', error: 'no_sub' }).eq('id', r.id);
      failed++;
      continue;
    }
    const title = r.template === 'DAILY_DIGEST'
      ? 'Watch Tower — skrót dnia'
      : `Watch Tower — ${r.template}`;
    const body = r.template === 'DAILY_DIGEST'
      ? `${(r.payload as { n?: number })?.n ?? 0} powiadomień`
      : String((r.payload as { body?: string })?.body ?? r.template);
    let okAny = false;
    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title, body, url: '/' }),
        );
        okAny = true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('410') || msg.includes('404')) {
          await sb.from('push_subscriptions').delete().eq('id', s.id);
        }
      }
    }
    if (okAny) {
      sent++;
      await sb.from('notifications').update({ status: 'SENT', sent_at: new Date().toISOString() }).eq('id', r.id);
    } else {
      failed++;
      await sb.from('notifications').update({ status: 'ERROR', error: 'push_fail' }).eq('id', r.id);
    }
  }
  await sb.from('integration_runs').insert({ job: 'web-push-send', ok: failed === 0, result: { sent, failed } });
  return Response.json({ sent, failed });
});
