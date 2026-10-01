-- 0112 — SMS: SENT≠DELIVERED, ponowienia, fallback braku doręczenia, strefy OFF do testu 10/10.
-- Idempotentna.

-- 1) Wyzwalacze stref WYŁĄCZONE do czasu 10/10 DELIVERED (właściciel)
update public.security_flags
   set enabled = false
 where key in ('SMS_ZONE_APPROACH', 'SMS_ZONE_ENTER');

-- 2) sms_report: FAILED przy attempts < 3 → z powrotem do kolejki (min. 3 s)
create or replace function public.sms_report(
  p_token text default null,
  p_id uuid default null,
  p_status text default null,
  p_error text default null,
  p_parts int default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dev uuid;
  o sms_outbox%rowtype;
begin
  v_dev := sms_device_auth(p_token);
  select * into o from sms_outbox where id = p_id for update;
  if (found and o.device_id = v_dev) is not true then
    raise exception 'Wiadomość nie należy do tego urządzenia' using errcode = '42501';
  end if;
  if o.status::text = p_status then return; end if;
  if ((o.status = 'CLAIMED' and p_status in ('SENT', 'FAILED'))
      or (o.status = 'SENT' and p_status in ('DELIVERED', 'FAILED'))) is not true then
    raise exception 'Niedozwolone przejście % → %', o.status, coalesce(p_status, '∅') using errcode = '22023';
  end if;

  -- błąd wysyłki: do 3 prób, odstęp ≥ 3 s
  if p_status = 'FAILED' and o.attempts < 3 then
    update sms_outbox set
      status = 'QUEUED',
      device_id = null,
      claimed_at = null,
      not_before = greatest(coalesce(not_before, now()), now()) + interval '3 seconds',
      error = left(coalesce(p_error, 'błąd wysyłki — ponowienie'), 300),
      parts = coalesce(least(greatest(p_parts, 1), 10)::smallint, parts)
    where id = p_id;
    return;
  end if;

  update sms_outbox set
    status = p_status::sms_status,
    sent_at = case when p_status = 'SENT' then now() else sent_at end,
    delivered_at = case when p_status = 'DELIVERED' then now() else delivered_at end,
    parts = coalesce(least(greatest(p_parts, 1), 10)::smallint, parts),
    error = case when p_status = 'FAILED' then left(coalesce(p_error, 'błąd bez kodu'), 300) else error end
  where id = p_id;

  if p_status = 'SENT' then
    update sms_devices set day_sent = day_sent + 1 where id = v_dev;
  end if;
end $$;

revoke all on function public.sms_report(text, uuid, text, text, int) from public, authenticated;
grant execute on function public.sms_report(text, uuid, text, text, int) to anon;

-- 3) sms_pull: przy claim ustaw not_before kolejnych (telefon i tak czeka 3 s; baza też)
--    + przywróć CLAIMED po 3 min jak wcześniej (z 0069)

create or replace function public.sms_pull(p_token text default null, p_limit int default 5)
returns table (id uuid, to_e164 text, body text, attempts smallint, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_dev uuid;
  v_left int;
  v_paused boolean;
  v_ext boolean;
begin
  v_dev := sms_device_auth(p_token);
  v_ext := external_messaging_enabled();
  update sms_outbox o set
    status = case when o.attempts >= 3 then 'FAILED'::sms_status else 'QUEUED'::sms_status end,
    error = case when o.attempts >= 3 then 'brak raportu z telefonu po 3 próbach' else o.error end,
    not_before = case when o.attempts >= 3 then o.not_before else now() + interval '3 seconds' end,
    device_id = case when o.attempts >= 3 then o.device_id else null end
  where o.status = 'CLAIMED' and o.claimed_at < now() - interval '3 minutes';

  select greatest(day_limit - day_sent, 0), paused into v_left, v_paused from sms_devices where id = v_dev;
  if v_paused then return; end if;

  return query
  with c as (
    select o.id from sms_outbox o
     where o.status = 'QUEUED' and o.not_before <= now() and o.expires_at > now()
       and (v_ext or (o.kind = 'TEST' and exists (select 1 from sms_test_numbers t where t.to_e164 = o.to_e164)))
     order by o.priority desc, o.created_at
     limit least(greatest(coalesce(p_limit, 5), 0), 5, v_left)
     for update skip locked
  )
  update sms_outbox o set
    status = 'CLAIMED',
    device_id = v_dev,
    claimed_at = now(),
    attempts = o.attempts + 1
  from c where o.id = c.id
  returning o.id, o.to_e164,
            coalesce((select s.body from sms_outbox_secret s where s.sms_id = o.id), o.body),
            o.attempts, o.expires_at;
end $$;

revoke all on function public.sms_pull(text, int) from public, authenticated;
grant execute on function public.sms_pull(text, int) to anon;

-- 4) watchdog: SENT bez DELIVERED > 10 min → ryzyko + e-mail HHL (fallback)
create or replace function public.sms_watchdog(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_seen timestamptz; v_active int; v_queued int; v_silent boolean; v_proj record; v_key text; v_new int := 0;
  o record; r record; v_fb int := 0; v_exp int; v_scrub int; v_purge int; v_undel int := 0;
  v_proj_id uuid;
begin
  select max(last_seen_at), count(*) into v_seen, v_active from sms_devices where revoked_at is null;
  select count(*) into v_queued from sms_outbox where status in ('QUEUED', 'CLAIMED');
  v_silent := (v_active > 0 and (v_seen is null or v_seen < p_now - interval '15 minutes')) or (v_active = 0 and v_queued > 0);
  for v_proj in select id from projects loop
    v_key := 'sms-gateway:' || v_proj.id;
    if v_silent then
      if not exists (select 1 from risk_signals where dedup_key = v_key and resolved_at is null) then
        insert into risk_signals (project_id, kind, severity, title, title_key, detail, dedup_key, detected_at)
        values (v_proj.id, 'JOB_FAILURE', 'HIGH', 'Bramka SMS milczy', 'rk_job_failure',
          jsonb_build_object('job', 'sms-gateway', 'ostatni_sygnal', v_seen, 'kolejka', v_queued,
            'text', 'Brak sygnału telefonu-bramki od ' || coalesce(to_char(v_seen at time zone 'Europe/Warsaw', 'DD.MM.YYYY HH24:MI'), 'początku') || ' (próg 15 min); SMS w kolejce: ' || v_queued,
            'next_action', 'Sprawdź telefon-bramkę (zasilanie, Wi-Fi, aplikacja TOWER SMS). SMS starsze niż 10 min idą e-mailem zastępczym.',
            'params', jsonb_build_object('label', 'bramka SMS', 'label_key', 'job_label_sms_gateway',
              'since', coalesce(to_char(v_seen at time zone 'Europe/Warsaw', 'DD.MM.YYYY HH24:MI'), ''), 'window', '15 minutes'),
            'text_key', case when v_seen is null then 'rk_job_failure_text_never' else 'rk_job_failure_text' end,
            'next_action_key', 'rk_job_failure_next'),
          v_key, p_now);
        v_new := v_new + 1;
        insert into notifications (channel, recipient, user_id, template, payload, dedup_key)
        select 'EMAIL', u.email, u.id, 'SMS_GATEWAY_SILENT',
               jsonb_build_object('since', to_char(v_seen at time zone 'Europe/Warsaw', 'DD.MM.YYYY HH24:MI'), 'queued', v_queued),
               'smsgw:' || v_proj.id || ':' || u.id || ':' || to_char(p_now, 'YYYYMMDDHH24MI')
          from app_users u where u.active and u.role = 'HHL_ADMIN' and u.email is not null
        on conflict do nothing;
      end if;
    else
      update risk_signals set resolved_at = p_now where dedup_key = v_key and resolved_at is null;
    end if;
  end loop;

  update sms_outbox set status = 'EXPIRED' where status in ('QUEUED', 'CLAIMED') and expires_at <= p_now;
  get diagnostics v_exp = row_count;

  for o in select s.*, l.order_no, l.carrier_org_id from sms_outbox s left join loads l on l.id = s.load_id
            where s.fallback_at is null
              and ((s.status in ('QUEUED', 'CLAIMED') and s.created_at < p_now - interval '10 minutes') or s.status = 'FAILED')
            for update of s skip locked loop
    for r in
      select u.id, u.email from app_users u where u.active and u.email is not null and u.id = o.created_by
      union
      select u.id, u.email from app_users u
       where o.created_by is null and u.active and u.email is not null
         and (u.role in ('HHL_ADMIN', 'HHL_OPS') or (o.carrier_org_id is not null and u.org_id = o.carrier_org_id and u.role = 'CARRIER_DISPATCH'))
    loop
      insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
      values ('EMAIL', r.email, r.id, o.load_id, 'SMS_FALLBACK',
              jsonb_build_object('kind', o.kind, 'code', coalesce(o.order_no, '—'), 'to_tail', right(o.to_e164, 3),
                                 'status', o.status, 'error', o.error, 'text', o.body),
              'smsfb:' || o.id || ':' || r.id)
      on conflict do nothing;
    end loop;
    update sms_outbox set fallback_at = p_now where id = o.id;
    v_fb := v_fb + 1;
  end loop;

  -- SENT bez DELIVERED > 10 min → ryzyko + e-mail HHL
  for o in select s.* from sms_outbox s
            where s.status = 'SENT'
              and s.delivered_at is null
              and s.sent_at is not null
              and s.sent_at < p_now - interval '10 minutes'
              and s.fallback_at is null
            for update of s skip locked loop
    select id into v_proj_id from projects order by created_at nulls last limit 1;
    if v_proj_id is not null then
      v_key := 'sms-undelivered:' || o.id;
      if not exists (select 1 from risk_signals where dedup_key = v_key and resolved_at is null) then
        insert into risk_signals (project_id, kind, severity, title, title_key, detail, dedup_key, detected_at, load_id)
        values (v_proj_id, 'JOB_FAILURE', 'HIGH', 'SMS bez potwierdzenia doręczenia', 'rk_job_failure',
          jsonb_build_object('job', 'sms-delivery', 'sms_id', o.id, 'kind', o.kind,
            'to_tail', right(o.to_e164, 3), 'sent_at', o.sent_at,
            'text', 'SMS wysłany, brak DELIVERED > 10 min (…' || right(o.to_e164, 3) || ').',
            'next_action', 'Sprawdź telefon odbiorcy i bramkę; treść w e-mailu zastępczym.',
            'params', jsonb_build_object('label', 'doręczenie SMS', 'label_key', 'job_label_sms_gateway', 'window', '10 minutes'),
            'text_key', 'rk_job_failure_text', 'next_action_key', 'rk_job_failure_next'),
          v_key, p_now, o.load_id);
        v_undel := v_undel + 1;
      end if;
    end if;
    for r in select u.id, u.email from app_users u
              where u.active and u.email is not null and u.role in ('HHL_ADMIN', 'HHL_OPS')
    loop
      insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
      values ('EMAIL', r.email, r.id, o.load_id, 'SMS_UNDELIVERED',
              jsonb_build_object('kind', o.kind, 'to_tail', right(o.to_e164, 3), 'sent_at', o.sent_at,
                                 'status', 'SENT', 'text', o.body),
              'smsud:' || o.id || ':' || r.id)
      on conflict do nothing;
    end loop;
    update sms_outbox set fallback_at = p_now where id = o.id;
    v_fb := v_fb + 1;
  end loop;

  update sms_outbox set body = '[link usunięty]'
   where contains_secret and body <> '[link usunięty]'
     and ((status in ('SENT', 'DELIVERED') and sent_at < p_now - interval '24 hours')
          or (status in ('FAILED', 'EXPIRED', 'CANCELLED') and coalesce(fallback_at, created_at) < p_now - interval '24 hours'));
  get diagnostics v_scrub = row_count;
  delete from sms_heartbeats where at < p_now - interval '7 days';
  delete from sms_outbox where created_at < p_now - interval '90 days';
  get diagnostics v_purge = row_count;
  return jsonb_build_object('cisza', v_silent, 'nowe_ryzyka', v_new, 'kolejka', v_queued, 'fallback', v_fb,
                            'bez_doręczenia', v_undel, 'przeterminowane', v_exp,
                            'wyczyszczone_linki', v_scrub, 'usuniete_90d', v_purge);
end $$;

revoke all on function public.sms_watchdog(timestamptz) from public, anon, authenticated;
