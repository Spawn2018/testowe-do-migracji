-- #412 / D-20261021-2040-01 pkt 1 — E40: terminy płatności (RPC) + adresy księgowości (tabela + RPC).
-- Odczyt: HHL (Administrator i Operacje). Zapis: tylko Administrator HHL, z wpisem w audit_log.
-- Front podłącza koordynator po wdrożeniu (p5bSource — bez zmian w tej migracji).

select set_config('tower.audit_source', 'migracja 0285 (#412 E40 terminy + adresy)', true);

-- ---------------------------------------------------------------------------
-- Adresy księgowości (E40 / E12) — wartości startowe z audytu (P6).
-- ---------------------------------------------------------------------------
create table if not exists public.accounting_addresses (
  pack_key    text primary key check (pack_key in ('KSH', 'HHL')),
  emails      text[] not null default '{}'::text[],
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.app_users(id)
);

alter table public.accounting_addresses enable row level security;

revoke all on table public.accounting_addresses from public, anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.accounting_addresses from authenticated;
grant select on table public.accounting_addresses to authenticated;

drop policy if exists accounting_addresses_read on public.accounting_addresses;
create policy accounting_addresses_read on public.accounting_addresses
  for select to authenticated
  using ((public.is_hhl()) is true);

comment on table public.accounting_addresses is
  '#412 E40: adresy e-mail księgowości KSH/HHL (Opcje); zapis tylko przez accounting_addresses_set.';

insert into public.accounting_addresses (pack_key, emails) values
  ('HHL', array['ksiegowosc@hhlogistics.pl']::text[]),
  ('KSH', array['faktury@ksh.pl']::text[])
on conflict (pack_key) do nothing;

-- ---------------------------------------------------------------------------
-- Terminy płatności — odczyt (struktura pod PaymentTermsView).
-- ---------------------------------------------------------------------------
create or replace function public.payment_terms_options()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_project uuid;
  v_ksh uuid;
  v_hhl uuid;
  v_scx uuid;
  v_ksh_days int;
  v_scx_days int;
  v_changed jsonb;
begin
  if (public.is_hhl()) is not true then
    raise exception 'Terminy płatności — tylko HHL' using errcode = '42501';
  end if;

  -- Brama: seed.code = STEGRA; produkcja: STEGRA_BODEN (jak 0106/0120/0267).
  select p.id into v_project
    from public.projects p
   where p.code in ('STEGRA_BODEN', 'STEGRA')
   order by case p.code when 'STEGRA_BODEN' then 0 else 1 end
   limit 1;
  select o.id into v_ksh from public.organizations o where o.code = 'KSH' limit 1;
  select o.id into v_hhl from public.organizations o where o.code = 'HHL' limit 1;
  select o.id into v_scx from public.organizations o where o.code = 'SCX' limit 1;
  if (v_project is not null and v_ksh is not null and v_hhl is not null and v_scx is not null) is not true then
    raise exception 'Brak projektu lub firm' using errcode = 'P0002';
  end if;

  select t.term_days into v_ksh_days
    from public.payment_terms t
   where t.project_id = v_project
     and t.payer_org_id = v_ksh
     and t.payee_org_id = v_hhl
     and t.valid_from <= current_date
   order by t.valid_from desc
   limit 1;

  select t.term_days into v_scx_days
    from public.payment_terms t
   where t.project_id = v_project
     and t.payer_org_id = v_hhl
     and t.payee_org_id = v_scx
     and t.valid_from <= current_date
   order by t.valid_from desc
   limit 1;

  select jsonb_build_object(
           'at', a.created_at,
           'by', coalesce(nullif(btrim(u.full_name), ''), split_part(u.email::text, '@', 1), '—')
         )
    into v_changed
    from public.audit_log a
    left join public.app_users u on u.id = a.user_id
   where a.action = 'PAYMENT_TERMS_SET'
   order by a.created_at desc
   limit 1;

  return jsonb_build_object(
    'kshDays', coalesce(v_ksh_days, 30),
    'scxDays', coalesce(v_scx_days, 35),
    'changed', v_changed
  );
end $$;

revoke all on function public.payment_terms_options() from public, anon;
grant execute on function public.payment_terms_options() to authenticated;
comment on function public.payment_terms_options() is
  '#412 E40: terminy KSH/SCX + last changed; tylko HHL.';

-- ---------------------------------------------------------------------------
-- Terminy płatności — zapis (Administrator HHL).
-- ---------------------------------------------------------------------------
create or replace function public.payment_terms_options_set(p_side text, p_days int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_project uuid;
  v_payer uuid;
  v_payee uuid;
  v_old int;
  v_id uuid;
  v_side text := upper(btrim(coalesce(p_side, '')));
begin
  if (public.is_hhl_admin()) is not true then
    raise exception 'Terminy płatności — wyłącznie Administrator HHL' using errcode = '42501';
  end if;
  if (v_side in ('KSH', 'SCX')) is not true then
    raise exception 'Strona terminu: KSH albo SCX' using errcode = '22023';
  end if;
  if (p_days is not null and p_days between 1 and 120) is not true then
    raise exception 'Liczba dni: 1–120' using errcode = '22023';
  end if;

  select id into v_me from public.app_users where auth_id = auth.uid() and active;
  select p.id into v_project
    from public.projects p
   where p.code in ('STEGRA_BODEN', 'STEGRA')
   order by case p.code when 'STEGRA_BODEN' then 0 else 1 end
   limit 1;
  if (v_project is not null and v_me is not null) is not true then
    raise exception 'Brak projektu lub konta' using errcode = 'P0002';
  end if;

  if v_side = 'KSH' then
    select o.id into v_payer from public.organizations o where o.code = 'KSH' limit 1;
    select o.id into v_payee from public.organizations o where o.code = 'HHL' limit 1;
  else
    select o.id into v_payer from public.organizations o where o.code = 'HHL' limit 1;
    select o.id into v_payee from public.organizations o where o.code = 'SCX' limit 1;
  end if;

  select t.id, t.term_days into v_id, v_old
    from public.payment_terms t
   where t.project_id = v_project
     and t.payer_org_id = v_payer
     and t.payee_org_id = v_payee
   order by t.valid_from desc
   limit 1
   for update;

  if (v_id is not null) is not true then
    insert into public.payment_terms (project_id, payer_org_id, payee_org_id, term_days, valid_from)
    values (v_project, v_payer, v_payee, p_days, current_date)
    returning id into v_id;
    v_old := null;
  elsif v_old is distinct from p_days then
    update public.payment_terms set term_days = p_days where id = v_id;
  end if;

  if v_old is distinct from p_days then
    insert into public.audit_log (user_id, action, entity, entity_id, old_value, new_value)
    values (
      v_me,
      'PAYMENT_TERMS_SET',
      'payment_terms',
      v_id::text,
      jsonb_build_object('side', v_side, 'days', v_old),
      jsonb_build_object('side', v_side, 'days', p_days)
    );
  end if;
end $$;

revoke all on function public.payment_terms_options_set(text, int) from public, anon;
grant execute on function public.payment_terms_options_set(text, int) to authenticated;
comment on function public.payment_terms_options_set(text, int) is
  '#412 E40: zapis terminu KSH/SCX; tylko HHL_ADMIN; audit PAYMENT_TERMS_SET.';

-- ---------------------------------------------------------------------------
-- Adresy księgowości — odczyt / zapis.
-- ---------------------------------------------------------------------------
create or replace function public.accounting_addresses_get()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_out jsonb := '{}'::jsonb;
  r record;
begin
  if (public.is_hhl()) is not true then
    raise exception 'Adresy księgowości — tylko HHL' using errcode = '42501';
  end if;
  for r in
    select pack_key, emails from public.accounting_addresses order by pack_key
  loop
    v_out := v_out || jsonb_build_object(r.pack_key, to_jsonb(r.emails));
  end loop;
  if (v_out ? 'KSH') is not true then
    v_out := v_out || jsonb_build_object('KSH', '[]'::jsonb);
  end if;
  if (v_out ? 'HHL') is not true then
    v_out := v_out || jsonb_build_object('HHL', '[]'::jsonb);
  end if;
  return v_out;
end $$;

revoke all on function public.accounting_addresses_get() from public, anon;
grant execute on function public.accounting_addresses_get() to authenticated;
comment on function public.accounting_addresses_get() is
  '#412 E40: {KSH:[…], HHL:[…]}; tylko HHL.';

create or replace function public.accounting_addresses_set(p_pack text, p_emails text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_pack text := upper(btrim(coalesce(p_pack, '')));
  v_old text[];
  v_clean text[] := '{}'::text[];
  v_e text;
  v_norm text;
begin
  if (public.is_hhl_admin()) is not true then
    raise exception 'Adresy księgowości — wyłącznie Administrator HHL' using errcode = '42501';
  end if;
  if (v_pack in ('KSH', 'HHL')) is not true then
    raise exception 'Paczka: KSH albo HHL' using errcode = '22023';
  end if;
  if (p_emails is not null and cardinality(p_emails) <= 20) is not true then
    raise exception 'Lista adresów: najwyżej 20' using errcode = '22023';
  end if;

  if p_emails is not null then
    foreach v_e in array p_emails loop
      v_norm := lower(btrim(coalesce(v_e, '')));
      if v_norm = '' then
        continue;
      end if;
      if (char_length(v_norm) <= 200
          and v_norm ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$') is not true then
        raise exception 'Nieprawidłowy adres e-mail' using errcode = '22023';
      end if;
      if (v_norm = any (v_clean)) is not true then
        v_clean := array_append(v_clean, v_norm);
      end if;
    end loop;
  end if;

  select id into v_me from public.app_users where auth_id = auth.uid() and active;

  select emails into v_old
    from public.accounting_addresses
   where pack_key = v_pack
   for update;

  if (v_old is not null) is not true then
    insert into public.accounting_addresses (pack_key, emails, updated_at, updated_by)
    values (v_pack, v_clean, now(), v_me);
  elsif v_old is distinct from v_clean then
    update public.accounting_addresses
       set emails = v_clean, updated_at = now(), updated_by = v_me
     where pack_key = v_pack;
  end if;

  if v_old is distinct from v_clean then
    insert into public.audit_log (user_id, action, entity, entity_id, old_value, new_value)
    values (
      v_me,
      'ACCOUNTING_ADDRESSES_SET',
      'accounting_addresses',
      v_pack,
      jsonb_build_object('emails', to_jsonb(coalesce(v_old, '{}'::text[]))),
      jsonb_build_object('emails', to_jsonb(v_clean))
    );
  end if;
end $$;

revoke all on function public.accounting_addresses_set(text, text[]) from public, anon;
grant execute on function public.accounting_addresses_set(text, text[]) to authenticated;
comment on function public.accounting_addresses_set(text, text[]) is
  '#412 E40: zapis adresów paczki KSH/HHL; tylko HHL_ADMIN; audit ACCOUNTING_ADDRESSES_SET.';
