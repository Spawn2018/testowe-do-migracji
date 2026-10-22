/**
 * M7 — wysyłka kolejki e-mail (`notifications` channel=EMAIL, status=PENDING) przez Resend.
 * Wywołanie: harmonogram (Supabase Scheduled Functions / pg_net) co kilka minut, z kluczem service role.
 * Sekrety funkcji: RESEND_API_KEY, MAIL_FROM, APP_URL (opcjonalnie). SUPABASE_URL i
 * SUPABASE_SERVICE_ROLE_KEY dostarcza platforma. Opłacona faktura → wiersze CANCELLED (baza) — nie wychodzą.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { recipientLocale, renderEmail } from '../_shared/notifyTemplates.ts';
import { asResendBody, emailOutcome, resendErrorText } from '../_shared/resendStatus.ts';
import { isServiceRequest } from '../_shared/serviceAuth.ts';

Deno.serve(async (req) => {
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!service || !(await isServiceRequest(req, { url: Deno.env.get('SUPABASE_URL') ?? '', service }))) return new Response('forbidden', { status: 403 });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, service, { auth: { persistSession: false } });
  /* 0036 — strażnik zadań: każdy przebieg zapisuje wynik w integration_runs (job = send-notifications) */
  const log = (ok: boolean, result: Record<string, unknown>) => sb.from('integration_runs').insert({ job: 'send-notifications', ok, result });
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('MAIL_FROM');
  if (!key || !from) { await log(false, { error: 'missing RESEND_API_KEY / MAIL_FROM' }); return new Response('missing RESEND_API_KEY / MAIL_FROM', { status: 500 }); }
  const { data: rows, error } = await sb.from('notifications')
    .select('id,recipient,user_id,template,payload').eq('channel', 'EMAIL').eq('status', 'PENDING')
    .order('created_at', { ascending: true }).limit(50);
  if (error) { await log(false, { error: error.message }); return new Response(error.message, { status: 500 }); }
  /* A6-T1 — język odbiorcy z app_users.locale */
  const ids = [...new Set((rows ?? []).map((r) => r.user_id).filter(Boolean))];
  const mails = [...new Set((rows ?? []).map((r) => String(r.recipient ?? '').toLowerCase()).filter(Boolean))];
  const users: { id: string; email: string | null; locale: string | null }[] = [];
  if (ids.length) users.push(...((await sb.from('app_users').select('id,email,locale').in('id', ids)).data ?? []));
  if (mails.length) users.push(...((await sb.from('app_users').select('id,email,locale').in('email', mails)).data ?? []));
  let sent = 0, failed = 0;
  for (const r of rows ?? []) {
    // #402: ponowna bramka (Opcje / „Co dostaję”) tuż przed Resend → SUPPRESSED gdy mail off
    const { data: gateOk } = await sb.rpc('notify_email_still_allowed', { p_id: r.id });
    if (gateOk !== true) continue;
    // ponowne sprawdzenie tuż przed wysyłką: anulowane (opłacona) w międzyczasie → pomiń
    const { data: fresh } = await sb.from('notifications').select('status').eq('id', r.id).single();
    if (fresh?.status !== 'PENDING') continue;
    const mail = renderEmail({ template: r.template, payload: r.payload ?? {} }, Deno.env.get('APP_URL') ?? '', recipientLocale(r, users));
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `tower-notif-${r.id}` },
      body: JSON.stringify({ from, to: [r.recipient], subject: mail.subject, text: mail.text, html: mail.html }),
    });
    const raw = await res.text();
    let body = asResendBody(null);
    try { body = asResendBody(JSON.parse(raw)); } catch { body = {}; }
    let outcome = emailOutcome(res.status, body);
    // Samo id przy HTTP 200: dopytaj last_event. Klucz send-only (restricted_api_key)
    // przy GET nie może oznaczyć wysłanego e-maila jako ERROR (SMS-SILENT-FIX 05.10).
    if (outcome === 'PENDING' && typeof body.id === 'string') {
      const look = await fetch(`https://api.resend.com/emails/${encodeURIComponent(body.id)}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      const lookRaw = await look.text();
      let lookBody = asResendBody(null);
      try { lookBody = asResendBody(JSON.parse(lookRaw)); } catch { lookBody = {}; }
      const lookName = typeof lookBody.name === 'string' ? lookBody.name.trim().toLowerCase() : '';
      if (lookName === 'restricted_api_key' || look.status === 401 || look.status === 403) {
        // POST przyjął wiadomość (id), odczyt statusu niedostępny dla tego klucza → SENT.
        outcome = 'SENT';
      } else {
        outcome = emailOutcome(look.status, lookBody);
        if (outcome !== 'SENT') body = lookBody;
      }
    }
    if (outcome === 'SENT') {
      sent++;
      await sb.from('notifications').update({ status: 'SENT', sent_at: new Date().toISOString(), error: null }).eq('id', r.id).eq('status', 'PENDING');
    } else if (outcome === 'ERROR') {
      failed++;
      await sb.from('notifications').update({ status: 'ERROR', error: resendErrorText(res.status, body) }).eq('id', r.id);
    }
    // PENDING: odpowiedź nie ma jeszcze statusu wysłania. Wiersz zostaje w kolejce (klucz idempotencji nie wyśle drugi raz).
  }
  await log(failed === 0, { pending: rows?.length ?? 0, sent, failed });
  return Response.json({ sent, failed });
});
