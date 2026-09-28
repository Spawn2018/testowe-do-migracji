-- =====================================================================
-- TOWER — Migracja 0092: III-10 — pobieranie EU Weekly Oil Bulletin do fuel_index_readings (WYŁĄCZONE do D-2)
--
--   • Nowe kody indeksu: WOB_DIESEL_PL, WOB_DIESEL_SE — olej napędowy z podatkami, EUR/l (biuletyn KE podaje
--     EUR/1000 l; przeliczenie w funkcji Edge fuel-wob). SEK/PLN (OKQ8/ORLEN) bez zmian.
--   • Przełącznik security_flags.FUEL_WOB_INGEST — domyślnie WYŁĄCZONY. Włącza właściciel po D-2
--     (jeśli przewoźnik wybierze indeks WOB), razem z harmonogramem pg_cron — migracja crona NIE zakłada.
--   • fuel_wob_enabled() i fuel_wob_ingest(project, rows, source_url) — wyłącznie service_role (funkcja Edge);
--     ingest odmawia przy wyłączonym przełączniku, przyjmuje tylko kody WOB i adres energy.ec.europa.eu,
--     pomija okres już zapisany (korekta — jak dotąd przez fuel_add_reading HHL), wpis w audit_log
--     (FUEL_READING_ADD, użytkownik pusty = system) — widoczny w baf_change_log.
--   Tylko dopisywanie (wyzwalacz 0052 bez zmian). Idempotentna, niedestrukcyjna.
-- =====================================================================
alter table fuel_index_readings drop constraint if exists fuel_index_readings_index_code_check;
alter table fuel_index_readings add constraint fuel_index_readings_index_code_check
  check (index_code in ('SEK', 'PLN', 'WOB_DIESEL_PL', 'WOB_DIESEL_SE'));

alter table security_flags drop constraint if exists security_flags_key_check;
alter table security_flags add constraint security_flags_key_check
  check (key in ('MFA_HHL_ADMIN', 'EXTERNAL_MESSAGING', 'PERMIT_REQUIRED_NON_STANDARD', 'FUEL_WOB_INGEST'));
insert into security_flags (key, enabled, note)
values ('FUEL_WOB_INGEST', false,
        'III-10: cotygodniowe pobieranie EU Weekly Oil Bulletin (olej napędowy PL/SE, EUR/l) — wyłączone do D-2')
on conflict (key) do nothing;

create or replace function fuel_wob_enabled() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select enabled from security_flags where key = 'FUEL_WOB_INGEST'), false)
$$;
revoke all on function fuel_wob_enabled() from public, anon, authenticated;
grant execute on function fuel_wob_enabled() to service_role;

create or replace function fuel_wob_ingest(p_project uuid, p_rows jsonb, p_source_url text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb; v_id bigint; v_ins int := 0; v_skip int := 0;
begin
  if (fuel_wob_enabled()) is not true then
    raise exception 'Pobieranie WOB wyłączone (security_flags.FUEL_WOB_INGEST, D-2)';
  end if;
  if (exists (select 1 from projects where id = p_project)) is not true then
    raise exception 'Nieznany projekt';
  end if;
  if (p_source_url ~ '^https://energy\.ec\.europa\.eu/') is not true then
    raise exception 'Źródło WOB musi być adresem https://energy.ec.europa.eu/';
  end if;
  if (jsonb_typeof(p_rows) = 'array' and jsonb_array_length(p_rows) between 1 and 10) is not true then
    raise exception 'Odczyty WOB: tablica 1–10 pozycji';
  end if;
  for v in select * from jsonb_array_elements(p_rows) loop
    if (v->>'index_code' in ('WOB_DIESEL_PL', 'WOB_DIESEL_SE')) is not true then
      raise exception 'Kod spoza WOB: %', v->>'index_code';
    end if;
    if ((v->>'reading_date')::date <= current_date) is not true then
      raise exception 'Data odczytu nie może być z przyszłości';
    end if;
    if exists (select 1 from fuel_index_readings r where r.project_id = p_project and r.index_code = v->>'index_code'
                 and r.period = v->>'period') then
      v_skip := v_skip + 1;
      continue;
    end if;
    insert into fuel_index_readings (project_id, index_code, period, reading_date, value, source_url, source_note)
    values (p_project, v->>'index_code', v->>'period', (v->>'reading_date')::date, (v->>'value')::numeric,
            p_source_url, 'EU Weekly Oil Bulletin, z podatkami, EUR/l (pobranie automatyczne)')
    returning id into v_id;
    insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
    values (null, 'FUEL_READING_ADD', 'fuel_index_readings', v_id::text, null,
            (select to_jsonb(r) - 'entered_by' from fuel_index_readings r where r.id = v_id));
    v_ins := v_ins + 1;
  end loop;
  return jsonb_build_object('inserted', v_ins, 'skipped', v_skip);
end $$;
revoke all on function fuel_wob_ingest(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function fuel_wob_ingest(uuid, jsonb, text) to service_role;
