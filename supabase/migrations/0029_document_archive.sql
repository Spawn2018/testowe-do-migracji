-- 0029 — ANEKS 4 PR7: pliki — PDF ≤ 10 MB, archiwizacja starych dokumentów od 70% miejsca.
-- Idempotentne i niedestrukcyjne: kolumny `if not exists`, funkcje `create or replace`; danych nie zmienia.

-- 1. create_document: PDF najwyżej 10 MB (komunikat „Plik za duży…” bez zmian). Zdjęcia kompresuje przeglądarka (1600 px, JPEG 0,75).
create or replace function public.create_document(p_load_id uuid, p_category doc_category, p_file_name text, p_mime text, p_size bigint, p_project_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, bucket text, object_path text, storage_path text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  v_bucket text := doc_bucket(p_category);
  v_limit  bigint := case when p_mime = 'application/pdf' then 10485760
                          when v_bucket = 'zdjecia' then 15728640 else 20971520 end;  -- PR7: PDF ≤ 10 MB
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
end $function$;

-- 2. Dokument zarchiwizowany = plik przeniesiony do R2 (kubełek archiwum), wiersz zostaje.
alter table documents add column if not exists archived_at timestamptz;
alter table documents add column if not exists archive_path text;

-- 3. Kandydaci do archiwizacji (wywołuje funkcja Edge document-archive kluczem service_role).
--    Start dopiero, gdy pliki zajmują ≥ 70% limitu (domyślnie 1 GB — Supabase Free).
--    Kandydat: transport rozładowany > 90 dni temu, każda powiązana faktura OPLACONA;
--    faktura PDF (INVOICE) tylko, gdy ma powiązaną fakturę OPLACONA. Najstarsze pierwsze.
create or replace function public.document_archive_candidates(
  p_limit_bytes bigint default 1073741824, p_max int default 200, p_today date default current_date
) returns table (id uuid, storage_path text, size_bytes bigint, uploaded_at timestamptz)
language sql stable security definer set search_path = public as $$
  with used as (
    select coalesce(sum(d.size_bytes), 0) as b from documents d
     where d.archived_at is null and d.storage_path not in ('', '-')
  )
  select d.id, d.storage_path, d.size_bytes, d.uploaded_at
    from documents d
    join loads l on l.id = d.load_id
   where (select b from used) >= 0.7 * p_limit_bytes
     and d.archived_at is null and d.storage_path not in ('', '-')
     and l.actual_delivery_at < p_today - 90
     and not exists (select 1 from invoice_documents x join invoices i on i.id = x.invoice_id
                      where x.document_id = d.id and i.payment_status is distinct from 'OPLACONA')
     and (d.category <> 'INVOICE'
          or exists (select 1 from invoice_documents x join invoices i on i.id = x.invoice_id
                      where x.document_id = d.id and i.payment_status = 'OPLACONA'))
   order by d.uploaded_at
   limit greatest(p_max, 0)
$$;

-- 4. Oznaczenie po skopiowaniu do R2 (plik w Storage usuwa funkcja Edge dopiero po tym wpisie).
create or replace function public.mark_document_archived(p_id uuid, p_archive_path text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(p_archive_path, '') = '' then raise exception 'Brak ścieżki archiwum' using errcode = '22023'; end if;
  update documents set archived_at = now(), archive_path = p_archive_path where id = p_id and archived_at is null;
  if not found then raise exception 'Dokument nie istnieje albo już zarchiwizowany' using errcode = '22023'; end if;
end $$;

revoke all on function public.document_archive_candidates(bigint, int, date) from public, anon, authenticated;
revoke all on function public.mark_document_archived(uuid, text) from public, anon, authenticated;
grant execute on function public.document_archive_candidates(bigint, int, date) to service_role;
grant execute on function public.mark_document_archived(uuid, text) to service_role;
