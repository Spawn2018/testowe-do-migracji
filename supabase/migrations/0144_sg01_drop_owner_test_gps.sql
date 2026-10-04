-- =====================================================================
-- TOWER — Migracja 0144: usuń 1 testową pozycję GPS SG-01
--
-- Decyzja właściciela 2026-10-04 00:07 (czas warszawski):
-- jedna pozycja DRIVER_PWA transportu SG-01 to test właściciela
-- (telefon przez stary link kierowcy, 1 października 2026, 22:08
-- czasu warszawskiego, via=driver_token, id 13).
-- Kopia jest w R2, poza repozytorium, koszyk tower-backup,
-- klucz files/manual/usuniete_sg01_gps_2026-10-04.json
-- sha256 7b061237bf9046e634dbc75ef8e379dddd049c93da951b5f74c65d1aa0e0b402
-- (sprawdzone 2026-10-04: ten sam plik, 898 bajtów).
-- Usuwa wyłącznie ten jeden wiersz: identyfikator + źródło DRIVER_PWA
-- + via driver_token + czas zapisu + kod SG-01.
-- Inna liczba albo inny transport = STOP.
-- Na bazie bez tego wiersza (TEST) nic nie rusza.
-- Potem przeliczenie ETA. Innych wierszy nie usuwa.
-- =====================================================================

do $delete_sg01_test_gps$
declare
  v_load uuid := 'ce31ec4f-dc0f-4fc2-b7ff-c4fbde9104d6';
  v_n int;
  v_deleted int;
begin
  select count(*) into v_n
  from positions p
  join shipment_items si on si.load_id = p.load_id
  where p.id = 13
    and p.inserted_at = timestamptz '2026-10-01 20:08:32.395166+00'
    and p.load_id = v_load
    and p.source = 'DRIVER_PWA'
    and p.raw->>'via' = 'driver_token'
    and si.shipment_code = 'SG-01';

  if v_n = 0 then
    return;
  end if;
  if v_n <> 1 then
    raise exception '0144 przerwane: warunkowi źródła i czasu odpowiada % wierszy, oczekiwano 1 albo 0', v_n;
  end if;
  if (select count(*) from positions where load_id = v_load and source = 'DRIVER_PWA') <> 1 then
    raise exception '0144 przerwane: transport ma inną liczbę pozycji DRIVER_PWA niż 1';
  end if;

  delete from positions p
  where p.id = 13
    and p.inserted_at = timestamptz '2026-10-01 20:08:32.395166+00'
    and p.load_id = v_load
    and p.source = 'DRIVER_PWA'
    and p.raw->>'via' = 'driver_token'
    and exists (
      select 1 from shipment_items si
      where si.load_id = p.load_id and si.shipment_code = 'SG-01'
    );
  get diagnostics v_deleted = row_count;
  if v_deleted <> 1 then
    raise exception '0144 przerwane: usunięto % wierszy, oczekiwano 1', v_deleted;
  end if;

  perform refresh_load_eta(v_load);
end
$delete_sg01_test_gps$;
