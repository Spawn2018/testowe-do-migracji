-- #653 (właściciel 30.10 01:21): WT→plik — tylko zmienione pole (nie komplet 6).
-- Cofa zachowanie triggera z #650; zostawia ksh_sync_outbound_wt6_patch + enqueue_active_wt
-- jako narzędzie ręczne (bez auto-wywołania).
-- Daty/godziny: jak przed #650 (kontrola konfliktu). 6 pól awizacji/numerów: tylko gdy
-- wartość złożona się zmieniła; pusta nie czyści komórki (usuwa klucz z pending).
-- WT zawsze nadpisuje 6 pól (bez bramki „już w migawce” przy dodawaniu do łatki).

begin;

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
  v_old_tl text;
  v_maybe boolean := false;
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
  v_old_tl := nullif(btrim(coalesce(old.trailer_plate, '')), '');
  if v_drv is distinct from v_old_drv
     or v_ph is distinct from v_old_ph
     or v_tr is distinct from v_old_tr
     or v_tl is distinct from v_old_tl then
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

  -- 6 pól WT→plik: tylko zmienione; WT zawsze nadpisuje (bez bramki migawki przy dodaniu).
  -- Pusta wartość nie czyści komórki — tylko usuwa klucz z pending (N3 bez dokładania innych pól).
  if new.carrier_order_no is distinct from old.carrier_order_no then
    if nullif(btrim(coalesce(new.carrier_order_no, '')), '') is not null then
      v_patch := v_patch || jsonb_build_object('carrier_order_no', new.carrier_order_no);
    else
      v_clear := array_append(v_clear, 'carrier_order_no');
    end if;
  end if;
  if new.hhl_order_no is distinct from old.hhl_order_no then
    if nullif(btrim(coalesce(new.hhl_order_no, '')), '') is not null then
      v_patch := v_patch || jsonb_build_object('hhl_order_no', new.hhl_order_no);
    else
      v_clear := array_append(v_clear, 'hhl_order_no');
    end if;
  end if;

  if v_drv is distinct from v_old_drv then
    if v_drv is not null then
      v_patch := v_patch || jsonb_build_object('driver', v_drv);
    else
      v_clear := array_append(v_clear, 'driver');
    end if;
  end if;
  if v_ph is distinct from v_old_ph then
    if v_ph is not null then
      v_patch := v_patch || jsonb_build_object('driver_phone', v_ph);
    else
      v_clear := array_append(v_clear, 'driver_phone');
    end if;
  end if;
  if v_tr is distinct from v_old_tr then
    if v_tr is not null then
      v_patch := v_patch || jsonb_build_object('tractor', v_tr);
    else
      v_clear := array_append(v_clear, 'tractor');
    end if;
  end if;
  if v_tl is distinct from v_old_tl then
    if v_tl is not null then
      v_patch := v_patch || jsonb_build_object('trailer', v_tl);
    else
      v_clear := array_append(v_clear, 'trailer');
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

  if v_patch = '{}'::jsonb then
    return new;
  end if;

  perform public.ksh_sync_outbound_enqueue(new.id, v_patch, v_exp);
  return new;
end;
$$;

comment on function public.trg_ksh_sync_outbound() is
  'A6/#597/#653: kolejka WT→plik — daty (dates_ctx) + tylko zmienione pola awizacji/numerów; bez dokładania kompletu 6; nie przy import_ctx; STEGRA_*; bez CANCELLED/REMOVED.';

comment on function public.ksh_sync_outbound_wt6_patch(uuid) is
  '#650/#653: komplet 6 pól WT→plik — tylko dla ręcznego ksh_sync_outbound_enqueue_active_wt (trigger go nie dokłada).';

comment on function public.ksh_sync_outbound_enqueue_active_wt() is
  '#650/#653: ręczne zakolejkowanie kompletu 6 pól WT→plik (bez auto); HHL_ADMIN+2FA; wymaga write_enabled; decyzja właściciela: nie wywoływać wstecznie.';

commit;
