-- DP-101 / F7 #866: atomowe AUTO ODWOLANY + notice (Tallink Alert, Port of Tallinn).
-- Update status i insert operator_notices w jednej transakcji RPC — bez wyścigu
-- dwóch przebiegów i bez powtórnego notice przy trwałym błędzie update (RECZNIE).

create or replace function public.sailing_cancel_auto(
  p_sailing_id uuid,
  p_operator text,
  p_note text,
  p_source_url text
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_id uuid;
  v_op text;
begin
  if p_sailing_id is null then
    return false;
  end if;

  v_op := upper(btrim(coalesce(p_operator, '')));
  if v_op = '' then
    raise exception 'Brak armatora AUTO ODWOLANY' using errcode = '22023';
  end if;

  update public.sailings
     set status = 'ODWOLANY',
         updated_at = now()
   where id = p_sailing_id
     and status <> 'ODWOLANY'
     and source <> 'RECZNIE'
  returning id into v_id;

  if v_id is null then
    return false;
  end if;

  insert into public.operator_notices (
    sailing_id, operator, kind, note, created_by, source, source_url
  ) values (
    p_sailing_id,
    v_op,
    'ODWOLANY',
    nullif(btrim(coalesce(p_note, '')), ''),
    null,
    'AUTO',
    nullif(btrim(coalesce(p_source_url, '')), '')
  );

  return true;
end
$fn$;

comment on function public.sailing_cancel_auto(uuid, text, text, text) is
  'DP-101: AUTO ODWOLANY + operator_notices w jednej transakcji (tylko service_role). '
  'false gdy już ODWOLANY albo source=RECZNIE; błąd insertu wycofuje status.';

revoke all on function public.sailing_cancel_auto(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.sailing_cancel_auto(uuid, text, text, text)
  to service_role;
