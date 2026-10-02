-- 0128 — doradca Supabase: auth_rls_initplan → (select auth.uid())
--
-- ŚWIADOMIE NIE ZMIENIAMY (POSTEP.md — ostrzeżenia doradcy zamierzone):
--   • security_definer_view na v_load_* — widoki SECURITY DEFINER (0010):
--     load_cost/load_revenue bez GRANT dla ról API; filtr WHERE + security_barrier
--   • rls_disabled_in_public na spatial_ref_sys — PostGIS (supabase_admin),
--     ochrona wyzwalaczem 0031; RLS nie ruszamy
--   • anon_security_definer st_estimatedextent — właściciel supabase_admin;
--     REVOKE od ról API nie zmienia ACL (grantor=supabase_admin) — bez zmiany

drop policy if exists users_self on public.app_users;
create policy users_self on public.app_users for select to authenticated using (
  (auth_id = (select auth.uid()) and active) or is_hhl()
);

drop policy if exists user_prefs_own on public.user_preferences;
create policy user_prefs_own on public.user_preferences for all to authenticated
  using (user_id = (select id from app_users where auth_id = (select auth.uid()) and active))
  with check (user_id = (select id from app_users where auth_id = (select auth.uid()) and active));

drop policy if exists ops_thresholds_read on public.ops_thresholds;
create policy ops_thresholds_read on public.ops_thresholds for select to authenticated using (
  exists (
    select 1 from app_users u
    where u.auth_id = (select auth.uid()) and u.active
      and u.role in ('HHL_ADMIN','HHL_OPS')
  )
);

drop policy if exists system_broadcast_read on public.system_broadcast;
create policy system_broadcast_read on public.system_broadcast for select to authenticated using (
  exists (
    select 1 from app_users u
    where u.auth_id = (select auth.uid()) and u.active and u.role = 'HHL_ADMIN'
  )
);
