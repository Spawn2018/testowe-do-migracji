-- BN6 (#716) — drogi LT/LV/EE/FI: rodzaje ryzyk + korytarze corridor_conditions + audience WSZYSCY.
-- Wybór: 4 osobne rodzaje (jak ROAD_SE/ROAD_PL; Ryzyka › Drogi per kraj). Cron road-fi (Digitraffic, bez klucza).

alter type risk_kind add value if not exists 'ROAD_LT';
alter type risk_kind add value if not exists 'ROAD_LV';
alter type risk_kind add value if not exists 'ROAD_EE';
alter type risk_kind add value if not exists 'ROAD_FI';

-- audience: jak ROAD_SE / ROAD_PL → WSZYSCY (0254 + BN6)
create or replace function public.risk_audience_for(p_kind text, p_detail jsonb)
returns risk_audience language plpgsql stable security definer set search_path = public as $$
declare v_dir text; v_inv text;
begin
  if auth.uid() is not null and current_app_user_id() is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  -- #398: cisza naczepy emtrack → tylko HHL (bez przewoźnika)
  if p_kind = 'SILENT_VEHICLE' and coalesce(p_detail->>'emtrack_trailer', '') = '1' then
    return 'HHL';
  end if;
  if p_kind in (
    'FERRY', 'ROAD_SE', 'ROAD_PL', 'ROAD_LT', 'ROAD_LV', 'ROAD_EE', 'ROAD_FI',
    'WEATHER', 'ETA_BREACH'
  ) then
    return 'WSZYSCY';
  end if;
  if p_kind = 'RESOURCE_MISSING' and coalesce(p_detail->>'rule', '') = 'ORDER_NO'
     and coalesce(p_detail->>'side', '') = 'HHL' then
    return 'HHL';
  end if;
  if p_kind in ('SILENT_VEHICLE', 'AUTO_STATUS', 'LOADING_UNCONFIRMED', 'RESOURCE_MISSING',
                'DOC_MISSING', 'PERMIT', 'INSURANCE', 'LATE_DATE_CHANGE', 'ROUTE_OBSTACLE') then
    return 'HHL_PRZEWOZNIK';
  end if;
  if p_kind in ('SEQUENCE', 'DATES_UNCONFIRMED') then
    return 'HHL_KLIENT';
  end if;
  if p_kind = 'INVOICE_MISMATCH' then
    v_dir := upper(coalesce(p_detail->>'direction', ''));
    v_inv := p_detail->>'invoice_id';
    if v_dir = '' and v_inv ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select i.direction::text into v_dir from invoices i where i.id = v_inv::uuid;
    end if;
    return case coalesce(v_dir, '')
             when 'KOSZT' then 'HHL_PRZEWOZNIK'
             when 'PRZYCHOD' then 'HHL_KLIENT'
             else 'HHL' end;
  end if;
  return 'HHL';
end $$;

revoke all on function public.risk_audience_for(text, jsonb) from public, anon;
grant execute on function public.risk_audience_for(text, jsonb) to authenticated;

-- Korytarze spowolnienia BN6 (jak SE_E4 / SE_E22)
alter table public.corridor_conditions drop constraint if exists corridor_conditions_corridor_check;
alter table public.corridor_conditions add constraint corridor_conditions_corridor_check
  check (corridor in (
    'SE_E4', 'SE_E22',
    'ROAD_LT', 'ROAD_LV', 'ROAD_EE', 'ROAD_FI'
  ));

insert into public.corridor_conditions (corridor, slowdown_mult, reason, source)
values
  ('ROAD_LT', 1.00, 'start — BN6 Litwa', 'BN6'),
  ('ROAD_LV', 1.00, 'start — BN6 Łotwa', 'BN6'),
  ('ROAD_EE', 1.00, 'start — BN6 Estonia', 'BN6'),
  ('ROAD_FI', 1.00, 'start — BN6 Finlandia', 'BN6')
on conflict (corridor) do nothing;

-- Ryzyka korytarza bez load_id: bez macierzy powiadomień (jak ROAD_SE/ROAD_PL, 0256) + BN6
create or replace function public.trg_risk_matrix_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_group text;
  v_tpl text;
  v_proj uuid;
  v_n int;
  v_url text;
  v_code text;
begin
  if new.load_id is null
     and new.kind::text in (
       'FERRY', 'WEATHER', 'ROAD_SE', 'ROAD_PL',
       'ROAD_LT', 'ROAD_LV', 'ROAD_EE', 'ROAD_FI'
     ) then
    return null;
  end if;
  if current_setting('tower.escalate_overdue', true) = '1'
     and coalesce(new.dedup_key, '') like 'decision-overdue:%' then
    return null;
  end if;

  v_group := case
    when new.kind::text in ('FERRY', 'WEATHER', 'ETA_BREACH') then 'RISK_FERRY_WEATHER'
    when new.kind::text in ('INVOICE_MISMATCH') then 'MONEY'
    when new.kind::text in ('USAGE_LIMIT', 'JOB_FAILURE') then 'SYSTEM'
    else 'SYSTEM'
  end;

  if tg_op = 'INSERT' then
    v_tpl := 'RISK_OPEN';
  elsif new.severity is distinct from old.severity then
    v_tpl := 'RISK_SEVERITY';
  elsif new.resolved_at is not null and old.resolved_at is null then
    -- #411: bez RISK_RESOLVED; oznacz powiązane IN_APP/WEB_PUSH/EMAIL
    v_n := public.notify_mark_case_closed('sprawa zamknięta', null, new.id);
    insert into public.audit_log (user_id, action, entity, entity_id, old_value, new_value)
    values (
      null, 'C1_RISK_RESOLVE_MARK_READ', 'risk_signals', new.id::text,
      jsonb_build_object('template', 'RISK_RESOLVED_skipped'),
      jsonb_build_object('marked', v_n, 'hotfix', '0256')
    );
    return null;
  else
    return null;
  end if;

  if v_tpl = 'RISK_SEVERITY'
     and new.severity::text = 'CRITICAL'
     and coalesce(new.detail->>'l3_level', '') = 'critical' then
    return null;
  end if;

  v_proj := new.project_id;
  if v_proj is null and new.load_id is not null then
    select project_id into v_proj from loads where id = new.load_id;
  end if;
  if new.load_id is not null then
    select coalesce(nullif(l.order_no, ''), nullif(l.hhl_order_no, ''))
      into v_code from loads l where l.id = new.load_id;
  end if;
  v_url := public.notify_click_url(
    v_tpl,
    jsonb_build_object(
      'risk_id', new.id, 'kind', new.kind, 'severity', new.severity,
      'title', new.title, 'title_key', new.title_key,
      'code', v_code
    ),
    new.load_id
  );
  perform public.matrix_notify(
    v_group, v_tpl, new.load_id, v_proj,
    jsonb_build_object(
      'risk_id', new.id, 'kind', new.kind, 'severity', new.severity,
      'title', new.title, 'title_key', new.title_key,
      'code', v_code, 'url', v_url
    ),
    'risk:' || v_tpl || ':' || new.id::text || ':' || new.severity::text
  );
  return null;
end $$;
revoke all on function public.trg_risk_matrix_notify() from public, anon, authenticated;

-- Cron Edge road-fi (Digitraffic tie — bez klucza)
create or replace function public.tower_cron_road_fi_invoke()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_key text;
begin
  if to_regclass('vault.decrypted_secrets') is null then
    raise notice 'tower_cron_road_fi_invoke: brak vault.decrypted_secrets';
    return;
  end if;
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    raise notice 'tower_cron_road_fi_invoke: brak net.http_post';
    return;
  end if;
  execute $q$
    select max(decrypted_secret) filter (where name = 'project_url'),
           max(decrypted_secret) filter (where name = 'service_role_key')
      from vault.decrypted_secrets
  $q$ into v_url, v_key;
  if v_url is null or v_url = '' or v_key is null or v_key = '' then
    raise notice 'tower_cron_road_fi_invoke: brak project_url/service_role_key';
    return;
  end if;
  perform net.http_post(
    url     := rtrim(v_url, '/') || '/functions/v1/road-fi',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type', 'application/json'),
    body    := '{}'::jsonb,
    timeout_milliseconds := 90000
  );
end;
$$;

revoke all on function public.tower_cron_road_fi_invoke() from public, anon, authenticated;
grant execute on function public.tower_cron_road_fi_invoke() to postgres;

do $body$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and to_regprocedure('cron.schedule(text,text,text)') is not null
  then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-road-fi';
    perform cron.schedule(
      'tower-road-fi',
      '*/15 * * * *',
      $c$select public.tower_cron_road_fi_invoke();$c$
    );
  else
    raise notice '0376: pg_cron niedostępne — tower-road-fi do zaplanowania ręcznie';
  end if;
end
$body$;
