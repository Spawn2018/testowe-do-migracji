/**
 * ANEKS 4 PR4 — codzienna kontrola limitów planu darmowego. Wywołanie: pg_cron → pg_net z kluczem service role
 * (supabase/sql/cron_usage.sql). Mierzy bazę i pliki (usage_measure), wywołania Edge (przybliżenie z
 * integration_runs albo API zarządzania, jeśli ustawiono SUPABASE_MGMT_TOKEN), zapisuje historię i progi
 * przez record_usage: 70% → ryzyko HHL, 85% → ryzyko wysokie + e-mail (Resend: RESEND_API_KEY, MAIL_FROM, ALERT_EMAIL_TO).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { alertEmail, measurements, type Measure } from '../_shared/usage/core.ts';
import { isServiceRequest } from '../_shared/serviceAuth.ts';

Deno.serve(async (req) => {
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!service || !(await isServiceRequest(req, { url: Deno.env.get('SUPABASE_URL') ?? '', service }))) return new Response('forbidden', { status: 403 });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, service, { auth: { persistSession: false } });
  /* 0035 — strażnik zadań: każdy przebieg zapisuje wynik w integration_runs (job = usage-check) */
  const log = (ok: boolean, result: Record<string, unknown>) => sb.from('integration_runs').insert({ job: 'usage-check', ok, result });
  const { data: m, error } = await sb.rpc('usage_measure');
  if (error) { await log(false, { error: error.message }); return new Response(error.message, { status: 500 }); }
  const results = [];
  for (const x of measurements(m as Measure)) {
    const { data, error: e } = await sb.rpc('record_usage', { p_metric: x.metric, p_used: x.used, p_quota: x.quota });
    if (e) { await log(false, { error: e.message, metric: x.metric }); return new Response(e.message, { status: 500 }); }
    results.push({ ...x, ...(data as { pct: number; level: string; email: boolean; title?: string }) });
  }
  const toMail = results.filter((r) => r.email);
  let mailed = false;
  const key = Deno.env.get('RESEND_API_KEY'), from = Deno.env.get('MAIL_FROM'), to = Deno.env.get('ALERT_EMAIL_TO');
  if (toMail.length && key && from && to) {
    const mail = alertEmail(toMail);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: to.split(','), subject: mail.subject, text: mail.text }),
    });
    mailed = res.ok;
  }
  await log(true, { metrics: results.length, mailed, mail_needed: toMail.length > 0 });
  return Response.json({ ok: true, results, mailed, mail_needed: toMail.length > 0 });
});
