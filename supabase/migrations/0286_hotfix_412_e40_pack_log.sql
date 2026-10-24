-- #412 / D-20261021-2040-01 pkt 2 — E40: dziennik wysyłek paczki tygodnia + RPC odczytu/zapisu.
-- Odczyt i zlecenie (wpis w dzienniku): HHL Administrator i Operacje.
-- Status ZLECONO = zlecenie w dzienniku (bez e-maila). WYSLANO/DORECZONO/BLAD ustawia Edge (service_role).
-- Prawdziwy e-mail z załącznikami (Resend/Edge) — osobno; L47/W6: pierwsza wysyłka na prod = właściciel.
-- Front podłącza koordynator (accountingPackConfigOf / accountingPackActionsOf).
-- F7 #512: ZLECONO + idempotencja + invoice_ids z serwera; tydzień ISO 01–53; retencja e-mail 5 lat.

select set_config('tower.audit_source', 'migracja 0286 (#412 E40 paczka dziennik)', true);

-- ---------------------------------------------------------------------------
-- Dziennik wysyłek (klucz PackConfig.sent = week_key:pack_key).
-- ---------------------------------------------------------------------------
create table if not exists public.accounting_pack_sends (
  id           uuid primary key default gen_random_uuid(),
  week_key     text not null
                 check (week_key ~ '^[0-9]{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$'),
  pack_key     text not null check (pack_key in ('KSH', 'HHL')),
  sent_at      timestamptz not null default now(),
  to_count     int not null check (to_count >= 1 and to_count <= 20),
  emails       text[] not null,
  files        text[] not null default '{}'::text[],
  invoice_ids  uuid[] not null default '{}'::uuid[],
  status       text not null
                 check (status in ('ZLECONO', 'WYSLANO', 'DORECZONO', 'BLAD')),
  resend       boolean not null default false,
  error_text   text,
  by_user_id   uuid not null references public.app_users(id),
  by_name      text not null,
  note         text
);

create index if not exists accounting_pack_sends_week_pack_idx
  on public.accounting_pack_sends (week_key, pack_key, sent_at desc);

alter table public.accounting_pack_sends enable row level security;

revoke all on table public.accounting_pack_sends from public, anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.accounting_pack_sends from authenticated;
grant select on table public.accounting_pack_sends to authenticated;

drop policy if exists accounting_pack_sends_read on public.accounting_pack_sends;
create policy accounting_pack_sends_read on public.accounting_pack_sends
  for select to authenticated
  using ((public.is_hhl()) is true);

comment on table public.accounting_pack_sends is
  '#412 E40: dziennik zleceń/wysyłek paczki tygodnia; zapis przez accounting_pack_send / _set_status. Retencja e-mail w emails+audit: 5 lat (jak dokumenty księgowe; F7 #512).';
comment on column public.accounting_pack_sends.by_user_id is
  'FK bez ON DELETE: konta app_users tylko dezaktywujemy (active=false), nie usuwamy.';
comment on column public.accounting_pack_sends.emails is
  'Kopia adresów (dowód). Retencja 5 lat — F7 #512.';

-- ---------------------------------------------------------------------------
-- Konfiguracja pod PackConfig: adresy + ostatnia wysyłka na tydzień:paczkę.
-- ---------------------------------------------------------------------------
create or replace function public.accounting_pack_config()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_addr jsonb;
  v_sent jsonb := '{}'::jsonb;
  r record;
begin
  if (public.is_hhl()) is not true then
    raise exception 'Paczka tygodnia — tylko HHL' using errcode = '42501';
  end if;

  v_addr := public.accounting_addresses_get();

  for r in
    select distinct on (s.week_key, s.pack_key)
           s.week_key,
           s.pack_key,
           s.sent_at,
           s.to_count,
           s.status,
           s.by_name
      from public.accounting_pack_sends s
     order by s.week_key, s.pack_key, s.sent_at desc
  loop
    v_sent := v_sent || jsonb_build_object(
      r.week_key || ':' || r.pack_key,
      jsonb_build_object(
        'at', to_jsonb(r.sent_at),
        'to', r.to_count,
        'status', r.status,
        'by', r.by_name
      )
    );
  end loop;

  return jsonb_build_object('addresses', v_addr, 'sent', v_sent);
end $$;

revoke all on function public.accounting_pack_config() from public, anon;
grant execute on function public.accounting_pack_config() to authenticated;
comment on function public.accounting_pack_config() is
  '#412 E40: {addresses, sent} pod PackConfig; tylko HHL.';

-- ---------------------------------------------------------------------------
-- Zlecenie paczki w dzienniku (+ audit). Bez Resend — Edge/W6 osobno (L47).
-- invoice_ids i pliki liczy serwer; p_files opcjonalnie walidowane (limit), ignorowane przy zapisie.
-- ---------------------------------------------------------------------------
drop function if exists public.accounting_pack_send(text, text, text[]);

create or replace function public.accounting_pack_send(
  p_pack text,
  p_week text,
  p_files text[] default '{}'::text[],
  p_resend boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pack text := upper(btrim(coalesce(p_pack, '')));
  v_week text := upper(btrim(coalesce(p_week, '')));
  v_me uuid;
  v_by text;
  v_emails text[];
  v_files_in text[] := coalesce(p_files, '{}'::text[]);
  v_files text[] := '{}'::text[];
  v_inv_ids uuid[] := '{}'::uuid[];
  v_dir text;
  v_id uuid;
  v_at timestamptz;
  v_n int;
  v_week_d date;
  v_f text;
  r record;
begin
  if (public.is_hhl()) is not true then
    raise exception 'Paczka tygodnia — tylko HHL' using errcode = '42501';
  end if;
  if (v_pack in ('KSH', 'HHL')) is not true then
    raise exception 'Paczka: KSH albo HHL' using errcode = '22023';
  end if;
  if (v_week ~ '^[0-9]{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$') is not true then
    raise exception 'Tydzień ISO: RRRR-Wnn (01–53)' using errcode = '22023';
  end if;
  begin
    v_week_d := to_date(v_week, 'IYYY-"W"IW');
  exception when others then
    raise exception 'Tydzień ISO: RRRR-Wnn (01–53)' using errcode = '22023';
  end;
  if (to_char(v_week_d, 'IYYY-"W"IW') is not distinct from v_week) is not true then
    raise exception 'Tydzień ISO: RRRR-Wnn (01–53)' using errcode = '22023';
  end if;
  if (cardinality(v_files_in) <= 40) is not true then
    raise exception 'Lista plików: najwyżej 40' using errcode = '22023';
  end if;
  foreach v_f in array v_files_in loop
    if (v_f is not null and btrim(v_f) <> '') is not true then
      raise exception 'Nazwa pliku nie może być pusta' using errcode = '22023';
    end if;
    if (char_length(btrim(v_f)) <= 200) is not true then
      raise exception 'Nazwa pliku: najwyżej 200 znaków' using errcode = '22023';
    end if;
  end loop;

  select u.id,
         coalesce(nullif(btrim(u.full_name), ''), split_part(u.email::text, '@', 1), '—')
    into v_me, v_by
    from public.app_users u
   where u.auth_id = auth.uid() and u.active;
  if (v_me is not null) is not true then
    raise exception 'Paczka tygodnia — tylko HHL' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_week || ':' || v_pack));

  if (p_resend is true) is not true
     and exists (
       select 1 from public.accounting_pack_sends s
        where s.week_key = v_week and s.pack_key = v_pack and s.status is distinct from 'BLAD'
     ) then
    raise exception 'Paczka już zlecona — użyj ponowienia' using errcode = 'P0001';
  end if;

  select a.emails into v_emails
    from public.accounting_addresses a
   where a.pack_key = v_pack;
  v_n := coalesce(cardinality(v_emails), 0);
  if (v_n >= 1) is not true then
    raise exception 'Brak adresu księgowości — uzupełnij w Opcjach' using errcode = 'P0002';
  end if;

  v_dir := case when v_pack = 'KSH' then 'PRZYCHOD' else 'KOSZT' end;

  select coalesce(array_agg(i.id order by i.issue_date nulls last, i.invoice_number), '{}'::uuid[])
    into v_inv_ids
    from public.invoices i
   where i.week_key = v_week
     and i.direction = v_dir;

  if (cardinality(v_inv_ids) >= 1) is not true then
    raise exception 'Brak faktury w tygodniu — paczka zablokowana' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.invoices i
     where i.id = any (v_inv_ids) and i.document_id is null
  ) then
    raise exception 'Brak PDF faktury — paczka zablokowana' using errcode = 'P0002';
  end if;

  if v_pack = 'HHL' then
    if exists (
      select 1 from public.invoices i
       where i.id = any (v_inv_ids) and i.verification_status = 'SPORNA'
    ) then
      raise exception 'Faktura sporna — paczka zablokowana' using errcode = 'P0002';
    end if;
    if exists (
      select 1 from public.invoices i
       where i.id = any (v_inv_ids)
         and i.verification_status is distinct from 'ZAAKCEPTOWANA'
         and i.payment_status is distinct from 'OPLACONA'
    ) then
      raise exception 'Faktura niezaakceptowana — paczka zablokowana' using errcode = 'P0002';
    end if;
  end if;

  if exists (
    select 1
      from public.invoice_lines il
     where il.invoice_id = any (v_inv_ids)
       and not exists (
         select 1 from public.documents d
          where d.load_id = il.load_id and d.category = 'CMR'
       )
  ) then
    raise exception 'Brak CMR — paczka zablokowana' using errcode = 'P0002';
  end if;

  for r in
    select i.invoice_number
      from public.invoices i
     where i.id = any (v_inv_ids)
     order by i.issue_date nulls last, i.invoice_number
  loop
    v_files := array_append(
      v_files,
      regexp_replace(
        regexp_replace(btrim(coalesce(r.invoice_number, 'FV')), '[^\w.-]+', '_', 'g'),
        '^_+|_+$', '', 'g'
      ) || '.pdf'
    );
  end loop;

  v_at := now();
  insert into public.accounting_pack_sends (
    week_key, pack_key, sent_at, to_count, emails, files, invoice_ids,
    status, resend, by_user_id, by_name, note
  ) values (
    v_week, v_pack, v_at, v_n, v_emails, v_files, v_inv_ids,
    'ZLECONO', coalesce(p_resend, false), v_me, v_by,
    'Dziennik: e-mail z załącznikami po W6 / Edge (L47)'
  )
  returning id into v_id;

  insert into public.audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (
    v_me,
    'ACCOUNTING_PACK_SEND',
    'accounting_pack_sends',
    v_id::text,
    null,
    jsonb_build_object(
      'week', v_week,
      'pack', v_pack,
      'to', v_n,
      'emails', to_jsonb(v_emails),
      'files', to_jsonb(v_files),
      'invoice_ids', to_jsonb(v_inv_ids),
      'status', 'ZLECONO',
      'resend', coalesce(p_resend, false)
    )
  );

  return jsonb_build_object(
    'at', to_jsonb(v_at),
    'to', v_n,
    'status', 'ZLECONO',
    'by', v_by,
    'id', v_id
  );
end $$;

revoke all on function public.accounting_pack_send(text, text, text[], boolean) from public, anon;
grant execute on function public.accounting_pack_send(text, text, text[], boolean) to authenticated;
comment on function public.accounting_pack_send(text, text, text[], boolean) is
  '#412 E40: zlecenie paczki (ZLECONO) + audit; HHL; invoice_ids z serwera; bez Resend (L47/W6).';

-- ---------------------------------------------------------------------------
-- Edge: ZLECONO → WYSLANO / DORECZONO / BLAD (+ opcjonalny błąd).
-- ---------------------------------------------------------------------------
create or replace function public.accounting_pack_send_set_status(
  p_id uuid,
  p_status text,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jwt_role text;
  v_status text := upper(btrim(coalesce(p_status, '')));
  v_old text;
begin
  if session_user not in ('postgres', 'supabase_admin') then
    if to_regprocedure('auth.role()') is not null then
      execute 'select auth.role()' into v_jwt_role;
    end if;
    if (coalesce(v_jwt_role, '') = 'service_role') is not true then
      raise exception 'Status paczki — tylko Edge (service_role)' using errcode = '42501';
    end if;
  end if;

  if (v_status in ('WYSLANO', 'DORECZONO', 'BLAD')) is not true then
    raise exception 'Status: WYSLANO, DORECZONO albo BLAD' using errcode = '22023';
  end if;

  select s.status into v_old
    from public.accounting_pack_sends s
   where s.id = p_id
   for update;
  if (v_old is not null) is not true then
    raise exception 'Brak wpisu paczki' using errcode = 'P0002';
  end if;

  update public.accounting_pack_sends
     set status = v_status,
         error_text = case when v_status = 'BLAD' then nullif(btrim(p_error), '') else null end,
         note = case
           when v_status = 'WYSLANO' then 'Edge: e-mail przyjęty do wysyłki'
           when v_status = 'DORECZONO' then 'Edge: e-mail doręczony'
           else coalesce(nullif(btrim(p_error), ''), 'Edge: błąd wysyłki')
         end
   where id = p_id;

  insert into public.audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (
    null,
    'ACCOUNTING_PACK_STATUS',
    'accounting_pack_sends',
    p_id::text,
    jsonb_build_object('status', v_old),
    jsonb_build_object('status', v_status, 'error', nullif(btrim(p_error), ''))
  );
end $$;

revoke all on function public.accounting_pack_send_set_status(uuid, text, text) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.accounting_pack_send_set_status(uuid, text, text) to service_role;
  end if;
end $$;
comment on function public.accounting_pack_send_set_status(uuid, text, text) is
  '#412 E40: Edge ustawia WYSLANO/DORECZONO/BLAD po Resend; tylko service_role.';
