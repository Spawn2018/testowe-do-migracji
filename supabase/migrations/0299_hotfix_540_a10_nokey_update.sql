-- #540 / D-20261025-0207-01: a10_try_prep_status FOR NO KEY UPDATE
-- FOR UPDATE na loads z wyzwalacza a9 koliduje z KEY SHARE przy INSERT
-- load_events / positions → deadlock lub czekanie. FOR NO KEY UPDATE pozwala KEY SHARE.
-- To samo w c17_* wołanych z a10_trg_loads_billing (AFTER UPDATE status na loads).

create or replace function public.a10_try_prep_status(p_load uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.load_status;
  v_target public.load_status;
  v_gaps jsonb;
  v_src text;
  v_last_auto boolean;
  v_last_manual boolean;
  v_from_trg boolean := (current_setting('tower.a10_trg', true) = 'on');
begin
  if current_setting('tower.dates_ctx', true) = 'on' then
    return false;
  end if;
  if current_setting('tower.bulk_quiet', true) = 'on' then
    return false;
  end if;
  if current_setting('tower.import_ctx', true) = 'on' then
    return false;
  end if;
  select status into v_status from public.loads where id = p_load for no key update;
  if not found then
    return false;
  end if;
  /* Tylko wewnątrz Przygotowania — poza nim nie cofamy. */
  if v_status::text not in ('PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING', 'READY') then
    return false;
  end if;
  /*
    Zaplanowany: bez awizacji zostaje (import / nowy transport).
    Wyjście z PLANNED:
      — skan 48 h (a10_scan_prep), albo
      — sesja użytkownika (SCX/HHL) na wyzwalaczu (tower.a10_trg), albo
      — bezpośrednie a9_try_ready / a10_try_prep_status (bez a10_trg).
    Samo sys/migracja na wyzwalaczu nie rusza PLANNED (aud03 F7).
  */
  if v_status = 'PLANNED'::public.load_status then
    if public.a10_prep_awiz_started(p_load) is not true
       and current_setting('tower.a10_prep_scan', true) is distinct from 'on' then
      return false;
    end if;
    if public.a10_prep_awiz_started(p_load) is true
       and current_setting('tower.a10_prep_scan', true) is distinct from 'on'
       and v_from_trg is true
       and auth.uid() is null then
      return false;
    end if;
  end if;
  v_target := public.a10_prep_target_status(p_load);
  if v_target is null or v_target = v_status then
    return false;
  end if;
  /*
    Cofnięcie w Przygotowaniu tylko gdy ostatni status ustawił automat (STATUS_AUTO).
    Ręczny / INSERT / sys — bez cofnięcia (luki tylko w load_ready_gaps).
  */
  if public.load_status_rank(v_target) < public.load_status_rank(v_status) then
    select
      (e.event_type = 'STATUS_AUTO'),
      coalesce((e.payload->>'manual')::boolean, false)
      into v_last_auto, v_last_manual
      from public.load_events e
     where e.load_id = p_load
       and (
         e.event_type = 'STATUS_AUTO'
         or e.event_type like 'STATUS_%'
       )
       and not exists (
         select 1 from public.load_events z
          where z.load_id = e.load_id
            and z.payload->>'zastepuje' = e.id::text
       )
     order by e.occurred_at desc, e.id desc
     limit 1;
    if v_last_auto is not true or v_last_manual is true then
      return false;
    end if;
  end if;
  v_gaps := public.awiz_missing(p_load);
  v_src := case
    when v_target in ('DOCS_PENDING'::public.load_status, 'READY'::public.load_status)
         and v_status in ('DOCS_PENDING'::public.load_status, 'READY'::public.load_status)
      then 'DOC'
    else 'DATA'
  end;
  return public.auto_set_status(
    p_load,
    v_status,
    v_target,
    case v_target
      when 'PLANNED' then 'Przygotowanie: bez awizacji, do załadunku > 48 h'
      when 'RESOURCES_PENDING' then 'Przygotowanie: brak zasobów'
      when 'DOCS_PENDING' then 'Przygotowanie: brak dokumentów'
      when 'READY' then 'Awizacja kompletna'
      else 'Przygotowanie'
    end,
    now(),
    jsonb_build_object('actor', 'system', 'source', v_src, 'gaps', v_gaps)
  );
end $$;

revoke all on function public.a10_try_prep_status(uuid) from public, anon, authenticated;
comment on function public.a10_try_prep_status(uuid) is
  'A10: synchronizacja statusu Przygotowania w obie strony (#540: FOR NO KEY UPDATE).';

create or replace function public.c17_try_ready_to_invoice(p_load uuid, p_extra jsonb default '{}'::jsonb)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_status load_status;
  v_doc uuid;
  v_ts timestamptz;
  v_ok boolean;
begin
  select status into v_status from loads where id = p_load for no key update;
  if v_status is distinct from 'DELIVERED' then
    return false;
  end if;
  v_doc := public.c17_cmr_after_delivery(p_load);
  if v_doc is null then
    return false;
  end if;
  select d.uploaded_at into v_ts from documents d where d.id = v_doc;
  v_ok := public.auto_set_status(
    p_load,
    'DELIVERED'::load_status,
    'READY_TO_INVOICE'::load_status,
    'CMR z podpisem odbiorcy wgrany',
    coalesce(v_ts, now()),
    coalesce(p_extra, '{}'::jsonb) || jsonb_build_object(
      'actor', 'system',
      'source', 'DOC',
      'document_id', v_doc
    )
  );
  if v_ok is true then
    perform public.a3_resolve_cmr_upload(p_load, 'C17');
  end if;
  return v_ok;
end $$;

revoke all on function public.c17_try_ready_to_invoice(uuid, jsonb) from public, anon, authenticated;

create or replace function public.c17_try_invoiced(p_load uuid, p_extra jsonb default '{}'::jsonb)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_status load_status;
  v_pair jsonb;
begin
  select status into v_status from loads where id = p_load for no key update;
  if v_status is distinct from 'READY_TO_INVOICE' then
    return false;
  end if;
  v_pair := public.c17_invoice_pair_ok(p_load);
  if v_pair is null then
    return false;
  end if;
  return public.auto_set_status(
    p_load,
    'READY_TO_INVOICE'::load_status,
    'INVOICED'::load_status,
    'transport na obu fakturach',
    now(),
    coalesce(p_extra, '{}'::jsonb) || jsonb_build_object(
      'actor', 'system',
      'source', 'INVOICE',
      'invoice_ids', jsonb_build_array(v_pair->>'koszt', v_pair->>'przychod')
    )
  );
end;
$$;

revoke all on function public.c17_try_invoiced(uuid, jsonb) from public, anon, authenticated;
