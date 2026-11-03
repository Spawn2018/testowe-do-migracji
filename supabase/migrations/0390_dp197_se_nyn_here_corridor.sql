-- DP-197: SE-NYN kontrola odchyłki/via vs SE_E4; alarm OFF_CORRIDOR po HERE gdy świeży (OSM bez HERE).
-- F7 #770 decyzja 97.
select set_config('tower.audit_source', 'migracja 0390 (DP-197 SE-NYN HERE corridor)', true);

-- via miast wzdłuż E4 (Sztokholm…Luleå) — passThrough w here-roads + kontrola odchyłki.
update public.here_road_legs set
  corridor_code = coalesce(corridor_code, 'SE_E4'),
  via_points = '[
    [59.3293,18.0686],
    [59.8586,17.6389],
    [60.6749,17.1413],
    [62.3908,17.3069],
    [63.8258,20.2630],
    [65.5842,22.1547]
  ]'::jsonb
 where leg = 'SE-NYN';

comment on column public.here_road_legs.via_points is
  'BN7 dict + DP-197 SE-NYN: Sztokholm, Uppsala, Gävle, Sundsvall, Umeå, Luleå.';

create or replace function public.refresh_load_eta(p_load uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
  l record;
  v_end timestamptz;
  v_delay int;
  v_has boolean;
  v_kind risk_kind;
  v_off numeric;
  v_max_off numeric := null;
  v_span numeric := 0;
  v_samples int := 0;
  v_blocked boolean := false;
  v_corr text;
  v_leg text;
  v_eta_ok boolean;
  v_op text;
  v_route text;
  v_stena_dual boolean := false;
  v_bn7 boolean := false;
  v_bn7_no_here boolean := false;
  v_here_fresh boolean := false;
  v_here_fetched timestamptz;
  v_here_line geometry; -- F7 N2: jedna LineString na refresh
  v_src_label text := 'OSM';
begin
  select * into r from compute_load_eta(p_load);
  select * into l from loads where id = p_load;
  if not found then return; end if;

  select load_delivery_deadline(l.plan_delivery_date, l.plan_delivery_to) into v_end;
  v_delay := case when r.eta is null or v_end is null then null
                  else greatest(0, round(extract(epoch from (r.eta - v_end)) / 60))::int end;

  v_blocked := l.status = 'FERRY' or l.status not in ('IN_TRANSIT_PL', 'IN_TRANSIT_SE');
  v_route := public.load_route_family(p_load);
  v_op := public.eta_obs_operator_key(v_route);

  -- F7 B2: leg z dokładnego kodu trasy (nie family + order by code limit 1).
  if l.status = 'IN_TRANSIT_SE' then
    v_kind := 'ROAD_SE'::risk_kind;
    if v_route is not null then
      select fr.road_corridor_post, h.corridor_code into v_leg, v_corr
        from public.ferry_routes fr
        join public.here_road_legs h on h.leg = fr.road_corridor_post
       where fr.active and fr.code = upper(btrim(v_route))
       limit 1;
    end if;
    if v_corr in ('SE_E22', 'SE_KAA_INLAND') or v_op = 'STENA' then
      v_stena_dual := true;
      v_corr := coalesce(nullif(v_corr, 'SE_KAA_INLAND'), 'SE_E22');
    end if;
  elsif l.status = 'IN_TRANSIT_PL' then
    v_kind := 'ROAD_PL'::risk_kind;
    if v_route is not null then
      select fr.road_corridor_pre, h.corridor_code into v_leg, v_corr
        from public.ferry_routes fr
        join public.here_road_legs h on h.leg = fr.road_corridor_pre
       where fr.active and fr.code = upper(btrim(v_route))
       limit 1;
    end if;
  else
    v_kind := 'ROAD_PL'::risk_kind;
    v_corr := null;
    v_leg := null;
  end if;

  -- W1/F7 r4: bez trasy — PL_ROAD tylko gdy oba ostatnie punkty w bbox PL.
  if v_corr is null and v_route is null and l.status = 'IN_TRANSIT_PL' then
    select case
             when count(*) >= 1
              and bool_and(
                    st_x(s.g::geometry) between 14.0 and 24.2
                    and st_y(s.g::geometry) between 49.0 and 54.45
                  )
             then 'PL_ROAD'
           end
      into v_corr
      from (
        select coalesce(geom_snapped, geom_raw) as g
          from public.positions
         where load_id = p_load
         order by ts desc
         limit 2
      ) s;
  end if;

  -- BN8b F7 B1/B2/B3: BN7 po legu HERE (bez kopiowania do corridor_polylines);
  -- corridor_geom dołączamy do r.basis PRZED pierwszym UPDATE.
  -- DP-197: SE_E4 w v_bn7 tylko przy świeżym HERE (bez HERE → OSM jak DP-194).
  v_here_fresh := public.bn8b_here_leg_fresh(v_leg);
  v_bn7 := v_corr in ('PL_EE_E67', 'FI_E75', 'SE_E4_STO', 'SE_E18_KPS')
        or (v_corr = 'SE_E4' and v_here_fresh is true);
  v_bn7_no_here := false;
  if v_bn7 then
    if v_here_fresh is not true then
      v_bn7_no_here := true;
      r.basis := coalesce(r.basis, '{}'::jsonb)
                 || jsonb_build_object('corridor_geom', 'brak', 'here_leg', v_leg);
      if v_blocked is not true then
        v_blocked := true;
        v_samples := 0;
        v_max_off := 0;
        v_span := 0;
      end if;
    else
      select g.fetched_at into v_here_fetched
        from public.here_road_geometry g where g.leg = v_leg;
      r.basis := coalesce(r.basis, '{}'::jsonb)
                 || jsonb_build_object(
                      'corridor_geom', 'here',
                      'here_leg', v_leg,
                      'here_fetched_at', v_here_fetched
                    );
      v_src_label := 'HERE';
    end if;
  end if;

  perform set_config('tower.eta_ctx', 'on', true);
  update loads set eta_site = r.eta, eta_confidence_min = r.conf_min, eta_basis = r.basis, eta_computed_at = now(),
         delay_minutes = v_delay
   where id = p_load
     and (eta_site is distinct from r.eta or eta_confidence_min is distinct from r.conf_min
          or (eta_basis - 'computed_at') is distinct from (r.basis - 'computed_at')
          or delay_minutes is distinct from v_delay);
  perform set_config('tower.eta_ctx', '', true);

  v_has := exists (select 1 from positions p where p.load_id = p_load)
    or l.status in (
      'READY','AT_LOADING','IN_TRANSIT_PL','AT_PORT_GDANSK',
      'FERRY','AT_PORT_NYNASHAMN','IN_TRANSIT_SE','AT_SITE'
    );
  v_eta_ok := l3_eta_alarm(r.eta, v_end, v_has)
    and l.actual_delivery_at is null
    and l.status::text not in ('CANCELLED', 'REMOVED')
    and public.load_status_rank(l.status) < public.load_status_rank('AT_SITE'::public.load_status);

  if v_eta_ok then
    perform l3_upsert_alarm(l.project_id, p_load, 'ETA_BREACH', 'ETA_BREACH:' || p_load,
      format('Opóźnienie %s min wobec planu dostawy (próg %s)', v_delay, l3_ops('DELAY_MIN')),
      'rk_eta_breach', true, true, now() + interval '2 hours',
      jsonb_build_object('params', jsonb_build_object('minutes', v_delay, 'threshold', l3_ops('DELAY_MIN'))),
      now());
  else
    perform l3_upsert_alarm(l.project_id, p_load, 'ETA_BREACH', 'ETA_BREACH:' || p_load,
      'ETA', 'rk_eta_breach', false, false, null, '{}'::jsonb, now());
    update risk_signals set resolved_at = now()
     where load_id = p_load and kind = 'ETA_BREACH' and resolved_at is null
       and dedup_key = 'ETA_BREACH:' || p_load and coalesce(detail->>'l3', '') <> '1';
  end if;

  if v_bn7_no_here then
    null; -- bez pomiaru na przybliżeniu OSM; corridor_polylines zostaje OSM (D-81)
  elsif v_bn7 and v_blocked is not true then
    -- F7 B1/N2: dystans z here_road_geometry legu — linia raz, potem 2 próbki.
    v_here_line := public.bn8b_here_leg_line(v_leg);
    select count(*)::int,
           max(hp.off_m),
           min(hp.off_m),
           coalesce(extract(epoch from (max(s.ts) - min(s.ts))) / 60.0, 0),
           coalesce(bool_or(
             l3_in_port_or_yard(s.g)
             or public.bn8b_near_muu_pld_terminal(s.g)
           ), false)
      into v_samples, v_max_off, v_off, v_span, v_has
      from (
        select ts, coalesce(geom_snapped, geom_raw) as g
          from positions
         where load_id = p_load
         order by ts desc
         limit 2
      ) s
      cross join lateral public.bn8b_here_leg_progress_on_line(
        v_here_line, s.g, v_here_fetched
      ) hp;
    if coalesce(v_off, 0) <= l3_ops('OFFROUTE_KM') * 1000 then
      v_max_off := 0;
    end if;
    v_blocked := v_blocked or coalesce(v_has, false);
  elsif v_stena_dual is not true
     and (v_corr is null
          or not exists (
            select 1 from corridor_polylines cp
             where cp.code = v_corr and coalesce(cp.total_km, 0) > 0
          )) then
    v_blocked := true;
    v_samples := 0;
    v_max_off := 0;
    v_span := 0;
  elsif v_stena_dual is true
        and not exists (
          select 1 from corridor_polylines cp
           where cp.code = 'SE_E22' and coalesce(cp.total_km, 0) > 0
        )
        and not exists (
          select 1 from corridor_polylines cp
           where cp.code = public.stena_se_inland_corridor_code()
             and coalesce(cp.total_km, 0) > 0
        ) then
    v_blocked := true;
    v_samples := 0;
    v_max_off := 0;
    v_span := 0;
  else
    if v_stena_dual is true then
      select count(*)::int,
             max(n.off_m),
             min(n.off_m),
             coalesce(extract(epoch from (max(s.ts) - min(s.ts))) / 60.0, 0),
             coalesce(bool_or(l3_in_port_or_yard(s.g)), false),
             (array_agg(n.corridor_code order by s.ts desc))[1]
        into v_samples, v_max_off, v_off, v_span, v_has, v_corr
        from (
          select ts, coalesce(geom_snapped, geom_raw) as g
            from positions
           where load_id = p_load
           order by ts desc
           limit 2
        ) s
        cross join lateral stena_se_corridor_nearest(s.g) n;
    else
      select count(*)::int,
             max(cp.off_m),
             min(cp.off_m),
             coalesce(extract(epoch from (max(s.ts) - min(s.ts))) / 60.0, 0),
             coalesce(bool_or(
               l3_in_port_or_yard(s.g)
               or public.bn8b_near_muu_pld_terminal(s.g)
             ), false)
        into v_samples, v_max_off, v_off, v_span, v_has
        from (
          select ts, coalesce(geom_snapped, geom_raw) as g
            from positions
           where load_id = p_load
           order by ts desc
           limit 2
        ) s
        cross join lateral corridor_progress(v_corr, s.g) cp;
    end if;
    if coalesce(v_off, 0) <= l3_ops('OFFROUTE_KM') * 1000 then
      v_max_off := 0;
    end if;
    v_blocked := v_blocked or coalesce(v_has, false);
  end if;

  if l3_deviation_alarm(v_max_off, v_samples, v_span, v_blocked) then
    perform l3_upsert_alarm(l.project_id, p_load, v_kind, 'OFF_CORRIDOR:' || p_load,
      format('Zjazd z trasy z zezwolenia: %s m od korytarza %s (próg %s m)',
             round(v_max_off), v_src_label, l3_ops('OFFROUTE_KM') * 1000),
      'rk_off_corridor', true, true, now() + interval '1 hour',
      jsonb_build_object('params', jsonb_build_object(
        'meters', round(v_max_off), 'threshold', l3_ops('OFFROUTE_KM') * 1000,
        'corridor', v_corr, 'leg', v_leg, 'source', v_src_label)),
      now());
  else
    update risk_signals set resolved_at = now()
     where load_id = p_load and resolved_at is null and dedup_key = 'OFF_CORRIDOR:' || p_load;
    perform l3_lapse('OFF_CORRIDOR:' || p_load, now());
  end if;
end $$;;

revoke all on function public.refresh_load_eta(uuid) from public, anon, authenticated;
grant execute on function public.refresh_load_eta(uuid) to service_role;
comment on function public.refresh_load_eta(uuid) is
  'DP-197: SE_E4 OFF_CORRIDOR = HERE gdy świeży (OSM bez HERE); Stena dual OSM bez zmian.';
