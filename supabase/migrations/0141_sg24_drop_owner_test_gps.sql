-- =====================================================================
-- TOWER — Migracja 0141: usuń 5 testowych pozycji GPS SG-24
--
-- Decyzja właściciela 2026-10-03 21:02 (czas warszawski):
-- pięć pozycji DRIVER_PWA transportu SG-24 to test właściciela
-- (telefon przez stary link kierowcy). Kopia jest w R2,
-- files/manual/usuniete_sg24_gps_2026-10-03.json, poza repozytorium.
-- Usuwa wyłącznie te pięć wierszy: identyfikator + źródło DRIVER_PWA
-- + czas zapisu + kod SG-24. Inna liczba albo inny transport = STOP.
-- Na bazie bez tych wierszy (TEST) nic nie rusza.
-- Potem przeliczenie ETA i zamknięcie otwartej decyzji ETA_AFTER_LATEST.
-- =====================================================================

do $delete_sg24_test_gps$
declare
  v_load uuid := '9fa70e96-8f88-4aec-9523-9a8ed5153bc3';
  v_note text := 'otwarta błędnie — pozycje testowe właściciela';
  v_n int;
  v_deleted int;
  r record;
begin
  select count(*) into v_n
  from positions p
  join shipment_items si on si.load_id = p.load_id
  join (
    values
      (14::bigint, timestamptz '2026-10-01 20:24:35.883444+00'),
      (15::bigint, timestamptz '2026-10-01 20:33:19.763035+00'),
      (16::bigint, timestamptz '2026-10-01 21:02:44.14594+00'),
      (17::bigint, timestamptz '2026-10-01 21:25:02.36484+00'),
      (18::bigint, timestamptz '2026-10-01 21:48:05.62526+00')
  ) as w(id, inserted_at)
    on p.id = w.id and p.inserted_at = w.inserted_at
  where p.load_id = v_load
    and p.source = 'DRIVER_PWA'
    and si.shipment_code = 'SG-24';

  if v_n = 0 then
    return;
  end if;
  if v_n <> 5 then
    raise exception '0141 przerwane: warunkowi źródła i czasu odpowiada % wierszy, oczekiwano 5 albo 0', v_n;
  end if;
  if (select count(*) from positions where load_id = v_load and source = 'DRIVER_PWA') <> 5 then
    raise exception '0141 przerwane: transport ma inną liczbę pozycji DRIVER_PWA niż 5';
  end if;

  delete from positions p
  using (
    values
      (14::bigint, timestamptz '2026-10-01 20:24:35.883444+00'),
      (15::bigint, timestamptz '2026-10-01 20:33:19.763035+00'),
      (16::bigint, timestamptz '2026-10-01 21:02:44.14594+00'),
      (17::bigint, timestamptz '2026-10-01 21:25:02.36484+00'),
      (18::bigint, timestamptz '2026-10-01 21:48:05.62526+00')
  ) as w(id, inserted_at)
  where p.id = w.id
    and p.inserted_at = w.inserted_at
    and p.load_id = v_load
    and p.source = 'DRIVER_PWA'
    and exists (
      select 1 from shipment_items si
      where si.load_id = p.load_id and si.shipment_code = 'SG-24'
    );
  get diagnostics v_deleted = row_count;
  if v_deleted <> 5 then
    raise exception '0141 przerwane: usunięto % wierszy, oczekiwano 5', v_deleted;
  end if;

  perform refresh_load_eta(v_load);

  for r in
    update decisions
       set status = 'RESOLVED',
           resolved_at = now(),
           resolution_code = 'ACCEPT_SILENT',
           resolution_note = v_note,
           snooze_until = null,
           updated_at = now()
     where load_id = v_load
       and type_code = 'ETA_AFTER_LATEST'
       and status in ('NEW', 'ASSIGNED', 'SNOOZED')
    returning id
  loop
    insert into decision_events (decision_id, actor_id, action, payload)
    values (
      r.id, null, 'RESOLVE',
      jsonb_build_object('option', 'ACCEPT_SILENT', 'note', v_note, 'via', '0141')
    );
  end loop;
end
$delete_sg24_test_gps$;
