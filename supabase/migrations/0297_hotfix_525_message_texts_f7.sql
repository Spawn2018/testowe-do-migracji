-- #525 / D-20261024-1055-01 — treści wiadomości drobne F7 r2 po #522 / 0289.
-- 1) Temat: regex sterujących + DEL (0x7F) + U+2028/U+2029.
-- 2) {{button}} tylko w treści LOGIN — nie w temacie.
-- Numer 0297: 0292–0296 zarezerwowane (#528/#530/B5/#516/#519 równolegle).

select set_config('tower.audit_source', 'migracja 0297 (#525 message_texts F7)', true);

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
    if (v_tok = any (v_tokens)) is not true then
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
    -- #525: C0 + DEL + separatory Unicode (U+2028/U+2029).
    if v_subj ~ E'[\\x00-\\x1F\\x7F]'
       or position(U&'\2028' in v_subj) > 0
       or position(U&'\2029' in v_subj) > 0
    then
      raise exception 'Temat: niedozwolone znaki sterujące' using errcode = '22023';
    end if;
    -- #525: {{button}} tylko w treści, nigdy w temacie.
    if position('{{button}}' in v_subj) > 0 then
      raise exception 'Przycisk z linkiem tylko w treści, nie w temacie' using errcode = '22023';
    end if;
    for v_m in
      select regexp_matches(v_subj, '\{\{([a-zA-Z]+)\}\}', 'g')
    loop
      v_tok := v_m[1];
      if v_tok = 'button' or (v_tok = any (v_tokens)) is not true then
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
  '#412+#525 E43: zapis; HHL_ADMIN; SMS ≤160; {{button}} tylko w treści LOGIN; temat bez C0/DEL/U+2028/9.';
