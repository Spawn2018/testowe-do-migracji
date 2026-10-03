-- =====================================================================
-- TOWER — Migracja 0137: usunięcie ładunków NTG (TYP = STANDARD)
--
-- Decyzja właściciela 03.10.2026, D-8: STANDARD to ładunki NTG, poza zakresem Watch Tower.
-- Usuwa wyłącznie kody z listy poniżej i tylko wtedy, gdy pozycja ma cargo_class = STANDARD.
-- Kod z listy o innej klasie zostaje. STANDARD spoza listy zostaje. Inne transporty bez zmian.
-- Przed usunięciem: kopia (odczyt 03.10) — 42 transporty, 46 zdarzeń, 138 powiadomień,
-- 17 sygnałów ryzyka, 45 wpisów historii; dokumenty 0, linie faktur 0.
-- =====================================================================

do $delete_standard_ntg$
declare
  v_codes text[] := array[
    'PL-10','PL-11','PL-12','PL-14','PL-15','PL-16','PL-18','PL-19','PL-2','PL-20',
    'PL-22','PL-23','PL-24','PL-3','PL-4','PL-6','PL-7','PL-8',
    'T-03','T-04','T-05','T-08','T-09','T-10','T-13','T-14','T-15',
    'TBS-01','TBS-02','TBS-03','TBS-04',
    'TS-01','TS-03','TS-05','TS-06','TS-07','TS-09','TS-10','TS-11','TS-12','TS-13',
    'W-00'
  ];
  v_ids uuid[];
  v_n int;
  v_removed int;
begin
  select coalesce(array_agg(l.id), '{}')
    into v_ids
  from loads l
  join shipment_items si on si.load_id = l.id
  where si.shipment_code = any (v_codes)
    and si.cargo_class = 'STANDARD';

  if exists (
    select 1
    from shipment_items si
    where si.load_id = any (v_ids)
      and (si.cargo_class is distinct from 'STANDARD' or not (si.shipment_code = any (v_codes)))
  ) then
    raise exception '0137 przerwane: transport z listy ma pozycję, która nie jest STANDARD albo nie jest na liście';
  end if;

  -- blokady bez ON DELETE CASCADE: tylko wiersze tych transportów
  delete from decision_events
   where decision_id in (
     select d.id from decisions d
      where d.load_id = any (v_ids)
         or d.risk_id in (select r.id from risk_signals r where r.load_id = any (v_ids))
   );
  delete from decisions
   where load_id = any (v_ids)
      or risk_id in (select r.id from risk_signals r where r.load_id = any (v_ids));
  delete from workflow_runs
   where load_id = any (v_ids)
      or event_id in (select e.id from load_events e where e.load_id = any (v_ids));
  delete from notifications where load_id = any (v_ids);
  delete from invoice_lines where load_id = any (v_ids);
  delete from driver_tokens where load_id = any (v_ids);
  delete from eta_segment_observations where load_id = any (v_ids);
  delete from sms_outbox_secret
   where sms_id in (select s.id from sms_outbox s where s.load_id = any (v_ids));
  delete from sms_outbox where load_id = any (v_ids);

  delete from shipment_items
   where load_id = any (v_ids)
     and cargo_class = 'STANDARD'
     and shipment_code = any (v_codes);
  if exists (select 1 from shipment_items where load_id = any (v_ids)) then
    raise exception '0137 przerwane: została pozycja harmonogramu przy transporcie z listy';
  end if;

  -- load_events jest append-only (0001). Wyjątek tylko na czas tego usunięcia,
  -- w tej samej transakcji: decyzja właściciela kasuje historię tych 42 transportów
  -- (kopia jest poza bazą). Wyzwalacz wraca od razu potem.
  alter table load_events disable trigger trg_load_events_immutable;
  begin
    delete from load_events where load_id = any (v_ids);
    delete from loads where id = any (v_ids);
    get diagnostics v_removed = row_count;
    alter table load_events enable trigger trg_load_events_immutable;
  exception
    when others then
      alter table load_events enable trigger trg_load_events_immutable;
      raise;
  end;

  v_n := coalesce(array_length(v_ids, 1), 0);
  if v_removed is distinct from v_n then
    raise exception '0137 przerwane: usunięto % transportów, a lista wskazała %', v_removed, v_n;
  end if;

  if exists (
    select 1 from shipment_items
     where shipment_code = any (v_codes) and cargo_class = 'STANDARD'
  ) or exists (
    select 1 from loads where id = any (v_ids)
  ) then
    raise exception '0137 przerwane: po usunięciu zostały transporty STANDARD z listy';
  end if;

  insert into audit_log (action, entity, entity_id, new_value, source)
  values (
    'STANDARD_NTG_REMOVED',
    'load',
    'D-8',
    jsonb_build_object(
      'who', 'właściciel',
      'when', '2026-10-03',
      'why', 'decyzja właściciela 03.10.2026, D-8: STANDARD to ładunki NTG, poza zakresem Watch Tower',
      'codes', to_jsonb(v_codes),
      'removed_loads', v_removed
    ),
    'migration-0137'
  );
end
$delete_standard_ntg$;
