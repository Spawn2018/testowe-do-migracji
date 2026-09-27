-- 0059 — I-7: retencja danych kierowcy 90 dni (RODO). Rozszerza purge_personal_data (cron 'tower-rodo', 02:15 UTC):
--   • imię i telefon kierowcy: 90 dni po końcu transportu — rozładowany/dostarczony (actual_delivery_at) jak dotąd,
--     NOWE: także anulowany (koniec = ostatnia zmiana wiersza; wcześniej dane anulowanych zostawały bez końca);
--   • pozycje GPS: 30 dni po rozładunku (bez zmian), NOWE: anulowany — 90 dni po anulowaniu;
--   • linki kierowcy (driver_tokens, skrót tokenu + okna użycia): NOWE — 90 dni po wygaśnięciu albo odwołaniu;
--   • transport w toku NIE jest czyszczony (dane potrzebne do realizacji) — także po terminie planu.
--   Każdy przebieg zapisuje liczby w integration_runs (job 'rodo'). Sygnatura i uprawnienia bez zmian (tylko system).
-- Dokumenty kierowcy (zdjęcia CMR/POD) — poza zakresem, decyzja D-3. Idempotentna.

create or replace function public.purge_personal_data(p_days integer default 90)
returns integer
language plpgsql
set search_path to 'public', 'extensions'
as $function$
declare n int; n_c int; n_pos int; n_pos_c int; n_tok int;
begin
  if (p_days >= 0) is not true then raise exception 'p_days musi być ≥ 0' using errcode = '22023'; end if;

  update loads set driver_name = null, driver_phone = null
  where actual_delivery_at is not null
    and actual_delivery_at < now() - make_interval(days => p_days)
    and (driver_name is not null or driver_phone is not null);
  get diagnostics n = row_count;

  update loads set driver_name = null, driver_phone = null
  where status = 'CANCELLED' and actual_delivery_at is null
    and updated_at < now() - make_interval(days => p_days)
    and (driver_name is not null or driver_phone is not null);
  get diagnostics n_c = row_count;

  -- ANEKS 4 PR5: pozycje — 30 dni po rozładunku (cały ślad transportu)
  delete from positions p
  using loads l
  where l.id = p.load_id
    and l.actual_delivery_at is not null
    and l.actual_delivery_at < now() - interval '30 days';
  get diagnostics n_pos = row_count;

  delete from positions p
  using loads l
  where l.id = p.load_id and l.status = 'CANCELLED' and l.actual_delivery_at is null
    and l.updated_at < now() - make_interval(days => p_days);
  get diagnostics n_pos_c = row_count;

  delete from driver_tokens
  where coalesce(revoked_at, expires_at) < now() - make_interval(days => p_days);
  get diagnostics n_tok = row_count;

  insert into integration_runs (job, ok, result)
  values ('rodo', true, jsonb_build_object('dni', p_days, 'kierowcy_rozladowane', n, 'kierowcy_anulowane', n_c,
          'pozycje_rozladowane', n_pos, 'pozycje_anulowane', n_pos_c, 'linki_kierowcy', n_tok));
  return n + n_c;
end $function$;

revoke all on function public.purge_personal_data(integer) from public, anon, authenticated;
