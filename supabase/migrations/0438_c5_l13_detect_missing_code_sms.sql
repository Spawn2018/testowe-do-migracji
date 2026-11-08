-- C5 (D-20261015-0300-01): l13_decision_email + detect_missing_order_numbers
-- kod transportu = load_sms_code; bez fallbacku order_no / UUID. Po 0437.

begin;

-- ---------------------------------------------------------------------------
-- 1. l13_decision_email — skrót e-mail = load_sms_code (także HHL/KSH)
-- ---------------------------------------------------------------------------
create or replace function public.l13_decision_email(p_decision uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d decisions%rowtype;
  v_role text;
  v_sev text;
  v_kind text;
  v_bundle text;
  v_code text;
  v_payload jsonb;
  v_hhl_only boolean;
  r record;
begin
  select * into d from decisions where id = p_decision;
  if not found then
    return;
  end if;
  select decider_role, severity_default into v_role, v_sev
    from decision_types where code = d.type_code;
  v_sev := coalesce(d.severity, v_sev);
  v_hhl_only := d.type_code in (
    'KSH_CARRIER_CHANGED', 'KSH_REMOVED_BACK', 'ETA_CALIBRATION_APPROVAL'
  ) or v_role = 'ADMIN';
  v_kind := case when v_sev = 'CRITICAL' or d.type_code = 'FERRY_CANCELLED' then 'critical' else 'digest' end;
  v_bundle := coalesce(
    nullif(d.detail->>'bundle_key', ''),
    nullif(d.detail->>'sailing_id', ''),
    d.type_code || ':' || coalesce(d.detail->>'event_key', d.id::text)
  );
  /* C5: kod wysyłki — nigdy order_no / hhl_order_no / UUID (KSH nigdy numeru zlecenia). */
  v_code := nullif(nullif(btrim(public.load_sms_code(d.load_id)), ''), '—');
  v_payload := jsonb_build_object(
    'decision_id', d.id, 'type', d.type_code, 'title', d.title,
    'status', d.status, 'event', 'OPEN', 'severity', v_sev,
    'bundle_key', v_bundle, 'level', case when v_kind = 'critical' then 'critical' else 'info' end,
    'code', v_code
  );
  -- F7 #656: import_bell_quiet wycisza e-mail (bulk_quiet zostaje dla hist/quiet #426).
  if current_setting('tower.bulk_quiet', true) = 'on'
     or current_setting('tower.import_bell_quiet', true) = 'on' then
    return;
  end if;
  for r in
    select distinct u.id as user_id, u.email::text as recipient, u.locale, o.kind as org_kind
      from app_users u
      join organizations o on o.id = u.org_id
      join notification_matrix m
        on m.event_key = 'dec_new' and m.role = u.role and m.email
     where u.active and u.email is not null
       and (
         (o.kind = 'FORWARDER' and (v_role is distinct from 'ADMIN' or u.role = 'HHL_ADMIN'))
         or (v_hhl_only is not true and o.kind = 'CARRIER' and v_role = 'CARRIER' and (
              d.load_id is null
              or exists (select 1 from loads l where l.id = d.load_id and l.carrier_org_id = o.id)))
         or (v_hhl_only is not true and o.kind = 'CLIENT' and (
              d.project_id is null
              or exists (select 1 from projects pr where pr.id = d.project_id and pr.client_org_id = o.id)))
       )
  loop
    perform public.l13_queue_email(
      v_kind, 'DECISION_OPEN', r.user_id, r.recipient, d.load_id,
      v_code,
      v_payload || jsonb_build_object('locale', r.locale),
      left('dec:OPEN:' || d.id::text || ':EM:' || r.user_id::text, 200),
      case when v_kind = 'critical' then v_bundle else null end
    );
  end loop;
  perform public.l13_email_guard_note(now());
end $$;
revoke all on function public.l13_decision_email(uuid) from public, anon, authenticated;
comment on function public.l13_decision_email(uuid) is
  'C3-p + #581 + #653 + C5 0438: e-mail decyzji; skrót = load_sms_code; cisza przy bulk_quiet/import_bell_quiet.';

-- ---------------------------------------------------------------------------
-- 2. detect_missing_order_numbers — tytuł / params.code = load_sms_code
-- ---------------------------------------------------------------------------
create or replace function public.detect_missing_order_numbers(
  p_now timestamp with time zone default now(),
  p_lead_h integer default 48
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record; v_new int := 0; v_due timestamptz; v_key text; v_rows int;
  v_anchor timestamptz;
  v_close boolean;
begin
  -- zamknięcie otwartych poza oknem / statusem
  for r in
    select s.id, s.dedup_key, l.status, l.plan_load_date, l.plan_load_from
      from risk_signals s
      join loads l on l.id = s.load_id
     where s.resolved_at is null
       and s.dedup_key like 'ORDERNO:%'
  loop
    v_anchor := coalesce(r.plan_load_from, (r.plan_load_date::timestamp at time zone 'Europe/Warsaw'));
    v_close := false;
    if v_anchor is null or v_anchor > p_now + make_interval(hours => p_lead_h) then
      v_close := true;
    elsif r.status::text not in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY') then
      v_close := true;
    elsif r.dedup_key like 'ORDERNO:CARRIER:%'
      and public.load_status_rank(r.status) >= public.load_status_rank('AT_LOADING'::public.load_status)
    then
      v_close := true;
    end if;
    if v_close then
      update risk_signals set resolved_at = p_now where id = r.id and resolved_at is null;
      perform l3_lapse(r.dedup_key, p_now);
    end if;
  end loop;

  for r in
    select l.id, l.project_id, l.carrier_org_id, l.status, l.hhl_order_no, l.carrier_order_no,
           coalesce(l.plan_load_from, (l.plan_load_date::timestamp at time zone 'Europe/Warsaw')) as due,
           /* C5: bez fallbacku order_no / left(id,8) — tylko shipment. */
           nullif(nullif(btrim(public.load_sms_code(l.id)), ''), '—') as code
      from loads l
     where l.status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY')
       and coalesce(l.plan_load_from, (l.plan_load_date::timestamp at time zone 'Europe/Warsaw')) is not null
       and coalesce(l.plan_load_from, (l.plan_load_date::timestamp at time zone 'Europe/Warsaw'))
           <= p_now + make_interval(hours => p_lead_h)
  loop
    v_due := r.due;
    if r.status <> 'READY' and (r.hhl_order_no is null or btrim(r.hhl_order_no) = '') then
      v_key := 'ORDERNO:HHL:' || r.id;
      insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key)
      values (r.project_id, r.id, 'RESOURCE_MISSING', case when v_due <= p_now then 'CRITICAL' else 'HIGH' end::risk_severity,
              coalesce(r.code, '—') || ': brak numeru zlecenia HHL', 'rk_order_no_hhl',
              jsonb_build_object('rule', 'ORDER_NO', 'side', 'HHL', 'owner', 'HHL', 'due', v_due,
                'text', 'Numer zlecenia HHL jest obowiązkowy przed statusem GOTOWY (W12).',
                'meta', 'Odpowiada: HHL', 'next_action', 'Wpisz numer zlecenia HHL w szufladzie transportu',
                'params', jsonb_build_object('code', r.code), 'text_key', 'rk_order_no_hhl_text',
                'meta_key', 'risk_meta_hhl', 'next_action_key', 'rk_order_no_hhl_next'),
              v_key)
      on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing;
      get diagnostics v_rows = row_count; v_new := v_new + v_rows;
      if v_rows > 0 then
        insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
        select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, r.id, 'ORDER_NO_MISSING',
               jsonb_build_object('side', 'HHL', 'code', r.code, 'due', v_due, 'locale', u.locale),
               v_key || ':' || u.id || ':' || to_char(v_due, 'YYYYMMDD')
          from app_users u join organizations o on o.id = u.org_id
         where o.kind = 'FORWARDER' and u.active
        on conflict (dedup_key) where dedup_key is not null do nothing;
      end if;
    end if;
    if r.carrier_org_id is not null and (r.carrier_order_no is null or btrim(r.carrier_order_no) = '') then
      v_key := 'ORDERNO:CARRIER:' || r.id;
      insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key)
      values (r.project_id, r.id, 'RESOURCE_MISSING', case when v_due <= p_now then 'CRITICAL' else 'HIGH' end::risk_severity,
              coalesce(r.code, '—') || ': brak numeru zlecenia przewoźnika', 'rk_order_no_carrier',
              jsonb_build_object('rule', 'ORDER_NO', 'side', 'CARRIER', 'owner', 'SCX', 'due', v_due,
                'text', 'Numer zlecenia przewoźnika jest obowiązkowy przed załadunkiem (W12).',
                'meta', 'Odpowiada: przewoźnik', 'next_action', 'Wpisz numer zlecenia przewoźnika w szufladzie transportu',
                'params', jsonb_build_object('code', r.code), 'text_key', 'rk_order_no_carrier_text',
                'meta_key', 'risk_meta_carrier', 'next_action_key', 'rk_order_no_carrier_next'),
              v_key)
      on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing;
      get diagnostics v_rows = row_count; v_new := v_new + v_rows;
      if v_rows > 0 then
        insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
        select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, r.id, 'ORDER_NO_MISSING',
               jsonb_build_object('side', 'CARRIER', 'code', r.code, 'due', v_due, 'locale', u.locale),
               v_key || ':' || u.id || ':' || to_char(v_due, 'YYYYMMDD')
          from app_users u
         where u.org_id = r.carrier_org_id and u.active
        on conflict (dedup_key) where dedup_key is not null do nothing;
      end if;
    end if;
  end loop;
  return v_new;
end $$;

revoke all on function public.detect_missing_order_numbers(timestamptz, integer) from public, anon, authenticated;
comment on function public.detect_missing_order_numbers(timestamptz, integer) is
  'C5 0438: tytuł i params.code = load_sms_code; bez order_no / UUID.';

commit;
