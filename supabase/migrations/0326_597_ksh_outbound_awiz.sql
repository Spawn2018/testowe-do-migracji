-- #597: Awizacja (kierowca/telefon/ciągnik/naczepa) → kolejka ksh_sync_outbound (WT→plik).
-- Zasady właściciela 28.10 14:28: te pola tylko WT→plik, format „PL / SE” przy przepięciu.
-- F7 r1: wt_diff + apply_sent znają 4 klucze; telefon OTHER z „+”; kolejka po złożonym ab.
begin;

-- Tekst telefonu do komórki pliku (cyfry / wiodące 0 SE / „+” gdy inne).
create or replace function public.ksh_file_phone_text(p_phone text, p_country text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v text := nullif(btrim(coalesce(p_phone, '')), '');
  d text;
  c text := upper(nullif(btrim(coalesce(p_country, '')), ''));
begin
  if v is null then
    return null;
  end if;
  d := regexp_replace(v, '\D', '', 'g');
  if d = '' then
    return null;
  end if;
  if d like '00%' then
    d := substr(d, 3);
  end if;
  if c = 'SE' or (c is null and (v like '+46%' or d like '46%')) then
    if d like '46%' and length(d) >= 10 then
      d := substr(d, 3);
    end if;
    if d not like '0%' then
      d := '0' || d;
    end if;
    return d;
  end if;
  -- PL (i null bez +46): same cyfry, bez „+”.
  if c = 'PL' or c is null then
    if d like '48%' and length(d) >= 11 then
      d := substr(d, 3);
    end if;
    return d;
  end if;
  -- OTHER / inny kraj: zachowaj „+” gdy było (F7 #597).
  if v like '+%' then
    return '+' || d;
  end if;
  return d;
end;
$$;

revoke all on function public.ksh_file_phone_text(text, text) from public, anon, authenticated;
grant execute on function public.ksh_file_phone_text(text, text) to service_role;

comment on function public.ksh_file_phone_text(text, text) is
  '#597: telefon do komórki KSH — PL cyfry, SE z 0, OTHER z „+”, nigdy formuła.';

-- „A / B” przy przepięciu; bez SE = sama wartość PL.
create or replace function public.ksh_file_ab(p_pl text, p_se text, p_swap boolean)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when coalesce(p_swap, false)
         and nullif(btrim(coalesce(p_pl, '')), '') is not null
         and nullif(btrim(coalesce(p_se, '')), '') is not null
      then btrim(p_pl) || ' / ' || btrim(p_se)
    when nullif(btrim(coalesce(p_pl, '')), '') is not null
      then btrim(p_pl)
    when coalesce(p_swap, false)
         and nullif(btrim(coalesce(p_se, '')), '') is not null
      then btrim(p_se)
    else null
  end;
$$;

revoke all on function public.ksh_file_ab(text, text, boolean) from public, anon, authenticated;
grant execute on function public.ksh_file_ab(text, text, boolean) to service_role;

comment on function public.ksh_file_ab(text, text, boolean) is
  '#597: wartość komórki KSH „PL / SE” przy trailer_swap; inaczej sama PL.';

-- F7 #597 B2: apply_sent mapuje też awizację (dr/ph/tr/tl).
create or replace function public.ksh_sync_outbound_apply_sent(p_exp jsonb, p_sent jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v jsonb := coalesce(p_exp, '{}'::jsonb);
begin
  if p_sent is null or jsonb_typeof(p_sent) is distinct from 'object' then
    return v;
  end if;
  if p_sent ? 'load_date' then
    v := jsonb_set(v, '{ld}', coalesce(to_jsonb(p_sent->>'load_date'), 'null'::jsonb));
  end if;
  if p_sent ? 'load_time' then
    v := jsonb_set(v, '{lt}', coalesce(to_jsonb(p_sent->>'load_time'), 'null'::jsonb));
  end if;
  if p_sent ? 'delivery_date' then
    v := jsonb_set(v, '{dd}', coalesce(to_jsonb(p_sent->>'delivery_date'), 'null'::jsonb));
  end if;
  if p_sent ? 'delivery_time' then
    v := jsonb_set(v, '{dt}', coalesce(to_jsonb(p_sent->>'delivery_time'), 'null'::jsonb));
  end if;
  if p_sent ? 'carrier_order_no' then
    v := jsonb_set(v, '{co}', coalesce(to_jsonb(p_sent->>'carrier_order_no'), 'null'::jsonb));
  end if;
  if p_sent ? 'hhl_order_no' then
    v := jsonb_set(v, '{ho}', coalesce(to_jsonb(p_sent->>'hhl_order_no'), 'null'::jsonb));
  end if;
  if p_sent ? 'driver' then
    v := jsonb_set(v, '{dr}', coalesce(to_jsonb(p_sent->>'driver'), 'null'::jsonb));
  end if;
  if p_sent ? 'driver_phone' then
    v := jsonb_set(v, '{ph}', coalesce(to_jsonb(p_sent->>'driver_phone'), 'null'::jsonb));
  end if;
  if p_sent ? 'tractor' then
    v := jsonb_set(v, '{tr}', coalesce(to_jsonb(p_sent->>'tractor'), 'null'::jsonb));
  end if;
  if p_sent ? 'trailer' then
    v := jsonb_set(v, '{tl}', coalesce(to_jsonb(p_sent->>'trailer'), 'null'::jsonb));
  end if;
  return v;
end;
$$;

revoke all on function public.ksh_sync_outbound_apply_sent(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.ksh_sync_outbound_apply_sent(jsonb, jsonb) to service_role;

comment on function public.ksh_sync_outbound_apply_sent(jsonb, jsonb) is
  'A6/#597: expected_file po sent — ld/lt/dd/dt/co/ho + dr/ph/tr/tl (awizacja).';

-- F7 #597 B2: wt_diff od ostatniej wersji WT — także awizacja; brak klucza w snap = różne.
create or replace function public.ksh_sync_outbound_wt_diff(
  p_load uuid, p_file jsonb, p_keys jsonb default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l record;
  v_patch jsonb := '{}'::jsonb;
  v_lt text;
  v_dt text;
  v_co text;
  v_ho text;
  v_drv text;
  v_ph text;
  v_tr text;
  v_tl text;
  v_allow boolean;
begin
  select * into l from public.loads where id = p_load;
  if l.id is null then
    return '{}'::jsonb;
  end if;
  v_allow := (p_keys is null or jsonb_typeof(p_keys) is distinct from 'object');
  v_co := nullif(btrim(l.carrier_order_no), '');
  v_ho := nullif(btrim(l.hhl_order_no), '');
  if l.plan_load_from is not null then
    v_lt := to_char(l.plan_load_from at time zone 'Europe/Warsaw', 'HH24:MI');
  end if;
  if l.plan_delivery_to is not null then
    v_dt := to_char(l.plan_delivery_to at time zone 'Europe/Stockholm', 'HH24:MI');
  end if;
  v_drv := public.ksh_file_ab(l.driver_name, l.driver_delivery_name, l.trailer_swap);
  v_ph := public.ksh_file_ab(
    public.ksh_file_phone_text(l.driver_phone, l.driver_phone_country),
    public.ksh_file_phone_text(l.driver_delivery_phone, l.driver_delivery_phone_country),
    l.trailer_swap
  );
  v_tr := public.ksh_file_ab(l.tractor_plate, l.tractor_delivery_plate, l.trailer_swap);
  v_tl := nullif(btrim(coalesce(l.trailer_plate, '')), '');

  if (v_allow or p_keys ? 'load_date')
     and l.plan_load_date is not null
     and (p_file->>'ld') is distinct from l.plan_load_date::text then
    v_patch := v_patch || jsonb_build_object('load_date', l.plan_load_date);
  end if;
  if (v_allow or p_keys ? 'load_time')
     and v_lt is not null and (p_file->>'lt') is distinct from v_lt then
    v_patch := v_patch || jsonb_build_object('load_time', v_lt);
  end if;
  if (v_allow or p_keys ? 'delivery_date')
     and l.plan_delivery_date is not null
     and (p_file->>'dd') is distinct from l.plan_delivery_date::text then
    v_patch := v_patch || jsonb_build_object('delivery_date', l.plan_delivery_date);
  end if;
  if (v_allow or p_keys ? 'delivery_time')
     and v_dt is not null and (p_file->>'dt') is distinct from v_dt then
    v_patch := v_patch || jsonb_build_object('delivery_time', v_dt);
  end if;
  if (v_allow or p_keys ? 'carrier_order_no')
     and v_co is not null and (p_file->>'co') is distinct from v_co then
    v_patch := v_patch || jsonb_build_object('carrier_order_no', v_co);
  end if;
  if (v_allow or p_keys ? 'hhl_order_no')
     and v_ho is not null and (p_file->>'ho') is distinct from v_ho then
    v_patch := v_patch || jsonb_build_object('hhl_order_no', v_ho);
  end if;
  if (v_allow or p_keys ? 'driver')
     and v_drv is not null and (p_file->>'dr') is distinct from v_drv then
    v_patch := v_patch || jsonb_build_object('driver', v_drv);
  end if;
  if (v_allow or p_keys ? 'driver_phone')
     and v_ph is not null and (p_file->>'ph') is distinct from v_ph then
    v_patch := v_patch || jsonb_build_object('driver_phone', v_ph);
  end if;
  if (v_allow or p_keys ? 'tractor')
     and v_tr is not null and (p_file->>'tr') is distinct from v_tr then
    v_patch := v_patch || jsonb_build_object('tractor', v_tr);
  end if;
  if (v_allow or p_keys ? 'trailer')
     and v_tl is not null and (p_file->>'tl') is distinct from v_tl then
    v_patch := v_patch || jsonb_build_object('trailer', v_tl);
  end if;
  return v_patch;
end;
$$;

drop function if exists public.ksh_sync_outbound_wt_diff(uuid, jsonb);
revoke all on function public.ksh_sync_outbound_wt_diff(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.ksh_sync_outbound_wt_diff(uuid, jsonb, jsonb) to service_role;

comment on function public.ksh_sync_outbound_wt_diff(uuid, jsonb, jsonb) is
  'A6/#597: diff WT↔plik po sent — daty/numery + driver/phone/tractor/trailer; brak klucza w snap = różne.';

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
begin
  if current_setting('tower.import_ctx', true) = 'on' then
    return new;
  end if;

  select p.code into v_proj_code from public.projects p where p.id = new.project_id;
  if (v_proj_code in ('STEGRA_BODEN', 'STEGRA')) is not true then
    return new;
  end if;

  -- #597: anulowany / usunięty — bez zapisu (także dat/numerów) do pliku.
  if new.status in ('CANCELLED', 'REMOVED') then
    return new;
  end if;

  if not exists (
    select 1 from public.ksh_sync_state s
     where s.project_id = new.project_id and s.write_enabled is true
  ) then
    return new;
  end if;

  -- F7: wczesne wyjście — nic z pól outbound nie zmienione.
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

  if new.carrier_order_no is distinct from old.carrier_order_no then
    v_snap := case when coalesce(v_pend_patch, '{}'::jsonb) ? 'carrier_order_no'
                   then v_exp_file else v_state_snap end;
    if nullif(btrim(new.carrier_order_no), '') is not null
       and (v_snap is null or (v_snap->>'co') is distinct from new.carrier_order_no) then
      v_patch := v_patch || jsonb_build_object('carrier_order_no', new.carrier_order_no);
    elsif v_snap is not null
       and (v_snap->>'co') is not distinct from new.carrier_order_no then
      v_clear := array_append(v_clear, 'carrier_order_no');
    end if;
  end if;
  if new.hhl_order_no is distinct from old.hhl_order_no then
    v_snap := case when coalesce(v_pend_patch, '{}'::jsonb) ? 'hhl_order_no'
                   then v_exp_file else v_state_snap end;
    if nullif(btrim(new.hhl_order_no), '') is not null
       and (v_snap is null or (v_snap->>'ho') is distinct from new.hhl_order_no) then
      v_patch := v_patch || jsonb_build_object('hhl_order_no', new.hhl_order_no);
    elsif v_snap is not null
       and (v_snap->>'ho') is not distinct from new.hhl_order_no then
      v_clear := array_append(v_clear, 'hhl_order_no');
    end if;
  end if;

  -- #597 F7: kolejka tylko gdy złożona wartość komórki się zmieniła.
  if v_drv is not null and v_drv is distinct from v_old_drv then
    v_patch := v_patch || jsonb_build_object('driver', v_drv);
  end if;
  if v_ph is not null and v_ph is distinct from v_old_ph then
    v_patch := v_patch || jsonb_build_object('driver_phone', v_ph);
  end if;
  if v_tr is not null and v_tr is distinct from v_old_tr then
    v_patch := v_patch || jsonb_build_object('tractor', v_tr);
  end if;
  if v_tl is not null
     and v_tl is distinct from nullif(btrim(coalesce(old.trailer_plate, '')), '') then
    v_patch := v_patch || jsonb_build_object('trailer', v_tl);
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

drop trigger if exists trg_ksh_sync_outbound on public.loads;
create trigger trg_ksh_sync_outbound
  after update of
    plan_load_date, plan_load_from, plan_load_to,
    plan_delivery_date, plan_delivery_from, plan_delivery_to,
    carrier_order_no, hhl_order_no,
    driver_name, driver_delivery_name,
    driver_phone, driver_delivery_phone,
    driver_phone_country, driver_delivery_phone_country,
    tractor_plate, tractor_delivery_plate,
    trailer_plate, trailer_swap,
    status
  on public.loads
  for each row
  execute function public.trg_ksh_sync_outbound();

comment on function public.trg_ksh_sync_outbound() is
  'A6/#597: kolejka WT→plik — daty (dates_ctx), numery zleceń, awizacja (kierowca/telefon/ciągnik/naczepa); nie przy import_ctx; STEGRA_*; bez CANCELLED/REMOVED.';

commit;
