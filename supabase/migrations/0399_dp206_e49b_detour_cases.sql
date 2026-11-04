-- DP-206 E49-b cz.1 (#783 / D-20261104-0105-01 Z3): tabela spraw SCX „Objazd czy postój?”.
-- DETOUR_E49 włączamy na froncie po podłączeniu joba/HERE (następny krok tego PR / cz.2).

begin;

create table if not exists public.e49_detour_cases (
  id              uuid primary key default gen_random_uuid(),
  load_id         uuid not null references public.loads (id),
  dedup_key       text not null,
  country         text not null
                    check (country in ('PL', 'SE', 'LT', 'LV', 'EE', 'FI')),
  place           text not null,
  reason          text not null
                    check (reason in ('WIND', 'ACCIDENT', 'WORKS', 'OTHER')),
  reason_detail   text,
  source          text not null
                    check (source in (
                      'TRAFIKVERKET', 'HERE', 'EISMOINFO', 'LVC', 'TARKTEE', 'DIGITRAFFIC'
                    )),
  notice_at       timestamptz not null,
  until_at        timestamptz,
  decide_by       timestamptz not null,
  payload         jsonb not null default '{}'::jsonb,
  decision        jsonb,
  decided_at      timestamptz,
  decided_by      uuid references public.app_users (id),
  risk_dedup_key  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  closed_at       timestamptz,
  close_reason    text
);

comment on table public.e49_detour_cases is
  'E49-b: otwarte/rozstrzygnięte sprawy SCX „Objazd czy postój?” (zamknięcie drogi/mostu na trasie).';

create unique index if not exists e49_detour_cases_open_dedup_uidx
  on public.e49_detour_cases (dedup_key)
  where closed_at is null;

create index if not exists e49_detour_cases_load_open_idx
  on public.e49_detour_cases (load_id)
  where closed_at is null and decision is null;

create index if not exists e49_detour_cases_load_idx
  on public.e49_detour_cases (load_id, created_at desc);

alter table public.e49_detour_cases enable row level security;
revoke all on public.e49_detour_cases from public, anon, authenticated;
grant select on public.e49_detour_cases to authenticated;
grant select, insert, update, delete on public.e49_detour_cases to service_role;

drop policy if exists e49_detour_cases_read on public.e49_detour_cases;
create policy e49_detour_cases_read on public.e49_detour_cases
  for select to authenticated
  using (
    current_app_user_id() is not null
    and (
      (public.is_hhl()) is true
      or exists (
        select 1
          from public.loads l
         where l.id = e49_detour_cases.load_id
           and (
             (current_org_kind() = 'CARRIER' and l.carrier_org_id = current_org_id())
             or (current_org_kind() = 'CLIENT' and exists (
                   select 1 from public.projects p
                    where p.id = l.project_id and p.client_org_id = current_org_id()
                 ))
           )
      )
    )
  );

-- Otwarte sprawy bez decyzji (HHL + SCX przewoźnika; KSH filtruje front E7 — sprawy SCX).
create or replace function public.e49_detour_cases_open(p_now timestamptz default now())
returns setof public.e49_detour_cases
language sql
stable
security definer
set search_path = public
as $$
  select c.*
    from public.e49_detour_cases c
    join public.loads l on l.id = c.load_id
   where c.closed_at is null
     and c.decision is null
     and current_app_user_id() is not null
     and (
       (public.is_hhl()) is true
       or (current_org_kind() = 'CARRIER' and l.carrier_org_id = current_org_id())
     )
   order by c.decide_by asc, c.created_at asc;
$$;

revoke all on function public.e49_detour_cases_open(timestamptz) from public, anon, authenticated;
grant execute on function public.e49_detour_cases_open(timestamptz) to authenticated, service_role;

comment on function public.e49_detour_cases_open(timestamptz) is
  'E49-b: otwarte sprawy „Objazd czy postój?” bez decyzji — HHL i SCX przewoźnika transportu.';

commit;
