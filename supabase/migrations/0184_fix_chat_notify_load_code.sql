-- =====================================================================
-- 0184 — B-10g.3: notify_load_chat_message — loads nie ma kolumny `code`
--         (jest hhl_order_no / order_no). Wstawianie wiadomości padało
--         na „column l.code does not exist” → brak LOAD_CHAT_MESSAGE.
-- TELM / H1 / H3 / H6 / SEC-OWASP — bez zmian.
-- =====================================================================

create or replace function public.notify_load_chat_message()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_project uuid;
  v_code text;
  v_preview text;
begin
  select l.project_id,
         coalesce(nullif(trim(l.hhl_order_no), ''), nullif(trim(l.order_no), ''), left(l.id::text, 8))
    into v_project, v_code
    from loads l
   where l.id = new.load_id;
  v_preview := left(regexp_replace(coalesce(new.body, ''), '\s+', ' ', 'g'), 120);
  perform public.matrix_notify(
    'LOAD_STATUS',
    'LOAD_CHAT_MESSAGE',
    new.load_id,
    v_project,
    jsonb_build_object(
      'load_code', v_code,
      'preview', v_preview,
      'author_org', new.author_org,
      'author_display', coalesce(new.author_display, new.author_org)
    ),
    'CHAT:' || new.id::text
  );
  -- nie powiadamiaj autora
  delete from notifications
   where load_id = new.load_id
     and template = 'LOAD_CHAT_MESSAGE'
     and user_id = new.author_id
     and dedup_key like 'CHAT:' || new.id::text || ':%';
  return new;
end $$;

comment on function public.notify_load_chat_message() is
  'B-10g: IN_APP LOAD_CHAT_MESSAGE po nowej wiadomości (bez autora). Kod transportu: hhl_order_no/order_no.';

