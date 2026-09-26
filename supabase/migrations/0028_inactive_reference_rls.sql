-- 0028 — A5-SESJA-ROK (uzupełnienie): konto zdezaktywowane nie czyta tabel słownikowych.
-- Polityki geofences/vessels/sailings/fx_rates miały warunek `true` dla każdego zalogowanego,
-- a user_preferences nie sprawdzało app_users.active. Idempotentne, niedestrukcyjne:
-- zastępuje wyłącznie te polityki; danych nie dotyka.

drop policy if exists geofences_read on geofences;
create policy geofences_read on geofences for select to authenticated
  using (current_app_role() is not null);

drop policy if exists vessels_read on vessels;
create policy vessels_read on vessels for select to authenticated
  using (current_app_role() is not null);

drop policy if exists sailings_read on sailings;
create policy sailings_read on sailings for select to authenticated
  using (current_app_role() is not null);

drop policy if exists fx_rates_read on fx_rates;
create policy fx_rates_read on fx_rates for select to authenticated
  using (current_app_role() is not null);

drop policy if exists user_prefs_own on user_preferences;
create policy user_prefs_own on user_preferences for all to authenticated
  using (user_id = (select id from app_users where auth_id = auth.uid() and active))
  with check (user_id = (select id from app_users where auth_id = auth.uid() and active));
