/**
 * Q-11b A / C16 N2+N4 — wysyłka WEB_PUSH (PENDING) + zapas e-mail (W42).
 * Sekrety: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:… / https:…).
 * urgency high, TTL 86400; kod z e.statusCode; cron = zapas (wyzwalacz woła od razu).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { isServiceRequest } from '../_shared/serviceAuth.ts';
import { signPushAck } from '../_shared/pushAck.ts';
import {
  pushFailReasonOf,
  pushServiceHost,
  pushStatusCodeOf,
} from '../_shared/pushFailReason.ts';

Deno.serve(async (req) => {
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  if (!service || !(await isServiceRequest(req, { url, service }))) {
    return new Response('forbidden', { status: 403 });
  }
  const pub = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
  const priv = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
  const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:sebastian@log-mar.pl';
  const subjectOk = subject.startsWith('mailto:') || subject.startsWith('https:');
  console.log(JSON.stringify({ event: 'web-push-send', vapid_subject_ok: subjectOk }));
  if (!pub || !priv) return new Response('missing VAPID', { status: 500 });
  if (!subjectOk) return new Response('bad VAPID_SUBJECT', { status: 500 });
  webpush.setVapidDetails(subject, pub, priv);

  const sb = createClient(url, service, { auth: { persistSession: false } });

  // E5-2: telefon tylko krytyczne — nie promuj DIGEST na telefon.
  const { data: digests } = await sb.from('notifications')
    .select('id')
    .eq('channel', 'WEB_PUSH').eq('status', 'DIGEST').limit(200);
  if (digests?.length) {
    await sb.from('notifications').update({ status: 'SENT', sent_at: new Date().toISOString() })
      .in('id', digests.map((r) => r.id));
  }

  const { data: rows } = await sb.from('notifications')
    .select('id,user_id,template,payload,recipient')
    .eq('channel', 'WEB_PUSH').eq('status', 'PENDING').order('created_at', { ascending: true }).limit(40);

  let sent = 0, failed = 0;
  for (const r of rows ?? []) {
    // #402 F7: ponowna bramka push w chwili wysyłki (Opcje / „Co dostaję”).
    const { data: pushOk } = await sb.rpc('notify_push_still_allowed', { p_id: r.id });
    if (pushOk !== true) {
      continue;
    }
    const { data: subs } = await sb.from('push_subscriptions').select('*').eq('user_id', r.user_id);
    if (!subs?.length) {
      await sb.from('notifications').update({ status: 'ERROR', error: 'no_sub' }).eq('id', r.id);
      failed++;
      await sb.rpc('web_push_enqueue_fallback', { p_notification_id: r.id });
      continue;
    }
    const payload = (r.payload ?? {}) as {
      body?: string; title?: string; url?: string; href?: string; n?: number; code?: string;
    };
    const title = r.template === 'DAILY_DIGEST'
      ? 'Watch Tower — skrót dnia'
      : String(payload.title ?? `Watch Tower — ${r.template}`);
    const body = r.template === 'DAILY_DIGEST'
      ? `${payload.n ?? 0} powiadomień`
      : String(payload.body ?? r.template);
    let clickUrl = payload.url || payload.href || '/';
    if (typeof clickUrl === 'string' && (clickUrl.includes('/brak') || clickUrl.endsWith('/brak'))) {
      clickUrl = '/';
    }
    if (payload.code && clickUrl === '/') {
      clickUrl = `/#/transport/${encodeURIComponent(payload.code)}`;
    }
    const tag = r.template === 'DAILY_DIGEST' ? 'digest' : `wt-${r.template}-${r.id}`;
    const nid = String(r.id);
    const ackUrl = `${url.replace(/\/$/, '')}/functions/v1/web-push-ack`;
    let okAny = false;
    let lastErr = 'push_fail';
    for (const s of subs) {
      const host = pushServiceHost(s.endpoint);
      const sid = String(s.id);
      const ack = await signPushAck(nid, sid, priv);
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({
            title, body, url: clickUrl, tag, nid, sid, ack, ack_url: ackUrl,
            timestamp: Date.now(),
          }),
          { urgency: 'high', TTL: 86400 },
        );
        okAny = true;
        await sb.from('push_subscriptions').update({
          last_ok_at: new Date().toISOString(),
          last_error: null,
        }).eq('id', s.id);
        console.log(JSON.stringify({ event: 'web-push-send', ok: true, nid, host }));
      } catch (e) {
        const status = pushStatusCodeOf(e);
        const reason = pushFailReasonOf(status);
        lastErr = `push_${status ?? reason}`;
        console.log(JSON.stringify({
          event: 'web-push-send', ok: false, nid, status: status ?? null, reason, host,
        }));
        await sb.from('push_subscriptions').update({
          last_error: lastErr,
        }).eq('id', s.id);
        if (reason === 'gone') {
          await sb.from('push_subscriptions').delete().eq('id', s.id);
        }
      }
    }
    if (okAny) {
      sent++;
      await sb.from('notifications').update({
        status: 'SENT',
        sent_at: new Date().toISOString(),
        error: null,
      }).eq('id', r.id);
    } else {
      failed++;
      await sb.from('notifications').update({ status: 'ERROR', error: lastErr }).eq('id', r.id);
      await sb.rpc('web_push_enqueue_fallback', { p_notification_id: r.id });
    }
  }

  // N4: zapas po 5 min bez potwierdzenia + no_sub
  const { data: fallbackN } = await sb.rpc('web_push_fallback_tick');
  await sb.from('integration_runs').insert({
    job: 'web-push-send',
    ok: failed === 0,
    result: { sent, failed, fallback: fallbackN ?? 0, vapid_subject_ok: subjectOk },
  });
  return Response.json({ sent, failed, fallback: fallbackN ?? 0 });
});
