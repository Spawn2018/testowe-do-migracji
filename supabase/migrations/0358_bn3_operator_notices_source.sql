-- BN3 (#573): operator_notices.source AUTO/RECZNIE + source_url (decyzja 57).
-- created_by null dla AUTO (job Edge); RECZNIE = ręczny operator_notice_apply.
-- B5: pierwsza instrukcja po begin = perform assert_not_preview.

alter table public.operator_notices
  alter column created_by drop not null;

alter table public.operator_notices
  add column if not exists source text not null default 'RECZNIE';

alter table public.operator_notices
  drop constraint if exists operator_notices_source_check;

alter table public.operator_notices
  add constraint operator_notices_source_check
  check (source in ('AUTO', 'RECZNIE'));

alter table public.operator_notices
  add column if not exists source_url text;

comment on column public.operator_notices.source is
  'BN3 decyzja 57: AUTO = komunikat z odczytu (job), RECZNIE = formularz HHL/SCX.';
comment on column public.operator_notices.source_url is
  'BN3: URL źródła dla AUTO (ts.ee, tallink.com, …); null przy RECZNIE.';
comment on column public.operator_notices.created_by is
  'Użytkownik przy RECZNIE; null przy AUTO.';

comment on table public.operator_notices is
  'FERRY-STATUS / BN3: komunikat armatora (ręczny RECZNIE albo AUTO z odczytu). '
  'Skutki jak status automatyczny (ETA, FERRY_CANCELLED). Historia: kto/źródło i kiedy.';

-- Odśwież apply: source = RECZNIE przy ręcznym wpisie.
drop function if exists public.operator_notice_apply(uuid, text, timestamptz, text);
drop function if exists public.operator_notice_apply(uuid, text, timestamptz, text, text);

create or replace function public.operator_notice_apply(
  p_sailing uuid,
  p_kind text,
  p_new_departure timestamptz,
  p_note text,
  p_operator text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_user uuid;
  v_route text;
  v_source text;
  v_vessel_op text;
  v_op text;
  v_dep timestamptz;
  v_arr timestamptz;
  v_id uuid;
  v_delta interval;
begin
  perform public.assert_not_preview();
  if (current_app_role() in ('HHL_ADMIN', 'CARRIER_DISPATCH')) is not true then
    raise exception 'Komunikat armatora — wyłącznie administrator albo dyspozytor przewoźnika'
      using errcode = '42501';
  end if;
  v_user := current_app_user_id();
  if v_user is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if p_sailing is null or p_kind is null or p_kind not in ('ODWOLANY', 'OPOZNIONY', 'ZMIANA_GODZINY') then
    raise exception 'Brak rejsu albo nieznany typ komunikatu' using errcode = '22023';
  end if;
  if p_kind <> 'ODWOLANY' and p_new_departure is null then
    raise exception 'Nowa godzina jest wymagana' using errcode = '22023';
  end if;

  select s.route,
         s.source,
         v.operator,
         coalesce(s.delayed_departure_at, s.departure_at),
         coalesce(s.delayed_arrival_at, s.arrival_at)
    into v_route, v_source, v_vessel_op, v_dep, v_arr
    from sailings s
    left join vessels v on v.id = s.vessel_id
   where s.id = p_sailing;
  if v_route is null then
    raise exception 'Brak rejsu' using errcode = '22023';
  end if;

  if p_operator is not null and btrim(p_operator) <> '' then
    v_op := upper(btrim(p_operator));
    if not exists (
      select 1 from ferry_route_operators fro
       where fro.route_code = v_route and fro.operator_code = v_op
    ) then
      raise exception 'Armator nie obsługuje tej trasy' using errcode = '22023';
    end if;
  end if;

  if v_op is null
     and v_source is not null
     and upper(btrim(v_source)) not in ('RECZNIE', 'DANE_STARTOWE')
     and exists (
       select 1 from ferry_operators fo where fo.code = upper(btrim(v_source))
     ) then
    v_op := upper(btrim(v_source));
  end if;

  if v_op is null and v_vessel_op is not null and btrim(v_vessel_op) <> '' then
    select fo.code into v_op
      from ferry_operators fo
     where fo.code = upper(btrim(v_vessel_op))
        or lower(fo.name) = lower(btrim(v_vessel_op))
     order by case
       when fo.code = upper(btrim(v_vessel_op)) then 0
       else 1
     end
     limit 1;
  end if;

  if v_op is null then
    v_op := public.ferry_route_primary_operator(v_route);
  end if;

  if v_op is null or not exists (select 1 from ferry_operators fo where fo.code = v_op) then
    raise exception 'Nieznany armator rejsu — uzupełnij źródło albo słownik tras'
      using errcode = '22023';
  end if;

  insert into operator_notices (
    sailing_id, operator, kind, new_departure, note, created_by, source, source_url
  ) values (
    p_sailing, v_op, p_kind, p_new_departure,
    nullif(btrim(coalesce(p_note, '')), ''), v_user, 'RECZNIE', null
  )
  returning id into v_id;

  if p_kind = 'ODWOLANY' then
    update sailings set status = 'ODWOLANY', source = 'RECZNIE' where id = p_sailing;
  else
    v_delta := p_new_departure - v_dep;
    update sailings set
      status = 'OPOZNIONY',
      source = 'RECZNIE',
      delayed_departure_at = p_new_departure,
      delayed_arrival_at = v_arr + v_delta
    where id = p_sailing;
  end if;
  return v_id;
end
$fn$;

comment on function public.operator_notice_apply(uuid, text, timestamptz, text, text) is
  'BN3: komunikat armatora RECZNIE — p_operator albo źródło rejsu / vessels / primary; source=RECZNIE.';

revoke all on function public.operator_notice_apply(uuid, text, timestamptz, text, text)
  from public, anon;
grant execute on function public.operator_notice_apply(uuid, text, timestamptz, text, text)
  to authenticated;
