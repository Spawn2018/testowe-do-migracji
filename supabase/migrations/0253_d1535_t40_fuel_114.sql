-- 0253 — D-1535 (#391): tydzień 40 — opłata paliwowa ×1,14 (SE 1,14 / PL 1,17).
-- Trwałe nadpisanie w sefs_week_overrides; sefs_week_calc respektuje; przeliczenie t40;
-- SEFS_INVOICE_DIFF → OWNER_DECISION; powiadomienia przeczytane (jak B8); bulk_quiet.

-- ---------------------------------------------------------------------
-- 1. Tabela nadpisań tygodnia (cron / D-1300 / load_price_compute)
-- ---------------------------------------------------------------------
create table if not exists public.sefs_week_overrides (
  week_start date primary key,
  mult_sek numeric(6,4) not null,
  mult_pln numeric(6,4) not null,
  applied_mult numeric(6,4) not null,
  note text not null,
  created_at timestamptz not null default now()
);

comment on table public.sefs_week_overrides is
  'D-1535: trwałe nadpisanie mnożników SEFS dla tygodnia ISO (week_start = poniedziałek). Respektowane przez sefs_week_calc.';

alter table public.sefs_week_overrides enable row level security;
revoke all on table public.sefs_week_overrides from public, anon, authenticated;

insert into public.sefs_week_overrides (
  week_start, mult_sek, mult_pln, applied_mult, note
) values (
  date '2026-09-28',
  1.14, 1.17, 1.14,
  'Decyzja właściciela 21.10.2026 15:35: t40 = ×1,14 (SE 1,14 / PL 1,17)'
) on conflict (week_start) do update set
  mult_sek = excluded.mult_sek,
  mult_pln = excluded.mult_pln,
  applied_mult = excluded.applied_mult,
  note = excluded.note;

-- ---------------------------------------------------------------------
-- 2. sefs_week_calc — respektuje nadpisanie
-- ---------------------------------------------------------------------
create or replace function public.sefs_week_calc(p_project uuid, p_load_date date, p_today date)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_week_start date; v_week_end date; v_prev_start date; v_prev_end date;
  v_today date := coalesce(p_today, (timezone('Europe/Warsaw', now()))::date);
  s jsonb; p jsonb; v_res jsonb; v_final boolean; v_prog jsonb;
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

  select o.mult_sek, o.mult_pln, o.applied_mult, o.note
    into v_osek, v_opln, v_oapp, v_onote
    from public.sefs_week_overrides o
   where o.week_start = v_week_start;

  if v_osek is not null then
    -- Nadpisanie: OSTATECZNY z decyzją; średnie z poprzedniego tygodnia gdy dostępne (audyt).
    if v_final then
      s := sefs_sek_daily_avg(p_project, v_prev_start, v_prev_end);
      p := sefs_pub_avg(p_project, 'PLN', v_prev_start, v_prev_end);
      if ((s->>'avg') is not null and (p->>'avg') is not null) then
        v_res := sefs_compute_hybrid_sys(p_project, (s->>'avg')::numeric, (p->>'avg')::numeric, p_load_date);
        return v_res || jsonb_build_object(
          'load_week_start', v_week_start, 'load_week_end', v_week_end,
          'prev_week_start', v_prev_start, 'prev_week_end', v_prev_end,
          'n_sek', (s->>'n')::int, 'n_pln', (p->>'n')::int,
          'pubs_sek', s->'pubs', 'pubs_pln', p->'pubs',
          'days_sek', s->'days',
          'fallback_last_sek', coalesce((s->>'fallback_last')::boolean, false),
          'fallback_last_pln', (p->>'fallback_last')::boolean,
          'mult_sek', v_osek, 'mult_pln', v_opln, 'applied_mult', v_oapp,
          'status', 'OSTATECZNY', 'final', true,
          'owner_override', true, 'owner_note', v_onote,
          'computed_on', v_today
        );
      end if;
    end if;
    return jsonb_build_object(
      'ok', true,
      'mult_sek', v_osek, 'mult_pln', v_opln, 'applied_mult', v_oapp,
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

comment on function public.sefs_week_calc(uuid, date, date) is
  'D-1300/D-1322 + D-1535: OKQ8 7 dni; Orlen publikacje; od progu; sefs_week_overrides nadpisuje mnożniki (t40).';
comment on function public.sefs_week_calc(uuid, date) is
  'D-1300/D-1322 + D-1535: OKQ8 7 dni; Orlen publikacje; od progu; sefs_week_overrides nadpisuje mnożniki (t40).';

-- ---------------------------------------------------------------------
-- 3. Przeliczenie t40 + zamknięcie decyzji + audit (bulk_quiet)
-- ---------------------------------------------------------------------
do $$
declare
  r record;
  v_now timestamptz := now();
  v_week_from date := date '2026-09-28';
  v_week_to date := date '2026-10-04';
  v_before jsonb := '[]'::jsonb;
  v_after jsonb := '[]'::jsonb;
  v_row jsonb;
  v_n int := 0;
  v_dec_ids uuid[] := array[]::uuid[];
  v_prev_quiet text;
  v_c_sek numeric; v_c_pln numeric; v_c_app numeric; v_c_baf numeric;
  v_r_sek numeric; v_r_pln numeric; v_r_app numeric; v_r_baf numeric;
begin
  perform set_config('tower.audit_source', 'migracja 0253 (D-1535 t40 ×1,14)', true);
  v_prev_quiet := current_setting('tower.bulk_quiet', true);
  perform set_config('tower.bulk_quiet', 'on', true);

  for r in
    select l.id, l.project_id, l.hhl_order_no, l.order_no, l.plan_load_date,
           c.fuel_mult_sek as c_sek, c.fuel_mult_pln as c_pln, c.fuel_applied_mult as c_app,
           c.baf_amount as c_baf, c.invoiced_total_eur as c_inv,
           rv.fuel_mult_sek as r_sek, rv.fuel_mult_pln as r_pln, rv.fuel_applied_mult as r_app,
           rv.baf_amount as r_baf, rv.invoiced_total_eur as r_inv
      from loads l
      left join load_cost c on c.load_id = l.id
      left join load_revenue rv on rv.load_id = l.id
     where l.plan_load_date >= v_week_from
       and l.plan_load_date <= v_week_to
  loop
    v_before := v_before || jsonb_build_array(jsonb_build_object(
      'load_id', r.id,
      'hhl_order_no', r.hhl_order_no,
      'order_no', r.order_no,
      'plan_load_date', r.plan_load_date,
      'cost', jsonb_build_object(
        'mult_sek', r.c_sek, 'mult_pln', r.c_pln, 'applied', r.c_app,
        'baf', r.c_baf, 'invoiced', r.c_inv is not null),
      'revenue', jsonb_build_object(
        'mult_sek', r.r_sek, 'mult_pln', r.r_pln, 'applied', r.r_app,
        'baf', r.r_baf, 'invoiced', r.r_inv is not null)
    ));

    -- Niezafakturowane: zdejmij migawkę → load_price_compute bierze override.
    if r.c_inv is null and r.c_app is not null then
      update load_cost set fuel_status = 'PROGNOZA'
       where load_id = r.id and invoiced_total_eur is null and fuel_status = 'OSTATECZNY';
    end if;
    if r.r_inv is null and r.r_app is not null then
      update load_revenue set fuel_status = 'PROGNOZA'
       where load_id = r.id and invoiced_total_eur is null and fuel_status = 'OSTATECZNY';
    end if;

    if (r.c_inv is null and exists (select 1 from load_cost where load_id = r.id))
       or (r.r_inv is null and exists (select 1 from load_revenue where load_id = r.id)) then
      perform public.load_price_compute(r.id);
    end if;

    -- Zafakturowane (np. SG-02): tylko wskaźniki 1,14/1,17 — bez zmiany kwot faktury.
    update load_cost
       set fuel_mult_sek = 1.14,
           fuel_mult_pln = 1.17,
           fuel_applied_mult = 1.14,
           fuel_status = 'OSTATECZNY'
     where load_id = r.id
       and invoiced_total_eur is not null
       and (fuel_applied_mult is distinct from 1.14
            or fuel_mult_sek is distinct from 1.14
            or fuel_mult_pln is distinct from 1.17);

    update load_revenue
       set fuel_mult_sek = 1.14,
           fuel_mult_pln = 1.17,
           fuel_applied_mult = 1.14,
           fuel_status = 'OSTATECZNY'
     where load_id = r.id
       and invoiced_total_eur is not null
       and (fuel_applied_mult is distinct from 1.14
            or fuel_mult_sek is distinct from 1.14
            or fuel_mult_pln is distinct from 1.17);

    select c.fuel_mult_sek, c.fuel_mult_pln, c.fuel_applied_mult, c.baf_amount,
           rv.fuel_mult_sek, rv.fuel_mult_pln, rv.fuel_applied_mult, rv.baf_amount
      into v_c_sek, v_c_pln, v_c_app, v_c_baf, v_r_sek, v_r_pln, v_r_app, v_r_baf
      from loads l
      left join load_cost c on c.load_id = l.id
      left join load_revenue rv on rv.load_id = l.id
     where l.id = r.id;

    v_after := v_after || jsonb_build_array(jsonb_build_object(
      'load_id', r.id,
      'hhl_order_no', r.hhl_order_no,
      'order_no', r.order_no,
      'cost', jsonb_build_object(
        'mult_sek', v_c_sek, 'mult_pln', v_c_pln, 'applied', v_c_app, 'baf', v_c_baf),
      'revenue', jsonb_build_object(
        'mult_sek', v_r_sek, 'mult_pln', v_r_pln, 'applied', v_r_app, 'baf', v_r_baf)
    ));
    v_n := v_n + 1;
  end loop;

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (
    null, 'D1535_T40_FUEL_114', 'loads', 'd1535-0253',
    jsonb_build_object(
      'loads', v_n,
      'week_start', v_week_from,
      'week_end', v_week_to,
      'mult_sek', 1.14, 'mult_pln', 1.17, 'applied_mult', 1.14,
      'before', v_before,
      'after', v_after,
      'note', 'Decyzja właściciela 21.10.2026 15:35: t40 = ×1,14'
    )
  );

  -- SEFS_INVOICE_DIFF → OWNER_DECISION
  for r in
    select d.id
      from decisions d
     where d.type_code = 'SEFS_INVOICE_DIFF'
       and d.status in ('NEW', 'ASSIGNED', 'SNOOZED')
  loop
    update decisions
       set status = 'RESOLVED',
           resolution_code = 'OWNER_DECISION',
           resolution_note = 'Decyzja właściciela 21.10.2026 15:35: t40 = ×1,14',
           resolved_at = v_now,
           updated_at = v_now
     where id = r.id and status in ('NEW', 'ASSIGNED', 'SNOOZED');
    insert into decision_events (decision_id, actor_id, action, payload)
    values (
      r.id, null, 'RESOLVE',
      jsonb_build_object(
        'option', 'OWNER_DECISION',
        'effect', 'OWNER_DECISION',
        'note', 'Decyzja właściciela 21.10.2026 15:35: t40 = ×1,14',
        'hotfix', '0253'
      )
    );
    v_dec_ids := array_append(v_dec_ids, r.id);
    insert into audit_log (user_id, action, entity, entity_id, new_value)
    values (
      null, 'DECISION_OWNER_DECISION', 'decisions', r.id::text,
      jsonb_build_object(
        'reason', 'D-1535 t40 ×1,14',
        'note', 'Decyzja właściciela 21.10.2026 15:35: t40 = ×1,14',
        'hotfix', '0253'
      )
    );
  end loop;

  if cardinality(v_dec_ids) > 0 then
    with marked as (
      update notifications n
         set read_at = coalesce(n.read_at, v_now)
       where n.channel = 'IN_APP'
         and n.read_at is null
         and n.template = 'DECISION_OPEN'
         and (
           n.payload->>'decision_id' = any (select x::text from unnest(v_dec_ids) x)
           or n.dedup_key like any (select '%:' || x::text || '%' from unnest(v_dec_ids) x)
         )
      returning n.id
    )
    insert into audit_log (user_id, action, entity, entity_id, new_value)
    select null, 'AUDYT17_MARK_READ', 'notifications', 'd1535-0253',
           jsonb_build_object(
             'count', count(*),
             'notification_ids', coalesce(jsonb_agg(id), '[]'::jsonb),
             'decision_ids', to_jsonb(v_dec_ids),
             'hotfix', '0253',
             'reason', 'SEFS_INVOICE_DIFF OWNER_DECISION')
      from marked;
  end if;

  perform set_config('tower.bulk_quiet', coalesce(v_prev_quiet, ''), true);
end $$;
