-- #412 / D-20261021-2040-01 pkt 5 — E43: treści wiadomości (zapis SMS/e-mail/logowanie + historia).
-- Odczyt: HHL. Zapis / przywrócenie: tylko Administrator HHL + audit.
-- Domyślne treści zostają w kodzie (p8Texts / notifyTemplates); tu tylko nadpisania.
-- Front (p8Source) — koordynator. Odczyt przy wysyłce (sms_render / notify) — P8.

select set_config('tower.audit_source', 'migracja 0289 (#412 E43 treści wiadomości)', true);

-- ---------------------------------------------------------------------------
-- Tabela nadpisań (pusty stan = domyślne z kodu).
-- ---------------------------------------------------------------------------
create table if not exists public.message_texts (
  kind        text primary key,
  channel     text not null check (channel in ('SMS', 'EMAIL', 'LOGIN')),
  subject     text,
  body        text not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.app_users(id),
  constraint message_texts_sms_no_subject check (
    (channel = 'SMS' and subject is null) or channel <> 'SMS'
  ),
  constraint message_texts_email_has_subject check (
    (channel in ('EMAIL', 'LOGIN') and subject is not null and length(btrim(subject)) > 0)
    or channel = 'SMS'
  )
);

alter table public.message_texts enable row level security;

revoke all on table public.message_texts from public, anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.message_texts from authenticated;
grant select on table public.message_texts to authenticated;

drop policy if exists message_texts_read on public.message_texts;
create policy message_texts_read on public.message_texts
  for select to authenticated
  using ((public.is_hhl()) is true);

comment on table public.message_texts is
  '#412 E43: nadpisania treści SMS/e-mail/logowania (Opcje › Treści wiadomości); zapis tylko przez message_texts_set / _reset.';

-- Meta rodzaju (kanał + czy wymaga {{button}}) — lista z p8Texts.MESSAGES.
create or replace function public.message_text_kind_meta(p_kind text)
returns table (channel text, needs_button boolean)
language sql
immutable
set search_path = public
as $$
  select t.channel, t.needs_button
  from (values
    ('SMS_A', 'SMS', false),
    ('SMS_B', 'SMS', false),
    ('SMS_C', 'SMS', false),
    ('SMS_D', 'SMS', false),
    ('RISK_OPEN', 'EMAIL', false),
    ('RISK_SEVERITY', 'EMAIL', false),
    ('RISK_RESOLVED', 'EMAIL', false),
    ('ROAD_RISK', 'EMAIL', false),
    ('DECISION_OPEN', 'EMAIL', false),
    ('DECISION_ESCALATED', 'EMAIL', false),
    ('DECISION_RESOLVED', 'EMAIL', false),
    ('WORKFLOW_ALERT', 'EMAIL', false),
    ('SCX_DETOUR_CHOICE', 'EMAIL', false),
    ('LOAD_STATUS_CHANGED', 'EMAIL', false),
    ('LOAD_CHAT_MESSAGE', 'EMAIL', false),
    ('PLAN_DATES_CHANGED', 'EMAIL', false),
    ('SCHEDULE_DATE_CRITICAL', 'EMAIL', false),
    ('ORDER_NO_MISSING', 'EMAIL', false),
    ('RESOURCE_DEADLINE', 'EMAIL', false),
    ('ZONE_ENTER', 'EMAIL', false),
    ('ZONE_EXIT', 'EMAIL', false),
    ('PRE_ARRIVAL', 'EMAIL', false),
    ('PRE_PORT', 'EMAIL', false),
    ('INVOICE_NEW', 'EMAIL', false),
    ('PAYMENT_REMINDER', 'EMAIL', false),
    ('INVOICE_DISPUTED', 'EMAIL', false),
    ('INVOICE_DISPUTE_REPLY', 'EMAIL', false),
    ('INVOICE_DISPUTE_RESOLVED', 'EMAIL', false),
    ('INVOICE_OVERDUE', 'EMAIL', false),
    ('INVOICE_UPDATED', 'EMAIL', false),
    ('INVOICE_CORRECTED', 'EMAIL', false),
    ('INSURANCE_EXPIRY', 'EMAIL', false),
    ('ACCOUNTING_KSH', 'EMAIL', false),
    ('ACCOUNTING_HHL', 'EMAIL', false),
    ('SMS_UNDELIVERED', 'EMAIL', false),
    ('SMS_FALLBACK', 'EMAIL', false),
    ('SMS_GATEWAY_SILENT', 'EMAIL', false),
    ('ZONE_LIMIT', 'EMAIL', false),
    ('FUEL_READING_MISSING', 'EMAIL', false),
    ('CLIENT', 'EMAIL', false),
    ('SOURCE_DOWN', 'EMAIL', false),
    ('SOURCE_BACK', 'EMAIL', false),
    ('APP_ERROR', 'EMAIL', false),
    ('INVITE', 'LOGIN', true),
    ('RECOVERY', 'LOGIN', true),
    ('MAGIC', 'LOGIN', true),
    ('CONFIRM', 'LOGIN', true),
    ('EMAIL_CHANGE', 'LOGIN', true)
  ) as t(kind, channel, needs_button)
  where t.kind = p_kind;
$$;

revoke all on function public.message_text_kind_meta(text) from public, anon, authenticated;
comment on function public.message_text_kind_meta(text) is
  '#412 E43: kanał i needs_button dla znanego kind; pusty wynik = nieznany kind.';

-- Lista nadpisań: [{ id, subject, body, at, who }, …] — kształt SavedText (p8Source).
create or replace function public.message_texts_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_out jsonb;
begin
  if (public.is_hhl()) is not true then
    raise exception 'Treści wiadomości — tylko HHL' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', t.kind,
             'subject', to_jsonb(t.subject),
             'body', t.body,
             'at', t.updated_at,
             'who', coalesce(nullif(btrim(u.full_name), ''), split_part(u.email::text, '@', 1), '—')
           )
           order by t.kind
         ), '[]'::jsonb)
    into v_out
    from public.message_texts t
    left join public.app_users u on u.id = t.updated_by;

  return v_out;
end $$;

revoke all on function public.message_texts_list() from public, anon;
grant execute on function public.message_texts_list() to authenticated;
comment on function public.message_texts_list() is
  '#412 E43: nadpisania treści; tylko HHL; puste [] = wszystkie domyślne z kodu.';

create or replace function public.message_texts_set(
  p_kind text,
  p_subject text,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_ch text;
  v_need_btn boolean;
  v_body text;
  v_subj text;
  v_est text;
  v_old_subj text;
  v_old_body text;
  v_had boolean := false;
begin
  if (public.is_hhl_admin()) is not true then
    raise exception 'Treści wiadomości — wyłącznie Administrator HHL' using errcode = '42501';
  end if;

  select id into v_me from public.app_users where auth_id = auth.uid() and active;
  if (v_me is not null) is not true then
    raise exception 'Brak konta' using errcode = 'P0002';
  end if;

  select m.channel, m.needs_button into v_ch, v_need_btn
    from public.message_text_kind_meta(p_kind) m;
  if (v_ch is not null) is not true then
    raise exception 'Nieznany rodzaj wiadomości' using errcode = '22023';
  end if;

  v_body := coalesce(p_body, '');
  if length(btrim(v_body)) = 0 then
    raise exception 'Treść nie może być pusta' using errcode = '22023';
  end if;

  if v_ch = 'SMS' then
    v_subj := null;
    -- Szacunek długości: znaczniki → 8 znaków (jak najdłuższy typowy klocek krótkiego pola).
    v_est := public.sms_strip_pl(
      regexp_replace(
        replace(replace(replace(v_body, '—', '-'), '–', '-'), chr(160), ' '),
        '\{\{[a-zA-Z]+\}\}', 'XXXXXXXX', 'g'
      )
    );
    if char_length(v_est) > 160 then
      raise exception 'SMS: najwyżej 160 znaków' using errcode = '22023';
    end if;
  else
    v_subj := nullif(btrim(coalesce(p_subject, '')), '');
    if (v_subj is not null) is not true then
      raise exception 'Temat nie może być pusty' using errcode = '22023';
    end if;
    if v_need_btn is true and position('{{button}}' in v_body) = 0 then
      raise exception 'Przycisk z linkiem musi być w treści' using errcode = '22023';
    end if;
  end if;

  select t.subject, t.body into v_old_subj, v_old_body
    from public.message_texts t where t.kind = p_kind for update;
  v_had := found;

  if v_had and v_old_subj is not distinct from v_subj and v_old_body is not distinct from v_body then
    return (
      select jsonb_build_object(
               'id', t.kind,
               'subject', to_jsonb(t.subject),
               'body', t.body,
               'at', t.updated_at,
               'who', coalesce(nullif(btrim(u.full_name), ''), split_part(u.email::text, '@', 1), '—')
             )
        from public.message_texts t
        left join public.app_users u on u.id = t.updated_by
       where t.kind = p_kind
    );
  end if;

  insert into public.message_texts (kind, channel, subject, body, updated_at, updated_by)
  values (p_kind, v_ch, v_subj, v_body, now(), v_me)
  on conflict (kind) do update
    set channel = excluded.channel,
        subject = excluded.subject,
        body = excluded.body,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;

  insert into public.audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (
    v_me, 'MESSAGE_TEXT_SET', 'message_texts', p_kind,
    case when v_had then jsonb_build_object('subject', v_old_subj, 'body', v_old_body) else null end,
    jsonb_build_object('subject', v_subj, 'body', v_body)
  );

  return (
    select jsonb_build_object(
             'id', t.kind,
             'subject', to_jsonb(t.subject),
             'body', t.body,
             'at', t.updated_at,
             'who', coalesce(nullif(btrim(u.full_name), ''), split_part(u.email::text, '@', 1), '—')
           )
      from public.message_texts t
      left join public.app_users u on u.id = t.updated_by
     where t.kind = p_kind
  );
end $$;

revoke all on function public.message_texts_set(text, text, text) from public, anon;
grant execute on function public.message_texts_set(text, text, text) to authenticated;
comment on function public.message_texts_set(text, text, text) is
  '#412 E43: zapis nadpisania; tylko HHL_ADMIN; SMS ≤160 (szacunek), LOGIN z {{button}}.';

create or replace function public.message_texts_reset(p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_ch text;
  v_old_subj text;
  v_old_body text;
begin
  if (public.is_hhl_admin()) is not true then
    raise exception 'Treści wiadomości — wyłącznie Administrator HHL' using errcode = '42501';
  end if;

  select id into v_me from public.app_users where auth_id = auth.uid() and active;
  if (v_me is not null) is not true then
    raise exception 'Brak konta' using errcode = 'P0002';
  end if;

  select m.channel into v_ch from public.message_text_kind_meta(p_kind) m;
  if (v_ch is not null) is not true then
    raise exception 'Nieznany rodzaj wiadomości' using errcode = '22023';
  end if;

  select t.subject, t.body into v_old_subj, v_old_body
    from public.message_texts t where t.kind = p_kind for update;
  if not found then
    return jsonb_build_object('ok', true, 'id', p_kind);
  end if;

  delete from public.message_texts where kind = p_kind;

  insert into public.audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (
    v_me, 'MESSAGE_TEXT_RESET', 'message_texts', p_kind,
    jsonb_build_object('subject', v_old_subj, 'body', v_old_body),
    null
  );

  return jsonb_build_object('ok', true, 'id', p_kind);
end $$;

revoke all on function public.message_texts_reset(text) from public, anon;
grant execute on function public.message_texts_reset(text) to authenticated;
comment on function public.message_texts_reset(text) is
  '#412 E43: przywróć domyślną (usuń nadpisanie); tylko HHL_ADMIN.';
