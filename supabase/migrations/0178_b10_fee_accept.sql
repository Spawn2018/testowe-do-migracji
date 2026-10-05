-- =====================================================================
-- TOWER — 0178: B-10 dopłaty z akceptacją (POPRAWKI §10f)
--   HHL → COST: od razu w koszcie SCX.
--   HHL → REVENUE/BOTH: przychód KSH dopiero po akceptacji KSH (COST z BOTH od razu).
--   SCX → tylko COST, PENDING do akceptacji HHL; KSH nie widzi propozycji SCX.
--   Nie rusza TELM / H1/H3/H6 / SMS właściciela.
-- =====================================================================

alter table public.load_agreed_fees
  add column if not exists status text not null default 'ACCEPTED'
    check (status in ('PENDING', 'ACCEPTED', 'REJECTED')),
  add column if not exists proposed_by_kind text
    check (proposed_by_kind is null or proposed_by_kind in ('FORWARDER', 'CARRIER')),
  add column if not exists accepted_by uuid references public.app_users(id),
  add column if not exists accepted_at timestamptz,
  add column if not exists rejected_by uuid references public.app_users(id),
  add column if not exists rejected_at timestamptz;

update public.load_agreed_fees
   set status = 'ACCEPTED',
       proposed_by_kind = coalesce(proposed_by_kind, 'FORWARDER'),
       accepted_at = coalesce(accepted_at, created_at)
 where status = 'ACCEPTED' and accepted_at is null;

create index if not exists load_agreed_fees_pending_idx
  on public.load_agreed_fees (load_id) where status = 'PENDING';

-- Odczyt: jak dotąd + PENDING COST niewidoczne dla KSH (CLIENT)
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
        and status in ('PENDING', 'ACCEPTED')
        and coalesce(proposed_by_kind, 'FORWARDER') = 'FORWARDER'
        and exists (
          select 1 from loads l
          join projects p on p.id = l.project_id
           where l.id = load_agreed_fees.load_id
             and p.client_org_id = current_org_id()
        )
      )
    )
  );

-- Helper: dopisz extras po akceptacji / natychmiastowym COST
create or replace function public._agreed_fee_apply_side(p_fee_id uuid, p_side text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.load_agreed_fees%rowtype;
  v_item jsonb;
  v_label text;
begin
  select * into r from load_agreed_fees where id = p_fee_id;
  if not found then
    raise exception 'Brak dopłaty' using errcode = '22023';
  end if;
  v_label := case r.kind
    when 'POSTOJOWE' then 'Postojowe (uzgodnione)'
    when 'ANULOWANIE' then 'Anulowanie (uzgodnione)'
    else 'Dopłata uzgodniona'
  end;
  v_item := jsonb_build_object(
    'code', 'AGREED_' || r.kind,
    'label', v_label,
    'amountEur', r.amount_eur,
    'feeId', r.id,
    'note', r.note
  );
  if p_side = 'COST' then
    insert into load_cost (load_id, base_amount, extras, extras_amount)
    values (r.load_id, 0, jsonb_build_array(v_item), r.amount_eur)
    on conflict (load_id) do update
      set extras = coalesce(load_cost.extras, '[]'::jsonb) || jsonb_build_array(v_item),
          extras_amount = coalesce(load_cost.extras_amount, 0) + r.amount_eur,
          computed_at = now();
  elsif p_side = 'REVENUE' then
    insert into load_revenue (load_id, base_amount, extras, extras_amount)
    values (r.load_id, 0, jsonb_build_array(v_item), r.amount_eur)
    on conflict (load_id) do update
      set extras = coalesce(load_revenue.extras, '[]'::jsonb) || jsonb_build_array(v_item),
          extras_amount = coalesce(load_revenue.extras_amount, 0) + r.amount_eur,
          computed_at = now();
  end if;
end $$;
revoke all on function public._agreed_fee_apply_side(uuid, text) from public, anon, authenticated;

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
  v_kind_org text;
  v_status text;
  v_is_hhl boolean;
  v_is_carrier boolean;
begin
  v_is_hhl := (is_hhl() is true);
  v_is_carrier := (current_org_kind() = 'CARRIER');
  if (v_is_hhl or v_is_carrier) is not true then
    raise exception 'Dopłata — tylko HHL lub SCX' using errcode = '42501';
  end if;
  if v_is_carrier and (p_side = 'COST') is not true then
    raise exception 'SCX dodaje tylko dopłatę kosztową (dla HHL)' using errcode = '42501';
  end if;
  if v_is_carrier and not exists (
    select 1 from loads l where l.id = p_load and l.carrier_org_id = current_org_id()
  ) then
    raise exception 'Brak dostępu do transportu' using errcode = '42501';
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

  v_kind_org := case when v_is_hhl then 'FORWARDER' else 'CARRIER' end;
  -- HHL COST → ACCEPTED od razu; HHL REVENUE/BOTH → PENDING (KSH); SCX COST → PENDING (HHL)
  if v_is_hhl and p_side = 'COST' then
    v_status := 'ACCEPTED';
  else
    v_status := 'PENDING';
  end if;

  insert into load_agreed_fees (
    load_id, kind, amount_eur, side, note, created_by, status, proposed_by_kind,
    accepted_by, accepted_at
  ) values (
    p_load, p_kind, round(p_amount_eur, 2), p_side, trim(p_note), v_me, v_status, v_kind_org,
    case when v_status = 'ACCEPTED' then v_me else null end,
    case when v_status = 'ACCEPTED' then now() else null end
  ) returning id into v_id;

  if v_is_hhl and p_side in ('COST', 'BOTH') then
    perform public._agreed_fee_apply_side(v_id, 'COST');
  end if;
  -- REVENUE nigdy od razu — dopiero po akceptacji KSH

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (
    v_me, 'AGREED_FEE_ADD', 'load', p_load::text,
    jsonb_build_object('fee_id', v_id, 'kind', p_kind, 'amount_eur', round(p_amount_eur, 2),
                       'side', p_side, 'status', v_status, 'by', v_kind_org)
  );
  return v_id;
end $$;
revoke all on function public.load_agreed_fee_add(uuid, text, numeric, text, text) from public, anon;
grant execute on function public.load_agreed_fee_add(uuid, text, numeric, text, text) to authenticated;
comment on function public.load_agreed_fee_add(uuid, text, numeric, text, text) is
  'B-10/OPL-8: dopłata HHL lub propozycja SCX; przychód KSH po akceptacji.';

create or replace function public.load_agreed_fee_accept(p_fee uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.load_agreed_fees%rowtype;
  v_me uuid;
  v_ok boolean := false;
begin
  select id into v_me from app_users where auth_id = auth.uid() and active;
  if v_me is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  select * into r from load_agreed_fees where id = p_fee for update;
  if not found then
    raise exception 'Brak dopłaty' using errcode = '22023';
  end if;
  if (r.status = 'PENDING' and r.voided_at is null) is not true then
    raise exception 'Dopłata nie czeka na akceptację' using errcode = '22023';
  end if;

  -- KSH akceptuje REVENUE/BOTH od HHL
  if current_org_kind() = 'CLIENT'
     and r.side in ('REVENUE', 'BOTH')
     and coalesce(r.proposed_by_kind, 'FORWARDER') = 'FORWARDER'
     and exists (
       select 1 from loads l join projects p on p.id = l.project_id
        where l.id = r.load_id and p.client_org_id = current_org_id()
     ) then
    v_ok := true;
    perform public._agreed_fee_apply_side(r.id, 'REVENUE');
  end if;

  -- HHL akceptuje COST od SCX
  if is_hhl() is true
     and r.side = 'COST'
     and r.proposed_by_kind = 'CARRIER' then
    v_ok := true;
    perform public._agreed_fee_apply_side(r.id, 'COST');
  end if;

  if v_ok is not true then
    raise exception 'Brak uprawnień do akceptacji tej dopłaty' using errcode = '42501';
  end if;

  update load_agreed_fees
     set status = 'ACCEPTED', accepted_by = v_me, accepted_at = now()
   where id = r.id;

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_me, 'AGREED_FEE_ACCEPT', 'load', r.load_id::text,
          jsonb_build_object('fee_id', r.id, 'side', r.side));
end $$;
revoke all on function public.load_agreed_fee_accept(uuid) from public, anon;
grant execute on function public.load_agreed_fee_accept(uuid) to authenticated;

create or replace function public.load_agreed_fee_reject(p_fee uuid, p_reason text default 'odrzucone')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.load_agreed_fees%rowtype;
  v_me uuid;
  v_ok boolean := false;
begin
  select id into v_me from app_users where auth_id = auth.uid() and active;
  if v_me is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  select * into r from load_agreed_fees where id = p_fee for update;
  if not found then
    raise exception 'Brak dopłaty' using errcode = '22023';
  end if;
  if (r.status = 'PENDING') is not true then
    raise exception 'Dopłata nie czeka na decyzję' using errcode = '22023';
  end if;

  if current_org_kind() = 'CLIENT'
     and r.side in ('REVENUE', 'BOTH')
     and coalesce(r.proposed_by_kind, 'FORWARDER') = 'FORWARDER'
     and exists (
       select 1 from loads l join projects p on p.id = l.project_id
        where l.id = r.load_id and p.client_org_id = current_org_id()
     ) then
    v_ok := true;
  end if;
  if is_hhl() is true and r.proposed_by_kind = 'CARRIER' and r.side = 'COST' then
    v_ok := true;
  end if;
  if v_ok is not true then
    raise exception 'Brak uprawnień do odrzucenia' using errcode = '42501';
  end if;

  update load_agreed_fees
     set status = 'REJECTED',
         rejected_by = v_me,
         rejected_at = now(),
         void_reason = left(trim(coalesce(p_reason, 'odrzucone')), 500)
   where id = r.id;

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_me, 'AGREED_FEE_REJECT', 'load', r.load_id::text,
          jsonb_build_object('fee_id', r.id));
end $$;
revoke all on function public.load_agreed_fee_reject(uuid, text) from public, anon;
grant execute on function public.load_agreed_fee_reject(uuid, text) to authenticated;

comment on column public.load_agreed_fees.status is
  'B-10: PENDING do akceptacji kontrahenta; ACCEPTED w rozliczeniu; REJECTED bez kwoty.';
