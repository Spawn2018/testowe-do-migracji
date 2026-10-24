-- #412 / D-20261021-2040-01 pkt 2 — E40: dziennik wysyłek paczki tygodnia + RPC odczytu/zapisu.
-- Odczyt i wysyłka (wpis w dzienniku): HHL Administrator i Operacje.
-- Prawdziwy e-mail z załącznikami (Resend/Edge) — osobno; L47/W6: pierwsza wysyłka na prod = właściciel.
-- Front podłącza koordynator (accountingPackConfigOf / accountingPackActionsOf).

select set_config('tower.audit_source', 'migracja 0286 (#412 E40 paczka dziennik)', true);

-- ---------------------------------------------------------------------------
-- Dziennik wysyłek (klucz PackConfig.sent = week_key:pack_key).
-- ---------------------------------------------------------------------------
create table if not exists public.accounting_pack_sends (
  id          uuid primary key default gen_random_uuid(),
  week_key    text not null
                check (week_key ~ '^[0-9]{4}-W[0-9]{2}$'),
  pack_key    text not null check (pack_key in ('KSH', 'HHL')),
  sent_at     timestamptz not null default now(),
  to_count    int not null check (to_count >= 1 and to_count <= 20),
  emails      text[] not null,
  files       text[] not null default '{}'::text[],
  status      text not null
                check (status in ('WYSLANO', 'DORECZONO', 'BLAD')),
  by_user_id  uuid not null references public.app_users(id),
  by_name     text not null,
  note        text
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
  '#412 E40: dziennik wysyłek paczki tygodnia (Finanse); zapis tylko przez accounting_pack_send.';

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
-- Wpis wysyłki w dzienniku (+ audit). Bez Resend — Edge/W6 osobno (L47).
-- ---------------------------------------------------------------------------
create or replace function public.accounting_pack_send(
  p_pack text,
  p_week text,
  p_files text[] default '{}'::text[]
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
  v_files text[] := coalesce(p_files, '{}'::text[]);
  v_id uuid;
  v_at timestamptz;
  v_n int;
begin
  if (public.is_hhl()) is not true then
    raise exception 'Paczka tygodnia — tylko HHL' using errcode = '42501';
  end if;
  if (v_pack in ('KSH', 'HHL')) is not true then
    raise exception 'Paczka: KSH albo HHL' using errcode = '22023';
  end if;
  if (v_week ~ '^[0-9]{4}-W[0-9]{2}$') is not true then
    raise exception 'Tydzień ISO: RRRR-Wnn' using errcode = '22023';
  end if;
  if (cardinality(v_files) <= 40) is not true then
    raise exception 'Lista plików: najwyżej 40' using errcode = '22023';
  end if;

  select u.id,
         coalesce(nullif(btrim(u.full_name), ''), split_part(u.email::text, '@', 1), '—')
    into v_me, v_by
    from public.app_users u
   where u.auth_id = auth.uid() and u.active;
  if (v_me is not null) is not true then
    raise exception 'Paczka tygodnia — tylko HHL' using errcode = '42501';
  end if;

  select a.emails into v_emails
    from public.accounting_addresses a
   where a.pack_key = v_pack;
  v_n := coalesce(cardinality(v_emails), 0);
  if (v_n >= 1) is not true then
    raise exception 'Brak adresu księgowości — uzupełnij w Opcjach' using errcode = 'P0002';
  end if;

  v_at := now();
  insert into public.accounting_pack_sends (
    week_key, pack_key, sent_at, to_count, emails, files, status, by_user_id, by_name, note
  ) values (
    v_week, v_pack, v_at, v_n, v_emails, v_files, 'WYSLANO', v_me, v_by,
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
      'status', 'WYSLANO'
    )
  );

  return jsonb_build_object(
    'at', to_jsonb(v_at),
    'to', v_n,
    'status', 'WYSLANO',
    'by', v_by
  );
end $$;

revoke all on function public.accounting_pack_send(text, text, text[]) from public, anon;
grant execute on function public.accounting_pack_send(text, text, text[]) to authenticated;
comment on function public.accounting_pack_send(text, text, text[]) is
  '#412 E40: wpis wysyłki paczki w dzienniku + audit; HHL; bez Resend (L47/W6).';
