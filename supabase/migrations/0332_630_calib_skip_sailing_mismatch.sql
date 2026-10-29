-- #630: eta_propose_calibration pomija PORT_CHECKIN z features.sailing_mismatch
-- (CROSSING z mismatch zostaje w medianie). Licznik n_skipped_sailing_mismatch w odpowiedzi.
-- F7 #629 backlog / PLAN §4 #630. Po 0331.

begin;

create or replace function public.eta_propose_calibration()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_frozen numeric;
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
  v_n int := 0;
  v_n_codes int := 0;
  v_err_before numeric := 0;
  v_err_after numeric := 0;
  v_err_n int := 0;
  v_max_chg numeric := 0;
  v_id bigint;
  r record;
  v_spread numeric;
  v_dev numeric;
  v_old numeric;
  v_spread_old numeric;
  v_chg_h numeric;
  v_chg_sp numeric;
  v_skip_codes text[] := '{}';
  v_exist bigint;
  v_open_dec boolean;
  v_n_skip_mm int := 0;
begin
  select value into v_frozen from app_parameters where key = 'ETA_CALIBRATION_FROZEN';
  if coalesce(v_frozen, 0) = 1 then
    return jsonb_build_object('ok', false, 'reason', 'FROZEN');
  end if;

  -- #630: liczba PORT_CHECKIN z sailing_mismatch (wykluczone z mediany; CROSSING zostaje)
  select count(*)::int into v_n_skip_mm
    from eta_segment_observations o
   where o.exclude_reason is null
     and o.hours_observed > 0
     and o.observed_at >= now() - interval '90 days'
     and coalesce(o.features->>'p4k', '') = 'true'
     and o.corridor = 'PORT_CHECKIN'
     and coalesce(o.features->>'sailing_mismatch', '') = 'true';

  -- B5b + Ś3: pomijaj kody cofnięte LUB auto-zastosowane w 7 dni, dopóki < 3 nowych obs.
  select coalesce((
    select array_agg(distinct k)
      from eta_calibration_versions v
      cross join lateral jsonb_object_keys(v.params_after) k
     where v.undone_at is not null
       and v.undone_at > now() - interval '7 days'
       and (
         select count(*) from eta_segment_observations o
          where o.corridor = k
            and o.exclude_reason is null
            and o.observed_at > v.undone_at
            and coalesce(o.features->>'p4k', '') = 'true'
            -- #630: pomijaj PORT_CHECKIN z sailing_mismatch (CROSSING z mismatch zostaje)
            and not (
              o.corridor = 'PORT_CHECKIN'
              and coalesce(o.features->>'sailing_mismatch', '') = 'true'
            )
       ) < 3
  ), '{}') || coalesce((
    select array_agg(distinct k)
      from eta_calibration_versions v
      cross join lateral jsonb_object_keys(v.params_after) k
     where v.applied is true
       and v.undone_at is null
       and v.rejected_at is null
       and coalesce(v.note, '') like '%auto-applied%'
       and v.created_at > now() - interval '7 days'
       and (
         select count(*) from eta_segment_observations o
          where o.corridor = k
            and o.exclude_reason is null
            and o.observed_at > v.created_at
            and coalesce(o.features->>'p4k', '') = 'true'
            -- #630: pomijaj PORT_CHECKIN z sailing_mismatch (CROSSING z mismatch zostaje)
            and not (
              o.corridor = 'PORT_CHECKIN'
              and coalesce(o.features->>'sailing_mismatch', '') = 'true'
            )
       ) < 3
  ), '{}') into v_skip_codes;

  -- B7: fit = 70 % starszych per kod; mediana tylko z fit; błąd potem tylko z test
  for r in
    with base as (
      select o.corridor, o.hours_observed, o.observed_at, o.features,
             row_number() over (partition by o.corridor order by o.observed_at, o.id) as rn,
             count(*) over (partition by o.corridor) as cnt
        from eta_segment_observations o
       where o.exclude_reason is null
         and o.hours_observed > 0
         and o.observed_at >= now() - interval '90 days'
         and coalesce(o.features->>'p4k', '') = 'true'
            -- #630: pomijaj PORT_CHECKIN z sailing_mismatch (CROSSING z mismatch zostaje)
            and not (
              o.corridor = 'PORT_CHECKIN'
              and coalesce(o.features->>'sailing_mismatch', '') = 'true'
            )
         and o.corridor in (select segment_code from eta_route_segments)
         and (
           o.corridor not like 'PL_ROAD%' and o.corridor not like 'SE_ROAD%'
           or coalesce(o.features->>'gps_quality', '') = 'true'
         )
         -- Ś3 F7 r3: tylko v_skip_codes (7 d / ≥3 obs) — bez osobnego not exists (martwa reguła)
         and (v_skip_codes = '{}' or o.corridor <> all (v_skip_codes))
    ),
    fit as (
      select * from base where rn <= greatest(1, floor(cnt * 0.7))
    ),
    stats as (
      select f.corridor as code,
             (select count(*)::int from base b where b.corridor = f.corridor) as n,
             (select count(*)::int from base b
               where b.corridor = f.corridor
                 and b.rn > greatest(1, floor(b.cnt * 0.7))) as n_test,
             percentile_cont(0.5) within group (order by f.hours_observed)::numeric as med,
             percentile_cont(0.1) within group (order by f.hours_observed)::numeric as p10,
             percentile_cont(0.9) within group (order by f.hours_observed)::numeric as p90,
             p.hours as hours_now,
             p.spread_pct as spread_now
        from fit f
        join eta_segment_params p on p.code = f.corridor
       group by f.corridor, p.hours, p.spread_pct
      having (select count(*) from base b where b.corridor = f.corridor) >= 5
    )
    select * from stats
  loop
    v_old := nullif(r.hours_now, 0);
    if v_old is null or r.med is null then
      continue;
    end if;
    v_dev := abs(r.med - r.hours_now) / v_old;
    if v_dev <= 0.10 then
      continue;
    end if;
    v_spread := least(greatest(
      greatest(abs(r.p90 - r.med), abs(r.med - r.p10)) / nullif(r.med, 0) * 100.0,
      10), 100);
    v_spread_old := coalesce(nullif(r.spread_now, 0), 20);
    v_chg_h := abs(r.med - r.hours_now) / v_old;
    -- F7 r8 #605: rozrzut już jest % godzin → Δ w punktach procentowych / 100 (15→10 = 0,05)
    v_chg_sp := abs(v_spread - v_spread_old) / 100.0;
    if (
      select coalesce(sum(
        abs((a.value->>'hours')::numeric - (b.value->>'hours')::numeric)
        / nullif((b.value->>'hours')::numeric, 0)
      ), 0)
        from eta_calibration_versions v
        cross join lateral jsonb_each(v.params_after) a
        join lateral jsonb_each(v.params_before) b on b.key = a.key
       where v.applied is true and v.undone_at is null
         and a.key = r.code
         and v.created_at > now() - interval '30 days'
    ) + v_chg_h > 0.40 then
      continue;
    end if;

    v_before := v_before || jsonb_build_object(
      r.code, jsonb_build_object('hours', r.hours_now, 'spread_pct', r.spread_now)
    );
    v_after := v_after || jsonb_build_object(
      r.code, jsonb_build_object(
        'hours', round(r.med, 3),
        'spread_pct', round(v_spread, 1)
      )
    );
    v_n := v_n + r.n;
    v_n_codes := v_n_codes + 1;
    v_max_chg := greatest(v_max_chg, v_chg_h, v_chg_sp);
  end loop;

  if v_n_codes = 0 then
    delete from eta_calibration_versions
     where applied is not true
       and created_by is null
       and coalesce(note, '') like 'propozycja ciągła%'
       and undone_at is null
       and rejected_at is null
       and not exists (
         select 1 from decisions d
          where d.type_code = 'ETA_CALIBRATION_APPROVAL'
            and d.status in ('NEW', 'ASSIGNED', 'SNOOZED')
            and d.detail->>'version' = eta_calibration_versions.id::text
       );
    return jsonb_build_object('ok', true, 'proposal', null, 'reason', 'NO_CHANGE', 'n_skipped_sailing_mismatch', v_n_skip_mm);
  end if;

  -- B7 F7 r3 pkt 9: backtest per kod — odrzuć tylko kody, które pogarszają / mają za mało testu
  declare
    v_keep_before jsonb := '{}'::jsonb;
    v_keep_after jsonb := '{}'::jsonb;
    v_code text;
    v_c_err_a numeric;
    v_c_err_b numeric;
    v_c_n int;
    v_any_few boolean := false;
    v_any_worse boolean := false;
  begin
    for v_code in select jsonb_object_keys(v_after)
    loop
      select
        coalesce(avg(abs(o.hours_observed - (v_after -> o.corridor ->> 'hours')::numeric) * 60.0), 0),
        coalesce(avg(abs(o.hours_observed - (v_before -> o.corridor ->> 'hours')::numeric) * 60.0), 0),
        count(*)::int
        into v_c_err_a, v_c_err_b, v_c_n
        from (
          select o.corridor, o.hours_observed,
                 row_number() over (partition by o.corridor order by o.observed_at, o.id) as rn,
                 count(*) over (partition by o.corridor) as cnt
            from eta_segment_observations o
           where o.exclude_reason is null
             and o.hours_observed > 0
             and o.observed_at >= now() - interval '90 days'
             and coalesce(o.features->>'p4k', '') = 'true'
            -- #630: pomijaj PORT_CHECKIN z sailing_mismatch (CROSSING z mismatch zostaje)
            and not (
              o.corridor = 'PORT_CHECKIN'
              and coalesce(o.features->>'sailing_mismatch', '') = 'true'
            )
             and o.corridor = v_code
             and o.corridor in (select segment_code from eta_route_segments)
             and (
               o.corridor not like 'PL_ROAD%' and o.corridor not like 'SE_ROAD%'
               or coalesce(o.features->>'gps_quality', '') = 'true'
             )
        ) o
       where o.rn > greatest(1, floor(o.cnt * 0.7));
      if v_c_n < 2 then
        v_any_few := true;
        continue;
      end if;
      if v_c_err_a >= v_c_err_b then
        v_any_worse := true;
        v_err_after := coalesce(v_err_after, 0) + v_c_err_a * v_c_n;
        v_err_before := coalesce(v_err_before, 0) + v_c_err_b * v_c_n;
        v_err_n := coalesce(v_err_n, 0) + v_c_n;
        continue;
      end if;
      v_keep_before := v_keep_before || jsonb_build_object(v_code, v_before -> v_code);
      v_keep_after := v_keep_after || jsonb_build_object(v_code, v_after -> v_code);
      v_err_after := coalesce(v_err_after, 0) + v_c_err_a * v_c_n;
      v_err_before := coalesce(v_err_before, 0) + v_c_err_b * v_c_n;
      v_err_n := coalesce(v_err_n, 0) + v_c_n;
    end loop;

    if v_keep_after = '{}'::jsonb then
      delete from eta_calibration_versions
       where applied is not true
         and created_by is null
         and coalesce(note, '') like 'propozycja ciągła%'
         and undone_at is null
         and rejected_at is null
         and not exists (
           select 1 from decisions d
            where d.type_code = 'ETA_CALIBRATION_APPROVAL'
              and d.status in ('NEW', 'ASSIGNED', 'SNOOZED')
              and d.detail->>'version' = eta_calibration_versions.id::text
         );
      if v_any_worse is not true and v_any_few then
        return jsonb_build_object(
          'ok', true, 'proposal', null, 'reason', 'BACKTEST_TOO_FEW',
          'n_test', coalesce(v_err_n, 0),
          'n_skipped_sailing_mismatch', v_n_skip_mm
        );
      end if;
      return jsonb_build_object(
        'ok', true, 'proposal', null, 'reason', 'BACKTEST_WORSE',
        'error_before_min', round(case when coalesce(v_err_n,0)>0 then v_err_before/v_err_n else 0 end, 2),
        'error_after_min', round(case when coalesce(v_err_n,0)>0 then v_err_after/v_err_n else 0 end, 2),
        'n_skipped_sailing_mismatch', v_n_skip_mm
      );
    end if;

    v_before := v_keep_before;
    v_after := v_keep_after;
    -- F7 r5 pkt 5: n_obs / max_chg / błąd tylko z kodów zostawionych (bez „worse”)
    v_n_codes := (select count(*)::int from jsonb_object_keys(v_after));
    select coalesce(sum(cnt), 0)::int into v_n
      from (
        select count(*)::int as cnt
          from eta_segment_observations o
         where o.exclude_reason is null
           and o.hours_observed > 0
           and o.observed_at >= now() - interval '90 days'
           and coalesce(o.features->>'p4k', '') = 'true'
            -- #630: pomijaj PORT_CHECKIN z sailing_mismatch (CROSSING z mismatch zostaje)
            and not (
              o.corridor = 'PORT_CHECKIN'
              and coalesce(o.features->>'sailing_mismatch', '') = 'true'
            )
           and jsonb_exists(v_after, o.corridor)
           and o.corridor in (select segment_code from eta_route_segments)
         group by o.corridor
      ) s;
    select coalesce(max(greatest(
             abs((v_after -> b.key ->> 'hours')::numeric - (b.value->>'hours')::numeric)
               / nullif((b.value->>'hours')::numeric, 0),
             abs(coalesce((v_after -> b.key ->> 'spread_pct')::numeric, 0)
                 - coalesce((b.value->>'spread_pct')::numeric, 0))
               / 100.0
           )), 0)
      into v_max_chg
      from jsonb_each(v_before) b
     where jsonb_exists(v_after, b.key);
    v_err_after := 0; v_err_before := 0; v_err_n := 0;
    for v_code in select jsonb_object_keys(v_after)
    loop
      select
        coalesce(avg(abs(o.hours_observed - (v_after -> o.corridor ->> 'hours')::numeric) * 60.0), 0),
        coalesce(avg(abs(o.hours_observed - (v_before -> o.corridor ->> 'hours')::numeric) * 60.0), 0),
        count(*)::int
        into v_c_err_a, v_c_err_b, v_c_n
        from (
          select o.corridor, o.hours_observed,
                 row_number() over (partition by o.corridor order by o.observed_at, o.id) as rn,
                 count(*) over (partition by o.corridor) as cnt
            from eta_segment_observations o
           where o.exclude_reason is null
             and o.hours_observed > 0
             and o.observed_at >= now() - interval '90 days'
             and coalesce(o.features->>'p4k', '') = 'true'
            -- #630: pomijaj PORT_CHECKIN z sailing_mismatch (CROSSING z mismatch zostaje)
            and not (
              o.corridor = 'PORT_CHECKIN'
              and coalesce(o.features->>'sailing_mismatch', '') = 'true'
            )
             and o.corridor = v_code
             and o.corridor in (select segment_code from eta_route_segments)
             and (
               o.corridor not like 'PL_ROAD%' and o.corridor not like 'SE_ROAD%'
               or coalesce(o.features->>'gps_quality', '') = 'true'
             )
        ) o
       where o.rn > greatest(1, floor(o.cnt * 0.7));
      v_err_after := v_err_after + v_c_err_a * v_c_n;
      v_err_before := v_err_before + v_c_err_b * v_c_n;
      v_err_n := v_err_n + v_c_n;
    end loop;
    if coalesce(v_err_n, 0) > 0 then
      v_err_after := v_err_after / v_err_n;
      v_err_before := v_err_before / v_err_n;
    end if;
  end;

  select id into v_exist
    from eta_calibration_versions
   where applied is not true
     and created_by is null
     and coalesce(note, '') like 'propozycja ciągła%'
     and undone_at is null
     and rejected_at is null
   order by id desc
   limit 1;

  v_open_dec := false;
  if v_exist is not null then
    select exists (
      select 1 from decisions d
       where d.type_code = 'ETA_CALIBRATION_APPROVAL'
         and d.status in ('NEW', 'ASSIGNED', 'SNOOZED')
         and d.detail->>'version' = v_exist::text
    ) into v_open_dec;
  end if;

  -- Ś4 vs B4: przy otwartej decyzji — nowy wiersz; starą decyzję SUPERSEDED (F7 r3/r5 B2)
  if v_exist is not null and v_open_dec is not true then
    update eta_calibration_versions
       set params_before = v_before,
           params_after = v_after,
           n_obs = v_n,
           error_before_min = round(v_err_before, 2),
           error_after_min = round(v_err_after, 2),
           note = format(
             'propozycja ciągła #581; max_chg=%s%%; kody=%s%s',
             round(v_max_chg * 100.0, 1)::text,
             v_n_codes,
             case when v_n_skip_mm > 0 then format('; skip_mm_PORT_CHECKIN=%s', v_n_skip_mm) else '' end
           ),
           created_at = now()
     where id = v_exist;
    v_id := v_exist;
  else
    if v_open_dec is true then
      update decisions
         set status = 'RESOLVED',
             resolved_at = now(),
             resolution_code = 'SUPERSEDED',
             resolution_note = 'nowa propozycja kalibracji ETA',
             snooze_until = null,
             updated_at = now()
       where type_code = 'ETA_CALIBRATION_APPROVAL'
         and status in ('NEW', 'ASSIGNED', 'SNOOZED');
      -- F7 r5 B2: stara wersja z decyzją → rejected, żeby auto nie wracało do BLOCKED
      if v_exist is not null then
        update eta_calibration_versions
           set rejected_at = coalesce(rejected_at, now()),
               note = case
                 when coalesce(note, '') like '%superseded%' then note
                 else coalesce(note || '; ', '') || 'superseded'
               end
         where id = v_exist
           and applied is not true
           and undone_at is null;
      end if;
    end if;
    insert into eta_calibration_versions (
      created_by, params_before, params_after, n_obs,
      error_before_min, error_after_min, applied, frozen, note
    ) values (
      null, v_before, v_after, v_n,
      round(v_err_before, 2), round(v_err_after, 2),
      false, false,
      format(
        'propozycja ciągła #581; max_chg=%s%%; kody=%s%s',
        round(v_max_chg * 100.0, 1)::text,
        v_n_codes,
        case when v_n_skip_mm > 0 then format('; skip_mm_PORT_CHECKIN=%s', v_n_skip_mm) else '' end
      )
    )
    returning id into v_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'proposal', v_id,
    'n_obs', v_n,
    'n_codes', v_n_codes,
    'max_change_pct', round(v_max_chg * 100.0, 1),
    'error_before_min', round(v_err_before, 2),
    'error_after_min', round(v_err_after, 2),
    'n_skipped_sailing_mismatch', v_n_skip_mm
  );
end;
$$;

revoke all on function public.eta_propose_calibration() from public, anon, authenticated;
grant execute on function public.eta_propose_calibration() to service_role;

comment on function public.eta_propose_calibration() is
  '#581/#630: mediana n≥5, >10 %, p4k; PORT_CHECKIN sailing_mismatch pomijany; CROSSING zostaje.';

revoke all on function public.eta_propose_calibration() from public, anon, authenticated;
grant execute on function public.eta_propose_calibration() to service_role;

commit;
