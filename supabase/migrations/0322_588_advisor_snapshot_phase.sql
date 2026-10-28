-- #588 / brama bezpieczeństwa 28.10: cron nie zapisuje „Brak pomiaru” przed Edge.
-- Przyczyna: security_advisor_snapshot_tick → capture(phase=flags, bez advisor_ok)
-- → v_ok=false → integration_runs ok=false „Brak pomiaru”, choć Edge po chwili
-- uzupełnia findings (security-advisor-snapshot-edge ok=true). Stan systemu pokazuje
-- fałszywy brak pomiaru codziennie od ~18.10.
--
-- Fix: phase=flags = tylko szkielet migawki (bez integration_runs);
--      set_findings dopisuje wynik zadania security-advisor-snapshot z advisor_ok.

create or replace function public.security_advisor_snapshot_capture(
  p_findings jsonb default '[]'::jsonb,
  p_source text default 'cron',
  p_meta jsonb default '{}'::jsonb
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
  v_flags jsonb;
  v_src text := coalesce(nullif(trim(p_source), ''), 'cron');
  v_ok boolean := coalesce((p_meta ->> 'advisor_ok')::boolean, false);
  v_phase text := nullif(trim(coalesce(p_meta ->> 'phase', '')), '');
begin
  if (v_src in ('cron', 'gate', 'manual', 'edge')) is not true then
    raise exception 'Nieznane źródło migawki doradcy' using errcode = '22023';
  end if;

  select coalesce(jsonb_object_agg(key, jsonb_build_object(
           'enabled', enabled,
           'note', note,
           'updated_at', updated_at
         )), '{}'::jsonb)
    into v_flags
    from security_flags;

  insert into security_advisor_snapshots (source, findings, flags, meta)
  values (
    v_src,
    coalesce(p_findings, '[]'::jsonb),
    v_flags,
    coalesce(p_meta, '{}'::jsonb) || jsonb_build_object('flag_count', (select count(*)::int from security_flags))
  )
  returning id into v_id;

  -- Szkielet crona (phase=flags): bez wpisu — wynik po set_findings / Edge.
  if (v_phase = 'flags') is not true then
    insert into integration_runs (job, ran_at, ok, result)
    values (
      'security-advisor-snapshot',
      now(),
      v_ok,
      jsonb_build_object(
        'snapshot_id', v_id,
        'source', v_src,
        'findings', jsonb_array_length(coalesce(p_findings, '[]'::jsonb)),
        'flags', (select count(*)::int from security_flags),
        'advisor_ok', v_ok,
        'detail', case when v_ok then 'doradca security' else 'Brak pomiaru' end
      )
    );
  end if;

  return v_id;
end $$;

revoke all on function public.security_advisor_snapshot_capture(jsonb, text, jsonb)
  from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.security_advisor_snapshot_capture(jsonb, text, jsonb) to service_role;
  end if;
end $$;

create or replace function public.security_advisor_snapshot_set_findings(
  p_id bigint,
  p_findings jsonb,
  p_meta jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ok boolean := coalesce((p_meta ->> 'advisor_ok')::boolean, false);
  v_n int := jsonb_array_length(coalesce(p_findings, '[]'::jsonb));
  v_flags int;
begin
  if (p_id is not null) is not true then
    raise exception 'Brak id migawki doradcy' using errcode = '22023';
  end if;

  update security_advisor_snapshots
     set findings = coalesce(p_findings, '[]'::jsonb),
         meta = coalesce(meta, '{}'::jsonb) || coalesce(p_meta, '{}'::jsonb),
         source = case when source = 'cron' then 'edge' else source end
   where id = p_id;
  if not found then
    raise exception 'Nieznana migawka doradcy' using errcode = 'P0002';
  end if;

  select coalesce((meta ->> 'flag_count')::int, 0)
    into v_flags
    from security_advisor_snapshots
   where id = p_id;

  insert into integration_runs (job, ran_at, ok, result)
  values (
    'security-advisor-snapshot',
    now(),
    v_ok,
    jsonb_build_object(
      'snapshot_id', p_id,
      'source', 'edge',
      'findings', v_n,
      'flags', v_flags,
      'advisor_ok', v_ok,
      'detail', case when v_ok then 'doradca security' else 'Brak pomiaru' end
    )
  );
end $$;

revoke all on function public.security_advisor_snapshot_set_findings(bigint, jsonb, jsonb)
  from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.security_advisor_snapshot_set_findings(bigint, jsonb, jsonb) to service_role;
  end if;
end $$;
