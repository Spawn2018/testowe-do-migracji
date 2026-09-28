-- =====================================================================
-- TOWER — Migracja 0078: III-6 (SCOPE 6.1, 6.2) dokumenty — wymagalność i terminy per kategoria w bazie,
--   wersjonowanie dokumentu, widoczność dokumentów organizacyjnych per organizacja.
--   1. doc_requirements: projekt × kategoria → wymagany?, kto dostarcza, zdarzenie odniesienia, przesunięcie [h].
--      Wartości startowe = dotychczasowa tabela w widoku Dokumenty (PROPOZYCJA do potwierdzenia z SCX/KSH).
--      Odczyt: każde aktywne konto (konfiguracja, bez danych wrażliwych). Zapis: doc_requirement_set (HHL, audit_log).
--   2. doc_requirements_status(projekt): transport × kategoria wymagana → termin, stan OK / MISSING / OVERDUE
--      (security invoker — tylko transporty i dokumenty widoczne dla konta; RLS).
--   3. documents.supersedes / superseded_at + document_supersede(nowy, poprzedni): wersja = poprzednia + 1,
--      tylko autor nowego pliku w ciągu godziny, ten sam transport i kategoria, poprzednia widoczna i aktualna.
--   4. docs_scope: dokument organizacyjny (bez transportu) przewoźnika niewidoczny dla innego przewoźnika.
--   Idempotentna.
-- =====================================================================

-- 1. Wymagalność i terminy ------------------------------------------------
create table if not exists doc_requirements (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  category     doc_category not null,
  required     boolean not null default true,
  responsible  org_kind not null,
  anchor       text not null check (anchor in ('BEFORE_LOAD', 'AT_LOAD', 'BEFORE_FERRY', 'AFTER_UNLOAD', 'ORG')),
  offset_hours integer not null default 0 check (offset_hours between 0 and 720),
  updated_by   uuid references app_users(id),
  updated_at   timestamptz not null default now(),
  unique (project_id, category)
);
alter table doc_requirements enable row level security;
revoke all on doc_requirements from anon, authenticated;
grant select on doc_requirements to authenticated;
drop policy if exists doc_requirements_read on doc_requirements;
create policy doc_requirements_read on doc_requirements for select to authenticated
  using (current_app_user_id() is not null);

create or replace function doc_requirements_seed(p_project uuid) returns void
language sql security definer set search_path = public as $$
  insert into doc_requirements (project_id, category, required, responsible, anchor, offset_hours)
  select p_project, v.category::doc_category, true, v.responsible::org_kind, v.anchor, v.offset_hours
    from (values
      ('PERMIT_PL',     'CARRIER', 'BEFORE_LOAD',  24),
      ('PERMIT_SE',     'CARRIER', 'BEFORE_FERRY', 24),
      ('CMR',           'CARRIER', 'AT_LOAD',       2),
      ('LASHING_PHOTO', 'CARRIER', 'AT_LOAD',       2),
      ('POD',           'CARRIER', 'AFTER_UNLOAD', 24),
      ('INSURANCE',     'CARRIER', 'ORG',           0),
      ('SPEC',          'CLIENT',  'BEFORE_LOAD',  72)
    ) as v(category, responsible, anchor, offset_hours)
  on conflict (project_id, category) do nothing
$$;
revoke all on function doc_requirements_seed(uuid) from public, anon, authenticated;
do $$ begin perform doc_requirements_seed(id) from projects; end $$;

create or replace function projects_after_insert_docreq() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform doc_requirements_seed(new.id); return new; end $$;
revoke all on function projects_after_insert_docreq() from public, anon, authenticated;
drop trigger if exists trg_projects_docreq on projects;
create trigger trg_projects_docreq after insert on projects for each row execute function projects_after_insert_docreq();

create or replace function doc_requirement_set(
  p_project uuid, p_category doc_category, p_required boolean, p_responsible org_kind, p_anchor text, p_offset_hours integer
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_user uuid; v_old jsonb;
begin
  if (is_hhl()) is not true then
    raise exception 'Wymagalność dokumentów ustawia wyłącznie HHL' using errcode = '42501';
  end if;
  if (p_anchor in ('BEFORE_LOAD', 'AT_LOAD', 'BEFORE_FERRY', 'AFTER_UNLOAD', 'ORG')) is not true then
    raise exception 'Nieznane zdarzenie odniesienia: %', coalesce(p_anchor, '—') using errcode = '22023';
  end if;
  if (p_offset_hours between 0 and 720) is not true then
    raise exception 'Przesunięcie terminu 0–720 h' using errcode = '22023';
  end if;
  if (p_required is not null and p_responsible is not null and p_category is not null) is not true then
    raise exception 'Brak kategorii, wymagalności albo strony odpowiedzialnej' using errcode = '22023';
  end if;
  if (exists (select 1 from projects where id = p_project)) is not true then raise exception 'Nieznany projekt'; end if;
  v_user := current_app_user_id();
  select to_jsonb(r) - 'id' - 'updated_at' - 'updated_by' into v_old from doc_requirements r
   where project_id = p_project and category = p_category;
  insert into doc_requirements (project_id, category, required, responsible, anchor, offset_hours, updated_by, updated_at)
  values (p_project, p_category, p_required, p_responsible, p_anchor, p_offset_hours, v_user, now())
  on conflict (project_id, category) do update
    set required = excluded.required, responsible = excluded.responsible, anchor = excluded.anchor,
        offset_hours = excluded.offset_hours, updated_by = excluded.updated_by, updated_at = now()
  returning id into v_id;
  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (v_user, 'DOC_REQUIREMENT_SET', 'doc_requirements', v_id::text, v_old,
          jsonb_build_object('category', p_category, 'required', p_required, 'responsible', p_responsible,
                             'anchor', p_anchor, 'offset_hours', p_offset_hours));
  return v_id;
end $$;
revoke all on function doc_requirement_set(uuid, doc_category, boolean, org_kind, text, integer) from public, anon;
grant execute on function doc_requirement_set(uuid, doc_category, boolean, org_kind, text, integer) to authenticated;

-- 3. Wersjonowanie ----------------------------------------------------------
alter table documents add column if not exists supersedes uuid references documents(id) on delete set null;
alter table documents add column if not exists superseded_at timestamptz;
create index if not exists documents_supersedes_idx on documents (supersedes);

create or replace function document_supersede(p_new uuid, p_old uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare n documents%rowtype; o documents%rowtype; v_user uuid := current_app_user_id();
begin
  if v_user is null then raise exception 'Brak aktywnego konta' using errcode = '42501'; end if;
  select * into n from documents where id = p_new;
  if (n.id is not null and n.uploaded_by = v_user and n.uploaded_at > now() - interval '1 hour') is not true then
    raise exception 'Nową wersję oznacza tylko autor pliku, w ciągu godziny od wgrania' using errcode = '42501';
  end if;
  -- poprzednia wersja musi być widoczna dla konta (RLS jak przy odczycie)
  if (exists (select 1 from documents d where d.id = p_old and (is_hhl() or current_org_kind() = any (d.visible_to))
        and (d.load_id is null or exists (select 1 from loads l where l.id = d.load_id)))) is not true then
    raise exception 'Poprzednia wersja niewidoczna dla konta' using errcode = '42501';
  end if;
  select * into o from documents where id = p_old;
  if (o.id <> n.id and o.category = n.category and o.project_id = n.project_id
      and o.load_id is not distinct from n.load_id) is not true then
    raise exception 'Wersje muszą dotyczyć tego samego transportu i kategorii' using errcode = '22023';
  end if;
  if o.superseded_at is not null then raise exception 'Poprzednia wersja jest już zastąpiona' using errcode = '22023'; end if;
  if n.supersedes is not null then raise exception 'Plik jest już nową wersją innego dokumentu' using errcode = '22023'; end if;
  update documents set supersedes = o.id, version = o.version + 1 where id = n.id;
  update documents set superseded_at = now() where id = o.id;
  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (v_user, 'DOCUMENT_NEW_VERSION', 'documents', n.id::text,
          jsonb_build_object('id', o.id, 'version', o.version), jsonb_build_object('id', n.id, 'version', o.version + 1));
  return o.version + 1;
end $$;
revoke all on function document_supersede(uuid, uuid) from public, anon;
grant execute on function document_supersede(uuid, uuid) to authenticated;

-- 2. Stan wymagań per transport ---------------------------------------------
create or replace function doc_requirements_status(p_project uuid)
returns table (load_id uuid, category doc_category, responsible org_kind, due_at timestamptz, has_doc boolean, state text)
language sql stable security invoker set search_path = public as $$
  with req as (
    select r.* from doc_requirements r where r.project_id = p_project and r.required and r.anchor <> 'ORG'
  ), ld as (
    select l.id, l.plan_load_from, l.plan_load_to, l.plan_load_date, l.plan_delivery_from, l.plan_delivery_to,
           l.plan_delivery_date, coalesce(s.delayed_departure_at, s.departure_at) as ferry_at
      from loads l left join sailings s on s.id = l.sailing_id
     where l.project_id = p_project and l.status <> 'CANCELLED'
  ), x as (
    select ld.id as load_id, req.category, req.responsible,
      case req.anchor
        when 'BEFORE_LOAD' then coalesce(ld.plan_load_from, (ld.plan_load_date + time '06:00') at time zone 'Europe/Warsaw')
                                 - make_interval(hours => req.offset_hours)
        when 'AT_LOAD' then coalesce(ld.plan_load_to, ld.plan_load_from, (ld.plan_load_date + time '18:00') at time zone 'Europe/Warsaw')
                                 + make_interval(hours => req.offset_hours)
        when 'BEFORE_FERRY' then ld.ferry_at - make_interval(hours => req.offset_hours)
        when 'AFTER_UNLOAD' then coalesce(ld.plan_delivery_to, ld.plan_delivery_from,
                                 (ld.plan_delivery_date + time '23:59') at time zone 'Europe/Stockholm')
                                 + make_interval(hours => req.offset_hours)
      end as due_at,
      exists (select 1 from documents d where d.load_id = ld.id and d.category = req.category and d.superseded_at is null) as has_doc
    from ld cross join req
  )
  select x.load_id, x.category, x.responsible, x.due_at, x.has_doc,
         case when x.has_doc then 'OK' when x.due_at is not null and x.due_at < now() then 'OVERDUE' else 'MISSING' end
    from x
$$;
revoke all on function doc_requirements_status(uuid) from public, anon;
grant execute on function doc_requirements_status(uuid) to authenticated;

-- 4. Widoczność dokumentów organizacyjnych per organizacja -------------------
drop policy if exists docs_scope on documents;
create policy docs_scope on documents as restrictive for select to authenticated using (
  is_hhl()
  or case
       when category = 'INVOICE' then
            uploaded_by = current_app_user_id()
         or exists (select 1 from invoice_documents x where x.document_id = documents.id)
         or exists (select 1 from invoices i where i.document_id = documents.id)
       when load_id is not null then
            exists (select 1 from loads l where l.id = documents.load_id)
       else
            -- dokument organizacyjny (np. polisa): przewoźnik nie widzi dokumentów innego przewoźnika
            current_org_kind() <> 'CARRIER'
         or documents.uploaded_by is null
         or exists (select 1 from app_users u join organizations o on o.id = u.org_id
                     where u.id = documents.uploaded_by and (u.org_id = current_org_id() or o.kind <> 'CARRIER'))
     end
);
