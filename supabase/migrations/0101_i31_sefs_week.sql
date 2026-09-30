-- 0101 — I-31: SEFS tygodniowy — lookup mnożnika + hybrid_min z odczytów / średnich.
--   sefs_lookup_mult(price, tiers) · sefs_compute_hybrid(avg_sek, avg_pln, project)
--   · sefs_week_for_load(project, load_date) — średnia z poprzedniego tygodnia kalendarzowego
--     (pon–niedz) z fuel_index_readings dziennych (period = YYYY-MM-DD).
--   III-10 WOB: nie używane. Migracja BEZ kwot/tabel. Idempotentna.

-- I-31: odczyty dzienne OKQ8/Orlen — period = dzień (oprócz YYYY-MM / YYYY-Www).
alter table fuel_index_readings drop constraint if exists fuel_index_readings_period_check;
alter table fuel_index_readings add constraint fuel_index_readings_period_check
  check (period ~ '^[0-9]{4}-([0-9]{2}-[0-9]{2}|(0[1-9]|1[0-2])|W(0[1-9]|[1-4][0-9]|5[0-3]))$');

create or replace function public.sefs_lookup_mult(p_price numeric, p_tiers jsonb)
returns numeric
language plpgsql immutable set search_path = public as $$
declare
  v jsonb; v_lte numeric; v_mult numeric; v_last numeric := 1;
begin
  if (jsonb_typeof(p_tiers) = 'array' and jsonb_array_length(p_tiers) > 0) is not true then
    return 1;
  end if;
  for v in select value from jsonb_array_elements(p_tiers) loop
    v_lte := (v->>'lte')::numeric;
    v_mult := (v->>'mult')::numeric;
    v_last := v_mult;
    if p_price <= v_lte then
      return v_mult;
    end if;
  end loop;
  return v_last;
end $$;
revoke all on function public.sefs_lookup_mult(numeric, jsonb) from public, anon;
grant execute on function public.sefs_lookup_mult(numeric, jsonb) to authenticated;

create or replace function public.sefs_compute_hybrid(p_project uuid, p_avg_sek numeric, p_avg_pln numeric)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  p sefs_parameters%rowtype;
  v_sek numeric; v_pln numeric; v_app numeric;
  v_over_sek boolean := false; v_over_pln boolean := false;
  v_max_sek numeric; v_max_pln numeric;
begin
  if (is_hhl()) is not true then
    raise exception 'SEFS — wyłącznie HHL' using errcode = '42501';
  end if;
  select * into p from sefs_parameters where project_id = p_project order by version desc limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'NO_SEFS_PARAMS',
      'message', 'Brak parametrów SEFS — wycena paliwowa wstrzymana');
  end if;
  select max((t->>'lte')::numeric) into v_max_sek from jsonb_array_elements(p.tiers_sek) t;
  select max((t->>'lte')::numeric) into v_max_pln from jsonb_array_elements(p.tiers_pln) t;
  if p_avg_sek is not null and v_max_sek is not null and p_avg_sek > v_max_sek then v_over_sek := true; end if;
  if p_avg_pln is not null and v_max_pln is not null and p_avg_pln > v_max_pln then v_over_pln := true; end if;

  v_sek := sefs_lookup_mult(round(p_avg_sek::numeric, 2), p.tiers_sek);
  v_pln := sefs_lookup_mult(round(p_avg_pln::numeric, 2), p.tiers_pln);
  v_app := least(v_sek, v_pln);
  return jsonb_build_object(
    'ok', true,
    'avg_sek', round(p_avg_sek::numeric, 2),
    'avg_pln', round(p_avg_pln::numeric, 2),
    'mult_sek', v_sek,
    'mult_pln', v_pln,
    'applied_mult', v_app,
    'over_table_sek', v_over_sek,
    'over_table_pln', v_over_pln,
    'params_version', p.version,
    'cycle', p.cycle
  );
end $$;
revoke all on function public.sefs_compute_hybrid(uuid, numeric, numeric) from public, anon;
grant execute on function public.sefs_compute_hybrid(uuid, numeric, numeric) to authenticated;

-- Średnia z poprzedniego tygodnia kalendarzowego (pon–niedz) względem daty załadunku.
-- Odczyty dzienne: period = 'YYYY-MM-DD' (I-31), index_code SEK|PLN.
create or replace function public.sefs_week_for_load(p_project uuid, p_load_date date)
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
  if (is_hhl()) is not true then
    raise exception 'SEFS — wyłącznie HHL' using errcode = '42501';
  end if;
  if (p_load_date is not null) is not true then
    return jsonb_build_object('ok', false, 'reason', 'NO_LOAD_DATE');
  end if;
  -- tydzień załadunku (pon=1 … niedz=7 w ISO)
  v_week_start := p_load_date - ((extract(isodow from p_load_date)::int) - 1);
  v_week_end := v_week_start + 6;
  v_prev_start := v_week_start - 7;
  v_prev_end := v_week_start - 1;

  select avg(value), count(*) into v_avg_sek, v_n_sek
    from fuel_index_readings r
   where r.project_id = p_project and r.index_code = 'SEK' and r.corrects_id is null
     and r.period ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     and r.period::date between v_prev_start and v_prev_end;

  select avg(value), count(*) into v_avg_pln, v_n_pln
    from fuel_index_readings r
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

  v_res := sefs_compute_hybrid(p_project, v_avg_sek, v_avg_pln);
  return v_res || jsonb_build_object(
    'load_week_start', v_week_start,
    'load_week_end', v_week_end,
    'prev_week_start', v_prev_start,
    'prev_week_end', v_prev_end,
    'n_sek', v_n_sek,
    'n_pln', v_n_pln
  );
end $$;
revoke all on function public.sefs_week_for_load(uuid, date) from public, anon;
grant execute on function public.sefs_week_for_load(uuid, date) to authenticated;
