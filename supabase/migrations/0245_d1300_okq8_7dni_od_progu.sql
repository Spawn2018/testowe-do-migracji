-- 0245 — D-1300 / D-1322 (#359): OKQ8 średnia 7 dni pn–nd + obie tabele „od progu”.
-- 1) sefs_lookup_mult: mnożnik = wiersz o najwyższym progu ≤ średnia (pole lte = próg „od”).
-- 2) over_table_*: od ostatniego progu + krok (SEK 0,30 / PLN 0,10).
-- 3) OKQ8: średnia z 7 cen dziennych (cena dnia = ostatnia publikacja ≤ dzień); n_sek=7 + days_sek.
-- 4) Orlen: bez zmian — średnia z publikacji w tygodniu (wt–sob w praktyce).
-- 5) Przeliczenie niezafakturowanych; przy fakturze z innym mnożnikiem — sprawa SEFS_INVOICE_DIFF.

-- ---------------------------------------------------------------------
-- 1. Lookup „od progu”
-- ---------------------------------------------------------------------
create or replace function public.sefs_lookup_mult(p_price numeric, p_tiers jsonb)
returns numeric
language plpgsql immutable set search_path = public as $$
declare
  v_mult numeric;
begin
  -- D-1322: lte = dolna granica przedziału („od”); najwyższy próg ≤ cena.
  if (jsonb_typeof(p_tiers) = 'array' and jsonb_array_length(p_tiers) > 0) is not true then
    return 1;
  end if;
  if p_price is null then
    return 1;
  end if;
  select (t->>'mult')::numeric into v_mult
    from jsonb_array_elements(p_tiers) t
   where (t->>'lte')::numeric <= p_price
   order by (t->>'lte')::numeric desc
   limit 1;
  if found then
    return v_mult;
  end if;
  -- poniżej pierwszego progu → pierwszy wiersz
  select (t->>'mult')::numeric into v_mult
    from jsonb_array_elements(p_tiers) t
   order by (t->>'lte')::numeric asc
   limit 1;
  return coalesce(v_mult, 1);
end $$;
comment on function public.sefs_lookup_mult(numeric, jsonb) is
  'D-1322: mnożnik z wiersza o najwyższym progu lte ≤ cena (odczyt „od progu”).';

-- ---------------------------------------------------------------------
-- 2. Hybrid + over_table z krokiem
-- ---------------------------------------------------------------------
create or replace function public.sefs_compute_hybrid_sys(p_project uuid, p_avg_sek numeric, p_avg_pln numeric, p_ref_date date)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  p sefs_parameters%rowtype;
  v_sek numeric; v_pln numeric; v_app numeric;
  v_over_sek boolean := false; v_over_pln boolean := false;
  v_max_sek numeric; v_max_pln numeric;
  v_step_sek numeric := 0.30; v_step_pln numeric := 0.10;
begin
  select * into p from sefs_params_for(p_project, p_ref_date);
  if (p.id is not null) is not true then
    return jsonb_build_object('ok', false, 'reason', 'NO_SEFS_PARAMS',
      'message', 'Brak parametrów SEFS obowiązujących w tygodniu załadunku — wycena paliwowa wstrzymana');
  end if;
  select max((t->>'lte')::numeric) into v_max_sek from jsonb_array_elements(p.tiers_sek) t;
  select max((t->>'lte')::numeric) into v_max_pln from jsonb_array_elements(p.tiers_pln) t;
  -- D-1322: ryzyko od ostatniego progu + krok w górę
  if p_avg_sek is not null and v_max_sek is not null
     and round(p_avg_sek, 2) >= v_max_sek + v_step_sek then
    v_over_sek := true;
  end if;
  if p_avg_pln is not null and v_max_pln is not null
     and round(p_avg_pln, 2) >= v_max_pln + v_step_pln then
    v_over_pln := true;
  end if;
  v_sek := sefs_lookup_mult(round(p_avg_sek::numeric, 2), p.tiers_sek);
  v_pln := sefs_lookup_mult(round(p_avg_pln::numeric, 2), p.tiers_pln);
  v_app := least(v_sek, v_pln);
  return jsonb_build_object(
    'ok', true,
    'avg_sek', round(p_avg_sek::numeric, 2),
    'avg_pln', round(p_avg_pln::numeric, 2),
    'mult_sek', v_sek, 'mult_pln', v_pln, 'applied_mult', v_app,
    'over_table_sek', v_over_sek, 'over_table_pln', v_over_pln,
    'params_version', p.version, 'params_valid_from', p.valid_from,
    'index_sek', p.index_sek, 'index_pln', p.index_pln,
    'cycle', p.cycle
  );
end $$;

-- 0155: cienka nakładka HHL → sys (parametry przez sefs_params_for / dziś).
create or replace function public.sefs_compute_hybrid(p_project uuid, p_avg_sek numeric, p_avg_pln numeric)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if (is_hhl()) is not true then
    raise exception 'SEFS — wyłącznie HHL' using errcode = '42501';
  end if;
  return sefs_compute_hybrid_sys(
    p_project, p_avg_sek, p_avg_pln,
    (timezone('Europe/Warsaw', now()))::date);
end $$;

-- ---------------------------------------------------------------------
-- 3. OKQ8: średnia 7 cen dziennych
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
  v_any_in_week boolean := false;
begin
  -- D-1300: cena dnia = ostatnia publikacja OKQ8 (published_on) ≤ dzień;
  -- F7: bez żadnej publikacji w pn–nd tygodnia → no_readings (nie ciągnąć cicho całego tygodnia ze starej ceny).
  for v_day in select d::date from generate_series(p_from, p_to, '1 day') d loop
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
    if v_val is null then
      return jsonb_build_object(
        'avg', null, 'n', v_n, 'days', v_days, 'pubs', v_pubs,
        'fallback_last', false, 'no_readings', true);
    end if;
    if v_pub >= p_from and v_pub <= p_to then
      v_any_in_week := true;
    end if;
    v_sum := v_sum + v_val;
    v_n := v_n + 1;
    v_days := v_days || jsonb_build_array(jsonb_build_object(
      'day', v_day, 'value', v_val, 'published_on', v_pub));
    if v_pub is not null and not (v_pub::text = any (v_pub_keys)) then
      v_pub_keys := array_append(v_pub_keys, v_pub::text);
      v_pubs := v_pubs || jsonb_build_array(jsonb_build_object(
        'published_on', v_pub, 'value', v_val));
    end if;
  end loop;
  if v_n < 7 or v_any_in_week is not true then
    return jsonb_build_object(
      'avg', null, 'n', v_n, 'days', v_days, 'pubs', v_pubs,
      'fallback_last', false, 'no_readings', true);
  end if;
  return jsonb_build_object(
    'avg', v_sum / v_n, 'n', v_n, 'days', v_days, 'pubs', v_pubs,
    'fallback_last', false);
end $$;
revoke all on function public.sefs_sek_daily_avg(uuid, date, date) from public, anon, authenticated;
comment on function public.sefs_sek_daily_avg(uuid, date, date) is
  'D-1300: OKQ8 — średnia z 7 cen dziennych pn–nd (cena dnia = ostatnia publikacja ≤ dzień).';

-- ---------------------------------------------------------------------
-- 4. Tydzień / prognoza — SEK z daily avg
-- ---------------------------------------------------------------------
create or replace function public.sefs_last_ostateczny(p_project uuid, p_today date)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := coalesce(p_today, (timezone('Europe/Warsaw', now()))::date);
  v_anchor date; v_prev_start date; v_prev_end date;
  s jsonb; p jsonb; v_res jsonb;
  v_i int;
begin
  -- Kotwica = poniedziałek bieżącego tygodnia; szukamy wstecz zamkniętego tygodnia
  -- z publikacją OKQ8 w pn–nd (F7: bez cichego przeciągania). PLN: pub_avg + last_published.
  v_anchor := v_today - ((extract(isodow from v_today)::int) - 1);
  s := jsonb_build_object('avg', null, 'n', 0);
  p := jsonb_build_object('avg', null, 'n', 0);
  v_prev_start := v_anchor - 7;
  v_prev_end := v_anchor - 1;
  for v_i in 0..51 loop
    v_prev_start := v_anchor - 7 - (v_i * 7);
    v_prev_end := v_anchor - 1 - (v_i * 7);
    s := sefs_sek_daily_avg(p_project, v_prev_start, v_prev_end);
    p := sefs_pub_avg(p_project, 'PLN', v_prev_start, v_prev_end);
    if (p->>'avg') is null then
      p := sefs_last_published(p_project, 'PLN', v_prev_end);
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
  -- parametry jak dla poniedziałku tygodnia załadunku odpowiadającego znalezionemu prev
  v_res := sefs_compute_hybrid_sys(
    p_project, (s->>'avg')::numeric, (p->>'avg')::numeric, v_prev_end + 1);
  return v_res || jsonb_build_object(
    'anchor_week_start', v_anchor,
    'prev_week_start', v_prev_start, 'prev_week_end', v_prev_end,
    'n_sek', (s->>'n')::int, 'n_pln', (p->>'n')::int,
    'pubs_sek', s->'pubs', 'pubs_pln', p->'pubs',
    'days_sek', s->'days',
    'fallback_last_sek', coalesce((s->>'fallback_last')::boolean, false),
    'fallback_last_pln', (p->>'fallback_last')::boolean,
    'status', 'PROGNOZA', 'final', false,
    'prognoza', true, 'computed_on', v_today
  );
end $$;

create or replace function public.sefs_week_calc(p_project uuid, p_load_date date, p_today date)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_week_start date; v_week_end date; v_prev_start date; v_prev_end date;
  v_today date := coalesce(p_today, (timezone('Europe/Warsaw', now()))::date);
  s jsonb; p jsonb; v_res jsonb; v_final boolean; v_prog jsonb;
begin
  if (p_load_date is not null) is not true then
    return jsonb_build_object('ok', false, 'reason', 'NO_LOAD_DATE');
  end if;
  v_week_start := p_load_date - ((extract(isodow from p_load_date)::int) - 1);
  v_week_end := v_week_start + 6;
  v_prev_start := v_week_start - 7;
  v_prev_end := v_week_start - 1;
  v_final := v_today > v_prev_end;

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
  p := sefs_pub_avg(p_project, 'PLN', v_prev_start, v_prev_end);

  if ((s->>'avg') is not null and (p->>'avg') is not null) is not true then
    return jsonb_build_object(
      'ok', false, 'reason', 'SOURCE_FAILURE',
      'message', 'Brak opublikowanych cen SEK/PLN dla poprzedniego tygodnia — użyj ostatniego mnożnika + ryzyko HHL',
      'prev_week_start', v_prev_start, 'prev_week_end', v_prev_end,
      'n_sek', coalesce((s->>'n')::int, 0), 'n_pln', coalesce((p->>'n')::int, 0),
      'days_sek', coalesce(s->'days', '[]'::jsonb),
      'status', 'OSTATECZNY');
  end if;

  v_res := sefs_compute_hybrid_sys(p_project, (s->>'avg')::numeric, (p->>'avg')::numeric, p_load_date);
  return v_res || jsonb_build_object(
    'load_week_start', v_week_start, 'load_week_end', v_week_end,
    'prev_week_start', v_prev_start, 'prev_week_end', v_prev_end,
    'n_sek', (s->>'n')::int, 'n_pln', (p->>'n')::int,
    'pubs_sek', s->'pubs', 'pubs_pln', p->'pubs',
    'days_sek', s->'days',
    'fallback_last_sek', coalesce((s->>'fallback_last')::boolean, false),
    'fallback_last_pln', (p->>'fallback_last')::boolean,
    'status', 'OSTATECZNY',
    'final', true,
    'computed_on', v_today
  );
end $$;
comment on function public.sefs_week_calc(uuid, date) is
  'D-1300/D-1322: OKQ8 = średnia 7 cen dziennych; Orlen = publikacje; mnożnik „od progu”; inaczej PROGNOZA = ostatni OSTATECZNY.';

-- l1b_sefs_note: zostaje wersja z 0230 (straż SOURCE przy PROGNOZA + ltrim numeru tygodnia).
-- over_table z krokiem jest w sefs_compute_hybrid_sys → sefs_week_calc.

-- ---------------------------------------------------------------------
-- 5. Sprawa przy fakturze z innym mnożnikiem (bez autozmiany faktur)
-- ---------------------------------------------------------------------
create or replace function public.sefs_scan_invoice_mult_diff()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_inv int := 0;
  v_w jsonb;
  v_fuel date;
  v_old numeric;
  v_new numeric;
  v_week text;
begin
  for r in
    select l.id, l.project_id, l.hhl_order_no, l.order_no,
           coalesce(c.fuel_applied_mult, rv.fuel_applied_mult) as old_mult
      from loads l
      left join load_cost c on c.load_id = l.id and c.invoiced_total_eur is not null
      left join load_revenue rv on rv.load_id = l.id and rv.invoiced_total_eur is not null
     where c.load_id is not null or rv.load_id is not null
  loop
    v_fuel := public.fuel_load_date(r.id);
    if v_fuel is null then continue; end if;
    v_w := public.sefs_week_calc(r.project_id, v_fuel);
    if coalesce(v_w->>'ok', '') <> 'true' then continue; end if;
    v_new := (v_w->>'applied_mult')::numeric;
    v_old := r.old_mult;
    if v_old is null or v_new is null or v_old = v_new then continue; end if;
    v_week := ltrim(to_char(v_fuel - ((extract(isodow from v_fuel)::int) - 1), 'IW'), '0');
    perform decision_open_from_event(
      r.project_id, 'SEFS_INVOICE_DIFF',
      'd1300:invoice:' || r.id::text,
      format(
        'Opłata paliwowa na fakturze różni się od wyliczenia (t%s: ×%s → ×%s)',
        v_week,
        trim(to_char(v_old, '990.99')),
        trim(to_char(v_new, '990.99'))
      ),
      jsonb_build_object(
        'load_id', r.id,
        'hhl_order_no', r.hhl_order_no,
        'order_no', r.order_no,
        'old_mult', v_old,
        'new_mult', v_new,
        'load_date', v_fuel,
        'source', '0245_d1300'
      ),
      r.id, null
    );
    v_inv := v_inv + 1;
  end loop;
  return jsonb_build_object('invoice_cases', v_inv);
end $$;
revoke all on function public.sefs_scan_invoice_mult_diff() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Przeliczenie niezafakturowanych + skan faktur + cron fuel-prices
-- ---------------------------------------------------------------------
do $$
declare
  r record;
  v_n int := 0;
  v_scan jsonb;
begin
  perform set_config('tower.audit_source', 'migracja 0245 (D-1300/D-1322)', true);

  for r in
    select l.id, l.project_id, l.hhl_order_no, l.order_no
      from loads l
     where exists (
       select 1 from load_cost c
        where c.load_id = l.id and c.invoiced_total_eur is null
          and c.fuel_applied_mult is not null
     ) or exists (
       select 1 from load_revenue rv
        where rv.load_id = l.id and rv.invoiced_total_eur is null
          and rv.fuel_applied_mult is not null
     )
  loop
    update load_cost
       set fuel_status = 'PROGNOZA'
     where load_id = r.id
       and fuel_status = 'OSTATECZNY'
       and invoiced_total_eur is null;
    update load_revenue
       set fuel_status = 'PROGNOZA'
     where load_id = r.id
       and fuel_status = 'OSTATECZNY'
       and invoiced_total_eur is null;
    perform public.load_price_compute(r.id);
    v_n := v_n + 1;
  end loop;

  v_scan := public.sefs_scan_invoice_mult_diff();

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (
    null, 'FUEL_RECALC_D1300', 'loads', 'd1300-0245',
    jsonb_build_object(
      'recomputed', v_n,
      'invoice_cases', coalesce((v_scan->>'invoice_cases')::int, 0),
      'source', '0245_d1300',
      'note', 'także PROGNOZA (t44–t51) — ostatni OSTATECZNY po D-1322'
    )
  );
end $$;

-- D-1300 F7: 07:15 / 09:15 / 13:15 czasu polskiego (UTC lato: 05:15 / 07:15 / 11:15); ponowienie pomija źródło już zapisane.
do $cron$
declare
  v_sql text := $c$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
             || '/functions/v1/fuel-prices',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
      ),
      timeout_milliseconds := 180000)
  $c$;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname in (
      'tower-fuel-prices', 'tower-fuel-prices-0915', 'tower-fuel-prices-1315'
    );
    perform cron.schedule('tower-fuel-prices', '15 5 * * *', v_sql);
    perform cron.schedule('tower-fuel-prices-0915', '15 7 * * *', v_sql);
    perform cron.schedule('tower-fuel-prices-1315', '15 11 * * *', v_sql);
  else
    raise notice '0245: pg_cron niedostępne — cron fuel-prices do zaplanowania ręcznie';
  end if;
exception when others then
  raise notice '0245 cron fuel-prices: %', sqlerrm;
end
$cron$;
