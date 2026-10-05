-- =====================================================================
-- 0181 — B-10g: powiadomienia IN_APP o nowej wiadomości czatu;
--         lista wiadomości z autorem + odczytami; author_display.
-- TELM / H1 / H3 / H6 / pilot SMS — bez zmian.
-- =====================================================================

alter table public.load_messages
  add column if not exists author_display text;

create or replace function public.set_message_author() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_org text; v_name text;
begin
  if auth.uid() is null then return new; end if;
  select u.id, o.code, coalesce(nullif(trim(u.full_name), ''), u.email::text)
    into v_id, v_org, v_name
    from app_users u join organizations o on o.id = u.org_id
   where u.auth_id = auth.uid() and u.active;
  if v_id is null then raise exception 'Brak aktywnego konta' using errcode = '42501'; end if;
  new.author_id := v_id;
  new.author_org := v_org;
  new.author_display := v_name;
  new.created_at := now();
  return new;
end $$;

-- Uzupełnij brakujące author_display (jednorazowo)
update public.load_messages m
   set author_display = coalesce(nullif(trim(u.full_name), ''), u.email::text, m.author_org)
  from app_users u
 where u.id = m.author_id
   and (m.author_display is null or m.author_display = '');

-- Powiadomienie IN_APP (LOAD_STATUS / macierz DEC-4) — bez autora, bez e-maila
create or replace function public.notify_load_chat_message()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_project uuid;
  v_code text;
  v_preview text;
begin
  select l.project_id, l.code into v_project, v_code from loads l where l.id = new.load_id;
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

drop trigger if exists trg_load_messages_notify on public.load_messages;
create trigger trg_load_messages_notify
  after insert on public.load_messages
  for each row execute function public.notify_load_chat_message();

revoke all on function public.notify_load_chat_message() from public, anon, authenticated;

-- Lista wiadomości z autorem + odczytami (RLS jak msgs_read)
create or replace function public.list_load_messages_ui()
returns table (
  id bigint,
  load_id uuid,
  body text,
  created_at timestamptz,
  author_org text,
  author_display text,
  reads jsonb
)
language sql stable security definer set search_path = public as $$
  select m.id,
         m.load_id,
         m.body,
         m.created_at,
         m.author_org,
         coalesce(m.author_display, m.author_org, '—') as author_display,
         coalesce((
           select jsonb_agg(
                    jsonb_build_object(
                      'userId', r.user_id,
                      'name', coalesce(nullif(trim(ru.full_name), ''), ru.email::text),
                      'org', o.code,
                      'at', r.read_at
                    )
                    order by r.read_at
                  )
             from load_message_reads r
             join app_users ru on ru.id = r.user_id
             left join organizations o on o.id = ru.org_id
            where r.message_id = m.id
         ), '[]'::jsonb) as reads
    from load_messages m
   where is_hhl()
      or (current_org_kind() = any (m.visible_to)
          and exists (select 1 from loads l where l.id = m.load_id))
   order by m.created_at;
$$;
revoke all on function public.list_load_messages_ui() from public, anon;
grant execute on function public.list_load_messages_ui() to authenticated;

comment on function public.list_load_messages_ui() is
  'B-10g: czat — autor (imię) + odczyty; widoczność jak msgs_read.';
comment on function public.notify_load_chat_message() is
  'B-10g: IN_APP LOAD_CHAT_MESSAGE po nowej wiadomości (bez autora).';
