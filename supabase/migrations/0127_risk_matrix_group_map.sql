-- =====================================================================
-- TOWER — Migracja 0127: poprawne mapowanie kind → grupa macierzy
--
-- Bug 0126: „else → RISK_FERRY_WEATHER” wysyłało do KSH ryzyka operacyjne
-- (RESOURCE_MISSING / numery zleceń, DOC_MISSING, …), choć macierz
-- RISK_FERRY_WEATHER = tylko prom/pogoda/opóźnienie ETA (§4 zlecenia).
-- Poza FERRY/WEATHER/ETA_BREACH → SYSTEM (domyślnie tylko HHL);
-- INVOICE_MISMATCH → MONEY; USAGE_LIMIT/JOB_FAILURE → SYSTEM.
-- Idempotentna.
-- =====================================================================

create or replace function public.trg_risk_matrix_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_group text;
  v_tpl text;
  v_proj uuid;
  v_stamp text;
begin
  -- mapowanie kind → grupa macierzy (§4: RISK_FERRY_WEATHER = prom/pogoda/ETA)
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
    v_tpl := 'RISK_RESOLVED';
  else
    return null;
  end if;
  v_proj := new.project_id;
  if v_proj is null and new.load_id is not null then
    select project_id into v_proj from loads where id = new.load_id;
  end if;
  v_stamp := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS');
  perform public.matrix_notify(
    v_group, v_tpl, new.load_id, v_proj,
    jsonb_build_object(
      'risk_id', new.id, 'kind', new.kind, 'severity', new.severity,
      'title', new.title, 'title_key', new.title_key
    ),
    'risk:' || v_tpl || ':' || new.id::text || ':' || v_stamp
  );
  return null;
end $$;
revoke all on function public.trg_risk_matrix_notify() from public, anon, authenticated;

drop trigger if exists trg_risk_matrix_notify on risk_signals;
create trigger trg_risk_matrix_notify
  after insert or update of severity, resolved_at on risk_signals
  for each row execute function public.trg_risk_matrix_notify();

do $$
begin
  if (select prosecdef and proconfig @> array['search_path=public']
        from pg_proc where pronamespace = 'public'::regnamespace
         and proname = 'trg_risk_matrix_notify') is not true then
    raise exception '0127: trg_risk_matrix_notify bez SECURITY DEFINER / search_path';
  end if;
end $$;
