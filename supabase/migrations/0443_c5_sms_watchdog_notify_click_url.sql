-- C5 (D-20261015-0300-01 / #762 po #895): sms_watchdog + notify_click_url
-- kod transportu = load_sms_code; bez fallbacku order_no / hhl_order_no / UUID.
-- Po 0442 (DP-199). Ostatnie 2 miejsca C5 z odbioru #894 / komentarz #762.

begin;

-- ---------------------------------------------------------------------------
-- 1. sms_watchdog — SMS_FALLBACK: skrót i payload.code = load_sms_code
-- Baza = 0255 (#402); zmiana wyłącznie źródła kodu (bez order_no).
-- ---------------------------------------------------------------------------
create or replace function public.sms_watchdog(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_seen timestamptz; v_hb timestamptz; v_active int; v_queued int; v_silent boolean;
  v_proj record; v_key text; v_new int := 0;
  o record; r record; v_fb int := 0; v_exp int; v_scrub int; v_purge int; v_undel int := 0;
  v_proj_id uuid; v_cooldown boolean;
  v_code text;
begin
  select max(last_seen_at), count(*) into v_seen, v_active from sms_devices where revoked_at is null;
  select max(at) into v_hb from sms_heartbeats;
  if v_hb is not null and (v_seen is null or v_hb > v_seen) then
    v_seen := v_hb;
  end if;
  select count(*) into v_queued from sms_outbox where status in ('QUEUED', 'CLAIMED');
  v_silent := (v_active > 0 and (v_seen is null or v_seen < p_now - interval '30 minutes'))
           or (v_active = 0 and v_queued > 0);
  for v_proj in select id from projects loop
    v_key := 'sms-gateway:' || v_proj.id;
    if v_silent then
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
        perform public.matrix_notify(
          'SYSTEM', 'SMS_GATEWAY_SILENT', null, v_proj.id,
          jsonb_build_object(
            'since', to_char(v_seen at time zone 'Europe/Warsaw', 'DD.MM.YYYY HH24:MI'),
            'queued', v_queued, 'kind', 'JOB_FAILURE', 'title_key', 'rk_job_failure'
          ),
          'smsgw:' || v_proj.id || ':' || to_char(date_trunc('hour', p_now at time zone 'Europe/Warsaw'), 'YYYYMMDDHH24'),
          'FORWARDER'
        );
      end if;
    else
      update risk_signals set resolved_at = p_now where dedup_key = v_key and resolved_at is null;
    end if;
  end loop;

  update sms_outbox set status = 'EXPIRED' where status in ('QUEUED', 'CLAIMED') and expires_at <= p_now;
  get diagnostics v_exp = row_count;

  for o in select s.*, l.carrier_org_id
             from sms_outbox s left join loads l on l.id = s.load_id
            where s.fallback_at is null
              and ((s.status in ('QUEUED', 'CLAIMED') and s.created_at < p_now - interval '10 minutes') or s.status = 'FAILED')
            for update of s skip locked loop
    /* C5: skrót i payload.code = load_sms_code (nigdy order_no). */
    v_code := coalesce(nullif(nullif(btrim(public.load_sms_code(o.load_id)), ''), '—'), '—');
    for r in
      select u.id, u.email from app_users u where u.active and u.email is not null and u.id = o.created_by
      union
      select u.id, u.email from app_users u
       where o.created_by is null and u.active and u.email is not null
         and (u.role in ('HHL_ADMIN', 'HHL_OPS') or (o.carrier_org_id is not null and u.org_id = o.carrier_org_id and u.role = 'CARRIER_DISPATCH'))
    loop
      perform public.l13_queue_email(
        'critical', 'SMS_FALLBACK', r.id, r.email, o.load_id, v_code,
        jsonb_build_object('kind', o.kind, 'code', v_code, 'to_tail', right(o.to_e164, 3),
                           'status', o.status, 'error', o.error, 'text', o.body),
        'smsfb:' || o.id || ':' || r.id, null
      );
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
      perform public.l13_queue_email(
        'critical', 'SMS_UNDELIVERED', r.id, r.email, o.load_id, null,
        jsonb_build_object('kind', o.kind, 'to_tail', right(o.to_e164, 3), 'sent_at', o.sent_at,
                           'status', 'SENT', 'text', o.body),
        'smsud:' || o.id || ':' || r.id, null
      );
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
comment on function public.sms_watchdog(timestamptz) is
  '#402 + C5 0443: SMS_FALLBACK code = load_sms_code; bez order_no.';

-- ---------------------------------------------------------------------------
-- 2. notify_click_url — link #/transport/<kod> z load_sms_code
-- Baza = 0296 (#519); bez payload.order_no / hhl_order_no / loads.order_no.
-- ---------------------------------------------------------------------------
create or replace function public.notify_click_url(
  p_template text,
  p_payload jsonb,
  p_load_id uuid
) returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dec text;
  v_inv text;
  v_code text;
  v_tab text;
begin
  if p_template = 'DECISION_ESCALATED_BATCH' then
    return '/#/ryzyka';
  end if;

  v_inv := coalesce(
    nullif(p_payload->>'invoice_id', ''),
    nullif(p_payload->>'invoiceId', '')
  );
  if v_inv is not null
     and (
       p_template like 'FACTORING%'
       or p_template like 'INVOICE%'
       or p_template in ('PAYMENT_REMINDER')
     ) then
    return '/#/finanse/faktury/' || v_inv;
  end if;

  v_dec := coalesce(
    nullif(p_payload->>'decision_id', ''),
    nullif(p_payload->>'decisionId', '')
  );
  if v_dec is not null
     and (
       p_template like 'DECISION%'
       or p_template in ('FERRY_CANCELLED', 'ETA_AFTER_LATEST', 'NO_POSITION',
                         'SCHEDULE_DATE_CRITICAL', 'SILENT_VEHICLE', 'RISK_OPEN',
                         'RISK_SEVERITY', 'INSURANCE_EXPIRY', 'INSURANCE')
     ) then
    return '/#/decyzje/' || v_dec;
  end if;

  /* C5: przy load_id zawsze load_sms_code; bez numeru zlecenia w URL. */
  if p_load_id is not null then
    v_code := nullif(nullif(btrim(public.load_sms_code(p_load_id)), ''), '—');
  end if;
  if v_code is null then
    v_code := coalesce(
      nullif(p_payload->>'code', ''),
      nullif(p_payload->>'load_code', '')
    );
  end if;
  if v_code is not null then
    v_tab := coalesce(nullif(p_payload->>'tab', ''), 'status');
    return '/#/transport/' || replace(v_code, '/', '%2F')
           || '?zakladka=' || replace(v_tab, ' ', '%20');
  end if;
  if v_dec is not null then
    return '/#/decyzje/' || v_dec;
  end if;
  return '/';
end $$;

revoke all on function public.notify_click_url(text, jsonb, uuid)
  from public, anon, authenticated;
comment on function public.notify_click_url(text, jsonb, uuid) is
  '#411+#519 + C5 0443: url transport = load_sms_code; bez order_no.';

commit;
