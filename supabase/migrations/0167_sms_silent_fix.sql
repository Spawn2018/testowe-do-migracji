-- 0167 — SMS-SILENT-FIX: fałszywe SMS_GATEWAY_SILENT (noc 4/5.10).
-- Diagnoza: heartbeaty były, ale od ~03:00 Doze dawał odstępy 14–18 min;
-- próg 15 min + natychmiastowe zamknięcie ryzyka przy jednym HB → 4 cykle
-- resolve/reopen × 2 adminów = 8 e-maili. Resend: osobno w Edge.
-- Zmiany: próg ciszy 30 min; cooldown 60 min przed nowym ryzykiem po zamknięciu;
-- last_seen_at także z sms_heartbeat; e-mail z dedup na epizod (dzień+godzina ciszy).
-- Idempotentna. Zero prawdziwych SMS.

create or replace function public.sms_heartbeat(p_token text default null, p_info jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_dev uuid; d sms_devices%rowtype;
begin
  v_dev := sms_device_auth(p_token);
  update sms_devices
     set last_info = left(coalesce(p_info, '{}')::text, 2000)::jsonb,
         last_seen_at = now()
   where id = v_dev
  returning * into d;
  if not exists (select 1 from sms_heartbeats where device_id = v_dev and at > now() - interval '30 seconds') then
    insert into sms_heartbeats (device_id, info) values (v_dev, d.last_info);
  end if;
  return jsonb_build_object('poll_s', 15, 'day_limit', d.day_limit, 'day_sent', d.day_sent, 'paused', d.paused);
end $$;
revoke all on function public.sms_heartbeat(text, jsonb) from public, authenticated;
grant execute on function public.sms_heartbeat(text, jsonb) to anon;

create or replace function public.sms_watchdog(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_seen timestamptz; v_hb timestamptz; v_active int; v_queued int; v_silent boolean;
  v_proj record; v_key text; v_new int := 0;
  o record; r record; v_fb int := 0; v_exp int; v_scrub int; v_purge int; v_undel int := 0;
  v_proj_id uuid; v_cooldown boolean;
begin
  select max(last_seen_at), count(*) into v_seen, v_active from sms_devices where revoked_at is null;
  select max(at) into v_hb from sms_heartbeats;
  if v_hb is not null and (v_seen is null or v_hb > v_seen) then
    v_seen := v_hb;
  end if;
  select count(*) into v_queued from sms_outbox where status in ('QUEUED', 'CLAIMED');
  -- Próg 30 min (Doze Androida budzi aplikację co ~15 min; 15 min dawało fałszywe cykle).
  v_silent := (v_active > 0 and (v_seen is null or v_seen < p_now - interval '30 minutes'))
           or (v_active = 0 and v_queued > 0);
  for v_proj in select id from projects loop
    v_key := 'sms-gateway:' || v_proj.id;
    if v_silent then
      -- Cooldown 60 min po zamknięciu: jeden epizod = jeden alarm, bez powtórek przy krótkich HB.
      select exists (
        select 1 from risk_signals
         where dedup_key = v_key
           and resolved_at is not null
           and resolved_at > p_now - interval '60 minutes'
      ) into v_cooldown;
      if (v_cooldown) is not true
         and (exists (select 1 from risk_signals where dedup_key = v_key and resolved_at is null)) is not true then
        insert into risk_signals (project_id, kind, severity, title, title_key, detail, dedup_key, detected_at)
        values (v_proj.id, 'JOB_FAILURE', 'HIGH', 'Bramka SMS milczy', 'rk_job_failure',
          jsonb_build_object('job', 'sms-gateway', 'ostatni_sygnal', v_seen, 'kolejka', v_queued,
            'text', 'Brak sygnału telefonu-bramki od ' || coalesce(to_char(v_seen at time zone 'Europe/Warsaw', 'DD.MM.YYYY HH24:MI'), 'początku') || ' (próg 30 min); SMS w kolejce: ' || v_queued,
            'next_action', 'Sprawdź telefon-bramkę (zasilanie, Wi-Fi, aplikacja TOWER SMS). SMS starsze niż 10 min idą e-mailem zastępczym.',
            'params', jsonb_build_object('label', 'bramka SMS', 'label_key', 'job_label_sms_gateway',
              'since', coalesce(to_char(v_seen at time zone 'Europe/Warsaw', 'DD.MM.YYYY HH24:MI'), ''), 'window', '30 minutes'),
            'text_key', case when v_seen is null then 'rk_job_failure_text_never' else 'rk_job_failure_text' end,
            'next_action_key', 'rk_job_failure_next'),
          v_key, p_now);
        v_new := v_new + 1;
        insert into notifications (channel, recipient, user_id, template, payload, dedup_key)
        select 'EMAIL', u.email, u.id, 'SMS_GATEWAY_SILENT',
               jsonb_build_object('since', to_char(v_seen at time zone 'Europe/Warsaw', 'DD.MM.YYYY HH24:MI'), 'queued', v_queued),
               'smsgw:' || v_proj.id || ':' || u.id || ':' || to_char(date_trunc('hour', p_now at time zone 'Europe/Warsaw'), 'YYYYMMDDHH24')
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
