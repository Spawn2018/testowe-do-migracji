-- =====================================================================
-- TOWER — Migracja 0115: OPL-8 (PO_SPOTKANIU §8)
--   Opłaty dodatkowe wyłącznie ręcznie (zastępuje auto I-32).
--   HHL dodaje „dopłatę uzgodnioną”: rodzaj, kwota EUR, strona, opis.
--   Cennik opłat = podpowiedź (fee_catalog_hints), nie automat.
--   Zmierzony postój ze stref = informacja (load_dwell_info), bez kwoty.
--   Pusty przebieg — poza zakresem. Idempotentna. Nie rusza bramki SMS.
-- =====================================================================

-- 1) Tabela dopłat uzgodnionych
create table if not exists public.load_agreed_fees (
  id          uuid primary key default gen_random_uuid(),
  load_id     uuid not null references public.loads(id) on delete cascade,
  kind        text not null check (kind in ('POSTOJOWE', 'ANULOWANIE', 'INNE')),
  amount_eur  numeric(12,2) not null check (amount_eur > 0 and amount_eur < 1000000),
  side        text not null check (side in ('COST', 'REVENUE', 'BOTH')),
  note        text not null check (char_length(trim(note)) between 3 and 1000),
  created_by  uuid references public.app_users(id),
  created_at  timestamptz not null default now(),
  voided_at   timestamptz,
  voided_by   uuid references public.app_users(id),
  void_reason text check (void_reason is null or char_length(trim(void_reason)) between 3 and 500)
);

create index if not exists load_agreed_fees_load_idx
  on public.load_agreed_fees (load_id) where voided_at is null;

alter table public.load_agreed_fees enable row level security;
revoke all on public.load_agreed_fees from public, anon, authenticated;

-- Odczyt: HHL wszystko; SCX koszt/BOTH swoich; KSH przychód/BOTH swojego projektu
drop policy if exists load_agreed_fees_select on public.load_agreed_fees;
create policy load_agreed_fees_select on public.load_agreed_fees
  for select to authenticated
  using (
    current_app_user_id() is not null
    and (
      is_hhl() is true
      or (
        current_org_kind() = 'CARRIER'
        and side in ('COST', 'BOTH')
        and exists (
          select 1 from loads l
           where l.id = load_agreed_fees.load_id
             and l.carrier_org_id = current_org_id()
        )
      )
      or (
        current_org_kind() = 'CLIENT'
        and side in ('REVENUE', 'BOTH')
        and exists (
          select 1 from loads l
          join projects p on p.id = l.project_id
           where l.id = load_agreed_fees.load_id
             and p.client_org_id = current_org_id()
        )
      )
    )
  );

grant select on public.load_agreed_fees to authenticated;

-- 2) Podpowiedź cennika (wstępne z §8 / I-32 — NIE stosuje automatycznie)
create or replace function public.fee_catalog_hints()
returns table (
  code text,
  label_pl text,
  hint_text text,
  amount_eur numeric,
  unit text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if current_app_user_id() is null then
    return;
  end if;
  return query
  select * from (values
    ('FREE_LOAD',   'Czas wolny załadunek',  '6 h wliczone; dalsze godziny — uzgodnić', 6::numeric, 'h'),
    ('FREE_UNLOAD', 'Czas wolny rozładunek', '4 h wliczone; dalsze godziny — uzgodnić', 4::numeric, 'h'),
    ('HOURLY',      'Godzina ponad czas wolny', 'Podpowiedź: 75 EUR/h — tylko po uzgodnieniu', 75::numeric, 'EUR/h'),
    ('DAILY',       'Przestój dobowy', 'Podpowiedź: 750 EUR/doba — tylko po uzgodnieniu', 750::numeric, 'EUR/d'),
    ('CANCEL_5',    'Anulowanie ≥5 dni', '0% frachtu (podpowiedź)', 0::numeric, '%'),
    ('CANCEL_4',    'Anulowanie 4 dni', '15% frachtu (podpowiedź)', 15::numeric, '%'),
    ('CANCEL_3',    'Anulowanie 3 dni', '25% frachtu (podpowiedź)', 25::numeric, '%'),
    ('CANCEL_1',    'Anulowanie 1 dzień', '50% frachtu (podpowiedź)', 50::numeric, '%'),
    ('CANCEL_0',    'Anulowanie w dniu załadunku', '100% frachtu (podpowiedź)', 100::numeric, '%')
  ) as t(code, label_pl, hint_text, amount_eur, unit);
end $$;
revoke all on function public.fee_catalog_hints() from public, anon;
grant execute on function public.fee_catalog_hints() to authenticated;
comment on function public.fee_catalog_hints() is
  'OPL-8: podpowiedzi cennika opłat (§8). Nigdy nie nalicza automatycznie.';

-- 3) Zmierzony postój ze stref (informacja, bez kwoty)
create or replace function public.load_dwell_info(p_load uuid)
returns table (
  zone_kind text,
  entered_at timestamptz,
  exited_at timestamptz,
  dwell_minutes numeric,
  free_minutes numeric,
  over_free_minutes numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and current_app_user_id() is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if (is_hhl() is true
      or exists (select 1 from loads l where l.id = p_load and l.carrier_org_id = current_org_id())
      or exists (
           select 1 from loads l join projects p on p.id = l.project_id
            where l.id = p_load and p.client_org_id = current_org_id()
         )
     ) is not true then
    raise exception 'Brak dostępu do transportu' using errcode = '42501';
  end if;

  return query
  with enters as (
    select e.occurred_at as entered_at,
           coalesce(e.payload->>'geofence_kind', g.kind::text, 'UNKNOWN') as zone_kind,
           nullif(e.payload->>'geofence_id', '')::uuid as gid
      from load_events e
      left join geofences g on g.id = nullif(e.payload->>'geofence_id', '')::uuid
     where e.load_id = p_load
       and e.event_type = 'GEOFENCE_ENTER'
  ),
  paired as (
    select en.zone_kind,
           en.entered_at,
           (
             select min(x.occurred_at) from load_events x
              where x.load_id = p_load
                and x.event_type = 'GEOFENCE_EXIT'
                and x.occurred_at > en.entered_at
                and (
                  (en.gid is not null and nullif(x.payload->>'geofence_id','')::uuid = en.gid)
                  or en.gid is null
                )
           ) as exited_at
      from enters en
  )
  select p.zone_kind,
         p.entered_at,
         p.exited_at,
         case when p.exited_at is null then null
              else round(extract(epoch from (p.exited_at - p.entered_at)) / 60.0, 1)
         end as dwell_minutes,
         case
           when p.zone_kind = 'LOADING' then 6 * 60
           when p.zone_kind = 'SITE' then 4 * 60
           else null
         end::numeric as free_minutes,
         case
           when p.exited_at is null then null
           when p.zone_kind = 'LOADING' then
             greatest(0, round(extract(epoch from (p.exited_at - p.entered_at)) / 60.0, 1) - 360)
           when p.zone_kind = 'SITE' then
             greatest(0, round(extract(epoch from (p.exited_at - p.entered_at)) / 60.0, 1) - 240)
           else null
         end as over_free_minutes
    from paired p
   order by p.entered_at;
end $$;
revoke all on function public.load_dwell_info(uuid) from public, anon;
grant execute on function public.load_dwell_info(uuid) to authenticated;
comment on function public.load_dwell_info(uuid) is
  'OPL-8: zmierzony postój ze stref (minuty). Bez kwoty — informacja dla HHL.';

-- 4) Dodanie dopłaty uzgodnionej (tylko HHL) + aktualizacja extras
create or replace function public.load_agreed_fee_add(
  p_load uuid,
  p_kind text,
  p_amount_eur numeric,
  p_side text,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_id uuid;
  v_item jsonb;
  v_label text;
begin
  if (is_hhl()) is not true then
    raise exception 'Dopłata uzgodniona — wyłącznie HHL' using errcode = '42501';
  end if;
  select id into v_me from app_users where auth_id = auth.uid() and active;
  if v_me is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if (p_kind in ('POSTOJOWE', 'ANULOWANIE', 'INNE')) is not true then
    raise exception 'Nieznany rodzaj dopłaty' using errcode = '22023';
  end if;
  if (p_side in ('COST', 'REVENUE', 'BOTH')) is not true then
    raise exception 'Strona: COST, REVENUE lub BOTH' using errcode = '22023';
  end if;
  if (p_amount_eur is not null and p_amount_eur > 0 and p_amount_eur < 1000000) is not true then
    raise exception 'Kwota EUR musi być dodatnia' using errcode = '22023';
  end if;
  if (char_length(trim(coalesce(p_note, ''))) between 3 and 1000) is not true then
    raise exception 'Opis uzgodnienia wymagany (3–1000 znaków)' using errcode = '22023';
  end if;
  if not exists (select 1 from loads where id = p_load) then
    raise exception 'Brak transportu' using errcode = '22023';
  end if;

  insert into load_agreed_fees (load_id, kind, amount_eur, side, note, created_by)
  values (p_load, p_kind, round(p_amount_eur, 2), p_side, trim(p_note), v_me)
  returning id into v_id;

  v_label := case p_kind
    when 'POSTOJOWE' then 'Postojowe (uzgodnione)'
    when 'ANULOWANIE' then 'Anulowanie (uzgodnione)'
    else 'Dopłata uzgodniona'
  end;
  v_item := jsonb_build_object(
    'code', 'AGREED_' || p_kind,
    'label', v_label,
    'amountEur', round(p_amount_eur, 2),
    'feeId', v_id,
    'note', trim(p_note)
  );

  if p_side in ('COST', 'BOTH') then
    insert into load_cost (load_id, base_amount, extras, extras_amount)
    values (p_load, 0, jsonb_build_array(v_item), round(p_amount_eur, 2))
    on conflict (load_id) do update
      set extras = coalesce(load_cost.extras, '[]'::jsonb) || jsonb_build_array(v_item),
          extras_amount = coalesce(load_cost.extras_amount, 0) + round(p_amount_eur, 2),
          computed_at = now();
  end if;
  if p_side in ('REVENUE', 'BOTH') then
    insert into load_revenue (load_id, base_amount, extras, extras_amount)
    values (p_load, 0, jsonb_build_array(v_item), round(p_amount_eur, 2))
    on conflict (load_id) do update
      set extras = coalesce(load_revenue.extras, '[]'::jsonb) || jsonb_build_array(v_item),
          extras_amount = coalesce(load_revenue.extras_amount, 0) + round(p_amount_eur, 2),
          computed_at = now();
  end if;

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (
    v_me, 'AGREED_FEE_ADD', 'load', p_load::text,
    jsonb_build_object('fee_id', v_id, 'kind', p_kind, 'amount_eur', round(p_amount_eur, 2), 'side', p_side)
  );

  return v_id;
end $$;
revoke all on function public.load_agreed_fee_add(uuid, text, numeric, text, text) from public, anon;
grant execute on function public.load_agreed_fee_add(uuid, text, numeric, text, text) to authenticated;
comment on function public.load_agreed_fee_add(uuid, text, numeric, text, text) is
  'OPL-8: ręczna dopłata uzgodniona (HHL). Bez automatu.';

-- 5) Strażnik: żadna funkcja nie wolno auto-naliczać opłat (komentarz + brak crona)
-- Brak jobów / triggerów tworzących load_agreed_fees poza load_agreed_fee_add.
