-- 0189 — BAF PROGNOZA dla przyszłych tygodni (polecenie 06.10 ~00:12).
-- Problem: 66 transportów 16.10–15.12 dostało 1,12 z niepełnego tygodnia
-- (1 odczyt GoEasy 05.10) przez średnią częściowych publikacji przed zamknięciem.
-- Zasada:
--   • poprzedni tydzień NIE zamknięty (dziś ≤ niedziela pn–nd, Europe/Warsaw)
--     → status PROGNOZA = ostatni OSTATECZNY mnożnik (dziś 1,13), bez częściowej średniej
--   • po zamknięciu poprzedniego tygodnia → OSTATECZNY + migawka (0166)
--   • każde odświeżenie wyceny (cron / load_price_refresh_all) przelicza PROGNOZA
-- WSTEPNY zostaje w CHECK (stare wiersze); nowe wyliczenia emitują PROGNOZA.

-- Status: dopisz PROGNOZA
alter table load_cost drop constraint if exists load_cost_fuel_status_check;
alter table load_cost add constraint load_cost_fuel_status_check
  check (fuel_status is null or fuel_status in ('WSTEPNY', 'PROGNOZA', 'OSTATECZNY', 'BRAK'));
alter table load_revenue drop constraint if exists load_revenue_fuel_status_check;
alter table load_revenue add constraint load_revenue_fuel_status_check
  check (fuel_status is null or fuel_status in ('WSTEPNY', 'PROGNOZA', 'OSTATECZNY', 'BRAK'));
comment on column load_cost.fuel_status is
  'BAF (0189): PROGNOZA = prev tydzień niezamknięty (ostatni OSTATECZNY); OSTATECZNY = migawka po zamknięciu; BRAK = brak odczytów; WSTEPNY = legacy 0187.';
comment on column load_revenue.fuel_status is
  'BAF (0189): PROGNOZA = prev tydzień niezamknięty (ostatni OSTATECZNY); OSTATECZNY = migawka po zamknięciu; BRAK = brak odczytów; WSTEPNY = legacy 0187.';

-- Ostatni OSTATECZNY: wyliczenie dla tygodnia załadunku „dziś” (prev tydzień już zamknięty).
create or replace function public.sefs_last_ostateczny(p_project uuid, p_today date)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := coalesce(p_today, (timezone('Europe/Warsaw', now()))::date);
  v_anchor date; v_prev_start date; v_prev_end date;
  s jsonb; p jsonb; v_res jsonb;
begin
  -- poniedziałek bieżącego tygodnia ISO (Europe/Warsaw dzień kalendarzowy)
  v_anchor := v_today - ((extract(isodow from v_today)::int) - 1);
  v_prev_start := v_anchor - 7;
  v_prev_end := v_anchor - 1;
  s := sefs_pub_avg(p_project, 'SEK', v_prev_start, v_prev_end);
  p := sefs_pub_avg(p_project, 'PLN', v_prev_start, v_prev_end);
  if (s->>'avg') is null then s := sefs_last_published(p_project, 'SEK', v_prev_end); end if;
  if (p->>'avg') is null then p := sefs_last_published(p_project, 'PLN', v_prev_end); end if;
  if ((s->>'avg') is not null and (p->>'avg') is not null) is not true then
    return jsonb_build_object(
      'ok', false, 'reason', 'SOURCE_FAILURE',
      'message', 'Brak ostatniego OSTATECZNEGO mnożnika (brak publikacji SEK/PLN)',
      'anchor_week_start', v_anchor, 'prev_week_start', v_prev_start, 'prev_week_end', v_prev_end,
      'status', 'PROGNOZA');
  end if;
  -- parametry jak dla tygodnia kotwicy (ostatni zamknięty)
  v_res := sefs_compute_hybrid_sys(p_project, (s->>'avg')::numeric, (p->>'avg')::numeric, v_anchor);
  return v_res || jsonb_build_object(
    'anchor_week_start', v_anchor,
    'prev_week_start', v_prev_start, 'prev_week_end', v_prev_end,
    'n_sek', (s->>'n')::int, 'n_pln', (p->>'n')::int,
    'pubs_sek', s->'pubs', 'pubs_pln', p->'pubs',
    'fallback_last_sek', (s->>'fallback_last')::boolean,
    'fallback_last_pln', (p->>'fallback_last')::boolean,
    'status', 'PROGNOZA', 'final', false,
    'prognoza', true, 'computed_on', v_today
  );
end $$;
revoke all on function public.sefs_last_ostateczny(uuid, date) from public, anon, authenticated;
comment on function public.sefs_last_ostateczny(uuid, date) is
  'BAF 0189: ostatni OSTATECZNY mnożnik = SEFS dla tygodnia bieżącego (prev tydzień zamknięty). Używane jako PROGNOZA.';

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
  -- zamknięty = po niedzieli poprzedniego tygodnia (Europe/Warsaw dzień)
  v_final := v_today > v_prev_end;

  -- 0189: prev niezamknięty → PROGNOZA = ostatni OSTATECZNY (bez częściowej średniej publikacji)
  if v_final is not true then
    v_prog := sefs_last_ostateczny(p_project, v_today);
    return v_prog || jsonb_build_object(
      'load_week_start', v_week_start, 'load_week_end', v_week_end,
      'load_prev_week_start', v_prev_start, 'load_prev_week_end', v_prev_end,
      'status', 'PROGNOZA', 'final', false, 'prognoza', true,
      'computed_on', v_today
    );
  end if;

  -- OSTATECZNY: pełny poprzedni tydzień pn–nd.
  -- sefs_pub_avg sam robi fallback „tydzień bez publikacji → ostatnia opublikowana";
  -- brak JAKICHKOLWIEK odczytów w tygodniu = SOURCE_FAILURE (bez zgadywania z historii).
  s := sefs_pub_avg(p_project, 'SEK', v_prev_start, v_prev_end);
  p := sefs_pub_avg(p_project, 'PLN', v_prev_start, v_prev_end);

  if ((s->>'avg') is not null and (p->>'avg') is not null) is not true then
    return jsonb_build_object(
      'ok', false, 'reason', 'SOURCE_FAILURE',
      'message', 'Brak opublikowanych cen SEK/PLN dla poprzedniego tygodnia — użyj ostatniego mnożnika + ryzyko HHL',
      'prev_week_start', v_prev_start, 'prev_week_end', v_prev_end,
      'n_sek', coalesce((s->>'n')::int, 0), 'n_pln', coalesce((p->>'n')::int, 0),
      'status', 'OSTATECZNY');
  end if;

  v_res := sefs_compute_hybrid_sys(p_project, (s->>'avg')::numeric, (p->>'avg')::numeric, p_load_date);
  return v_res || jsonb_build_object(
    'load_week_start', v_week_start, 'load_week_end', v_week_end,
    'prev_week_start', v_prev_start, 'prev_week_end', v_prev_end,
    'n_sek', (s->>'n')::int, 'n_pln', (p->>'n')::int,
    'pubs_sek', s->'pubs', 'pubs_pln', p->'pubs',
    'fallback_last_sek', (s->>'fallback_last')::boolean,
    'fallback_last_pln', (p->>'fallback_last')::boolean,
    'status', 'OSTATECZNY',
    'final', true,
    'computed_on', v_today
  );
end $$;
revoke all on function public.sefs_week_calc(uuid, date, date) from public, anon, authenticated;

create or replace function public.sefs_week_calc(p_project uuid, p_load_date date)
returns jsonb
language sql stable security definer set search_path = public as $$
  select public.sefs_week_calc(p_project, p_load_date, null::date)
$$;
revoke all on function public.sefs_week_calc(uuid, date) from public, anon, authenticated;
comment on function public.sefs_week_calc(uuid, date) is
  'SEFS (0189): OSTATECZNY po zamknięciu prev tygodnia (średnia publikacji pn–nd); inaczej PROGNOZA = ostatni OSTATECZNY (bez częściowej średniej).';

-- Wycena: brak daty → PROGNOZA (nie WSTEPNY); migawka tylko OSTATECZNY
create or replace function public.load_price_compute(p_load uuid, p_today date default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l loads%rowtype; v_fuel date; v_w jsonb; v_w_ok boolean; v_side text; v_out jsonb := '{}'::jsonb;
  v_card uuid; m jsonb; x record; v_mult numeric; v_msek numeric; v_mpln numeric; v_status text; v_basis jsonb;
  v_base numeric; v_baf numeric; v_extras numeric; v_total numeric; v_cancel boolean; v_frozen boolean;
begin
  select * into l from loads where id = p_load;
  if not found then return jsonb_build_object('ok', false, 'reason', 'NO_LOAD'); end if;
  v_fuel := fuel_load_date(p_load);
  v_cancel := l.status = 'CANCELLED';
  if v_fuel is not null then
    v_w := sefs_week_calc(l.project_id, v_fuel, p_today);
  else
    -- brak daty załadunku: PROGNOZA z ostatniego OSTATECZNEGO
    v_w := sefs_week_calc(l.project_id, coalesce(p_today, (timezone('Europe/Warsaw', now()))::date) + 7, p_today);
    if coalesce(v_w->>'ok', '') = 'true' then
      v_w := v_w || jsonb_build_object('status', 'PROGNOZA', 'final', false, 'no_load_date', true, 'prognoza', true);
    end if;
  end if;
  v_w_ok := coalesce(v_w->>'ok', '') = 'true';

  foreach v_side in array array['COST', 'REVENUE'] loop
    if v_side = 'COST' then
      select load_id, invoiced_total_eur, fuel_status, fuel_ref_date, fuel_applied_mult, fuel_mult_sek, fuel_mult_pln,
             fuel_basis, extras_amount into x from load_cost where load_id = p_load;
    else
      select load_id, invoiced_total_eur, fuel_status, fuel_ref_date, fuel_applied_mult, fuel_mult_sek, fuel_mult_pln,
             fuel_basis, extras_amount into x from load_revenue where load_id = p_load;
    end if;
    if found and x.invoiced_total_eur is not null then
      v_out := v_out || jsonb_build_object(lower(v_side), 'INVOICED'); continue;
    end if;

    -- migawka: tylko OSTATECZNY tego samego tygodnia załadunku
    v_frozen := x.load_id is not null and x.fuel_status = 'OSTATECZNY' and x.fuel_ref_date is not null and v_fuel is not null
                and date_trunc('week', x.fuel_ref_date) = date_trunc('week', v_fuel);
    if v_frozen then
      v_mult := x.fuel_applied_mult; v_msek := x.fuel_mult_sek; v_mpln := x.fuel_mult_pln;
      v_status := 'OSTATECZNY'; v_basis := x.fuel_basis;
    elsif v_w_ok then
      v_mult := (v_w->>'applied_mult')::numeric; v_msek := (v_w->>'mult_sek')::numeric; v_mpln := (v_w->>'mult_pln')::numeric;
      v_status := v_w->>'status'; v_basis := v_w;
    else
      v_mult := null; v_msek := null; v_mpln := null; v_status := 'BRAK'; v_basis := v_w;
    end if;

    select rc.id into v_card from rate_cards rc
     where rc.project_id = l.project_id and rc.side = v_side
       and rc.valid_from <= coalesce(v_fuel, (timezone('Europe/Warsaw', now()))::date)
       and (rc.valid_until is null or rc.valid_until >= coalesce(v_fuel, (timezone('Europe/Warsaw', now()))::date))
     order by (v_side = 'COST' and rc.org_id = l.carrier_org_id) desc, rc.valid_from desc, rc.version desc
     limit 1;
    m := case when v_card is null then jsonb_build_object('matched', false, 'reason', 'NO_RATE_CARD')
              else rate_match_sys(v_card, p_load) end;

    if coalesce(m->>'matched', '') <> 'true' or (v_mult is null and not v_cancel) then
      if x.load_id is not null then
        if v_side = 'COST' then
          update load_cost set fuel_ref_date = v_fuel, fuel_mult_sek = v_msek, fuel_mult_pln = v_mpln,
                 fuel_applied_mult = v_mult, fuel_status = v_status, fuel_basis = v_basis, rate_basis = m
           where load_id = p_load and invoiced_total_eur is null;
        else
          update load_revenue set fuel_ref_date = v_fuel, fuel_mult_sek = v_msek, fuel_mult_pln = v_mpln,
                 fuel_applied_mult = v_mult, fuel_status = v_status, fuel_basis = v_basis, rate_basis = m
           where load_id = p_load and invoiced_total_eur is null;
        end if;
      end if;
      v_out := v_out || jsonb_build_object(lower(v_side), coalesce(case when coalesce(m->>'matched', '') = 'true' then 'NO_FUEL_MULT' end, m->>'reason')); continue;
    end if;

    v_base := case when v_cancel then 0 else (m->>'base_rate')::numeric end;
    v_baf := case when v_cancel then 0 when v_mult is null then null else round(v_base * (v_mult - 1), 2) end;
    v_extras := coalesce(x.extras_amount, 0);
    v_total := case when v_baf is null then null else v_base + v_baf + v_extras end;

    if v_side = 'COST' then
      insert into load_cost (load_id, rate_card_id, currency, base_amount, baf_pct, baf_amount, extras_amount,
                             computed_total_eur, fuel_ref_date, fuel_mult_sek, fuel_mult_pln, fuel_applied_mult,
                             fuel_status, fuel_basis, rate_basis, computed_at)
      values (p_load, v_card, coalesce(m->>'currency', 'EUR'), v_base, case when v_cancel or v_mult is null then 0 else round((v_mult - 1) * 100, 2) end,
              v_baf, v_extras, case when coalesce(m->>'currency', 'EUR') = 'EUR' then v_total end,
              v_fuel, v_msek, v_mpln, v_mult, v_status, v_basis, m, now())
      on conflict (load_id) do update set
        rate_card_id = excluded.rate_card_id, currency = excluded.currency, base_amount = excluded.base_amount,
        baf_pct = excluded.baf_pct, baf_amount = excluded.baf_amount,
        computed_total_eur = excluded.computed_total_eur, fuel_ref_date = excluded.fuel_ref_date,
        fuel_mult_sek = excluded.fuel_mult_sek, fuel_mult_pln = excluded.fuel_mult_pln,
        fuel_applied_mult = excluded.fuel_applied_mult, fuel_status = excluded.fuel_status,
        fuel_basis = excluded.fuel_basis, rate_basis = excluded.rate_basis, computed_at = now()
      where load_cost.invoiced_total_eur is null;
    else
      insert into load_revenue (load_id, rate_card_id, currency, base_amount, baf_pct, baf_amount, extras_amount,
                                computed_total_eur, fuel_ref_date, fuel_mult_sek, fuel_mult_pln, fuel_applied_mult,
                                fuel_status, fuel_basis, rate_basis, computed_at)
      values (p_load, v_card, coalesce(m->>'currency', 'EUR'), v_base, case when v_cancel or v_mult is null then 0 else round((v_mult - 1) * 100, 2) end,
              v_baf, v_extras, case when coalesce(m->>'currency', 'EUR') = 'EUR' then v_total end,
              v_fuel, v_msek, v_mpln, v_mult, v_status, v_basis, m, now())
      on conflict (load_id) do update set
        rate_card_id = excluded.rate_card_id, currency = excluded.currency, base_amount = excluded.base_amount,
        baf_pct = excluded.baf_pct, baf_amount = excluded.baf_amount,
        computed_total_eur = excluded.computed_total_eur, fuel_ref_date = excluded.fuel_ref_date,
        fuel_mult_sek = excluded.fuel_mult_sek, fuel_mult_pln = excluded.fuel_mult_pln,
        fuel_applied_mult = excluded.fuel_applied_mult, fuel_status = excluded.fuel_status,
        fuel_basis = excluded.fuel_basis, rate_basis = excluded.rate_basis, computed_at = now()
      where load_revenue.invoiced_total_eur is null;
    end if;
    v_out := v_out || jsonb_build_object(lower(v_side), jsonb_build_object('base', v_base, 'mult', v_mult, 'baf', v_baf,
                                                   'total', v_total, 'status', v_status));
  end loop;
  return jsonb_build_object('ok', true, 'load_id', p_load, 'fuel_ref_date', v_fuel) || v_out;
end $$;
revoke all on function public.load_price_compute(uuid, date) from public, anon, authenticated;

-- Po zamknięciu tygodnia: przelicz PROGNOZA / WSTEPNY (oraz nowo zamknięte → OSTATECZNY).
-- OSTATECZNY z migawką pomija load_price_compute (freeze). Cron 6h też woła refresh_all.
create or replace function public.sefs_refresh_prognoza(p_project uuid default null)
returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in
    select l.id
      from loads l
      left join load_cost c on c.load_id = l.id
     where (p_project is null or l.project_id = p_project)
       and (c.load_id is null or c.fuel_status is distinct from 'OSTATECZNY')
  loop
    perform load_price_compute(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.sefs_refresh_prognoza(uuid) from public, anon, authenticated;
comment on function public.sefs_refresh_prognoza(uuid) is
  'BAF 0189: przelicz wyceny nie-OSTATECZNE (PROGNOZA→nowy ostatni OSTATECZNY; po zamknięciu tygodnia → OSTATECZNY).';
