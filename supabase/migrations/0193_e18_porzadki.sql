-- =====================================================================
-- TOWER — Migracja 0193: E18 porządki danych testowych + ERGO Hestia (P1)
--
-- Paczka: docs/handover/audyt_claude_2026-10-08/paczki/P1_E18.md
-- Decyzje 31–32, W22 (09.10: odpięcie 11 wpisów audit_log, usunięcie 6 app_users).
-- Kopia przed produkcją: scripts/e18/kopia.mjs → D:\Watch Tower\dane\e18\ (poza repo).
-- Jedna transakcja, bez zmian schematu. 0 wierszy po kluczu = no-op (TEST/lokalnie).
-- =====================================================================

do $e18$
declare
  v_ids uuid[];
  v_n int;
  v_n2 int;
  v_del int;
  v_load uuid;
  v_cutoff timestamptz;
  v_sg02 jsonb;
  v_audit_ids bigint[];
  v_notif_before bigint;
  v_sms_before bigint;
  v_http_before bigint;
  r record;
begin
  -- liczniki kontrolne powiadomień (poza usunięciami kont — porównanie na końcu bloku kont)
  select count(*) into v_sms_before from sms_outbox;
  begin
    select count(*) into v_http_before from net._http_response;
  exception when undefined_table then
    v_http_before := 0;
  end;

  -- ------------------------------------------------------------------
  -- Wyzwalacze wysyłające — tylko ta transakcja (P1_E18 § Sposób pkt 4)
  -- ------------------------------------------------------------------
  alter table risk_signals disable trigger trg_risk_matrix_notify;
  alter table loads disable trigger trg_loads_status_matrix_notify;
  alter table loads disable trigger trg_loads_eta;

  begin
    -- ================================================================
    -- Konta +tower-sec / +tower-test (E18 P2, P3) + W22
    -- ================================================================
    select array_agg(id order by email) into v_ids
    from app_users
    where email ilike '%+tower-sec%' or email ilike '%+tower-test%';

    v_n := coalesce(cardinality(v_ids), 0);
    if v_n > 6 then
      raise exception '0193 przerwane: E18 P2/P3 — % kont +tower-*, oczekiwano ≤ 6', v_n;
    end if;

    if v_n > 0 then
      select count(*) into v_n2 from audit_log
      where user_id = any (v_ids) or acting_as_user_id = any (v_ids);
      if v_n2 > 11 then
        raise exception '0193 przerwane: E18 W22 — % wpisów audit_log wskazuje konta testowe, oczekiwano ≤ 11 (STOP §5)', v_n2;
      end if;

      select coalesce(array_agg(id order by id), array[]::bigint[]) into v_audit_ids
      from audit_log
      where user_id = any (v_ids) or acting_as_user_id = any (v_ids);

      update audit_log
         set user_id = case when user_id = any (v_ids) then null else user_id end,
             acting_as_user_id = case when acting_as_user_id = any (v_ids) then null else acting_as_user_id end
       where id = any (v_audit_ids);

      insert into audit_log (action, entity, entity_id, new_value, source)
      values (
        'E18_AUDIT_DETACH',
        'app_users',
        'tower-test-accounts',
        jsonb_build_object(
          'wykonawca', 'migracja E18',
          'opis', 'odpięcie wpisów dziennika od usuniętych kont',
          'audit_ids', to_jsonb(v_audit_ids),
          'emails_mask', (
            select jsonb_agg(left(split_part(email, '@', 1), 1) || '***@' || left(split_part(email, '@', 2), 1) || '***'
                             order by email)
            from app_users where id = any (v_ids)
          )
        ),
        'migration-0193'
      );

      delete from notifications where user_id = any (v_ids);
      get diagnostics v_del = row_count;

      delete from load_message_reads where user_id = any (v_ids);

      delete from impersonation_state
       where admin_user_id = any (v_ids) or target_user_id = any (v_ids);

      delete from user_invites
       where email ilike '%+tower-test%' or invited_by = any (v_ids);

      -- auth.users (tylko +tower-test zwykle ma konto)
      begin
        delete from auth.users
         where email ilike '%+tower-test%' or email ilike '%+tower-sec%';
      exception when insufficient_privilege then
        null; -- hosted bez uprawnień do auth — usuwa App Admin poza migracją / service
      end;

      -- inne FK do app_users (poza odpiętym dziennikiem) = STOP
      if exists (
        select 1 from notifications where user_id = any (v_ids)
        union all select 1 from load_message_reads where user_id = any (v_ids)
        union all select 1 from impersonation_state
          where admin_user_id = any (v_ids) or target_user_id = any (v_ids)
        union all select 1 from user_invites where invited_by = any (v_ids)
        union all select 1 from audit_log
          where user_id = any (v_ids) or acting_as_user_id = any (v_ids)
      ) then
        raise exception '0193 przerwane: E18 P2/P3 — pozostały odwołania do kont testowych';
      end if;

      -- skan typowych FK bez CASCADE (jeśli wiersz wskazuje konto → STOP)
      perform 1 from load_messages where author_id = any (v_ids) limit 1;
      if found then raise exception '0193 przerwane: load_messages.author_id wskazuje konto testowe'; end if;
      perform 1 from load_events where actor_id = any (v_ids) limit 1;
      if found then raise exception '0193 przerwane: load_events.actor_id wskazuje konto testowe'; end if;
      perform 1 from documents where uploaded_by = any (v_ids) limit 1;
      if found then raise exception '0193 przerwane: documents.uploaded_by wskazuje konto testowe'; end if;

      delete from app_users where id = any (v_ids);
      get diagnostics v_n2 = row_count;
      if v_n2 <> v_n then
        raise exception '0193 przerwane: usunięto % app_users, oczekiwano %', v_n2, v_n;
      end if;

      insert into audit_log (action, entity, entity_id, new_value, source)
      values (
        'E18_P2_P3',
        'app_users',
        'tower-test-accounts',
        jsonb_build_object('wykonawca', 'migracja E18', 'usunieto_kont', v_n, 'powiadomienia', v_del),
        'migration-0193'
      );
    end if;

    -- ================================================================
    -- Polisa testowa + ERGO Hestia
    -- ================================================================
    select count(*) into v_n from insurance_policies where policy_no = 'OCP-SCX-2026-WT';
    if v_n > 1 then
      raise exception '0193 przerwane: E18 P6 — % polis OCP-SCX-2026-WT', v_n;
    elsif v_n = 1 then
      -- Paczka: żaden klucz obcy nie wskazuje tej polisy (stan 08.10).
      delete from insurance_policies where policy_no = 'OCP-SCX-2026-WT';
      insert into audit_log (action, entity, entity_id, new_value, source)
      values ('E18_P6', 'insurance_policies', 'OCP-SCX-2026-WT',
              jsonb_build_object('wykonawca', 'migracja E18', 'usunieto', 1), 'migration-0193');
    end if;

    select count(*) into v_n
    from insurance_policies
    where policy_no = '436000430439' and insurer = 'Hstia';
    if v_n > 1 then
      raise exception '0193 przerwane: Hstia — % wierszy', v_n;
    elsif v_n = 1 then
      update insurance_policies
         set insurer = 'ERGO Hestia'
       where policy_no = '436000430439' and insurer = 'Hstia';
      insert into audit_log (action, entity, entity_id, new_value, source)
      values ('E18_HSTIA', 'insurance_policies', '436000430439',
              jsonb_build_object('wykonawca', 'migracja E18', 'insurer', 'ERGO Hestia'), 'migration-0193');
    end if;

    -- ================================================================
    -- Faktura testowa
    -- ================================================================
    select count(*) into v_n from invoices where invoice_number = 'WT-TEST-P6-20261005';
    if v_n > 1 then
      raise exception '0193 przerwane: E18 P7 — % faktur testowych', v_n;
    elsif v_n = 1 then
      delete from invoices where invoice_number = 'WT-TEST-P6-20261005';
      insert into audit_log (action, entity, entity_id, new_value, source)
      values ('E18_P7', 'invoices', 'WT-TEST-P6-20261005',
              jsonb_build_object('wykonawca', 'migracja E18', 'usunieto', 1), 'migration-0193');
    end if;

    -- ================================================================
    -- Wiadomości czatu 29, 31, 32, 33
    -- ================================================================
    select count(*) into v_n from load_messages where id in (29, 31, 32, 33);
    if v_n > 4 then
      raise exception '0193 przerwane: E18 P8 — % wiadomości', v_n;
    elsif v_n > 0 then
      delete from load_messages where id in (29, 31, 32, 33);
      get diagnostics v_del = row_count;
      insert into audit_log (action, entity, entity_id, new_value, source)
      values ('E18_P8', 'load_messages', '29,31,32,33',
              jsonb_build_object('wykonawca', 'migracja E18', 'usunieto', v_del), 'migration-0193');
    end if;

    -- ================================================================
    -- SG-24: wyczyść zasoby / READY→PLANNED, strefy, sprawy
    -- ================================================================
    select l.id into v_load
    from loads l
    join shipment_items si on si.load_id = l.id
    where si.shipment_code = 'SG-24'
    limit 1;

    if v_load is not null then
      -- driver_phone_country jest NOT NULL (domyślnie PL) — „czyszczenie” = brak telefonu, kraj PL
      update loads
         set hhl_order_no = null,
             tractor_plate = null,
             trailer_plate = null,
             driver_name = null,
             driver_phone = null,
             driver_phone_country = 'PL',
             sailing_id = null,
             ferry_booking_ref = null,
             status = 'PLANNED',
             updated_at = now()
       where id = v_load
         and status in ('READY', 'PLANNED');

      delete from geofence_states where load_id = v_load;
      get diagnostics v_del = row_count;

      update risk_signals
         set resolved_at = now(),
             resolved_by = null
       where load_id = v_load
         and resolved_at is null
         and (
           (kind = 'ETA_BREACH' and coalesce(title, '') like 'Opóźnienie 5400 min%')
           or (kind = 'JOB_FAILURE' and coalesce(title, '') like 'Decyzja po terminie: Opóźnienie 5400 min%')
         );
      get diagnostics v_n2 = row_count;

      insert into audit_log (action, entity, entity_id, new_value, source)
      values ('E18_P9', 'loads', v_load::text,
              jsonb_build_object(
                'wykonawca', 'migracja E18',
                'shipment', 'SG-24',
                'geofence_states_usuniete', v_del,
                'sprawy_zamkniete', v_n2
              ), 'migration-0193');
    end if;

    -- ================================================================
    -- SG-03: pozycje po wyjeździe z placu SITE
    -- ================================================================
    select l.id into v_load
    from loads l
    join shipment_items si on si.load_id = l.id
    where si.shipment_code = 'SG-03'
    limit 1;

    if v_load is not null then
      select occurred_at into v_cutoff
      from load_events
      where load_id = v_load
        and event_type = 'GEOFENCE_EXIT'
        and (
          coalesce(payload->>'zone_kind', '') = 'SITE'
          or coalesce(payload->>'kind', '') = 'SITE'
          or coalesce(payload->>'zone_name', '') ilike '%Stegra Boden%'
          or coalesce(payload->>'name', '') ilike '%Stegra Boden%'
        )
      order by occurred_at asc
      limit 1;

      if v_cutoff is null then
        select occurred_at into v_cutoff
        from load_events
        where load_id = v_load
          and event_type = 'GEOFENCE_EXIT'
          and occurred_at >= timestamptz '2026-10-07 10:19:50+00'
          and occurred_at <= timestamptz '2026-10-07 10:20:00+00'
        order by occurred_at asc
        limit 1;
      end if;

      if v_cutoff is not null then
        delete from positions where load_id = v_load and ts > v_cutoff;
        get diagnostics v_del = row_count;
        insert into audit_log (action, entity, entity_id, new_value, source)
        values ('E18_P10', 'positions', v_load::text,
                jsonb_build_object(
                  'wykonawca', 'migracja E18',
                  'shipment', 'SG-03',
                  'cutoff', v_cutoff,
                  'usunieto', v_del
                ), 'migration-0193');
      end if;
    end if;

    -- ================================================================
    -- ETA przed wyjazdem (PLANNED + READY SG-24) → kształt SG-02
    -- ================================================================
    select l.eta_basis into v_sg02
    from loads l
    join shipment_items si on si.load_id = l.id
    where si.shipment_code = 'SG-02'
    limit 1;

    update loads l
       set eta_site = null,
           eta_confidence_min = null,
           delay_minutes = null,
           eta_basis = coalesce(v_sg02, jsonb_build_object('pre_load', true)),
           updated_at = now()
     where l.status = 'PLANNED'
        or (l.status = 'READY' and exists (
              select 1 from shipment_items si
              where si.load_id = l.id and si.shipment_code = 'SG-24'
            ));
    get diagnostics v_del = row_count;

    update risk_signals rs
       set resolved_at = now()
      from loads l
     where rs.load_id = l.id
       and rs.resolved_at is null
       and rs.kind = 'ETA_BREACH'
       and l.status = 'PLANNED';
    get diagnostics v_n2 = row_count;

    insert into audit_log (action, entity, entity_id, new_value, source)
    values ('E18_P11', 'loads', 'PLANNED',
            jsonb_build_object(
              'wykonawca', 'migracja E18',
              'loads_eta_wyczyszczone', v_del,
              'eta_breach_zamkniete', v_n2
            ), 'migration-0193');

    -- ================================================================
    -- P13: 5 spraw testowych JOB_FAILURE (+ do 4 dodatkowych jeśli koordynator: łącznie ≤9)
    -- Spec paczki: 5. Uzupełnienie: zamykamy po tytule; próg twardy 9.
    -- ================================================================
    update risk_signals
       set resolved_at = now()
     where resolved_at is null
       and kind = 'JOB_FAILURE'
       and (
         (coalesce(title, '') like 'SMS bez potwierdzenia doręczenia%')
         or (coalesce(title, '') like 'Błędy w przeglądarce użytkowników%')
       );
    get diagnostics v_del = row_count;
    if v_del > 9 then
      raise exception '0193 przerwane: E18 P13 — zamknięto % spraw testowych, próg 9', v_del;
    end if;
    if v_del > 0 then
      insert into audit_log (action, entity, entity_id, new_value, source)
      values ('E18_P13', 'risk_signals', 'JOB_FAILURE_test',
              jsonb_build_object('wykonawca', 'migracja E18', 'zamknieto', v_del), 'migration-0193');
    end if;

    -- ================================================================
    -- L-1b: token kierowcy SG-01
    -- ================================================================
    select l.id into v_load
    from loads l
    join shipment_items si on si.load_id = l.id
    where si.shipment_code = 'SG-01'
    limit 1;

    if v_load is not null then
      select count(*) into v_n from driver_tokens
      where load_id = v_load
        and issued_at >= timestamptz '2026-10-01 20:00:00+00'
        and issued_at < timestamptz '2026-10-01 21:00:00+00';
      if v_n > 1 then
        raise exception '0193 przerwane: L-1b — % tokenów SG-01 w oknie', v_n;
      elsif v_n = 1 then
        delete from driver_tokens
         where load_id = v_load
           and issued_at >= timestamptz '2026-10-01 20:00:00+00'
           and issued_at < timestamptz '2026-10-01 21:00:00+00';
        insert into audit_log (action, entity, entity_id, new_value, source)
        values ('E18_L1B', 'driver_tokens', v_load::text,
                jsonb_build_object('wykonawca', 'migracja E18', 'shipment', 'SG-01', 'usunieto', 1),
                'migration-0193');
      end if;
    end if;

    -- kontrola: brak nowych SMS; http_response bez wzrostu (gdy tabela jest)
    select count(*) into v_n from sms_outbox;
    if v_n <> v_sms_before then
      raise exception '0193 przerwane: sms_outbox zmienił się (% → %)', v_sms_before, v_n;
    end if;
    begin
      select count(*) into v_n from net._http_response;
      if v_n <> v_http_before then
        raise exception '0193 przerwane: net._http_response zmienił się (% → %)', v_http_before, v_n;
      end if;
    exception when undefined_table then
      null;
    end;

    alter table risk_signals enable trigger trg_risk_matrix_notify;
    alter table loads enable trigger trg_loads_status_matrix_notify;
    alter table loads enable trigger trg_loads_eta;

  exception
    when others then
      alter table risk_signals enable trigger trg_risk_matrix_notify;
      alter table loads enable trigger trg_loads_status_matrix_notify;
      alter table loads enable trigger trg_loads_eta;
      raise;
  end;
end;
$e18$;
