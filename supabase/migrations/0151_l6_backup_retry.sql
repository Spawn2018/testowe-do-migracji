-- =====================================================================
-- TOWER — Migracja 0151: L-6 — „Ponów kopię" uruchamia istniejącą kopię
--
-- Ten sam adres co cron (backup-export, Vault project_url i service_role_key).
-- Nie zmienia harmonogramu, retencji ani szyfrowania.
-- Brak pg_net albo Vault → wiersz ERROR w backup_runs (widać w Stanie systemu).
-- Udany start → przebieg zapisuje sama funkcja backup-export.
-- =====================================================================

create or replace function public.request_backup_export()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_key text;
  v_id bigint;
begin
  if current_app_role() is distinct from 'HHL_ADMIN' then
    return jsonb_build_object('launched', false, 'error', 'not_admin');
  end if;
  if to_regnamespace('net') is null or to_regnamespace('vault') is null then
    insert into backup_runs (status, finished_at, error)
    values ('ERROR', now(), 'Kopia nie wystartowała: brak pg_net albo Vault na tej bazie.');
    return jsonb_build_object('launched', false, 'error', 'missing_net');
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_url is null or v_key is null or length(v_url) = 0 or length(v_key) = 0 then
    insert into backup_runs (status, finished_at, error)
    values ('ERROR', now(), 'Kopia nie wystartowała: brak project_url albo service_role_key w Vault.');
    return jsonb_build_object('launched', false, 'error', 'missing_vault');
  end if;
  select net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/backup-export',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    timeout_milliseconds := 300000
  ) into v_id;
  return jsonb_build_object('launched', true, 'request_id', v_id);
exception when others then
  insert into backup_runs (status, finished_at, error)
  values ('ERROR', now(), 'Kopia nie wystartowała: wywołanie backup-export nie doszło.');
  return jsonb_build_object('launched', false, 'error', 'http_post_failed');
end $$;
comment on function public.request_backup_export() is
  'L-6: ten sam start kopii co cron. Nie wypisuje sekretów. Wynik ląduje w backup_runs.';
revoke all on function public.request_backup_export() from public, anon, authenticated;

create or replace function public.decision_apply_effect(
  p_decision uuid, p_effect text, p_option text, p_note text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  d decisions%rowtype;
  v_result jsonb := jsonb_build_object('effect', p_effect, 'option', p_option, 'applied', true);
  v_ui text := null;
  v_sid uuid;
  v_field text;
  v_val text;
  v_reason text;
begin
  select * into d from decisions where id = p_decision;
  if not found then
    return jsonb_build_object('effect', p_effect, 'applied', false, 'error', 'missing');
  end if;

  -- zamknij powiązane ryzyko (każda rozstrzygnięta decyzja)
  if d.risk_id is not null then
    update risk_signals
       set resolved_at = coalesce(resolved_at, now())
     where id = d.risk_id and resolved_at is null;
  end if;

  case
    when p_effect in (
      'ACCEPT','SKIP','PROPOSE','DETOUR','MANUAL_STATUS','SEFS_EXTEND','SEFS_LAST',
      'PRICE_CAP3','MANUAL_PRICE','DISPUTE'
    ) then
      if d.load_id is not null then
        insert into load_events (load_id, event_type, occurred_at, actor_id, payload, dedup_key)
        values (
          d.load_id, 'DECISION_EFFECT', now(), current_app_user_id(),
          jsonb_build_object(
            'decision_id', d.id, 'effect', p_effect, 'option', p_option,
            'note', nullif(trim(coalesce(p_note, '')), ''), 'type', d.type_code
          ),
          'dec-fx:' || d.id::text || ':' || p_option
        )
        on conflict (dedup_key) where dedup_key is not null do nothing;
      end if;

    when p_effect = 'NOTIFY' then
      perform public.matrix_notify(
        'LOAD_STATUS', 'ETA_NOTIFY_KSH', d.load_id, d.project_id,
        jsonb_build_object(
          'decision_id', d.id, 'title', d.title, 'note', p_note,
          'eta', d.detail->'eta', 'type', d.type_code
        ),
        'dec-notify:' || d.id::text, 'CLIENT'
      );

    when p_effect = 'EMAIL_KSH' then
      perform public.matrix_notify(
        'LOAD_STATUS', 'DECISION_EMAIL_KSH', d.load_id, d.project_id,
        jsonb_build_object('decision_id', d.id, 'title', d.title, 'note', p_note, 'type', d.type_code),
        'dec-email-ksh:' || d.id::text, 'CLIENT'
      );

    when p_effect = 'ESCALATE' then
      perform public.matrix_notify(
        'DECISION', 'DECISION_ESCALATED', d.load_id, d.project_id,
        jsonb_build_object('decision_id', d.id, 'title', d.title, 'from_option', p_option, 'note', p_note),
        'dec-esc-opt:' || d.id::text, 'FORWARDER'
      );

    when p_effect = 'HOLD' then
      if d.load_id is not null then
        insert into load_events (load_id, event_type, occurred_at, actor_id, payload, dedup_key)
        values (
          d.load_id, 'DECISION_HOLD', now(), current_app_user_id(),
          jsonb_build_object('decision_id', d.id, 'note', p_note, 'option', p_option),
          'dec-hold:' || d.id::text
        )
        on conflict (dedup_key) where dedup_key is not null do nothing;
      end if;
      v_ui := 'HOLD';

    when p_effect = 'CANCEL' then
      if d.load_id is null then
        v_result := v_result || jsonb_build_object('applied', false, 'error', 'no_load');
      elsif (is_hhl()) is not true then
        raise exception 'Anulowanie z decyzji — wyłącznie HHL' using errcode = '42501';
      else
        v_reason := coalesce(nullif(trim(p_note), ''), 'Decyzja: ' || p_option);
        perform cancel_load(d.load_id, v_reason);
      end if;

    when p_effect = 'CHANGE_SAILING' then
      v_sid := nullif(d.detail->>'sailing_id', '')::uuid;
      if d.load_id is null then
        v_result := v_result || jsonb_build_object('applied', false, 'error', 'no_load');
      elsif v_sid is null then
        v_ui := 'PICK_SAILING';
        v_result := v_result || jsonb_build_object('pending', 'sailing_id');
      else
        update loads set sailing_id = v_sid, updated_at = now() where id = d.load_id;
        insert into load_events (load_id, event_type, occurred_at, actor_id, payload, dedup_key)
        values (
          d.load_id, 'DECISION_SAILING', now(), current_app_user_id(),
          jsonb_build_object('decision_id', d.id, 'sailing_id', v_sid, 'option', p_option),
          'dec-sail:' || d.id::text
        )
        on conflict (dedup_key) where dedup_key is not null do nothing;
      end if;

    when p_effect = 'KEEP_TOWER' then
      if d.load_id is not null then
        insert into load_events (load_id, event_type, occurred_at, actor_id, payload, dedup_key)
        values (
          d.load_id, 'DECISION_KEEP_TOWER', now(), current_app_user_id(),
          jsonb_build_object('decision_id', d.id, 'detail', d.detail),
          'dec-keep:' || d.id::text
        )
        on conflict (dedup_key) where dedup_key is not null do nothing;
      end if;

    when p_effect = 'TAKE_FILE' then
      v_field := d.detail->>'field';
      v_val := d.detail->>'file_value';
      if d.load_id is null or (v_field is not null and v_val is not null) is not true then
        v_ui := 'RESOLVE_CONFLICT';
        v_result := v_result || jsonb_build_object('pending', 'file_value');
      elsif v_field = 'hhl_order_no' then
        update loads set hhl_order_no = v_val, updated_at = now() where id = d.load_id;
      elsif v_field = 'order_no' then
        update loads set order_no = v_val, updated_at = now() where id = d.load_id;
      elsif v_field = 'carrier_order_no' then
        update loads set carrier_order_no = v_val, updated_at = now() where id = d.load_id;
      else
        v_result := v_result || jsonb_build_object('applied', false, 'error', 'unknown_field');
      end if;

    when p_effect = 'OPEN_AWIZACJA' then
      v_ui := 'OPEN_AWIZACJA';
    when p_effect = 'OPEN_DOC' then
      v_ui := 'OPEN_DOC';
    when p_effect = 'ADD_FEE' then
      v_ui := 'ADD_FEE';

    when p_effect = 'BACKUP_RETRY' then
      insert into audit_log (user_id, action, entity, entity_id, new_value)
      values (
        current_app_user_id(), 'BACKUP_RETRY_REQUESTED', 'decisions', p_decision::text,
        jsonb_build_object('option', p_option, 'note', p_note)
      );
      v_ui := 'BACKUP_RETRY';
      v_result := v_result || public.request_backup_export();

    else
      v_result := v_result || jsonb_build_object('applied', false, 'error', 'unknown_effect');
  end case;

  if v_ui is not null then
    v_result := v_result || jsonb_build_object('ui_hint', v_ui);
  end if;
  return v_result;
end $$;
revoke all on function public.decision_apply_effect(uuid, text, text, text)
  from public, anon, authenticated;
