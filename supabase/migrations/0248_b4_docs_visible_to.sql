-- B4 cz.2 · visible_to dokumentów + odczyty czatu z dostępem do transportu (F7 #380)
-- 1) load_message_reads: select/insert jak msgs_read + loads_read (0208 / 0247 mark_read).
-- 2) documents.visible_to: CHECK — niepuste, tylko FORWARDER/CLIENT/CARRIER.
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
-- 2. documents.visible_to — obrona przed pustymi / SITE / obcymi kindami
-- ---------------------------------------------------------------------------
alter table public.documents
  drop constraint if exists documents_visible_to_chk;

alter table public.documents
  add constraint documents_visible_to_chk check (
    cardinality(visible_to) >= 1
    and visible_to <@ array['FORWARDER', 'CLIENT', 'CARRIER']::org_kind[]
  );

comment on constraint documents_visible_to_chk on public.documents is
  'B4 cz.2: visible_to dokumentu — niepuste, tylko FORWARDER/CLIENT/CARRIER (ALL albo zawężone, np. polisa HHL+SCX).';
