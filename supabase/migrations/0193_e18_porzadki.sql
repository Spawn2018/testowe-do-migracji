-- =====================================================================
-- TOWER — Migracja 0193: E18 porządki danych testowych + ERGO Hestia (P1)
--
-- Paczka: docs/handover/audyt_claude_2026-10-08/paczki/P1_E18.md
-- Decyzje 31–32, W22 (09.10: odpięcie 11 wpisów audit_log, usunięcie 6 app_users).
-- Dopisek D-20261012-2335-01 (K1–K9): okna P13, progi z kolumny „Dziś”,
-- auth.users bez cichego pomijania, zaproszenia tylko po e-mailu, wyjazd SG-03,
-- kontrola powiadomień, computed_at w eta_basis.
-- Kopia przed produkcją: scripts/e18/kopia.mjs → D:\Watch Tower\dane\e18\ (poza repo).
-- Jedna transakcja, bez zmian schematu. 0 wierszy po kluczu = no-op (TEST/lokalnie).
-- Drugie uruchomienie nie zmienia wierszy (UPDATE tylko gdy jest co zmienić).
-- =====================================================================

do $e18$
declare
  v_ids uuid[];
  v_n int;
  v_n2 int;
  v_del int;
  v_changed int;
  v_load uuid;
  v_cutoff timestamptz;
  v_sg02 jsonb;
  v_shape jsonb;
  v_audit_ids bigint[];
  v_notif_before bigint;
  v_notif_after bigint;
  v_notif_tower bigint;
  v_sms_before bigint;
  v_sms_after bigint;
  v_http_before bigint;
  v_http_after bigint;
  v_auth int;
  v_invites int;
  v_reads int;
  v_imp int;
  v_pol int;
  v_hst int;
  v_inv int;
  v_lines int;
  v_disp int;
  v_msg int;
  v_sg24 int;
  v_geo int;
  v_sig int;
  v_pos int;
  v_p13 int;
  v_tok int;
begin
  select count(*) into v_sms_before from sms_outbox;
  begin
    select count(*) into v_http_before from net._http_response;
  exception when undefined_table then
    v_http_before := 0;
  end;

  -- powiadomienia poza kontami testowymi — różnica na końcu = wyjątek (K6)
  select count(*) into v_notif_before
  from notifications n
  where not exists (
    select 1 from app_users u
    where u.id = n.user_id
      and (u.email ilike '%+tower-test%' or u.email ilike '%+tower-sec%')
  );

  -- ------------------------------------------------------------------
  -- Wyzwalacze wysyłające — tylko ta transakcja (P1_E18 § Sposób pkt 4)
  -- ------------------------------------------------------------------
  alter table risk_signals disable trigger trg_risk_matrix_notify;
  alter table loads disable trigger trg_loads_status_matrix_notify;
  alter table loads disable trigger trg_loads_eta;

  begin
    -- ================================================================
    -- Konta +tower-sec / +tower-test (E18 P2, P3) + W22
    -- Progi przed jakąkolwiek zmianą. auth.users: brak tabeli = CI;
    -- brak uprawnień albo zostawione wiersze = wyjątek (K2), bez „then null”.
    -- ================================================================
    select array_agg(id order by email) into v_ids
    from app_users
    where email ilike '%+tower-sec%' or email ilike '%+tower-test%';

    v_n := coalesce(cardinality(v_ids), 0);
    if v_n > 6 then
      raise exception '0193 przerwane: E18 P2/P3 — % kont +tower-*, oczekiwano ≤ 6', v_n;
    end if;

    v_n2 := 0;
    if v_n > 0 then
      select count(*) into v_n2 from audit_log
      where user_id = any (v_ids) or acting_as_user_id = any (v_ids);
      if v_n2 > 11 then
        raise exception '0193 przerwane: E18 W22 — % wpisów audit_log wskazuje konta testowe, oczekiwano ≤ 11 (STOP §5)', v_n2;
      end if;
    end if;

    v_auth := 0;
    if to_regclass('auth.users') is null then
      raise notice '0193 auth.users=brak-tabeli';
    else
      execute $auth$
        select count(*)::int from auth.users
        where email ilike '%+tower-test%' or email ilike '%+tower-sec%'
      $auth$ into v_auth;
      if v_auth > 3 then
        raise exception '0193 przerwane: E18 P2/P3 — % kont auth.users +tower, oczekiwano ≤ 3', v_auth;
      end if;
    end if;

    select count(*) into v_invites from user_invites where email ilike '%+tower-test%';
    if v_invites > 3 then
      raise exception '0193 przerwane: E18 P2/P3 — % zaproszeń +tower-test, oczekiwano ≤ 3', v_invites;
    end if;

    if v_n > 0 then
      select count(*) into v_notif_tower from notifications where user_id = any (v_ids);
      select count(*) into v_reads from load_message_reads where user_id = any (v_ids);
      select count(*) into v_imp from impersonation_state
       where admin_user_id = any (v_ids) or target_user_id = any (v_ids);
    else
      v_notif_tower := 0;
      v_reads := 0;
      v_imp := 0;
    end if;
    raise notice '0193 konta=% auth.users=% zaproszenia=% dziennik=%', v_n, v_auth, v_invites, v_n2;
    raise notice '0193 powiadomienia_kont=% odczyty=% dzialaj_jako=%', v_notif_tower, v_reads, v_imp;

    if v_n > 0 then
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
      raise notice '0193 powiadomienia_kont usuniete=%', v_del;

      delete from load_message_reads where user_id = any (v_ids);
      delete from impersonation_state
       where admin_user_id = any (v_ids) or target_user_id = any (v_ids);
    end if;

    -- K3: tylko e-mail z paczki. Zaproszenie prawdziwej osoby (invited_by) zostaje
    -- i zatrzymuje migrację na kontroli kluczy obcych.
    delete from user_invites where email ilike '%+tower-test%';
    get diagnostics v_changed = row_count;
    raise notice '0193 zaproszenia usuniete=%', v_changed;

    if to_regclass('auth.users') is not null then
      execute $auth$
        delete from auth.users
        where email ilike '%+tower-test%' or email ilike '%+tower-sec%'
      $auth$;
      execute $auth$
        select count(*)::int from auth.users
        where email ilike '%+tower-test%' or email ilike '%+tower-sec%'
      $auth$ into v_auth;
      if v_auth <> 0 then
        raise exception '0193 przerwane: E18 P2/P3 — po DELETE zostało % kont auth.users +tower', v_auth;
      end if;
      raise notice '0193 auth.users po usunieciu=%', v_auth;
    end if;

    if v_n > 0 then
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

      perform 1 from decisions
       where assignee_id = any (v_ids) or resolved_by = any (v_ids)
       limit 1;
      if found then
        raise exception '0193 przerwane: E18 P2/P3 — decisions wskazuje konto testowe';
      end if;

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
    select count(*) into v_pol from insurance_policies where policy_no = 'OCP-SCX-2026-WT';
    if v_pol > 1 then
      raise exception '0193 przerwane: E18 P6 — % polis OCP-SCX-2026-WT, oczekiwano ≤ 1', v_pol;
    end if;
    select count(*) into v_hst
    from insurance_policies
    where policy_no = '436000430439' and insurer = 'Hstia';
    if v_hst > 1 then
      raise exception '0193 przerwane: Hstia — % wierszy, oczekiwano ≤ 1', v_hst;
    end if;
    raise notice '0193 polisa=% hstia=%', v_pol, v_hst;

    if v_pol = 1 then
      delete from insurance_policies where policy_no = 'OCP-SCX-2026-WT';
      insert into audit_log (action, entity, entity_id, new_value, source)
      values ('E18_P6', 'insurance_policies', 'OCP-SCX-2026-WT',
              jsonb_build_object('wykonawca', 'migracja E18', 'usunieto', 1), 'migration-0193');
    end if;

    if v_hst = 1 then
      update insurance_policies
         set insurer = 'ERGO Hestia'
       where policy_no = '436000430439' and insurer = 'Hstia';
      insert into audit_log (action, entity, entity_id, new_value, source)
      values ('E18_HSTIA', 'insurance_policies', '436000430439',
              jsonb_build_object('wykonawca', 'migracja E18', 'insurer', 'ERGO Hestia'), 'migration-0193');
    end if;

    -- ================================================================
    -- Faktura testowa (pozycje i spory znikają kaskadą)
    -- ================================================================
    select count(*) into v_inv from invoices where invoice_number = 'WT-TEST-P6-20261005';
    if v_inv > 1 then
      raise exception '0193 przerwane: E18 P7 — % faktur testowych, oczekiwano ≤ 1', v_inv;
    end if;
    select count(*) into v_lines
    from invoice_lines il
    join invoices i on i.id = il.invoice_id
    where i.invoice_number = 'WT-TEST-P6-20261005';
    select count(*) into v_disp
    from invoice_dispute_events e
    join invoices i on i.id = e.invoice_id
    where i.invoice_number = 'WT-TEST-P6-20261005';
    raise notice '0193 faktura=% pozycje=% spory=%', v_inv, v_lines, v_disp;
    if v_inv = 1 then
      delete from invoices where invoice_number = 'WT-TEST-P6-20261005';
      insert into audit_log (action, entity, entity_id, new_value, source)
      values ('E18_P7', 'invoices', 'WT-TEST-P6-20261005',
              jsonb_build_object('wykonawca', 'migracja E18', 'usunieto', 1, 'pozycje', v_lines, 'spory', v_disp),
              'migration-0193');
    end if;

    -- ================================================================
    -- Wiadomości czatu 29, 31, 32, 33
    -- ================================================================
    select count(*) into v_msg from load_messages where id in (29, 31, 32, 33);
    if v_msg > 4 then
      raise exception '0193 przerwane: E18 P8 — % wiadomości, oczekiwano ≤ 4', v_msg;
    end if;
    raise notice '0193 wiadomosci=%', v_msg;
    if v_msg > 0 then
      delete from load_messages where id in (29, 31, 32, 33);
      get diagnostics v_del = row_count;
      insert into audit_log (action, entity, entity_id, new_value, source)
      values ('E18_P8', 'load_messages', '29,31,32,33',
              jsonb_build_object('wykonawca', 'migracja E18', 'usunieto', v_del), 'migration-0193');
    end if;

    -- ================================================================
    -- SG-24: progi z kolumny „Dziś” (K4), potem czyszczenie
    -- ================================================================
    select count(distinct l.id) into v_sg24
    from loads l
    join shipment_items si on si.load_id = l.id
    where si.shipment_code = 'SG-24';
    if v_sg24 > 1 then
      raise exception '0193 przerwane: E18 P9 — % transportów SG-24, oczekiwano ≤ 1', v_sg24;
    end if;

    v_geo := 0;
    v_sig := 0;
    v_load := null;
    if v_sg24 = 1 then
      select l.id into v_load
      from loads l
      join shipment_items si on si.load_id = l.id
      where si.shipment_code = 'SG-24'
      limit 1;

      select count(*) into v_geo from geofence_states where load_id = v_load;
      if v_geo > 2 then
        raise exception '0193 przerwane: E18 P9 — % geofence_states SG-24, oczekiwano ≤ 2', v_geo;
      end if;

      select count(*) into v_sig from risk_signals
      where load_id = v_load
        and resolved_at is null
        and (
          (kind = 'ETA_BREACH' and coalesce(title, '') like 'Opóźnienie 5400 min%')
          or (kind = 'JOB_FAILURE' and coalesce(title, '') like 'Decyzja po terminie: Opóźnienie 5400 min%')
        );
      if v_sig > 2 then
        raise exception '0193 przerwane: E18 P9 — % spraw 5400 min, oczekiwano ≤ 2', v_sig;
      end if;
    end if;
    raise notice '0193 sg24=% geofence=% sprawy5400=%', v_sg24, v_geo, v_sig;

    if v_load is not null then
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
         and status in ('READY', 'PLANNED')
         and (
           hhl_order_no is not null
           or tractor_plate is not null
           or trailer_plate is not null
           or driver_name is not null
           or driver_phone is not null
           or driver_phone_country is distinct from 'PL'
           or sailing_id is not null
           or ferry_booking_ref is not null
           or status is distinct from 'PLANNED'
         );
      get diagnostics v_changed = row_count;

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

      if v_changed > 0 or v_del > 0 or v_n2 > 0 then
        insert into audit_log (action, entity, entity_id, new_value, source)
        values ('E18_P9', 'loads', v_load::text,
                jsonb_build_object(
                  'wykonawca', 'migracja E18',
                  'shipment', 'SG-24',
                  'loads_zmienione', v_changed,
                  'geofence_states_usuniete', v_del,
                  'sprawy_zamkniete', v_n2
                ), 'migration-0193');
      end if;
    end if;

    -- ================================================================
    -- SG-03: wyjazd z placu SITE „Stegra Boden” dnia 2026-10-07 (K5)
    -- ================================================================
    v_load := null;
    v_cutoff := null;
    v_pos := 0;
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
        and payload->>'geofence_kind' = 'SITE'
        and payload->>'geofence_name' ilike '%Stegra Boden%'
        and (occurred_at at time zone 'UTC')::date = date '2026-10-07'
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

      if v_cutoff is null then
        select count(*) into v_pos
        from positions
        where load_id = v_load
          and ts > timestamptz '2026-10-07 10:19:54+00';
        if v_pos > 0 then
          raise exception '0193 przerwane: E18 P10 — brak czasu wyjazdu SG-03, a są pozycje po 07.10 10:19:54 UTC (%)', v_pos;
        end if;
      else
        select count(*) into v_pos
        from positions
        where load_id = v_load and ts > v_cutoff;
        delete from positions where load_id = v_load and ts > v_cutoff;
        get diagnostics v_del = row_count;
        if v_del > 0 then
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
    end if;
    raise notice '0193 sg03_pozycje=% cutoff=%', v_pos, v_cutoff;

    -- ================================================================
    -- ETA przed wyjazdem → kształt SG-02, computed_at = czas migracji (K9)
    -- ================================================================
    select l.eta_basis into v_sg02
    from loads l
    join shipment_items si on si.load_id = l.id
    where si.shipment_code = 'SG-02'
    limit 1;

    v_shape := coalesce(v_sg02, jsonb_build_object('pre_load', true)) - 'computed_at';

    update loads l
       set eta_site = null,
           eta_confidence_min = null,
           delay_minutes = null,
           eta_basis = jsonb_set(v_shape, '{computed_at}', to_jsonb(now())),
           updated_at = now()
     where (
           l.status = 'PLANNED'
           or (l.status = 'READY' and exists (
                 select 1 from shipment_items si
                 where si.load_id = l.id and si.shipment_code = 'SG-24'
               ))
         )
       and (
           l.eta_site is not null
           or l.eta_confidence_min is not null
           or l.delay_minutes is not null
           or (coalesce(l.eta_basis, '{}'::jsonb) - 'computed_at') is distinct from v_shape
         );
    get diagnostics v_del = row_count;

    update risk_signals rs
       set resolved_at = now()
      from loads l
     where rs.load_id = l.id
       and rs.resolved_at is null
       and rs.kind = 'ETA_BREACH'
       and l.status = 'PLANNED';
    get diagnostics v_n2 = row_count;
    raise notice '0193 p11=% eta_breach=%', v_del, v_n2;

    if v_del > 0 or v_n2 > 0 then
      insert into audit_log (action, entity, entity_id, new_value, source)
      values ('E18_P11', 'loads', 'PLANNED',
              jsonb_build_object(
                'wykonawca', 'migracja E18',
                'loads_eta_wyczyszczone', v_del,
                'eta_breach_zamkniete', v_n2
              ), 'migration-0193');
    end if;

    -- ================================================================
    -- P13: tylko okna z kopia.mjs, próg 5 (K1)
    -- ================================================================
    select count(*) into v_p13
    from risk_signals
    where resolved_at is null
      and kind = 'JOB_FAILURE'
      and (
        (coalesce(title, '') like 'SMS bez potwierdzenia doręczenia%'
          and detected_at >= timestamptz '2026-10-01 17:00:00+00'
          and detected_at < timestamptz '2026-10-01 18:00:00+00')
        or (coalesce(title, '') like 'Błędy w przeglądarce użytkowników%'
          and detected_at >= timestamptz '2026-10-03 17:00:00+00'
          and detected_at < timestamptz '2026-10-03 18:00:00+00')
      );
    if v_p13 > 5 then
      raise exception '0193 przerwane: E18 P13 — % spraw w oknie, oczekiwano ≤ 5', v_p13;
    end if;
    raise notice '0193 p13=%', v_p13;
    if v_p13 > 0 then
      update risk_signals
         set resolved_at = now()
       where resolved_at is null
         and kind = 'JOB_FAILURE'
         and (
           (coalesce(title, '') like 'SMS bez potwierdzenia doręczenia%'
             and detected_at >= timestamptz '2026-10-01 17:00:00+00'
             and detected_at < timestamptz '2026-10-01 18:00:00+00')
           or (coalesce(title, '') like 'Błędy w przeglądarce użytkowników%'
             and detected_at >= timestamptz '2026-10-03 17:00:00+00'
             and detected_at < timestamptz '2026-10-03 18:00:00+00')
         );
      insert into audit_log (action, entity, entity_id, new_value, source)
      values ('E18_P13', 'risk_signals', 'JOB_FAILURE_test',
              jsonb_build_object('wykonawca', 'migracja E18', 'zamknieto', v_p13), 'migration-0193');
    end if;

    -- ================================================================
    -- L-1b: token kierowcy SG-01
    -- ================================================================
    v_load := null;
    v_tok := 0;
    select l.id into v_load
    from loads l
    join shipment_items si on si.load_id = l.id
    where si.shipment_code = 'SG-01'
    limit 1;

    if v_load is not null then
      select count(*) into v_tok from driver_tokens
      where load_id = v_load
        and issued_at >= timestamptz '2026-10-01 20:00:00+00'
        and issued_at < timestamptz '2026-10-01 21:00:00+00';
      if v_tok > 1 then
        raise exception '0193 przerwane: L-1b — % tokenów SG-01 w oknie, oczekiwano ≤ 1', v_tok;
      elsif v_tok = 1 then
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
    raise notice '0193 l1b=%', v_tok;

    select count(*) into v_notif_after
    from notifications n
    where not exists (
      select 1 from app_users u
      where u.id = n.user_id
        and (u.email ilike '%+tower-test%' or u.email ilike '%+tower-sec%')
    );
    if v_notif_after <> v_notif_before then
      raise exception '0193 przerwane: powiadomienia poza kontami testowymi zmieniły się (% → %)', v_notif_before, v_notif_after;
    end if;

    select count(*) into v_sms_after from sms_outbox;
    if v_sms_after <> v_sms_before then
      raise exception '0193 przerwane: sms_outbox zmienił się (% → %)', v_sms_before, v_sms_after;
    end if;

    v_http_after := v_http_before;
    begin
      select count(*) into v_http_after from net._http_response;
      if v_http_after <> v_http_before then
        raise exception '0193 przerwane: net._http_response zmienił się (% → %)', v_http_before, v_http_after;
      end if;
    exception when undefined_table then
      v_http_after := v_http_before;
    end;

    raise notice '0193 powiadomienia_obce przed=% po=% sms przed=% po=% http przed=% po=%',
      v_notif_before, v_notif_after, v_sms_before, v_sms_after, v_http_before, v_http_after;

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
