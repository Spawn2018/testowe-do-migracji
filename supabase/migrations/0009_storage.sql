-- =====================================================================
-- TOWER — Migracja 0009: pliki w Supabase Storage (BK4)
--
-- Trzy PRYWATNE koszyki (bez publicznych adresów):
--   dokumenty — CMR, POD, zezwolenia, polisy, specyfikacje, rezerwacje promu
--   zdjecia   — zdjęcia mocowania (aplikacja kierowcy / wieża)
--   faktury   — PDF faktur (rejestracja faktur: M6)
-- Ścieżka obiektu = documents.storage_path = <koszyk>/<projekt>/<transport|org>/<id dokumentu>/<nazwa>
-- — nadawana WYŁĄCZNIE przez serwer (wyzwalacz), klient nie wybiera ścieżki.
--
-- Widoczność pliku = widoczność wiersza `documents` (RLS z 0001 + zawężenie
-- niżej). Polityka odczytu obiektu to zapytanie do `documents` z prawami
-- użytkownika — ta sama reguła dla metadanych i bajtów, zgodna z
-- `invoice_documents` (0003: KSH wyłącznie FAKTURA_PDF / CMR / POD).
-- Linki: podpisane przez Storage, ważne 15 minut (aplikacja: 900 s).
-- Obiektów nie wolno nadpisywać ani usuwać z API (brak polityk UPDATE/DELETE).
--
-- IDEMPOTENTNA. Na czystym Postgresie (tests/db, bez schematu `storage`)
-- część Storage jest pomijana z komunikatem — reszta (documents) działa.
-- =====================================================================

-- 1. Pomocnicze -----------------------------------------------------------
create or replace function current_app_user_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from app_users where auth_id = auth.uid() and active
$$;

create or replace function doc_bucket(p_category doc_category) returns text
language sql immutable as $$
  select case p_category
           when 'LASHING_PHOTO' then 'zdjecia'
           when 'INVOICE'       then 'faktury'
           else 'dokumenty' end
$$;

create or replace function doc_safe_name(p_name text) returns text
language sql immutable as $$
  select left(coalesce(nullif(regexp_replace(
           translate(coalesce(p_name, ''), 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻåäöÅÄÖ', 'acelnoszzACELNOSZZaaoAAO'),
           '[^A-Za-z0-9._-]+', '_', 'g'), ''), 'plik'), 120)
$$;

-- 2. documents: ścieżka, autor, projekt nadawane przez serwer --------------
create unique index if not exists documents_storage_path_key on documents (storage_path);

create or replace function documents_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_project uuid;
begin
  if auth.uid() is not null then
    v_user := current_app_user_id();
    if v_user is null then raise exception 'Brak aktywnego konta' using errcode = '42501'; end if;
    new.uploaded_by := v_user;
    new.uploaded_at := now();
  elsif new.storage_path is not null and new.storage_path not in ('', '-') then
    return new;                                    -- service role z własną ścieżką (import systemowy)
  end if;
  if new.load_id is not null then
    select project_id into v_project from loads where id = new.load_id;
    if v_project is null then raise exception 'Transport nie istnieje' using errcode = '23503'; end if;
    new.project_id := v_project;
  end if;
  new.id          := coalesce(new.id, gen_random_uuid());
  new.version     := coalesce(new.version, 1);
  new.storage_path := doc_bucket(new.category) || '/' || new.project_id || '/'
                      || coalesce(new.load_id::text, 'org') || '/' || new.id || '/'
                      || doc_safe_name(new.file_name);
  return new;
end $$;
revoke execute on function documents_before_insert() from public, anon, authenticated;
drop trigger if exists trg_documents_before_insert on documents;
create trigger trg_documents_before_insert before insert on documents
  for each row execute function documents_before_insert();

-- 3. documents: polityki ---------------------------------------------------
-- Wstawienie: HHL — każdy; przewoźnik / klient — tylko do transportu, który
-- widzą (RLS `loads`); bez transportu wyłącznie przewoźnik: polisa, faktura.
drop policy if exists docs_insert on documents;
create policy docs_insert on documents for insert to authenticated with check (
  is_hhl()
  or (current_org_kind() in ('CARRIER','CLIENT')
      and load_id is not null
      and exists (select 1 from loads l where l.id = documents.load_id))
  or (current_org_kind() = 'CARRIER' and load_id is null and category in ('INSURANCE','INVOICE'))
);

-- Odczyt — zawężenie (restrykcyjne, łączone z docs_read z 0001):
--  * PDF faktury: tylko strona faktury (przez RLS invoices / invoice_documents)
--    albo osoba, która go wgrała (przed podpięciem do faktury);
--  * dokument transportu: tylko gdy transport jest widoczny (RLS loads);
--  * dokumenty organizacyjne (polisy): jak dotąd `visible_to`.
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
       else true
     end
);

-- 4. RPC: rejestracja dokumentu przed wgraniem pliku ------------------------
create or replace function create_document(
  p_load_id uuid, p_category doc_category, p_file_name text, p_mime text, p_size bigint,
  p_project_id uuid default null
) returns table (id uuid, bucket text, object_path text, storage_path text)
language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
declare
  v_bucket text := doc_bucket(p_category);
  v_limit  bigint := case v_bucket when 'zdjecia' then 15728640 else 20971520 end;
  v_ok_mime boolean := case v_bucket
    when 'faktury' then p_mime = 'application/pdf'
    when 'zdjecia' then p_mime in ('image/jpeg','image/png','image/webp','image/heic','image/heif')
    else p_mime in ('application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif') end;
  v_project uuid := p_project_id;
  v_id uuid; v_path text;
begin
  if not coalesce(v_ok_mime, false) then
    raise exception 'Nieobsługiwany typ pliku: %', coalesce(p_mime, '—') using errcode = '22023';
  end if;
  if p_size is null or p_size <= 0 or p_size > v_limit then
    raise exception 'Plik za duży albo pusty (limit % MB)', v_limit / 1048576 using errcode = '22023';
  end if;
  if p_load_id is not null then
    select l.project_id into v_project from loads l where l.id = p_load_id;   -- RLS: tylko widoczne
    if v_project is null then
      raise exception 'Transport niewidoczny dla konta' using errcode = '42501';
    end if;
  end if;
  if v_project is null then raise exception 'Brak projektu dokumentu' using errcode = '22023'; end if;

  insert into documents (project_id, load_id, category, storage_path, file_name, mime_type, size_bytes)
  values (v_project, p_load_id, p_category, '-', p_file_name, p_mime, p_size)
  returning documents.id, documents.storage_path into v_id, v_path;

  return query select v_id, v_bucket, substr(v_path, length(v_bucket) + 2), v_path;
end $$;
revoke execute on function create_document(uuid, doc_category, text, text, bigint, uuid) from public, anon;
grant  execute on function create_document(uuid, doc_category, text, text, bigint, uuid) to authenticated;

-- Wycofanie rejestracji, gdy wgranie pliku się nie powiodło: tylko autor,
-- tylko w ciągu godziny, tylko gdy obiekt nie istnieje.
create or replace function discard_document(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_path text; v_has_obj boolean := false;
begin
  select d.storage_path into v_path from documents d
   where d.id = p_id and d.uploaded_by = current_app_user_id()
     and d.uploaded_at > now() - interval '1 hour';
  if v_path is null then return false; end if;
  if to_regclass('storage.objects') is not null then
    execute 'select exists (select 1 from storage.objects o where o.bucket_id || ''/'' || o.name = $1)'
      into v_has_obj using v_path;
  end if;
  if v_has_obj then return false; end if;
  delete from documents where id = p_id;
  return true;
end $$;
revoke execute on function discard_document(uuid) from public, anon;
grant  execute on function discard_document(uuid) to authenticated;

-- Czy bieżący użytkownik może wgrać obiekt pod tę ścieżkę (Storage INSERT).
create or replace function storage_upload_allowed(p_bucket text, p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from documents d
     where d.storage_path = p_bucket || '/' || p_name
       and doc_bucket(d.category) = p_bucket
       and d.uploaded_by = current_app_user_id()
       and d.uploaded_at > now() - interval '1 hour')
$$;
revoke execute on function storage_upload_allowed(text, text) from public, anon;
grant  execute on function storage_upload_allowed(text, text) to authenticated;

-- 5. Storage: koszyki i polityki (tylko gdy schemat istnieje) ---------------
do $st$
begin
  if to_regclass('storage.objects') is null or to_regclass('storage.buckets') is null then
    raise notice 'storage brak (środowisko testowe) — koszyki i polityki pominięte';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
    ('dokumenty', 'dokumenty', false, 20971520,
      array['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif']),
    ('zdjecia',   'zdjecia',   false, 15728640,
      array['image/jpeg','image/png','image/webp','image/heic','image/heif']),
    ('faktury',   'faktury',   false, 20971520, array['application/pdf'])
  on conflict (id) do update set public = false,
    file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

  execute 'drop policy if exists tower_files_read on storage.objects';
  execute $p$create policy tower_files_read on storage.objects for select to authenticated using (
    bucket_id in ('dokumenty','zdjecia','faktury')
    and exists (select 1 from public.documents d where d.storage_path = objects.bucket_id || '/' || objects.name)
  )$p$;
  execute 'drop policy if exists tower_files_insert on storage.objects';
  execute $p$create policy tower_files_insert on storage.objects for insert to authenticated with check (
    bucket_id in ('dokumenty','zdjecia','faktury')
    and public.storage_upload_allowed(bucket_id, name)
  )$p$;
end $st$;
