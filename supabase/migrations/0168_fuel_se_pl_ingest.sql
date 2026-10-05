-- 0168 — PALIWO-AUTO-B: codzienne odczyty OKQ8 (Q8 Trucks / Diesel, SEK/l wprost) i Orlen
--   (ONEkodiesel PLN/m³ → PLN/l) do fuel_index_readings. Przełącznik FUEL_SE_PL_INGEST = true
--   (decyzja właściciela 05.10 ~10:37). Brak odczytu dnia → ryzyko JOB_FAILURE + e-mail HHL_ADMIN.
--   Nie rusza transportów. Idempotentna.

select set_config('tower.audit_source', 'migracja 0168 (PALIWO-AUTO-B)', true);

alter table security_flags drop constraint if exists security_flags_key_check;
alter table security_flags add constraint security_flags_key_check
  check (key in (
    'MFA_HHL_ADMIN', 'EXTERNAL_MESSAGING', 'PERMIT_REQUIRED_NON_STANDARD', 'FUEL_WOB_INGEST',
    'SMS_ZONE_APPROACH', 'SMS_ZONE_ENTER', 'DRIVER_LINK_ACCEPT', 'AUTOMATIC_DECISION_EMAIL',
    'H1_ROUTE_CHECK', 'H3_CORRIDOR_OBSTACLES', 'H6_MAP_OBSTACLES', 'FUEL_SE_PL_INGEST'
  ));

insert into security_flags (key, enabled, note)
values (
  'FUEL_SE_PL_INGEST', true,
  'PALIWO-AUTO-B: codzienne pobieranie OKQ8 Q8 Trucks Diesel (SEK/l wprost) i Orlen ONEkodiesel (PLN/l). Decyzja właściciela 05.10.'
)
on conflict (key) do update set enabled = excluded.enabled, note = excluded.note;

create or replace function public.fuel_se_pl_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select enabled from security_flags where key = 'FUEL_SE_PL_INGEST'), false)
$$;
revoke all on function public.fuel_se_pl_enabled() from public, anon, authenticated;
grant execute on function public.fuel_se_pl_enabled() to service_role;

create or replace function public.fuel_se_pl_ingest(p_project uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  v_id bigint;
  v_ins int := 0;
  v_skip int := 0;
  v_url text;
  v_note text;
  v_code text;
  v_period text;
  v_date date;
  v_val numeric;
begin
  if (fuel_se_pl_enabled()) is not true then
    raise exception 'Pobieranie SE/PL wyłączone (security_flags.FUEL_SE_PL_INGEST)';
  end if;
  if (exists (select 1 from projects where id = p_project)) is not true then
    raise exception 'Nieznany projekt';
  end if;
  if (jsonb_typeof(p_rows) = 'array' and jsonb_array_length(p_rows) between 1 and 20) is not true then
    raise exception 'Odczyty SE/PL: tablica 1–20 pozycji';
  end if;

  for v in select * from jsonb_array_elements(p_rows) loop
    v_code := v->>'index_code';
    if (v_code in ('SEK', 'PLN')) is not true then
      raise exception 'Kod spoza SEK/PLN: %', v_code;
    end if;
    v_period := v->>'period';
    if (v_period ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') is not true then
      raise exception 'Okres musi być YYYY-MM-DD: %', v_period;
    end if;
    v_date := (v->>'reading_date')::date;
    if (v_date <= (timezone('Europe/Warsaw', now()))::date) is not true then
      raise exception 'Data odczytu nie może być z przyszłości';
    end if;
    v_val := (v->>'value')::numeric;
    if (v_val > 0 and v_val < 100) is not true then
      raise exception 'Wartość poza zakresem (0–100): %', v_val;
    end if;
    v_url := nullif(trim(v->>'source_url'), '');
    if (v_url is not null and v_url ~ '^https://') is not true then
      raise exception 'source_url musi być https://';
    end if;
    if v_code = 'SEK' and (v_url ~ '^https://www\.okq8\.se/') is not true then
      raise exception 'SEK: źródło musi być https://www.okq8.se/';
    end if;
    if v_code = 'PLN' and (v_url ~ '^https://(www\.)?orlen\.pl/') is not true then
      raise exception 'PLN: źródło musi być https://www.orlen.pl/';
    end if;
    v_note := left(coalesce(nullif(trim(v->>'source_note'), ''), 'automat Watch Tower'), 500);

    if exists (
      select 1 from fuel_index_readings r
       where r.project_id = p_project and r.index_code = v_code and r.period = v_period
         and r.corrects_id is null
    ) then
      v_skip := v_skip + 1;
      continue;
    end if;

    insert into fuel_index_readings (project_id, index_code, period, reading_date, value, source_url, source_note)
    values (p_project, v_code, v_period, v_date, v_val, v_url, v_note)
    returning id into v_id;

    insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
    values (null, 'FUEL_READING_ADD', 'fuel_index_readings', v_id::text, null,
            (select to_jsonb(r) - 'entered_by' from fuel_index_readings r where r.id = v_id));
    v_ins := v_ins + 1;
  end loop;

  return jsonb_build_object('inserted', v_ins, 'skipped', v_skip);
end $$;
revoke all on function public.fuel_se_pl_ingest(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.fuel_se_pl_ingest(uuid, jsonb) to service_role;

-- Brak SEK lub PLN dla dnia (Europe/Warsaw) → jedno ryzyko + e-mail admin (dedup na dzień).
create or replace function public.fuel_se_pl_missing_watch(p_project uuid, p_day date default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := coalesce(p_day, (timezone('Europe/Warsaw', now()))::date);
  v_period text := to_char(v_day, 'YYYY-MM-DD');
  v_has_sek boolean;
  v_has_pln boolean;
  v_missing text[];
  v_key text;
  v_new int := 0;
begin
  if (exists (select 1 from projects where id = p_project)) is not true then
    raise exception 'Nieznany projekt';
  end if;

  select exists (
    select 1 from fuel_index_readings r
     where r.project_id = p_project and r.index_code = 'SEK' and r.period = v_period and r.corrects_id is null
  ) into v_has_sek;
  select exists (
    select 1 from fuel_index_readings r
     where r.project_id = p_project and r.index_code = 'PLN' and r.period = v_period and r.corrects_id is null
  ) into v_has_pln;

  v_missing := array[]::text[];
  if (v_has_sek) is not true then v_missing := array_append(v_missing, 'SEK'); end if;
  if (v_has_pln) is not true then v_missing := array_append(v_missing, 'PLN'); end if;

  v_key := 'fuel-miss:' || p_project || ':' || v_period;

  if cardinality(v_missing) = 0 then
    update risk_signals set resolved_at = now() where dedup_key = v_key and resolved_at is null;
    return jsonb_build_object('day', v_period, 'ok', true, 'missing', '[]'::jsonb);
  end if;

  if (exists (select 1 from risk_signals where dedup_key = v_key and resolved_at is null)) is not true then
    insert into risk_signals (project_id, kind, severity, title, title_key, detail, dedup_key, detected_at)
    values (
      p_project, 'JOB_FAILURE', 'HIGH',
      'Brak odczytu paliwa SEFS: ' || array_to_string(v_missing, '+'),
      'rk_job_failure',
      jsonb_build_object(
        'job', 'fuel-prices',
        'day', v_period,
        'missing', to_jsonb(v_missing),
        'text', 'Brak automatycznego odczytu indeksu paliwa (' || array_to_string(v_missing, ', ') || ') za ' || v_period || '. Użyj formularza ręcznego HHL albo sprawdź źródła OKQ8/Orlen.',
        'next_action', 'Wprowadź odczyt ręcznie (Opcje → SEFS) albo uruchom ponownie fuel-prices.',
        'params', jsonb_build_object('label', 'odczyt paliwa SEFS', 'label_key', 'job_label_fuel_prices', 'since', v_period, 'window', '1 day'),
        'text_key', 'rk_job_failure_text',
        'next_action_key', 'rk_job_failure_next'
      ),
      v_key, now()
    );
    v_new := 1;
    insert into notifications (channel, recipient, user_id, template, payload, dedup_key)
    select 'EMAIL', u.email, u.id, 'FUEL_READING_MISSING',
           jsonb_build_object('day', v_period, 'missing', array_to_string(v_missing, ', ')),
           'fuelmiss:' || p_project || ':' || v_period || ':' || u.id
      from app_users u where u.active and u.role = 'HHL_ADMIN' and u.email is not null
    on conflict do nothing;
  end if;

  return jsonb_build_object('day', v_period, 'ok', false, 'missing', to_jsonb(v_missing), 'new_risk', v_new);
end $$;
revoke all on function public.fuel_se_pl_missing_watch(uuid, date) from public, anon, authenticated;
grant execute on function public.fuel_se_pl_missing_watch(uuid, date) to service_role;
