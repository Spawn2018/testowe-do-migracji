-- B4 cz.2 · visible_to dokumentów + odczyty czatu z dostępem do transportu (F7 #380 / #381)
-- 1) load_message_reads: select/insert jak msgs_read + loads_read (0208 / 0247 mark_read).
-- 2) documents.visible_to: CHECK ściśle ALL albo HHL+SCX (jak 0247); wyzwalacz zapisu.
-- 3) DOC_UPLOADED: visible_to zdarzenia = dokumentu; events_read filtruje.
-- RLS docs_read + docs_scope już filtrują widoczność (paczka/eksport = SELECT).
-- Plików src/ nie zmieniamy (UI paczki w P5/P6).

-- ---------------------------------------------------------------------------
-- 1. Odczyty czatu: warunek transportu jak loads_read
-- ---------------------------------------------------------------------------
drop policy if exists load_message_reads_select on public.load_message_reads;
create policy load_message_reads_select on public.load_message_reads
  for select to authenticated using (
    exists (
      select 1
        from load_messages m
        join loads l on l.id = m.load_id
       where m.id = load_message_reads.message_id
         and (
           public.is_hhl()
           or (
             current_org_kind() = any (m.visible_to)
             and (
               (current_org_kind() = 'CLIENT'
                and exists (
                  select 1 from projects p
                   where p.id = l.project_id and p.client_org_id = current_org_id()
                ))
               or (current_org_kind() = 'CARRIER' and l.carrier_org_id = current_org_id())
             )
           )
         )
    )
  );

drop policy if exists load_message_reads_insert on public.load_message_reads;
create policy load_message_reads_insert on public.load_message_reads
  for insert to authenticated with check (
    user_id = current_app_user_id()
    and exists (
      select 1
        from load_messages m
        join loads l on l.id = m.load_id
       where m.id = message_id
         and (
           public.is_hhl()
           or (
             current_org_kind() = any (m.visible_to)
             and (
               (current_org_kind() = 'CLIENT'
                and exists (
                  select 1 from projects p
                   where p.id = l.project_id and p.client_org_id = current_org_id()
                ))
               or (current_org_kind() = 'CARRIER' and l.carrier_org_id = current_org_id())
             )
           )
         )
    )
  );

-- ---------------------------------------------------------------------------
-- 2. documents.visible_to — tylko ALL albo HHL+SCX (jak load_messages 0247)
-- ---------------------------------------------------------------------------
alter table public.documents
  drop constraint if exists documents_visible_to_chk;

alter table public.documents
  add constraint documents_visible_to_chk check (
    (
      cardinality(visible_to) = 3
      and visible_to @> array['FORWARDER', 'CLIENT', 'CARRIER']::org_kind[]
      and visible_to <@ array['FORWARDER', 'CLIENT', 'CARRIER']::org_kind[]
    )
    or (
      cardinality(visible_to) = 2
      and visible_to @> array['FORWARDER', 'CARRIER']::org_kind[]
      and visible_to <@ array['FORWARDER', 'CARRIER']::org_kind[]
    )
  );

comment on constraint documents_visible_to_chk on public.documents is
  'B4 cz.2: visible_to dokumentu — tylko ALL albo HHL+SCX (jak czat 0247).';

-- Zapis visible_to po stronie serwera (jak set_message_author).
-- Nazwa trg_documents_a_* — przed insurance_visibility (0237), żeby polisa SCX mogła
-- zawęzić do HHL+SCX po normalizacji. Faktury: bez osobnego wyjątku (ALL / HHL+SCX).
create or replace function public.set_document_visible_to() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_kind text;
  v_vis org_kind[];
  v_all constant org_kind[] := array['FORWARDER', 'CLIENT', 'CARRIER']::org_kind[];
  v_hhl_scx constant org_kind[] := array['FORWARDER', 'CARRIER']::org_kind[];
begin
  /* Bez sesji (cron / service_role): CHECK documents_visible_to_chk pilnuje wartości. */
  if auth.uid() is null then
    return new;
  end if;

  select o.kind::text
    into v_kind
    from app_users u
    join organizations o on o.id = u.org_id
   where u.auth_id = auth.uid() and u.active;
  if (v_kind is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;

  if v_kind = 'CLIENT' then
    new.visible_to := v_all;
    return new;
  end if;

  v_vis := coalesce(new.visible_to, v_all);
  v_vis := array(select distinct x from unnest(v_vis) as t(x) order by x);

  if v_vis @> v_all and cardinality(v_vis) = 3 then
    new.visible_to := v_all;
  elsif v_vis @> v_hhl_scx
        and cardinality(v_vis) = 2
        and not ('CLIENT'::org_kind = any (v_vis)) then
    if (v_kind in ('FORWARDER', 'CARRIER')) is not true then
      raise exception 'Widoczność dokumentu: tylko HHL i SCX albo wszyscy'
        using errcode = '22023';
    end if;
    new.visible_to := v_hhl_scx;
  else
    raise exception 'Widoczność dokumentu: dozwolone tylko „HHL, SCX i KSH” albo „tylko HHL i SCX”'
      using errcode = '22023';
  end if;

  return new;
end $$;

revoke execute on function public.set_document_visible_to() from public, anon, authenticated;

comment on function public.set_document_visible_to() is
  'B4 cz.2: visible_to dokumentu (ALL / HHL+SCX; KSH zawsze ALL). Polisa SCX — 0237 po tym wyzwalaczu.';

drop trigger if exists trg_documents_a_set_visible_to on public.documents;
create trigger trg_documents_a_set_visible_to
  before insert or update of visible_to on public.documents
  for each row execute function public.set_document_visible_to();

-- ---------------------------------------------------------------------------
-- 3. DOC_UPLOADED: visible_to zdarzenia = dokumentu; events_read filtruje
-- ---------------------------------------------------------------------------
alter table public.load_events
  add column if not exists visible_to org_kind[];

comment on column public.load_events.visible_to is
  'B4: kto widzi zdarzenie (NULL = jak dotąd, każdy z dostępem do transportu). DOC_UPLOADED kopiuje z dokumentu.';

alter table public.load_events
  drop constraint if exists load_events_visible_to_chk;

alter table public.load_events
  add constraint load_events_visible_to_chk check (
    visible_to is null
    or (
      cardinality(visible_to) = 3
      and visible_to @> array['FORWARDER', 'CLIENT', 'CARRIER']::org_kind[]
      and visible_to <@ array['FORWARDER', 'CLIENT', 'CARRIER']::org_kind[]
    )
    or (
      cardinality(visible_to) = 2
      and visible_to @> array['FORWARDER', 'CARRIER']::org_kind[]
      and visible_to <@ array['FORWARDER', 'CARRIER']::org_kind[]
    )
  );

create or replace function public.set_event_doc_visible_to() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_doc uuid;
  v_vis org_kind[];
begin
  if new.event_type is distinct from 'DOC_UPLOADED' then
    return new;
  end if;

  begin
    v_doc := coalesce(
      nullif(new.payload->>'documentId', '')::uuid,
      nullif(new.payload->>'document_id', '')::uuid
    );
  exception when others then
    v_doc := null;
  end;

  if v_doc is null then
    return new;
  end if;

  select d.visible_to into v_vis
    from public.documents d
   where d.id = v_doc;

  if v_vis is not null then
    new.visible_to := v_vis;
  end if;

  return new;
end $$;

revoke execute on function public.set_event_doc_visible_to() from public, anon, authenticated;

comment on function public.set_event_doc_visible_to() is
  'B4: DOC_UPLOADED dziedziczy visible_to z dokumentu (payload.documentId).';

drop trigger if exists trg_load_events_doc_visible_to on public.load_events;
create trigger trg_load_events_doc_visible_to
  before insert on public.load_events
  for each row execute function public.set_event_doc_visible_to();

drop policy if exists events_read on public.load_events;
create policy events_read on public.load_events
  for select to authenticated using (
    exists (select 1 from loads l where l.id = load_events.load_id)
    and (
      public.is_hhl()
      or load_events.visible_to is null
      or public.current_org_kind() = any (load_events.visible_to)
    )
  );
