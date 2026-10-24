-- #412 / D-20261021-2040-01 pkt 5 — E43: treści wiadomości (zapis SMS/e-mail/logowanie + historia).
-- Odczyt: HHL. Zapis / przywrócenie: tylko Administrator HHL + audit.
-- Domyślne treści zostają w kodzie (p8Texts / notifyTemplates); tu tylko nadpisania.
-- Front (p8Source) — koordynator. Odczyt przy wysyłce (sms_render / notify) — P8.
-- P8: przy wysyłce treść z nadpisań zawsze escapować po podstawieniu (jak notifyTemplates.esc /
-- textContent w edytorze) — nigdy surowy HTML z body/subject.

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

-- Meta rodzaju = p8Texts.MESSAGES (kanał, needs_button, dozwolone klocki).
drop function if exists public.message_text_kind_meta(text);
create or replace function public.message_text_kind_meta(p_kind text)
returns table (channel text, needs_button boolean, tokens text[])
language sql
immutable
set search_path = public
as $$
  select t.channel, t.needs_button, t.tokens
  from (values
    ('SMS_A', 'SMS', false, array['code','trailer','tractor','place','placeTo','dwell','arrival','planDate','link']::text[]),
    ('SMS_B', 'SMS', false, array['code','trailer','tractor','place','placeTo','dwell','arrival','planDate','link']::text[]),
    ('SMS_C', 'SMS', false, array['code','trailer','tractor','place','placeTo','dwell','arrival','planDate','link']::text[]),
    ('SMS_D', 'SMS', false, array['code','trailer','tractor','place','placeTo','dwell','arrival','planDate','link']::text[]),
    ('RISK_OPEN', 'EMAIL', false, array['code','order','riskName','severity','loadDate','planDate','link']::text[]),
    ('RISK_SEVERITY', 'EMAIL', false, array['code','order','riskName','severity','loadDate','planDate','link']::text[]),
    ('RISK_RESOLVED', 'EMAIL', false, array['code','order','riskName','severity','loadDate','planDate','link']::text[]),
    ('ROAD_RISK', 'EMAIL', false, array['road','riskName','link']::text[]),
    ('DECISION_OPEN', 'EMAIL', false, array['decision','due','transports','outcome','author','link']::text[]),
    ('DECISION_ESCALATED', 'EMAIL', false, array['decision','due','transports','outcome','author','link']::text[]),
    ('DECISION_RESOLVED', 'EMAIL', false, array['decision','due','transports','outcome','author','link']::text[]),
    ('WORKFLOW_ALERT', 'EMAIL', false, array['code','order','ruleName','detail','link']::text[]),
    ('SCX_DETOUR_CHOICE', 'EMAIL', false, array['code','order','closure','choice','author','link']::text[]),
    ('LOAD_STATUS_CHANGED', 'EMAIL', false, array['code','order','statusFrom','statusTo','time','link']::text[]),
    ('LOAD_CHAT_MESSAGE', 'EMAIL', false, array['code','order','author','message','link']::text[]),
    ('PLAN_DATES_CHANGED', 'EMAIL', false, array['code','order','loadDate','planDate','author','link','loadDateBefore','planDateBefore']::text[]),
    ('SCHEDULE_DATE_CRITICAL', 'EMAIL', false, array['code','order','loadDate','planDate','author','link']::text[]),
    ('ORDER_NO_MISSING', 'EMAIL', false, array['code','side','due','link']::text[]),
    ('RESOURCE_DEADLINE', 'EMAIL', false, array['code','order','missing','due','link']::text[]),
    ('ZONE_ENTER', 'EMAIL', false, array['code','order','place','time','link']::text[]),
    ('ZONE_EXIT', 'EMAIL', false, array['code','order','place','time','link']::text[]),
    ('PRE_ARRIVAL', 'EMAIL', false, array['code','order','trailer','site','time','arrival','link']::text[]),
    ('PRE_PORT', 'EMAIL', false, array['code','order','trailer','port','time','link']::text[]),
    ('INVOICE_NEW', 'EMAIL', false, array['invoiceNo','week','amount','due','link']::text[]),
    ('PAYMENT_REMINDER', 'EMAIL', false, array['invoiceNo','week','amount','due','link','reminder']::text[]),
    ('INVOICE_DISPUTED', 'EMAIL', false, array['invoiceNo','week','amount','due','link','reason']::text[]),
    ('INVOICE_DISPUTE_REPLY', 'EMAIL', false, array['invoiceNo','week','amount','due','link','message']::text[]),
    ('INVOICE_DISPUTE_RESOLVED', 'EMAIL', false, array['invoiceNo','week','amount','due','link','outcome']::text[]),
    ('INVOICE_OVERDUE', 'EMAIL', false, array['invoiceNo','week','amount','due','link']::text[]),
    ('INVOICE_UPDATED', 'EMAIL', false, array['invoiceNo','week','amount','due','link','firm']::text[]),
    ('INVOICE_CORRECTED', 'EMAIL', false, array['invoiceNo','week','amount','due','link','firm']::text[]),
    ('INSURANCE_EXPIRY', 'EMAIL', false, array['policyNo','carrier','due','link']::text[]),
    ('ACCOUNTING_KSH', 'EMAIL', false, array['week','invoiceNo','amount','count','codes']::text[]),
    ('ACCOUNTING_HHL', 'EMAIL', false, array['week','invoiceNo','amount','count','codes']::text[]),
    ('SMS_UNDELIVERED', 'EMAIL', false, array['code','site','recipients','message','link']::text[]),
    ('SMS_FALLBACK', 'EMAIL', false, array['code','site','recipients','message','link']::text[]),
    ('SMS_GATEWAY_SILENT', 'EMAIL', false, array['time','queued','link']::text[]),
    ('ZONE_LIMIT', 'EMAIL', false, array['limit','link']::text[]),
    ('FUEL_READING_MISSING', 'EMAIL', false, array['source','date','week','loadWeek','count','link']::text[]),
    ('CLIENT', 'EMAIL', false, array['firm','link']::text[]),
    ('SOURCE_DOWN', 'EMAIL', false, array['feed','since','effect','link']::text[]),
    ('SOURCE_BACK', 'EMAIL', false, array['feed','since','time','link']::text[]),
    ('APP_ERROR', 'EMAIL', false, array['error','times','people','page','time','link']::text[]),
    ('INVITE', 'LOGIN', true, array['name','firm','account','inviter','validity','button']::text[]),
    ('RECOVERY', 'LOGIN', true, array['name','firm','account','inviter','validity','button']::text[]),
    ('MAGIC', 'LOGIN', true, array['name','firm','account','inviter','validity','button']::text[]),
    ('CONFIRM', 'LOGIN', true, array['name','firm','account','inviter','validity','button']::text[]),
    ('EMAIL_CHANGE', 'LOGIN', true, array['name','firm','account','inviter','validity','button']::text[])
  ) as t(kind, channel, needs_button, tokens)
  where t.kind = p_kind;
$$;

revoke all on function public.message_text_kind_meta(text) from public, anon, authenticated;
comment on function public.message_text_kind_meta(text) is
  '#412 E43: kanał, needs_button i dozwolone znaczniki (p8Texts.MESSAGES); pusty wynik = nieznany kind.';

-- Najgorsze długości klocków SMS = SMS_WORST w p8Texts.ts.
create or replace function public.message_text_sms_worst(p_tok text)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_tok
    when 'code' then repeat('X', 8)
    when 'trailer' then repeat('X', 10)
    when 'tractor' then repeat('X', 10)
    when 'place' then repeat('X', 28)
    when 'placeTo' then repeat('X', 28)
    when 'dwell' then '00:00'
    when 'arrival' then '00:00'
    when 'planDate' then '00.00.0000'
    when 'link' then 'tower.log-mar.pl/#/transport/' || repeat('X', 8)
    else repeat('X', 8)
  end;
$$;

revoke all on function public.message_text_sms_worst(text) from public, anon, authenticated;
comment on function public.message_text_sms_worst(text) is
  '#412 E43: najgorsza wartość klocka SMS (jak SMS_WORST w p8Texts.ts).';

-- Normalizacja jak smsText() w p8Texts.ts (PL → ASCII + znaki typograficzne → GSM).
create or replace function public.message_text_sms_norm(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
    replace(replace(replace(
      public.sms_strip_pl(coalesce(p, '')),
      '—', '-'), '–', '-'), '→', '->'),
    '„', '"'), '“', '"'), '”', '"'), '«', '"'), '»', '"'),
    '’', ''''), '‘', ''''), '‚', ''''),
    '…', '...'), chr(160), ' ');
$$;

revoke all on function public.message_text_sms_norm(text) from public, anon, authenticated;

-- Długość GSM 03.38 (rozszerzone ×2); znaki spoza alfabetu → wyjątek (jak gsmBad / gsmLength).
create or replace function public.message_text_gsm_len(p text)
returns integer
language plpgsql
immutable
set search_path = public
as $$
declare
  v_basic text := E'@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&''()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
  v_ext   text := E'^{}\\[~]|€';
  v_ch    text;
  v_n     integer := 0;
  v_i     integer;
begin
  for v_i in 1 .. char_length(coalesce(p, '')) loop
    v_ch := substr(p, v_i, 1);
    if position(v_ch in v_ext) > 0 then
      v_n := v_n + 2;
    elsif position(v_ch in v_basic) > 0 then
      v_n := v_n + 1;
    else
      raise exception 'SMS: niedozwolony znak (alfabet GSM)' using errcode = '22023';
    end if;
  end loop;
  return v_n;
end $$;

revoke all on function public.message_text_gsm_len(text) from public, anon, authenticated;
comment on function public.message_text_gsm_len(text) is
  '#412 E43: długość SMS w znakach GSM (rozszerzone ×2); spoza alfabetu → 22023.';

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
  v_tokens text[];
  v_body text;
  v_subj text;
  v_est text;
  v_tok text;
  v_m text[];
  v_old_subj text;
  v_old_body text;
  v_had boolean := false;
  v_gsm integer;
begin
  if (public.is_hhl_admin()) is not true then
    raise exception 'Treści wiadomości — wyłącznie Administrator HHL' using errcode = '42501';
  end if;

  select id into v_me from public.app_users where auth_id = auth.uid() and active;
  if (v_me is not null) is not true then
    raise exception 'Brak konta' using errcode = 'P0002';
  end if;

  select m.channel, m.needs_button, m.tokens into v_ch, v_need_btn, v_tokens
    from public.message_text_kind_meta(p_kind) m;
  if (v_ch is not null) is not true then
    raise exception 'Nieznany rodzaj wiadomości' using errcode = '22023';
  end if;

  v_body := coalesce(p_body, '');
  if length(btrim(v_body)) = 0 then
    raise exception 'Treść nie może być pusta' using errcode = '22023';
  end if;
  if char_length(v_body) > 5000 then
    raise exception 'Treść: najwyżej 5000 znaków' using errcode = '22023';
  end if;

  -- Dozwolone znaczniki tylko z listy rodzaju ({{button}} wyłącznie LOGIN).
  for v_m in
    select regexp_matches(v_body, '\{\{([a-zA-Z]+)\}\}', 'g')
  loop
    v_tok := v_m[1];
    if not (v_tok = any (v_tokens)) then
      raise exception 'Niedozwolony znacznik {{%}}', v_tok using errcode = '22023';
    end if;
  end loop;

  if v_ch = 'SMS' then
    v_subj := null;
    v_est := v_body;
    for v_m in
      select regexp_matches(v_body, '\{\{([a-zA-Z]+)\}\}', 'g')
    loop
      v_tok := v_m[1];
      v_est := replace(v_est, '{{' || v_tok || '}}', public.message_text_sms_worst(v_tok));
    end loop;
    v_est := public.message_text_sms_norm(v_est);
    v_gsm := public.message_text_gsm_len(v_est);
    if v_gsm > 160 then
      raise exception 'SMS: najwyżej 160 znaków' using errcode = '22023';
    end if;
  else
    v_subj := nullif(btrim(coalesce(p_subject, '')), '');
    if (v_subj is not null) is not true then
      raise exception 'Temat nie może być pusty' using errcode = '22023';
    end if;
    if char_length(v_subj) > 200 then
      raise exception 'Temat: najwyżej 200 znaków' using errcode = '22023';
    end if;
    if v_subj ~ E'[\\x00-\\x1F]' then
      raise exception 'Temat: niedozwolone znaki sterujące' using errcode = '22023';
    end if;
    for v_m in
      select regexp_matches(v_subj, '\{\{([a-zA-Z]+)\}\}', 'g')
    loop
      v_tok := v_m[1];
      if not (v_tok = any (v_tokens)) then
        raise exception 'Niedozwolony znacznik {{%}}', v_tok using errcode = '22023';
      end if;
    end loop;
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
  '#412 E43: zapis nadpisania; HHL_ADMIN; SMS ≤160 (SMS_WORST+GSM), dozwolone znaczniki, LOGIN z {{button}}.';

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
