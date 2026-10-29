-- #618: decyzja właściciela 28.10 19:40 — przy trailer_swap niepełna strona:
-- PL-only → „PL / ...”, SE-only → „... / SE” (trzy kropki ASCII). Bez swap = sama PL.
-- Ta sama ksh_file_ab w triggerze, wt_diff i apply_sent (0326) — bez fałszywej różnicy
-- przy pustej kolejce prod / write_enabled=false. Import awizacji nadal poza WT (0325).
begin;

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
    when coalesce(p_swap, false)
         and nullif(btrim(coalesce(p_pl, '')), '') is not null
      then btrim(p_pl) || ' / ...'
    when coalesce(p_swap, false)
         and nullif(btrim(coalesce(p_se, '')), '') is not null
      then '... / ' || btrim(p_se)
    when nullif(btrim(coalesce(p_pl, '')), '') is not null
      then btrim(p_pl)
    else null
  end;
$$;

revoke all on function public.ksh_file_ab(text, text, boolean) from public, anon, authenticated;
grant execute on function public.ksh_file_ab(text, text, boolean) to service_role;

comment on function public.ksh_file_ab(text, text, boolean) is
  '#618/#597: komórka KSH — swap: „PL / SE”, „PL / ...”, „... / SE”; bez swap: sama PL; obie puste → null.';

commit;
