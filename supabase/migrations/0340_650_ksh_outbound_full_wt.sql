-- #650: kolejka WT→plik KSH — zawsze komplet 6 pól (kierowca/telefon/ciągnik/naczepa
-- + hhl_order_no + carrier_order_no), nie tylko ostatnia zmiana.
-- Mapowanie: carrier_order_no → „Nr zlecenia HHL-Scan”; hhl_order_no → „Nr zlecenia HHL-KSH”.
-- Pusta wartość WT nie czyści komórki (jak dotąd). skip_applied w Edge pomija już zgodne.

begin;

-- Bieżący stan 6 pól WT→plik (niepuste); format ksh_file_ab / ksh_file_phone_text.
create or replace function public.ksh_sync_outbound_wt6_patch(p_load uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l record;
  v jsonb := '{}'::jsonb;
  v_drv text;
  v_ph text;
  v_tr text;
  v_tl text;
  v_co text;
  v_ho text;
begin
  if p_load is null then
    return '{}'::jsonb;
  end if;
  select * into l from public.loads where id = p_load;
  if l.id is null then
    return '{}'::jsonb;
  end if;
  v_drv := public.ksh_file_ab(l.driver_name, l.driver_delivery_name, l.trailer_swap);
  v_ph := public.ksh_file_ab(
    public.ksh_file_phone_text(l.driver_phone, l.driver_phone_country),
    public.ksh_file_phone_text(l.driver_delivery_phone, l.driver_delivery_phone_country),
    l.trailer_swap
  );
  v_tr := public.ksh_file_ab(l.tractor_plate, l.tractor_delivery_plate, l.trailer_swap);
  v_tl := nullif(btrim(coalesce(l.trailer_plate, '')), '');
  v_co := nullif(btrim(coalesce(l.carrier_order_no, '')), '');
  v_ho := nullif(btrim(coalesce(l.hhl_order_no, '')), '');
  if v_drv is not null then
    v := v || jsonb_build_object('driver', v_drv);
  end if;
  if v_ph is not null then
    v := v || jsonb_build_object('driver_phone', v_ph);
  end if;
  if v_tr is not null then
    v := v || jsonb_build_object('tractor', v_tr);
  end if;
  if v_tl is not null then
    v := v || jsonb_build_object('trailer', v_tl);
  end if;
  if v_co is not null then
    v := v || jsonb_build_object('carrier_order_no', v_co);
  end if;
  if v_ho is not null then
    v := v || jsonb_build_object('hhl_order_no', v_ho);
  end if;
  return v;
end;
$$;

revoke all on function public.ksh_sync_outbound_wt6_patch(uuid) from public, anon, authenticated;
grant execute on function public.ksh_sync_outbound_wt6_patch(uuid) to service_role;

comment on function public.ksh_sync_outbound_wt6_patch(uuid) is
  '#650: komplet 6 pól WT→plik (driver/phone/tractor/trailer/hhl_order_no/carrier_order_no); puste pomija.';

create or replace function public.trg_ksh_sync_outbound() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patch jsonb := '{}'::jsonb;
  v_clear text[] := '{}'::text[];
  v_exp jsonb;
  v_snap jsonb;
  v_state_snap jsonb;
  v_exp_file jsonb;
  v_pend_patch jsonb;
  v_code text;
  v_proj_code text;
  v_load_time text;
  v_deliv_time text;
  v_k text;
  v_drv text;
  v_ph text;
  v_tr text;
  v_tl text;
  v_old_drv text;
  v_old_ph text;
  v_old_tr text;
  v_maybe boolean := false;
  v_wt6 jsonb;
  v_wt6_keys text[] := array[
    'driver', 'driver_phone', 'tractor', 'trailer', 'carrier_order_no', 'hhl_order_no'
  ];
begin
  if current_setting('tower.import_ctx', true) = 'on' then
    return new;
  end if;

  select p.code into v_proj_code from public.projects p where p.id = new.project_id;
  if (v_proj_code in ('STEGRA_BODEN', 'STEGRA')) is not true then
    return new;
  end if;

  if new.status in ('CANCELLED', 'REMOVED') then
    return new;
  end if;

  if not exists (
    select 1 from public.ksh_sync_state s
     where s.project_id = new.project_id and s.write_enabled is true
  ) then
    return new;
  end if;

  if current_setting('tower.dates_ctx', true) = 'on' then
    if new.plan_load_date is distinct from old.plan_load_date
       or new.plan_load_from is distinct from old.plan_load_from
       or new.plan_delivery_date is distinct from old.plan_delivery_date
       or new.plan_delivery_to is distinct from old.plan_delivery_to then
      v_maybe := true;
    end if;
  end if;
  if new.carrier_order_no is distinct from old.carrier_order_no
     or new.hhl_order_no is distinct from old.hhl_order_no then
    v_maybe := true;
  end if;
  v_drv := public.ksh_file_ab(new.driver_name, new.driver_delivery_name, new.trailer_swap);
  v_ph := public.ksh_file_ab(
    public.ksh_file_phone_text(new.driver_phone, new.driver_phone_country),
    public.ksh_file_phone_text(new.driver_delivery_phone, new.driver_delivery_phone_country),
    new.trailer_swap
  );
  v_tr := public.ksh_file_ab(new.tractor_plate, new.tractor_delivery_plate, new.trailer_swap);
  v_tl := nullif(btrim(coalesce(new.trailer_plate, '')), '');
  v_old_drv := public.ksh_file_ab(old.driver_name, old.driver_delivery_name, old.trailer_swap);
  v_old_ph := public.ksh_file_ab(
    public.ksh_file_phone_text(old.driver_phone, old.driver_phone_country),
    public.ksh_file_phone_text(old.driver_delivery_phone, old.driver_delivery_phone_country),
    old.trailer_swap
  );
  v_old_tr := public.ksh_file_ab(old.tractor_plate, old.tractor_delivery_plate, old.trailer_swap);
  if v_drv is distinct from v_old_drv
     or v_ph is distinct from v_old_ph
     or v_tr is distinct from v_old_tr
     or v_tl is distinct from nullif(btrim(coalesce(old.trailer_plate, '')), '') then
    v_maybe := true;
  end if;
  if v_maybe is not true then
    return new;
  end if;

  v_code := public.load_sms_code(new.id);
  select o.expected_file, o.patch into v_exp_file, v_pend_patch
    from public.ksh_sync_outbound o
   where o.load_id = new.id and o.status = 'pending'
   order by o.id
   limit 1;
  select s.snapshot -> v_code into v_state_snap
    from public.ksh_sync_state s where s.project_id = new.project_id;
  if v_exp_file is not null then
    v_exp := v_exp_file;
  elsif v_state_snap is not null then
    v_exp := v_state_snap;
  end if;

  if current_setting('tower.dates_ctx', true) = 'on' then
    if new.plan_load_date is distinct from old.plan_load_date then
      v_snap := case when coalesce(v_pend_patch, '{}'::jsonb) ? 'load_date'
                     then v_exp_file else v_state_snap end;
      if new.plan_load_date is not null
         and (v_snap is null or (v_snap->>'ld') is distinct from new.plan_load_date::text) then
        v_patch := v_patch || jsonb_build_object('load_date', new.plan_load_date);
      elsif v_snap is not null
         and (v_snap->>'ld') is not distinct from new.plan_load_date::text then
        v_clear := array_append(v_clear, 'load_date');
      end if;
    end if;
    if new.plan_load_from is distinct from old.plan_load_from then
      if new.plan_load_from is not null then
        v_load_time := to_char(new.plan_load_from at time zone 'Europe/Warsaw', 'HH24:MI');
        v_snap := case when coalesce(v_pend_patch, '{}'::jsonb) ? 'load_time'
                       then v_exp_file else v_state_snap end;
        if (v_snap is null or (v_snap->>'lt') is distinct from v_load_time) then
          v_patch := v_patch || jsonb_build_object('load_time', v_load_time);
        elsif v_snap is not null and (v_snap->>'lt') is not distinct from v_load_time then
          v_clear := array_append(v_clear, 'load_time');
        end if;
      end if;
    end if;
    if new.plan_delivery_date is distinct from old.plan_delivery_date then
      v_snap := case when coalesce(v_pend_patch, '{}'::jsonb) ? 'delivery_date'
                     then v_exp_file else v_state_snap end;
      if new.plan_delivery_date is not null
         and (v_snap is null or (v_snap->>'dd') is distinct from new.plan_delivery_date::text) then
        v_patch := v_patch || jsonb_build_object('delivery_date', new.plan_delivery_date);
      elsif v_snap is not null
         and (v_snap->>'dd') is not distinct from new.plan_delivery_date::text then
        v_clear := array_append(v_clear, 'delivery_date');
      end if;
    end if;
    if new.plan_delivery_to is distinct from old.plan_delivery_to then
      if new.plan_delivery_to is not null then
        v_deliv_time := to_char(new.plan_delivery_to at time zone 'Europe/Stockholm', 'HH24:MI');
        v_snap := case when coalesce(v_pend_patch, '{}'::jsonb) ? 'delivery_time'
                       then v_exp_file else v_state_snap end;
        if (v_snap is null or (v_snap->>'dt') is distinct from v_deliv_time) then
          v_patch := v_patch || jsonb_build_object('delivery_time', v_deliv_time);
        elsif v_snap is not null and (v_snap->>'dt') is not distinct from v_deliv_time then
          v_clear := array_append(v_clear, 'delivery_time');
        end if;
      end if;
    end if;
  end if;

  -- Numery: clear przy powrocie do wartości z pliku; wartości WT dołoży wt6.
  if new.carrier_order_no is distinct from old.carrier_order_no then
    v_snap := case when coalesce(v_pend_patch, '{}'::jsonb) ? 'carrier_order_no'
                   then v_exp_file else v_state_snap end;
    if v_snap is not null
       and (v_snap->>'co') is not distinct from new.carrier_order_no then
      v_clear := array_append(v_clear, 'carrier_order_no');
    end if;
  end if;
  if new.hhl_order_no is distinct from old.hhl_order_no then
    v_snap := case when coalesce(v_pend_patch, '{}'::jsonb) ? 'hhl_order_no'
                   then v_exp_file else v_state_snap end;
    if v_snap is not null
       and (v_snap->>'ho') is not distinct from new.hhl_order_no then
      v_clear := array_append(v_clear, 'hhl_order_no');
    end if;
  end if;

  if cardinality(v_clear) > 0 then
    foreach v_k in array v_clear loop
      update public.ksh_sync_outbound
         set patch = patch - v_k,
             rev = rev + 1
       where load_id = new.id and status = 'pending' and patch ? v_k;
    end loop;
    update public.ksh_sync_outbound
       set status = 'skipped',
           done_at = now(),
           last_error = 'reverted_to_file',
           rev = rev + 1
     where load_id = new.id and status = 'pending' and patch = '{}'::jsonb;
  end if;

  -- #650: każda pozycja kolejki = komplet 6 pól z bieżącego WT (+ daty z v_patch).
  -- N3: klucz WT6 wyczyszczony w WT → usuń ze starego pending (merge || nie zostawia starej wartości).
  v_wt6 := public.ksh_sync_outbound_wt6_patch(new.id);
  foreach v_k in array v_wt6_keys loop
    if (v_wt6 ? v_k) is not true then
      update public.ksh_sync_outbound
         set patch = patch - v_k,
             rev = rev + 1
       where load_id = new.id and status = 'pending' and patch ? v_k;
    end if;
  end loop;
  update public.ksh_sync_outbound
     set status = 'skipped',
         done_at = now(),
         last_error = 'wt6_cleared',
         rev = rev + 1
   where load_id = new.id and status = 'pending' and patch = '{}'::jsonb;

  v_patch := v_patch || v_wt6;

  if v_patch = '{}'::jsonb then
    return new;
  end if;

  perform public.ksh_sync_outbound_enqueue(new.id, v_patch, v_exp);
  return new;
end;
$$;

comment on function public.trg_ksh_sync_outbound() is
  'A6/#597/#650: kolejka WT→plik — daty (dates_ctx) + zawsze komplet 6 pól awizacji/numerów; nie przy import_ctx; STEGRA_*; bez CANCELLED/REMOVED.';

-- Jednorazowe uzupełnienie aktywnych: enqueue wt6 dla transportów z niepustym kompletem.
create or replace function public.ksh_sync_outbound_enqueue_active_wt()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_role public.user_role;
  v_pid uuid;
  r record;
  v_patch jsonb;
  v_exp jsonb;
  v_code text;
  v_k text;
  v_n int := 0;
begin
  perform public.assert_not_preview();
  select id, role into v_me, v_role
    from public.app_users
   where auth_id = auth.uid() and active;
  if (v_me is not null and v_role = 'HHL_ADMIN' and public.mfa_satisfied(v_role) is true) is not true then
    raise exception 'Tylko Administrator HHL z 2FA' using errcode = '42501';
  end if;
  select id into v_pid from public.projects
   where code in ('STEGRA_BODEN', 'STEGRA')
   order by case code when 'STEGRA_BODEN' then 0 else 1 end
   limit 1;
  if v_pid is null then
    raise exception 'Brak projektu KSH (STEGRA_BODEN)' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.ksh_sync_state s
     where s.project_id = v_pid and s.write_enabled is true
  ) then
    return 0;
  end if;

  -- „Aktywne” = wszystko poza CANCELLED/REMOVED (także dostarczone — numery mają być w pliku).
  for r in
    select l.id
      from public.loads l
     where l.project_id = v_pid
       and l.status not in ('CANCELLED', 'REMOVED')
     order by l.id
  loop
    v_patch := public.ksh_sync_outbound_wt6_patch(r.id);
    -- N3: usuń z pending klucze WT6 nieobecne w bieżącym wt6 (wyczyszczone w WT).
    foreach v_k in array array[
      'driver', 'driver_phone', 'tractor', 'trailer', 'carrier_order_no', 'hhl_order_no'
    ] loop
      if (v_patch ? v_k) is not true then
        update public.ksh_sync_outbound
           set patch = patch - v_k, rev = rev + 1
         where load_id = r.id and status = 'pending' and patch ? v_k;
      end if;
    end loop;
    if v_patch = '{}'::jsonb then
      continue;
    end if;
    v_code := public.load_sms_code(r.id);
    select s.snapshot -> v_code into v_exp
      from public.ksh_sync_state s where s.project_id = v_pid;
    perform public.ksh_sync_outbound_enqueue(r.id, v_patch, v_exp);
    v_n := v_n + 1;
  end loop;

  insert into public.audit_log (user_id, action, entity, entity_id, new_value)
  values (
    v_me, 'KSH_SYNC_OUTBOUND_BACKFILL_WT', 'ksh_sync_state', v_pid::text,
    jsonb_build_object('enqueued', v_n)
  );
  return v_n;
end;
$$;

revoke all on function public.ksh_sync_outbound_enqueue_active_wt() from public, anon;
grant execute on function public.ksh_sync_outbound_enqueue_active_wt() to authenticated;

comment on function public.ksh_sync_outbound_enqueue_active_wt() is
  '#650: jednorazowe zakolejkowanie kompletu 6 pól WT→plik dla aktywnych STEGRA_* (wszystko poza CANCELLED/REMOVED, także dostarczone); HHL_ADMIN+2FA; wymaga write_enabled.';

commit;
