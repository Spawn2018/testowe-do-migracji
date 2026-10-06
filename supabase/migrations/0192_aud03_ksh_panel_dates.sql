-- TOWER — Migracja 0192: AUD-03 — KSH — PANEL ZLECENIA (decyzja właściciela 05.10, polecenie 06.10).
-- KSH edytuje WYŁĄCZNIE datę i godzinę załadunku oraz rozładunku (okna od–do) — przez RPC ksh_confirm_dates
-- (ponownie włączone; DATY-67 je wyłączyło). Bezpośredni UPDATE loads dla KSH nadal niemożliwy: brak polityki RLS
-- UPDATE dla CLIENT + guard_load_update („Brak uprawnień do zmiany transportu”), więc „Zmień ciągnik”, zasoby,
-- numery zleceń, statusy itd. są dla KSH zablokowane w bazie (test tests/db/security.sh [6b]).
-- Zapis: kontekst tower.dates_ctx (guard: tylko kolumny dat planu i ich status) → wyzwalacze: PLAN_DATES_CHANGED
-- w historii (autor „imię nazwisko // KSH”), ETA (trg_loads_eta), opłata paliwowa / cena (trg_loads_price, tydzień
-- załadunku), SMS (trg_loads_sms), L-3 (l3_ksh_lead). Powiadomienia wg macierzy DEC-4 (matrix_notify, LOAD_STATUS).
-- Transport awizowany (zasoby kierowca+ciągnik, rejs, numer rezerwacji albo READY) → alarm I-10
-- SCHEDULE_DATE_CRITICAL (IN_APP HHL + przewoźnik; e-mail dokłada wyzwalacz 0056). Plik SharePoint — II-10-E2.
-- Idempotentna.

create or replace function public.trg_plan_dates_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := current_app_user_id();
  v_by text;
  v_payload jsonb;
  v_client uuid;
  v_stamp text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS');
begin
  if (new.plan_load_date, new.plan_load_from, new.plan_load_to, new.plan_delivery_date, new.plan_delivery_from, new.plan_delivery_to)
     is not distinct from (old.plan_load_date, old.plan_load_from, old.plan_load_to, old.plan_delivery_date, old.plan_delivery_from, old.plan_delivery_to) then
    return null;
  end if;
  v_by := case
    when current_setting('tower.dates_ctx', true) = 'on' then 'KSH'
    when auth.uid() is null then 'SYSTEM'
    else 'HHL'
  end;
  select client_org_id into v_client from projects where id = new.project_id;
  insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
  values (new.id, 'PLAN_DATES_CHANGED', now(), v_actor, jsonb_build_object(
    'code', coalesce(new.order_no, left(new.id::text, 8)), 'by', v_by, 'status', new.plan_dates_status,
    'load_date', new.plan_load_date, 'delivery_date', new.plan_delivery_date,
    'before_load_date', old.plan_load_date, 'before_delivery_date', old.plan_delivery_date,
    'load_from', new.plan_load_from, 'load_to', new.plan_load_to,
    'delivery_from', new.plan_delivery_from, 'delivery_to', new.plan_delivery_to)
    -- AUD-03: autor edycji KSH „imię nazwisko // KSH” (load_events jest append-only — autor przed wpisem)
    || case when v_by = 'KSH' and nullif(current_setting('tower.dates_actor', true), '') is not null
            then jsonb_build_object('actor', current_setting('tower.dates_actor', true)) else '{}'::jsonb end);
  v_payload := jsonb_build_object(
    'code', coalesce(new.order_no, left(new.id::text, 8)), 'by', v_by, 'status', new.plan_dates_status,
    'load_date', new.plan_load_date, 'delivery_date', new.plan_delivery_date,
    'before_load_date', old.plan_load_date, 'before_delivery_date', old.plan_delivery_date);
  -- AUD-03: edycja KSH (tower.dates_ctx) — powiadomienia wg macierzy DEC-4 w ksh_confirm_dates (matrix_notify)
  if v_by <> 'KSH' then
    insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
    select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, new.id, 'PLAN_DATES_CHANGED',
           v_payload || jsonb_build_object('locale', u.locale),
           'PLAN_DATES:' || new.id || ':' || v_stamp || ':' || u.id
      from app_users u join organizations o on o.id = u.org_id
     where u.active and u.id is distinct from v_actor
       and (o.kind = 'FORWARDER'
            or (new.carrier_org_id is not null and u.org_id = new.carrier_org_id)
            or (v_client is not null and u.org_id = v_client))
    on conflict (dedup_key) where dedup_key is not null do nothing;
  end if;
  if (new.plan_load_date, new.plan_load_from) is distinct from (old.plan_load_date, old.plan_load_from)
     or old.plan_load_date is null then
    perform l3_ksh_lead(new, old.plan_load_date, old.plan_load_from, now());
  end if;
  return null;
end $$;

revoke all on function public.trg_plan_dates_notify() from public, anon, authenticated;

create or replace function public.ksh_confirm_dates(
  p_load uuid,
  p_load_date date default null,
  p_delivery_date date default null,
  p_load_from timestamptz default null,
  p_load_to timestamptz default null,
  p_delivery_from timestamptz default null,
  p_delivery_to timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l loads%rowtype;
  v_client uuid;
  v_ld date; v_dd date;
  v_lf timestamptz; v_lt timestamptz; v_df timestamptz; v_dt timestamptz;
  v_changed boolean;
  v_actor uuid := current_app_user_id();
  v_label text;
  v_code text;
  v_awiz boolean;
  v_stamp text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS');
  v_payload jsonb;
begin
  if (v_actor is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if (current_org_kind() = 'CLIENT') is not true then
    raise exception 'Daty i godziny w tym oknie zmienia wyłącznie KSH (zamawiający)' using errcode = '42501';
  end if;
  if p_load is null then raise exception 'Brak transportu' using errcode = '22023'; end if;
  select * into l from loads where id = p_load for update;
  if not found then raise exception 'Transport nie istnieje' using errcode = '42501'; end if;
  select client_org_id into v_client from projects where id = l.project_id;
  if (v_client = current_org_id()) is not true then
    raise exception 'Daty i godziny w tym oknie zmienia wyłącznie KSH (zamawiający)' using errcode = '42501';
  end if;
  if (l.status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY')) is not true then
    raise exception 'Po wjeździe na załadunek (albo po anulowaniu) daty zmienia wyłącznie HHL' using errcode = '42501';
  end if;
  v_ld := coalesce(p_load_date, (p_load_from at time zone 'Europe/Warsaw')::date, l.plan_load_date);
  v_dd := coalesce(p_delivery_date, (p_delivery_from at time zone 'Europe/Stockholm')::date, l.plan_delivery_date);
  v_lf := coalesce(p_load_from, l.plan_load_from);
  v_lt := coalesce(p_load_to, l.plan_load_to);
  v_df := coalesce(p_delivery_from, l.plan_delivery_from);
  v_dt := coalesce(p_delivery_to, l.plan_delivery_to);
  if (v_ld is not null and v_dd is not null) is not true then
    raise exception 'Brak daty załadunku albo rozładunku' using errcode = '22023';
  end if;
  if (v_dd >= v_ld) is not true then
    raise exception 'Data rozładunku przed datą załadunku' using errcode = '22023';
  end if;
  if (v_lf <= v_lt) is false or (v_df <= v_dt) is false then
    raise exception 'Początek okna po jego końcu' using errcode = '22023';
  end if;
  if (v_df >= v_lf) is false then
    raise exception 'Rozładunek przed załadunkiem' using errcode = '22023';
  end if;
  v_changed := (v_ld, v_dd, v_lf, v_lt, v_df, v_dt)
               is distinct from (l.plan_load_date, l.plan_delivery_date, l.plan_load_from, l.plan_load_to, l.plan_delivery_from, l.plan_delivery_to);
  if not v_changed then
    return jsonb_build_object('changed', false);
  end if;

  -- autor w Historii: „imię nazwisko // KSH” (wpis PLAN_DATES_CHANGED tworzy wyzwalacz)
  select coalesce(nullif(btrim(u.full_name), ''), split_part(u.email::text, '@', 1), '—') || ' // KSH'
    into v_label from app_users u where u.id = v_actor;
  perform set_config('tower.dates_actor', v_label, true);
  perform set_config('tower.dates_ctx', 'on', true);
  update loads set plan_load_date = v_ld, plan_delivery_date = v_dd,
         plan_load_from = v_lf, plan_load_to = v_lt, plan_delivery_from = v_df, plan_delivery_to = v_dt,
         plan_dates_status = 'POTWIERDZONA', plan_dates_confirmed_by = v_actor, plan_dates_confirmed_at = now(),
         updated_at = now()
   where id = p_load;
  perform set_config('tower.dates_ctx', '', true);
  perform set_config('tower.dates_actor', '', true);

  v_code := coalesce(l.order_no, left(l.id::text, 8));
  v_payload := jsonb_build_object(
    'code', v_code, 'by', 'KSH', 'status', 'POTWIERDZONA',
    'load_date', v_ld, 'delivery_date', v_dd,
    'before_load_date', l.plan_load_date, 'before_delivery_date', l.plan_delivery_date);
  -- DEC-4: odbiorcy wg macierzy (grupa LOAD_STATUS)
  perform matrix_notify('LOAD_STATUS', 'PLAN_DATES_CHANGED', p_load, l.project_id, v_payload,
                        'PLAN_DATES:' || p_load || ':' || v_stamp);
  -- autor zmiany nie dostaje powiadomienia o własnej zmianie (jak w wyzwalaczu)
  delete from notifications
   where user_id = v_actor and load_id = p_load and dedup_key like 'PLAN_DATES:' || p_load || ':' || v_stamp || ':%';

  -- I-10: zmiana daty na transporcie awizowanym → SCHEDULE_DATE_CRITICAL (IN_APP; EMAIL — wyzwalacz 0056)
  v_awiz := l.status = 'READY' or l.sailing_id is not null
            or nullif(btrim(l.ferry_booking_ref), '') is not null
            or (nullif(btrim(l.driver_name), '') is not null and nullif(btrim(l.tractor_plate), '') is not null);
  if v_awiz and (v_ld, v_dd, v_lf, v_df) is distinct from (l.plan_load_date, l.plan_delivery_date, l.plan_load_from, l.plan_delivery_from) then
    insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
    values (p_load, 'SCHEDULE_DATE_CRITICAL', now(), v_actor,
            jsonb_build_object('code', v_code, 'by', 'KSH', 'actor', v_label,
                               'fields', to_jsonb(array['load_date','delivery_date']),
                               'before', jsonb_build_object('load_date', l.plan_load_date, 'delivery_date', l.plan_delivery_date),
                               'after', jsonb_build_object('load_date', v_ld, 'delivery_date', v_dd)));
    insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
    select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, p_load, 'SCHEDULE_DATE_CRITICAL',
           jsonb_build_object('code', v_code, 'fields', to_jsonb(array['load_date','delivery_date']),
                              'load_date', v_ld, 'delivery_date', v_dd, 'locale', u.locale),
           'SCHED_CRIT:KSH:' || p_load || ':' || v_stamp || ':' || u.id
      from app_users u join organizations o on o.id = u.org_id
     where u.active and (o.kind = 'FORWARDER' or (l.carrier_org_id is not null and u.org_id = l.carrier_org_id))
    on conflict (dedup_key) where dedup_key is not null do nothing;
  end if;

  return jsonb_build_object('changed', true, 'awizowany', v_awiz, 'load_date', v_ld, 'delivery_date', v_dd);
end $$;
revoke all on function public.ksh_confirm_dates(uuid, date, date, timestamptz, timestamptz, timestamptz, timestamptz) from public, anon;
grant execute on function public.ksh_confirm_dates(uuid, date, date, timestamptz, timestamptz, timestamptz, timestamptz) to authenticated;
