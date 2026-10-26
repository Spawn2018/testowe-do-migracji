-- #563 / D-20261026-1506-01: opłata paliwowa od t44 — próg „do X” (MAX), PLN 7 dni,
-- korekty wygrywają w średniej; ≤43 bez zmian (MIN, 5 publ. PLN).
begin;

-- ---------------------------------------------------------------------
-- 1. Kolumny metody na wersji parametrów
-- ---------------------------------------------------------------------
alter table public.sefs_parameters
  add column if not exists tier_bound text not null default 'MIN',
  add column if not exists avg_days_pln int not null default 5;

alter table public.sefs_parameters
  drop constraint if exists sefs_parameters_tier_bound_chk;
alter table public.sefs_parameters
  add constraint sefs_parameters_tier_bound_chk
  check (tier_bound in ('MIN', 'MAX'));

alter table public.sefs_parameters
  drop constraint if exists sefs_parameters_avg_days_pln_chk;
alter table public.sefs_parameters
  add constraint sefs_parameters_avg_days_pln_chk
  check (avg_days_pln in (5, 7));

comment on column public.sefs_parameters.tier_bound is
  '#563: MIN = „od progu” (D-1322, ≤t43); MAX = „do X” (pierwszy lte ≥ średnia, od t44).';
comment on column public.sefs_parameters.avg_days_pln is
  '#563: 5 = średnia z publikacji Orlen (≤t43); 7 = średnia 7 cen dziennych jak OKQ8 (od t44).';

-- Domyślne MIN/5 z ADD COLUMN wystarczą (trg_sefs_parameters_immutable blokuje UPDATE).

-- ---------------------------------------------------------------------
-- 2. Lookup: MIN (stare) / MAX (od t44)
-- ---------------------------------------------------------------------
-- 3-arg BEZ default (inaczej 2-arg jest niejednoznaczny w Postgres).
drop function if exists public.sefs_lookup_mult(numeric, jsonb);
drop function if exists public.sefs_lookup_mult(numeric, jsonb, text);

create or replace function public.sefs_lookup_mult(
  p_price numeric, p_tiers jsonb, p_bound text
)
returns numeric
language plpgsql immutable set search_path = public as $$
declare
  v_mult numeric;
  v_bound text := coalesce(nullif(btrim(p_bound), ''), 'MIN');
begin
  if (jsonb_typeof(p_tiers) = 'array' and jsonb_array_length(p_tiers) > 0) is not true then
    return 1;
  end if;
  if p_price is null then
    return 1;
  end if;

  if v_bound = 'MAX' then
    -- „do X”: pierwszy próg (rosnąco) z lte ≥ cena; powyżej tabeli → ostatni.
    select (t->>'mult')::numeric into v_mult
      from jsonb_array_elements(p_tiers) t
     where (t->>'lte')::numeric >= p_price
     order by (t->>'lte')::numeric asc
     limit 1;
    if found then
      return v_mult;
    end if;
    select (t->>'mult')::numeric into v_mult
      from jsonb_array_elements(p_tiers) t
     order by (t->>'lte')::numeric desc
     limit 1;
    return coalesce(v_mult, 1);
  end if;

  -- MIN / D-1322: najwyższy próg lte ≤ cena; poniżej pierwszego → pierwszy.
  select (t->>'mult')::numeric into v_mult
    from jsonb_array_elements(p_tiers) t
   where (t->>'lte')::numeric <= p_price
   order by (t->>'lte')::numeric desc
   limit 1;
  if found then
    return v_mult;
  end if;
  select (t->>'mult')::numeric into v_mult
    from jsonb_array_elements(p_tiers) t
   order by (t->>'lte')::numeric asc
   limit 1;
  return coalesce(v_mult, 1);
end $$;

comment on function public.sefs_lookup_mult(numeric, jsonb, text) is
  '#563: MIN = od progu (≤t43); MAX = do X (pierwszy lte ≥ cena, od t44).';

-- 2-arg: MIN (i31 / stare wywołania).
create or replace function public.sefs_lookup_mult(p_price numeric, p_tiers jsonb)
returns numeric
language sql immutable set search_path = public as $$
  select public.sefs_lookup_mult(p_price, p_tiers, 'MIN');
$$;

revoke all on function public.sefs_lookup_mult(numeric, jsonb, text)
  from public, anon;
revoke all on function public.sefs_lookup_mult(numeric, jsonb)
  from public, anon;
grant execute on function public.sefs_lookup_mult(numeric, jsonb, text)
  to authenticated, service_role;
grant execute on function public.sefs_lookup_mult(numeric, jsonb)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. Hybrid: bound + over_table zależne od metody
-- ---------------------------------------------------------------------
create or replace function public.sefs_compute_hybrid_sys(
  p_project uuid, p_avg_sek numeric, p_avg_pln numeric, p_ref_date date
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  p sefs_parameters%rowtype;
  v_sek numeric; v_pln numeric; v_app numeric;
  v_over_sek boolean := false; v_over_pln boolean := false;
  v_max_sek numeric; v_max_pln numeric;
  v_step_sek numeric := 0.30; v_step_pln numeric := 0.10;
  v_bound text;
  v_avg_sek numeric := round(p_avg_sek::numeric, 2);
  v_avg_pln numeric := round(p_avg_pln::numeric, 2);
begin
  select * into p from sefs_params_for(p_project, p_ref_date);
  if (p.id is not null) is not true then
    return jsonb_build_object('ok', false, 'reason', 'NO_SEFS_PARAMS',
      'message', 'Brak parametrów SEFS obowiązujących w tygodniu załadunku — wycena paliwowa wstrzymana');
  end if;
  v_bound := coalesce(p.tier_bound, 'MIN');
  select max((t->>'lte')::numeric) into v_max_sek from jsonb_array_elements(p.tiers_sek) t;
  select max((t->>'lte')::numeric) into v_max_pln from jsonb_array_elements(p.tiers_pln) t;

  if v_bound = 'MAX' then
    -- #563: powyżej tabeli = cena > ostatni próg
    if p_avg_sek is not null and v_max_sek is not null and v_avg_sek > v_max_sek then
      v_over_sek := true;
    end if;
    if p_avg_pln is not null and v_max_pln is not null and v_avg_pln > v_max_pln then
      v_over_pln := true;
    end if;
  else
    if p_avg_sek is not null and v_max_sek is not null
       and v_avg_sek >= v_max_sek + v_step_sek then
      v_over_sek := true;
    end if;
    if p_avg_pln is not null and v_max_pln is not null
       and v_avg_pln >= v_max_pln + v_step_pln then
      v_over_pln := true;
    end if;
  end if;

  v_sek := sefs_lookup_mult(v_avg_sek, p.tiers_sek, v_bound);
  v_pln := sefs_lookup_mult(v_avg_pln, p.tiers_pln, v_bound);
  v_app := least(v_sek, v_pln);
  return jsonb_build_object(
    'ok', true,
    'avg_sek', v_avg_sek,
    'avg_pln', v_avg_pln,
    'mult_sek', v_sek, 'mult_pln', v_pln, 'applied_mult', v_app,
    'over_table_sek', v_over_sek, 'over_table_pln', v_over_pln,
    'params_version', p.version, 'params_valid_from', p.valid_from,
    'tier_bound', v_bound, 'avg_days_pln', p.avg_days_pln,
    'index_sek', p.index_sek, 'index_pln', p.index_pln,
    'cycle', p.cycle
  );
end $$;

-- ---------------------------------------------------------------------
-- 4. Efektywna wartość odczytu (najnowsza korekta wygrywa)
-- ---------------------------------------------------------------------
create or replace function public.sefs_reading_effective_value(p_reading_id bigint)
returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select c.value
       from fuel_index_readings c
      where c.corrects_id = p_reading_id
      order by c.entered_at desc, c.id desc
      limit 1),
    (select r.value from fuel_index_readings r where r.id = p_reading_id)
  );
$$;

revoke all on function public.sefs_reading_effective_value(bigint)
  from public, anon, authenticated;
grant execute on function public.sefs_reading_effective_value(bigint) to service_role;

-- ---------------------------------------------------------------------
-- 5. OKQ8: średnia 7 dni
--    ≤t43 (MIN): reguła D-1300 — ostatnia publikacja ≤ dzień (bez period=D).
--    t44+ (MAX / avg_days_pln=7): period=D + efektywna korekta (F7 #579).
-- ---------------------------------------------------------------------
create or replace function public.sefs_sek_daily_avg(p_project uuid, p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_day date;
  v_val numeric;
  v_pub date;
  v_sum numeric := 0;
  v_n int := 0;
  v_days jsonb := '[]'::jsonb;
  v_pubs jsonb := '[]'::jsonb;
  v_pub_keys text[] := array[]::text[];
  v_params sefs_parameters%rowtype;
  v_max boolean := false;
begin
  -- Metoda z wersji obowiązującej w poniedziałek tygodnia załadunku (= p_to+1).
  select * into v_params from sefs_params_for(p_project, p_to + 1);
  v_max := coalesce(v_params.tier_bound, 'MIN') = 'MAX'
        or coalesce(v_params.avg_days_pln, 5) = 7;

  if (exists (
        select 1 from fuel_index_readings r
         where r.project_id = p_project and r.index_code = 'SEK' and r.corrects_id is null
           and r.period ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
           and r.period::date between p_from and p_to
      )) is not true then
    return jsonb_build_object(
      'avg', null, 'n', 0, 'days', '[]'::jsonb, 'pubs', '[]'::jsonb,
      'fallback_last', false, 'no_readings', true);
  end if;

  for v_day in select d::date from generate_series(p_from, p_to, '1 day') d loop
    if v_max then
      -- t44+: najpierw odczyt z period = dzień (efektywna = korekta).
      select public.sefs_reading_effective_value(r.id),
             coalesce(
               (select c.published_on from fuel_index_readings c
                 where c.corrects_id = r.id order by c.entered_at desc, c.id desc limit 1),
               r.published_on)
        into v_val, v_pub
        from fuel_index_readings r
       where r.project_id = p_project and r.index_code = 'SEK' and r.corrects_id is null
         and r.period = to_char(v_day, 'YYYY-MM-DD')
       order by r.entered_at desc, r.id desc
       limit 1;

      if v_val is null then
        select public.sefs_reading_effective_value(r.id),
               coalesce(
                 (select c.published_on from fuel_index_readings c
                   where c.corrects_id = r.id order by c.entered_at desc, c.id desc limit 1),
                 r.published_on)
          into v_val, v_pub
          from fuel_index_readings r
         where r.project_id = p_project and r.index_code = 'SEK' and r.corrects_id is null
           and r.period ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
           and coalesce(
                 (select c.published_on from fuel_index_readings c
                   where c.corrects_id = r.id order by c.entered_at desc, c.id desc limit 1),
                 r.published_on) <= v_day
         order by coalesce(
                    (select c.published_on from fuel_index_readings c
                      where c.corrects_id = r.id order by c.entered_at desc, c.id desc limit 1),
                    r.published_on) desc,
                  r.entered_at desc, r.id desc
         limit 1;
      end if;
    else
      -- ≤t43: D-1300 — ostatnia publikacja ≤ dzień (period nie wyznacza ceny dnia).
      with pubs as (
        select distinct on (coalesce(c.published_on, r.published_on))
               coalesce(c.published_on, r.published_on) as pub,
               coalesce(c.value, r.value) as value
          from fuel_index_readings r
          left join fuel_index_readings c on c.corrects_id = r.id
         where r.project_id = p_project and r.index_code = 'SEK' and r.corrects_id is null
           and r.period ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
           and coalesce(c.published_on, r.published_on) is not null
         order by coalesce(c.published_on, r.published_on), r.period
      )
      select value, pub into v_val, v_pub
        from pubs
       where pub <= v_day
       order by pub desc
       limit 1;
    end if;

    if v_val is null then
      return jsonb_build_object(
        'avg', null, 'n', v_n, 'days', v_days, 'pubs', v_pubs,
        'fallback_last', false, 'no_readings', true);
    end if;
    v_sum := v_sum + v_val;
    v_n := v_n + 1;
    v_days := v_days || jsonb_build_array(jsonb_build_object(
      'day', v_day, 'value', round(v_val, 2), 'published_on', v_pub));
    if v_pub is not null and not (v_pub::text = any (v_pub_keys)) then
      v_pub_keys := array_append(v_pub_keys, v_pub::text);
      v_pubs := v_pubs || jsonb_build_array(jsonb_build_object(
        'published_on', v_pub, 'value', round(v_val, 2)));
    end if;
  end loop;

  if v_n < 7 then
    return jsonb_build_object(
      'avg', null, 'n', v_n, 'days', v_days, 'pubs', v_pubs,
      'fallback_last', false, 'no_readings', true);
  end if;
  return jsonb_build_object(
    'avg', case when v_max then round(v_sum / v_n, 2) else v_sum / v_n end,
    'n', v_n, 'days', v_days, 'pubs', v_pubs,
    'fallback_last', false);
end $$;

comment on function public.sefs_sek_daily_avg(uuid, date, date) is
  '#563/F7: ≤t43 = D-1300 (publikacja ≤ dzień); t44+ MAX = period=D + korekta.';

-- PLN daily avg (ta sama reguła) — używane gdy avg_days_pln = 7
create or replace function public.sefs_pln_daily_avg(p_project uuid, p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_day date;
  v_val numeric;
  v_pub date;
  v_sum numeric := 0;
  v_n int := 0;
  v_days jsonb := '[]'::jsonb;
  v_pubs jsonb := '[]'::jsonb;
  v_pub_keys text[] := array[]::text[];
begin
  if (exists (
        select 1 from fuel_index_readings r
         where r.project_id = p_project and r.index_code = 'PLN' and r.corrects_id is null
           and r.period ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
           and r.period::date between p_from and p_to
      )) is not true then
    return jsonb_build_object(
      'avg', null, 'n', 0, 'days', '[]'::jsonb, 'pubs', '[]'::jsonb,
      'fallback_last', false, 'no_readings', true);
  end if;

  for v_day in select d::date from generate_series(p_from, p_to, '1 day') d loop
    select public.sefs_reading_effective_value(r.id),
           coalesce(
             (select c.published_on from fuel_index_readings c
               where c.corrects_id = r.id order by c.entered_at desc, c.id desc limit 1),
             r.published_on)
      into v_val, v_pub
      from fuel_index_readings r
     where r.project_id = p_project and r.index_code = 'PLN' and r.corrects_id is null
       and r.period = to_char(v_day, 'YYYY-MM-DD')
     order by r.entered_at desc, r.id desc
     limit 1;

    if v_val is null then
      select public.sefs_reading_effective_value(r.id),
             coalesce(
               (select c.published_on from fuel_index_readings c
                 where c.corrects_id = r.id order by c.entered_at desc, c.id desc limit 1),
               r.published_on)
        into v_val, v_pub
        from fuel_index_readings r
       where r.project_id = p_project and r.index_code = 'PLN' and r.corrects_id is null
         and r.period ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
         and coalesce(
               (select c.published_on from fuel_index_readings c
                 where c.corrects_id = r.id order by c.entered_at desc, c.id desc limit 1),
               r.published_on) <= v_day
       order by coalesce(
                  (select c.published_on from fuel_index_readings c
                    where c.corrects_id = r.id order by c.entered_at desc, c.id desc limit 1),
                  r.published_on) desc,
                r.entered_at desc, r.id desc
       limit 1;
    end if;

    if v_val is null then
      return jsonb_build_object(
        'avg', null, 'n', v_n, 'days', v_days, 'pubs', v_pubs,
        'fallback_last', false, 'no_readings', true);
    end if;
    v_sum := v_sum + v_val;
    v_n := v_n + 1;
    v_days := v_days || jsonb_build_array(jsonb_build_object(
      'day', v_day, 'value', round(v_val, 2), 'published_on', v_pub));
    if v_pub is not null and not (v_pub::text = any (v_pub_keys)) then
      v_pub_keys := array_append(v_pub_keys, v_pub::text);
      v_pubs := v_pubs || jsonb_build_array(jsonb_build_object(
        'published_on', v_pub, 'value', round(v_val, 2)));
    end if;
  end loop;

  if v_n < 7 then
    return jsonb_build_object(
      'avg', null, 'n', v_n, 'days', v_days, 'pubs', v_pubs,
      'fallback_last', false, 'no_readings', true);
  end if;
  return jsonb_build_object(
    'avg', round(v_sum / v_n, 2), 'n', v_n, 'days', v_days, 'pubs', v_pubs,
    'fallback_last', false);
end $$;

revoke all on function public.sefs_pln_daily_avg(uuid, date, date)
  from public, anon, authenticated;
grant execute on function public.sefs_pln_daily_avg(uuid, date, date) to service_role;

comment on function public.sefs_pln_daily_avg(uuid, date, date) is
  '#563: Orlen — 7 cen dziennych (gdy avg_days_pln=7); ta sama reguła korekt co SEK.';

-- sefs_pub_avg: ≤t43 bez zmian kolejności (pub, period) — F7 #579 blokada 2.
-- Efektywna wartość korekty przez left join (jak 0187); nie entered_at desc.
create or replace function public.sefs_pub_avg(p_project uuid, p_code text, p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_avg numeric; v_n int; v_pubs jsonb; v_last record;
begin
  with eff as (
    select coalesce(c.value, r.value) as value,
           coalesce(c.published_on, r.published_on) as pub,
           r.period
      from fuel_index_readings r
      left join fuel_index_readings c on c.corrects_id = r.id
     where r.project_id = p_project and r.index_code = p_code and r.corrects_id is null
       and r.period ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  ), pubs as (
    select distinct on (pub) pub, value from eff
     where pub between p_from and p_to
     order by pub, period
  )
  select avg(value), count(*),
         coalesce(jsonb_agg(jsonb_build_object('published_on', pub, 'value', value) order by pub), '[]'::jsonb)
    into v_avg, v_n, v_pubs from pubs;
  if v_n > 0 then
    return jsonb_build_object(
      'avg', round(v_avg, 2), 'n', v_n, 'pubs', v_pubs, 'fallback_last', false);
  end if;
  if (exists (select 1 from fuel_index_readings r
               where r.project_id = p_project and r.index_code = p_code and r.corrects_id is null
                 and r.period ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                 and r.period::date between p_from and p_to)) is not true then
    return jsonb_build_object('avg', null, 'n', 0, 'pubs', '[]'::jsonb, 'fallback_last', false, 'no_readings', true);
  end if;
  select coalesce(c.value, r.value) as value, coalesce(c.published_on, r.published_on) as pub
    into v_last
    from fuel_index_readings r
    left join fuel_index_readings c on c.corrects_id = r.id
   where r.project_id = p_project and r.index_code = p_code and r.corrects_id is null
     and r.period ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     and coalesce(c.published_on, r.published_on) <= p_to
   order by coalesce(c.published_on, r.published_on) desc, r.period desc
   limit 1;
  if found then
    return jsonb_build_object('avg', v_last.value, 'n', 0,
      'pubs', jsonb_build_array(jsonb_build_object('published_on', v_last.pub, 'value', v_last.value)),
      'fallback_last', true);
  end if;
  return jsonb_build_object('avg', null, 'n', 0, 'pubs', '[]'::jsonb, 'fallback_last', false);
end $$;

-- ---------------------------------------------------------------------
-- 6. sefs_week_calc — PLN 7 dni gdy params.avg_days_pln = 7
-- ---------------------------------------------------------------------
create or replace function public.sefs_week_calc(p_project uuid, p_load_date date, p_today date)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_week_start date; v_week_end date; v_prev_start date; v_prev_end date;
  v_today date := coalesce(p_today, (timezone('Europe/Warsaw', now()))::date);
  s jsonb; p jsonb; v_res jsonb; v_final boolean; v_prog jsonb;
  v_params sefs_parameters%rowtype;
  v_pln_days int;
  v_osek numeric; v_opln numeric; v_oapp numeric; v_onote text;
begin
  if (p_load_date is not null) is not true then
    return jsonb_build_object('ok', false, 'reason', 'NO_LOAD_DATE');
  end if;
  v_week_start := p_load_date - ((extract(isodow from p_load_date)::int) - 1);
  v_week_end := v_week_start + 6;
  v_prev_start := v_week_start - 7;
  v_prev_end := v_week_start - 1;
  v_final := v_today > v_prev_end;

  -- D-1535: nadpisanie po tygodniu ZAŁADUNKU (t40)
  select o.mult_sek, o.mult_pln, o.applied_mult, o.note
    into v_osek, v_opln, v_oapp, v_onote
    from public.sefs_week_overrides o
   where o.week_start = v_week_start;

  select * into v_params from sefs_params_for(p_project, p_load_date);
  v_pln_days := coalesce(v_params.avg_days_pln, 5);

  if v_osek is not null then
    if v_final then
      s := sefs_sek_daily_avg(p_project, v_prev_start, v_prev_end);
      if v_pln_days = 7 then
        p := sefs_pln_daily_avg(p_project, v_prev_start, v_prev_end);
      else
        p := sefs_pub_avg(p_project, 'PLN', v_prev_start, v_prev_end);
      end if;
      if ((s->>'avg') is not null and (p->>'avg') is not null) then
        v_res := sefs_compute_hybrid_sys(p_project, (s->>'avg')::numeric, (p->>'avg')::numeric, p_load_date);
        return v_res || jsonb_build_object(
          'load_week_start', v_week_start, 'load_week_end', v_week_end,
          'prev_week_start', v_prev_start, 'prev_week_end', v_prev_end,
          'n_sek', (s->>'n')::int, 'n_pln', (p->>'n')::int,
          'pubs_sek', s->'pubs', 'pubs_pln', p->'pubs',
          'days_sek', s->'days', 'days_pln', p->'days',
          'fallback_last_sek', coalesce((s->>'fallback_last')::boolean, false),
          'fallback_last_pln', (p->>'fallback_last')::boolean,
          'mult_sek', v_osek::numeric(4,2), 'mult_pln', v_opln::numeric(4,2),
          'applied_mult', v_oapp::numeric(4,2),
          'status', 'OSTATECZNY', 'final', true,
          'owner_override', true, 'owner_note', v_onote,
          'computed_on', v_today
        );
      end if;
    end if;
    return jsonb_build_object(
      'ok', true,
      'mult_sek', v_osek::numeric(4,2), 'mult_pln', v_opln::numeric(4,2),
      'applied_mult', v_oapp::numeric(4,2),
      'load_week_start', v_week_start, 'load_week_end', v_week_end,
      'load_prev_week_start', v_prev_start, 'load_prev_week_end', v_prev_end,
      'status', 'OSTATECZNY', 'final', true,
      'owner_override', true, 'owner_note', v_onote,
      'computed_on', v_today
    );
  end if;

  if v_final is not true then
    v_prog := sefs_last_ostateczny(p_project, v_today);
    return v_prog || jsonb_build_object(
      'load_week_start', v_week_start, 'load_week_end', v_week_end,
      'load_prev_week_start', v_prev_start, 'load_prev_week_end', v_prev_end,
      'status', 'PROGNOZA', 'final', false, 'prognoza', true,
      'computed_on', v_today
    );
  end if;

  s := sefs_sek_daily_avg(p_project, v_prev_start, v_prev_end);
  if v_pln_days = 7 then
    p := sefs_pln_daily_avg(p_project, v_prev_start, v_prev_end);
  else
    p := sefs_pub_avg(p_project, 'PLN', v_prev_start, v_prev_end);
  end if;

  if ((s->>'avg') is not null and (p->>'avg') is not null) is not true then
    return jsonb_build_object(
      'ok', false, 'reason', 'SOURCE_FAILURE',
      'message', 'Brak opublikowanych cen SEK/PLN dla poprzedniego tygodnia — użyj ostatniego mnożnika + ryzyko HHL',
      'prev_week_start', v_prev_start, 'prev_week_end', v_prev_end,
      'n_sek', coalesce((s->>'n')::int, 0), 'n_pln', coalesce((p->>'n')::int, 0),
      'days_sek', coalesce(s->'days', '[]'::jsonb),
      'days_pln', coalesce(p->'days', '[]'::jsonb),
      'status', 'OSTATECZNY');
  end if;

  v_res := sefs_compute_hybrid_sys(p_project, (s->>'avg')::numeric, (p->>'avg')::numeric, p_load_date);
  return v_res || jsonb_build_object(
    'load_week_start', v_week_start, 'load_week_end', v_week_end,
    'prev_week_start', v_prev_start, 'prev_week_end', v_prev_end,
    'n_sek', (s->>'n')::int, 'n_pln', (p->>'n')::int,
    'pubs_sek', s->'pubs', 'pubs_pln', p->'pubs',
    'days_sek', s->'days', 'days_pln', p->'days',
    'fallback_last_sek', coalesce((s->>'fallback_last')::boolean, false),
    'fallback_last_pln', (p->>'fallback_last')::boolean,
    'status', 'OSTATECZNY',
    'final', true,
    'computed_on', v_today
  );
end $$;

comment on function public.sefs_week_calc(uuid, date, date) is
  '#563: SEK 7 dni; PLN 5 publ. (≤t43) lub 7 dni (t44+); lookup MIN/MAX z wersji params.';

-- ---------------------------------------------------------------------
-- 6b. sefs_last_ostateczny — prognoza t45+: PLN 7 dni gdy avg_days_pln=7 (F7 blokada 1)
-- ---------------------------------------------------------------------
create or replace function public.sefs_last_ostateczny(p_project uuid, p_today date)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := coalesce(p_today, (timezone('Europe/Warsaw', now()))::date);
  v_anchor date; v_prev_start date; v_prev_end date;
  s jsonb; p jsonb; v_res jsonb;
  v_i int;
  v_params sefs_parameters%rowtype;
  v_pln_days int;
begin
  v_anchor := v_today - ((extract(isodow from v_today)::int) - 1);
  s := jsonb_build_object('avg', null, 'n', 0);
  p := jsonb_build_object('avg', null, 'n', 0);
  v_prev_start := v_anchor - 7;
  v_prev_end := v_anchor - 1;
  for v_i in 0..51 loop
    v_prev_start := v_anchor - 7 - (v_i * 7);
    v_prev_end := v_anchor - 1 - (v_i * 7);
    select * into v_params from sefs_params_for(p_project, v_prev_end + 1);
    v_pln_days := coalesce(v_params.avg_days_pln, 5);
    s := sefs_sek_daily_avg(p_project, v_prev_start, v_prev_end);
    if v_pln_days = 7 then
      p := sefs_pln_daily_avg(p_project, v_prev_start, v_prev_end);
    else
      p := sefs_pub_avg(p_project, 'PLN', v_prev_start, v_prev_end);
      if (p->>'avg') is null then
        p := sefs_last_published(p_project, 'PLN', v_prev_end);
      end if;
    end if;
    exit when (s->>'avg') is not null and (p->>'avg') is not null;
  end loop;
  if ((s->>'avg') is not null and (p->>'avg') is not null) is not true then
    return jsonb_build_object(
      'ok', false, 'reason', 'SOURCE_FAILURE',
      'message', 'Brak ostatniego OSTATECZNEGO mnożnika (brak publikacji SEK/PLN)',
      'anchor_week_start', v_anchor, 'prev_week_start', v_prev_start, 'prev_week_end', v_prev_end,
      'n_sek', coalesce((s->>'n')::int, 0), 'n_pln', coalesce((p->>'n')::int, 0),
      'status', 'PROGNOZA');
  end if;
  v_res := sefs_compute_hybrid_sys(
    p_project, (s->>'avg')::numeric, (p->>'avg')::numeric, v_prev_end + 1);
  return v_res || jsonb_build_object(
    'anchor_week_start', v_anchor,
    'prev_week_start', v_prev_start, 'prev_week_end', v_prev_end,
    'n_sek', (s->>'n')::int, 'n_pln', (p->>'n')::int,
    'pubs_sek', s->'pubs', 'pubs_pln', p->'pubs',
    'days_sek', s->'days', 'days_pln', p->'days',
    'fallback_last_sek', coalesce((s->>'fallback_last')::boolean, false),
    'fallback_last_pln', coalesce((p->>'fallback_last')::boolean, false),
    'status', 'OSTATECZNY', 'final', true,
    'computed_on', v_today
  );
end $$;
revoke all on function public.sefs_last_ostateczny(uuid, date) from public, anon, authenticated;
grant execute on function public.sefs_last_ostateczny(uuid, date) to service_role;
comment on function public.sefs_last_ostateczny(uuid, date) is
  '#563/F7: kotwica ostatniego zamkniętego; PLN 7 dni gdy params.avg_days_pln=7 (prognoza t45+).';

-- ---------------------------------------------------------------------
-- 7. sefs_last_published — najnowsza efektywna (korekta wygrywa)
-- ---------------------------------------------------------------------
create or replace function public.sefs_last_published(p_project uuid, p_code text, p_to date)
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_build_object(
             'avg', public.sefs_reading_effective_value(r.id),
             'n', 0,
             'pubs', jsonb_build_array(jsonb_build_object(
               'published_on', coalesce(
                 (select c.published_on from fuel_index_readings c
                   where c.corrects_id = r.id order by c.entered_at desc, c.id desc limit 1),
                 r.published_on),
               'value', public.sefs_reading_effective_value(r.id))),
             'fallback_last', true)
      from fuel_index_readings r
     where r.project_id = p_project and r.index_code = p_code and r.corrects_id is null
       and r.period ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       and coalesce(
             (select c.published_on from fuel_index_readings c
               where c.corrects_id = r.id order by c.entered_at desc, c.id desc limit 1),
             r.published_on) <= p_to
     order by coalesce(
                (select c.published_on from fuel_index_readings c
                  where c.corrects_id = r.id order by c.entered_at desc, c.id desc limit 1),
                r.published_on) desc,
              r.entered_at desc, r.id desc
     limit 1),
    jsonb_build_object('avg', null, 'n', 0, 'pubs', '[]'::jsonb, 'fallback_last', false))
$$;
revoke all on function public.sefs_last_published(uuid, text, date)
  from public, anon, authenticated;
grant execute on function public.sefs_last_published(uuid, text, date) to service_role;

-- ---------------------------------------------------------------------
-- 8. sefs_save_parameters — tier_bound / avg_days_pln
-- ---------------------------------------------------------------------
create or replace function public.sefs_save_parameters(p_project uuid, p jsonb)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_ver int;
  v_me uuid;
  v_applies text;
  v_bound text;
  v_days int;
begin
  perform public.assert_not_preview();
  v_applies := coalesce(nullif(trim(p->>'applies_to'), ''), 'BOTH');
  v_bound := coalesce(nullif(btrim(p->>'tier_bound'), ''), 'MIN');
  v_days := coalesce((p->>'avg_days_pln')::int, 5);
  if (is_hhl()) is not true then
    raise exception 'Parametry SEFS zapisuje wyłącznie HHL';
  end if;
  if (sefs_tiers_valid(p->'tiers_sek') and sefs_tiers_valid(p->'tiers_pln')) is not true then
    raise exception 'Tablice mnożników: 1–200 progów {lte, mult}, lte rosnąco, mnożnik 0,5–2';
  end if;
  if (v_applies in ('COST', 'REVENUE', 'BOTH')) is not true then
    raise exception 'Zakres wersji: COST (koszt), REVENUE (przychód) albo BOTH';
  end if;
  if (v_bound in ('MIN', 'MAX')) is not true then
    raise exception 'tier_bound: MIN („od”) albo MAX („do X”)';
  end if;
  if (v_days in (5, 7)) is not true then
    raise exception 'avg_days_pln: 5 (publikacje) albo 7 (ceny dzienne)';
  end if;
  select id into v_me from app_users where auth_id = auth.uid() and active;
  perform pg_advisory_xact_lock(hashtext('sefs_parameters:' || p_project::text));
  select coalesce(max(version), 0) + 1 into v_ver from sefs_parameters where project_id = p_project;
  insert into sefs_parameters (
    project_id, version, valid_from, base_sek, base_pln, index_sek, index_pln,
    source_url_sek, source_url_pln, cycle, tiers_sek, tiers_pln,
    agreed_with_carrier, agreement_ref, note, created_by, applies_to,
    tier_bound, avg_days_pln
  ) values (
    p_project, v_ver, (p->>'valid_from')::date, (p->>'base_sek')::numeric, (p->>'base_pln')::numeric,
    p->>'index_sek', p->>'index_pln', p->>'source_url_sek', p->>'source_url_pln',
    coalesce(p->>'cycle', 'MONTHLY'), p->'tiers_sek', p->'tiers_pln',
    coalesce((p->>'agreed_with_carrier')::boolean, false), nullif(trim(p->>'agreement_ref'), ''),
    nullif(trim(p->>'note'), ''), v_me, v_applies, v_bound, v_days
  );
  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (v_me, 'SEFS_PARAMS_VERSION', 'sefs_parameters', p_project::text || ':v' || v_ver,
          (select to_jsonb(x) - 'id' - 'created_at' - 'created_by' from sefs_parameters x
            where project_id = p_project and version = v_ver - 1),
          (select to_jsonb(x) - 'id' - 'created_at' - 'created_by' from sefs_parameters x
            where project_id = p_project and version = v_ver));
  return v_ver;
end $$;
revoke execute on function public.sefs_save_parameters(uuid, jsonb) from public, anon;
grant execute on function public.sefs_save_parameters(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 9. fuel_se_pl_ingest — późniejszy przebieg z inną ceną; korekta chroniona
-- ---------------------------------------------------------------------
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
  v_pub date;
  v_pri bigint;
  v_pri_val numeric;
  v_pri_pub date;
  v_eff numeric;
  v_eff_pub date;
  v_has_corr boolean;
begin
  perform public.assert_not_preview();
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
    v_pub := case when coalesce(v->>'published_on', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
      then left(v->>'published_on', 10)::date end;
    -- F7 #579 pkt 3: cena „od jutra” — nie obcinaj published_on do dnia odczytu;
    -- period = data obowiązywania (inaczej cena dnia D przesuwa tydzień).
    if v_pub is not null and v_pub > v_date then
      v_period := to_char(v_pub, 'YYYY-MM-DD');
    end if;
    v_note := left(coalesce(nullif(trim(v->>'source_note'), ''), 'automat Watch Tower'), 500);

    -- Najnowszy odczyt bazowy dnia (bez korekt).
    select r.id, r.value, r.published_on
      into v_pri, v_pri_val, v_pri_pub
      from fuel_index_readings r
     where r.project_id = p_project and r.index_code = v_code and r.period = v_period
       and r.corrects_id is null
     order by r.entered_at desc, r.id desc
     limit 1;

    if v_pri is not null then
      -- Efektywna cena inline (bez osobnego RPC — ten sam TX / ta sama widoczność).
      v_eff := coalesce(
        (select c.value from fuel_index_readings c
          where c.corrects_id = v_pri
          order by c.entered_at desc, c.id desc limit 1),
        v_pri_val);
      select coalesce(
               (select c.published_on from fuel_index_readings c
                 where c.corrects_id = v_pri order by c.entered_at desc, c.id desc limit 1),
               v_pri_pub)
        into v_eff_pub;
      v_has_corr := exists (
        select 1 from fuel_index_readings c where c.corrects_id = v_pri);

      -- Ta sama efektywna cena → pomiń (powtórka). published_on tylko gdy podany w payload.
      if round(v_eff, 4) = round(v_val, 4)
         and (v_pub is null or v_eff_pub is not distinct from v_pub) then
        v_skip := v_skip + 1;
        continue;
      end if;

      -- Ręczna korekta: automat z wartością sprzed korekty nie cofa korekty.
      if v_has_corr and round(v_pri_val, 4) = round(v_val, 4) then
        v_skip := v_skip + 1;
        continue;
      end if;
    end if;

    insert into fuel_index_readings (
      project_id, index_code, period, reading_date, value, source_url, source_note, published_on
    ) values (p_project, v_code, v_period, v_date, v_val, v_url, v_note, v_pub)
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

comment on function public.fuel_se_pl_ingest(uuid, jsonb) is
  '#563: późniejszy przebieg z inną ceną/published_on zapisuje nowy odczyt; korekta chroniona przed tym samym odczytem źródła.';

-- ---------------------------------------------------------------------
-- 10. Nowa wersja parametrów od 26.10.2026 (t44+)
--     Tabele z wersji obowiązującej 26.10 (sefs_params_for), nie z max(version).
-- ---------------------------------------------------------------------
do $$
declare
  r sefs_parameters%rowtype;
  v_proj uuid;
  v_next int;
begin
  for v_proj in select distinct project_id from sefs_parameters loop
    if exists (
      select 1 from sefs_parameters x
       where x.project_id = v_proj
         and x.tier_bound = 'MAX'
         and x.valid_from >= date '2026-10-26'
    ) then
      continue;
    end if;
    select * into r from sefs_params_for(v_proj, date '2026-10-26');
    if (r.id is not null) is not true then
      continue;
    end if;
    select coalesce(max(version), 0) + 1 into v_next
      from sefs_parameters where project_id = v_proj;
    insert into sefs_parameters (
      project_id, version, valid_from, rule, base_sek, base_pln,
      index_sek, index_pln, source_url_sek, source_url_pln, cycle,
      tiers_sek, tiers_pln, agreed_with_carrier, agreement_ref, note,
      created_by, applies_to, tier_bound, avg_days_pln
    ) values (
      r.project_id, v_next, date '2026-10-26', r.rule, r.base_sek, r.base_pln,
      r.index_sek, r.index_pln, r.source_url_sek, r.source_url_pln, r.cycle,
      r.tiers_sek, r.tiers_pln, r.agreed_with_carrier, r.agreement_ref,
      '#563 D-1506: od t44 próg „do X” (MAX) + Orlen średnia 7 dni; tabele z wersji na 26.10.',
      r.created_by, r.applies_to, 'MAX', 7
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 11. Przeliczenie migawek załadunek ≥ 2026-10-26 (t44+)
--     Niezafakturowane: zdejmij OSTATECZNY → load_price_compute (MAX ×1,14).
--     Faktury i t ≤ 43 — bez zmian (D-1506; SEFS_INVOICE_DIFF gdy faktura ≥26.10
--     ma inny mnożnik niż wyliczenie).
-- ---------------------------------------------------------------------
do $$
declare
  r record;
  inv record;
  v_n int := 0;
  v_inv int := 0;
  v_fuel date;
  v_before jsonb := '[]'::jsonb;
  v_after jsonb := '[]'::jsonb;
  v_c_sek numeric; v_c_pln numeric; v_c_app numeric; v_c_baf numeric;
  v_c_base numeric; v_c_total numeric;
  v_r_sek numeric; v_r_pln numeric; v_r_app numeric; v_r_baf numeric;
  v_r_base numeric; v_r_total numeric;
  v_w jsonb;
  v_new numeric;
  v_old numeric;
  v_week text;
  v_prev_quiet text;
begin
  perform set_config('tower.audit_source', 'migracja 0310 (#563 t44 migawki)', true);
  v_prev_quiet := current_setting('tower.bulk_quiet', true);
  perform set_config('tower.bulk_quiet', 'on', true);

  for r in
    select l.id, l.project_id, l.hhl_order_no, l.order_no, l.plan_load_date,
           c.fuel_mult_sek as c_sek, c.fuel_mult_pln as c_pln, c.fuel_applied_mult as c_app,
           c.baf_amount as c_baf, c.base_amount as c_base, c.total_amount as c_total,
           c.invoiced_total_eur as c_inv, c.fuel_status as c_st,
           rv.fuel_mult_sek as r_sek, rv.fuel_mult_pln as r_pln, rv.fuel_applied_mult as r_app,
           rv.baf_amount as r_baf, rv.base_amount as r_base, rv.total_amount as r_total,
           rv.invoiced_total_eur as r_inv, rv.fuel_status as r_st
      from loads l
      left join load_cost c on c.load_id = l.id
      left join load_revenue rv on rv.load_id = l.id
     where coalesce(public.fuel_load_date(l.id), l.plan_load_date) >= date '2026-10-26'
       and (
         (c.load_id is not null and c.invoiced_total_eur is null and c.fuel_applied_mult is not null)
         or (rv.load_id is not null and rv.invoiced_total_eur is null and rv.fuel_applied_mult is not null)
       )
  loop
    v_fuel := coalesce(public.fuel_load_date(r.id), r.plan_load_date);
    v_before := v_before || jsonb_build_array(jsonb_build_object(
      'load_id', r.id,
      'hhl_order_no', r.hhl_order_no,
      'order_no', r.order_no,
      'fuel_date', v_fuel,
      'cost', jsonb_build_object(
        'mult_sek', r.c_sek, 'mult_pln', r.c_pln, 'applied', r.c_app,
        'baf', r.c_baf, 'base_amount', r.c_base, 'total_amount', r.c_total,
        'status', r.c_st),
      'revenue', jsonb_build_object(
        'mult_sek', r.r_sek, 'mult_pln', r.r_pln, 'applied', r.r_app,
        'baf', r.r_baf, 'base_amount', r.r_base, 'total_amount', r.r_total,
        'status', r.r_st)
    ));

    if r.c_inv is null and r.c_app is not null then
      update load_cost set fuel_status = 'PROGNOZA'
       where load_id = r.id and invoiced_total_eur is null and fuel_status = 'OSTATECZNY';
    end if;
    if r.r_inv is null and r.r_app is not null then
      update load_revenue set fuel_status = 'PROGNOZA'
       where load_id = r.id and invoiced_total_eur is null and fuel_status = 'OSTATECZNY';
    end if;

    perform public.load_price_compute(r.id);

    select c.fuel_mult_sek, c.fuel_mult_pln, c.fuel_applied_mult, c.baf_amount,
           c.base_amount, c.total_amount,
           rv.fuel_mult_sek, rv.fuel_mult_pln, rv.fuel_applied_mult, rv.baf_amount,
           rv.base_amount, rv.total_amount
      into v_c_sek, v_c_pln, v_c_app, v_c_baf, v_c_base, v_c_total,
           v_r_sek, v_r_pln, v_r_app, v_r_baf, v_r_base, v_r_total
      from loads l
      left join load_cost c on c.load_id = l.id
      left join load_revenue rv on rv.load_id = l.id
     where l.id = r.id;

    v_after := v_after || jsonb_build_array(jsonb_build_object(
      'load_id', r.id,
      'hhl_order_no', r.hhl_order_no,
      'order_no', r.order_no,
      'cost', jsonb_build_object(
        'mult_sek', v_c_sek, 'mult_pln', v_c_pln, 'applied', v_c_app, 'baf', v_c_baf,
        'base_amount', v_c_base, 'total_amount', v_c_total),
      'revenue', jsonb_build_object(
        'mult_sek', v_r_sek, 'mult_pln', v_r_pln, 'applied', v_r_app, 'baf', v_r_baf,
        'base_amount', v_r_base, 'total_amount', v_r_total)
    ));
    v_n := v_n + 1;
  end loop;

  -- Faktury z załadunkiem ≥ 26.10 i innym mnożnikiem → sprawa (kwoty faktury nietknięte).
  -- Tylko ≥26.10 — t≤43 bez skanu (D-1506).
  for inv in
    select l.id, l.project_id, l.hhl_order_no, l.order_no,
           coalesce(c.fuel_applied_mult, rv.fuel_applied_mult) as old_mult
      from loads l
      left join load_cost c on c.load_id = l.id and c.invoiced_total_eur is not null
      left join load_revenue rv on rv.load_id = l.id and rv.invoiced_total_eur is not null
     where coalesce(public.fuel_load_date(l.id), l.plan_load_date) >= date '2026-10-26'
       and (c.load_id is not null or rv.load_id is not null)
  loop
    v_fuel := public.fuel_load_date(inv.id);
    if v_fuel is null then continue; end if;
    v_w := public.sefs_week_calc(inv.project_id, v_fuel);
    if coalesce(v_w->>'ok', '') <> 'true' then continue; end if;
    v_new := (v_w->>'applied_mult')::numeric;
    v_old := inv.old_mult;
    if v_old is null or v_new is null or v_old = v_new then continue; end if;
    v_week := ltrim(to_char(v_fuel - ((extract(isodow from v_fuel)::int) - 1), 'IW'), '0');
    perform public.decision_open_from_event(
      inv.project_id, 'SEFS_INVOICE_DIFF',
      '563:invoice:' || inv.id::text,
      format(
        'Opłata paliwowa na fakturze różni się od wyliczenia (t%s: ×%s → ×%s)',
        v_week,
        trim(to_char(v_old, '990.99')),
        trim(to_char(v_new, '990.99'))
      ),
      jsonb_build_object(
        'load_id', inv.id,
        'hhl_order_no', inv.hhl_order_no,
        'order_no', inv.order_no,
        'old_mult', v_old,
        'new_mult', v_new,
        'load_date', v_fuel,
        'source', '0310_563'
      ),
      inv.id, null
    );
    v_inv := v_inv + 1;
  end loop;

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (
    null, 'FUEL_RECALC_T44_563', 'loads', '0310-563-t44',
    jsonb_build_object(
      'recomputed', v_n,
      'from_date', '2026-10-26',
      'invoice_cases', v_inv,
      'before', v_before,
      'after', v_after,
      'note', '#563 D-1506: migawki ≥26.10; t≤43 i faktury bez zmian kwot'
    )
  );

  perform set_config('tower.bulk_quiet', coalesce(nullif(v_prev_quiet, ''), 'off'), true);
end $$;

-- ---------------------------------------------------------------------
-- 12. #563 pkt 3: korekta w zamkniętym tygodniu → sprawa HHL, bez cichego
--     przeliczenia migawek (OSTATECZNY zostaje; decyzja przed APPLY).
-- ---------------------------------------------------------------------
insert into public.decision_types (
  code, title_key, decider_role, options, due_hours, due_note, severity_default, sort_order
) values (
  'SEFS_WEEK_CORR',
  'dec_type_SEFS_WEEK_CORR',
  'HHL',
  '[{"code":"ACCEPT","label_key":"dec_opt_ACCEPT","requires_comment":true,"effect":"ACCEPT"},{"code":"DISPUTE","label_key":"dec_opt_DISPUTE","requires_comment":true,"effect":"DISPUTE"}]'::jsonb,
  168,
  null,
  'WARNING',
  17
)
on conflict (code) do update set
  title_key = excluded.title_key,
  decider_role = excluded.decider_role,
  options = excluded.options,
  due_hours = excluded.due_hours,
  severity_default = excluded.severity_default,
  sort_order = excluded.sort_order,
  active = true;

create or replace function public.sefs_note_closed_week_on_correction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period date;
  v_ind_start date;
  v_ind_end date;
  v_load_start date;
  v_load_end date;
  v_today date := (timezone('Europe/Warsaw', now()))::date;
  v_old numeric;
  v_new numeric;
  v_w jsonb;
  v_n int;
  v_week text;
  v_title text;
  v_key text;
  v_id uuid;
  v_st decision_status;
  v_detail jsonb;
  v_agree boolean;
begin
  if (new.corrects_id is not null) is not true then
    return new;
  end if;
  if (new.period ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') is not true then
    return new;
  end if;
  v_period := new.period::date;
  v_ind_start := v_period - ((extract(isodow from v_period)::int) - 1);
  v_ind_end := v_ind_start + 6;
  -- Tydzień wskaźników musi być już zamknięty (po niedzieli wskaźników).
  if (v_today > v_ind_end) is not true then
    return new;
  end if;
  -- Transporty biorą ten tydzień jako „poprzedni” (załadunek pn–nd tydzień później).
  v_load_start := v_ind_start + 7;
  v_load_end := v_load_start + 6;

  select count(distinct l.id)::int,
         min(coalesce(c.fuel_applied_mult, rv.fuel_applied_mult))
    into v_n, v_old
    from loads l
    left join load_cost c
      on c.load_id = l.id
     and c.fuel_status = 'OSTATECZNY'
     and c.fuel_applied_mult is not null
     and c.invoiced_total_eur is null
    left join load_revenue rv
      on rv.load_id = l.id
     and rv.fuel_status = 'OSTATECZNY'
     and rv.fuel_applied_mult is not null
     and rv.invoiced_total_eur is null
   where l.project_id = new.project_id
     and l.status is distinct from 'CANCELLED'
     and public.fuel_load_date(l.id) between v_load_start and v_load_end
     and (c.load_id is not null or rv.load_id is not null);

  if (coalesce(v_n, 0) > 0 and v_old is not null) is not true then
    return new;
  end if;

  v_w := public.sefs_week_calc(new.project_id, v_load_start, v_today);
  if coalesce(v_w->>'ok', '') <> 'true' then
    return new;
  end if;
  v_new := (v_w->>'applied_mult')::numeric;
  if v_new is null then
    return new;
  end if;

  v_key := '563:fuel-corr:' || new.project_id::text || ':' || v_ind_start::text;
  v_agree := round(v_old, 4) = round(v_new, 4);
  v_week := ltrim(to_char(v_load_start, 'IW'), '0');
  v_title := format(
    'Korekta ceny paliwa zmienia mnożnik tygodnia %s: było ×%s, jest ×%s — %s transportów',
    v_week,
    trim(to_char(v_old, '990.99')),
    trim(to_char(v_new, '990.99')),
    v_n::text
  );
  v_detail := jsonb_build_object(
    'ind_week_start', v_ind_start,
    'ind_week_end', v_ind_end,
    'load_week_start', v_load_start,
    'load_week_end', v_load_end,
    'old_mult', v_old,
    'new_mult', v_new,
    'n_loads', v_n,
    'index_code', new.index_code,
    'period', new.period,
    'reading_id', new.id,
    'corrects_id', new.corrects_id,
    'source', '0310_563',
    'event_key', v_key
  );

  select d.id, d.status into v_id, v_st
    from decisions d
   where d.detail->>'event_key' = v_key
   order by d.created_at desc, d.id desc
   limit 1;

  -- Powrót do zgodności z migawką → zamknij otwartą sprawę (F7 #579 r2 pkt 2).
  if v_agree then
    if v_id is not null and v_st in ('NEW', 'ASSIGNED', 'SNOOZED') then
      update decisions
         set status = 'EXPIRED',
             expired_reason = format(
               'Korekta przywróciła mnożnik ×%s (zgodny z migawką) — sprawa zamknięta automatycznie',
               trim(to_char(v_old, '990.99'))),
             title = v_title,
             detail = coalesce(detail, '{}'::jsonb) || v_detail
               || jsonb_build_object('closed_by', 'auto_agree', 'closed_at', now()),
             updated_at = now()
       where id = v_id;
      insert into decision_events (decision_id, actor_id, action, payload)
      values (
        v_id, null, 'EXPIRE',
        jsonb_build_object(
          'reason', 'auto_agree',
          'old_mult', v_old, 'new_mult', v_new,
          'reading_id', new.id, 'event_key', v_key
        )
      );
    end if;
    return new;
  end if;

  -- Inny mnożnik niż migawka: otwórz / zaktualizuj / wznów (F7 #579 r2 pkt 2).
  -- F7 #579 r4: UPDATE + zdarzenie tylko gdy new_mult ≠ poprzedni w sprawie
  -- (kolejna korekta bez zmiany applied nie spamuje UPDATE).
  if v_id is not null and v_st in ('NEW', 'ASSIGNED', 'SNOOZED') then
    if exists (
      select 1 from public.decisions d
       where d.id = v_id
         and round((d.detail->>'new_mult')::numeric, 4)
             is not distinct from round(v_new, 4)
    ) then
      return new;
    end if;
    update decisions
       set title = v_title,
           detail = coalesce(detail, '{}'::jsonb) || v_detail,
           updated_at = now()
     where id = v_id;
    insert into decision_events (decision_id, actor_id, action, payload)
    values (
      v_id, null, 'UPDATE',
      jsonb_build_object(
        'old_mult', v_old, 'new_mult', v_new, 'n_loads', v_n,
        'reading_id', new.id, 'event_key', v_key
      )
    );
  elsif v_id is not null and v_st in ('RESOLVED', 'EXPIRED') then
    update decisions
       set status = 'NEW',
           resolved_at = null,
           resolved_by = null,
           resolution_code = null,
           resolution_note = null,
           expired_reason = null,
           title = v_title,
           detail = coalesce(detail, '{}'::jsonb) || v_detail
             || jsonb_build_object('reopened_by', 'correction', 'reopened_at', now()),
           updated_at = now()
     where id = v_id;
    insert into decision_events (decision_id, actor_id, action, payload)
    values (
      v_id, null, 'OPEN',
      jsonb_build_object(
        'reopen', true,
        'old_mult', v_old, 'new_mult', v_new,
        'reading_id', new.id, 'event_key', v_key
      )
    );
  else
    perform public.decision_open_from_event(
      new.project_id,
      'SEFS_WEEK_CORR',
      v_key,
      v_title,
      v_detail - 'event_key',
      null,
      null
    );
  end if;
  return new;
end $$;

revoke all on function public.sefs_note_closed_week_on_correction() from public, anon, authenticated;

drop trigger if exists trg_fuel_correction_closed_week on public.fuel_index_readings;
create trigger trg_fuel_correction_closed_week
  after insert on public.fuel_index_readings
  for each row
  when (new.corrects_id is not null)
  execute function public.sefs_note_closed_week_on_correction();

comment on function public.sefs_note_closed_week_on_correction() is
  '#563/F7 r2+r4: zamknięty tydzień → SEFS_WEEK_CORR (tylko HHL); kolejna korekta UPDATE tylko gdy new_mult się zmienia / zgodność → EXPIRED; bez zmiany mnożnika względem migawki i w tygodniu otwartym — nic.';

-- F7 #579 r2 pkt 1: SEFS_WEEK_CORR (load_id null, decider HHL) — tylko HHL; SCX/KSH nie widzą.
drop policy if exists decisions_read on public.decisions;
create policy decisions_read on public.decisions for select to authenticated using (
  current_app_user_id() is not null
  and (
    is_hhl()
    or (
      current_org_kind() = 'CARRIER'
      and decisions.type_code is distinct from 'SEFS_WEEK_CORR'
      and exists (
        select 1 from decision_types t
         where t.code = decisions.type_code
           and t.decider_role in ('CARRIER', 'HHL')
           and (
             (decisions.load_id is null
              and exists (
                select 1 from loads l
                 where l.project_id = decisions.project_id
                   and l.carrier_org_id = current_org_id()))
             or exists (
               select 1 from loads l
                where l.id = decisions.load_id
                  and l.carrier_org_id = current_org_id()))))
    or (
      current_org_kind() = 'CLIENT'
      and exists (
        select 1 from decision_types t
         where t.code = decisions.type_code
           and t.decider_role = 'CLIENT'
           and exists (
             select 1 from projects p
              where p.id = decisions.project_id
                and p.client_org_id = current_org_id())))
  )
);

commit;
