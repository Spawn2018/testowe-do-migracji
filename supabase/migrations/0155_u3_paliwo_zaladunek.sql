-- =====================================================================
-- TOWER — Migracja 0155: U-3-PALIWO (D-34)
--
-- Tydzień opłaty paliwowej = data ZAŁADUNKU w Europe/Warsaw, nie rozładunek.
-- Kolejność: actual_load_at (dzień lokalny), inaczej plan_load_date.
-- Brak daty załadunku → fuel_ref_date puste. Nie podstawiamy rozładunku.
--
-- Kurs NBP (W3) bez zmiany: ostatnia tabela A ściśle przed dniem rozładunku.
-- Tydzień faktury bez zmiany: realizacja = rozładunek.
--
-- Stawka: sefs_week_calc — średnia odczytów SEK/PLN z poprzedniego tygodnia
-- kalendarzowego (pon–niedz) względem daty załadunku, potem hybrid_min.
-- To ta sama reguła co sefs_week_for_load (0101). Brak odczytów = brak
-- mnożnika, bez zgadywania stawki. Ten sam wynik na koszcie i przychodzie.
-- Zafakturowana strona (invoiced_total_eur) nie jest ruszana (Z1).
--
-- Migracja nie wstawia odczytów ani stawek.
-- Idempotentna: CREATE OR REPLACE, REVOKE, DROP TRIGGER IF EXISTS.
-- =====================================================================

create or replace function public.sefs_compute_hybrid_sys(p_project uuid, p_avg_sek numeric, p_avg_pln numeric)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  p sefs_parameters%rowtype;
  v_sek numeric; v_pln numeric; v_app numeric;
  v_over_sek boolean := false; v_over_pln boolean := false;
  v_max_sek numeric; v_max_pln numeric;
begin
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
revoke all on function public.sefs_compute_hybrid_sys(uuid, numeric, numeric) from public, anon, authenticated;

create or replace function public.sefs_compute_hybrid(p_project uuid, p_avg_sek numeric, p_avg_pln numeric)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if (is_hhl()) is not true then
    raise exception 'SEFS — wyłącznie HHL' using errcode = '42501';
  end if;
  return sefs_compute_hybrid_sys(p_project, p_avg_sek, p_avg_pln);
end $$;

-- Średnia z poprzedniego tygodnia kalendarzowego względem daty załadunku.
-- Bez sprawdzenia roli: woła ją migawka. sefs_week_for_load zostawia strażnika HHL.
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

create or replace function public.sefs_week_for_load(p_project uuid, p_load_date date)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if (is_hhl()) is not true then
    raise exception 'SEFS — wyłącznie HHL' using errcode = '42501';
  end if;
  return sefs_week_calc(p_project, p_load_date);
end $$;

-- Data załadunku: rzeczywisty załadunek (dzień lokalny), inaczej plan.
create or replace function public.fuel_load_date(p_load uuid)
returns date
language sql stable security definer set search_path = public as $$
  select coalesce((l.actual_load_at at time zone 'Europe/Warsaw')::date, l.plan_load_date)
    from loads l where l.id = p_load;
$$;
revoke all on function public.fuel_load_date(uuid) from public, anon, authenticated;

create or replace function public.fx_write_fuel(p_load uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_project uuid;
  v_fuel date;
  v_res jsonb;
  v_ok boolean;
begin
  select project_id, public.fuel_load_date(id) into v_project, v_fuel from loads where id = p_load;
  if not found then return; end if;
  if v_fuel is null then
    update load_cost set fuel_ref_date = null
      where load_id = p_load and invoiced_total_eur is null;
    update load_revenue set fuel_ref_date = null
      where load_id = p_load and invoiced_total_eur is null;
    return;
  end if;
  v_res := sefs_week_calc(v_project, v_fuel);
  v_ok := coalesce(v_res->>'ok', '') = 'true';
  update load_cost set
    fuel_ref_date = v_fuel,
    fuel_mult_sek = case when v_ok then (v_res->>'mult_sek')::numeric else fuel_mult_sek end,
    fuel_mult_pln = case when v_ok then (v_res->>'mult_pln')::numeric else fuel_mult_pln end,
    fuel_applied_mult = case when v_ok then (v_res->>'applied_mult')::numeric else fuel_applied_mult end
  where load_id = p_load and invoiced_total_eur is null;
  update load_revenue set
    fuel_ref_date = v_fuel,
    fuel_mult_sek = case when v_ok then (v_res->>'mult_sek')::numeric else fuel_mult_sek end,
    fuel_mult_pln = case when v_ok then (v_res->>'mult_pln')::numeric else fuel_mult_pln end,
    fuel_applied_mult = case when v_ok then (v_res->>'applied_mult')::numeric else fuel_applied_mult end
  where load_id = p_load and invoiced_total_eur is null;
end $$;
revoke all on function public.fx_write_fuel(uuid) from public, anon, authenticated;

create or replace function fx_snapshot_load(p_load uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_at timestamptz; v_day date; v_rate record;
begin
  select actual_delivery_at into v_at from loads where id = p_load;
  if v_at is null then return false; end if;
  v_day := (v_at at time zone 'Europe/Warsaw')::date;
  update load_cost set pricing_tier = 'REALIZACJA'
    where load_id = p_load and invoiced_total_eur is null;
  update load_revenue set pricing_tier = 'REALIZACJA'
    where load_id = p_load and invoiced_total_eur is null;
  perform fx_write_fuel(p_load);
  begin
    select * into v_rate from fx_rate_before(v_day);
  exception when others then
    update load_cost set fx_provisional = true
      where load_id = p_load and invoiced_total_eur is null;
    update load_revenue set fx_provisional = true
      where load_id = p_load and invoiced_total_eur is null;
    return false;
  end;
  update load_cost set
         fx_table_no = v_rate.table_no, fx_effective_date = v_rate.rate_date, fx_rate_pln = v_rate.rate_pln,
         fx_date = v_rate.rate_date, fx_provisional = false
    where load_id = p_load and invoiced_total_eur is null;
  update load_revenue set
         fx_table_no = v_rate.table_no, fx_effective_date = v_rate.rate_date, fx_rate_pln = v_rate.rate_pln,
         fx_date = v_rate.rate_date, fx_provisional = false
    where load_id = p_load and invoiced_total_eur is null;
  return true;
end $$;

create or replace function trg_fx_snapshot_on_unload() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.actual_delivery_at is not null
     and new.actual_delivery_at is distinct from old.actual_delivery_at then
    perform fx_snapshot_load(new.id);
  elsif new.actual_delivery_at is not null
     and (new.actual_load_at is distinct from old.actual_load_at
          or new.plan_load_date is distinct from old.plan_load_date) then
    perform fx_write_fuel(new.id);
  end if;
  return null;
end $$;

drop trigger if exists trg_loads_fx_snapshot on loads;
create trigger trg_loads_fx_snapshot
  after update of actual_delivery_at, actual_load_at, plan_load_date on loads
  for each row execute function trg_fx_snapshot_on_unload();

revoke all on function fx_snapshot_load(uuid) from public, anon, authenticated;
revoke all on function trg_fx_snapshot_on_unload() from public, anon, authenticated;

comment on column load_cost.fuel_ref_date is
  'D-34: lokalna data załadunku (Europe/Warsaw). Nie dzień rozładunku.';
comment on column load_revenue.fuel_ref_date is
  'D-34: lokalna data załadunku (Europe/Warsaw). Nie dzień rozładunku.';

-- Otwarte strony: data paliwa z załadunku. Mnożnik tylko gdy są odczyty.
-- Zafakturowane wiersze zostają (Z1).
do $$
declare r record;
begin
  for r in
    select distinct x.load_id as id from (
      select load_id from load_cost where invoiced_total_eur is null
      union
      select load_id from load_revenue where invoiced_total_eur is null
    ) x
  loop
    perform fx_write_fuel(r.id);
  end loop;
end $$;
