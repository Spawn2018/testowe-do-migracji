-- 0166 — SEFS-KOREKTA (decyzja właściciela 05.10): korekta ceny od dostawcy wchodzi do średniej SEFS
--   dopóki tydzień nie jest zamknięty. Po zamknięciu — wartość zamrożona migawką przy transporcie (32.3 /
--   fx_write_fuel / fx_snapshot_load): późniejsza korekta nie zmienia policzonych transportów ani faktur;
--   zapis korekty zostaje w fuel_index_readings (corrects_id, correction_reason) i w audit_log.
--   Dotąd sefs_week_calc i l1b_sefs_note brały wyłącznie oryginał (corrects_id is null) i pomijały korektę.
--   Teraz: dla każdego dnia oryginału średnia bierze wartość korekty, gdy istnieje (unikalny indeks
--   fuel_index_readings_one_correction — najwyżej jedna korekta na oryginał).
--   Zamknięcie tygodnia = migawka na transporcie (fuel_applied_mult zapisane przy rozładunku / fx_snapshot;
--   fx_write_fuel nie nadpisuje, gdy invoiced_total_eur is not null). Zmiana odczytu / korekty nie woła
--   automatycznie fx_write_fuel — więc już zamrożone transporty zostają.

select set_config('tower.audit_source', 'migracja 0166 (SEFS-KOREKTA)', true);

create or replace function public.sefs_week_calc(p_project uuid, p_load_date date)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_week_start date;
  v_week_end date;
  v_prev_start date;
  v_prev_end date;
  v_avg_sek numeric;
  v_avg_pln numeric;
  v_n_sek int; v_n_pln int;
  v_res jsonb;
begin
  if (p_load_date is not null) is not true then
    return jsonb_build_object('ok', false, 'reason', 'NO_LOAD_DATE');
  end if;
  v_week_start := p_load_date - ((extract(isodow from p_load_date)::int) - 1);
  v_week_end := v_week_start + 6;
  v_prev_start := v_week_start - 7;
  v_prev_end := v_week_start - 1;

  -- oryginał dnia + opcjonalna korekta (preferowana w średniej)
  select avg(coalesce(c.value, r.value)), count(*) into v_avg_sek, v_n_sek
    from fuel_index_readings r
    left join fuel_index_readings c on c.corrects_id = r.id
   where r.project_id = p_project and r.index_code = 'SEK' and r.corrects_id is null
     and r.period ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     and r.period::date between v_prev_start and v_prev_end;

  select avg(coalesce(c.value, r.value)), count(*) into v_avg_pln, v_n_pln
    from fuel_index_readings r
    left join fuel_index_readings c on c.corrects_id = r.id
   where r.project_id = p_project and r.index_code = 'PLN' and r.corrects_id is null
     and r.period ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     and r.period::date between v_prev_start and v_prev_end;

  if (v_n_sek > 0 and v_n_pln > 0 and v_avg_sek is not null and v_avg_pln is not null) is not true then
    return jsonb_build_object(
      'ok', false, 'reason', 'SOURCE_FAILURE',
      'message', 'Brak pełnych odczytów SEK/PLN za poprzedni tydzień — użyj ostatniego mnożnika + ryzyko HHL',
      'prev_week_start', v_prev_start, 'prev_week_end', v_prev_end,
      'n_sek', coalesce(v_n_sek, 0), 'n_pln', coalesce(v_n_pln, 0)
    );
  end if;

  v_res := sefs_compute_hybrid_sys(p_project, v_avg_sek, v_avg_pln);
  return v_res || jsonb_build_object(
    'load_week_start', v_week_start,
    'load_week_end', v_week_end,
    'prev_week_start', v_prev_start,
    'prev_week_end', v_prev_end,
    'n_sek', v_n_sek,
    'n_pln', v_n_pln
  );
end $$;
revoke all on function public.sefs_week_calc(uuid, date) from public, anon, authenticated;

create or replace function public.l1b_sefs_note(p_project uuid, p_load_date date)
returns text
language plpgsql
security definer
set search_path = public
as $l1b$
declare
  v_week_start date;
  v_prev_start date;
  v_prev_end date;
  v_n_sek int;
  v_n_pln int;
  v_avg_sek numeric;
  v_avg_pln numeric;
  v_tiers_sek jsonb;
  v_tiers_pln jsonb;
  v_max_sek numeric;
  v_max_pln numeric;
  v_reason text;
begin
  if p_project is null or p_load_date is null then
    return null;
  end if;
  v_week_start := p_load_date - ((extract(isodow from p_load_date)::int) - 1);
  v_prev_start := v_week_start - 7;
  v_prev_end := v_week_start - 1;
  select avg(coalesce(c.value, r.value)), count(*) into v_avg_sek, v_n_sek
    from fuel_index_readings r
    left join fuel_index_readings c on c.corrects_id = r.id
   where r.project_id = p_project and r.index_code = 'SEK' and r.corrects_id is null
     and r.period ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     and r.period::date between v_prev_start and v_prev_end;
  select avg(coalesce(c.value, r.value)), count(*) into v_avg_pln, v_n_pln
    from fuel_index_readings r
    left join fuel_index_readings c on c.corrects_id = r.id
   where r.project_id = p_project and r.index_code = 'PLN' and r.corrects_id is null
     and r.period ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     and r.period::date between v_prev_start and v_prev_end;
  select sp.tiers_sek, sp.tiers_pln into v_tiers_sek, v_tiers_pln
    from sefs_parameters sp
   where sp.project_id = p_project
   order by sp.version desc
   limit 1;
  if (v_n_sek > 0 and v_n_pln > 0 and v_avg_sek is not null and v_avg_pln is not null and v_tiers_sek is not null) is not true then
    v_reason := 'SOURCE';
  else
    select max((t->>'lte')::numeric) into v_max_sek from jsonb_array_elements(v_tiers_sek) t;
    select max((t->>'lte')::numeric) into v_max_pln from jsonb_array_elements(v_tiers_pln) t;
    if v_max_sek is null or v_max_pln is null or v_avg_sek > v_max_sek or v_avg_pln > v_max_pln then
      v_reason := case when v_max_sek is null or v_max_pln is null then 'SOURCE' else 'OVER' end;
    else
      v_reason := 'OK';
    end if;
  end if;
  if v_reason in ('SOURCE', 'OVER') then
    perform decision_open_from_event(
      p_project, 'SEFS_OUT_OF_TABLE',
      'l1b:sefs:' || p_project::text || ':' || v_prev_start::text || ':' || v_reason,
      case when v_reason = 'SOURCE' then 'SEFS: brak źródła indeksu' else 'SEFS: indeks poza tabelą progów' end,
      jsonb_build_object('reason', v_reason, 'prev_week_start', v_prev_start, 'load_date', p_load_date),
      null, null
    );
  end if;
  return v_reason;
end
$l1b$;
revoke all on function public.l1b_sefs_note(uuid, date) from public, anon, authenticated;

comment on function public.sefs_week_calc(uuid, date) is
  'SEFS średnia pn–nd poprzedniego tygodnia; wartość dnia = korekta jeśli jest, inaczej oryginał (0166). Zamrożenie po migawce 32.3.';
