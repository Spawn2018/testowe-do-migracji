-- =====================================================================
-- TOWER — Migracja 0089: III-9 (SCOPE 10.6) ocena przewoźnika
--   1. carrier_ratings: ocena zrealizowanego transportu przez HHL (1–5, komentarz ≤ 500 zn.), jedna na transport
--      (zmiana = nadpisanie wiersza + audit_log ze starą wartością). Odczyt i zapis tylko HHL (ocena wewnętrzna HHL —
--      udostępnienie przewoźnikowi = decyzja właściciela D-23). anon i authenticated bez uprawnień tabelowych.
--   2. carrier_rate_load(p_load, p_score, p_comment): tylko HHL, transport UNLOADED/DELIVERED z przewoźnikiem.
--   3. carrier_scorecard(p_from, p_to): tylko HHL — per przewoźnik: transporty zrealizowane, na czas (rozładunek do
--      końca okna/dnia dostawy — load_delivery_deadline, jak opóźnienie w 0080), opóźnione z winy przewoźnika
--      (delay_owner = CARRIER), średnie opóźnienie spóźnionych [min], średnia ocena HHL i liczba ocen.
--   Idempotentna, bez usuwania danych.
-- =====================================================================
create table if not exists carrier_ratings (
  load_id        uuid primary key references loads(id) on delete cascade,
  carrier_org_id uuid not null references organizations(id),
  score          smallint not null check (score between 1 and 5),
  comment        text check (comment is null or length(comment) <= 500),
  rated_by       uuid references app_users(id),
  rated_at       timestamptz not null default now()
);
create index if not exists carrier_ratings_carrier on carrier_ratings (carrier_org_id);
alter table carrier_ratings enable row level security;
revoke all on carrier_ratings from anon, authenticated;
drop policy if exists carrier_ratings_hhl on carrier_ratings;
grant select on carrier_ratings to authenticated;
create policy carrier_ratings_hhl on carrier_ratings for select to authenticated using (is_hhl());

create or replace function carrier_rate_load(p_load uuid, p_score int, p_comment text default null) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_load loads%rowtype; v_old jsonb;
begin
  if (is_hhl()) is not true then raise exception 'Przewoźnika ocenia wyłącznie HHL' using errcode = '42501'; end if;
  select * into v_load from loads where id = p_load;
  if (v_load.id is not null and v_load.carrier_org_id is not null) is not true then
    raise exception 'Nieznany transport albo brak przewoźnika' using errcode = '22023';
  end if;
  if (v_load.status in ('UNLOADED', 'DELIVERED')) is not true then
    raise exception 'Ocena dopiero po rozładunku' using errcode = '22023';
  end if;
  if (p_score between 1 and 5) is not true then raise exception 'Ocena 1–5' using errcode = '22023'; end if;
  if (length(coalesce(p_comment, '')) <= 500) is not true then raise exception 'Komentarz do 500 znaków' using errcode = '22023'; end if;
  select to_jsonb(r) - 'load_id' into v_old from carrier_ratings r where load_id = p_load;
  insert into carrier_ratings (load_id, carrier_org_id, score, comment, rated_by, rated_at)
  values (p_load, v_load.carrier_org_id, p_score, nullif(btrim(coalesce(p_comment, '')), ''), current_app_user_id(), now())
  on conflict (load_id) do update set score = excluded.score, comment = excluded.comment, rated_by = excluded.rated_by,
    rated_at = excluded.rated_at, carrier_org_id = excluded.carrier_org_id;
  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (current_app_user_id(), 'CARRIER_RATING', 'loads', p_load::text, v_old,
          jsonb_build_object('score', p_score, 'comment', nullif(btrim(coalesce(p_comment, '')), '')));
  return true;
end $$;
revoke all on function carrier_rate_load(uuid, int, text) from public, anon;
grant execute on function carrier_rate_load(uuid, int, text) to authenticated;

create or replace function carrier_scorecard(p_from date default null, p_to date default null)
returns table (carrier_org_id uuid, carrier_name text, delivered int, on_time int, late_carrier int,
               avg_late_min int, avg_score numeric, ratings int)
language plpgsql stable security definer set search_path = public as $$
begin
  if (is_hhl()) is not true then raise exception 'Karta przewoźnika wyłącznie dla HHL' using errcode = '42501'; end if;
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
   where o.kind = 'CARRIER'
   group by o.id, o.name
   order by o.name;
end $$;
revoke all on function carrier_scorecard(date, date) from public, anon;
grant execute on function carrier_scorecard(date, date) to authenticated;
