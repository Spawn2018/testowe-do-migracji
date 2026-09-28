-- =====================================================================
-- TOWER — Migracja 0091: D-23 (decyzja właściciela 28.09) — przewoźnik widzi swoje oceny i punktualność
--   1. carrier_ratings: RLS — HHL wszystkie, przewoźnik (CARRIER_*) wiersze własnej organizacji. Uprawnienia kolumnowe:
--      authenticated czyta load_id, carrier_org_id, score, rated_at — BEZ comment (wewnętrzna notatka HHL) i rated_by.
--   2. carrier_rating_detail(p_load): ocena z notatką — wyłącznie HHL (formularz oceny w szufladzie).
--   3. carrier_scorecard: HHL — wszyscy przewoźnicy; przewoźnik — wyłącznie własny wiersz (zrealizowane, na czas,
--      z własnej winy, śr. spóźnienie, śr. ocena); pozostali — odmowa.
--   Idempotentna, bez usuwania danych.
-- =====================================================================
revoke select on carrier_ratings from anon, authenticated;
grant select (load_id, carrier_org_id, score, rated_at) on carrier_ratings to authenticated;
drop policy if exists carrier_ratings_carrier on carrier_ratings;
create policy carrier_ratings_carrier on carrier_ratings for select to authenticated
  using (current_org_kind() = 'CARRIER' and carrier_org_id = current_org_id());

create or replace function carrier_rating_detail(p_load uuid)
returns table (score smallint, comment text, rated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if (is_hhl()) is not true then raise exception 'Notatka oceny wyłącznie dla HHL' using errcode = '42501'; end if;
  return query select r.score, r.comment, r.rated_at from carrier_ratings r where r.load_id = p_load;
end $$;
revoke all on function carrier_rating_detail(uuid) from public, anon;
grant execute on function carrier_rating_detail(uuid) to authenticated;

create or replace function carrier_scorecard(p_from date default null, p_to date default null)
returns table (carrier_org_id uuid, carrier_name text, delivered int, on_time int, late_carrier int,
               avg_late_min int, avg_score numeric, ratings int)
language plpgsql stable security definer set search_path = public as $$
declare v_hhl boolean := is_hhl(); v_org uuid;
begin
  if (v_hhl or current_org_kind() = 'CARRIER') is not true then
    raise exception 'Karta przewoźnika wyłącznie dla HHL i przewoźnika (własna)' using errcode = '42501';
  end if;
  v_org := case when v_hhl then null else current_org_id() end;
  if (v_hhl or v_org is not null) is not true then
    raise exception 'Karta przewoźnika wyłącznie dla HHL i przewoźnika (własna)' using errcode = '42501';
  end if;
  return query
  select o.id, o.name::text,
         count(l.id)::int,
         count(l.id) filter (where l.actual_delivery_at is not null
                               and l.actual_delivery_at <= load_delivery_deadline(l.plan_delivery_date, l.plan_delivery_to))::int,
         count(l.id) filter (where l.delay_owner = 'CARRIER')::int,
         round(avg(extract(epoch from l.actual_delivery_at - load_delivery_deadline(l.plan_delivery_date, l.plan_delivery_to)) / 60)
               filter (where l.actual_delivery_at > load_delivery_deadline(l.plan_delivery_date, l.plan_delivery_to)))::int,
         round(avg(r.score), 2),
         count(r.load_id)::int
    from organizations o
    join loads l on l.carrier_org_id = o.id and l.status in ('UNLOADED', 'DELIVERED')
                and (p_from is null or coalesce(l.actual_delivery_at::date, l.plan_delivery_date) >= p_from)
                and (p_to is null or coalesce(l.actual_delivery_at::date, l.plan_delivery_date) <= p_to)
    left join carrier_ratings r on r.load_id = l.id
   where o.kind = 'CARRIER' and (v_org is null or o.id = v_org)
   group by o.id, o.name
   order by o.name;
end $$;
revoke all on function carrier_scorecard(date, date) from public, anon;
grant execute on function carrier_scorecard(date, date) to authenticated;
