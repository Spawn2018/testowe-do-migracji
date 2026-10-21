-- 0246 — A10: automat wszystkich statusów (D-20261019-1540-01, #324)
-- Przygotowanie: PLANNED / RESOURCES_PENDING / DOCS_PENDING / READY w obie strony.
-- Trasa: geofence z każdego wcześniejszego statusu; zapas Na promie (b, c).
-- Rozliczenie: po DELIVERED ponowna próba c17_try_billing_status.
-- dedup_key STATUS_AUTO z czasem — ponowny automat po cofnięciu HHL.

-- ---------------------------------------------------------------------
-- 1. awiz_missing — także READY (demotion A10)
-- ---------------------------------------------------------------------
create or replace function public.awiz_missing(p_load uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l public.loads%rowtype;
  gaps jsonb := '[]'::jsonb;
  awiz text[] := array[]::text[];
  v_pilots int;
  v_escorts int;
  v_items jsonb;
  v_anchor date;
  v_has_policy boolean;
  v_permit_missing boolean;
  v_kind text;
begin
  select * into l from public.loads where id = p_load;
  if l.id is null then
    return '[]'::jsonb;
  end if;
  /* A10: READY też — żeby demotion widział braki. */
  if l.status::text not in ('PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING', 'READY') then
    return '[]'::jsonb;
  end if;

  if l.carrier_org_id is null then
    gaps := gaps || jsonb_build_array(jsonb_build_object(
      'kind', 'CARRIER', 'items', jsonb_build_array('Brak przewoźnika'), 'who', 'HHL'
    ));
  end if;

  if coalesce(btrim(l.driver_name), '') = '' then awiz := array_append(awiz, 'kierowca'); end if;
  if coalesce(btrim(l.driver_phone), '') = '' then awiz := array_append(awiz, 'telefon'); end if;
  if coalesce(btrim(l.tractor_plate), '') = '' then awiz := array_append(awiz, 'ciągnik'); end if;
  if coalesce(btrim(l.trailer_plate), '') = '' then awiz := array_append(awiz, 'naczepa'); end if;
  if coalesce(array_length(awiz, 1), 0) > 0 then
    gaps := gaps || jsonb_build_array(jsonb_build_object(
      'kind', 'AWIZ', 'items', to_jsonb(awiz), 'who', 'SCX'
    ));
  end if;

  if l.sailing_id is null then
    gaps := gaps || jsonb_build_array(jsonb_build_object('kind', 'SAILING', 'who', 'SCX'));
  end if;

  select coalesce(max(p.escort_required), 0) into v_pilots
    from public.load_permits lp
    join public.permits p on p.id = lp.permit_id
   where lp.load_id = l.id;
  select count(*)::int into v_escorts from public.load_escorts e where e.load_id = l.id;
  if v_pilots < coalesce(l.escort_vehicles, 0) then
    v_pilots := coalesce(l.escort_vehicles, 0);
  end if;
  if v_pilots > 0 and v_escorts < v_pilots then
    v_items := case
      when v_pilots > 1 then jsonb_build_array('pilot ×' || v_pilots::text)
      else jsonb_build_array('pilot')
    end;
    gaps := gaps || jsonb_build_array(jsonb_build_object(
      'kind', 'PILOTS', 'items', v_items, 'who', 'SCX'
    ));
  end if;

  if coalesce(btrim(l.carrier_order_no), '') = '' then
    gaps := gaps || jsonb_build_array(jsonb_build_object('kind', 'ORDER_SCX', 'who', 'SCX'));
  end if;
  if coalesce(btrim(l.hhl_order_no), '') = '' then
    gaps := gaps || jsonb_build_array(jsonb_build_object('kind', 'ORDER_HHL', 'who', 'HHL'));
  end if;

  v_anchor := coalesce(l.plan_load_date, (now() at time zone 'Europe/Warsaw')::date);
  if l.carrier_org_id is not null then
    v_has_policy := exists (
      select 1 from public.insurance_policies ip
       where ip.org_id = l.carrier_org_id
         and ip.approval_status = 'APPROVED'
         and ip.valid_from <= v_anchor
         and ip.valid_until >= v_anchor
    );
    if v_has_policy is not true then
      gaps := gaps || jsonb_build_array(jsonb_build_object('kind', 'POLICY_SCX', 'who', 'SCX'));
    end if;
  end if;

  v_kind := coalesce(l.permit_kind, (public.symbol_spec_of(l.id)).permit_kind, 'FIRMA');
  if public.permit_required_enabled() is true
     and public.load_needs_permit(l.id) is true then
    if v_kind = 'TRASA' then
      v_permit_missing := exists (
        select 1 from unnest(array['PL', 'SE']) c
         where not exists (
           select 1
             from public.load_permits lp
             join public.permits p on p.id = lp.permit_id
            where lp.load_id = l.id
              and p.country = c
              and coalesce(p.scope, 'TRASA') = 'TRASA'
              and v_anchor between p.valid_from and p.valid_until
         )
      );
    else
      v_permit_missing := not exists (
        select 1
          from public.load_permits lp
          join public.permits p on p.id = lp.permit_id
         where lp.load_id = l.id
           and p.scope = 'FIRMA'
           and v_anchor between p.valid_from and p.valid_until
      );
    end if;
    if v_permit_missing is true then
      gaps := gaps || jsonb_build_array(jsonb_build_object(
        'kind', 'PERMIT',
        'items', case when v_kind = 'TRASA'
          then jsonb_build_array('Trasa')
          else jsonb_build_array('Firma') end,
        'who', 'SCX'
      ));
    end if;
  end if;

  return gaps;
end $$;

revoke all on function public.awiz_missing(uuid) from public, anon, authenticated;
comment on function public.awiz_missing(uuid) is
  'A9+A10: braki do Gotowy (także READY pod demotion); SE poza lukami (F7 B4).';

-- ---------------------------------------------------------------------
-- 2. auto_set_status — dedup z czasem (ponowny automat po cofnięciu)
-- ---------------------------------------------------------------------
create or replace function public.auto_set_status(
  p_load uuid,
  p_from load_status,
  p_to load_status,
  p_reason text,
  p_ts timestamp with time zone,
  p_detail jsonb
) returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_dedup text;
begin
  begin
    perform set_config('tower.status_ctx', 'on', true);
    /* A10: załadunek bez blokady numerów — tylko ścieżka auto_set_status. */
    perform set_config('tower.auto_status', 'on', true);
    update loads set status = p_to where id = p_load and status = p_from;
    if not found then return false; end if;
  exception when others then
    perform raise_risk(p_load, 'AUTO_STATUS', 'HIGH',
      format('Automatyczna zmiana statusu %s → %s zablokowana: %s', p_from, p_to, sqlerrm),
      coalesce(p_detail, '{}'::jsonb) || jsonb_build_object('from', p_from, 'to', p_to, 'blad', sqlerrm,
        'title_key', 'rk_auto_status_blocked', 'params', jsonb_build_object('from', p_from, 'to', p_to, 'error', sqlerrm)),
      'AUTOSTATUS:' || p_load || ':' || p_to);
    return false;
  end;
  /* A10: czas w dedup_key — oś pokazuje nową godzinę po cofnięciu HHL.
     Epoch z ułamkami — dwa auto w tej samej sekundzie nie kolidują. */
  v_dedup := 'STATUS_AUTO:' || p_load || ':' || p_to || ':'
    || replace(extract(epoch from coalesce(p_ts, clock_timestamp()))::text, '.', '');
  insert into load_events (load_id, event_type, occurred_at, payload, dedup_key)
  values (p_load, 'STATUS_AUTO', coalesce(p_ts, now()),
          coalesce(p_detail, '{}'::jsonb) || jsonb_build_object('from', p_from, 'to', p_to, 'powod', p_reason),
          v_dedup)
  on conflict (dedup_key) where dedup_key is not null do nothing;
  return true;
end $function$;

revoke all on function public.auto_set_status(uuid, load_status, load_status, text, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.auto_set_status(uuid, load_status, load_status, text, timestamptz, jsonb)
  to service_role;

-- ---------------------------------------------------------------------
-- 3. a10_prep_target_status / a10_try_prep_status
-- ---------------------------------------------------------------------
create or replace function public.a10_prep_awiz_started(p_load uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l public.loads%rowtype;
  v_escorts int;
begin
  select * into l from public.loads where id = p_load;
  if l.id is null then return false; end if;
  select count(*)::int into v_escorts from public.load_escorts e where e.load_id = l.id;
  return coalesce(btrim(l.driver_name), '') <> ''
      or coalesce(btrim(l.driver_phone), '') <> ''
      or coalesce(btrim(l.tractor_plate), '') <> ''
      or coalesce(btrim(l.trailer_plate), '') <> ''
      or l.sailing_id is not null
      or coalesce(btrim(l.carrier_order_no), '') <> ''
      or coalesce(v_escorts, 0) > 0;
end $$;

revoke all on function public.a10_prep_awiz_started(uuid) from public, anon, authenticated;

create or replace function public.a10_prep_gaps_text(p_gaps jsonb)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(string_agg(x, ', ' order by x), '')
    from (
      select distinct coalesce(
        nullif(btrim(item), ''),
        g->>'kind'
      ) as x
        from jsonb_array_elements(coalesce(p_gaps, '[]'::jsonb)) g
        left join lateral jsonb_array_elements_text(coalesce(g->'items', '[]'::jsonb)) item on true
    ) s
   where coalesce(x, '') <> '';
$$;

revoke all on function public.a10_prep_gaps_text(jsonb) from public, anon, authenticated;

create or replace function public.a10_prep_target_status(p_load uuid)
returns public.load_status
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l public.loads%rowtype;
  v_gaps jsonb;
  v_has_res boolean := false;
  v_has_docs boolean := false;
  v_early timestamptz;
  g jsonb;
  k text;
begin
  select * into l from public.loads where id = p_load;
  if l.id is null then
    return null;
  end if;
  if l.status::text not in ('PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING', 'READY') then
    return l.status;
  end if;

  v_gaps := public.awiz_missing(p_load);

  if public.a10_prep_awiz_started(p_load) is not true then
    begin
      v_early := public.l3_moment(
        public.l3_anchor(l.plan_load_date, l.plan_load_from),
        'AWIZ_EARLY_H'
      );
    exception when others then
      v_early := null;
    end;
    if v_early is not null and now() < v_early then
      return 'PLANNED'::public.load_status;
    end if;
  end if;

  if coalesce(jsonb_array_length(v_gaps), 0) = 0 then
    return 'READY'::public.load_status;
  end if;

  for g in select * from jsonb_array_elements(v_gaps)
  loop
    k := g->>'kind';
    if k in ('CARRIER', 'AWIZ', 'SAILING', 'PILOTS', 'ORDER_SCX', 'ORDER_HHL') then
      v_has_res := true;
    elsif k in ('POLICY_SCX', 'PERMIT') then
      v_has_docs := true;
    else
      v_has_res := true;
    end if;
  end loop;

  if v_has_res then
    return 'RESOURCES_PENDING'::public.load_status;
  end if;
  if v_has_docs then
    return 'DOCS_PENDING'::public.load_status;
  end if;
  return 'READY'::public.load_status;
end $$;

revoke all on function public.a10_prep_target_status(uuid) from public, anon, authenticated;
comment on function public.a10_prep_target_status(uuid) is
  'A10: docelowy status Przygotowania (PLANNED/RESOURCES/DOCS/READY).';

create or replace function public.a10_try_prep_status(p_load uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.load_status;
  v_target public.load_status;
  v_gaps jsonb;
  v_src text;
begin
  if current_setting('tower.dates_ctx', true) = 'on' then
    return false;
  end if;
  if current_setting('tower.bulk_quiet', true) = 'on' then
    return false;
  end if;
  if current_setting('tower.import_ctx', true) = 'on' then
    return false;
  end if;
  select status into v_status from public.loads where id = p_load for update;
  if not found then
    return false;
  end if;
  /* Tylko wewnątrz Przygotowania — poza nim nie cofamy. */
  if v_status::text not in ('PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING', 'READY') then
    return false;
  end if;
  /*
    Zaplanowany bez awizacji: import/nowy transport bez zmian na wyzwalaczu.
    Wyjście z PLANNED dopiero gdy SCX zacznie awizację albo skan 48 h (a10_scan_prep).
  */
  if v_status = 'PLANNED'::public.load_status
     and public.a10_prep_awiz_started(p_load) is not true
     and current_setting('tower.a10_prep_scan', true) is distinct from 'on' then
    return false;
  end if;
  v_target := public.a10_prep_target_status(p_load);
  if v_target is null or v_target = v_status then
    return false;
  end if;
  v_gaps := public.awiz_missing(p_load);
  v_src := case
    when v_target in ('DOCS_PENDING'::public.load_status, 'READY'::public.load_status)
         and v_status in ('DOCS_PENDING'::public.load_status, 'READY'::public.load_status)
      then 'DOC'
    else 'DATA'
  end;
  return public.auto_set_status(
    p_load,
    v_status,
    v_target,
    case v_target
      when 'PLANNED' then 'Przygotowanie: bez awizacji, do załadunku > 48 h'
      when 'RESOURCES_PENDING' then 'Przygotowanie: brak zasobów'
      when 'DOCS_PENDING' then 'Przygotowanie: brak dokumentów'
      when 'READY' then 'Awizacja kompletna'
      else 'Przygotowanie'
    end,
    now(),
    jsonb_build_object('actor', 'system', 'source', v_src, 'gaps', v_gaps)
  );
end $$;

revoke all on function public.a10_try_prep_status(uuid) from public, anon, authenticated;
comment on function public.a10_try_prep_status(uuid) is
  'A10: synchronizacja statusu Przygotowania w obie strony.';

/* A9 zostaje jako cienka nakładka — testy e25 wołają a9_try_ready. */
create or replace function public.a9_try_ready(p_load uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.a10_try_prep_status(p_load);
end $$;

revoke all on function public.a9_try_ready(uuid) from public, anon, authenticated;
comment on function public.a9_try_ready(uuid) is
  'A9→A10: alias a10_try_prep_status (demotion + promotion).';

create or replace function public.a9_trg_loads_ready()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('tower.dates_ctx', true) = 'on' then
    return new;
  end if;
  /* Unikaj pętli: zmiana samego statusu już jest wynikiem automatu. */
  if tg_op = 'UPDATE' and new.status is distinct from old.status
     and current_setting('tower.status_ctx', true) = 'on' then
    return new;
  end if;
  perform public.a10_try_prep_status(new.id);
  return new;
end $$;

revoke all on function public.a9_trg_loads_ready() from public, anon, authenticated;

create or replace function public.a9_trg_related_ready()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_load uuid;
  r record;
begin
  if tg_table_name = 'load_permits' or tg_table_name = 'load_escorts' then
    v_load := coalesce(new.load_id, old.load_id);
    if v_load is not null then
      perform public.a10_try_prep_status(v_load);
    end if;
  elsif tg_table_name = 'insurance_policies' then
    for r in
      select id from public.loads
       where carrier_org_id = coalesce(new.org_id, old.org_id)
         and status::text in ('PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING', 'READY')
    loop
      perform public.a10_try_prep_status(r.id);
    end loop;
  elsif tg_table_name = 'documents' then
    v_load := coalesce(new.load_id, old.load_id);
    if v_load is not null then
      perform public.a10_try_prep_status(v_load);
    end if;
  end if;
  return coalesce(new, old);
end $$;

revoke all on function public.a9_trg_related_ready() from public, anon, authenticated;

drop trigger if exists trg_a9_documents_ready on public.documents;
create trigger trg_a9_documents_ready
  after insert or update or delete on public.documents
  for each row execute function public.a9_trg_related_ready();

-- ---------------------------------------------------------------------
-- 4. apply_geofence_status — A10 rozszerzenia trasy
-- ---------------------------------------------------------------------
create or replace function public.apply_geofence_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_kind    geofence_kind;
  v_gid     uuid;
  v_country char(2);
  v_name    text;
  v_status  load_status;
  v_detail  jsonb;
  v_entered timestamptz;
  v_dwell_min numeric;
  v_project uuid;
  v_title   text;
  v_code    text;
  v_route   text;
  v_op      text;
  v_gaps    jsonb;
  v_gaps_txt text;
  v_dep     timestamptz;
begin
  select status, project_id into v_status, v_project from loads where id = new.load_id;
  if v_status in ('CANCELLED','UNLOADED','DELIVERED','READY_TO_INVOICE','INVOICED') then
    return null;
  end if;
  begin
    v_gid := (new.payload->>'geofence_id')::uuid;
  exception when others then
    return null;
  end;
  select g.kind, g.country, g.name, g.route into v_kind, v_country, v_name, v_route
    from geofences g where g.id = v_gid;
  if v_kind is null then return null; end if;
  v_op := 'POLFERRIES';
  select case when s.route in ('GDY-KAA','KAA-GDY') then 'STENA' else 'POLFERRIES' end
    into v_op from loads l left join sailings s on s.id = l.sailing_id
   where l.id = new.load_id;
  v_op := coalesce(v_op, 'POLFERRIES');

  if coalesce(new.payload->>'synthetic', '') = 'true'
     or coalesce((new.payload->>'actual_load')::boolean, true) is false then
    return null;
  end if;

  v_detail := jsonb_build_object(
    'geofence_id', new.payload->>'geofence_id',
    'geofence_kind', v_kind,
    'geofence_name', coalesce(nullif(new.payload->>'geofence_name', ''), v_name),
    'zdarzenie', new.event_type,
    'source', 'GPS'
  );

  if new.event_type = 'GEOFENCE_ENTER' then

    if v_kind = 'LOADING'
       and v_status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY') then
      /* A10: Załadunek z każdego statusu Przygotowania; ryzyko gdy nie Gotowy. */
      if v_status is distinct from 'READY' then
        v_gaps := public.awiz_missing(new.load_id);
        v_gaps_txt := public.a10_prep_gaps_text(v_gaps);
        perform raise_risk(new.load_id, 'AUTO_STATUS', 'HIGH',
          case when coalesce(v_gaps_txt, '') = '' then
            format('Załadunek bez gotowości (status %s)', v_status)
          else
            format('Załadunek bez gotowości: %s', v_gaps_txt)
          end,
          v_detail || jsonb_build_object(
            'title_key', 'rk_loading_not_ready',
            'params', jsonb_build_object('status', v_status, 'gaps', coalesce(v_gaps_txt, '')),
            'gaps', v_gaps
          ),
          'LOADING_NOT_READY:' || new.load_id);
      end if;
      perform auto_set_status(new.load_id, v_status, 'AT_LOADING',
        'wjazd w strefę załadunku', new.occurred_at, v_detail);

    elsif v_kind = 'PORT_OUT'
          and public.load_status_rank(v_status) >= public.load_status_rank('READY')
          and public.load_status_rank(v_status) <= public.load_status_rank('IN_TRANSIT_PL')
          and coalesce(v_route, 'POLFERRIES') = v_op then
      if auto_set_status(new.load_id, v_status, 'AT_PORT_GDANSK',
           format('wjazd w strefę portu PL (%s)', coalesce(v_name, v_op)),
           new.occurred_at, v_detail)
         and loaded_confirmed(new.load_id) is not true then
        perform raise_risk(new.load_id, 'LOADING_UNCONFIRMED', 'MEDIUM',
          format('Pojazd w porcie PL (%s) bez potwierdzenia załadunku', coalesce(v_name, v_op)),
          v_detail || jsonb_build_object('title_key', 'rk_port_no_loaded', 'params', '{}'::jsonb),
          'PORT_NO_LOADED:' || new.load_id);
      end if;

    elsif v_kind = 'PORT_IN'
          and public.load_status_rank(v_status) < public.load_status_rank('AT_PORT_NYNASHAMN')
          and public.load_status_rank(v_status) >= public.load_status_rank('AT_LOADING')
          and coalesce(v_route, 'POLFERRIES') = v_op then
      /* A10: Port SE z wcześniejszego statusu; pominięty Na promie → wpis FERRY. */
      if v_status is distinct from 'FERRY' then
        select coalesce(s.delayed_departure_at, s.departure_at) into v_dep
          from loads l left join sailings s on s.id = l.sailing_id
         where l.id = new.load_id;
        perform auto_set_status(
          new.load_id, v_status, 'FERRY',
          'wjazd do portu SE — uzupełniony status Na promie',
          coalesce(v_dep, new.occurred_at),
          v_detail || jsonb_build_object('source', 'AIS', 'synthetic_ferry', true)
        );
        select status into v_status from loads where id = new.load_id;
      end if;
      if v_status = 'FERRY' then
        perform auto_set_status(new.load_id, v_status, 'AT_PORT_NYNASHAMN',
          format('wjazd w strefę portu SE (%s)', coalesce(v_name, v_op)),
          new.occurred_at, v_detail);
      end if;

    elsif v_kind = 'SITE'
          and public.load_status_rank(v_status) >= public.load_status_rank('AT_LOADING')
          and public.load_status_rank(v_status) < public.load_status_rank('AT_SITE') then
      perform auto_set_status(new.load_id, v_status, 'AT_SITE',
        'wjazd na plac budowy', new.occurred_at, v_detail);

    -- Awaryjnie: GPS zgubił wyjazd z portu SE albo cały pobyt w porcie
    -- (sygnał wraca dopiero na lądzie). Auto na drogach SE nie może być na promie.
    elsif v_kind in ('CHECKPOINT','PRE_ARRIVAL') and v_country = 'SE'
          and v_status in ('FERRY','AT_PORT_NYNASHAMN') then
      perform auto_set_status(new.load_id, v_status, 'IN_TRANSIT_SE',
        'pozycja na trasie SE — wyjazd z portu niezarejestrowany', new.occurred_at, v_detail);
    end if;

  elsif new.event_type = 'GEOFENCE_EXIT' then

    select s.entered_at into v_entered
      from geofence_states s
     where s.load_id = new.load_id and s.geofence_id = v_gid;
    if v_entered is null and new.payload ? 'entered_at' then
      begin
        v_entered := (new.payload->>'entered_at')::timestamptz;
      exception when others then
        v_entered := null;
      end;
    end if;
    if v_entered is not null then
      v_dwell_min := round(extract(epoch from (new.occurred_at - v_entered)) / 60.0);
    elsif new.payload ? 'dwell_min' then
      v_dwell_min := (new.payload->>'dwell_min')::numeric;
    else
      v_dwell_min := null;
    end if;
    if v_dwell_min is not null then
      v_detail := v_detail || jsonb_build_object('dwell_min', v_dwell_min, 'entered_at', v_entered);
    end if;

    if v_kind = 'LOADING' and v_status = 'AT_LOADING' then
      if v_entered is null then
        null;
      elsif v_dwell_min is not null and v_dwell_min >= 5 then
        if auto_set_status(
             new.load_id, v_status, 'IN_TRANSIT_PL',
             'wyjazd ze strefy załadunku po postoju ≥ 5 min',
             new.occurred_at,
             v_detail
           ) then
          perform set_config('tower.status_ctx', 'on', true);
          update loads
             set actual_load_at = coalesce(actual_load_at, new.occurred_at),
                 updated_at = now()
           where id = new.load_id;
        end if;
      end if;

    elsif v_kind = 'SITE' and v_status = 'AT_SITE' then
      if v_dwell_min is not null and v_dwell_min >= 10 then
        if auto_set_status(
             new.load_id, v_status, 'DELIVERED',
             format('wyjazd z placu po %s min', v_dwell_min::int),
             new.occurred_at,
             v_detail
           ) then
          perform set_config('tower.status_ctx', 'on', true);
          update loads
             set actual_delivery_at = coalesce(actual_delivery_at, new.occurred_at),
                 updated_at = now()
           where id = new.load_id;
        end if;
      elsif v_dwell_min is not null and v_dwell_min < 10 then
        select public.load_sms_code(new.load_id) into v_code;
        v_title := format(
          '%s: wyjazd z placu po %s min — czy dostarczono?',
          coalesce(nullif(v_code, ''), 'transport'),
          v_dwell_min::int
        );
        perform decision_open_from_event(
          v_project,
          'DELIVERED_CHECK',
          'L14:' || new.load_id::text || ':' || v_gid::text || ':'
            || to_char(new.occurred_at at time zone 'UTC', 'YYYYMMDDHH24MI'),
          v_title,
          v_detail || jsonb_build_object(
            'exit_at', new.occurred_at,
            'threshold_min', 10,
            'zone', coalesce(nullif(new.payload->>'geofence_name', ''), v_name)
          ),
          new.load_id,
          null
        );
      end if;

    elsif v_kind = 'PORT_IN' and v_status = 'AT_PORT_NYNASHAMN'
          and coalesce(v_route, 'POLFERRIES') = v_op then
      perform auto_set_status(new.load_id, v_status, 'IN_TRANSIT_SE',
        format('wyjazd ze strefy portu SE (%s)', coalesce(v_name, v_op)),
        new.occurred_at, v_detail);
    end if;
    -- Wyjazd ze strefy portu Gdańsk po przełączeniu na PROM (statek
    -- odpływa) celowo niczego nie zmienia.
  end if;
  return null;
end $function$;

revoke all on function public.apply_geofence_status() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Zapas Na promie (b, c) — bez rejsu w strefie / AIS
-- ---------------------------------------------------------------------
create or replace function public.a10_try_ferry_backup(p_load uuid, p_now timestamptz default now())
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.loads%rowtype;
  v_lat double precision;
  v_lon double precision;
  v_pos_at timestamptz;
  v_vessel uuid;
  v_dep timestamptz;
  v_ais_lat double precision;
  v_ais_lon double precision;
  v_ais_at timestamptz;
  v_in_port boolean;
  v_sea boolean;
  v_near_ais boolean;
  v_dist_m double precision;
begin
  select * into l from public.loads where id = p_load;
  if l.id is null then return false; end if;
  if l.status::text not in ('READY','AT_LOADING','IN_TRANSIT_PL','AT_PORT_GDANSK') then
    return false;
  end if;

  select ST_Y(p.geom_raw::geometry), ST_X(p.geom_raw::geometry), p.ts
    into v_lat, v_lon, v_pos_at
    from positions p
   where p.load_id = l.id
   order by p.ts desc
   limit 1;

  if l.sailing_id is not null then
    select s.vessel_id, coalesce(s.delayed_departure_at, s.departure_at)
      into v_vessel, v_dep
      from sailings s where s.id = l.sailing_id;
  end if;

  /* (b) GPS na morzu (korytarz Bałtyku) albo AIS ≤ 2 km. */
  v_sea := v_lat is not null
       and v_lat between 54.55 and 58.90
       and v_lon between 16.80 and 20.50
       and not exists (
         select 1 from geofence_states gs
           join geofences g on g.id = gs.geofence_id
          where gs.load_id = l.id
            and gs.state in ('INSIDE','PENDING_OUT')
            and g.kind in ('LOADING','PORT_OUT','PORT_IN','SITE','CHECKPOINT','PRE_ARRIVAL')
            and g.active
       );

  v_near_ais := false;
  if v_vessel is not null and v_lat is not null then
    select vp.lat, vp.lon, vp.observed_at into v_ais_lat, v_ais_lon, v_ais_at
      from vessel_positions vp
     where vp.vessel_id = v_vessel
       and vp.observed_at >= p_now - interval '2 hours'
     order by vp.observed_at desc
     limit 1;
    if v_ais_lat is not null then
      v_dist_m := ST_DistanceSphere(
        ST_SetSRID(ST_MakePoint(v_lon, v_lat), 4326),
        ST_SetSRID(ST_MakePoint(v_ais_lon, v_ais_lat), 4326)
      );
      v_near_ais := v_dist_m is not null and v_dist_m <= 2000;
    end if;
  end if;

  if (v_sea is true or v_near_ais is true)
     and public.load_status_rank(l.status) < public.load_status_rank('FERRY') then
    return public.auto_set_status(
      l.id, l.status, 'FERRY',
      case when v_near_ais then 'pozycja zbieżna z AIS statku (≤ 2 km)'
           else 'pozycja GPS na morzu (korytarz rejsu)' end,
      coalesce(v_pos_at, p_now),
      jsonb_build_object(
        'actor', 'system',
        'source', case when v_near_ais then 'AIS' else 'GPS' end,
        'path', 'A10_b'
      )
    );
  end if;

  /* (c) Statek odpłynął (AIS/rozkład), auto ≥ 30 min bez pozycji w porcie PL. */
  if v_dep is not null and v_dep <= p_now then
    select exists (
      select 1 from geofence_states gs
        join geofences g on g.id = gs.geofence_id
       where gs.load_id = l.id and g.kind = 'PORT_OUT' and g.active
         and gs.state in ('INSIDE','PENDING_OUT')
         and (gs.entered_at is null or gs.entered_at <= p_now - interval '30 minutes')
    ) into v_in_port;
    if v_in_port is not true
       and (v_pos_at is null or v_pos_at <= p_now - interval '30 minutes'
            or not exists (
              select 1 from geofence_states gs
                join geofences g on g.id = gs.geofence_id
               where gs.load_id = l.id and g.kind = 'PORT_OUT' and g.active
                 and gs.state in ('INSIDE','PENDING_OUT')
            ))
       and l.status = 'AT_PORT_GDANSK' then
      /* gdy ostatnio w porcie, ale od ≥ 30 min brak świeżej pozycji w porcie */
      if not exists (
        select 1 from positions p
         where p.load_id = l.id
           and p.ts >= p_now - interval '30 minutes'
           and exists (
             select 1 from geofences g
              where g.project_id = l.project_id and g.kind = 'PORT_OUT' and g.active
                and ST_DWithin(
                  g.geom::geography,
                  p.geom_raw::geography,
                  coalesce(g.hysteresis_m, 200)
                )
           )
      ) then
        return public.auto_set_status(
          l.id, l.status, 'FERRY',
          'statek odpłynął — brak pozycji w porcie PL od 30 min',
          coalesce(v_dep, p_now),
          jsonb_build_object('actor', 'system', 'source', 'AIS', 'path', 'A10_c')
        );
      end if;
    end if;
  end if;

  return false;
end $$;

revoke all on function public.a10_try_ferry_backup(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.a10_try_ferry_backup(uuid, timestamptz) to service_role;
comment on function public.a10_try_ferry_backup(uuid, timestamptz) is
  'A10: zapas Na promie (b GPS/AIS, c odejście + 30 min bez portu PL).';

create or replace function public.a10_scan_ferry_backup(p_now timestamptz default now())
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select id from loads
     where status in ('READY','AT_LOADING','IN_TRANSIT_PL','AT_PORT_GDANSK')
  loop
    if public.a10_try_ferry_backup(r.id, p_now) then
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

revoke all on function public.a10_scan_ferry_backup(timestamptz) from public, anon, authenticated;
grant execute on function public.a10_scan_ferry_backup(timestamptz) to service_role;

-- ---------------------------------------------------------------------
-- 6. Po DELIVERED → c17_try_billing_status
--    Nie nadpisuj ręcznego cofnięcia z READY_TO_INVOICE / INVOICED (A10 pkt 2).
-- ---------------------------------------------------------------------
create or replace function public.a10_trg_loads_billing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if new.status = 'DELIVERED'
     and public.load_status_rank(old.status) < public.load_status_rank('DELIVERED'::public.load_status) then
    perform public.c17_try_billing_status(new.id, jsonb_build_object('source', 'A10'));
  end if;
  return new;
end $$;

revoke all on function public.a10_trg_loads_billing() from public, anon, authenticated;

drop trigger if exists trg_a10_loads_billing on public.loads;
create trigger trg_a10_loads_billing
  after update of status on public.loads
  for each row
  execute function public.a10_trg_loads_billing();

-- ---------------------------------------------------------------------
-- 7. Załadunek bez blokady numerów (A10) — przy automacie (status_ctx)
-- ---------------------------------------------------------------------
create or replace function public.enforce_order_numbers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  /* A10: tylko auto_set_status — załadunek bez numerów: ryzyko, bez blokady. */
  if current_setting('tower.auto_status', true) = 'on' then
    return new;
  end if;
  if new.status in ('READY','AT_LOADING','IN_TRANSIT_PL','AT_PORT_GDANSK','FERRY',
                    'AT_PORT_NYNASHAMN','IN_TRANSIT_SE','AT_SITE','UNLOADED','DELIVERED') then
    if new.hhl_order_no is null or btrim(new.hhl_order_no) = '' then
      raise exception 'Transport % bez numeru zlecenia HHL nie może przejść do statusu %', new.id, new.status;
    end if;
  end if;
  if new.status in ('AT_LOADING','IN_TRANSIT_PL','AT_PORT_GDANSK','FERRY',
                    'AT_PORT_NYNASHAMN','IN_TRANSIT_SE','AT_SITE','UNLOADED','DELIVERED') then
    if new.carrier_order_no is null or btrim(new.carrier_order_no) = '' then
      raise exception 'Transport % bez numeru zlecenia przewoźnika nie może przejść do statusu %', new.id, new.status;
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 8. Skan Przygotowania — PLANNED bez awizacji po oknie 48 h → Brak zasobów
-- ---------------------------------------------------------------------
create or replace function public.a10_scan_prep(p_now timestamptz default now())
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n int := 0;
begin
  perform set_config('tower.a10_prep_scan', 'on', true);
  for r in
    select id from loads
     where status = 'PLANNED'
  loop
    if public.a10_try_prep_status(r.id) then
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

revoke all on function public.a10_scan_prep(timestamptz) from public, anon, authenticated;
grant execute on function public.a10_scan_prep(timestamptz) to service_role;
comment on function public.a10_scan_prep(timestamptz) is
  'A10: PLANNED bez awizacji po terminie 48 h → RESOURCES_PENDING.';

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
      from cron.job where jobname = 'tower-a10-prep';
    perform cron.schedule(
      'tower-a10-prep',
      '*/15 * * * *',
      $job$select public.a10_scan_prep()$job$
    );
  end if;
exception when others then
  null;
end $cron$;
