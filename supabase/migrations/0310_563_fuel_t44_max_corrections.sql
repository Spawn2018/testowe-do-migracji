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
-- 5. OKQ8: średnia 7 dni — korekta wygrywa; cena dnia z period=D albo last≤D
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
begin
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
    -- Najpierw odczyt z period = dzień (efektywna wartość: korekta > odczyt).
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
      -- Brak odczytu z D → ostatnia efektywna publikacja ≤ D
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

comment on function public.sefs_sek_daily_avg(uuid, date, date) is
  '#563: OKQ8 — 7 cen dziennych; efektywna = najnowsza korekta; avg zaokrąglona do 0,01.';

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

-- sefs_pub_avg: przy distinct on wybierz najnowszą korektę (entered_at), nie najwcześniejszy period
create or replace function public.sefs_pub_avg(p_project uuid, p_code text, p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_avg numeric; v_n int; v_pubs jsonb; v_last record;
begin
  with base as (
    select r.id,
           public.sefs_reading_effective_value(r.id) as value,
           coalesce(
             (select c.published_on from fuel_index_readings c
               where c.corrects_id = r.id order by c.entered_at desc, c.id desc limit 1),
             r.published_on) as pub,
           r.entered_at
      from fuel_index_readings r
     where r.project_id = p_project and r.index_code = p_code and r.corrects_id is null
       and r.period ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  ), pubs as (
    select distinct on (pub) pub, value
      from base
     where pub between p_from and p_to
     order by pub, entered_at desc, id desc
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
  select public.sefs_reading_effective_value(r.id) as value,
         coalesce(
           (select c.published_on from fuel_index_readings c
             where c.corrects_id = r.id order by c.entered_at desc, c.id desc limit 1),
           r.published_on) as pub
    into v_last
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
    if v_pub is not null and v_pub > v_date then v_pub := v_date; end if;
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
-- ---------------------------------------------------------------------
do $$
declare
  r record;
  v_next int;
begin
  for r in
    select distinct on (project_id) *
      from sefs_parameters
     order by project_id, version desc
  loop
    if exists (
      select 1 from sefs_parameters x
       where x.project_id = r.project_id
         and x.tier_bound = 'MAX'
         and x.valid_from >= date '2026-10-26'
    ) then
      continue;
    end if;
    v_next := r.version + 1;
    insert into sefs_parameters (
      project_id, version, valid_from, rule, base_sek, base_pln,
      index_sek, index_pln, source_url_sek, source_url_pln, cycle,
      tiers_sek, tiers_pln, agreed_with_carrier, agreement_ref, note,
      created_by, applies_to, tier_bound, avg_days_pln
    ) values (
      r.project_id, v_next, date '2026-10-26', r.rule, r.base_sek, r.base_pln,
      r.index_sek, r.index_pln, r.source_url_sek, r.source_url_pln, r.cycle,
      r.tiers_sek, r.tiers_pln, r.agreed_with_carrier, r.agreement_ref,
      '#563 D-1506: od t44 próg „do X” (MAX) + Orlen średnia 7 dni; tabele bez zmian.',
      r.created_by, r.applies_to, 'MAX', 7
    );
  end loop;
end $$;

commit;
